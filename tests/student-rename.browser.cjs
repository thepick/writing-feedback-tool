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
        await page.waitForFunction(() => typeof renameStudent === 'function');
        const result = await page.evaluate(async () => {
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            wftTextInput = async () => 'Alicia';
            wftConfirm = async () => true;
            const alerts = [];
            window.alert = message => alerts.push(message);
            const original = JSON.stringify({ Alice: { sessions: [{ id: 'saved', originalText: 'Writing to keep', images: [] }] }, Bob: { sessions: [] } });
            localStorage.setItem('wft_portfolio', original);
            localStorage.setItem('wft_students', JSON.stringify(['Alice', 'Bob']));
            localStorage.setItem('wft_selectedStudent', 'Alice');
            localStorage.removeItem(WFT_DELETIONS_STORAGE_KEY);
            students = ['Alice', 'Bob']; selectedStudent = 'Alice';
            renderStudentList(); populateStudentDropdown();
            const counters = [wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter];
            const setItem = Storage.prototype.setItem;
            let writes = 0;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'wft_portfolio') { writes++; throw new DOMException('Storage full', 'QuotaExceededError'); }
                return setItem.call(this, key, value);
            };
            try { await renameStudent('Alice'); } finally { Storage.prototype.setItem = setItem; }
            const failed = {
                bytesKept: localStorage.getItem('wft_portfolio') === original,
                roster: JSON.parse(localStorage.getItem('wft_students')), selected: localStorage.getItem('wft_selectedStudent'),
                markers: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY), writes,
                countersKept: JSON.stringify(counters) === JSON.stringify([wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter]),
                visibleToSync: Object.keys(applyDeletionsToPortfolio(getPortfolioData(), getDeletionsData())),
                alerts: alerts.slice(), uiSelection: document.getElementById('studentSelect').value
            };
            await renameStudent('Alice');
            return { failed, renamed: getPortfolioData(), roster: JSON.parse(localStorage.getItem('wft_students')),
                selected: localStorage.getItem('wft_selectedStudent'), deleted: Object.values(getDeletionsData().deletedStudents),
                visibleToSync: Object.keys(applyDeletionsToPortfolio(getPortfolioData(), getDeletionsData())) };
        });
        assert.equal(result.failed.bytesKept, true);
        assert.deepEqual(result.failed.roster, ['Alice', 'Bob']);
        assert.equal(result.failed.selected, 'Alice');
        assert.equal(result.failed.uiSelection, 'Alice');
        assert.equal(result.failed.markers, null, 'A failed rename must not hide the original writing on the next cloud merge');
        assert.equal(result.failed.writes, 2);
        assert.equal(result.failed.countersKept, true);
        assert.deepEqual(result.failed.visibleToSync.sort(), ['Alice', 'Bob']);
        assert.match(result.failed.alerts[0], /could not be renamed/i);
        assert.equal(result.renamed.Alicia.sessions[0].originalText, 'Writing to keep');
        assert.equal(result.renamed.Alice, undefined);
        assert.deepEqual(result.roster, ['Alicia', 'Bob']);
        assert.equal(result.selected, 'Alicia');
        assert.ok(result.deleted.some(record => record.studentName === 'Alice'));
        assert.deepEqual(result.visibleToSync.sort(), ['Alicia', 'Bob']);
        assert.deepEqual(errors, []);
        console.log('Browser rename test passed: quota failure preserves writing, roster, selection and sync visibility; retry succeeds after storage recovers.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
