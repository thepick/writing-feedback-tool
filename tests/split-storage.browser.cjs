const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const folderType = 'application/vnd.google-apps.folder';
const scenarios = ['create', 'discover', 'cached', 'root-create', 'root-discover', 'root-empty', 'root-error', 'update', 'merge', 'merge-empty', 'merge-download-error',
    'merge-corrupt', 'folder-empty', 'folder-empty-id', 'folder-numeric-id', 'folder-whitespace-id',
    'folder-malformed', 'folder-error', 'folder-network', 'discovery-missing-id', 'search-error',
    'upload-error', 'upload-empty', 'upload-malformed', 'upload-network', 'protected-root', 'missing-parent',
    'index-cached', 'index-discover', 'index-missing', 'index-invalid', 'index-error', 'async-local'];

function replyJson(route, data, status = 200) {
    return route.fulfill({ status, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
        body: typeof data === 'string' ? data : JSON.stringify(data) });
}

function replyUpload(route, scenario, failing) {
    if (failing && scenario === 'upload-error') return replyJson(route, { error: { message: 'Synthetic upload error' } }, 503);
    if (failing && scenario === 'upload-empty') return replyJson(route, {});
    if (failing && scenario === 'upload-malformed') return replyJson(route, '{invalid');
    if (failing && scenario === 'upload-network') return route.abort();
    return replyJson(route, { id: 'saved-student' });
}

function replyFolder(route, scenario, failing, body) {
    if (JSON.parse(body).name === 'WritingFeedbackTool') {
        assert.deepEqual(JSON.parse(body), { name: 'WritingFeedbackTool', mimeType: folderType });
        if (failing && scenario === 'root-empty') return replyJson(route, {});
        if (failing && scenario === 'root-error') return replyJson(route, {}, 403);
        return replyJson(route, { id: 'root-folder' });
    }
    assert.deepEqual(JSON.parse(body), { name: 'students', mimeType: folderType, parents: ['root-folder'] });
    if (failing && scenario === 'folder-empty') return replyJson(route, {});
    if (failing && scenario === 'folder-empty-id') return replyJson(route, { id: '' });
    if (failing && scenario === 'folder-numeric-id') return replyJson(route, { id: 123 });
    if (failing && scenario === 'folder-whitespace-id') return replyJson(route, { id: '  ' });
    if (failing && scenario === 'folder-malformed') return replyJson(route, '{invalid');
    if (failing && scenario === 'folder-error') return replyJson(route, {}, 403);
    if (failing && scenario === 'folder-network') return route.abort();
    return replyJson(route, { id: 'students-folder' });
}

function replyMedia(route, scenario, failing) {
    if (failing && ['merge-download-error', 'index-error'].includes(scenario)) return replyJson(route, { error: { message: 'Synthetic read error' } }, 403);
    if (scenario === 'merge-corrupt') return replyJson(route, '{invalid');
    if (scenario.startsWith('index-')) return replyJson(route, scenario === 'index-invalid' ? { format: 'other' } : { format: 'portfolio-index-v1', students: { Synthetic: { sessionCount: 2 } } });
    return replyJson(route, { format: 'student-portfolio-v1', schemaVersion: 1, studentId: 'synthetic-id', displayName: 'Synthetic', legacyNameKeys: ['Old Synthetic'], createdAt: '2026-01-01T00:00:00Z', sessions: [
        { id: 'remote', createdAt: '2026-10-11T00:00:00Z', originalText: 'Remote synthetic writing.' },
        { id: 'deleted', createdAt: '2026-01-01T00:00:00Z', originalText: 'Deleted synthetic writing.' }
    ] });
}

