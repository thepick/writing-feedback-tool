const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const cases = [];
const check = (name, value, expected) => {
    try { assert.deepEqual(value, expected); cases.push({ name, pass: true }); }
    catch (error) { cases.push({ name, pass: false, error: error.message, value, expected }); }
};

function installArchiveFixtures() {
    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = scheduleWftDriveSync = () => {};
    globalThis.realPhotoDownload = downloadDriveFileAsBlobPromise;
    globalThis.realPhotoDecode = dataUrlToBlobPromise;
    globalThis.realArchiveConfirm = wftConfirm; globalThis.realArchiveInput = wftTextInput;
    globalThis.seedArchive = (images = [], name = 'Alice') => {
        localStorage.clear(); sessionStorage.clear(); wftStudentChangeRecovery = null; wftWritingDraft = null;
        localStorage.setItem('wft_portfolio', JSON.stringify({ [name]: { sessions: [{ id: 'first', date: '12.10.2026', originalText: 'Synthetic original essay', images }] } }));
        localStorage.setItem('wft_students', JSON.stringify([name])); localStorage.setItem('wft_settings', JSON.stringify({ students: [name], unknown: 'keep' }));
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}'); localStorage.setItem('wft_selectedStudent', name);
        students = [name]; selectedStudent = name; pendingPortfolioSync = null; activePortfolioReassessmentSource = null;
        latestAnalysisData = null; activeAnalysisContext = null; selectedImages = []; selectedImageDataUrl = '';
        document.getElementById('studentWriting').value = '';
        document.getElementById('targetWordCount').value = '200';
        document.getElementById('studentSelect').value = '';
        renderStudentList(); populateStudentDropdown(); wftLoadWritingDraft(name, false); refreshPortfolioDropdown();
        document.getElementById('portfolioStudentSelect').value = name;
        document.getElementById('archiveIncludeImages').checked = true;
        globalThis.archiveCalls = { alerts: [], uploads: 0, downloads: 0, photoDownloads: 0 };
        globalThis.archiveBlobs = [];
        window.alert = text => archiveCalls.alerts.push(text);
        wftTextInput = async () => 'Synthetic year'; wftConfirm = async () => true;
        downloadBlob = blob => { archiveCalls.downloads++; archiveBlobs.push(blob); };
        saveArchiveZipToDrive = async () => { archiveCalls.uploads++; };
        downloadDriveFileAsBlobPromise = async () => { archiveCalls.photoDownloads++; return new Blob(['synthetic Drive photo bytes'], { type: 'image/png' }); };
        dataUrlToBlobPromise = realPhotoDecode;
    };
    globalThis.archiveBytes = () => Object.fromEntries(['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY].map(key => [key, localStorage.getItem(key)]));
    globalThis.settleArchive = async () => {
        for (let i = 0; i < 300 && !archiveCalls.alerts.length && !/Student export complete|Student export failed/.test(document.getElementById('archiveStatus').textContent); i++) await new Promise(r => setTimeout(r, 5));
    };
    globalThis.readArchive = async blob => {
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const files = {};
        for (const [name, file] of Object.entries(zip.files)) if (!file.dir) files[name] = Array.from(await file.async('uint8array'));
        return files;
    };
}

async function checkPhotoZipContents(page) {
    const photos = await page.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 3;
        canvas.getContext('2d').fillStyle = 'red'; canvas.getContext('2d').fillRect(0, 0, 3, 3); const red = canvas.toDataURL('image/png');
        canvas.getContext('2d').fillStyle = 'blue'; canvas.getContext('2d').fillRect(0, 0, 3, 3); const blue = canvas.toDataURL('image/png');
        globalThis.archiveRed = red;
        const name = '__proto__'; seedArchive([], name);
        const image = (name, dataUrl) => ({ name, mimeType: 'image/png', dataUrl });
        const sessions = [
            { id: 'first', date: '12.10.2026', originalText: '<img src=x onerror=alert(1)>', images: [image('same.PNG', red), image('a/b.png', blue), image('no.extension.known', red)] },
            { id: 'second', date: '12.10.2026', images: [image('same.PNG', blue), image('a:b.png', red), { name: 'original', mimeType: 'image/png', originalDataUrl: blue }, { name: 'drive.png', driveFileId: 'synthetic-drive' }, { name: 'missing.png' }] },
            { id: 'legacy', date: '12.10.2026', photos: [image('legacy.gif', red), image('SAME.jpg', red)] }
        ];
        localStorage.setItem('wft_portfolio', JSON.stringify({ [name]: { sessions } }));
        const runs = [];
        for (let i = 0; i < 2; i++) {
            const result = await createSchoolYearArchiveZip('Synthetic year', { includeImages: true });
            const files = await readArchive(result.blob), decode = bytes => new TextDecoder().decode(new Uint8Array(bytes));
            const manifestPath = Object.keys(files).find(x => x.endsWith('photos-manifest.json'));
            const manifest = JSON.parse(decode(files[manifestPath])), prefix = manifestPath.slice(0, -'photos-manifest.json'.length);
            runs.push({ names: manifest.map(x => x.exportedName), included: manifest.map(x => x.included), actual: manifest.map(x => files[prefix + x.exportedName] || null), html: decode(files[Object.keys(files).find(x => x.endsWith('/Portfolio.html'))]) });
        }
        const redBytes = Array.from(new Uint8Array(await (await realPhotoDecode(red)).arrayBuffer())), blueBytes = Array.from(new Uint8Array(await (await realPhotoDecode(blue)).arrayBuffer()));
        return { runs, expectedBytes: [redBytes, blueBytes, redBytes, blueBytes, redBytes, blueBytes, Array.from(new TextEncoder().encode('synthetic Drive photo bytes')), null, redBytes, redBytes] };
    });
    check('unique same-date/name and sanitized photo paths on case-insensitive extraction', new Set(photos.runs[0].names.map(n => n.toLowerCase())).size, 10);
    check('stable photo paths across identical exports', photos.runs[0].names, photos.runs[1].names);
    check('real ZIP bytes and manifest paths incl original/Drive/legacy photos', photos.runs[0].actual, photos.expectedBytes);
    check('included only available written bytes', photos.runs[0].included, [true, true, true, true, true, true, true, false, true, true]);
    check('extension added despite date/stem periods', photos.runs[0].names[2].endsWith('.png'), true);
    check('hostile writing escaped in standalone HTML', photos.runs[0].html.includes('<img src=x'), false);
}

