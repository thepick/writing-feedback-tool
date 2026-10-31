const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const JSZip = require('jszip');
const root = path.resolve(__dirname, '..');
const archiveClock = '2026-10-14T00:00:00.000Z';
const scenarios = [...['single', 'year'].flatMap(kind => ['library', 'generation', 'download'].map(mode => ({ kind, mode }))), ...['empty-ack', 'refused-ack'].map(mode => ({ kind: 'year', mode })),
    { kind: 'year', mode: 'folder-create-empty-ack' }, { kind: 'year', mode: 'tiny-resolved' }, { kind: 'single', mode: 'tiny-resolved' }, { kind: 'year', mode: 'signed-out' }];

function archiveRoute(route) {
    const u = new URL(route.request().url());
    if (u.href === 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')) });
    if (u.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
}

async function runArchiveScenario({ kind, mode }) {
    const refusal = ['folder-create-empty-ack', 'tiny-resolved', 'signed-out'].includes(mode);
    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
    localStorage.clear(); sessionStorage.clear();
    students = ['Synthetic']; selectedStudent = 'Synthetic'; selectedImages = []; pendingPortfolioSync = null; latestAnalysisData = null;
    localStorage.setItem('wft_students', '["Synthetic"]'); localStorage.setItem('wft_settings', '{"students":["Synthetic"]}');
    localStorage.setItem('wft_selectedStudent', 'Synthetic'); localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', originalText: 'Protected synthetic essay. '.repeat(40), overall: 75, images: [] }] } }));
    wftWritingDraft = null;
    document.getElementById('studentSelect').value = '';
    populateStudentDropdown(); wftLoadWritingDraft('Synthetic', false);
    document.getElementById('studentWriting').value = 'Protected current writing.';
    if (refusal) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 3;
        canvas.getContext('2d').fillStyle = 'blue'; canvas.getContext('2d').fillRect(0, 0, 3, 3);
        selectedImages = [{ imageId: 'protected-current-photo', imageRevision: 'protected-revision', name: 'current.png', mimeType: 'image/png', dataUrl: canvas.toDataURL('image/png'), pendingDriveUpload: true }];
        syncSelectedImageState();
        pendingPortfolioSync = { studentName: 'Synthetic', signature: 'protected-pending', sessionData: { id: 'pending', originalText: 'Protected pending writing.', images: selectedImages.slice() } };
        persistPendingPortfolioSync();
        latestAnalysisData = { marker: 'protected-analysis' }; activeAnalysisContext = { input: { text: 'Protected analysis input.' } };
        activePortfolioReassessmentSource = { sourceStudentName: 'Synthetic', sourceSessionId: 'saved' };
    }
    populateStudentDropdown(); refreshPortfolioDropdown(); document.getElementById('portfolioStudentSelect').value = 'Synthetic';
    if (!wftSaveWritingDraft(true)) throw Error('Synthetic draft setup could not save');
    if (navigator.locks) await navigator.locks.request(wftWritingDraftKey('Synthetic'), function() {});
    document.getElementById('archiveIncludeImages').checked = false;
    driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 600000;
    driveFolderId = wftSyncState.folderId = 'synthetic-root'; clearWftSyncBlockState();
    wftTextInput = async () => 'Synthetic year'; wftConfirm = async () => true;
    const alerts = [], checks = [], uploads = [], check = (name, passed) => checks.push({ name, passed: !!passed });
    window.alert = text => alerts.push(String(text));
    const keys = ['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY];
    const bytes = () => keys.map(key => localStorage.getItem(key)), before = JSON.stringify(bytes());
    const Zip = JSZip, generate = JSZip.prototype.generateAsync, objectUrl = URL.createObjectURL, featureLoader = loadWftFeatureLibrary;
    const uploadBodies = [];
    const requests = [], runtime = () => JSON.parse(JSON.stringify({ students, selectedStudent, selectedImages, selectedImageDataUrl, pendingPortfolioSync, latestAnalysisData, activeAnalysisContext, activePortfolioReassessmentSource,
        writing: document.getElementById('studentWriting').value, selection: document.getElementById('studentSelect').value,
        portfolioSelection: document.getElementById('portfolioStudentSelect').value, signature: lastSyncedPortfolioSessionSignature,
        counters: [wftSyncState.localSettingsCounter, wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter], pending: [wftSyncState.pendingSettingsPush, wftSyncState.pendingPortfolioPush, wftSyncState.pendingDeletionsPush] }));
    const refs = { students, images: selectedImages, photo: selectedImages[0], pending: pendingPortfolioSync, session: pendingPortfolioSync?.sessionData, pendingImages: pendingPortfolioSync?.sessionData.images, analysis: latestAnalysisData, context: activeAnalysisContext, reassessment: activePortfolioReassessmentSource };
    const runtimeBefore = refusal ? runtime() : null;
    const realDownload = downloadBlob, realClear = clearCurrentClassAfterSuccessfulArchive;
    let downloadCalls = 0, clearCalls = 0, tinyResolutions = 0, failure;
    if (refusal) {
        downloadBlob = function() { downloadCalls++; return realDownload.apply(this, arguments); };
        clearCurrentClassAfterSuccessfulArchive = function() { clearCalls++; return realClear.apply(this, arguments); };
    }
    let failing = true;
    if (mode === 'library') {
        delete window.JSZip;
        window.loadWftFeatureLibrary = name => name === 'zip' ? Promise.reject(Error('Synthetic JSZip loading refusal')) : featureLoader(name);
    }
    if (mode === 'generation') JSZip.prototype.generateAsync = () => Promise.reject(Error('Synthetic compression refusal'));
    if (mode === 'tiny-resolved') JSZip.prototype.generateAsync = () => { tinyResolutions++; return Promise.resolve(new Blob(['Synthetic tiny resolved result'], { type: 'application/zip' })); };
    if (mode === 'download') URL.createObjectURL = () => { throw Error('Synthetic download refusal'); };
    if (mode === 'signed-out') { driveAccessToken = wftSyncState.accessToken = null; wftSyncState.signedIn = false; wftSyncState.tokenExpiresAt = 0; }
    async function archiveFetch(url, options = {}) {
        const u = new URL(url), query = u.searchParams.get('q') || '';
        if (u.origin !== 'https://www.googleapis.com') throw Error('Unexpected external request');
        requests.push({ phase: failing ? 'failure' : 'retry', url: String(url), method: options.method || 'GET', query, folder: options.method === 'POST' && !u.pathname.includes('/upload/') ? JSON.parse(options.body) : null });
        if (u.pathname.includes('/upload/')) {
            uploads.push({ url: String(url), size: options.body.size });
            uploadBodies.push({ blob: options.body, method: options.method, headers: Object.entries(options.headers), type: options.body.type });
            if (failing && mode === 'empty-ack') return new Response('{}');
            if (failing && mode === 'refused-ack') return new Response('{"error":{"message":"Synthetic upload refusal"}}', { status: 403 });
            return new Response('{"id":"synthetic-archive"}');
        }
        if (query) return new Response(JSON.stringify({ files: mode === 'folder-create-empty-ack' && query.includes("name='Archives'") ? [] : [{ id: query.includes('Archives') ? 'synthetic-archives' : 'synthetic-year' }] }));
        if (options.method === 'POST' && mode === 'folder-create-empty-ack') return new Response(failing ? '{}' : '{"id":"synthetic-archives"}');
        return new Response(JSON.stringify({ id: 'synthetic-root', name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', trashed: false }));
    }
    fetch = archiveFetch;
    const invoke = () => kind === 'single' ? exportSelectedStudentPortfolio() : archiveCurrentSchoolYear();
    await invoke();
    const failedStatus = document.getElementById('archiveStatus').textContent;
    if (refusal) {
        failure = { bytesBefore: JSON.parse(before), bytesAfter: bytes(), runtimeBefore, runtimeAfter: runtime(), requests: requests.slice(), uploads: uploads.length, downloadCalls, clearCalls, tinyResolutions,
            sameReferences: { students: students === refs.students, images: selectedImages === refs.images, photo: selectedImages[0] === refs.photo, pending: pendingPortfolioSync === refs.pending,
                session: pendingPortfolioSync?.sessionData === refs.session, pendingImages: pendingPortfolioSync?.sessionData.images === refs.pendingImages,
                analysis: latestAnalysisData === refs.analysis, context: activeAnalysisContext === refs.context, reassessment: activePortfolioReassessmentSource === refs.reassessment } };
        await __markArchiveRetry();
    }
    function checkFailedRetention() {
        check('failed archive preserves exact protected keys', JSON.stringify(bytes()) === before);
        check('failed archive preserves runtime writing and selection', selectedStudent === 'Synthetic' && students.length === 1 && document.getElementById('studentWriting').value === 'Protected current writing.');
        check('failed archive never claims clear or export completion', !/current class was cleared|Student export complete/i.test(failedStatus));
    }
    function checkFailureBoundary() {
        check('failure status is truthful', kind === 'single' ? /Student export failed/.test(failedStatus) : mode === 'download' ? /saved to Drive.*retained/i.test(failedStatus) : /Archive failed.*not cleared/i.test(failedStatus));
        check('failure reports boundary cause', alerts.some(text => new RegExp(mode === 'library' ? 'JSZip' : mode === 'generation' ? 'compression refusal' : mode === 'download' ? 'download refusal' : mode === 'empty-ack' ? 'file ID' : mode === 'folder-create-empty-ack' ? 'Could not create Drive folder: Archives' : mode === 'tiny-resolved' ? 'empty or invalid' : mode === 'signed-out' ? 'sign in with Google' : 'refusal', 'i').test(text)));
        check('uploads only reach required boundary', uploads.length === (kind === 'year' && ['download', 'empty-ack', 'refused-ack'].includes(mode) ? 1 : 0));
    }
    checkFailedRetention();
    checkFailureBoundary();
    window.JSZip = Zip; window.loadWftFeatureLibrary = featureLoader; Zip.prototype.generateAsync = generate; URL.createObjectURL = objectUrl; failing = false;
    if (mode === 'signed-out') { driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 600000; }
    await invoke();
    check('retry completes existing public flow', kind === 'single' ? /Student export complete/.test(document.getElementById('archiveStatus').textContent) && JSON.stringify(bytes()) === before : /Archive complete/.test(document.getElementById('archiveStatus').textContent) && Object.keys(getPortfolioData()).length === 0 && students.length === 0);
    // Read immutable captured Blobs after all seven failure/retry checks finish.
    for (let i = 0; i < uploadBodies.length; i++) {
        const { blob, ...request } = uploadBodies[i];
        uploads[i].request = request;
        uploads[i].bodyBase64 = btoa(Array.from(new Uint8Array(await blob.arrayBuffer()), byte => String.fromCharCode(byte)).join(''));
    }
    if (refusal) { downloadBlob = realDownload; clearCurrentClassAfterSuccessfulArchive = realClear; }
    return { checks, failedStatus, alerts, uploads, ...(refusal ? { failure, retry: { downloadCalls: downloadCalls - failure.downloadCalls, clearCalls: clearCalls - failure.clearCalls, uploads: uploads.length - failure.uploads, requests: requests.slice(failure.requests.length) } } : {}) };
}

async function runScenario(browser, scenario, cases) {
    const page = await browser.newPage({ timezoneId: 'Asia/Bangkok' }), errors = [], downloads = [];
    const refusal = ['folder-create-empty-ack', 'tiny-resolved', 'signed-out'].includes(scenario.mode);
    let failedDownloads, retryDownload;
    page.on('pageerror', e => errors.push(e.message)); page.on('download', d => downloads.push(d.suggestedFilename()));
    if (refusal) { page.on('download', d => { retryDownload = d; }); await page.exposeFunction('__markArchiveRetry', () => { failedDownloads = downloads.length; }); }
    await page.route('**/*', archiveRoute);
    try {
        await page.addInitScript(iso => {
            const NativeDate = Date, instant = NativeDate.parse(iso);
            window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } };
            if (new Date().toISOString() !== iso || Date.now() !== instant) throw Error('Archive clock fixture failed');
            if (new Date(0).getTime() !== 0 || Date.parse !== NativeDate.parse || Date.UTC !== NativeDate.UTC) throw Error('Archive clock fixture failed');
        }, archiveClock);
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        await page.evaluate(() => loadWftFeatureLibrary('zip'));
        const downloaded = page.waitForEvent('download').then(d => d.suggestedFilename(), e => { throw Error('Retry download missing: ' + e.message); });
        downloaded.catch(() => {});
        const observed = await page.evaluate(runArchiveScenario, scenario);
        await downloaded;
        assert.equal(downloads.length, 1, 'Only successful retry downloads a ZIP'); assert.deepEqual(errors, []);
        assert.equal(observed.checks.length, 7, 'All seven ordered archive checks retained');
        if (refusal) {
            const f = observed.failure;
            assert.deepEqual(f.bytesAfter, f.bytesBefore, 'Every protected storage byte is retained before retry');
            assert.deepEqual(f.runtimeAfter, f.runtimeBefore, 'Current writing, media, pending and analysis remain exact before retry');
            assert.ok(Object.values(f.sameReferences).every(Boolean), 'Current work retains its original object identities');
            assert.equal(f.uploads, 0); assert.equal(f.downloadCalls, 0); assert.equal(f.clearCalls, 0); assert.equal(failedDownloads, 0);
            assert.equal(observed.retry.downloadCalls, 1); assert.equal(observed.retry.clearCalls, scenario.kind === 'year' ? 1 : 0); assert.equal(observed.retry.uploads, scenario.kind === 'year' ? 1 : 0);
            if (scenario.mode === 'folder-create-empty-ack') {
                assert.ok(f.requests.some(r => r.method === 'GET' && r.query.includes("name='Archives'")));
                assert.deepEqual(f.requests.filter(r => r.method === 'POST').map(r => r.folder), [{ name: 'Archives', mimeType: 'application/vnd.google-apps.folder', parents: ['synthetic-root'] }]);
                assert.ok(f.requests.every(r => r.method === 'GET' || (r.method === 'POST' && r.folder?.name === 'Archives')));
                assert.ok(observed.alerts[0].endsWith('Could not create Drive folder: Archives'));
            } else {
                assert.deepEqual(f.requests, [], 'Refusal precedes any archive-related outgoing request');
                if (scenario.mode === 'tiny-resolved') { assert.equal(f.tinyResolutions, 1); assert.ok(observed.alerts[0].endsWith(scenario.kind === 'year' ? 'Archive file appears to be empty or invalid.' : 'Student export appears to be empty or invalid.')); }
                else assert.ok(observed.alerts[0].endsWith('Please sign in with Google before saving an archive to Drive.'));
            }
            const zip = await JSZip.loadAsync(fs.readFileSync(await retryDownload.path()));
            const name = Object.keys(zip.files).find(name => scenario.kind === 'year' ? name.endsWith('Complete Portfolio.json') : name.endsWith('Synthetic - Portfolio.html'));
            assert.ok(name, 'Actual retry download is a readable real ZIP with the protected portfolio');
            const content = await zip.file(name).async('string');
            if (scenario.kind === 'year') assert.equal(JSON.parse(content).Synthetic.sessions[0].originalText, 'Protected synthetic essay. '.repeat(40));
            else assert.ok(content.includes('Protected synthetic essay.'));
            observed.retry.downloadZip = { bytes: fs.statSync(await retryDownload.path()).size, protectedEntry: name };
        }
        for (const upload of observed.uploads) {
            const bytes = Buffer.from(upload.bodyBase64, 'base64');
            assert.equal(bytes.length, upload.size, 'Complete multipart Blob captured');
            assert.equal(bytes.toString('base64'), upload.bodyBase64, 'Canonical lossless base64');
            if (refusal) {
                const zip = await JSZip.loadAsync(bytes.subarray(bytes.indexOf(Buffer.from('PK\x03\x04', 'binary'))));
                const name = Object.keys(zip.files).find(name => name.endsWith('Complete Portfolio.json'));
                assert.equal(JSON.parse(await zip.file(name).async('string')).Synthetic.sessions[0].originalText, 'Protected synthetic essay. '.repeat(40), 'Healthy multipart contains a genuine ZIP of protected writing');
            }
        }
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
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, failures, archiveClock, boundary: 'Native export/archive/ZIP/download; synthetic Drive fetch, ZIP compression and object URL failures, confirmation responses.' }, null, 2));
    assert.equal(cases.length, 12); assert.deepEqual(failures, [], 'Archive failure outcomes'); console.log('Archive failure outcomes: 12 passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