function replySearch(route, scenario, failing, query) {
    assert.ok(query.includes('trashed=false'));
    if (query.includes("name='WritingFeedbackTool'")) return replyJson(route, { files: scenario === 'root-discover' ? [{ id: 'root-folder' }] : [] });
    if (query.includes("name='students'")) {
        assert.ok(query.includes("'root-folder' in parents"));
        if (failing && scenario === 'search-error') return replyJson(route, {}, 500);
        if (failing && scenario === 'discovery-missing-id') return replyJson(route, { files: [{ mimeType: folderType }] });
        return replyJson(route, { files: scenario === 'discover' ? [{ id: 'decoy', mimeType: 'application/json' }, { id: 'students-folder', mimeType: folderType }] : [] });
    }
    if (query.includes("name='portfolio-index.json'")) return replyJson(route, { files: scenario === 'index-missing' ? [] : [{ id: 'index-newest' }, { id: 'index-older' }] });
    assert.ok(query.includes("name='student-synthetic-id.json'"));
    return replyJson(route, { files: ['update', 'merge', 'merge-download-error', 'merge-corrupt'].includes(scenario) ? [{ id: 'student-newest' }, { id: 'student-older' }] : [] });
}

async function routeSplitRequest(route, scenario, requests, failing) {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    if (url.origin === 'http://127.0.0.1:8765') {
        const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
        return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : replyJson(route, '', 404);
    }
    if (url.origin !== 'https://www.googleapis.com') return route.abort();
    if (method === 'OPTIONS') return replyJson(route, '', 204);
    const body = req.postData(), query = url.searchParams.get('q') || '';
    requests.push({ url: url.href, method, body, query, authorization: req.headers().authorization });
    assert.equal(req.headers().authorization, 'Bearer synthetic-token');
    if (url.pathname.startsWith('/upload/')) return replyUpload(route, scenario, failing);
    if (method === 'POST') return replyFolder(route, scenario, failing, body);
    if (url.searchParams.get('alt') === 'media') return replyMedia(route, scenario, failing);
    if (query) return replySearch(route, scenario, failing, query);
    if (url.pathname.endsWith('/students-folder')) return replyJson(route, { id: 'students-folder', name: 'students', parents: ['root-folder'], mimeType: folderType, trashed: false });
    return replyJson(route, { id: 'root-folder', name: 'WritingFeedbackTool', mimeType: folderType, trashed: false });
}

function prepareScenario(scenario) {
    stopWftSyncPolling(); stopDriveAutoSync();
    localStorage.clear(); pendingPortfolioSync = null;
    localStorage.setItem('wft_settings', '{}');
    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'local', createdAt: '2026-10-12T00:00:00Z', originalText: 'Local synthetic writing.', images: [{ imageId: 'photo', driveFileId: 'synthetic-photo' }] }] } }));
    localStorage.setItem('wft_deletions', JSON.stringify({ records: [{ type: 'session', studentId: 'synthetic-id', sessionId: 'deleted', deletedAt: '2026-10-01T00:00:00Z' }] }));
    driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
    driveFolderId = wftSyncState.folderId = 'root-folder';
    if (scenario.startsWith('root-')) driveFolderId = wftSyncState.folderId = '';
    if (['cached', 'update'].includes(scenario) || scenario.startsWith('merge-') || scenario === 'merge') localStorage.setItem('wft_drive_students_folder_id', 'students-folder');
    if (['index-cached', 'index-invalid', 'index-error'].includes(scenario)) setCachedWftDriveFileId('portfolio-index.json', 'index-cached');
    if (scenario === 'protected-root') localStorage.setItem('wft_deletions', '{damaged');
}

