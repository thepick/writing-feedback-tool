const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function serveTestFile(route) {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
}

async function exerciseLocalCorruption(raw) {
    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
    const entry = { id: 'pending', originalText: 'Keep pending writing', images: [] };
    let uploads = 0, flushes = 0;
    saveFileToDrive = () => { uploads++; };
    flushWftCloudSyncNow = () => { flushes++; return Promise.resolve(true); };
    driveAccessToken = 'synthetic-token';
    const outcomes = [];
    const check = (action, error = '') => outcomes.push({ action, error, preserved: localStorage.getItem('wft_portfolio') === raw });
    check('startup');
    let snapshotError = '';
    readRejectedSnapshot();
    function readRejectedSnapshot() { try { getLocalPortfolioSnapshot(); } catch (error) { snapshotError = error.message; } }
    check('snapshot', snapshotError);
    exerciseRejectedLocalWrites();
    function exerciseRejectedLocalWrites() {
        try { saveStudentSession('Bob', entry); } catch (error) { check('session-save', error.message); }
        check('after-session');
        try { savePortfolioData({}); } catch (error) { check('empty-save', error.message); }
        try { savePortfolioLocalOnly({}); } catch (error) { check('cloud-local-write', error.message); }
    }
    let indexWrites = 0, migrationBackups = 0;
    savePortfolioIndexToDrive = () => { indexWrites++; };
    saveWftPreMigrationBackupToDrive = () => { migrationBackups++; };
    WFT_PORTFOLIO_INDEX_V1 = true; WFT_SPLIT_STUDENT_FILES_V1 = true;
    let indexFailed = false, migrationFailed = false;
    rebuildPortfolioIndex(error => { indexFailed = !!error; });
    try { savePortfolioData({}); } catch (error) { migrationFailed = !!error; }
    pendingPortfolioSync = { studentName: 'Bob', sessionData: entry, signature: 'synthetic' };
    persistPendingPortfolioSync();
    const committed = commitPendingPortfolioSync();
    const pendingKept = !!getPendingPortfolioSync() && !!localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
    for (const v2 of [true, false]) {
        WFT_SYNC_ENGINE_V2 = v2;
        window.dispatchEvent(new Event('pagehide')); check('pagehide-' + v2);
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange')); check('hidden-' + v2);
        let success;
        try { syncAllToDrive(value => { success = value; }); } catch (error) { check('sync-all-throw-' + v2, error.message); }
        await Promise.resolve();
        check('sync-all-' + v2, String(success));
    }
    const backup = buildWftEmergencyBackupObject();
    // Storage repaired externally: retry must work and commit the same pending writing.
    WFT_SYNC_ENGINE_V2 = true; driveAccessToken = '';
    localStorage.setItem('wft_portfolio', '{}');
    const retried = commitPendingPortfolioSync();
    return { outcomes, snapshotError, committed, pendingKept, retried, retryWriting: getPortfolioData().Bob?.sessions[0]?.originalText, backup: backup.contents.wft_portfolio, recovery: wftStudentChangeRecovery, uploads, flushes, indexFailed, migrationFailed, indexWrites, migrationBackups };
}

function assertCorruptBytesAndRejectedWrites(result, raw) {
    assert.ok(result.snapshotError, 'Unreadable snapshots must fail: ' + JSON.stringify(raw));
    assert.ok(result.outcomes.every(state => state.preserved), JSON.stringify(result.outcomes));
    assert.ok(result.outcomes.some(state => state.action === 'session-save'));
    assert.ok(result.outcomes.some(state => state.action === 'empty-save'));
    assert.ok(result.outcomes.some(state => state.action === 'cloud-local-write'));
    assert.ok(result.outcomes.filter(state => state.action.startsWith('sync-all-') && !state.action.includes('throw')).every(state => state.error === 'false'));
}

function assertBlockedCloudWrites(result) {
    assert.equal(result.committed, false); assert.equal(result.pendingKept, true);
    assert.equal(result.uploads, 0); assert.equal(result.flushes, 0);
    assert.equal(result.indexFailed, true); assert.equal(result.migrationFailed, true);
    assert.equal(result.indexWrites, 0); assert.equal(result.migrationBackups, 0);
    assert.equal(result.recovery, null, 'Do not replace the PR44 rollback buffer with corrupt-data recovery');
}

