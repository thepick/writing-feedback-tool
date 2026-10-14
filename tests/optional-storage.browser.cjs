const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));

async function runNativeStorageScenarios(run) {
    // Native request success is deliberately followed by a real transaction abort.
    for (const method of ['put', 'get', 'getAll', 'delete', 'clear']) await run('transaction-abort-after-' + method + '-success', async method => {
        await WftIndexedDb.put('metadata', { key: 'keep', value: 'protected' });
        const original = IDBObjectStore.prototype[method]; let requestSucceeded = false, aborted = false;
        IDBObjectStore.prototype[method] = function(...args) {
            const req = original.apply(this, args), tx = this.transaction;
            tx.addEventListener('abort', () => { aborted = true; });
            req.addEventListener('success', () => { requestSucceeded = true; tx.abort(); });
            return req;
        };
        let error = '', resolved = false;
        try { await WftIndexedDb[method]('metadata', method === 'put' ? { key: 'new', value: 'uncommitted' } : 'keep'); resolved = true; }
        catch (e) { error = e.message || e.name; }
        finally { IDBObjectStore.prototype[method] = original; }
        await new Promise(resolve => setTimeout(resolve, 20));
        return { resolved, error, requestSucceeded, aborted, records: await WftIndexedDb.getAll('metadata'), primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.equal(r.requestSucceeded, true); assert.equal(r.aborted, true); assert.equal(r.resolved, false); assert.ok(r.error); assert.deepEqual(r.records, [{ key: 'keep', value: 'protected' }]); assert.equal(r.primary, true); }, method);
    await run('native-constraint-error-aborts-after-request-success', async () => {
        await WftIndexedDb.put('metadata', { key: 'keep', value: 'protected' });
        const original = IDBObjectStore.prototype.put; let requestSucceeded = false;
        IDBObjectStore.prototype.put = function(value) {
            const req = original.call(this, value);
            req.addEventListener('success', () => { requestSucceeded = true; this.add({ key: 'keep', value: 'duplicate' }); });
            return req;
        };
        let error = ''; try { await WftIndexedDb.put('metadata', { key: 'new', value: 'uncommitted' }); } catch (e) { error = e.name; } finally { IDBObjectStore.prototype.put = original; }
        await new Promise(resolve => setTimeout(resolve, 20));
        return { error, requestSucceeded, records: await WftIndexedDb.getAll('metadata') };
    }, r => { assert.equal(r.requestSucceeded, true); assert.equal(r.error, 'ConstraintError'); assert.deepEqual(r.records, [{ key: 'keep', value: 'protected' }]); });
    await run('native-cache-operations-and-reopen', async () => {
        WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init();
        await WftStorage.setMetadata('policy', { keep: true });
        await WftIndexedDb.put('thumbnails', { imageId: 'photo', bytes: 'synthetic' });
        const id = await WftIndexedDb.put('syncQueue', { payload: 'synthetic' });
        const metadata = await WftStorage.getMetadata('policy'), queue = await WftIndexedDb.getAll('syncQueue');
        await WftIndexedDb.delete('syncQueue', id); await WftIndexedDb.clear('thumbnails');
        WftIndexedDb.db.close(); WftIndexedDb.db = null; WftIndexedDb._ready = false;
        return { metadata, queue, id, reopened: await WftStorage.getMetadata('policy'), emptyQueue: await WftIndexedDb.getAll('syncQueue'), emptyPhotos: await WftIndexedDb.getAll('thumbnails'), primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.deepEqual(r.metadata, { keep: true }); assert.deepEqual(r.reopened, r.metadata); assert.equal(r.queue[0].id, r.id); assert.equal(r.queue[0].payload, 'synthetic'); assert.deepEqual(r.emptyQueue, []); assert.deepEqual(r.emptyPhotos, []); assert.equal(r.primary, true); });
    for (const failure of ['closed', 'missing-store', 'invalid-key', 'uncloneable']) await run('native-idb-failure-' + failure, async failure => {
        await WftIndexedDb.open(); let error = '';
        if (failure === 'closed') WftIndexedDb.db.close();
        try {
            if (failure === 'missing-store') await WftIndexedDb.get('absent', 'key');
            else if (failure === 'invalid-key') await WftIndexedDb.put('metadata', { value: 'no key' });
            else if (failure === 'uncloneable') await WftIndexedDb.put('metadata', { key: 'bad', value: () => {} });
            else await WftIndexedDb.get('metadata', 'key');
        } catch (e) { error = e.name; }
        return { error, primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.ok(r.error); assert.equal(r.primary, true); }, failure);
    await run('native-unavailable-idb-init-falls-back', async () => {
        WFT_INDEXEDDB_CACHE_V1 = true; Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); await WftStorage.init();
        const loaded = await loadStudentPortfolioAsync('Alice');
        return { mode: WftStorage.mode, ready: WftStorage.isReady, data: loaded, metadata: await WftStorage.getMetadata('any') };
    }, r => { assert.equal(r.mode, 'localStorage'); assert.equal(r.ready, true); assert.equal(r.data.sessions[0].id, 'alice'); assert.equal(r.metadata, null); });
    await run('actual-session-save-with-cache-transaction-failure', async () => {
        WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init(); WftIndexedDb.db.close();
        saveStudentSession('Alice', { id: 'new', originalText: 'New protected writing.' });
        await WftStorage.setMetadata('fail-soft', true); const metadata = await WftStorage.getMetadata('fail-soft');
        const read = await WftStorage.getStudentPortfolio('Alice');
        return { data: getLocalPortfolioSnapshot().Alice, metadata, read };
    }, r => { assert.deepEqual(r.data.sessions.map(s => s.id).sort(), ['alice', 'new']); assert.equal(r.data.sessions.find(s => s.id === 'alice').originalText, 'Alice protected writing.'); assert.equal(r.metadata, null); assert.equal(r.read, null); });
    await run('failed-primary-save-never-publishes-cache', async () => {
        WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init();
        const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio') throw Error('Synthetic full storage'); return original.call(this, key, value); };
        let error = ''; try { saveStudentSession('Alice', { id: 'lost', originalText: 'Unsaved' }); } catch (e) { error = e.message; } finally { Storage.prototype.setItem = original; }
        return { error, cached: await WftStorage.getStudentPortfolio('Alice'), primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.ok(r.error); assert.equal(r.cached, undefined); assert.equal(r.primary, true); });
}

async function runAsyncPortfolioScenarios(run) {
    for (const name of ['constructor', '__proto__', 'toString', 'Alice']) await run('async-own-name-and-ID-' + name, async name => {
        WFT_STUDENT_ID_MAP_V1 = true;
        localStorage.setItem('wft_settings', JSON.stringify({ studentIdMap: Object.fromEntries([[name, 'id-own']]), studentRecords: [{ studentId: 'id-own', displayName: name }] }));
        localStorage.setItem('wft_portfolio', JSON.stringify(Object.fromEntries([[name, { sessions: [{ id: 'keep', originalText: 'Own writing.' }] }]])));
        const named = await loadStudentPortfolioAsync(name), byId = await loadStudentPortfolioAsync('id-own'), record = getStudentRecordById('id-own'), absent = getStudentRecordById('unknown');
        await saveStudentPortfolioAsync('id-own', { sessions: byId.sessions.concat({ id: 'new', originalText: 'New writing.' }) });
        const saved = await loadPortfolioAsync();
        return { named, byId, record, absent, keys: Object.keys(saved), saved: saved[name], pollution: Object.hasOwn(Object.prototype, 'sessions') || Object.hasOwn(Object, 'sessions') };
    }, r => { assert.equal(r.named.sessions[0].originalText, 'Own writing.'); assert.equal(r.byId.sessions[0].originalText, 'Own writing.'); assert.equal(r.record.displayName, name); assert.equal(r.absent, null); assert.deepEqual(r.keys, [name]); assert.equal(r.saved.sessions.length, 2); assert.equal(r.pollution, false); }, name);
    await run('concurrent-public-student-saves-preserve-both-students', async () => {
        await Promise.all([saveStudentPortfolioAsync('Alice', { sessions: [{ id: 'alice-new', originalText: 'Alice new writing.' }] }), saveStudentPortfolioAsync('Bob', { sessions: [{ id: 'bob-new', originalText: 'Bob new writing.' }] })]);
        return { portfolio: await loadPortfolioAsync() };
    }, r => { assert.equal(r.portfolio.Alice.sessions[0].id, 'alice-new'); assert.equal(r.portfolio.Bob.sessions[0].id, 'bob-new'); });
    for (const failure of ['portfolio-corrupt', 'portfolio-read', 'settings-corrupt', 'settings-read']) await run('async-protected-read-' + failure, async failure => {
        WFT_STUDENT_ID_MAP_V1 = true;
        const key = failure.startsWith('settings') ? 'wft_settings' : 'wft_portfolio';
        if (failure.endsWith('corrupt')) localStorage.setItem(key, '{protected damaged bytes');
        const original = Storage.prototype.getItem; const before = original.call(localStorage, key);
        if (failure.endsWith('read')) Storage.prototype.getItem = function(k) { if (k === key) throw Error('Synthetic unreadable storage'); return original.call(this, k); };
        const errors = []; let loaded;
        try { loaded = await loadStudentPortfolioAsync('id-Alice'); } catch (e) { errors.push(e.message); }
        try { await saveStudentPortfolioAsync('id-Alice', { sessions: [{ id: 'wrong', originalText: 'Must not overwrite' }] }); } catch (e) { errors.push(e.message); }
        Storage.prototype.getItem = original;
        return { loaded, errors, primary: localStorage.getItem('wft_portfolio'), same: localStorage.getItem(key) === before };
    }, r => { assert.equal(r.errors.length, 2); assert.equal(r.loaded, undefined); assert.equal(r.same, true); assert.ok(!r.primary.includes('Must not overwrite')); }, failure);
}

async function runDropdownScenarios(run) {
    // Both change events occur in one programmatic task; ordinary user events flush these local-reader microtasks first.
    await run('same-task-dropdown-selection-final-state', async () => {
        WFT_ASYNC_PORTFOLIO_ACCESS_V1 = true;
        const select = document.getElementById('portfolioStudentSelect'), content = document.getElementById('portfolioContent'), changes = [];
        const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => changes.push(node.textContent)))); observer.observe(content, { childList: true });
        select.value = 'Alice'; select.dispatchEvent(new Event('change'));
        select.value = 'Bob'; select.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 30)); observer.disconnect();
        return { selected: select.value, changes, text: content.textContent, primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.equal(r.selected, 'Bob'); assert.ok(r.text.includes('BOB_ONLY')); assert.ok(!r.text.includes('ALICE_ONLY')); assert.equal(r.primary, true); });
    await run('actual-dropdown-safe-mode-bypass', async () => {
        WFT_ASYNC_PORTFOLIO_ACCESS_V1 = true; enterWftStorageSafeMode('synthetic');
        const select = document.getElementById('portfolioStudentSelect'), content = document.getElementById('portfolioContent'); select.value = 'Alice'; select.dispatchEvent(new Event('change'));
        return { immediate: content.textContent, safe: isWftStorageSafeMode() };
    }, r => { assert.equal(r.safe, true); assert.ok(r.immediate.includes('ALICE_ONLY')); });
    for (const failure of ['corrupt', 'read']) await run('actual-dropdown-unavailable-' + failure, async failure => {
        WFT_ASYNC_PORTFOLIO_ACCESS_V1 = true;
        if (failure === 'corrupt') localStorage.setItem('wft_portfolio', '{protected damaged bytes');
        const original = Storage.prototype.getItem, before = original.call(localStorage, 'wft_portfolio');
        if (failure === 'read') Storage.prototype.getItem = function(key) { if (key === 'wft_portfolio') throw Error('Synthetic read failure'); return original.call(this, key); };
        const select = document.getElementById('portfolioStudentSelect'); select.value = 'Alice'; select.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 30)); Storage.prototype.getItem = original;
        return { text: document.getElementById('portfolioContent').textContent, same: localStorage.getItem('wft_portfolio') === before };
    }, r => { assert.ok(r.text.includes('Could not load')); assert.ok(!r.text.includes('No sessions')); assert.equal(r.same, true); }, failure);
}