async function invokeScenario(scenario) {
    const before = Object.fromEntries(['wft_portfolio', 'wft_settings', 'wft_deletions'].map(key => [key, localStorage.getItem(key)]));
    const flags = { split: WFT_SPLIT_STUDENT_FILES_V1, index: WFT_PORTFOLIO_INDEX_V1, identity: WFT_STUDENT_ID_MAP_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, idb: WFT_INDEXEDDB_CACHE_V1, compaction: WFT_TOMBSTONE_COMPACTION_V1 };
    let count = 0, result;
    if (scenario === 'async-local') {
        wftSuppressDirtyMarks = true;
        const loaded = await loadStudentPortfolioAsync('Synthetic'), absent = await loadStudentPortfolioAsync('Missing');
        const updated = { sessions: loaded.sessions.concat({ id: 'async', createdAt: '2026-10-12T01:00:00Z', originalText: 'Async synthetic writing.' }) };
        const saved = await saveStudentPortfolioAsync('Synthetic', updated);
        result = { saved, loaded, absent, stored: await loadStudentPortfolioAsync('Synthetic') };
    } else if (scenario === 'missing-parent') {
        try { await saveJsonToDriveFolderPromise('student-synthetic-id.json', {}, ''); result = { error: '', value: 'saved' }; }
        catch (e) { result = { error: e.message, value: null }; }
    } else {
        result = await new Promise(resolve => {
            const callback = (error, value) => { count++; resolve({ error: error && error.message, value }); };
            if (scenario.startsWith('index-')) loadPortfolioIndexFromDrive(callback);
            else {
                const record = { studentId: 'synthetic-id', displayName: 'Synthetic', legacyNameKeys: ['Synthetic'], createdAt: '2026-10-01T00:00:00Z', sessions: JSON.parse(localStorage.getItem('wft_portfolio')).Synthetic.sessions };
                if (scenario.startsWith('merge')) syncStudentFileWithMerge('synthetic-id', record, callback);
                else saveStudentFileToDrive('synthetic-id', record, callback);
            }
        });
    }
    await new Promise(resolve => setTimeout(resolve, 20));
    return { result, count, before, after: Object.fromEntries(Object.keys(before).map(key => [key, localStorage.getItem(key)])), flags,
        folderCache: localStorage.getItem('wft_drive_students_folder_id'), fileCache: localStorage.getItem('wft_drive_student_file_synthetic-id'), indexCache: getCachedWftDriveFileId('portfolio-index.json') };
}

function checkIndex(check, scenario, observed, requests) {
    check('index read never uploads', requests.filter(r => r.url.includes('/upload/')).length === 0);
    check('index result', scenario === 'index-error' ? !!observed.result.error : !observed.result.error && (['index-invalid', 'index-missing'].includes(scenario) ? observed.result.value === null : observed.result.value.students.Synthetic.sessionCount === 2));
    if (scenario === 'index-discover') check('canonical newest index selected and cached', observed.indexCache === 'index-newest' && requests.some(r => r.url.includes('/index-newest?alt=media')) && !requests.some(r => r.url.includes('/index-older')));
}

function checkUploadedRecord(check, record) {
    check('uploaded record identity and writing bytes', record && record.format === 'student-portfolio-v1' && record.studentId === 'synthetic-id' && record.displayName === 'Synthetic' && record.sessions.find(s => s.id === 'local').originalText === 'Local synthetic writing.' && record.sessions.find(s => s.id === 'local').images[0].driveFileId === 'synthetic-photo');
}

function checkUploadTarget(check, scenario, upload, metadata) {
    check('canonical update or valid create parent', ['update', 'merge', 'merge-download-error'].includes(scenario) ? upload.method === 'PATCH' && upload.url.includes('/student-newest?') && JSON.stringify(metadata) === '{}' : upload.method === 'POST' && metadata.parents[0] === 'students-folder');
}

function checkFailedSave(check, scenario, observed, requests) {
    check('failure cannot acknowledge a save', !!observed.result.error);
    check('failed save does not cache a successful file ID', observed.fileCache === null || scenario === 'merge-download-error' || scenario === 'merge-corrupt');
    if (!scenario.startsWith('upload-')) check('refusal performs no upload', requests.filter(r => r.url.includes('/upload/')).length === 0);
    if (scenario.startsWith('folder-') || scenario === 'discovery-missing-id') check('invalid folder never cached', observed.folderCache === null);
}

function checkAsyncSave(check, observed, requests) {
    check('native async save/load retains prior writing and adds new writing', observed.result.saved.Synthetic.sessions.length === 2 && observed.result.stored.sessions.length === 2 && observed.result.stored.sessions.find(s => s.id === 'local').originalText === 'Local synthetic writing.' && observed.result.stored.sessions[0].id === 'async' && observed.result.absent.sessions.length === 0);
    check('local wrapper makes no service request', requests.length === 0);
}

