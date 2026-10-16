const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const folderType = 'application/vnd.google-apps.folder';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const mode of ['load', 'merge', 'lazy']) for (const boundary of ['unchanged', 'listing', 'download', 'missing']) {
            const page = await browser.newPage(), requests = [], errors = [];
            page.on('pageerror', e => errors.push(e.message));
            let changed = false;
            await page.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url()), query = url.searchParams.get('q') || '';
                const reply = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
                if (url.origin === 'http://127.0.0.1:8765') return localAppRoute(route, root);
                if (url.origin !== 'https://www.googleapis.com') return route.abort();
                if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });
                requests.push({ url: url.href, method: req.method(), body: req.postData(), token: req.headers().authorization });
                if (!changed && ((boundary === 'listing' && query.includes("name='student-synthetic-id.json'")) || (boundary === 'download' && url.searchParams.get('alt') === 'media'))) {
                    changed = true;
                    await page.evaluate(() => { driveAccessToken = wftSyncState.accessToken = 'synthetic-account-B'; });
                }
                if (url.pathname.startsWith('/upload/')) return reply({ id: 'saved-student-file' });
                if (url.searchParams.get('alt') === 'media') return reply({ schemaVersion: 1, format: 'student-portfolio-v1', studentId: 'synthetic-id', displayName: 'Synthetic', sessions: [{ id: 'remote', originalText: 'Account A exact writing.' }] });
                if (query) {
                    assert.ok(query.includes("name='student-synthetic-id.json'"));
                    return reply({ files: boundary === 'missing' ? [] : [{ id: 'account-A-student-file' }] });
                }
                if (url.pathname.endsWith('/root-folder')) return reply({ id: 'root-folder', name: 'WritingFeedbackTool', mimeType: folderType, trashed: false });
                return reply({ id: 'students-folder', name: 'students', mimeType: folderType, trashed: false, parents: ['root-folder'] });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(() => {
                stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); pendingPortfolioSync = null;
                localStorage.setItem('wft_settings', '{}'); localStorage.setItem('wft_students', '["Synthetic"]'); localStorage.setItem('wft_deletions', '{"records":[]}');
                localStorage.setItem('wft_portfolio', '{}');
                driveAccessToken = wftSyncState.accessToken = 'synthetic-account-A'; driveFolderId = wftSyncState.folderId = 'root-folder';
                wftSyncState.tokenExpiresAt = Date.now() + 600000; localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, 'students-folder');
                globalThis.beforeStudentRead = { portfolio: localStorage.getItem('wft_portfolio'), flags: { lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, idb: WFT_INDEXEDDB_CACHE_V1, split: WFT_SPLIT_STUDENT_FILES_V1 } };
            });
            let observed;
            try {
                observed = await page.evaluate(async mode => {
                    if (mode === 'lazy') { WFT_LAZY_PORTFOLIO_LOAD_V1 = WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init(); }
                    const outcomes = [];
                    await new Promise(resolve => {
                        const done = (error, data) => { outcomes.push({ error: error && error.message, data }); resolve(); };
                        if (mode === 'load') loadStudentFileFromDrive('synthetic-id', done);
                        else if (mode === 'merge') syncStudentFileWithMerge('synthetic-id', { studentId: 'synthetic-id', displayName: 'Synthetic', sessions: [{ id: 'local', originalText: 'Local exact writing.' }] }, done);
                        else loadStudentPortfolioLazy('synthetic-id', 'Synthetic', done);
                    });
                    const cached = mode === 'lazy' ? await WftStorage.getStudentPortfolio('synthetic-id') : null;
                    return { outcomes, cached, before: beforeStudentRead, portfolio: localStorage.getItem('wft_portfolio') };
                }, mode);
                assert.deepEqual(observed.before.flags, { lazy: false, idb: false, split: true });
                assert.equal(observed.portfolio, observed.before.portfolio); assert.equal(observed.outcomes.length, 1); assert.deepEqual(errors, []);
                const result = observed.outcomes[0];
                if (changed) {
                    assert.ok(result.error, 'Changed account must reject the original student-file operation'); assert.equal(result.data, null);
                    assert.ok(!observed.cached, 'Changed-account writing must not enter student cache');
                    assert.equal(requests.filter(r => r.token === 'Bearer synthetic-account-B').length, 0, 'Original operation must not send requests under the new account');
                    assert.equal(requests.filter(r => r.url.includes('/upload/')).length, 0);
                } else if (boundary === 'missing') {
                    if (mode === 'lazy') { assert.ok(result.error); assert.equal(result.data, null); }
                    else { assert.ok(!result.error); assert.equal(requests.filter(r => r.url.includes('/upload/')).length, mode === 'merge' ? 1 : 0); }
                } else {
                    assert.ok(!result.error); assert.ok(result.data.sessions.some(s => s.id === 'remote'));
                    if (mode === 'merge') assert.ok(result.data.sessions.some(s => s.id === 'local'));
                    if (mode === 'lazy') assert.equal(observed.cached.data.studentId, 'synthetic-id');
                }
                cases.push({ name: mode + '-' + boundary, passed: true, observed, requests });
            } catch (error) { cases.push({ name: mode + '-' + boundary, passed: false, error: error.message, observed, requests, pageErrors: errors }); }
            await page.close();
        }
    } finally { await browser.close(); }
    const report = { suite: 'student-read-ownership.browser', cases, count: cases.length, failed: cases.filter(c => !c.passed).length };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ cases: report.count, failed: report.failed, failures: cases.filter(c => !c.passed).map(c => ({ name: c.name, error: c.error })) }, null, 2));
    assert.equal(report.failed, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
