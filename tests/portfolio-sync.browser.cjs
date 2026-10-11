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
        // Pending local work is not a deletion marker for writing saved on another device.
        assert.deepEqual(result.local.Alice.sessions.map(s => s.id).sort(), ['new', 'old', 'remote']);
        assert.deepEqual(result.uploads[0].Alice.sessions.map(s => s.id).sort(), ['new', 'old', 'remote']);
        assert.equal(result.local.Alice.sessions.find(s => s.id === 'new').originalText, 'Keep new');
        assert.equal(result.pending, false);
        assert.equal(result.syncedCounter, result.localCounter);
        assert.equal(result.localCounter, result.initialCounter + 1);
        assert.equal(result.isSyncing, false);
        assert.match(result.status, /Synced/);
        for (const scenario of ['union', 'duplicates', 'local-newer', 'cloud-newer', 'deleted', 'restored', 'failed-write']) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof syncWftNow === 'function');
            const outcome = await page.evaluate(async scenario => {
                const entry = id => ({ id, createdAt: '2026-10-01T00:00:00Z', originalText: 'Keep ' + id, images: [] });
                scheduleWftCloudSync = () => {};
                stopWftSyncPolling();
                syncStateFromLegacyGoogleGlobals = () => {};
                ensureDriveFolderPromise = () => Promise.resolve('folder');
                syncWftDeletionsIfNeeded = () => Promise.resolve(false);
                syncWftSettingsIfNeeded = () => Promise.resolve(false);
                syncWftPortfolioIndexIfNeeded = () => Promise.resolve(false);
                checkDuplicateSyncFilesStatus = () => {};
                wftSyncState.signedIn = true;
                wftSyncState.accessToken = driveAccessToken = 'test-token';
                localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify({}));
                const local = { Alice: { sessions: [entry('local')] } };
                let cloud = { Alice: { sessions: [entry('remote')] } };
                const duplicate = { Alice: { sessions: [entry('duplicate')] } };
                if (scenario.endsWith('-newer')) {
                    local.Alice.sessions[0].id = cloud.Alice.sessions[0].id = 'same';
                    local.Alice.sessions[0].updatedAt = scenario === 'local-newer' ? '2026-10-03' : '2026-10-01';
                    cloud.Alice.sessions[0].updatedAt = scenario === 'cloud-newer' ? '2026-10-03' : '2026-10-01';
                    local.Alice.sessions[0].images = [{ imageId: 'local-photo', driveFileId: 'local-file' }];
                    cloud.Alice.sessions[0].images = [{ imageId: 'remote-photo', driveFileId: 'remote-file' }];
                }
                if (scenario === 'deleted' || scenario === 'restored') {
                    local.Alice.sessions.push(entry('deleted'));
                    cloud.Alice.sessions.push(entry('deleted'));
                    cloud.Bob = { sessions: [entry('bob')] };
                }
                savePortfolioData(local);
                if (scenario === 'deleted' || scenario === 'restored') {
                    // Use the shipped successful removal and marker writers, rather than stubbing filtering.
                    if (!removeStudentSession('Alice', 'deleted')) throw new Error('Removal failed');
                    recordStudentDeletion('Bob');
                    if (scenario === 'restored') restoreStudentDeletion('Bob', 'test');
                }
                findWftFilesByNamePromise = () => Promise.resolve(scenario === 'duplicates'
                    ? [{ id: 'canonical', modifiedTime: '2026-10-03' }, { id: 'duplicate', modifiedTime: '2026-10-01' }]
                    : [{ id: 'canonical' }]);
                downloadWftJsonFilePromise = id => Promise.resolve(id === 'duplicate' ? duplicate : cloud);
                const uploads = [];
                uploadWftJsonFilePromise = (name, data) => {
                    if (name !== WFT_PORTFOLIO_FILENAME) throw new Error('Unexpected upload');
                    cloud = JSON.parse(JSON.stringify(data));
                    uploads.push(cloud);
                    return Promise.resolve('canonical');
                };
                const before = localStorage.getItem('wft_portfolio');
                const originalSetItem = Storage.prototype.setItem;
                if (scenario === 'failed-write') Storage.prototype.setItem = function(key, value) {
                    if (key === 'wft_portfolio') throw new Error('Storage full');
                    return originalSetItem.call(this, key, value);
                };
                let completed;
                try { completed = await syncWftNow('manual', { immediate: true }); }
                finally { Storage.prototype.setItem = originalSetItem; }
                const failedState = { bytes: localStorage.getItem('wft_portfolio'), uploads: uploads.length, pending: wftSyncState.pendingPortfolioPush, synced: wftSyncState.lastSyncedPortfolioCounter, counter: wftSyncState.localPortfolioCounter, status: document.getElementById('driveSyncTextHeader').textContent };
                if (scenario === 'failed-write') await syncWftNow('recovery', { immediate: true });
                return { completed, before, failedState, local: getPortfolioData(), cloud, uploads, pending: wftSyncState.pendingPortfolioPush, synced: wftSyncState.lastSyncedPortfolioCounter, counter: wftSyncState.localPortfolioCounter, deletions: getDeletionsData() };
            }, scenario);
            assert.equal(outcome.completed, scenario !== 'failed-write', scenario);
            assert.equal(outcome.uploads.length, 1, scenario);
            assert.deepEqual(outcome.cloud, outcome.local, scenario + ' local and uploaded union');
            assert.equal(outcome.pending, false, scenario);
            assert.equal(outcome.synced, outcome.counter, scenario);
            if (scenario.endsWith('-newer')) {
                assert.equal(outcome.local.Alice.sessions.length, 1);
                assert.equal(outcome.local.Alice.sessions[0].originalText, scenario === 'local-newer' ? 'Keep local' : 'Keep remote');
                assert.deepEqual(outcome.local.Alice.sessions[0].images.map(i => i.driveFileId).sort(), ['local-file', 'remote-file']);
            } else {
                assert.deepEqual(outcome.local.Alice.sessions.map(s => s.id).sort(), scenario === 'duplicates' ? ['duplicate', 'local', 'remote'] : ['local', 'remote'], scenario);
            }
            if (scenario === 'deleted' || scenario === 'restored') {
                assert.ok(outcome.deletions.deletedSessions['session:alice:deleted']);
                assert.equal(!!outcome.local.Bob, scenario === 'restored');
                if (scenario === 'deleted') assert.ok(outcome.deletions.deletedStudents['student:bob']);
                else assert.ok(outcome.deletions.restoredStudents['student:bob']);
            }
            if (scenario === 'failed-write') {
                assert.equal(outcome.failedState.bytes, outcome.before, 'Failed merge must preserve local bytes');
                assert.equal(outcome.failedState.uploads, 0);
                assert.equal(outcome.failedState.pending, true);
                assert.notEqual(outcome.failedState.synced, outcome.failedState.counter);
                assert.doesNotMatch(outcome.failedState.status, /^Synced/);
            }
        }
        assert.deepEqual(errors, []);
        console.log('Browser portfolio sync: 8 scenarios passed; real union, duplicates, timestamp/media conflicts, persisted deletions/restores, failed-write recovery and delayed-save follow-up.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