async function checkStudentFolders(page) {
    const folderCase = await page.evaluate(async () => {
        seedArchive();
        const names = ['Alice', 'ALICE', 'Alice (2)', 'Al/ice', 'Al:ice', '__proto__', 'constructor', 'Alice.', 'CON', '_CON'];
        localStorage.setItem('wft_portfolio', JSON.stringify(Object.fromEntries(names.map((name, i) => [name, { sessions: [{ id: 'folder-' + i, originalText: 'Synthetic folder essay #' + i }] }]))));
        const exports = [];
        let bytes;
        for (let i = 0; i < 2; i++) {
            const result = await createSchoolYearArchiveZip('Synthetic folder year', { includeImages: false });
            bytes = Array.from(new Uint8Array(await result.blob.arrayBuffer()));
            const files = await readArchive(result.blob), paths = Object.keys(files);
            const html = paths.filter(n => /\/Students\/[^/]+\/Portfolio\.html$/.test(n)).map(n => new TextDecoder().decode(new Uint8Array(files[n])));
            const portfolio = JSON.parse(new TextDecoder().decode(new Uint8Array(files[paths.find(n => n.endsWith('Complete Portfolio.json'))])));
            exports.push({ paths, individualEssays: names.map((name, j) => html.filter(text => text.includes('Synthetic folder essay #' + j)).length), studentFolders: html.length, labelsPreserved: names.every(name => Object.hasOwn(portfolio, name) && html.some(text => text.includes('<h1>' + escapeHtml(name) + ' &mdash;'))) });
        }
        return { exports, bytes };
    });
    check('student folder paths survive case-insensitive extraction', new Set(folderCase.exports[0].paths.map(n => n.toLowerCase())).size, folderCase.exports[0].paths.length);
    check('distinct case/sanitized/explicit-suffix/trailing-dot/CON-vs-_CON/ordinary-key student folders', folderCase.exports[0].studentFolders, 10);
    check('each real ZIP individual portfolio retains its own essay', folderCase.exports[0].individualEssays, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    check('student folder paths deterministic across identical exports', folderCase.exports[0].paths, folderCase.exports[1].paths);
    check('Windows-safe paths preserve original HTML and JSON student labels', folderCase.exports[0].labelsPreserved, true);
    if (process.env.WFT_TEST_ARTIFACT_DIR) fs.writeFileSync(path.join(process.env.WFT_TEST_ARTIFACT_DIR, 'synthetic-student-folders.zip'), Buffer.from(folderCase.bytes));
}

async function checkOrdinaryStudentIdentities(page) {
    for (const name of ['constructor', 'toString', 'hasOwnProperty', 'Alice <img src=x onerror=alert(1)>']) {
        const result = await page.evaluate(async name => { seedArchive([], name); const zip = await createSingleStudentArchiveZip(name); const files = await readArchive(zip.blob); return { count: Object.keys(files).length, safe: !new TextDecoder().decode(new Uint8Array(Object.values(files)[0])).includes('<img src=x') }; }, name);
        check(`ordinary identity/${name}`, result, { count: 1, safe: true });
    }
}

async function observePhotoExport({ mode, source }) {
    const images = source === 'none' ? [] : source === 'unavailable' ? [{ name: 'missing' }] : source === 'local' ? [{ name: 'local.png', dataUrl: archiveRed }] : source === 'original' ? [{ name: 'original.png', originalDataUrl: archiveRed }] : source === 'decode-error' ? [{ name: 'bad.png', dataUrl: 'data:image/png;base64,%bad' }] : [{ name: 'drive.png', driveFileId: 'synthetic-id' }];
    seedArchive(images); document.getElementById('archiveStatus').textContent = '';
    document.getElementById('archiveIncludeImages').checked = source !== 'unchecked';
    if (source === 'download-error') downloadDriveFileAsBlobPromise = async () => { throw Error('Synthetic photo download failure'); };
    const file = JSZip.prototype.file;
    if (source === 'write-error') JSZip.prototype.file = function(name, data, options) { if (data instanceof Blob) throw Error('Synthetic ZIP write failure'); return file.call(this, name, data, options); };
    const before = archiveBytes();
    if (mode === 'single') await exportSelectedStudentPortfolio(); else await archiveCurrentSchoolYear();
    await settleArchive(); JSZip.prototype.file = file;
    const files = archiveBlobs.length ? await readArchive(archiveBlobs[0]) : {};
    const manifest = Object.keys(files).find(n => n.endsWith('photos-manifest.json'));
    return { calls: archiveCalls, retained: JSON.stringify(before) === JSON.stringify(archiveBytes()), photoFiles: Object.keys(files).filter(n => /\/Photos\/.*\.(png|jpg)$|^Photos\/.*\.(png|jpg)$/.test(n)).length, manifest: manifest ? JSON.parse(new TextDecoder().decode(new Uint8Array(files[manifest]))) : null };
}

async function checkPhotoExportSources(page) {
    for (const mode of ['single', 'year']) for (const source of ['Drive', 'local', 'original', 'unavailable', 'none', 'unchecked', 'download-error', 'decode-error', 'write-error']) {
        const observed = await page.evaluate(observePhotoExport, { mode, source });
        const failed = source.endsWith('error'), available = ['Drive', 'local', 'original'].includes(source);
        check(`${mode}/${source}/completion`, [observed.calls.downloads, observed.calls.uploads], [failed ? 0 : 1, mode === 'year' && !failed ? 1 : 0]);
        check(`${mode}/${source}/class ownership`, observed.retained, mode === 'single' || failed);
        if (!failed && available) check(`${mode}/${source}/actual ZIP photo`, observed.photoFiles, 1);
        if (source === 'unavailable') check(`${mode}/metadata-only truthful manifest`, observed.manifest?.map(x => x.included), [false]);
        if (failed) check(`${mode}/${source}/reported`, observed.calls.alerts.some(x => /could not be completed/.test(x)), true);
    }
}

async function observeArchiveChange({ stage, change }) {
    seedArchive(stage === 'photos' ? [{ name: 'drive.png', driveFileId: 'synthetic' }] : []);
    let entered, release; const started = new Promise(r => entered = r), gate = new Promise(r => release = r);
    const generate = JSZip.prototype.generateAsync;
    const mutate = () => {
        if (change === 'late-save') saveStudentSession('Alice', { id: 'second', originalText: 'Saved during archive' });
        if (change === 'same-id' || change === 'photo-revision') { const p = getLocalPortfolioSnapshot(); if (change === 'same-id') p.Alice.sessions[0].originalText = 'Edited same ID'; else p.Alice.sessions[0].images = [{ imageRevision: 'new', driveFileId: 'new-photo' }]; savePortfolioData(p); }
        if (change === 'add') { document.getElementById('studentNameInput').value = 'Carol'; addStudent(); }
        if (change === 'rename' || change === 'remove') { const p = getLocalPortfolioSnapshot(); if (change === 'rename') p.Alicia = p.Alice; delete p.Alice; saveWftStudentChange({ portfolio: p, deletions: getDeletionsData(), students: change === 'rename' ? ['Alicia'] : [], selectedStudent: '' }); }
        if (change === 'settings') { const s = getRawSettings(); s.unknown = 'new'; localStorage.setItem('wft_settings', JSON.stringify(s)); }
        if (change === 'ui-settings') document.getElementById('targetWordCount').value = '777';
        if (change === 'pending') { pendingPortfolioSync = { studentName: 'Alice', sessionData: { id: 'pending', originalText: 'New pending essay' } }; persistPendingPortfolioSync(); }
        if (change === 'replacement') activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'first' };
        if (change === 'draft') document.getElementById('studentWriting').value = 'New unsaved draft';
        if (change === 'selected-photo') selectedImages = [{ imageId: 'new', imageRevision: 'new', dataUrl: archiveRed }];
        if (change === 'corrupt') localStorage.setItem('wft_portfolio', '{broken during archive');
        globalThis.beforeArchiveClear = archiveBytes();
        if (change === 'read-failure') { const get = Storage.prototype.getItem; Storage.prototype.getItem = function(key) { if (key === 'wft_portfolio') throw Error('Synthetic post-await read failure'); return get.call(this, key); }; globalThis.restoreArchiveRead = () => Storage.prototype.getItem = get; }
    };
    if (stage === 'photos') downloadDriveFileAsBlobPromise = async () => { entered(); await gate; return new Blob(['synthetic photo']); };
    if (stage === 'compression') JSZip.prototype.generateAsync = async function(options) { entered(); await gate; return generate.call(this, options); };
    if (stage === 'upload') saveArchiveZipToDrive = async () => { archiveCalls.uploads++; entered(); await gate; };
    if (stage === 'download') downloadBlob = blob => { archiveCalls.downloads++; archiveBlobs.push(blob); mutate(); };
    const run = archiveCurrentSchoolYear();
    if (stage !== 'download') { await started; mutate(); release(); }
    await run; await settleArchive();
    JSZip.prototype.generateAsync = generate; if (globalThis.restoreArchiveRead) { restoreArchiveRead(); delete globalThis.restoreArchiveRead; }
    const files = archiveBlobs.length ? await readArchive(archiveBlobs[0]) : {};
    const portfolioFile = Object.keys(files).find(n => n.endsWith('Complete Portfolio.json'));
    return { retained: JSON.stringify(beforeArchiveClear) === JSON.stringify(archiveBytes()), calls: archiveCalls, archivedIds: portfolioFile ? JSON.parse(new TextDecoder().decode(new Uint8Array(files[portfolioFile]))).Alice.sessions.map(x => x.id) : [] };
}

