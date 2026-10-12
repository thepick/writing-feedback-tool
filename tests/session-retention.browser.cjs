const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        const cases = await page.evaluate(() => {
            stopWftSyncPolling(); stopDriveAutoSync();
            scheduleWftCloudSync = scheduleWftDriveSync = () => {};
            alert = () => {};
            const flags = { split: WFT_SPLIT_STUDENT_FILES_V1, id: WFT_STUDENT_ID_MAP_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, idb: WFT_INDEXEDDB_CACHE_V1, compaction: WFT_TOMBSTONE_COMPACTION_V1 };
            const cases = [], copy = value => JSON.parse(JSON.stringify(value));
            const check = (condition, message) => { if (!condition) throw new Error(message); };
            const equal = (a, b, message) => check(JSON.stringify(a) === JSON.stringify(b), message + ': ' + JSON.stringify(a));
            const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
            const normalizer = normalizeWftSessionForStorage, schema = normalizeWftPortfolioForSchemaV1;
            function reset() {
                Storage.prototype.setItem = set; Storage.prototype.removeItem = remove;
                normalizeWftSessionForStorage = normalizer; normalizeWftPortfolioForSchemaV1 = schema;
                localStorage.clear(); pendingPortfolioSync = null; wftStudentChangeRecovery = null;
                wftSuppressDirtyMarks = false; driveAccessToken = '';
                localStorage.setItem('wft_settings', '{}'); localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
                localStorage.setItem('wft_portfolio', '{}');
            }
            function run(name, fn) {
                reset();
                try { const observed = fn(); cases.push({ name, passed: true, observed }); }
                catch (error) { cases.push({ name, passed: false, error: error.message }); }
                finally { Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; normalizeWftSessionForStorage = normalizer; normalizeWftPortfolioForSchemaV1 = schema; }
            }
            const iso = n => new Date(Date.UTC(2026, 0, n)).toISOString();
            function entry(n, style = 'iso') {
                const session = { id: 'essay-' + n, originalText: 'Synthetic writing ' + n, title: 'Writing ' + n,
                    categoryScores: { Grammar: n }, custom: { keep: n }, images: [{ imageId: 'photo-' + n, imageRevision: 'revision-' + n, driveFileId: 'drive-' + n, dataUrl: '' }] };
                if (style === 'iso') session.createdAt = iso(n);
                if (style === 'legacy') {
                    if (n % 3 === 0) session.timestamp = new Date(iso(n)).toUTCString();
                    else if (n % 3 === 1) session.date = iso(n).slice(0, 10);
                    else session.createdAt = new Date(iso(n)).toUTCString();
                }
                if (style === 'tie') session.createdAt = iso(1);
                if (style === 'invalid') { session.createdAt = 'unknown'; session.timestamp = 'bad'; session.date = 'Unknown date'; }
                return session;
            }
            function prepare(count, style, student = 'Alice', raw = false) {
                const sessions = Array.from({ length: count }, (_, i) => entry(i + 1, style));
                // Reverse part of the seed so chronological selection cannot pass by insertion order.
                if (style === 'iso' || style === 'legacy') sessions.reverse();
                const data = Object.create(null); data[student] = { sessions }; data.Bob = { sessions: [entry(100)] };
                if (raw) localStorage.setItem('wft_portfolio', JSON.stringify(data)); else savePortfolioData(data);
                return getLocalPortfolioSnapshot()[student].sessions;
            }
            function pending(student, session, move) {
                pendingPortfolioSync = { studentName: student, sessionData: session, signature: 'synthetic-retention',
                    ...(move ? { replaceSource: { sourceStudentName: 'Bob', sourceSessionId: 'essay-100' } } : {}) };
                persistPendingPortfolioSync(); return pendingPortfolioSync;
            }
            function commit(mode, student, session) {
                if (mode === 'save') { saveStudentSession(student, session); return true; }
                const staged = pending(student, session, mode.includes('move'));
                return mode === 'move-direct' ? commitPendingPortfolioReplacement(staged) : commitPendingPortfolioSync();
            }
            const byDate = sessions => sessions.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
            run('shipped optional defaults', () => equal(flags, { split: true, id: false, lazy: false, idb: false, compaction: false }, 'flags'));
            for (const mode of ['save', 'pending-add', 'move-direct', 'pending-move']) {
                for (const count of [0, 3, 49, 50, 51, 75]) {
                    for (const older of [false, true]) run(`${mode}: ISO seed ${count}, new date ${older ? 'older' : 'newest'}`, () => {
                        const before = prepare(count, 'iso'), session = entry(older ? -100 : 101); session.id = 'committed-writing';
                        const expected = byDate(before).slice(0, 49);
                        check(commit(mode, 'Alice', session), 'commit succeeded');
                        const raw = JSON.parse(localStorage.getItem('wft_portfolio')), after = raw.Alice.sessions;
                        equal(after.map(s => s.id), byDate(expected.concat(session)).map(s => s.id), 'exact retained ordered IDs');
                        for (const previous of expected) equal(after.find(s => s.id === previous.id), previous, 'previous bytes preserved');
                        const saved = after.find(s => s.id === session.id);
                        check(saved.originalText === session.originalText && saved.custom.keep === session.custom.keep, 'new writing bytes and metadata');
                        equal(saved.images, session.images.map(image => ({ ...image, dataUrlRemovedForStorage: true, pendingDriveUpload: false })), 'new photo references');
                        if (mode.includes('move')) { equal(raw.Bob.sessions, [], 'source removed'); check(getDeletionsData().deletedSessions['session:bob:essay-100'].sessionId === 'essay-100', 'source marker'); }
                        if (mode.startsWith('pending')) check(getPendingPortfolioSync() === null && !localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), 'pending cleared only on success');
                        const index = buildPortfolioIndexFromPortfolio(raw).students.Alice;
                        equal(index.latestSessionAt, after[0].createdAt, 'index latest agrees with newest session');
                        return { count: after.length, latest: after[0].id, dropped: before.filter(s => !after.some(a => a.id === s.id)).map(s => s.id) };
                    });
                }
                for (const style of ['legacy', 'tie', 'absent', 'invalid']) run(`${mode}: ${style} dates at cap`, () => {
                    const before = prepare(55, style, 'Alice', style === 'absent' || style === 'invalid');
                    const session = entry(101); session.id = 'new';
                    check(commit(mode, 'Alice', session), 'commit');
                    const after = getLocalPortfolioSnapshot().Alice.sessions;
                    const expectedIds = (style === 'legacy' ? Array.from({ length: 49 }, (_, i) => 'essay-' + (55 - i)) : before.slice(0, 49).map(s => s.id));
                    equal(after.filter(s => s.id !== 'new').map(s => s.id), expectedIds, 'legacy chronology / stable undated or equal fallback');
                    check(after.some(s => s.id === 'new'), 'new writing retained');
                    for (const kept of after.filter(s => s.id !== 'new')) { const old = before.find(s => s.id === kept.id); equal(kept.custom, old.custom, 'metadata'); for (const key of ['imageId', 'imageRevision', 'driveFileId']) equal(kept.images[0][key], old.images[0][key], 'photo ' + key); check(kept.originalText === old.originalText, 'writing'); }
                    check(byDate(after).every((s, i) => s.id === after[i].id), 'newest first');
                    equal(buildPortfolioIndexFromPortfolio({ Alice: { sessions: after } }).students.Alice.latestSessionAt, after[0].createdAt, 'legacy index latest');
                    return { kept: after.map(s => s.id) };
                });
            }
            for (const student of ['__proto__', 'constructor', 'toString']) {
                for (const mode of ['save', 'pending-move']) run(`${mode}: own student ${student} and own session ID`, () => {
                    const before = prepare(50, 'iso', student), session = entry(101); session.id = student;
                    check(commit(mode, student, session), 'commit');
                    const raw = JSON.parse(localStorage.getItem('wft_portfolio'));
                    check(Object.prototype.hasOwnProperty.call(raw, student), 'own student');
                    equal(raw[student].sessions.map(s => s.id), [student, ...before.slice(0, 49).map(s => s.id)], 'own IDs');
                    check(({}).sessions === undefined, 'prototype intact');
                });
            }
            run('same student replacement keeps identity and place without trimming', () => {
                prepare(55, 'iso'); const before = getLocalPortfolioSnapshot().Alice.sessions;
                const old = before[20], session = copy(old); session.originalText = 'Reassessed writing'; session.images[0].imageRevision = 'reassessed';
                pending('Alice', session, false); pendingPortfolioSync.replaceSource = { sourceStudentName: 'Alice', sourceSessionId: old.id }; persistPendingPortfolioSync();
                check(commitPendingPortfolioSync(), 'commit'); const after = getLocalPortfolioSnapshot().Alice.sessions;
                equal(after.map(s => s.id), before.map(s => s.id), 'same ordered identity positions, no append or cap');
                check(after[20].originalText === session.originalText && after[20].images[0].imageRevision === 'reassessed', 'replacement bytes');
                equal(getDeletionsData().deletedSessions, {}, 'no tombstone for same ID');
            });
            for (const mode of ['pending-add', 'pending-move']) for (const failure of ['portfolio', 'deletions', 'pending-clear', 'corrupt', 'normalization', 'rollback']) {
                if (mode === 'pending-add' && ['deletions', 'rollback'].includes(failure)) continue;
                run(`${mode}: required ${failure} failure preserves pending and retry`, () => {
                    prepare(50, 'iso'); const session = entry(101); session.id = 'new';
                    const staged = pending('Alice', session, mode === 'pending-move'), before = localStorage.getItem('wft_portfolio'), deletionBefore = localStorage.getItem(WFT_DELETIONS_STORAGE_KEY);
                    const counters = [wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter];
                    let wrotePortfolio = false;
                    if (failure === 'corrupt') localStorage.setItem('wft_portfolio', '{damaged synthetic portfolio');
                    const damaged = localStorage.getItem('wft_portfolio');
                    if (failure === 'normalization') normalizeWftPortfolioForSchemaV1 = () => { throw new Error('Required normalization failed'); };
                    Storage.prototype.setItem = function(key, value) {
                        if (key === 'wft_portfolio' && (failure === 'portfolio' || (failure === 'rollback' && wrotePortfolio))) throw new Error('Synthetic portfolio failure');
                        if (key === WFT_DELETIONS_STORAGE_KEY && ['deletions', 'rollback'].includes(failure)) throw new Error('Synthetic marker failure');
                        const result = set.call(this, key, value); if (key === 'wft_portfolio') wrotePortfolio = true; return result;
                    };
                    Storage.prototype.removeItem = function(key) { if (key === PENDING_PORTFOLIO_SYNC_KEY && failure === 'pending-clear') throw new Error('Synthetic clear failure'); return remove.call(this, key); };
                    check(!commitPendingPortfolioSync(), 'failed commit not acknowledged');
                    check(getPendingPortfolioSync() === staged && !!localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), 'pending writing retained');
                    check(staged.sessionData.originalText === session.originalText && staged.sessionData.images[0].driveFileId === 'drive-101', 'pending bytes');
                    if (failure === 'rollback') check(wftStudentChangeRecovery && wftStudentChangeRecovery.wft_portfolio === before, 'original bytes in recovery');
                    else check(localStorage.getItem('wft_portfolio') === damaged, 'portfolio bytes preserved');
                    check(localStorage.getItem(WFT_DELETIONS_STORAGE_KEY) === deletionBefore, 'markers preserved');
                    if (['portfolio', 'deletions', 'corrupt', 'normalization', 'rollback'].includes(failure)) equal([wftSyncState.localPortfolioCounter, wftSyncState.localDeletionsCounter], counters, 'no failed write publication');
                    Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; normalizeWftPortfolioForSchemaV1 = schema;
                    if (failure === 'rollback') { check(restoreWftStudentChangeStorage(wftStudentChangeRecovery), 'recovery restored'); wftStudentChangeRecovery = null; }
                    if (failure === 'corrupt') localStorage.setItem('wft_portfolio', before);
                    check(commitPendingPortfolioSync(), 'retry succeeds');
                    const after = getLocalPortfolioSnapshot().Alice.sessions;
                    equal(after.map(s => s.id), ['new', ...Array.from({ length: 49 }, (_, i) => 'essay-' + (50 - i))], 'retry keeps exact most recent IDs once');
                    check(!commitPendingPortfolioSync(), 'already committed retry is inert');
                    equal(getLocalPortfolioSnapshot().Alice.sessions, after, 'stable retry bytes');
                });
            }
            run('optional preliminary normalizer catch still reaches required normalizer', () => {
                prepare(50, 'iso'); let calls = 0;
                normalizeWftSessionForStorage = function(...args) { if (++calls === 1) throw new Error('Optional preparation'); return normalizer(...args); };
                saveStudentSession('Alice', entry(101));
                check(calls > 1 && getLocalPortfolioSnapshot().Alice.sessions.some(s => s.id === 'essay-101'), 'required downstream normalization succeeded');
                return { calls, contract: 'Optional preliminary catch is unchanged; the required durable normalization remains authoritative.' };
            });
            for (const failure of ['portfolio', 'corrupt', 'normalization']) run(`ordinary save: required ${failure} failure preserves history`, () => {
                prepare(50, 'iso'); const before = localStorage.getItem('wft_portfolio');
                if (failure === 'corrupt') localStorage.setItem('wft_portfolio', '{damaged synthetic portfolio');
                const damaged = localStorage.getItem('wft_portfolio');
                if (failure === 'normalization') normalizeWftPortfolioForSchemaV1 = () => { throw new Error('Required normalization failed'); };
                Storage.prototype.setItem = function(key, value) { if (failure === 'portfolio' && key === 'wft_portfolio') throw new Error('Synthetic write failure'); return set.call(this, key, value); };
                let failed = false; try { saveStudentSession('Alice', entry(101)); } catch { failed = true; }
                check(failed && localStorage.getItem('wft_portfolio') === damaged, 'required failure throws and preserves raw history');
                Storage.prototype.setItem = set; normalizeWftPortfolioForSchemaV1 = schema;
                if (failure === 'corrupt') localStorage.setItem('wft_portfolio', before);
                saveStudentSession('Alice', entry(101));
                equal(getLocalPortfolioSnapshot().Alice.sessions.map(s => s.id), ['essay-101', ...Array.from({ length: 49 }, (_, i) => 'essay-' + (50 - i))], 'ordinary retry IDs');
            });
            run('new undated ID-less writing keeps assigned ID across failed pending commit', () => {
                prepare(50, 'iso'); const session = { originalText: 'Undated pending writing', custom: { keep: true }, images: [] };
                const staged = pending('Alice', session, false);
                Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio') throw new Error('Synthetic write failure'); return set.call(this, key, value); };
                check(!commitPendingPortfolioSync(), 'failure'); const assignedId = session.id, createdAt = session.createdAt;
                check(assignedId && createdAt && getPendingPortfolioSync() === staged, 'assigned identity held in pending memory');
                Storage.prototype.setItem = set; check(commitPendingPortfolioSync(), 'retry');
                const saved = getLocalPortfolioSnapshot().Alice.sessions.find(s => s.id === assignedId);
                check(saved && saved.createdAt === createdAt && saved.originalText === session.originalText, 'assigned identity/date/writing survive retry');
                check(getLocalPortfolioSnapshot().Alice.sessions.length === 50, 'cap');
            });
            for (const mode of ['pending-add', 'pending-move']) run(`${mode}: quota recovery retains latest writing and photo identity`, () => {
                prepare(50, 'iso'); const session = entry(101); session.images[0].dataUrl = 'data:image/png;base64,AAAA';
                let attempts = 0;
                Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio' && ++attempts === 1) throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); return set.call(this, key, value); };
                check(commit(mode, 'Alice', session), 'quota retry committed');
                const after = getLocalPortfolioSnapshot().Alice.sessions;
                equal(after.map(s => s.id), ['essay-101', ...Array.from({ length: 49 }, (_, i) => 'essay-' + (50 - i))], 'quota retention');
                check(attempts === 2 && after[0].originalText === session.originalText, 'actual alternate write used');
                for (const key of ['imageId', 'imageRevision', 'driveFileId']) equal(after[0].images[0][key], session.images[0][key], 'photo ' + key);
                check(after[0].images[0].dataUrl === undefined && after[0].images[0].dataUrlRemovedForStorage, 'existing heavy-field quota fallback');
            });
            reset(); return cases;
        });
        const report = { root, fixture: 'Full app in native Edge; actual durable normalization, ordinary save, staged replacement and pending commit; synthetic records, external requests blocked.', cases, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, pageErrors: errors };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(JSON.stringify({ passed: report.passed, failed: report.failed, failures: cases.filter(c => !c.passed) }, null, 2));
        assert.deepEqual(errors, []); assert.equal(report.failed, 0);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
