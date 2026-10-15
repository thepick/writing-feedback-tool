const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    try {
        for (const replacement of [false, true]) for (const failure of ['refresh', 'read-after-clear', 'signature']) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => localAppRoute(route, root));
            const name = `${replacement ? 'replacement' : 'new writing'}: ${failure}`;
            let observed;
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                observed = await page.evaluate(({ replacement, failure }) => {
                    stopWftSyncPolling(); stopDriveAutoSync();
                    scheduleWftCloudSync = () => {}; alert = () => {};
                    localStorage.clear(); pendingPortfolioSync = null; wftStudentChangeRecovery = null;
                    const entry = (id, text) => ({ id, createdAt: '2026-10-15T00:00:00Z', originalText: text, images: [] });
                    savePortfolioData({ Alice: { sessions: [entry('old', 'Protected original writing.')] } });
                    pendingPortfolioSync = { studentName: 'Alice', signature: 'committed-signature',
                        sessionData: entry('new', 'Exact new synthetic writing.'),
                        ...(replacement ? { replaceSource: { sourceStudentName: 'Alice', sourceSessionId: 'old' } } : {}) };
                    persistPendingPortfolioSync();
                    lastSyncedPortfolioSessionSignature = 'previous-signature';
                    const portfolioBefore = localStorage.getItem('wft_portfolio');
                    const pendingBefore = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
                    const get = Storage.prototype.getItem, remove = Storage.prototype.removeItem;
                    const update = updateSyncPortfolioButtonState, getSignature = getCurrentPortfolioSessionSignature;
                    let cleared = false, refreshes = 0;
                    Storage.prototype.removeItem = function(key) {
                        const result = remove.call(this, key);
                        if (this === localStorage && key === PENDING_PORTFOLIO_SYNC_KEY) cleared = true;
                        return result;
                    };
                    Storage.prototype.getItem = function(key) {
                        if (failure === 'read-after-clear' && cleared && this === localStorage && key === PENDING_PORTFOLIO_SYNC_KEY) throw Error('Synthetic pending read unavailable after clear');
                        return get.call(this, key);
                    };
                    if (failure === 'refresh') updateSyncPortfolioButtonState = () => { refreshes++; throw Error('Synthetic button refresh failed'); };
                    if (failure === 'signature') {
                        pendingPortfolioSync.signature = '';
                        getCurrentPortfolioSessionSignature = () => { throw Error('Synthetic signature unavailable'); };
                    }
                    let committed;
                    try { committed = commitPendingPortfolioSync(); }
                    finally { Storage.prototype.getItem = get; Storage.prototype.removeItem = remove; updateSyncPortfolioButtonState = update; getCurrentPortfolioSessionSignature = getSignature; }
                    return { committed, cleared, refreshes, signature: lastSyncedPortfolioSessionSignature,
                        portfolio: getLocalPortfolioSnapshot(), deletions: getDeletionsData(),
                        pending: getPendingPortfolioSync(), pendingRaw: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY),
                        recovery: wftStudentChangeRecovery,
                        portfolioUnchanged: localStorage.getItem('wft_portfolio') === portfolioBefore,
                        pendingUnchanged: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === pendingBefore };
                }, { replacement, failure });
                if (failure === 'signature') {
                    assert.equal(observed.committed, false);
                    assert.equal(observed.cleared, false, 'A signature failure must happen before draft cleanup');
                    assert.equal(observed.portfolioUnchanged, true);
                    assert.equal(observed.pendingUnchanged, true, 'Failed commit retains the durable draft for retry');
                    assert.equal(observed.pending.sessionData.originalText, 'Exact new synthetic writing.');
                    assert.equal(observed.signature, 'previous-signature');
                    assert.deepEqual(errors, []);
                    cases.push({ name, passed: true, observed });
                    continue;
                }
                assert.equal(observed.cleared, true, 'Failure must happen after actual pending removal');
                assert.equal(observed.committed, true, 'Display/read failure after cleanup must not roll back committed writing');
                assert.equal(observed.signature, 'committed-signature');
                assert.equal(observed.pending, null);
                assert.equal(observed.pendingRaw, null);
                assert.equal(observed.recovery, null);
                assert.equal(observed.portfolio.Alice.sessions.find(s => s.id === 'new').originalText, 'Exact new synthetic writing.');
                assert.deepEqual(observed.portfolio.Alice.sessions.map(s => s.id).sort(), replacement ? ['new'] : ['new', 'old']);
                assert.equal(!!observed.deletions.deletedSessions['session:alice:old'], replacement);
                await page.reload({ waitUntil: 'load' });
                const reloaded = await page.evaluate(() => {
                    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                    return { portfolio: getLocalPortfolioSnapshot(), pending: getPendingPortfolioSync() };
                });
                assert.deepEqual(reloaded.portfolio, observed.portfolio, 'Committed writing must survive reload');
                assert.equal(reloaded.pending, null, 'A successful commit must not reappear as a duplicate draft');
                assert.deepEqual(errors, []);
                cases.push({ name, passed: true, observed });
            } catch (error) { cases.push({ name, passed: false, error: error.message, observed }); }
            finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length }, null, 2));
    for (const item of cases) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}${item.error ? ': ' + item.error : ''}`);
    assert.equal(cases.filter(c => !c.passed).length, 0, 'Pending commit publication regressions');
})().catch(error => { console.error(error); process.exitCode = 1; });