async function checkArchiveSnapshotOwnership(page) {
    for (const stage of ['photos', 'compression', 'upload', 'download']) for (const change of ['late-save', 'same-id', 'photo-revision', 'add', 'rename', 'remove', 'settings', 'ui-settings', 'pending', 'replacement', 'draft', 'selected-photo', 'corrupt', 'read-failure', 'none']) {
        const result = await page.evaluate(observeArchiveChange, { stage, change });
        check(`${stage}/${change}/snapshot archive`, result.archivedIds, ['first']);
        check(`${stage}/${change}/saved and downloaded`, [result.calls.uploads, result.calls.downloads], [1, 1]);
        check(`${stage}/${change}/retain or clear`, result.retained, change !== 'none');
        check(`${stage}/${change}/truthful completion`, result.calls.alerts.some(x => change === 'none' ? /current class cleared/.test(x) : /class.*retain/i.test(x) && !/could not be completed/.test(x)), true);
    }
}

async function observeStrictExport({ key, kind }) {
    seedArchive(); if (kind === 'corrupt') localStorage.setItem(key, '{broken'); if (kind === 'absent') localStorage.removeItem(key);
    const before = archiveBytes(), get = Storage.prototype.getItem;
    if (kind === 'read-failure') Storage.prototype.getItem = function(name) { if (name === key) throw Error('Synthetic unreadable storage'); return get.call(this, name); };
    let failed = false; try { await createSchoolYearArchiveZip('Synthetic year'); } catch { failed = true; }
    Storage.prototype.getItem = get;
    return { failed, preserved: JSON.stringify(before) === JSON.stringify(archiveBytes()) };
}

