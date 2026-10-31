const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..'), cases = [];
function check(name, actual, expected) {
    try { assert.deepEqual(actual, expected); cases.push({ name, pass: true }); }
    catch (e) { cases.push({ name, pass: false, error: e.message, actual, expected }); }
}
const runArchiveConnectionScenario = async stage => {
    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = scheduleWftDriveSync = () => {};
    function seedArchiveConnectionClass() {
        localStorage.clear(); wftStudentChangeRecovery = null;
        const essay = { id: 'first', originalText: 'Synthetic archive from initial connection', images: stage === 'photos' ? [{ name: 'synthetic.png', driveFileId: 'synthetic-photo' }] : [] };
        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [essay] } }));
        localStorage.setItem('wft_students', '["Alice"]'); localStorage.setItem('wft_settings', '{"students":["Alice"]}'); localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
        students = ['Alice']; selectedStudent = 'Alice'; renderStudentList(); populateStudentDropdown();
    }
    seedArchiveConnectionClass();
    wftSyncState.accessToken = driveAccessToken = 'synthetic-connection-A'; wftSyncState.isSyncing = false; wftSyncState.folderId = driveFolderId = null;
    isWftTokenValid = () => true; wftTextInput = async () => 'Synthetic year'; wftConfirm = async () => stage !== 'cancel';
    document.getElementById('archiveIncludeImages').checked = true;
    const alerts = [], requests = []; let downloads = 0, switched = false;
    window.alert = text => alerts.push(text);
    const switchConnection = () => { switched = true; wftSyncState.accessToken = driveAccessToken = stage === 'signout' ? null : stage === 'refresh' ? 'synthetic-refreshed-A' : 'synthetic-connection-B'; };
    downloadBlob = () => { downloads++; if (stage === 'download') switchConnection(); };
    const originalGenerate = JSZip.prototype.generateAsync;
    if (stage === 'compression') JSZip.prototype.generateAsync = async function(options) { const blob = await originalGenerate.call(this, options); switchConnection(); return blob; };
    if (stage === 'cached-validation') driveFolderId = wftSyncState.folderId = 'cached-root';
    const realRoot = ensureDriveFolderPromise;
    if (!['root-search', 'cached-validation', 'canonical-summary'].includes(stage)) ensureDriveFolderPromise = async () => {
        if (['folder', 'refresh', 'signout'].includes(stage)) { await Promise.resolve(); switchConnection(); }
        return 'synthetic-root';
    };
    if (stage === 'direct-folder') ensureArchiveYearFolderPromise = async () => { await Promise.resolve(); switchConnection(); return 'synthetic-year-folder'; };
    function respondToArchiveConnectionRequest(parsed, query, metadata) {
        let data;
        if (parsed.pathname.includes('/upload/')) {
            data = { id: 'synthetic-upload' }; if (stage === 'upload-response') switchConnection();
        } else if (parsed.searchParams.get('alt') === 'media') {
            if (stage === 'photos') switchConnection();
            return new Response(new Blob(['synthetic photo'], { type: 'image/png' }), { status: 200 });
        } else if (parsed.pathname.endsWith('/cached-root')) {
            switchConnection(); data = { id: 'cached-root', name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', trashed: true };
        } else if (query.includes("name='" + DRIVE_FOLDER_NAME + "'")) {
            if (stage === 'root-search') switchConnection();
            data = { files: stage === 'canonical-summary' ? [{ id: 'root-1' }, { id: 'root-2' }] : [{ id: 'synthetic-root' }] };
        } else if (query.includes("name='Archives'")) {
            if (stage === 'subfolder-search') switchConnection();
            data = { files: stage === 'subfolder-create' ? [] : [{ id: 'synthetic-archives' }] };
        } else if (metadata?.name === 'Archives') {
            if (stage === 'subfolder-create') switchConnection(); data = { id: 'synthetic-archives' };
        } else if (query.includes("name='Synthetic year'")) data = { files: [{ id: 'synthetic-year-folder' }] };
        else { if (stage === 'canonical-summary') switchConnection(); data = { files: [] }; }
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    globalThis.fetch = async (url, options = {}) => {
        const request = { url: String(url), method: options.method || 'GET', authorization: options.headers?.Authorization, body: options.body instanceof Blob ? Array.from(new Uint8Array(await options.body.arrayBuffer())) : options.body || null };
        requests.push(request);
        const parsed = new URL(url), query = parsed.searchParams.get('q') || '', metadata = typeof options.body === 'string' ? JSON.parse(options.body) : null;
        return respondToArchiveConnectionRequest(parsed, query, metadata);
    };
    const before = localStorage.getItem('wft_portfolio'); let error;
    if (stage === 'direct-folder') {
        try { await saveArchiveZipToDrive('synthetic.zip', new Blob(['Synthetic archive from initial connection']), 'Synthetic year'); } catch (e) { error = e.message; }
    } else { await archiveCurrentSchoolYear(); for (let i = 0; i < 300 && stage !== 'cancel' && !alerts.length; i++) await new Promise(r => setTimeout(r, 5)); }
    const uploads = requests.filter(r => r.url.includes('/upload/'));
    let archivedEssay = null;
    if (uploads.length && stage !== 'direct-folder') {
        const bytes = new Uint8Array(uploads[0].body), start = bytes.findIndex((x, i) => x === 80 && bytes[i + 1] === 75 && bytes[i + 2] === 3 && bytes[i + 3] === 4);
        const zip = await JSZip.loadAsync(bytes.slice(start));
        const portfolio = Object.keys(zip.files).find(n => n.endsWith('Complete Portfolio.json'));
        archivedEssay = JSON.parse(await zip.file(portfolio).async('string')).Alice.sessions[0].originalText;
    }
    return { requests, uploads: uploads.length, retained: localStorage.getItem('wft_portfolio') === before, downloads, alerts, error, switched, archivedEssay };
};

function checkArchiveConnectionOutcome(stage, result, errors) {
    const uploaded = ['upload-response', 'download', 'unchanged'].includes(stage);
    check(`${stage}/no stale upload`, result.uploads, uploaded ? 1 : 0);
    check(`${stage}/Authorization stays on intended connection`, result.requests.every(x => x.authorization === 'Bearer synthetic-connection-A'), true);
    check(`${stage}/class retained`, result.retained, stage !== 'unchanged');
    if (uploaded) check(`${stage}/actual multipart ZIP bytes`, result.archivedEssay, 'Synthetic archive from initial connection');
    if (stage === 'upload-response' || stage === 'download') check(`${stage}/truthful saved status`, result.alerts.some(x => /saved to Drive/.test(x) && /class.*retain/i.test(x) && !/could not be completed/.test(x)), true);
    if (!['unchanged', 'cancel', 'direct-folder', 'upload-response', 'download'].includes(stage)) check(`${stage}/retry reported`, result.alerts.some(x => /connection changed/i.test(x)), true);
    if (stage === 'direct-folder') check('direct-folder/retry reported', /connection changed/i.test(result.error || ''), true);
    check(`${stage}/no unhandled browser errors`, errors, []);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext();
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.href === 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js') return route.fulfill({ body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')), contentType: 'application/javascript' });
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        for (const stage of ['direct-folder', 'folder', 'root-search', 'cached-validation', 'canonical-summary', 'subfolder-search', 'subfolder-create', 'photos', 'compression', 'upload-response', 'download', 'refresh', 'signout', 'unchanged', 'cancel']) {
            const page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => loadWftFeatureLibrary('zip'));
            const result = await page.evaluate(runArchiveConnectionScenario, stage);
            checkArchiveConnectionOutcome(stage, result, errors);
            await page.close();
        }
        const report = { root, scope: 'Native Edge complete live archive handler and actual save/upload/wftDriveFetch/folder/photo helpers. Real ZIP and actual multipart headers/body captured at intercepted final fetch. Synthetic tokens/accounts and folder/photo responses; no live Drive, real account switch UI, auth or exposure claim.', cases, passed: cases.filter(x => x.pass).length, failed: cases.filter(x => !x.pass).length };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(`Archive connection browser cases: ${report.passed}/${cases.length} passed, ${report.failed} failed.`);
        assert.equal(report.failed, 0, cases.filter(x => !x.pass).map(x => x.name + ': ' + x.error).join('\n'));
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
