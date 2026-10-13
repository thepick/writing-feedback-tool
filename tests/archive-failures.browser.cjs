const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const scenarios = [...['single', 'year'].flatMap(kind => ['library', 'generation', 'download'].map(mode => ({ kind, mode }))), ...['empty-ack', 'refused-ack'].map(mode => ({ kind: 'year', mode }))];

function archiveRoute(route) {
    const u = new URL(route.request().url());
    if (u.href === 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')) });
    if (u.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
}

async function runArchiveScenario({ kind, mode }) {
    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
    localStorage.clear(); sessionStorage.clear();
    students = ['Synthetic']; selectedStudent = 'Synthetic'; selectedImages = []; pendingPortfolioSync = null; latestAnalysisData = null;
    localStorage.setItem('wft_students', '["Synthetic"]'); localStorage.setItem('wft_settings', '{"students":["Synthetic"]}');
    localStorage.setItem('wft_selectedStudent', 'Synthetic'); localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', originalText: 'Protected synthetic essay. '.repeat(40), overall: 75, images: [] }] } }));
    document.getElementById('studentWriting').value = 'Protected current writing.';
    populateStudentDropdown(); refreshPortfolioDropdown(); document.getElementById('portfolioStudentSelect').value = 'Synthetic';
    document.getElementById('archiveIncludeImages').checked = false;
    driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 600000;
    driveFolderId = wftSyncState.folderId = 'synthetic-root'; clearWftSyncBlockState();
    wftTextInput = async () => 'Synthetic year'; wftConfirm = async () => true;
    const alerts = [], checks = [], uploads = [], check = (name, passed) => checks.push({ name, passed: !!passed });
    window.alert = text => alerts.push(String(text));
    const keys = ['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY];
    const bytes = () => keys.map(key => localStorage.getItem(key)), before = JSON.stringify(bytes());
    const Zip = JSZip, generate = JSZip.prototype.generateAsync, objectUrl = URL.createObjectURL;
    let failing = true;
    if (mode === 'library') delete window.JSZip;
    if (mode === 'generation') JSZip.prototype.generateAsync = () => Promise.reject(Error('Synthetic compression refusal'));
    if (mode === 'download') URL.createObjectURL = () => { throw Error('Synthetic download refusal'); };
    async function archiveFetch(url, options = {}) {
        const u = new URL(url), query = u.searchParams.get('q') || '';
        if (u.origin !== 'https://www.googleapis.com') throw Error('Unexpected external request');
        if (u.pathname.includes('/upload/')) {
            uploads.push({ url: String(url), size: options.body.size });
            if (failing && mode === 'empty-ack') return new Response('{}');
            if (failing && mode === 'refused-ack') return new Response('{"error":{"message":"Synthetic upload refusal"}}', { status: 403 });
            return new Response('{"id":"synthetic-archive"}');
        }
        if (query) return new Response(JSON.stringify({ files: [{ id: query.includes('Archives') ? 'synthetic-archives' : 'synthetic-year' }] }));
        return new Response(JSON.stringify({ id: 'synthetic-root', name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', trashed: false }));
    }
    fetch = archiveFetch;
    const invoke = () => kind === 'single' ? exportSelectedStudentPortfolio() : archiveCurrentSchoolYear();
    await invoke();
    const failedStatus = document.getElementById('archiveStatus').textContent;
    function checkFailedRetention() {
        check('failed archive preserves exact protected keys', JSON.stringify(bytes()) === before);
        check('failed archive preserves runtime writing and selection', selectedStudent === 'Synthetic' && students.length === 1 && document.getElementById('studentWriting').value === 'Protected current writing.');
        check('failed archive never claims clear or export completion', !/current class was cleared|Student export complete/i.test(failedStatus));
    }
    function checkFailureBoundary() {
        check('failure status is truthful', kind === 'single' ? /Student export failed/.test(failedStatus) : mode === 'download' ? /saved to Drive.*retained/i.test(failedStatus) : /Archive failed.*not cleared/i.test(failedStatus));
        check('failure reports boundary cause', alerts.some(text => new RegExp(mode === 'library' ? 'JSZip' : mode === 'generation' ? 'compression refusal' : mode === 'download' ? 'download refusal' : mode === 'empty-ack' ? 'file ID' : 'refusal', 'i').test(text)));
        check('uploads only reach required boundary', uploads.length === (kind === 'year' && ['download', 'empty-ack', 'refused-ack'].includes(mode) ? 1 : 0));
    }
    checkFailedRetention();
    checkFailureBoundary();
    window.JSZip = Zip; Zip.prototype.generateAsync = generate; URL.createObjectURL = objectUrl; failing = false;
    await invoke();
    check('retry completes existing public flow', kind === 'single' ? /Student export complete/.test(document.getElementById('archiveStatus').textContent) && JSON.stringify(bytes()) === before : /Archive complete/.test(document.getElementById('archiveStatus').textContent) && Object.keys(getPortfolioData()).length === 0 && students.length === 0);
    return { checks, failedStatus, alerts, uploads };
}

async function runScenario(browser, scenario, cases) {
    const page = await browser.newPage(), errors = [], downloads = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('download', d => downloads.push(d.suggestedFilename()));
    await page.route('**/*', archiveRoute);
    try {
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const downloaded = page.waitForEvent('download').then(d => d.suggestedFilename(), e => { throw Error('Retry download missing: ' + e.message); });
        downloaded.catch(() => {});
        const observed = await page.evaluate(runArchiveScenario, scenario);
        await downloaded;
        assert.equal(downloads.length, 1, 'Only successful retry downloads a ZIP'); assert.deepEqual(errors, []);
        cases.push({ ...scenario, ...observed, downloads, passed: observed.checks.every(c => c.passed) });
    } catch (e) { cases.push({ ...scenario, passed: false, error: e.message }); }
    finally { await page.close(); }
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of scenarios) await runScenario(browser, scenario, cases);
    } finally { await browser.close(); }
    const failures = cases.filter(c => !c.passed);
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, failures, boundary: 'Native export/archive/ZIP/download; synthetic Drive fetch, ZIP compression and object URL failures, confirmation responses.' }, null, 2));
    assert.equal(cases.length, 8); assert.deepEqual(failures, [], 'Archive failure outcomes'); console.log('Archive failure outcomes: 8 passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
