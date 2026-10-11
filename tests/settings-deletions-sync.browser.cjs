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
        const results = await page.evaluate(async () => {
            const clone = value => JSON.parse(JSON.stringify(value));
            const settingsSync = syncWftSettingsIfNeeded, deletionsSync = syncWftDeletionsIfNeeded;
            const setItem = Storage.prototype.setItem;
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            syncStateFromLegacyGoogleGlobals = () => {};
            ensureDriveFolderPromise = () => Promise.resolve('folder');
            syncWftPortfolioIfNeeded = () => Promise.resolve(false);
            syncWftPortfolioIndexIfNeeded = () => Promise.resolve(false);
            checkDuplicateSyncFilesStatus = () => {};
            wftSyncState.signedIn = true;
            wftSyncState.accessToken = driveAccessToken = 'test-token';
            const results = [];
            for (const stream of ['Settings', 'Deletions']) {
                for (const scenario of ['create-race', 'update-race', 'failed-pull', 'failed-push']) {
                    syncWftSettingsIfNeeded = stream === 'Settings' ? settingsSync : () => Promise.resolve(false);
                    syncWftDeletionsIfNeeded = stream === 'Deletions' ? deletionsSync : () => Promise.resolve(false);
                    localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify({}));
                    students = ['Test Student'];
                    document.getElementById('targetWordCount').value = '200';
                    const initial = stream === 'Settings' ? getLocalSettingsSnapshot() : normalizeDeletionsData({ deletedSessions: { old: { sessionId: 'old', deletedAt: '2026-10-10T00:00:00Z' } }, records: [{ id: 'old', sessionId: 'old', deletedAt: '2026-10-10T00:00:00Z' }] });
                    const key = stream === 'Settings' ? 'wft_settings' : WFT_DELETIONS_STORAGE_KEY;
                    localStorage.setItem(key, JSON.stringify(initial));
                    const race = scenario.endsWith('race');
                    wftSyncState['pending' + stream + 'Push'] = scenario !== 'failed-pull';
                    wftSyncState['local' + stream + 'Counter'] = 1;
                    wftSyncState['lastSynced' + stream + 'Counter'] = 0;
                    wftSyncState['lastSynced' + stream + 'Hash'] = 'previous';
                    wftSyncState.needsSyncAfterCurrent = false;
                    wftSyncState.lastError = null;
                    let files = scenario === 'create-race' ? [] : [{ id: 'canonical' }];
                    let cloud = stream === 'Settings' ? { ...clone(initial), targetWordCount: '100', students: ['Cloud Student', 'Test Student'] } : normalizeDeletionsData({ deletedSessions: { cloud: { sessionId: 'cloud', deletedAt: '2026-10-10T00:00:00Z' } }, records: [{ id: 'cloud', sessionId: 'cloud', deletedAt: '2026-10-10T00:00:00Z' }] });
                    let searches = 0, started, release;
                    const ready = new Promise(resolve => { started = resolve; });
                    const uploads = [];
                    findWftFilesByNamePromise = () => { searches++; return Promise.resolve(files); };
                    downloadWftJsonFilePromise = () => Promise.resolve(clone(cloud));
                    uploadWftJsonFilePromise = async (name, data) => {
                        uploads.push(clone(data));
                        if (race && uploads.length === 1) await new Promise(resolve => { release = resolve; started(); });
                        cloud = clone(data);
                        files = [{ id: 'canonical' }];
                        return 'canonical';
                    };
                    const before = { stored: localStorage.getItem(key), roster: clone(students), target: document.getElementById('targetWordCount').value, pending: wftSyncState['pending' + stream + 'Push'] };
                    if (!race) Storage.prototype.setItem = function(name, value) {
                        if (name === key) throw new Error('Storage full');
                        return setItem.call(this, name, value);
                    };
                    let completed;
                    try {
                        const run = syncWftNow('manual', { immediate: true });
                        if (race) {
                            await ready;
                            if (stream === 'Settings') {
                                document.getElementById('targetWordCount').value = '300';
                                saveSettingsToLocalStorage();
                            } else {
                                const latest = getDeletionsData();
                                latest.deletedSessions.new = { sessionId: 'new', deletedAt: '2026-10-10T00:00:00Z' };
                                latest.records.push({ id: 'new', sessionId: 'new', deletedAt: '2026-10-10T00:00:00Z' });
                                saveDeletionsData(latest);
                            }
                            release();
                        }
                        completed = await run;
                    } finally { Storage.prototype.setItem = setItem; }
                    results.push({ stream, scenario, completed, searches, uploads, cloud, before, stored: localStorage.getItem(key), roster: clone(students), target: document.getElementById('targetWordCount').value, pending: wftSyncState['pending' + stream + 'Push'], localCounter: wftSyncState['local' + stream + 'Counter'], syncedCounter: wftSyncState['lastSynced' + stream + 'Counter'], syncedHash: wftSyncState['lastSynced' + stream + 'Hash'], suppress: wftSuppressDirtyMarks, error: wftSyncState.lastError && wftSyncState.lastError.message, status: document.getElementById('driveSyncTextHeader').textContent });
                }
            }
            return results;
        });
        let failed = 0;
        for (const result of results) {
            const name = result.stream + ' ' + result.scenario;
            try {
                if (result.scenario.endsWith('race')) {
                    assert.equal(result.completed, true);
                    assert.equal(result.searches, 2, 'The actual orchestrator must run the queued follow-up');
                    assert.equal(result.uploads.length, 2);
                    assert.equal(result.pending, false);
                    assert.equal(result.localCounter, 2);
                    assert.equal(result.syncedCounter, 2);
                    if (result.stream === 'Settings') {
                        assert.equal(result.target, '300');
                        assert.equal(result.cloud.targetWordCount, '300');
                    } else {
                        assert.ok(result.cloud.deletedSessions.new);
                        assert.ok(result.cloud.records.some(r => r.id === 'new'));
                    }
                    assert.match(result.status, /Synced/);
                } else {
                    assert.equal(result.completed, false, 'A failed merge must fail the actual sync run');
                    assert.equal(result.stored, result.before.stored);
                    assert.deepEqual(result.roster, result.before.roster);
                    assert.equal(result.target, result.before.target);
                    assert.equal(result.pending, result.before.pending);
                    assert.equal(result.localCounter, 1);
                    assert.equal(result.syncedCounter, 0);
                    assert.equal(result.syncedHash, 'previous');
                    assert.equal(result.suppress, false);
                    assert.deepEqual(result.uploads, []);
                    assert.equal(result.error, 'Storage full');
                    assert.match(result.status, /needs attention/);
                }
                console.log('PASS browser', name);
            } catch (error) { failed++; console.error('FAIL browser', name + ':', error.message); }
        }
        assert.deepEqual(errors, []);
        console.log(`Browser settings/deletions sync: ${results.length - failed} passed, ${failed} failed.`);
        assert.equal(failed, 0);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
