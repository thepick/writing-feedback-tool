const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const scenarios = ['compression-token', 'compression-photo', 'compression-delete-image', 'compression-delete-session',
    'compression-delete-student', 'compression-rename', 'compression-reference', 'compression-corrupt', 'compression-recovery',
    'compression-pending-replace', 'compression-pending-clear', 'compression-pending-photo', 'compression-pending-delete',
    'compression-happy', 'compression-new-essay', 'compression-ui-switch',
    'folder-token', 'folder-photo', 'folder-delete-student', 'folder-pending-replace', 'folder-pending-clear',
    'folder-happy', 'folder-failure', 'folder-direct-token', 'folder-direct-happy'];

async function exerciseOwnershipBoundary(name) {
    stopWftSyncPolling(); scheduleWftCloudSync = () => {}; window.alert = () => {}; wftConfirm = async () => true;
    driveAccessToken = 'synthetic-Alice'; WFT_IMAGE_COMPRESSION_V1 = true;
    localStorage.setItem('wft_settings', '{}'); localStorage.setItem('wft_portfolio', '{}');
    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown(); document.getElementById('studentSelect').value = 'Alice';
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20; canvas.getContext('2d').fillRect(0, 0, 20, 20);
    const image = { imageId: 'photo', name: 'Synthetic Alice.png', mimeType: 'image/png', dataUrl: canvas.toDataURL('image/png') };
    const session = { id: 'first', createdAt: '2026-10-10T00:00:00Z', originalText: 'Synthetic Alice writing.', images: [image] };
    const pendingCase = name.includes('pending'), direct = name.includes('direct');
    if (pendingCase) { pendingPortfolioSync = { studentName: 'Alice', signature: 'old-Alice', sessionData: session }; persistPendingPortfolioSync(); }
    else if (!direct) localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [session] } }));
    const requests = []; let resolveFolder, rejectFolder, releaseCompression, folderCalls = 0, finished = false, error = '', flushes = 0;
    flushWftCloudSyncNow = async () => { flushes++; return true; };
    window.fetch = async (url, options) => {
        if (!String(url).startsWith('https://www.googleapis.com/upload/drive/v3/files')) throw new Error('Unexpected service request');
        requests.push({ url: String(url), authorization: options.headers.Authorization, body: await options.body.text() });
        return new Response(JSON.stringify({ id: 'synthetic-upload', name: 'Synthetic Alice.png' }), { status: 200 });
    };
    ensureDriveFolderPromise = () => {
        folderCalls++;
        return name.startsWith('folder-') ? new Promise((resolve, reject) => { resolveFolder = resolve; rejectFolder = reject; }) : Promise.resolve('synthetic-folder');
    };
    compressPortfolioImageForDrive = (photo, callback) => {
        if (name.startsWith('compression-')) releaseCompression = () => callback(null, dataUrlToBlob(photo.dataUrl));
        else callback(null, dataUrlToBlob(photo.dataUrl));
    };
    const wait = async predicate => {
        for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
        throw new Error('Controlled ownership boundary was not reached');
    };
    if (direct) uploadBlobToDrive('Synthetic Alice.png', dataUrlToBlob(image.dataUrl), 'image/png', (result, failure) => { finished = true; error = failure ? failure.message : result ? '' : 'Upload rejected'; });
    else if (pendingCase) manualSaveToDrive();
    else syncPendingPortfolioMedia(failure => { finished = true; error = failure ? failure.message : ''; });
    await wait(() => releaseCompression || resolveFolder);
    function changeStoredWriting() {
        let current = getLocalPortfolioSnapshot();
        if (name.endsWith('-token')) driveAccessToken = 'synthetic-Bob';
        if (name === 'compression-photo' || name === 'folder-photo') current.Alice.sessions[0].images[0].dataUrl = image.dataUrl + 'changed';
        if (name === 'compression-delete-image') current.Alice.sessions[0].images = [];
        if (name === 'compression-delete-session') current.Alice.sessions = [];
        if (name === 'compression-delete-student' || name === 'folder-delete-student') delete current.Alice;
        if (name === 'compression-rename') { current.Alicia = current.Alice; delete current.Alice; }
        if (name === 'compression-reference') current.Alice.sessions[0].images[0].driveFileId = 'newer-reference';
        if (!pendingCase && !direct) savePortfolioLocalOnly(current);
        if (name.endsWith('pending-replace')) { pendingPortfolioSync = { studentName: 'Bob', signature: 'new-Bob', sessionData: { ...session, id: 'new-Bob', images: [{ ...image }] } }; persistPendingPortfolioSync(); }
        if (name.endsWith('pending-clear')) clearPendingPortfolioSync();
        if (name === 'compression-pending-photo') pendingPortfolioSync.sessionData.images[0].dataUrl += 'changed';
    }
    changeStoredWriting();
    if (name === 'compression-pending-delete') await removeStudent('Alice');
    if (name === 'compression-corrupt') localStorage.setItem('wft_portfolio', '{broken');
    if (name === 'compression-recovery') wftStudentChangeRecovery = { wft_portfolio: localStorage.getItem('wft_portfolio') };
    if (name === 'compression-new-essay') saveStudentSession('Alice', { id: 'new-essay', originalText: 'New writing.', images: [] });
    if (name === 'compression-ui-switch') { const select = document.getElementById('studentSelect'); select.value = 'Bob'; select.dispatchEvent(new Event('change')); }
    function releaseHeldUpload() {
        if (releaseCompression) releaseCompression();
        else if (name === 'folder-failure') rejectFolder(new Error('Synthetic folder resolution failure'));
        else resolveFolder('synthetic-folder');
    }
    releaseHeldUpload();
    if (name === 'folder-failure') await new Promise(resolve => setTimeout(resolve, 50));
    else await wait(() => pendingCase ? !manualSyncInProgress : finished);
    return { requests, folderCalls, finished: pendingCase ? !manualSyncInProgress : finished, error,
        portfolio: getPortfolioData(), pendingStudent: getPendingPortfolioSync()?.studentName || null,
        pendingBytes: !!getPendingPortfolioSync()?.sessionData.images[0]?.dataUrl,
        flushes, status: document.getElementById('driveSyncTextHeader').textContent,
        raw: localStorage.getItem('wft_portfolio') };
}

