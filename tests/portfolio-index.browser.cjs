const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', function serveLocalApp(route) {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return route.fulfill(fs.existsSync(file) ? { contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) } : { status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        await page.waitForFunction(() => typeof syncWftPortfolioIndexIfNeeded === 'function');
        const cases = await page.evaluate(async function verifyPortfolioIndexCases() {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [], check = (name, passed, observed) => cases.push({ name, passed: !!passed, observed });
            const native = { upload: uploadWftJsonFilePromise, save: saveFileToDrive, fetch: wftDriveFetch, ensure: ensureDriveFolder, backup: saveWftPreMigrationBackupToDrive, studentsFolder: ensureWftStudentsFolderPromise, studentSave: saveStudentFileToDrive, get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
            const copy = value => JSON.parse(JSON.stringify(value));
            const entry = (id, overall = 80) => ({ id, createdAt: '2026-10-12T00:00:00Z', date: '12/10/2026', overall, originalText: 'Synthetic writing ' + id, categoryScores: {}, images: [{ imageId: 'photo-' + id, driveFileId: 'synthetic-photo', name: 'writing.png' }] });
            let uploads, requests;
            async function reset() {
                Storage.prototype.getItem = native.get; Storage.prototype.setItem = native.set; Storage.prototype.removeItem = native.remove;
                for (const owner of new Set(['Synthetic', wftWritingDraft?.owner || ''])) await navigator.locks.request(wftWritingDraftKey(owner), () => {});
                delete navigator.onLine;
                uploadWftJsonFilePromise = native.upload; saveFileToDrive = native.save; wftDriveFetch = native.fetch; ensureDriveFolder = native.ensure;
                saveWftPreMigrationBackupToDrive = native.backup; ensureWftStudentsFolderPromise = native.studentsFolder; saveStudentFileToDrive = native.studentSave;
                localStorage.clear(); sessionStorage.clear(); wftWritingDraft = null; wftDraftJournalWarnings = Object.create(null);
                localStorage.setItem('wft_settings', JSON.stringify({ students: ['Synthetic'], extra: 'keep' }));
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
                activePortfolioReassessmentSource = null; latestAnalysisData = null;
                document.getElementById('studentSelect').value = '';
                populateStudentDropdown(); wftLoadWritingDraft('Synthetic', true);
                if (wftWritingDraft.owner !== selectedStudent || selectedStudent !== document.getElementById('studentSelect').value || document.getElementById('studentWriting').value !== '') throw Error('Synthetic case reset must start with one aligned empty draft owner');
            }
            async function run(name, fn) { await reset(); try { await fn(name); } catch (e) { check(name + ' completed', false, e.message); } finally { await reset(); } }
            const sync = () => syncWftPortfolioIndexIfNeeded('synthetic-test');
            const direct = index => new Promise(resolve => savePortfolioIndexToDrive(index, (error, fileId) => resolve({ error: error && error.message, fileId })));
            async function verifyScoreSummaries() {
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
                await run('live legacy session summaries', name => {
                    const reads = [], sessions = [{
                        get createdAt() { reads.push('date'); return 'Sun, 01 Feb 2026 00:00:00 GMT'; },
                        get overall() { reads.push('score'); sessions.push({ createdAt: '2026-03-01T00:00:00Z', overallScore: '80' }); return '0'; }
                    }];
                    const portfolio = Object.fromEntries([
                        ['__proto__', { sessions }], ['constructor', [{ createdAt: '2026-02-01', overall: null, overallScore: 100 }]],
                        ['_meta', { ignored: true }], ['updatedAt', 'ignored'], ['syncMeta', {}]
                    ]);
                    const before = localStorage.getItem('wft_portfolio'), index = buildPortfolioIndexFromPortfolio(portfolio);
                    check(name + ' live reads and chronological summary', reads.join(',') === 'date,date,score' && index.students.__proto__.sessionCount === 2 && index.students.__proto__.averageScore === 40 && index.students.__proto__.latestSessionAt === '2026-03-01T00:00:00Z', { reads, serialized: JSON.stringify(index) });
                    check(name + ' own keys and legacy array/null precedence', Object.getPrototypeOf(index.students) === null && Object.keys(index.students).join(',') === '__proto__,constructor' && index.students.constructor.averageScore === null && index.students.constructor.sessionCount === 1);
                    check(name + ' authoritative storage unchanged', before === localStorage.getItem('wft_portfolio'));
                    const sentinel = { reason: 'Synthetic score getter failure' };
                    let thrown;
                    try { buildPortfolioIndexFromPortfolio({ Synthetic: { sessions: [{ get overall() { throw sentinel; } }] } }); }
                    catch (error) { thrown = error; }
                    check(name + ' thrown getter identity', thrown === sentinel);
                });
            }
            async function verifyNativeCommits() {
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
            }
            async function verifyRebuiltIdentity() {
                for (const identity of ['new-ID', 'existing-ID', 'failed-allocation']) await run('native rebuild identity/' + identity, async name => {
                    saveStudentSession('Synthetic', entry('one')); WFT_STUDENT_ID_MAP_V1 = true;
                    const expectedId = identity === 'existing-ID' ? 'synthetic-existing-id' : createStableStudentId('Synthetic', {});
                    const settings = JSON.parse(localStorage.getItem('wft_settings'));
                    settings.studentIdMap = identity === 'existing-ID' ? { Synthetic: expectedId } : {};
                    localStorage.setItem('wft_settings', JSON.stringify(settings));
                    localStorage.setItem('wft_drive_student_file_' + expectedId, 'synthetic-file-by-ID');
                    localStorage.setItem('wft_drive_student_file_' + sanitizeStudentIdPart('Synthetic'), 'synthetic-file-by-name');
                    const before = localStorage.getItem('wft_portfolio');
                    const rebuild = () => new Promise(resolve => rebuildPortfolioIndex((error, index) => resolve({ error: error && error.message, index })));
                    if (identity === 'failed-allocation') {
                        Storage.prototype.setItem = function(key, value) { if (key === 'wft_settings') throw new Error('Synthetic identity persistence failure'); return native.set.call(this, key, value); };
                        const failed = await rebuild();
                        check(name + ' honest name fallback', !!failed.error && failed.index.students.Synthetic.studentId === '' && failed.index.students.Synthetic.studentFileId === 'synthetic-file-by-name' && uploads[0].students.Synthetic.averageScore === 80 && isWftPortfolioIndexDirty(), failed);
                        check(name + ' unstored ID absent', !JSON.parse(localStorage.getItem('wft_settings')).studentIdMap.Synthetic && localStorage.getItem('wft_portfolio') === before);
                        Storage.prototype.setItem = native.set;
                    }
                    const result = await rebuild(), stored = JSON.parse(localStorage.getItem('wft_settings')), uploaded = uploads.at(-1);
                    const student = result.index.students[expectedId];
                    check(name + ' actual allocation/current index', !result.error && stored.studentIdMap.Synthetic === expectedId && Object.keys(result.index.students).length === 1 && !!student && student.studentId === expectedId && student.displayName === 'Synthetic' && student.legacyNameKey === 'Synthetic', result);
                    check(name + ' correct metadata and uploaded bytes', !!student && student.studentFileId === 'synthetic-file-by-ID' && student.averageScore === 80 && student.sessionCount === 1 && student.latestSessionAt === entry('one').createdAt && JSON.stringify(result.index.students) === JSON.stringify(uploaded.students), uploaded);
                    check(name + ' primary preserved/ack', localStorage.getItem('wft_portfolio') === before && !isWftPortfolioIndexDirty());
                });
            }
            async function verifyNewerUploadRevisions() {
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
                    if (['clear', 'reset-class', 'archive-clear'].includes(action)) check(name + ' local clearing committed before upload acknowledgement', students.length === 0 && !getLocalPortfolioSnapshot().Synthetic);
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
            }
            async function verifyUploadFailures() {
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
            }
            async function verifyDirtyHintReads() {
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
            }
            async function verifySnapshotOwnership() {
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
            }
            async function verifyDirectGuardsAndRebuildRetry() {
                for (const guard of ['safe-mode', 'recovery', 'disabled']) await run('direct save guard/' + guard, async name => {
                    saveStudentSession('Synthetic', entry('one')); const index = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                    if (guard === 'safe-mode') localStorage.setItem('wft_storage_meta', JSON.stringify({ safeMode: true }));
                    if (guard === 'recovery') wftStudentChangeRecovery = { wft_portfolio: localStorage.getItem('wft_portfolio') };
                    if (guard === 'disabled') WFT_PORTFOLIO_INDEX_V1 = false;
                    const result = await direct(index);
                    check(name, !!result.error && !result.fileId && uploads.length === 0, result);
                });
                await run('live rebuild observes index failure then retries', async name => {
                    saveStudentSession('Synthetic', entry('one'));
                    uploadWftJsonFilePromise = async () => { throw new Error('Synthetic index rejection'); };
                    const rebuild = () => new Promise(resolve => rebuildPortfolioIndex((error, index) => resolve({ error: !!error, index })));
                    const failed = await rebuild();
                    check(name + ' failed upload keeps acknowledgement pending', failed.error && failed.index.students.Synthetic.sessionCount === 1 && isWftPortfolioIndexDirty(), failed);
                    uploadWftJsonFilePromise = async () => 'synthetic-index'; const succeeded = await rebuild();
                    check(name + ' retry', !succeeded.error && succeeded.index.students.Synthetic.sessionCount === 1 && !isWftPortfolioIndexDirty(), succeeded);
                });
            }
            async function verifyStorageFailuresAndWrites() {
                for (const failure of ['settings-read', 'settings-invalid', 'portfolio-read', 'portfolio-invalid', 'roster-read', 'markers-read', 'dirty-write', 'ack-write', 'ack-read', 'remove']) {
                    async function verifyStorageFailure(name) {
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
                    }
                    await run('storage failure/' + failure, verifyStorageFailure);
                }
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
            }
            async function verifyLocalAndIndexedDbCaches() {
                await run('optional cached file ID read failure', name => {
                    saveStudentSession('Synthetic', entry('one')); const before = localStorage.getItem('wft_portfolio');
                    Storage.prototype.getItem = function(key) { if (key.startsWith('wft_drive_student_file_')) throw new Error('Synthetic cache read failure'); return native.get.call(this, key); };
                    const built = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                    check(name, built.students.Synthetic.studentFileId === '' && built.students.Synthetic.averageScore === 80 && localStorage.getItem('wft_portfolio') === before);
                });
                await run('explicit lazy local startup path', async name => {
                    saveStudentSession('Synthetic', entry('one')); WFT_LAZY_PORTFOLIO_LOAD_V1 = true;
                    wftSyncState.accessToken = driveAccessToken = ''; wftSyncState.tokenExpiresAt = 0;
                    loadSettingsFromLocalStorage(); refreshPortfolioDropdown();
                    const loaded = await new Promise(resolve => loadStudentPortfolioLazy('Synthetic', 'Synthetic', (error, data) => resolve({ error: !!error, data })));
                    check(name, document.querySelector('#portfolioStudentSelect option[value="Synthetic"]')?.textContent === 'Synthetic' && !loaded.error && loaded.data.sessions.length === 1 && isWftPortfolioIndexDirty());
                });
                await run('optional native IDB and lazy cache round trip', async name => {
                    const beforeFlags = { idb: WFT_INDEXEDDB_CACHE_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, split: WFT_SPLIT_STUDENT_FILES_V1 };
                    try {
                        saveStudentSession('Synthetic', entry('cache'));
                        const primary = localStorage.getItem('wft_portfolio');
                        WFT_INDEXEDDB_CACHE_V1 = WFT_LAZY_PORTFOLIO_LOAD_V1 = true;
                        WFT_SPLIT_STUDENT_FILES_V1 = false;
                        await WftStorage.init();
                        check(name + ' real database opened', WftStorage.mode === 'indexeddb' && WftIndexedDb.isReady());
                        const index = buildPortfolioIndexFromPortfolio(getLocalPortfolioSnapshot());
                        await WftStorage.savePortfolioIndex(index);
                        const cachedIndex = await WftStorage.getPortfolioIndex();
                        check(name + ' actual index data', cachedIndex.data.students.Synthetic.sessionCount === 1 && cachedIndex.data.students.Synthetic.averageScore === 80);
                        await WftStorage.saveStudentPortfolio('Synthetic', getLocalPortfolioSnapshot().Synthetic);
                        const cached = await WftStorage.getStudentPortfolio('Synthetic');
                        check(name + ' actual student data', cached.data.sessions[0].id === 'cache' && !!cached.cachedAt);
                        const lazy = () => new Promise(resolve => loadStudentPortfolioLazy('Synthetic', 'Synthetic', (error, data) => resolve({ error, data })));
                        const hit = await lazy();
                        check(name + ' actual lazy cache hit', !hit.error && hit.data.sessions[0].id === 'cache');
                        await WftIndexedDb.clearAll();
                        check(name + ' database cleared', await WftStorage.getStudentPortfolio('Synthetic') == null && await WftStorage.getPortfolioIndex() == null);
                        const fallback = await lazy();
                        check(name + ' cache miss local fallback', !fallback.error && fallback.data.sessions[0].id === 'cache');
                        check(name + ' primary writing preserved', localStorage.getItem('wft_portfolio') === primary);
                    } finally {
                        WFT_INDEXEDDB_CACHE_V1 = beforeFlags.idb; WFT_LAZY_PORTFOLIO_LOAD_V1 = beforeFlags.lazy; WFT_SPLIT_STUDENT_FILES_V1 = beforeFlags.split;
                        WftStorage.mode = 'localStorage';
                    }
                });
            }
            async function verifyNativeTransportAndOrchestrator() {
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
            }
            await verifyScoreSummaries();
            await verifyNativeCommits();
            await verifyRebuiltIdentity();
            await verifyNewerUploadRevisions();
            await verifyUploadFailures();
            await verifyDirtyHintReads();
            await verifySnapshotOwnership();
            await verifyDirectGuardsAndRebuildRetry();
            await verifyStorageFailuresAndWrites();
            await verifyLocalAndIndexedDbCaches();
            await verifyNativeTransportAndOrchestrator();
            return cases;
        });
        const report = { root, scope: 'Full shipped scripts in native Edge; synthetic records and transport seams; all external network requests blocked. Lazy coverage uses the live settings/dropdown and local portfolio loader.', passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, errors, cases };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
        assert.deepEqual(errors, []); assert.equal(report.failed, 0);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