async function checkStrictExportStorage(page) {
    for (const key of ['wft_portfolio', 'wft_students', 'wft_settings', 'wft_deletions']) for (const kind of ['corrupt', 'read-failure', 'absent']) {
        const result = await page.evaluate(observeStrictExport, { key, kind });
        check(`strict export/${key}/${kind}`, result, { failed: kind !== 'absent', preserved: true });
    }
}

async function observePostUpload({ key, kind }) {
    seedArchive();
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    let before;
    saveArchiveZipToDrive = async () => {
        archiveCalls.uploads++;
        if (kind === 'corrupt') localStorage.setItem(key, '{broken after upload');
        before = archiveBytes();
        if (kind === 'read-failure') Storage.prototype.getItem = function(name) { if (name === key) throw Error('Synthetic read failure after upload'); return get.call(this, name); };
        if (kind === 'write-failure') Storage.prototype.setItem = function(name, value) { if (name === key) throw Error('Synthetic clear write failure'); return set.call(this, name, value); };
    };
    await archiveCurrentSchoolYear(); await settleArchive(); Storage.prototype.getItem = get; Storage.prototype.setItem = set;
    return { retained: JSON.stringify(before) === JSON.stringify(archiveBytes()), calls: archiveCalls };
}

async function checkPostUploadStorage(page) {
    for (const key of ['wft_portfolio', 'wft_students', 'wft_settings', 'wft_deletions']) for (const kind of ['corrupt', 'read-failure', 'write-failure']) {
        const result = await page.evaluate(observePostUpload, { key, kind });
        check(`post-upload/${key}/${kind}/preserved`, result.retained, true);
        check(`post-upload/${key}/${kind}/saved truthfully`, result.calls.alerts.some(x => /saved to Drive and downloaded/.test(x) && /class.*retain/i.test(x) && !/could not be completed/.test(x)), true);
    }
}