async function runLazyPortfolioScenarios(run) {
    for (const kind of ['valid', 'wrong-id', 'invalid-sessions']) await run('native-lazy-cache-identity-' + kind, async kind => {
        WFT_INDEXEDDB_CACHE_V1 = WFT_LAZY_PORTFOLIO_LOAD_V1 = true; WFT_SPLIT_STUDENT_FILES_V1 = false; await WftStorage.init();
        await WftIndexedDb.put('studentPortfolios', { studentId: 'id-Alice', data: { studentId: kind === 'wrong-id' ? 'id-Bob' : 'id-Alice', sessions: kind === 'invalid-sessions' ? 'invalid' : [{ id: 'cache' }] } });
        const result = await new Promise(resolve => loadStudentPortfolioLazy('id-Alice', 'Alice', (e, data) => resolve({ error: e && e.message, data })));
        return { result, primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, r => { assert.ok(!r.result.error); assert.equal(r.result.data.sessions[0].id, kind === 'valid' ? 'cache' : 'alice'); assert.equal(r.primary, true); }, kind);
    await run('native-cache-hit-then-real-background-refresh', async () => {
        WFT_INDEXEDDB_CACHE_V1 = WFT_LAZY_PORTFOLIO_LOAD_V1 = true; await WftStorage.init();
        await WftIndexedDb.put('studentPortfolios', { studentId: 'id-Alice', cachedAt: '2020-01-01T00:00:00Z', data: { studentId: 'id-Alice', sessions: [{ id: 'cache', originalText: 'Older cached view.' }] } });
        driveAccessToken = wftSyncState.accessToken = 'synthetic'; driveFolderId = wftSyncState.folderId = 'root-folder'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
        localStorage.setItem('wft_drive_students_folder_id', 'students-folder');
        let count = 0;
        const immediate = await new Promise(resolve => loadStudentPortfolioLazy('id-Alice', 'Alice', (error, data) => { count++; resolve({ error: error && error.message, data }); }));
        for (let i = 0; i < 200 && localStorage.getItem('wft_drive_student_file_id-Alice') !== 'saved-file'; i++) await new Promise(resolve => setTimeout(resolve, 10));
        return { immediate, count, refreshed: await WftStorage.getStudentPortfolio('id-Alice'), acknowledged: localStorage.getItem('wft_drive_student_file_id-Alice'), primary: localStorage.getItem('wft_portfolio') === optionalBefore };
    }, (r, requests) => {
        assert.ok(!r.immediate.error); assert.equal(r.immediate.data.sessions[0].id, 'cache'); assert.equal(r.count, 1);
        assert.equal(r.refreshed.data.studentId, 'id-Alice'); assert.equal(r.refreshed.data.sessions[0].id, 'remote'); assert.equal(r.acknowledged, 'saved-file'); assert.equal(r.primary, true);
        assert.equal(requests.filter(req => req.url.includes('alt=media')).length, 2);
        const uploads = requests.filter(req => req.url.includes('/upload/')); assert.equal(uploads.length, 1); assert.ok(uploads[0].body.includes('Remote protected writing.')); assert.ok(uploads[0].body.includes('id-Alice'));
    });
    for (const bypass of ['safe', 'disabled']) await run('existing-cache-facade-bypass-' + bypass, async bypass => {
        WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init();
        await WftStorage.setMetadata('keep', 'old'); await WftStorage.savePortfolioIndex({ keep: true }); await WftStorage.saveStudentPortfolio('id-Alice', { sessions: [{ id: 'keep' }] });
        if (bypass === 'safe') enterWftStorageSafeMode('synthetic'); else WFT_INDEXEDDB_CACHE_V1 = false;
        const reads = [await WftStorage.getMetadata('keep'), await WftStorage.getPortfolioIndex(), await WftStorage.getStudentPortfolio('id-Alice')];
        await WftStorage.setMetadata('keep', 'new'); await WftStorage.savePortfolioIndex({ keep: false }); await WftStorage.saveStudentPortfolio('id-Alice', { sessions: [] });
        return { reads, metadata: await WftIndexedDb.get('metadata', 'keep'), index: await WftIndexedDb.get('portfolioIndex', 'current'), student: await WftIndexedDb.get('studentPortfolios', 'id-Alice') };
    }, r => { assert.deepEqual(r.reads, [null, null, null]); assert.equal(r.metadata.value, 'old'); assert.equal(r.index.data.keep, true); assert.equal(r.student.data.sessions[0].id, 'keep'); }, bypass);
    await run('lazy-safe-mode-bypasses-existing-cache-and-cloud', async () => {
        WFT_INDEXEDDB_CACHE_V1 = WFT_LAZY_PORTFOLIO_LOAD_V1 = true; await WftStorage.init();
        await WftStorage.saveStudentPortfolio('id-Alice', { studentId: 'id-Alice', sessions: [{ id: 'cache', originalText: 'Old cache' }] });
        enterWftStorageSafeMode('synthetic');
        driveAccessToken = wftSyncState.accessToken = 'synthetic'; driveFolderId = wftSyncState.folderId = 'root-folder'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
        localStorage.setItem('wft_drive_students_folder_id', 'students-folder');
        const loaded = await new Promise(resolve => loadStudentPortfolioLazy('id-Alice', 'Alice', (e, data) => resolve({ error: e && e.message, data })));
        driveAccessToken = wftSyncState.accessToken = '';
        saveStudentSession('Alice', { id: 'safe-save', originalText: 'Safe writing' });
        await new Promise(resolve => setTimeout(resolve, 30));
        return { loaded, cache: await WftIndexedDb.get('studentPortfolios', 'Alice'), primary: getLocalPortfolioSnapshot().Alice };
    }, (r, requests) => { assert.equal(r.loaded.data.sessions[0].id, 'alice'); assert.equal(r.cache, undefined); assert.equal(requests.length, 0); assert.ok(r.primary.sessions.some(s => s.id === 'safe-save')); });
    for (const remote of ['valid', 'error', 'missing', 'corrupt', 'wrong-id', 'missing-id', 'invalid']) for (const local of [true, false]) await run('lazy-remote-' + remote + '-local-' + local, async local => {
        WFT_LAZY_PORTFOLIO_LOAD_V1 = WFT_INDEXEDDB_CACHE_V1 = true; await WftStorage.init();
        driveAccessToken = wftSyncState.accessToken = 'synthetic'; driveFolderId = wftSyncState.folderId = 'root-folder'; wftSyncState.tokenExpiresAt = Date.now() + 600000;
        localStorage.setItem('wft_drive_students_folder_id', 'students-folder');
        if (!local) localStorage.setItem('wft_portfolio', '{}');
        const before = localStorage.getItem('wft_portfolio');
        const result = await new Promise(resolve => loadStudentPortfolioLazy('id-Alice', 'Alice', (error, data) => resolve({ error: error && error.message, data })));
        await new Promise(resolve => setTimeout(resolve, 30));
        return { result, cached: await WftStorage.getStudentPortfolio('id-Alice'), primary: localStorage.getItem('wft_portfolio') === before };
    }, r => {
        assert.equal(r.primary, true);
        if (remote === 'valid') { assert.ok(!r.result.error); assert.equal(r.result.data.sessions[0].id, 'remote'); assert.equal(r.cached.data.studentId, 'id-Alice'); }
        else { assert.ok(!r.cached); if (local) { assert.ok(!r.result.error); assert.equal(r.result.data.sessions[0].id, 'alice'); } else { assert.ok(r.result.error, 'Unavailable cloud writing must not become successful empty data'); assert.equal(r.result.data, null); } }
    }, local, remote);
    await run('lazy-corrupt-primary-refuses-empty-fallback', async () => {
        WFT_LAZY_PORTFOLIO_LOAD_V1 = true; WFT_SPLIT_STUDENT_FILES_V1 = false;
        localStorage.setItem('wft_portfolio', '{protected damaged bytes');
        const result = await new Promise(resolve => loadStudentPortfolioLazy('id-Alice', 'Alice', (error, data) => resolve({ error: error && error.message, data })));
        return { result, bytes: localStorage.getItem('wft_portfolio') };
    }, r => { assert.ok(r.result.error); assert.equal(r.result.data, null); assert.equal(r.bytes, '{protected damaged bytes'); });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        async function run(name, exercise, verify, arg, remote = 'valid') {
            const page = await browser.newPage(), errors = [], requests = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.route('**/*', route => {
                const req = route.request(), url = new URL(req.url());
                const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: typeof data === 'string' ? data : JSON.stringify(data) });
                if (url.origin === 'http://127.0.0.1:8765') {
                    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : reply('', 404);
                }
                if (url.origin !== 'https://www.googleapis.com') return route.abort();
                if (req.method() === 'OPTIONS') return reply('', 204);
                requests.push({ url: url.href, method: req.method(), body: req.postData() });
                if (url.searchParams.get('alt') === 'media') {
                    if (remote === 'error') return reply({ error: { message: 'Synthetic read failure' } }, 503);
                    if (remote === 'corrupt') return reply('{invalid');
                    if (remote === 'invalid') return reply({ format: 'student-portfolio-v1', studentId: 'id-Alice', sessions: 'invalid' });
                    return reply({ format: 'student-portfolio-v1', studentId: remote === 'missing-id' ? undefined : remote === 'wrong-id' ? 'id-Bob' : 'id-Alice', displayName: 'Alice', updatedAt: '2099-01-01T00:00:00Z', sessions: [{ id: 'remote', originalText: 'Remote protected writing.' }] });
                }
                if (url.searchParams.has('q')) {
                    assert.ok(url.searchParams.get('q').includes("name='student-id-Alice.json'"));
                    return reply({ files: remote === 'missing' ? [] : [{ id: 'student-file' }] });
                }
                if (url.pathname.endsWith('/root-folder')) return reply({ id: 'root-folder', name: 'WritingFeedbackTool', mimeType: 'application/vnd.google-apps.folder', trashed: false });
                if (req.method() === 'GET') return reply({ id: 'students-folder', name: 'students', mimeType: 'application/vnd.google-apps.folder', parents: ['root-folder'], trashed: false });
                return reply({ id: 'saved-file' });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(() => {
                stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); pendingPortfolioSync = null;
                wftSuppressDirtyMarks = true; students = ['Alice', 'Bob']; selectedStudent = 'Alice';
                localStorage.setItem('wft_settings', JSON.stringify({ students, studentIdMap: { Alice: 'id-Alice', Bob: 'id-Bob' }, studentRecords: [{ studentId: 'id-Alice', displayName: 'Alice' }, { studentId: 'id-Bob', displayName: 'Bob' }] }));
                localStorage.setItem('wft_students', JSON.stringify(students));
                localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'alice', title: 'ALICE_ONLY', originalText: 'Alice protected writing.', createdAt: '2026-01-01' }] }, Bob: { sessions: [{ id: 'bob', title: 'BOB_ONLY', originalText: 'Bob protected writing.', createdAt: '2026-01-02' }] } }));
                refreshPortfolioDropdown();
                globalThis.optionalBefore = localStorage.getItem('wft_portfolio');
                globalThis.optionalFlags = { async: WFT_ASYNC_PORTFOLIO_ACCESS_V1, identity: WFT_STUDENT_ID_MAP_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, idb: WFT_INDEXEDDB_CACHE_V1, compaction: WFT_TOMBSTONE_COMPACTION_V1 };
            });
            let observed;
            try {
                observed = JSON.parse(await page.evaluate(async ({ source, arg }) => JSON.stringify(await eval('(' + source + ')')(arg)), { source: exercise.toString(), arg }));
                assert.deepEqual(await page.evaluate(() => optionalFlags), { async: false, identity: false, lazy: false, idb: false, compaction: false });
                verify(observed, requests); assert.deepEqual(errors, []);
                cases.push({ name, passed: true, observed, requests });
            } catch (e) { cases.push({ name, passed: false, error: e.message, observed, requests, pageErrors: errors }); }
            await page.close();
        }
        await runNativeStorageScenarios(run);
        await runAsyncPortfolioScenarios(run);
        await runDropdownScenarios(run);
        await runLazyPortfolioScenarios(run);
    } finally { await browser.close(); }
    const summary = { suite: 'optional-storage.browser', cases: cases.length, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).map(c => ({ name: c.name, error: c.error })) };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ ...summary, evidence: cases }, null, 2));
    console.log(JSON.stringify(summary, null, 2)); assert.equal(summary.failed.length, 0);
})().catch(e => { console.error(e); process.exitCode = 1; });