function assertRecoveryAndUsablePage(result, raw, errors) {
    assert.equal(result.retried, true); assert.equal(result.retryWriting, 'Keep pending writing');
    let expectedBackup; try { expectedBackup = JSON.parse(raw); } catch { expectedBackup = raw; }
    assert.deepEqual(result.backup, expectedBackup);
    assert.deepEqual(errors, [], 'Startup and lifecycle should remain usable');
}

async function exerciseCloudCorruption() {
    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
    const entry = id => ({ id, originalText: 'Keep ' + id, images: [] });
    const valid = JSON.stringify({ Alice: { sessions: [entry('old')] } });
    localStorage.setItem('wft_portfolio', valid);
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if (key === 'wft_portfolio') throw new DOMException('Read denied', 'SecurityError'); return originalGet.call(this, key); };
    let readSnapshotFailed = false, readSaveFailed = false, readDisplay;
    exerciseDeniedLocalReads();
    function exerciseDeniedLocalReads() {
        try {
            readDisplay = getPortfolioData();
            try { getLocalPortfolioSnapshot(); } catch { readSnapshotFailed = true; }
            try { savePortfolioData({}); } catch { readSaveFailed = true; }
            saveWftLocalSnapshotsBeforeHide();
        } finally { Storage.prototype.getItem = originalGet; }
    }
    const readBytesKept = localStorage.getItem('wft_portfolio') === valid;
    const empty = [];
    exerciseEmptyPortfolios();
    function exerciseEmptyPortfolios() {
        for (const raw of [null, '{}', '{"Alice":{"sessions":[]}}']) {
            if (raw === null) localStorage.removeItem('wft_portfolio'); else localStorage.setItem('wft_portfolio', raw);
            saveStudentSession('Bob', entry('new'));
            empty.push(!!getPortfolioData().Bob);
        }
    }
    let uploads = 0;
    uploadWftJsonFilePromise = () => { uploads++; return Promise.resolve('canonical'); };
    findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical' }]);
    const cloudFailures = [];
    const download = downloadWftJsonFilePromise;
    for (const text of ['{', '', 'null', '[]', '{"Alice":{}}', '{"Alice":{"sessions":[null]}}']) {
        localStorage.setItem('wft_portfolio', valid);
        wftSyncState.pendingPortfolioPush = true;
        wftDriveFetch = () => Promise.resolve({ text: () => Promise.resolve(text) });
        downloadWftJsonFilePromise = download;
        let failed = false;
        try { await syncWftPortfolioIfNeeded('corrupt-cloud'); } catch { failed = true; }
        cloudFailures.push({ text, failed, bytesKept: localStorage.getItem('wft_portfolio') === valid, pending: wftSyncState.pendingPortfolioPush });
    }
    localStorage.setItem('wft_portfolio', valid);
    findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical' }, { id: 'duplicate' }]);
    wftDriveFetch = () => Promise.resolve({ text: () => Promise.resolve('{') });
    let duplicateFailed = false;
    try { await syncWftPortfolioIfNeeded('corrupt-duplicate'); } catch { duplicateFailed = true; }
    const duplicateBytesKept = localStorage.getItem('wft_portfolio') === valid;
    const delayed = [];
    for (const stage of ['find', 'download', 'upload']) {
        localStorage.setItem('wft_portfolio', valid);
        wftSyncState.pendingPortfolioPush = true;
        let release, entered;
        const ready = new Promise(resolve => { entered = resolve; });
        const wait = () => new Promise(resolve => { release = resolve; entered(); });
        findWftFilesByNamePromise = () => stage === 'find' ? wait() : Promise.resolve([{ id: 'canonical' }]);
        downloadWftJsonFilePromise = () => stage === 'download' ? wait() : Promise.resolve({ Bob: { sessions: [entry('remote')] } });
        uploadWftJsonFilePromise = () => stage === 'upload' ? wait() : (uploads++, Promise.resolve('canonical'));
        const run = syncWftPortfolioIfNeeded('delayed-' + stage).then(() => false, () => true);
        await ready;
        const broken = '{"Alice":'; localStorage.setItem('wft_portfolio', broken);
        release(stage === 'find' ? [{ id: 'canonical' }] : stage === 'download' ? { Bob: { sessions: [entry('remote')] } } : 'canonical');
        delayed.push({ stage, failed: await run, bytesKept: localStorage.getItem('wft_portfolio') === broken, pending: wftSyncState.pendingPortfolioPush });
    }
    // Legacy cloud pull must recheck local storage and reject invalid remote shape.
    WFT_SYNC_ENGINE_V2 = false; driveAccessToken = 'synthetic-token';
    let pull; readJsonFileFromDrive = (name, callback) => { pull = callback; };
    localStorage.setItem('wft_portfolio', valid); loadPortfolioFromDrive();
    localStorage.setItem('wft_portfolio', '{'); pull({ Bob: { sessions: [entry('remote')] } });
    const legacyDelayedKept = localStorage.getItem('wft_portfolio') === '{';
    localStorage.setItem('wft_portfolio', valid); loadPortfolioFromDrive(); pull({ Bob: {} });
    const legacyInvalidKept = localStorage.getItem('wft_portfolio') === valid;
    // Shipped upload boundary: damage arriving during file lookup prevents the actual request.
    localStorage.setItem('wft_portfolio', valid);
    ensureDriveFolder = callback => callback('synthetic-folder');
    let releaseLookup, lookupEntered;
    const lookupReady = new Promise(resolve => { lookupEntered = resolve; });
    findWftFilesByNamePromise = () => new Promise(resolve => { releaseLookup = resolve; lookupEntered(); });
    let actualUploads = 0;
    wftDriveFetch = () => { actualUploads++; return Promise.resolve({ json: () => Promise.resolve({ id: 'canonical' }) }); };
    const delayedUpload = new Promise(resolve => saveFileToDrive(WFT_PORTFOLIO_FILENAME, valid, 'application/json', error => resolve(!!error)));
    await lookupReady; localStorage.setItem('wft_portfolio', '{'); releaseLookup([{ id: 'canonical' }]);
    const uploadLookupFailed = await delayedUpload;
    // The media callback must report a delayed failure and retain pending sync.
    localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ ...entry('photo'), images: [{ dataUrl: 'data:image/jpeg;base64,AAAA', name: 'synthetic.jpg' }] }] } }));
    let releasePhoto;
    uploadBlobToDrive = (name, blob, type, callback) => { releasePhoto = callback; };
    WFT_IMAGE_COMPRESSION_V1 = false;
    const mediaRun = new Promise(resolve => syncPendingPortfolioMedia(error => resolve(!!error)));
    localStorage.setItem('wft_portfolio', '{'); releasePhoto({ id: 'synthetic-photo' });
    const delayedMediaFailed = await mediaRun;
    const delayedMediaBytesKept = localStorage.getItem('wft_portfolio') === '{';
    // Unreadable per-student cloud data must not be treated as a missing file and overwritten.
    WFT_SPLIT_STUDENT_FILES_V1 = true;
    ensureDriveFolderPromise = () => Promise.resolve('synthetic-folder');
    ensureWftStudentsFolderPromise = () => Promise.resolve('synthetic-students');
    findWftFilesByNameInFolderPromise = () => Promise.resolve([{ id: 'student-file' }]);
    downloadWftJsonFilePromise = download;
    let splitWrites = 0;
    saveStudentFileToDrive = (id, data, callback) => { splitWrites++; callback(null, 'synthetic-file'); };
    const splitFailures = [];
    for (const text of ['{', '', 'null', '{}', '{"format":"student-portfolio-v1"}', '{"format":"student-portfolio-v1","sessions":[null]}']) {
        wftDriveFetch = () => Promise.resolve({ text: () => Promise.resolve(text) });
        splitFailures.push(await new Promise(resolve => syncStudentFileWithMerge('synthetic-student', { sessions: [] }, error => resolve(!!error))));
    }
    const splitWritesAfterFailures = splitWrites;
    wftDriveFetch = () => Promise.resolve({ text: () => Promise.resolve('{"format":"student-portfolio-v1","studentId":"synthetic-student","sessions":[]}') });
    const splitEmpty = await new Promise(resolve => loadStudentFileFromDrive('synthetic-student', (error, data) => resolve(!error && Array.isArray(data.sessions) && !data.sessions.length)));
    return { readSnapshotFailed, readSaveFailed, readDisplay, readBytesKept, empty, cloudFailures, duplicateFailed, duplicateBytesKept, delayed, legacyDelayedKept, legacyInvalidKept, uploads, actualUploads, uploadLookupFailed, delayedMediaFailed, delayedMediaBytesKept, splitFailures, splitWritesAfterFailures, splitEmpty };
}