async function checkFailedPhotoRetry(page) {
    const retry = await page.evaluate(async () => {
        seedArchive([{ name: 'retry.png', driveFileId: 'synthetic' }]);
        downloadDriveFileAsBlobPromise = async () => { throw Error('Synthetic temporary download failure'); };
        await archiveCurrentSchoolYear(); await settleArchive();
        const failedKept = !!getLocalPortfolioSnapshot().Alice;
        downloadDriveFileAsBlobPromise = async () => new Blob(['recovered photo bytes'], { type: 'image/png' });
        archiveCalls.alerts.length = 0;
        await archiveCurrentSchoolYear(); await settleArchive();
        const files = await readArchive(archiveBlobs[0]);
        const photo = Object.keys(files).find(n => n.endsWith('retry.png'));
        return { failedKept, cleared: Object.keys(getLocalPortfolioSnapshot()).length === 0, bytes: new TextDecoder().decode(new Uint8Array(files[photo])), calls: [archiveCalls.uploads, archiveCalls.downloads] };
    });
    check('failed requested photo retry recovers bytes and normal clear', retry, { failedKept: true, cleared: true, bytes: 'recovered photo bytes', calls: [1, 1] });
}

async function observePostcommitFailure(boundary) {
    seedArchive(); const original = globalThis[boundary];
    wftSyncState.pendingPortfolioPush = wftSyncState.pendingSettingsPush = wftSyncState.pendingDeletionsPush = false;
    const fail = () => { throw Error('Synthetic postcommit ' + boundary + ' failure'); };
    if (boundary === 'closeCropModal') _cropLastFocusedEl = { focus: fail };
    else globalThis[boundary] = fail;
    await archiveCurrentSchoolYear(); await settleArchive(); globalThis[boundary] = original; _cropLastFocusedEl = null;
    return { cleared: Object.keys(getLocalPortfolioSnapshot()).length === 0 && localStorage.getItem('wft_students') === '[]', runtime: [students.length, selectedStudent], calls: archiveCalls, dirty: [wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush] };
}