function checkUpload(check, scenario, observed, requests) {
    const uploads = () => requests.filter(r => r.url.includes('/upload/'));
    const upload = uploads()[0], parts = upload && upload.body.split(/\r\n\r\n|\r\n--/), metadata = parts && JSON.parse(parts[1]), record = parts && JSON.parse(parts[3]);
    check('one native multipart upload with acknowledged ID', uploads().length === 1 && observed.result.value && observed.fileCache === 'saved-student');
    checkUploadedRecord(check, record);
    checkUploadTarget(check, scenario, upload, metadata);
    if (scenario === 'merge') check('merge keeps cloud-only writing, deletion filter and legacy names', observed.result.value.sessions.length === 2 && record.sessions.some(s => s.id === 'remote') && !record.sessions.some(s => s.id === 'deleted') && record.legacyNameKeys.includes('Old Synthetic'));
    if (scenario === 'cached') check('cached students folder avoids discovery/create', !requests.some(r => r.query.includes("name='students'") || r.method === 'POST' && !r.url.includes('/upload/')));
}

function shouldVerifyUpload(scenario, failure) {
    if (failure) return !['protected-root', 'missing-parent', 'merge-corrupt'].includes(scenario);
    return !scenario.startsWith('index-');
}

async function runScenario(browser, scenario, cases) {
    const page = await browser.newPage(), errors = [], requests = [];
    let failing = true;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => routeSplitRequest(route, scenario, requests, failing));
    await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
    await page.evaluate(prepareScenario, scenario);
    const invoke = () => page.evaluate(invokeScenario, scenario);
    let observed = await invoke();
    const firstAttempt = { observed, requests: requests.slice() };
    const assertions = [], check = (label, passed) => assertions.push({ label, passed: !!passed });
    check('default flags', JSON.stringify(observed.flags) === JSON.stringify({ split: true, index: true, identity: false, lazy: false, idb: false, compaction: false }));
    const uploads = () => requests.filter(r => r.url.includes('/upload/'));
    const failure = ['root-empty', 'root-error', 'folder-empty', 'folder-empty-id', 'folder-numeric-id', 'folder-whitespace-id', 'folder-malformed', 'folder-error', 'folder-network', 'discovery-missing-id', 'search-error', 'upload-error', 'upload-empty', 'upload-malformed', 'upload-network', 'protected-root', 'missing-parent', 'merge-download-error', 'merge-corrupt'].includes(scenario);
    if (scenario === 'async-local') {
        checkAsyncSave(check, observed, requests);
    } else {
        check('protected local roots remain byte exact', JSON.stringify(observed.before) === JSON.stringify(observed.after));
        check('callback exactly once', scenario === 'missing-parent' || observed.count === 1);
        if (failure) {
            checkFailedSave(check, scenario, observed, requests);
            if (!['protected-root', 'missing-parent', 'merge-corrupt'].includes(scenario)) {
                failing = false; requests.length = 0; observed = await invoke();
                check('retry succeeds once with retained writing', !observed.result.error && observed.count === 1 && uploads().length === 1 && JSON.stringify(observed.before) === JSON.stringify(observed.after));
            }
        } else if (scenario.startsWith('index-')) {
            checkIndex(check, scenario, observed, requests);
        }
        if (shouldVerifyUpload(scenario, failure)) checkUpload(check, scenario, observed, requests);
    }
    check('no uncaught browser errors', errors.length === 0);
    cases.push({ scenario, passed: assertions.every(a => a.passed), assertions, firstAttempt, observed, requests, errors });
    await page.close();
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of scenarios) await runScenario(browser, scenario, cases);
    } finally { await browser.close(); }
    const report = { root, scenarios: cases.length, assertions: cases.reduce((n, c) => n + c.assertions.length, 0), cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    const failures = cases.filter(c => !c.passed).map(c => ({ scenario: c.scenario, assertions: c.assertions.filter(a => !a.passed) }));
    console.log(JSON.stringify({ scenarios: cases.length, assertions: report.assertions, failures }, null, 2));
    assert.equal(failures.length, 0, 'Native split-storage regression failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
