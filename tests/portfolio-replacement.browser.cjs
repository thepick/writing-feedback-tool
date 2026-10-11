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
            prepare();
            const savedBeforeNormalization = localStorage.getItem('wft_portfolio');
            const countersBeforeNormalization = [wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter];
            let normalizationError = '';
            try {
                savePortfolioData({ Alice: { sessions: [null, entry('new')] } });
            } catch (error) { normalizationError = error.name; }
            const normalization = {
                error: normalizationError,
                preserved: localStorage.getItem('wft_portfolio') === savedBeforeNormalization,
                countersUnchanged: JSON.stringify(countersBeforeNormalization) === JSON.stringify([wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter]),
                pending: !!localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY)
            };
            const recovered = [];
            const originalProactiveFlag = WFT_PROACTIVE_STRIP_V1;
            try {
                for (const proactive of [false, true]) {
                    WFT_PROACTIVE_STRIP_V1 = proactive;
                    let writes = 0;
                    Storage.prototype.setItem = function(key, value) {
                        if (key === 'wft_portfolio' && ++writes === 1) throw new DOMException('Storage full', 'QuotaExceededError');
                        return originalSetItem.call(this, key, value);
                    };
                    const session = { ...entry('photo'), categoryScores: { Grammar: 8 }, images: [{ id: 'image', driveFileId: 'drive-image', dataUrl: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' }] };
                    const saved = savePortfolioData({ Alice: { sessions: [session] } });
                    recovered.push({ writes, session: saved.Alice.sessions[0], matchesStorage: JSON.stringify(saved) === localStorage.getItem('wft_portfolio') });
                }
            } finally {
                Storage.prototype.setItem = originalSetItem;
                WFT_PROACTIVE_STRIP_V1 = originalProactiveFlag;
            }
            return { successful, missing, failed, normalization, recovered };
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
        assert.equal(result.normalization.error, 'TypeError');
        assert.equal(result.normalization.preserved, true, 'A real schema normalization failure must not erase saved history');
        assert.equal(result.normalization.countersUnchanged, true);
        assert.equal(result.normalization.pending, true);
        for (const recovered of result.recovered) {
            assert.equal(recovered.writes, 2);
            assert.equal(recovered.matchesStorage, true);
            assert.equal(recovered.session.originalText, 'Writing to keep');
            assert.equal(recovered.session.categoryScores.Grammar, 8);
            assert.equal(recovered.session.images[0].driveFileId, 'drive-image');
            assert.equal(recovered.session.images[0].dataUrl, undefined);
        }
        assert.deepEqual(errors, []);
        console.log('Browser portfolio save/replacement tests passed with real app storage: single move, missing source, normalization failure, quota recovery in both modes, pending-work preservation and no premature deletion.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
