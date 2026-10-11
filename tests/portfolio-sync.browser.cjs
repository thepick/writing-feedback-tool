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
        await page.waitForFunction(() => typeof syncWftNow === 'function');
        const result = await page.evaluate(async () => {
            const entry = id => ({ id, createdAt: '2026-10-01T00:00:00Z', originalText: 'Keep ' + id, images: [] });
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            syncStateFromLegacyGoogleGlobals = () => {};
            ensureDriveFolderPromise = () => Promise.resolve('folder');
            syncWftDeletionsIfNeeded = () => Promise.resolve(false);
            syncWftSettingsIfNeeded = () => Promise.resolve(false);
            syncWftPortfolioIndexIfNeeded = () => Promise.resolve(false);
            checkDuplicateSyncFilesStatus = () => {};
            findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical', modifiedTime: '2026-10-01T00:00:00Z' }]);
            wftSyncState.signedIn = true;
            wftSyncState.accessToken = 'test-token';
            driveAccessToken = 'test-token';
            savePortfolioData({ Alice: { sessions: [entry('old')] } });
            const initialCounter = wftSyncState.localPortfolioCounter;
            let release, started;
            const ready = new Promise(resolve => { started = resolve; });
            let downloads = 0;
            let cloud = { Alice: { sessions: [entry('remote')] } };
            const uploads = [];
            downloadWftJsonFilePromise = () => {
                downloads++;
                if (downloads === 1) return new Promise(resolve => { release = resolve; started(); });
                return Promise.resolve(cloud);
            };
            uploadWftJsonFilePromise = (name, data) => {
                uploads.push(JSON.parse(JSON.stringify(data)));
                cloud = data;
                return Promise.resolve('canonical');
            };
            const run = syncWftNow('manual', { immediate: true });
            await ready;
            saveStudentSession('Alice', entry('new'));
            const bytesAfterNewSave = localStorage.getItem('wft_portfolio');
            release(cloud);
            const completed = await run;
            return {
                completed, downloads, uploads, local: getPortfolioData(),
                newSaveWasPresent: JSON.parse(bytesAfterNewSave).Alice.sessions.some(s => s.id === 'new'),
                pending: wftSyncState.pendingPortfolioPush,
                syncedCounter: wftSyncState.lastSyncedPortfolioCounter,
                localCounter: wftSyncState.localPortfolioCounter,
                initialCounter, isSyncing: wftSyncState.isSyncing,
                status: document.getElementById('driveSyncTextHeader').textContent
            };
        });
        assert.equal(result.newSaveWasPresent, true);
        assert.equal(result.completed, true);
        assert.equal(result.downloads, 2, 'The actual sync orchestrator must run a follow-up with the latest local snapshot');
        assert.equal(result.uploads.length, 1, 'The stale first run must not upload its snapshot');
        assert.deepEqual(result.local.Alice.sessions.map(s => s.id).sort(), ['new', 'old']);
        assert.deepEqual(result.uploads[0].Alice.sessions.map(s => s.id).sort(), ['new', 'old']);
        assert.equal(result.local.Alice.sessions.find(s => s.id === 'new').originalText, 'Keep new');
        assert.equal(result.pending, false);
        assert.equal(result.syncedCounter, result.localCounter);
        assert.equal(result.localCounter, result.initialCounter + 1);
        assert.equal(result.isSyncing, false);
        assert.match(result.status, /Synced/);
        assert.deepEqual(errors, []);
        console.log('Browser portfolio sync test passed: a save during a delayed Drive pull survives locally and reaches Drive through the queued follow-up run.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
