const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream', body: fs.readFileSync(file) });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof commitPendingPortfolioSync === 'function');
        const result = await page.evaluate(() => {
            const entry = id => ({ id, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', originalText: 'Writing to keep', images: [] });
            const prepare = (sourceId = 'old') => {
                localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [entry('old'), entry('keep')] }, Bob: { sessions: [entry('other')] } }));
                localStorage.removeItem(WFT_DELETIONS_STORAGE_KEY);
                pendingPortfolioSync = { studentName: 'Bob', sessionData: entry('new'), replaceSource: { sourceStudentName: 'Alice', sourceSessionId: sourceId }, signature: 'replacement' };
                persistPendingPortfolioSync();
            };
            prepare();
            const moved = commitPendingPortfolioSync();
            const successful = { moved, portfolio: getPortfolioData(), deleted: getDeletionsData().deletedSessions, pending: getPendingPortfolioSync() };
            prepare('missing');
            const missing = { committed: commitPendingPortfolioSync(), portfolio: getPortfolioData(), pending: !!getPendingPortfolioSync(), deleted: getDeletionsData().deletedSessions };
            prepare();
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'wft_portfolio') throw new DOMException('Storage full', 'QuotaExceededError');
                return originalSetItem.call(this, key, value);
            };
            let failed;
            try {
                failed = { committed: commitPendingPortfolioSync(), portfolio: getPortfolioData(), pending: !!getPendingPortfolioSync(), persistedPending: !!localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), deleted: getDeletionsData().deletedSessions };
            } finally { Storage.prototype.setItem = originalSetItem; }
            return { successful, missing, failed };
        });
        assert.equal(result.successful.moved, true);
        assert.deepEqual(result.successful.portfolio.Alice.sessions.map(session => session.id), ['keep']);
        assert.deepEqual(result.successful.portfolio.Bob.sessions.map(session => session.id), ['other', 'new']);
        assert.equal(result.successful.pending, null);
        assert.equal(result.successful.deleted['session:alice:old'].sessionId, 'old');
        for (const state of [result.missing, result.failed]) {
            assert.equal(state.committed, false);
            assert.equal(state.pending, true);
            assert.deepEqual(state.portfolio.Alice.sessions.map(session => session.id), ['old', 'keep']);
            assert.deepEqual(state.portfolio.Bob.sessions.map(session => session.id), ['other']);
            assert.deepEqual(state.deleted, {});
        }
        assert.equal(result.failed.persistedPending, true);
        assert.deepEqual(errors, []);
        console.log('Browser portfolio replacement tests passed with real app storage: single move, missing source, quota failure, pending-work preservation and no premature deletion.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
