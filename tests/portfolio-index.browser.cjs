const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return route.fulfill(fs.existsSync(file) ? { contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) } : { status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof syncWftPortfolioIndexIfNeeded === 'function');
        const cases = await page.evaluate(async () => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [], check = (name, passed, observed) => cases.push({ name, passed: !!passed, observed });
            const native = { upload: uploadWftJsonFilePromise, save: saveFileToDrive, fetch: wftDriveFetch, ensure: ensureDriveFolder, backup: saveWftPreMigrationBackupToDrive, studentsFolder: ensureWftStudentsFolderPromise, studentSave: saveStudentFileToDrive, get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
            const copy = value => JSON.parse(JSON.stringify(value));
            const entry = (id, overall = 80) => ({ id, createdAt: '2026-10-12T00:00:00Z', date: '12/10/2026', overall, originalText: 'Synthetic writing ' + id, categoryScores: {}, images: [{ imageId: 'photo-' + id, driveFileId: 'synthetic-photo', name: 'writing.png' }] });
            let uploads, requests;
            function reset() {
                Storage.prototype.getItem = native.get; Storage.prototype.setItem = native.set; Storage.prototype.removeItem = native.remove;
                delete navigator.onLine;
                uploadWftJsonFilePromise = native.upload; saveFileToDrive = native.save; wftDriveFetch = native.fetch; ensureDriveFolder = native.ensure;
                saveWftPreMigrationBackupToDrive = native.backup; ensureWftStudentsFolderPromise = native.studentsFolder; saveStudentFileToDrive = native.studentSave;
                localStorage.clear(); localStorage.setItem('wft_settings', JSON.stringify({ students: ['Synthetic'], extra: 'keep' }));
                localStorage.setItem('wft_students', '["Synthetic"]'); localStorage.setItem('wft_selectedStudent', 'Synthetic');
                students = ['Synthetic']; selectedStudent = 'Synthetic'; selectedImages = []; pendingPortfolioSync = null; wftStudentChangeRecovery = null;
                wftApiKeyStorageRecovery = null; wftSyncState.needsSyncAfterCurrent = false;
                WFT_PORTFOLIO_INDEX_V1 = true; WFT_STUDENT_ID_MAP_V1 = false; WFT_LAZY_PORTFOLIO_LOAD_V1 = false;
                if (typeof wftPortfolioIndexDirty !== 'undefined') wftPortfolioIndexDirty = false;
                if (typeof wftPortfolioIndexRevision !== 'undefined') wftPortfolioIndexRevision = 0;
                wftSyncState.accessToken = driveAccessToken = 'synthetic-token'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
                uploads = []; requests = [];
                uploadWftJsonFilePromise = async (name, data) => { uploads.push(copy(data)); return 'synthetic-index'; };
                window.alert = () => {}; wftConfirm = async () => true;
            }
            async function run(name, fn) { reset(); try { await fn(name); } catch (e) { check(name + ' completed', false, e.message); } finally { reset(); } }
            const sync = () => syncWftPortfolioIndexIfNeeded('synthetic-test');
            const direct = index => new Promise(resolve => savePortfolioIndexToDrive(index, (error, fileId) => resolve({ error: error && error.message, fileId })));
            check('default flags', WFT_PORTFOLIO_INDEX_V1 && WFT_SPLIT_STUDENT_FILES_V1 && !WFT_STUDENT_ID_MAP_V1 && !WFT_LAZY_PORTFOLIO_LOAD_V1 && !WFT_INDEXEDDB_CACHE_V1 && !WFT_TOMBSTONE_COMPACTION_V1);
            for (const [label, scores, expected] of [
                ['actual overall', [{ overall: 80 }], 80], ['zero', [{ overall: 0 }], 0],
                ['legacy overallScore', [{ overallScore: 70 }], 70], ['legacy string overall', [{ overall: '80' }], 80],
                ['current wins', [{ overall: 90, overallScore: 10 }], 90],
                ['null wins', [{ overall: null, overallScore: 10 }], null], ['missing', [{}], null],
                ['invalid', [{ overall: NaN }, { overall: Infinity }, { overall: '' }, { overall: 'bad' }], null],
                ['mixed unscored', [{ overall: 80 }, { overall: null }, { overallScore: 60 }, {}], 70]
            ]) await run('score/' + label, name => {
                const sessions = scores.map((score, i) => ({ ...entry('score-' + i), ...score }));
                // Absent current scores must stay absent in the legacy fixtures.
                scores.forEach((score, i) => { if (!Object.hasOwn(score, 'overall')) delete sessions[i].overall; });
                const portfolio = { Synthetic: { sessions }, _meta: { ignored: true } }, before = JSON.stringify(portfolio);
                const main = buildPortfolioIndexFromPortfolio(portfolio);
                const split = rebuildIndexFromStudentFiles({ f: { format: 'student-portfolio-v1', studentId: 'synthetic-id', displayName: 'Synthetic', legacyNameKeys: ['Synthetic'], sessions } });
                check(name + ' main', main.students.Synthetic.averageScore === expected, main.students.Synthetic);
                check(name + ' split', split.students['synthetic-id'].averageScore === expected, split.students['synthetic-id']);
                check(name + ' metadata/immutable', Object.keys(main.students).length === 1 && main.students.Synthetic.sessionCount === sessions.length && main.students.Synthetic.latestSessionAt === sessions[0].createdAt && JSON.stringify(portfolio) === before);
            });
            await run('native saved index bytes and same-snapshot ack', async name => {
                saveStudentSession('Synthetic', entry('one')); const before = localStorage.getItem('wft_portfolio');
                const result = await sync(); const settings = JSON.parse(localStorage.getItem('wft_settings'));
                check(name, result === true && uploads.length === 1 && uploads[0].students.Synthetic.averageScore === 80 && !isWftPortfolioIndexDirty(), { result, uploads, settings });
                check('primary writing/photo/date unchanged', localStorage.getItem('wft_portfolio') === before && getPortfolioData().Synthetic.sessions[0].images[0].driveFileId === 'synthetic-photo');
                check('settings retained', settings.extra === 'keep' && settings.students[0] === 'Synthetic');
                check('clean retry performs no upload', await sync() === false && uploads.length === 1);
            });
            await run('actual assessment session schema pending commit index', async name => {
                document.getElementById('studentSelect').innerHTML = '<option value="Synthetic">Synthetic</option>';
                document.getElementById('studentWriting').value = 'Synthetic writing about a walk in the park.';
                const analysis = { inputContext: captureCurrentWritingContext(), overall: 80, categoryScores: { 'Ideas & Details': 8, Grammar: 8, 'Word Choice': 8, Organization: 8, Flow: 8, 'Spelling & Punctuation': 8 }, actualWords: 9, targetWords: 100, correctedStory: 'Synthetic writing about a walk in the park.', quick: {}, detailed: { categories: {} } };
                saveCurrentSessionToPortfolio(analysis); const pending = copy(getPendingPortfolioSync());
                check(name + ' native pending schema', pending.sessionData.overall === 80 && !Object.hasOwn(pending.sessionData, 'overallScore') && !!pending.sessionData.date && !!pending.sessionData.createdAt, pending.sessionData);
                check(name + ' native commit', commitPendingPortfolioSync() === true);
                const before = localStorage.getItem('wft_portfolio');
                check(name + ' uploaded bytes', await sync() === true && uploads[0].students.Synthetic.averageScore === 80 && localStorage.getItem('wft_portfolio') === before);
            });
            for (const action of ['save', 'reassessment', 'remove', 'clear', 'reset-class', 'archive-clear', 'cloud-merge', 'same-millisecond-mark']) await run('delayed upload/' + action, async name => {
                saveStudentSession('Synthetic', entry('one'));
                let release; uploadWftJsonFilePromise = (filename, index) => { uploads.push(copy(index)); return new Promise(resolve => { release = resolve; }); };
                const running = sync();
                if (action === 'save') saveStudentSession('Synthetic', entry('two', 90));
                if (action === 'reassessment') commitPendingPortfolioReplacement({ studentName: 'Synthetic', sessionData: entry('one', 90), replaceSource: { sourceStudentName: 'Synthetic', sourceSessionId: 'one' } });
                if (action === 'remove') removeStudentSession('Synthetic', 'one');
                if (action === 'clear') await clearAllStudents();
                if (action === 'reset-class') await resetCurrentClassData();
                if (action === 'archive-clear') clearCurrentClassAfterSuccessfulArchive();
                if (action === 'cloud-merge') savePortfolioLocalOnly({ Synthetic: { sessions: [entry('one'), entry('cloud', 90)] } }, 'cloud-merge');
                if (action === 'same-millisecond-mark') {
                    const old = JSON.parse(localStorage.getItem('wft_settings'))._indexDirtyAt;
                    markWftPortfolioIndexDirty('newer-edit'); const settings = JSON.parse(localStorage.getItem('wft_settings')); settings._indexDirtyAt = old; localStorage.setItem('wft_settings', JSON.stringify(settings));
                }
                const before = localStorage.getItem('wft_portfolio'); release('synthetic-index'); await running;
                check(name + ' newer pending', isWftPortfolioIndexDirty(), JSON.parse(localStorage.getItem('wft_settings')));
                check(name + ' primary bytes', localStorage.getItem('wft_portfolio') === before);
                uploadWftJsonFilePromise = async (filename, index) => { uploads.push(copy(index)); return 'synthetic-index'; };
                check(name + ' retry current snapshot', await sync() === true && !isWftPortfolioIndexDirty() && uploads.length === 2 && JSON.stringify(uploads[1].students) === JSON.stringify(buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot()).students), uploads);
            });
            for (const failure of ['no-token', 'missing-legacy-connection', 'offline', 'no-writer', 'reject', 'empty-result', 'callback-error', 'callback-empty', 'sync-throw']) await run('upload failure/' + failure, async name => {
                saveStudentSession('Synthetic', entry('one')); const before = localStorage.getItem('wft_portfolio');
                if (failure === 'no-token') { wftSyncState.accessToken = driveAccessToken = ''; wftSyncState.tokenExpiresAt = 0; }
                if (failure === 'missing-legacy-connection') driveAccessToken = '';
                if (failure === 'offline') Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
                if (failure === 'no-writer') uploadWftJsonFilePromise = saveFileToDrive = undefined;
                if (failure === 'reject') uploadWftJsonFilePromise = async () => { throw new Error('Synthetic request rejected'); };
                if (failure === 'empty-result') uploadWftJsonFilePromise = async () => null;
                if (failure === 'sync-throw') uploadWftJsonFilePromise = () => { throw new Error('Synthetic synchronous request failure'); };
                if (failure.startsWith('callback')) { uploadWftJsonFilePromise = undefined; saveFileToDrive = (f, bytes, type, callback) => callback(failure === 'callback-error' ? new Error('Synthetic callback failure') : null, null); }
                const callback = await direct(buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot()));
                check(name + ' truthful callback', !!callback.error && !callback.fileId, callback);
                check(name + ' truthful sync', await sync() === false && isWftPortfolioIndexDirty());
                check(name + ' primary bytes', localStorage.getItem('wft_portfolio') === before);
                if (['offline', 'no-token', 'no-writer', 'missing-legacy-connection'].includes(failure)) check(name + ' zero I/O', uploads.length === 0);
                delete navigator.onLine; wftSyncState.accessToken = driveAccessToken = 'synthetic-token'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
                uploadWftJsonFilePromise = async () => 'synthetic-index';
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            await run('native callback upload ack', async name => {
                saveStudentSession('Synthetic', entry('one')); uploadWftJsonFilePromise = undefined;
                saveFileToDrive = (filename, bytes, mime, callback) => { uploads.push(JSON.parse(bytes)); callback(null, 'synthetic-index'); };
                check(name, await sync() === true && uploads[0].students.Synthetic.averageScore === 80 && !isWftPortfolioIndexDirty());
            });
            await run('dirty hint unreadable with no in-memory mark', async name => {
                localStorage.setItem('wft_settings', '{"students":["Synthetic"],"_indexDirty":true}');
                localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [entry('one')] } }));
                Storage.prototype.getItem = function(key) { if (key === 'wft_settings') throw new Error('Synthetic dirty hint read failure'); return native.get.call(this, key); };
                check(name + ' safe pending decision', isWftPortfolioIndexDirty());
                check(name + ' guards block I/O', await sync() === false && uploads.length === 0);
                Storage.prototype.getItem = native.get;
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            for (const damaged of ['null', '[]', '42', '{"students":{}}']) await run('invalid dirty hint shape/' + damaged, async name => {
                localStorage.setItem('wft_settings', damaged);
                check(name + ' pending decision', isWftPortfolioIndexDirty());
                check(name + ' guards block I/O', await sync() === false && uploads.length === 0 && localStorage.getItem('wft_settings') === damaged);
                localStorage.setItem('wft_settings', '{"students":["Synthetic"],"_indexDirty":true}');
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            await run('stale prebuilt index is rejected', async name => {
                saveStudentSession('Synthetic', entry('one')); const stale = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                saveStudentSession('Synthetic', entry('two', 90)); const result = await direct(stale);
                check(name, !!result.error && !result.fileId && uploads.length === 0 && isWftPortfolioIndexDirty(), result);
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            await run('changed Google connection stays pending', async name => {
                saveStudentSession('Synthetic', entry('one')); let release;
                uploadWftJsonFilePromise = () => new Promise(resolve => { release = resolve; });
                const running = sync(); wftSyncState.accessToken = driveAccessToken = 'synthetic-replacement-token'; release('synthetic-index');
                check(name, await running === false && isWftPortfolioIndexDirty());
                uploadWftJsonFilePromise = async () => 'synthetic-index';
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            await run('delayed upload storage recovery blocks ack', async name => {
                saveStudentSession('Synthetic', entry('one')); let release;
                uploadWftJsonFilePromise = () => new Promise(resolve => { release = resolve; });
                const running = sync(), before = localStorage.getItem('wft_portfolio');
                wftStudentChangeRecovery = { wft_portfolio: before }; release('synthetic-index');
                check(name, await running === false && isWftPortfolioIndexDirty() && localStorage.getItem('wft_portfolio') === before);
                wftStudentChangeRecovery = null; uploadWftJsonFilePromise = async () => 'synthetic-index';
                check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty());
            });
            for (const guard of ['safe-mode', 'recovery', 'disabled']) await run('direct save guard/' + guard, async name => {
                saveStudentSession('Synthetic', entry('one')); const index = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                if (guard === 'safe-mode') localStorage.setItem('wft_storage_meta', JSON.stringify({ safeMode: true }));
                if (guard === 'recovery') wftStudentChangeRecovery = { wft_portfolio: localStorage.getItem('wft_portfolio') };
                if (guard === 'disabled') WFT_PORTFOLIO_INDEX_V1 = false;
                const result = await direct(index);
                check(name, !!result.error && !result.fileId && uploads.length === 0, result);
            });
            await run('migration observes index failure then retries', async name => {
                saveStudentSession('Synthetic', entry('one'));
                saveWftPreMigrationBackupToDrive = callback => callback(null, 'synthetic-backup');
                ensureWftStudentsFolderPromise = async () => 'synthetic-students-folder';
                saveStudentFileToDrive = (id, data, callback) => callback(null, 'synthetic-student-file');
                uploadWftJsonFilePromise = async () => { throw new Error('Synthetic index rejection'); };
                const migrate = () => new Promise(resolve => migrateLegacyPortfolioToStudentFiles((error, status) => resolve({ error: !!error, status })));
                const failed = await migrate();
                check(name + ' no completion on failed index', failed.error && failed.status !== 'completed' && !getWftStorageMeta().migrationCompletedAt, failed);
                uploadWftJsonFilePromise = async () => 'synthetic-index'; const succeeded = await migrate();
                check(name + ' retry', !succeeded.error && succeeded.status === 'completed' && !!getWftStorageMeta().migrationCompletedAt, succeeded);
            });
            for (const failure of ['settings-read', 'settings-invalid', 'portfolio-read', 'portfolio-invalid', 'roster-read', 'markers-read', 'dirty-write', 'ack-write', 'ack-read', 'remove']) await run('storage failure/' + failure, async name => {
                saveStudentSession('Synthetic', entry('one')); let release;
                if (failure.startsWith('ack-')) { uploadWftJsonFilePromise = () => new Promise(resolve => { release = resolve; }); }
                const running = failure.startsWith('ack-') ? sync() : null;
                const primary = localStorage.getItem('wft_portfolio');
                const key = failure.startsWith('settings') || failure.startsWith('ack') ? 'wft_settings' : failure.startsWith('portfolio') ? 'wft_portfolio' : failure === 'roster-read' ? 'wft_students' : WFT_DELETIONS_STORAGE_KEY;
                if (failure.endsWith('-read')) Storage.prototype.getItem = function(k) { if (k === key) throw new Error('Synthetic read failure'); return native.get.call(this, k); };
                if (failure.endsWith('-invalid')) localStorage.setItem(key, '{synthetic damaged bytes');
                if (failure.endsWith('-write')) Storage.prototype.setItem = function(k, value) { if (k === 'wft_settings') throw new Error('Synthetic write failure'); return native.set.call(this, k, value); };
                if (failure === 'dirty-write') { native.set.call(localStorage, 'wft_settings', '{"students":["Synthetic"]}'); markWftPortfolioIndexDirty('write-failed'); check(name + ' memory retry hint', isWftPortfolioIndexDirty()); }
                if (failure === 'remove') { Storage.prototype.removeItem = function() { throw new Error('Synthetic remove failure'); }; check(name + ' optional remove not needed', await sync() === true && !isWftPortfolioIndexDirty()); }
                else if (failure === 'dirty-write') check(name + ' failed ack pending', await sync() === false && isWftPortfolioIndexDirty());
                else {
                    if (failure.startsWith('ack-')) release('synthetic-index');
                    check(name + ' returns failure', await (running || sync()) === false);
                    if (failure === 'settings-read' || failure === 'settings-invalid') check(name + ' unreadable hint chooses pending', isWftPortfolioIndexDirty());
                }
                check(name + ' preserves primary', native.get.call(localStorage, 'wft_portfolio') === (failure === 'portfolio-invalid' ? '{synthetic damaged bytes' : primary));
                Storage.prototype.getItem = native.get; Storage.prototype.setItem = native.set; Storage.prototype.removeItem = native.remove;
                if (failure.endsWith('-invalid')) localStorage.setItem(key, key === 'wft_portfolio' ? primary : '{"students":["Synthetic"],"_indexDirty":true}');
                if (failure !== 'remove') { uploadWftJsonFilePromise = async () => 'synthetic-index'; check(name + ' retry', await sync() === true && !isWftPortfolioIndexDirty()); }
            });
            await run('cloud merge marks previously clean index', async name => {
                saveStudentSession('Synthetic', entry('one')); await sync();
                savePortfolioLocalOnly({ Synthetic: { sessions: [entry('one'), entry('cloud', 90)] } }, 'cloud-merge');
                check(name, isWftPortfolioIndexDirty() && await sync() === true && uploads[1].students.Synthetic.sessionCount === 2);
            });
            await run('failed primary write preserves writing and retries', async name => {
                saveStudentSession('Synthetic', entry('one')); await sync(); const before = localStorage.getItem('wft_portfolio');
                Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio') throw new Error('Synthetic primary write failure'); return native.set.call(this, key, value); };
                let failed = false; try { saveStudentSession('Synthetic', entry('two', 90)); } catch { failed = true; }
                check(name + ' saved bytes retained', failed && localStorage.getItem('wft_portfolio') === before && !isWftPortfolioIndexDirty());
                Storage.prototype.setItem = native.set; saveStudentSession('Synthetic', entry('two', 90));
                check(name + ' retry', await sync() === true && uploads[1].students.Synthetic.sessionCount === 2);
            });
            await run('optional cached file ID read failure', name => {
                saveStudentSession('Synthetic', entry('one')); const before = localStorage.getItem('wft_portfolio');
                Storage.prototype.getItem = function(key) { if (key.startsWith('wft_drive_student_file_')) throw new Error('Synthetic cache read failure'); return native.get.call(this, key); };
                const built = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                check(name, built.students.Synthetic.studentFileId === '' && built.students.Synthetic.averageScore === 80 && localStorage.getItem('wft_portfolio') === before);
            });
            await run('explicit lazy local startup path', async name => {
                saveStudentSession('Synthetic', entry('one')); WFT_LAZY_PORTFOLIO_LOAD_V1 = true;
                wftSyncState.accessToken = driveAccessToken = ''; wftSyncState.tokenExpiresAt = 0;
                initLazyPortfolioStartup(); await new Promise(resolve => setTimeout(resolve, 0));
                check(name, document.querySelector('#portfolioStudentSelect option[value="Synthetic"]')?.textContent.includes('1') && isWftPortfolioIndexDirty());
            });
            await run('full native build upload transport ack', async name => {
                saveStudentSession('Synthetic', entry('one'));
                uploadWftJsonFilePromise = native.upload; saveFileToDrive = native.save;
                ensureDriveFolder = callback => callback('synthetic-folder');
                wftDriveFetch = async (url, options) => {
                    requests.push({ url, method: options?.method || 'GET', body: options?.body });
                    const data = url.includes('/upload/') ? { id: 'synthetic-index' } : { files: [{ id: 'synthetic-index', name: 'portfolio-index.json', modifiedTime: '2026-10-12T00:00:00Z' }] };
                    return { json: async () => data };
                };
                const before = localStorage.getItem('wft_portfolio'); const success = await sync();
                const sent = requests.find(r => r.url.includes('/upload/'));
                check(name + ' actual transport bytes', success && sent?.body.includes('"averageScore": 80') && !isWftPortfolioIndexDirty(), requests);
                check(name + ' primary intact', localStorage.getItem('wft_portfolio') === before);
            });
            await run('native orchestrator observes index failure and retry', async name => {
                saveStudentSession('Synthetic', entry('one'));
                const original = { syncWftSettingsIfNeeded, syncWftDeletionsIfNeeded, syncWftPortfolioIfNeeded, ensureDriveFolderPromise, syncStateFromLegacyGoogleGlobals, checkDuplicateSyncFilesStatus };
                try {
                    // Isolate the index stage; its build/save/ack and the orchestrator remain native.
                    syncWftSettingsIfNeeded = syncWftDeletionsIfNeeded = syncWftPortfolioIfNeeded = async () => false;
                    ensureDriveFolderPromise = async () => 'synthetic-folder'; syncStateFromLegacyGoogleGlobals = checkDuplicateSyncFilesStatus = () => {};
                    wftSyncState.signedIn = true; wftSyncState.isSyncing = false;
                    uploadWftJsonFilePromise = async () => { throw new Error('Synthetic index failure'); };
                    const lastPoll = wftSyncState.lastPollAt;
                    check(name + ' failure truthful', await syncWftNow('manual', { immediate: true }) === false && isWftPortfolioIndexDirty() && wftSyncState.lastPollAt === lastPoll);
                    uploadWftJsonFilePromise = async () => 'synthetic-index';
                    check(name + ' retry', await syncWftNow('manual', { immediate: true }) === true && !isWftPortfolioIndexDirty());
                } finally { Object.assign(globalThis, original); }
            });
            return cases;
        });
        const report = { root, scope: 'Full shipped scripts in native Edge; synthetic records and transport seams; all external network requests blocked. Lazy coverage is local index startup only.', passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, errors, cases };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        assert.deepEqual(errors, []); assert.equal(report.failed, 0);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