function assertOwnershipOutcome(name, observed, errors) {
    assert.deepEqual(errors, []);
    const happy = name.endsWith('-happy') || name === 'compression-new-essay' || name === 'compression-ui-switch';
    assert.equal(observed.finished, true, 'Failure must settle instead of hanging');
    assert.equal(observed.requests.length, happy ? 1 : 0, 'Stale writing must be rejected before its outgoing request');
    if (happy) {
        assert.equal(observed.requests[0].authorization, 'Bearer synthetic-Alice');
        assert.match(observed.requests[0].body, /Synthetic Alice/);
        if (name === 'compression-new-essay') assert.deepEqual(observed.portfolio.Alice.sessions.map(session => session.id).sort(), ['first', 'new-essay']);
        if (!name.includes('direct')) assert.equal(observed.portfolio.Alice.sessions.find(session => session.id === 'first').images[0].driveFileId, 'synthetic-upload');
    } else if (name.includes('pending')) {
        assert.equal(observed.flushes, 0);
        if (name.endsWith('replace')) assert.equal(observed.pendingStudent, 'Bob');
        else if (!name.endsWith('clear')) { assert.equal(observed.pendingStudent, 'Alice'); assert.equal(observed.pendingBytes, true); }
    } else assert.ok(observed.error, 'Storage/owner/IO failures must propagate');
    if (name === 'compression-corrupt') assert.equal(observed.raw, '{broken');
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    try {
        for (const name of scenarios) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
                const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            let observed;
            try {
                observed = await page.evaluate(exerciseOwnershipBoundary, name);
                assertOwnershipOutcome(name, observed, errors);
                cases.push({ name, passed: true, observed });
            } catch (error) { cases.push({ name, passed: false, error: error.message, observed }); }
            console.log((cases[cases.length - 1].passed ? 'PASS ' : 'FAIL ') + name);
            await page.close();
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases }, null, 2) + '\n');
    console.log(JSON.stringify(cases, null, 2));
    assert.equal(cases.filter(test => !test.passed).length, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