async function checkPostcommitFailures(page) {
    for (const boundary of ['renderStudentList', 'populateStudentDropdown', 'refreshPortfolioDropdown', 'renderStudentPortfolio', 'scheduleWftDriveSync', 'scheduleWftCloudSync', 'closeCropModal']) {
        const result = await page.evaluate(observePostcommitFailure, boundary);
        check(`postcommit/${boundary}/committed clear`, [result.cleared, result.runtime], [true, [0, '']]);
        check(`postcommit/${boundary}/truthful clear message`, result.calls.alerts.some(x => /current class cleared/.test(x) && !/retain/i.test(x)), true);
        check(`postcommit/${boundary}/dirty streams retained for retry`, result.dirty, [true, true, true]);
    }
}

async function checkActualArchiveDialogs(page) {
    // Exercise actual app name/confirmation dialogs: changes before the snapshot belong in it.
    for (const stage of ['input', 'confirmation']) {
        await page.evaluate(() => { seedArchive(); wftTextInput = realArchiveInput; wftConfirm = realArchiveConfirm; globalThis.dialogArchiveDone = false; archiveCurrentSchoolYear().finally(() => dialogArchiveDone = true); });
        await page.locator('#wftTextInputField').waitFor();
        if (stage === 'input') await page.evaluate(() => saveStudentSession('Alice', { id: 'dialog-save', originalText: 'Saved during name dialog' }));
        await page.locator('#wftTextInputField').fill('Synthetic dialog year');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.getByRole('button', { name: 'Create Archive', exact: true }).waitFor();
        if (stage === 'confirmation') await page.evaluate(() => saveStudentSession('Alice', { id: 'dialog-save', originalText: 'Saved during confirmation dialog' }));
        await page.getByRole('button', { name: 'Create Archive', exact: true }).click();
        await page.waitForFunction(() => archiveCalls.alerts.length > 0);
        const result = await page.evaluate(async () => { const files = await readArchive(archiveBlobs[0]), file = Object.keys(files).find(x => x.endsWith('Complete Portfolio.json')); return { ids: JSON.parse(new TextDecoder().decode(new Uint8Array(files[file]))).Alice.sessions.map(s => s.id).sort(), cleared: Object.keys(getLocalPortfolioSnapshot()).length === 0, dialogs: document.querySelectorAll('.wft-confirm-backdrop').length }; });
        check(`actual dialog/${stage}/snapshot ownership`, result, { ids: ['dialog-save', 'first'], cleared: true, dialogs: 0 });
    }
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.href === 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')) });
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => loadWftFeatureLibrary('zip'));
        await page.evaluate(installArchiveFixtures);
        await checkPhotoZipContents(page);
        await checkStudentFolders(page);
        await checkOrdinaryStudentIdentities(page);
        await checkPhotoExportSources(page);
        await checkArchiveSnapshotOwnership(page);
        await checkStrictExportStorage(page);
        await checkPostUploadStorage(page);
        await checkFailedPhotoRetry(page);
        await checkPostcommitFailures(page);
        await checkActualArchiveDialogs(page);
        check('no unhandled browser errors', errors, []);
        const report = { root, scope: 'Native Edge complete app/helpers/live handlers and actual app dialogs. Installed locked JSZip DEFLATE/loadAsync and actual ZIP bytes/manifest assertions. Synthetic students, intercepted Drive download/upload and browser download dispatch; all external network blocked. No live Drive or physical download verification.', zipTestVersion: require('jszip/package.json').version, cases, passed: cases.filter(x => x.pass).length, failed: cases.filter(x => !x.pass).length };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(`Archive integrity browser cases: ${report.passed}/${cases.length} passed, ${report.failed} failed.`);
        assert.equal(report.failed, 0, cases.filter(x => !x.pass).map(x => x.name + ': ' + x.error).join('\n'));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
