const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const cases = [];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            stopWftSyncPolling(); stopDriveAutoSync();
            globalThis.integrityDownload = downloadWftJsonFilePromise;
            globalThis.integrityIndexSync = syncWftPortfolioIndexIfNeeded;
            globalThis.setupIntegrity = () => {
                localStorage.clear(); wftStudentChangeRecovery = null; wftSuppressDirtyMarks = false;
                WFT_TOMBSTONE_COMPACTION_V1 = false; WFT_STUDENT_ID_MAP_V1 = false;
                WFT_LAMPORT_V1 = false;
                downloadWftJsonFilePromise = integrityDownload;
                syncWftPortfolioIndexIfNeeded = integrityIndexSync;
                wftSyncState.isSyncing = false; wftSyncState.needsSyncAfterCurrent = false; wftSyncState.currentSyncPromise = null;
                localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 's', createdAt: '2026-10-01', originalText: 'Synthetic saved writing' }] } }));
                localStorage.setItem('wft_students', '["Alice","Bob"]');
                localStorage.setItem('wft_settings', JSON.stringify({ students: ['Alice', 'Bob'], targetWordCount: '200', unknown: { keep: true }, studentIdMap: { Alice: 'id-alice' } }));
                localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify({ deletedStudents: { 'student:earlier': { deletedAt: '2026-10-01' } }, records: [], unknown: { keep: true } }));
                students = ['Alice', 'Bob']; selectedStudent = 'Alice'; localStorage.setItem('wft_selectedStudent', 'Alice');
                renderStudentList(); populateStudentDropdown(); document.getElementById('studentNameInput').value = 'Carol';
                wftConfirm = async () => true; wftTextInput = async () => 'Alicia';
                globalThis.integrityCalls = { schedules: 0, requests: 0, alerts: [] };
                window.alert = message => integrityCalls.alerts.push(message);
                scheduleWftCloudSync = scheduleWftDriveSync = flushWftCloudSyncNow = () => integrityCalls.schedules++;
                driveAccessToken = 'synthetic-token';
                ensureDriveFolder = callback => callback('synthetic-folder');
                ensureDriveFolderPromise = async () => 'synthetic-folder';
                findWftFilesByNamePromise = async () => [];
                findWftFilesByNameInFolderPromise = async () => [];
                wftDriveFetch = async () => { integrityCalls.requests++; return { json: async () => ({ id: 'synthetic-file' }) }; };
                wftSyncState.localSettingsCounter = wftSyncState.localDeletionsCounter = wftSyncState.localPortfolioCounter = 1;
                wftSyncState.pendingSettingsPush = wftSyncState.pendingDeletionsPush = wftSyncState.pendingPortfolioPush = true;
                wftSyncState.lastSyncedSettingsHash = wftSyncState.lastSyncedDeletionsHash = wftSyncState.lastSyncedPortfolioHash = 'previous';
                wftSyncState.lastSyncedSettingsCounter = wftSyncState.lastSyncedDeletionsCounter = wftSyncState.lastSyncedPortfolioCounter = 0;
                pendingPortfolioSync = { studentName: 'Alice', sessionData: { id: 'pending', originalText: 'Synthetic pending writing' }, signature: 'pending-signature' };
                persistPendingPortfolioSync(); lastSyncedPortfolioSessionSignature = 'previous-signature';
            };
            globalThis.integritySnapshot = () => ({ bytes: Object.fromEntries(['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY].map(key => [key, localStorage.getItem(key)])), students: students.slice(), selected: selectedStudent, ui: document.getElementById('studentSelect').value, target: document.getElementById('targetWordCount').value, counters: [wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter, wftSyncState.localPortfolioCounter], pending: [wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush, wftSyncState.pendingPortfolioPush], hashes: [wftSyncState.lastSyncedSettingsHash, wftSyncState.lastSyncedDeletionsHash, wftSyncState.lastSyncedPortfolioHash], acknowledgedCounters: [wftSyncState.lastSyncedSettingsCounter, wftSyncState.lastSyncedDeletionsCounter, wftSyncState.lastSyncedPortfolioCounter], signature: lastSyncedPortfolioSessionSignature });
            globalThis.invokeIntegrity = async action => {
                if (action === 'save') return saveStudentSession('Alice', { id: 'new', originalText: 'Synthetic new writing' });
                if (action === 'pending') return commitPendingPortfolioSync();
                if (action === 'add') return addStudent();
                if (action === 'import') { importStudents({ target: { files: [new File(['Carol\nDavid'], 'synthetic.txt')], value: 'synthetic' } }); await new Promise(resolve => setTimeout(resolve, 30)); return; }
                if (action === 'rename') return renameStudent('Alice');
                if (action === 'remove') return removeStudent('Alice');
                if (action === 'session') return deletePortfolioSession('Alice', 's');
                if (action === 'reset') return resetCurrentClassData();
                if (action === 'clear') return clearAllStudents();
                if (action === 'record') return recordStudentDeletion('Carol');
                if (action === 'restore') return restoreStudentDeletion('Earlier');
                if (action === 'recordSession') return recordSessionDeletion('Alice', 's');
                if (action === 'extended') return recordExtendedDeletion('session', 'id-alice', 's');
                if (action === 'preferences') return saveSettingsToLocalStorage();
                if (action === 'roster') return saveStudents();
                if (action === 'localSettings') return saveSettingsLocalOnly({ targetWordCount: '100', students: ['Cloud'] });
                if (action === 'localDeletions') return saveDeletionsLocalOnly({ records: [] });
                if (action === 'loadedSettings') return applyLoadedSettings({ targetWordCount: '100', students: ['Cloud'] });
                if (action === 'hide') return saveWftLocalSnapshotsBeforeHide();
                if (action === 'visibility') { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return; }
                if (action === 'unload') { window.dispatchEvent(new Event('beforeunload')); return; }
                if (action === 'syncSettings') return syncWftSettingsIfNeeded('test');
                if (action === 'syncDeletions') return syncWftDeletionsIfNeeded('test');
                if (action === 'syncPortfolio') return syncWftPortfolioIfNeeded('test');
                if (action === 'syncNow') return syncWftNow('test', { immediate: true });
                if (action === 'legacyPush') return new Promise(resolve => saveFileToDrive('wft-settings.json', '{}', 'application/json', error => resolve({ failed: !!error })));
                if (action === 'splitPush') return saveJsonToDriveFolderPromise('student-id-alice.json', { sessions: [] }, 'synthetic-folder');
            };
        });
        const actions = ['save', 'pending', 'add', 'import', 'rename', 'remove', 'session', 'reset', 'clear', 'record', 'restore', 'recordSession', 'extended', 'preferences', 'roster', 'localSettings', 'localDeletions', 'loadedSettings', 'hide', 'visibility', 'unload', 'syncSettings', 'syncDeletions', 'syncPortfolio', 'syncNow', 'legacyPush', 'splitPush'];
        for (const key of ['wft_settings', 'wft_students', 'wft_deletions']) {
            const invalid = ['{broken', '', '{"truncated":', 'null', '42', key === 'wft_students' ? '{}' : '[]', ...(key === 'wft_deletions' ? ['{"deletedSessions":[]}', '{"records":{}}', '{"deletedStudents":null}'] : [])];
            for (const raw of [...invalid, 'READ_FAILURE']) for (const action of actions) {
                const name = `${key}/${JSON.stringify(raw)}/${action}`;
                const observed = await page.evaluate(async ({ key, raw, action }) => {
                    setupIntegrity();
                    if (raw !== 'READ_FAILURE') localStorage.setItem(key, raw);
                    const before = integritySnapshot(), getItem = Storage.prototype.getItem;
                    if (raw === 'READ_FAILURE') Storage.prototype.getItem = function(name) { if (name === key) throw new DOMException('Synthetic read failure', 'SecurityError'); return getItem.call(this, name); };
                    let error, returned;
                    try { returned = await invokeIntegrity(action); } catch (e) { error = e.message; }
                    finally { Storage.prototype.getItem = getItem; }
                    return { before, after: integritySnapshot(), calls: integrityCalls, error, returned };
                }, { key, raw, action });
                try {
                    assert.deepEqual(observed.after, observed.before, 'Required failure preserves original bytes, memory, UI and sync acknowledgement');
                    assert.equal(observed.calls.schedules, 0, 'No success scheduling');
                    assert.equal(observed.calls.requests, 0, 'No outgoing write');
                    if (!['hide', 'visibility', 'unload'].includes(action)) assert.ok(observed.error || observed.returned === false || observed.returned?.failed || observed.calls.alerts.some(text => /could not/i.test(text)), 'Failure reported');
                    cases.push({ name, pass: true });
                } catch (error) { cases.push({ name, pass: false, error: error.message, observed }); }
            }
        }
        for (const key of ['wft_settings', 'wft_students', 'wft_deletions']) for (const stream of ['Settings', 'Deletions', 'Portfolio']) for (const stage of ['download', 'upload-response']) {
            const name = `delayed/${stream}/${stage}/${key}`;
            const result = await page.evaluate(async ({ key, stream, stage }) => {
                setupIntegrity();
                let entered, release;
                const started = new Promise(resolve => entered = resolve), gate = new Promise(resolve => release = resolve);
                findWftFilesByNamePromise = async () => stage === 'download' ? [{ id: 'synthetic-file' }] : [];
                if (stage === 'download') downloadWftJsonFilePromise = async () => {
                    entered(); await gate;
                    return stream === 'Settings' ? { students: ['Cloud'], targetWordCount: '100' } : stream === 'Deletions' ? { records: [{ id: 'cloud', sessionId: 'cloud', deletedAt: '2026-10-01' }] } : { Cloud: { sessions: [{ id: 'cloud', createdAt: '2026-10-01' }] } };
                };
                else wftDriveFetch = async () => { integrityCalls.requests++; entered(); await gate; return { json: async () => ({ id: 'synthetic-file' }) }; };
                const run = globalThis['syncWft' + stream + 'IfNeeded']('test').then(value => ({ value }), error => ({ error: error.message }));
                await started;
                localStorage.setItem(key, '{damaged while IO waited');
                const before = integritySnapshot(); release();
                const completion = await run;
                return { before, after: integritySnapshot(), calls: integrityCalls, completion };
            }, { key, stream, stage });
            try {
                assert.deepEqual(result.after, result.before); assert.ok(result.completion.error, 'Failed reads prevent acknowledgement');
                assert.equal(result.calls.requests, stage === 'download' ? 0 : 1, 'No outgoing write after failed read');
                cases.push({ name, pass: true });
            } catch (error) { cases.push({ name, pass: false, error: error.message, result }); }
        }
        for (const stream of ['Settings', 'Deletions']) for (const raw of ['', '{broken', '{"truncated":', 'null', '42', '[]']) {
            const name = `cloud-required/${stream}/${JSON.stringify(raw)}`;
            const result = await page.evaluate(async ({ stream, raw }) => {
                setupIntegrity(); findWftFilesByNamePromise = async () => [{ id: 'synthetic-file' }];
                wftDriveFetch = async (url, options) => { if (options?.method) integrityCalls.requests++; return { text: async () => raw, json: async () => ({ id: 'synthetic-file' }) }; };
                const before = integritySnapshot(); let error;
                try { await globalThis['syncWft' + stream + 'IfNeeded']('test'); } catch (e) { error = e.message; }
                return { before, after: integritySnapshot(), error, calls: integrityCalls };
            }, { stream, raw });
            try {
                assert.deepEqual(result.after, result.before); assert.ok(result.error); assert.equal(result.calls.requests, 0);
                cases.push({ name, pass: true });
            } catch (error) { cases.push({ name, pass: false, error: error.message, result }); }
        }
        for (const key of ['wft_settings', 'wft_students', 'wft_deletions']) {
            const result = await page.evaluate(async key => {
                setupIntegrity(); let entered, release;
                const started = new Promise(resolve => entered = resolve), gate = new Promise(resolve => release = resolve);
                syncWftPortfolioIndexIfNeeded = async () => { entered(); await gate; return false; };
                const run = syncWftNow('test', { immediate: true });
                await started; localStorage.setItem(key, '{damaged at final sync step');
                const before = integritySnapshot(), lastPoll = wftSyncState.lastPollAt;
                release(); const returned = await run;
                return { before, after: integritySnapshot(), lastPollKept: lastPoll === wftSyncState.lastPollAt, returned };
            }, key);
            cases.push({ name: `syncWftNow/final-ack/${key}`, pass: JSON.stringify(result.before) === JSON.stringify(result.after) && result.lastPollKept && result.returned === false, result });
        }
        const loadedRoster = await page.evaluate(() => {
            setupIntegrity(); localStorage.setItem('wft_students', '{broken roster'); loadStudents();
            const before = integritySnapshot(); addStudent();
            return { before, after: integritySnapshot(), calls: integrityCalls };
        });
        cases.push({ name: 'actual-loadStudents-then-add', pass: JSON.stringify(loadedRoster.before) === JSON.stringify(loadedRoster.after) && loadedRoster.calls.schedules === 0, result: loadedRoster });
        for (const action of ['save', 'pending', 'add', 'preferences', 'loadedSettings', 'hide', 'syncSettings', 'syncDeletions', 'syncPortfolio']) {
            const result = await page.evaluate(async action => {
                setupIntegrity(); const before = integritySnapshot(), normalize = normalizeDeletionsData;
                normalizeDeletionsData = () => { throw new Error('Synthetic normalization failure'); };
                let error, returned;
                try { returned = await invokeIntegrity(action); } catch (e) { error = e.message; }
                finally { normalizeDeletionsData = normalize; }
                return { before, after: integritySnapshot(), calls: integrityCalls, error, returned };
            }, action);
            cases.push({ name: `normalization-failure/${action}`, pass: JSON.stringify(result.after) === JSON.stringify(result.before) && result.calls.schedules === 0 && result.calls.requests === 0, result });
        }
        // Actual helpers: chronology, identity, legacy key-only entries and restore policy.
        const policy = await page.evaluate(() => {
            setupIntegrity(); const out = [], day = '2026-10-10T00:00:00Z', older = '2026-10-09T00:00:00Z', newer = '2026-10-11T00:00:00Z';
            const check = (name, actual, expected) => out.push({ name, actual, expected });
            const record = extra => ({ id: 'r', type: 'session', sessionId: 's', studentId: 'alice', deletedAt: day, ...extra });
            for (const [label, extra, updated, clock, expected] of [
                ['newer-delete', {}, older, null, true], ['equal-session', {}, day, null, false], ['newer-session', {}, newer, null, false], ['missing-session-time', {}, null, null, true], ['invalid-deletion-time', { deletedAt: 'invalid' }, older, null, false], ['wrong-student', { studentId: 'bob' }, older, null, false], ['wrong-session', { sessionId: 'other' }, older, null, false], ['student-record', { type: 'student' }, older, null, false], ['archive-record', { type: 'archive-remove' }, older, null, true],
                ['clock-newer-delete', { lamportClock: 5 }, newer, 4, true], ['clock-equal-session', { lamportClock: 5 }, older, 5, false], ['clock-newer-session', { lamportClock: 5 }, older, 6, false], ['clock-missing-session', { lamportClock: 5 }, newer, null, true], ['clock-missing-delete', {}, older, 99, true], ['clock-invalid-delete', { lamportClock: NaN }, older, 99, true]
            ]) {
                WFT_LAMPORT_V1 = label.startsWith('clock-');
                check(`existing-policy/${label}`, isStudentSessionDeleted('s', 'alice', { records: [record(extra)] }, updated, clock), expected);
            }
            WFT_LAMPORT_V1 = false;
            for (const [label, deleted, restored, expected] of [['absent-delete', undefined, undefined, false], ['delete-without-restore', day, undefined, true], ['older-restore', day, older, true], ['equal-restore', day, day, false], ['newer-restore', day, newer, false], ['valid-restore-invalid-delete', 'invalid', day, false], ['invalid-restore-valid-delete', day, 'invalid', true]]) {
                const key = getDeletedStudentKey('Alice');
                check(`existing-policy/${label}`, isStudentDeletedByTombstone('Alice', { deletedStudents: deleted === undefined ? {} : { [key]: { deletedAt: deleted } }, restoredStudents: restored === undefined ? {} : { [key]: { restoredAt: restored } } }), expected);
            }
            for (const form of ['record', 'legacy', 'both', 'keyOnly']) for (const [updatedAt, survives] of [[older, false], [day, true], [newer, true]]) {
                const r = { id: 'd', type: 'session', sessionId: 's', studentId: 'id-alice', studentName: 'Alice', deletedAt: day };
                const d = { records: form === 'record' || form === 'both' ? [r] : [], deletedSessions: form === 'record' ? {} : { 'session:alice:s': form === 'keyOnly' ? { deletedAt: day } : r } };
                const filtered = applyDeletionsToPortfolio({ Alice: { studentId: 'id-alice', sessions: [{ id: 's', updatedAt }] } }, d);
                check(`${form}/time/${updatedAt}`, filtered.Alice.sessions.length === 1, survives);
                if (form !== 'keyOnly') check(`${form}/split/${updatedAt}`, !isStudentSessionDeleted('s', 'id-alice', d, updatedAt), survives);
                const file = { format: 'student-portfolio-v1', studentId: 'id-alice', displayName: 'Alice', sessions: [{ id: 's', updatedAt }] };
                check(`${form}/split-file/${updatedAt}`, applyDeletionsToFile(file, d).sessions.length === 1, survives);
                check(`${form}/split-merge/${updatedAt}`, mergeStudentPortfolioFiles(file, { ...file, sessions: [] }, d).sessions.length === 1, survives);
            }
            WFT_LAMPORT_V1 = true;
            for (const [clock, survives] of [[4, false], [5, true], [6, true], [undefined, false]]) {
                const d = { records: [{ type: 'session', sessionId: 's', studentId: 'id-alice', deletedAt: day, lamportClock: 5 }] };
                check(`lamport/${clock}`, applyDeletionsToPortfolio({ Alice: { studentId: 'id-alice', sessions: [{ id: 's', updatedAt: newer, lamportClock: clock }] } }, d).Alice.sessions.length === 1, survives);
            }
            WFT_LAMPORT_V1 = false;
            for (const [label, extra, expected] of [['wrong-student-id', { studentId: 'id-bob' }, true], ['wrong-name', { studentName: 'Bob' }, true], ['wrong-session', { sessionId: 'other' }, true], ['invalid-date', { deletedAt: 'invalid' }, true], ['student-type', { type: 'student' }, true], ['archive', { type: 'archive-remove' }, false]]) {
                const d = { records: [{ type: 'session', sessionId: 's', studentName: 'Alice', deletedAt: day, ...extra }] };
                check(label, applyDeletionsToPortfolio({ Alice: { studentId: 'id-alice', sessions: [{ id: 's', updatedAt: older }] } }, d).Alice.sessions.length === 1, expected);
            }
            for (const [key, record] of [['session:bob:s', { sessionId: 's', deletedAt: day }], ['session:id-bob:s', { deletedAt: day }]]) {
                check(`wrong-legacy-owner/${key}`, applyDeletionsToPortfolio({ Alice: { sessions: [{ id: 's', updatedAt: older }] } }, { deletedSessions: { [key]: record } }).Alice.sessions.length, 1);
            }
            localStorage.setItem('wft_settings', '{}');
            for (const [studentId, expected] of [['source-id', 0], ['other-id', 1]]) {
                const d = { records: [{ type: 'session', sessionId: 's', studentId, deletedAt: day }] };
                check(`source-student-id/${studentId}`, applyDeletionsToPortfolio({ Alice: { studentId: 'source-id', sessions: [{ id: 's', updatedAt: older }] } }, d).Alice.sessions.length, expected);
            }
            const metadata = mergeWftDeletions({ unknown: { keep: true }, deletionLog: [{ id: 'local-log' }] }, { cloudOnly: { keep: true }, records: [] });
            check('merge-preserves-unknown-metadata', metadata.unknown?.keep === true && metadata.cloudOnly?.keep === true && metadata.deletionLog?.[0].id === 'local-log', true);
            for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
                const d = { deletedSessions: { [getDeletedSessionKey(name, 'constructor')]: { deletedAt: day } } };
                const filtered = applyDeletionsToPortfolio({ [name]: { sessions: [{ id: 'constructor', updatedAt: newer }] } }, d);
                check(`own-name/${name}`, filtered[name].sessions.length, 1);
            }
            for (const [restore, survives] of [[older, false], [day, true], [newer, true]]) {
                const key = getDeletedStudentKey('Alice');
                check(`student-restore/${restore}`, !!applyDeletionsToPortfolio({ Alice: { sessions: [{ id: 's' }] } }, { deletedStudents: { [key]: { deletedAt: day } }, restoredStudents: { [key]: { restoredAt: restore } } }).Alice, survives);
            }
            return out;
        });
        for (const item of policy) cases.push({ name: item.name, pass: item.actual === item.expected, ...item });
        for (const enabled of [false, true]) {
            const result = await page.evaluate(enabled => {
                setupIntegrity(); WFT_TOMBSTONE_COMPACTION_V1 = enabled;
                const now = Date.now(), day = 86400000, stamp = age => new Date(now - age).toISOString();
                const source = { schemaVersion: 1, unknown: { keep: true }, deletedStudents: { keep: { deletedAt: stamp(100 * day) } }, restoredStudents: { keep: { restoredAt: stamp(100 * day) } }, records: [{ id: 'old', deletedAt: stamp(91 * day) }, { id: 'boundary', deletedAt: stamp(90 * day) }, { id: 'recent', deletedAt: stamp(89 * day) }, { id: 'invalid', deletedAt: 'invalid' }, { id: 'missing' }], deletedSessions: { old: { deletedAt: stamp(91 * day) }, recent: { deletedAt: stamp(89 * day) } }, deletionLog: Array.from({ length: 205 }, (_, id) => ({ id, deletedAt: stamp(day) })) };
                const before = JSON.stringify(source); let error;
                try {
                    const clean = normalizeDeletionsData(source), again = compactDeletions(clean);
                    delete clean.updatedAt; delete again.updatedAt;
                    return { sourceKept: JSON.stringify(source) === before, ids: clean.records.map(r => r.id), legacy: Object.keys(clean.deletedSessions), logs: clean.deletionLog.map(r => r.id), unknown: clean.unknown, studentsKept: !!clean.deletedStudents.keep && !!clean.restoredStudents.keep, idempotent: JSON.stringify(clean) === JSON.stringify(again) };
                } catch (e) { error = e.message; return { error }; }
            }, enabled);
            try {
                assert.equal(result.sourceKept, true); assert.equal(result.idempotent, true); assert.equal(result.studentsKept, true); assert.deepEqual(result.unknown, { keep: true });
                assert.deepEqual(result.ids, enabled ? ['recent', 'invalid', 'missing'] : ['old', 'boundary', 'recent', 'invalid', 'missing']);
                assert.deepEqual(result.legacy, enabled ? ['recent'] : ['old', 'recent']); assert.equal(result.logs.length, enabled ? 200 : 205); assert.equal(result.logs[0], enabled ? 5 : 0);
                cases.push({ name: `compaction/${enabled}`, pass: true, result });
            } catch (error) { cases.push({ name: `compaction/${enabled}`, pass: false, error: error.message, result }); }
        }
        const legacy = await page.evaluate(async () => {
            setupIntegrity(); const results = [];
            saveSettingsToLocalStorage(); recordStudentDeletion('Carol');
            results.push(getRawSettings().unknown.keep === true && getDeletionsData().unknown?.keep === true);
            localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{"deletedSessions":{"session:alice:s":{"deletedAt":"2026-10-01"}},"extra":"legacy"}');
            recordStudentDeletion('Carol'); results.push(getDeletionsData().extra === 'legacy');
            for (const key of ['wft_settings', 'wft_students', WFT_DELETIONS_STORAGE_KEY]) localStorage.removeItem(key);
            students = []; selectedStudent = ''; document.getElementById('studentNameInput').value = 'Carol'; addStudent();
            results.push(students.join() === 'Carol');
            WFT_TOMBSTONE_COMPACTION_V1 = true; recordSessionDeletion('Carol', 'old-session');
            results.push(getDeletionsData().records.some(r => r.sessionId === 'old-session'));
            return results;
        }).catch(error => [false, error.message]);
        cases.push({ name: 'legacy/default/unknown-metadata/compaction-write', pass: legacy.every(Boolean), actual: legacy });
        cases.push({ name: 'no-unhandled-browser-errors', pass: errors.length === 0, errors });
        const report = { scope: 'Native Edge, complete exact fixture, synthetic storage and Drive IO; all external network blocked', root, cases, passed: cases.filter(c => c.pass).length, failed: cases.filter(c => !c.pass).length };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(`Storage integrity browser cases: ${report.passed}/${cases.length} passed, ${report.failed} failed.`);
        assert.equal(report.failed, 0, cases.filter(c => !c.pass).map(c => c.name + ': ' + (c.error || JSON.stringify(c.actual))).join('\n'));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
