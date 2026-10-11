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
        await page.waitForFunction(() => typeof deletePortfolioSession === 'function');
        await page.evaluate(() => {
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            wftConfirm = async () => true;
            window.removalAlerts = [];
            window.alert = message => removalAlerts.push(message);
            const entry = (id, createdAt) => ({ id, createdAt, title: id, originalText: 'Writing to keep', images: [] });
            window.removalOriginal = JSON.stringify({ Alice: { sessions: [entry('other', 'saved'), entry('saved', '2026-10-01T00:00:00Z'), entry('keep', '2026-10-02T00:00:00Z')] } });
            localStorage.setItem('wft_portfolio', removalOriginal);
            localStorage.setItem('wft_students', JSON.stringify(['Alice']));
            localStorage.removeItem(WFT_DELETIONS_STORAGE_KEY);
            students = ['Alice'];
            refreshPortfolioDropdown();
            document.getElementById('portfolioStudentSelect').value = 'Alice';
            renderStudentPortfolio();
            window.removalCounters = [wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter];
            window.removalSetItem = Storage.prototype.setItem;
            window.removalWrites = 0;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'wft_portfolio') { removalWrites++; throw new DOMException('Storage full', 'QuotaExceededError'); }
                return removalSetItem.call(this, key, value);
            };
        });
        const removeButton = page.locator('button.btn-delete[data-student="Alice"][data-session="saved"]');
        await removeButton.evaluate(button => button.click());
        await page.waitForFunction(() => removalAlerts.length === 1);
        const failed = await page.evaluate(() => {
            Storage.prototype.setItem = removalSetItem;
            return {
                bytesKept: localStorage.getItem('wft_portfolio') === removalOriginal,
                markers: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY), writes: removalWrites,
                countersKept: JSON.stringify(removalCounters) === JSON.stringify([wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter]),
                visibleToSync: applyDeletionsToPortfolio(getPortfolioData(), getDeletionsData()).Alice.sessions.map(session => session.id),
                alert: removalAlerts[0]
            };
        });
        assert.equal(failed.bytesKept, true);
        assert.equal(failed.markers, null);
        assert.equal(failed.writes, 2);
        assert.equal(failed.countersKept, true);
        assert.deepEqual(failed.visibleToSync, ['other', 'saved', 'keep']);
        assert.match(failed.alert, /could not be removed/i);
        await removeButton.evaluate(button => button.click());
        await page.waitForFunction(() => !getPortfolioData().Alice.sessions.some(session => session.id === 'saved'));
        const success = await page.evaluate(async () => {
            const portfolio = getPortfolioData();
            const markers = Object.values(getDeletionsData().deletedSessions);
            const remoteBeforeRemoval = JSON.parse(removalOriginal);
            const before = localStorage.getItem('wft_portfolio');
            await deletePortfolioSession('Alice', '0');
            return { portfolio, markers, staleKept: localStorage.getItem('wft_portfolio') === before,
                merged: applyDeletionsToPortfolio(remoteBeforeRemoval, getDeletionsData()).Alice.sessions.map(session => session.id),
                alerts: removalAlerts, remainingButtons: document.querySelectorAll('button.btn-delete[data-student="Alice"]').length };
        });
        assert.deepEqual(success.portfolio.Alice.sessions.map(session => session.id), ['other', 'keep']);
        assert.ok(success.markers.every(marker => marker.sessionId === 'saved'));
        assert.ok(success.markers.length > 0);
        assert.deepEqual(success.merged, ['other', 'keep']);
        assert.equal(success.staleKept, true);
        assert.match(success.alerts[1], /could not be found/i);
        assert.equal(success.remainingButtons, 2);
        assert.deepEqual(errors, []);
        console.log('Browser removal test passed: the actual Remove button preserves writing and sync visibility on quota failure; retry removes only its selected entry and stale indices cannot delete another.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