function assertDeniedReadsAndEmptyPortfolios(extra) {
    assert.equal(extra.readSnapshotFailed, true); assert.equal(extra.readSaveFailed, true); assert.deepEqual(extra.readDisplay, {}); assert.equal(extra.readBytesKept, true);
    assert.ok(extra.empty.every(Boolean));
}

function assertRejectedCloudPayloads(extra) {
    assert.ok(extra.cloudFailures.every(state => state.failed && state.bytesKept && state.pending), JSON.stringify(extra.cloudFailures));
    assert.equal(extra.duplicateFailed, true); assert.equal(extra.duplicateBytesKept, true);
    assert.ok(extra.delayed.every(state => state.failed && state.bytesKept && state.pending), JSON.stringify(extra.delayed));
    assert.equal(extra.legacyDelayedKept, true); assert.equal(extra.legacyInvalidKept, true); assert.equal(extra.uploads, 0);
}

function assertDelayedUploadAndMedia(extra) {
    assert.equal(extra.actualUploads, 0); assert.equal(extra.uploadLookupFailed, true);
    assert.equal(extra.delayedMediaFailed, true); assert.equal(extra.delayedMediaBytesKept, true);
}

function assertRejectedStudentFiles(extra) {
    assert.ok(extra.splitFailures.every(Boolean)); assert.equal(extra.splitWritesAfterFailures, 0); assert.equal(extra.splitEmpty, true);
}

async function runCorruptPortfolioSuite() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    try {
        const context = await browser.newContext();
        await context.route('**/*', serveTestFile);
        const damaged = ['{"Alice":{"sessions":[{"id":"old","originalText":"Keep original bytes"}]', '', ' ', 'null', '[]', '42', '"writing"', 'false', '{"Alice":null}', '{"Alice":{}}', '{"Alice":{"sessions":{}}}', '{"Alice":{"sessions":[null]}}', '{"Alice":{"sessions":["writing"]}}', '{"Alice":{"sessions":[[]]}}', '{"Alice":{"sessions":[]},"Bob":{"sessions":[false]}}'];
        for (const raw of damaged) {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(raw => localStorage.setItem('wft_portfolio', raw), raw);
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof syncWftNow === 'function');
            const result = await page.evaluate(exerciseLocalCorruption, raw);
            assertCorruptBytesAndRejectedWrites(result, raw);
            assertBlockedCloudWrites(result);
            assertRecoveryAndUsablePage(result, raw, errors);
            cases.push({ raw, actions: result.outcomes.map(state => state.action), passed: true });
            await page.close();
        }
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof syncWftNow === 'function');
        const extra = await page.evaluate(exerciseCloudCorruption);
        assertDeniedReadsAndEmptyPortfolios(extra);
        assertRejectedCloudPayloads(extra);
        assertDelayedUploadAndMedia(extra);
        assertRejectedStudentFiles(extra);
        console.log(JSON.stringify({ suite: 'corrupt-portfolio.browser', cases, extra, passed: true }));
    } finally { await browser.close(); }
}

runCorruptPortfolioSuite().catch(error => { console.error(error); process.exitCode = 1; });
