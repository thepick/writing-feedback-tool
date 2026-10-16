const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const cases = [];

async function runStudentIdentityCases(run) {
        for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'Alice']) {
            await run('main-merge-local-only-student-' + name, name => {
                const local = Object.fromEntries([[name, { sessions: [{ id: '__proto__', originalText: 'Keep', images: [] }] }]]);
                const merged = mergeWftPortfolios(local, { Bob: { sessions: [] } });
                return { merged, sharedMutation: Object.hasOwn(Object, 'sessions') || Object.hasOwn(Object.prototype, 'sessions') };
            }, r => { assert.ok(Object.hasOwn(r.merged, name)); assert.equal(r.merged[name].sessions[0].id, '__proto__'); assert.equal(r.sharedMutation, false); }, name);
            await run('main-sync-student-' + name, async name => {
                const session = (id, newer) => ({ id, createdAt: '2026-10-01', updatedAt: newer ? '2026-10-03' : '2026-10-01', originalText: newer ? 'Newer writing' : 'Older writing', images: [] });
                const local = Object.fromEntries([[name, { sessions: [session('__proto__', true), session('local', true)] }]]);
                const cloud = Object.fromEntries([[name, { sessions: [session('__proto__', false), session('constructor', false), session('remote', false)] }]]);
                // The shipped sync uses its real normalization, deletion filtering, merge and strict persistence.
                savePortfolioData(local); const savedBefore = localStorage.getItem('wft_portfolio');
                findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical' }]);
                downloadWftJsonFilePromise = () => Promise.resolve(cloud);
                const uploads = []; uploadWftJsonFilePromise = (filename, data) => { uploads.push(JSON.parse(JSON.stringify(data))); return Promise.resolve('canonical'); };
                await syncWftPortfolioIfNeeded('synthetic-identity');
                return { savedBefore: JSON.parse(savedBefore), portfolio: getLocalPortfolioSnapshot(), uploads,
                    sharedMutation: Object.hasOwn(Object, 'sessions') || Object.hasOwn(Object.prototype, 'sessions') };
            }, r => {
                assert.ok(Object.hasOwn(r.savedBefore, name));
                assert.ok(Object.hasOwn(r.portfolio, name));
                assert.deepEqual(r.portfolio[name].sessions.map(s => s.id).sort(), ['__proto__', 'constructor', 'local', 'remote'].sort());
                assert.equal(r.portfolio[name].sessions.find(s => s.id === '__proto__').originalText, 'Newer writing');
                assert.deepEqual(r.uploads[0], r.portfolio); assert.equal(r.sharedMutation, false);
            }, name);
            await run('local-save-new-student-' + name, name => {
                saveStudentSession(name, { id: '__proto__', originalText: 'Keep this writing.', images: [] });
                return { raw: JSON.parse(localStorage.getItem('wft_portfolio')), sharedMutation: Object.hasOwn(Object, 'sessions') || Object.hasOwn(Object.prototype, 'sessions') };
            }, r => { assert.ok(Object.hasOwn(r.raw, name)); assert.equal(r.raw[name].sessions[0].id, '__proto__'); assert.equal(r.sharedMutation, false); }, name);
            await run('legacy-merge-new-session-' + name, name => {
                const entry = id => ({ id, createdAt: '2026-10-01', images: [] });
                const merged = mergePortfolioData({ Alice: { sessions: [entry('ordinary')] } }, { Alice: { sessions: [entry(name)] } });
                return merged.Alice.sessions.map(s => s.id);
            }, r => assert.deepEqual(r.sort(), ['ordinary', name].sort()), name);
            await run('split-session-' + name, name => {
                const session = (updatedAt, originalText) => ({ id: name, createdAt: '2026-10-01', updatedAt, originalText, images: [] });
                const result = mergeStudentPortfolioFiles({ studentId: 'stu_synthetic', legacyNameKeys: [name, 'Alice'], sessions: [session('2026-10-03', 'new')] }, { studentId: 'stu_synthetic', legacyNameKeys: ['Alice', name, 'Bob'], sessions: [session('2026-10-01', 'old')] }, {});
                return { result, splitDefault: WFT_SPLIT_STUDENT_FILES_V1, idDefault: WFT_STUDENT_ID_MAP_V1 };
            }, r => { assert.deepEqual(r.result.legacyNameKeys, [name, 'Alice', 'Bob'].filter((v, i, a) => a.indexOf(v) === i)); assert.equal(r.result.sessions.length, 1); assert.equal(r.result.sessions[0].originalText, 'new'); assert.equal(r.splitDefault, true); assert.equal(r.idDefault, false); }, name);
            await run('student-id-create-reload-' + name, name => {
                const first = getOrCreateStudentId(name), second = getOrCreateStudentId(name);
                const settings = getRawSettings();
                return { first, second, map: settings.studentIdMap, records: settings.studentRecords };
            }, r => { assert.equal(typeof r.first, 'string'); assert.match(r.first, /^stu_/); assert.equal(r.second, r.first); assert.ok(Object.hasOwn(r.map, name)); assert.equal(r.map[name], r.first); assert.equal(r.records.length, 1); }, name);
            await run('student-id-roster-and-rename-' + name, name => {
                WFT_STUDENT_ID_MAP_V1 = true; students = [name]; saveStudents();
                ensureStudentRecordsForRoster(); const settings = getRawSettings();
                const first = settings.studentIdMap[name];
                updateStudentRecordOnRename(name, '__proto__', settings); saveSettingsToLocalStorage(settings);
                return { first, stored: getRawSettings() };
            }, r => { assert.equal(typeof r.first, 'string'); assert.ok(Object.hasOwn(r.stored.studentIdMap, name)); assert.ok(Object.hasOwn(r.stored.studentIdMap, '__proto__')); assert.equal(r.stored.studentIdMap.__proto__, r.first); }, name);
            await run('connected-index-and-deletion-own-key-' + name, name => {
                const portfolio = Object.fromEntries([[name, { sessions: [{ id: 'essay', images: [] }] }]]);
                const index = buildPortfolioIndexFromPortfolio(portfolio);
                const split = rebuildIndexFromStudentFiles({ file: { format: 'student-portfolio-v1', studentId: name, displayName: name, sessions: [] } });
                localStorage.setItem('wft_settings', JSON.stringify({ studentIdMap: {} }));
                recordSessionDeletion(name, 'essay');
                return { index, split, record: getDeletionsData().records[0] };
            }, r => { assert.ok(Object.hasOwn(r.index.students, name)); assert.ok(Object.hasOwn(r.split.students, name)); assert.equal(r.record.studentId, ''); }, name);
        }
        for (const failure of ['initial', 'lookup']) {
            await run('student-record-initialization-read-failure-' + failure, failure => {
                WFT_STUDENT_ID_MAP_V1 = true;
                const originalSettings = {
                    students: ['AliceOld', 'New'],
                    studentIdMap: { Alice: 'stu_alice', AliceOld: 'stu_alice', Bob: 'stu_bob' },
                    studentRecords: [
                        { studentId: 'stu_alice', displayName: 'Alice', legacyNameKeys: ['Alice', 'AliceOld'], createdAt: '2026-10-01' },
                        { studentId: 'stu_bob', displayName: 'Bob', legacyNameKeys: ['Bob'], createdAt: '2026-10-02' }
                    ]
                };
                localStorage.setItem('wft_settings', JSON.stringify(originalSettings));
                localStorage.setItem('wft_students', JSON.stringify(originalSettings.students));
                localStorage.setItem('wft_portfolio', JSON.stringify({ AliceOld: { sessions: [{ id: 'essay', originalText: 'Preserved writing.', images: [] }] } }));
                const before = localStorage.getItem('wft_settings'), writing = localStorage.getItem('wft_portfolio');
                const get = Storage.prototype.getItem, lookup = getStudentRecordByName;
                let insideLookup = false, failedReads = 0, lookupReads = 0;
                getStudentRecordByName = function() {
                    insideLookup = true;
                    try { return lookup.apply(this, arguments); } finally { insideLookup = false; }
                };
                Storage.prototype.getItem = function(key) {
                    if (key === 'wft_settings') {
                        if (insideLookup) lookupReads++;
                        if (!failedReads && (failure === 'initial' || insideLookup)) {
                            failedReads++;
                            throw Error('Synthetic settings read failure');
                        }
                    }
                    return get.call(this, key);
                };
                try { ensureStudentRecordsForRoster(); }
                finally { Storage.prototype.getItem = get; getStudentRecordByName = lookup; }
                const firstRaw = localStorage.getItem('wft_settings'), first = JSON.parse(firstRaw);
                ensureStudentRecordsForRoster(); const retry = getRawSettings();
                ensureStudentRecordsForRoster(); const repeated = getRawSettings();
                return { failure, originalSettings, before, firstRaw, first, retry, repeated, failedReads, lookupReads,
                    writingUnchanged: localStorage.getItem('wft_portfolio') === writing };
            }, r => {
                if (r.failure === 'initial') { assert.equal(r.failedReads, 1); assert.equal(r.firstRaw, r.before); }
                else { assert.equal(r.first.studentRecords.length, 3); assert.equal(r.lookupReads, 0); }
                assert.deepEqual(r.retry.studentRecords.slice(0, 2), r.originalSettings.studentRecords);
                for (const name of ['Alice', 'AliceOld', 'Bob']) assert.equal(r.retry.studentIdMap[name], r.originalSettings.studentIdMap[name]);
                assert.equal(r.retry.studentRecords.length, 3);
                assert.equal(r.retry.studentRecords.filter(record => record.displayName === 'New').length, 1);
                assert.equal(r.retry.studentRecords[2].studentId, r.retry.studentIdMap.New);
                assert.deepEqual(r.repeated.studentRecords, r.retry.studentRecords);
                assert.deepEqual(r.repeated.studentIdMap, r.retry.studentIdMap);
                assert.equal(r.writingUnchanged, true);
            }, failure);
        }
        await run('student-record-read-only-lookup-keeps-first-match-and-soft-failure', () => {
            localStorage.setItem('wft_settings', JSON.stringify({ studentRecords: [
                { studentId: 'first', displayName: 'Current', legacyNameKeys: ['Alias'] },
                { studentId: 'later', displayName: 'Alias', legacyNameKeys: [] }
            ] }));
            const before = localStorage.getItem('wft_settings'), first = getStudentRecordByName('Alias');
            const get = Storage.prototype.getItem;
            let absent;
            Storage.prototype.getItem = function(key) { if (key === 'wft_settings') throw Error('Synthetic lookup read failure'); return get.call(this, key); };
            try { absent = getStudentRecordByName('Alias'); }
            finally { Storage.prototype.getItem = get; }
            return { first, absent, unchanged: localStorage.getItem('wft_settings') === before };
        }, r => { assert.equal(r.first.studentId, 'first'); assert.equal(r.absent, null); assert.equal(r.unchanged, true); });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
        });
        const run = async (name, exercise, check, arg) => {
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => {
                stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                localStorage.clear(); localStorage.setItem('wft_settings', '{}');
                localStorage.setItem('wft_portfolio', '{}');
                students = []; selectedStudent = ''; wftStudentChangeRecovery = null;
            });
            let observed;
            // JSON transport keeps an own __proto__ key intact across the browser automation protocol.
            try { observed = JSON.parse(await page.evaluate(async ({ source, arg }) => JSON.stringify(await eval('(' + source + ')')(arg)), { source: exercise.toString(), arg })); check(observed); cases.push({ name, passed: true, observed }); }
            catch (e) { cases.push({ name, passed: false, error: e.message, observed }); }
        };
        // Native FileReader, actual transactional import/storage/UI; only alerts and scheduling replaced.
        await run('native-roster-import-own-keys-and-case-deduplication', async () => {
            const alerts = []; window.alert = text => alerts.push(text);
            importStudents({ target: { files: [new File(['constructor\n__proto__\nAlice\nCONSTRUCTOR\nalice\ntoString\nhasOwnProperty'], 'synthetic.txt')], value: 'synthetic' } });
            for (let i = 0; i < 100 && !alerts.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
            if (!alerts.length) throw Error('FileReader did not complete');
            const merged = mergeWftStudents(students, ['ALICE', 'constructor', '__proto__']);
            return { stored: JSON.parse(localStorage.getItem('wft_students')), merged, alerts, dropdown: Array.from(document.getElementById('studentSelect').options).map(o => o.value) };
        }, r => {
            assert.deepEqual(r.stored.slice().sort(), ['constructor', '__proto__', 'Alice', 'toString', 'hasOwnProperty'].sort());
            assert.deepEqual(r.merged.slice().sort(), r.stored.slice().sort());
            for (const name of r.stored) assert.ok(r.dropdown.includes(name));
        });
        await runStudentIdentityCases(run);
        await run('portfolio-root-policy/schema-index-health-roster', () => {
            const entry = name => ({ id: 'saved-' + name, originalText: 'Synthetic ' + name, images: [], overall: 80,
                createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', normalizedAt: '2026-10-01T00:00:00Z', dateIso: '2026-10-01', displayDate: 'Oct 1, 2026' });
            const portfolio = Object.fromEntries(['_meta', 'updatedAt', '__syncMeta', 'syncMeta', 'lastSyncedAt', 'lastSyncStatus', '__proto__', 'constructor', 'Alice', '_Meta', 'lastSyncStatusExtra'].map(name => [name, { sessions: [entry(name)] }]));
            const before = JSON.stringify(portfolio);
            localStorage.setItem('wft_portfolio', before); localStorage.setItem('wft_students', '[]');
            WFT_STUDENT_ID_MAP_V1 = false;
            const normalized = normalizeWftPortfolioForSchemaV1(portfolio), index = buildPortfolioIndexFromPortfolio(portfolio);
            const legacyKeys = Object.keys(normalizePortfolioData(portfolio));
            const get = getPortfolioData;
            let health;
            try {
                getPortfolioData = () => portfolio;
                WFT_STORAGE_HEALTH_UI_V1 = true; refreshStorageHealthUI();
                health = document.getElementById('storageHealthSummary').textContent;
                WFT_STUDENT_ID_MAP_V1 = true; ensureStudentRecordsForRoster();
            } finally { getPortfolioData = get; }
            const settings = getRawSettings();
            return { normalizedKeys: Object.keys(normalized), nullPrototypes: [Object.getPrototypeOf(normalized) === null, Object.getPrototypeOf(index.students) === null],
                normalized: Object.entries(normalized).map(([name, data]) => [name, data.sessions.map(s => [s.id, s.originalText])]), metadataSame: normalized._meta === portfolio._meta,
                index: Object.values(index.students).map(s => [s.displayName, s.studentId, s.sessionCount, s.averageScore, s.latestSessionAt]), health, legacyKeys,
                rosterKeys: Object.keys(settings.studentIdMap), rosterNames: settings.studentRecords.map(r => r.displayName), ids: Object.values(settings.studentIdMap),
                unchanged: JSON.stringify(portfolio) === before && localStorage.getItem('wft_portfolio') === before };
        }, r => {
            const names = ['__proto__', 'constructor', 'Alice', '_Meta', 'lastSyncStatusExtra'];
            assert.deepEqual(r.normalizedKeys, [...names, '_meta']); assert.deepEqual(r.nullPrototypes, [true, true]);
            assert.deepEqual(r.normalized, [...names, '_meta'].map(name => [name, [['saved-' + name, 'Synthetic ' + name]]]));
            assert.equal(r.metadataSame, true); assert.equal(r.unchanged, true);
            assert.deepEqual(r.index, names.map(name => [name, '', 1, 80, '2026-10-01T00:00:00Z']));
            assert.match(r.health, /Cached students: 5, sessions: 5/);
            assert.deepEqual(r.rosterKeys, names); assert.deepEqual(r.rosterNames, names);
            assert.equal(new Set(r.ids).size, 5); assert.ok(r.ids.every(id => typeof id === 'string' && id.startsWith('stu_')));
            assert.deepEqual(r.legacyKeys, ['_meta', ...names], 'The separate five-name normalization policy keeps _meta eligible');
        });
        await run('portfolio-root-policy/strict-validation-before-writes', () => {
            const reserved = ['_meta', 'updatedAt', '__syncMeta', 'syncMeta', 'lastSyncedAt', 'lastSyncStatus'];
            let accepted = 0, writes = 0;
            const rejected = [], before = localStorage.getItem('wft_portfolio'), set = Storage.prototype.setItem;
            for (const payload of [null, [], 0, 'invalid', { sessions: null }, { sessions: [null] }]) {
                const portfolio = Object.fromEntries(reserved.map(name => [name, payload]));
                for (const name of ['__proto__', 'constructor', 'Alice']) Object.defineProperty(portfolio, name, { enumerable: true, value: { sessions: [{}] } });
                validateWftPortfolioShape(portfolio); accepted++;
            }
            Storage.prototype.setItem = function(key, value) { writes++; return set.call(this, key, value); };
            try {
                for (const name of ['_Meta', 'UpdatedAt', 'lastSyncStatusExtra']) for (const payload of [null, { sessions: [null] }]) {
                    try { savePortfolioLocalOnly(Object.fromEntries([[name, payload]]), 'synthetic-invalid-policy'); }
                    catch (error) { rejected.push({ name, session: !!payload, type: error.name, message: error.message }); }
                }
                for (const portfolio of [null, [], 0, 'invalid', true]) {
                    try { validateWftPortfolioShape(portfolio); }
                    catch (error) { rejected.push({ root: true, type: error.name, message: error.message }); }
                }
            } finally { Storage.prototype.setItem = set; }
            return { accepted, rejected, writes, unchanged: localStorage.getItem('wft_portfolio') === before };
        }, r => {
            assert.equal(r.accepted, 6); assert.equal(r.writes, 0); assert.equal(r.unchanged, true); assert.equal(r.rejected.length, 11);
            for (const item of r.rejected) {
                assert.equal(item.type, 'TypeError');
                assert.equal(item.message, item.root ? 'Portfolio data is unreadable. Download Emergency Backup before repairing browser storage.' : (item.session ? 'Invalid portfolio session for: ' : 'Invalid portfolio student: ') + item.name);
            }
        });
        await run('portfolio-root-policy/ignored-getters-and-error-order', () => {
            const reads = [], traces = {}, sentinel = { reason: 'Synthetic portfolio getter failure' };
            const sample = allowMeta => {
                const portfolio = {};
                for (const name of ['_meta', 'updatedAt', '__syncMeta', 'syncMeta', 'lastSyncedAt', 'lastSyncStatus']) Object.defineProperty(portfolio, name, { enumerable: true, get() { reads.push(name); if (name === '_meta' && allowMeta) return { keep: true }; throw sentinel; } });
                Object.defineProperty(portfolio, 'Alice', { enumerable: true, configurable: true, get() { reads.push('Alice'); return { sessions: [] }; } });
                return portfolio;
            };
            normalizeWftPortfolioForSchemaV1(sample(true), true); traces.schema = reads.splice(0);
            buildPortfolioIndexFromPortfolio(sample(false)); traces.index = reads.splice(0);
            validateWftPortfolioShape(sample(false)); traces.validator = reads.splice(0);
            const get = getPortfolioData;
            try {
                getPortfolioData = () => sample(false);
                WFT_STORAGE_HEALTH_UI_V1 = true; refreshStorageHealthUI(); traces.health = reads.splice(0);
                WFT_STUDENT_ID_MAP_V1 = true; ensureStudentRecordsForRoster(); traces.roster = reads.splice(0);
            } finally { getPortfolioData = get; }
            const portfolio = sample(false);
            Object.defineProperty(portfolio, 'Alice', { enumerable: true, get() { reads.push('Alice'); return { get sessions() { reads.push('sessions'); return []; } }; } });
            Object.defineProperty(portfolio, 'Bob', { enumerable: true, get() { reads.push('Bob'); throw sentinel; } });
            let thrown;
            try { validateWftPortfolioShape(portfolio); } catch (error) { thrown = error; }
            return { traces, errorOrder: reads, sameError: thrown === sentinel };
        }, r => {
            assert.deepEqual(r.traces, { schema: ['Alice', '_meta', '_meta'], index: ['Alice'], validator: ['Alice'], health: ['Alice'], roster: [] });
            assert.deepEqual(r.errorOrder, ['Alice', 'sessions', 'sessions', 'Bob']); assert.equal(r.sameError, true);
        });
        await run('portfolio-root-policy/legacy-safe-mode-skip-identities', () => {
            WFT_STUDENT_ID_MAP_V1 = true;
            const portfolio = { Legacy: [], Empty: null, Invalid: 'ignored' }, before = JSON.stringify(portfolio), settings = localStorage.getItem('wft_settings');
            const getId = getOrCreateStudentId;
            let allocations = 0;
            getOrCreateStudentId = function(name) { allocations++; return getId(name); };
            try {
                const normalized = normalizeWftPortfolioForSchemaV1(portfolio, true), index = buildPortfolioIndexFromPortfolio(portfolio);
                const meta = getWftStorageMeta(); meta.safeMode = true;
                if (!setWftStorageMeta(meta)) throw Error('Synthetic safe mode could not be persisted');
                const identity = normalizeWftPortfolioForSchemaV1(portfolio) === portfolio;
                ensureStudentRecordsForRoster();
                return { normalized, indexKeys: Object.keys(index.students), count: index.students.Legacy.sessionCount, identity, allocations,
                    unchanged: JSON.stringify(portfolio) === before && localStorage.getItem('wft_settings') === settings };
            } finally { getOrCreateStudentId = getId; }
        }, r => {
            assert.deepEqual(r.normalized, { Legacy: { sessions: [] } }); assert.deepEqual(r.indexKeys, ['Legacy']); assert.equal(r.count, 0);
            assert.equal(r.identity, true); assert.equal(r.allocations, 0); assert.equal(r.unchanged, true);
        });
        for (const localNewer of [false, true]) {
            await run('photo-conflict-sync-' + (localNewer ? 'local-newer' : 'cloud-newer'), async localNewer => {
                const entry = newer => ({ id: 'essay', createdAt: '2026-10-01', updatedAt: newer ? '2026-10-03' : '2026-10-01', originalText: newer ? 'Newer writing' : 'Older writing', images: [{ imageId: 'photo', driveFileId: newer ? 'new-file' : 'old-file', dataUrl: newer ? 'new-bytes' : 'old-bytes', name: newer ? 'new.png' : 'old.png', mimeType: newer ? 'image/png' : 'image/jpeg' }] });
                localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [entry(localNewer)] } })); markWftPortfolioDirty('synthetic-photo');
                const cloud = { Alice: { sessions: [entry(!localNewer)] } }; const uploads = [];
                findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical' }]); downloadWftJsonFilePromise = () => Promise.resolve(cloud);
                uploadWftJsonFilePromise = (filename, data) => { uploads.push(JSON.parse(JSON.stringify(data))); return Promise.resolve('canonical'); };
                await syncWftPortfolioIfNeeded('synthetic-photo');
                return { session: getPortfolioData().Alice.sessions[0], uploads };
            }, r => { if (localNewer) assert.ok(r.uploads.length > 0, 'Newer local writing must upload to the canonical portfolio'); assert.equal(r.session.originalText, 'Newer writing'); assert.equal(r.session.images[0].driveFileId, 'new-file'); assert.equal(r.session.images[0].dataUrl, 'new-bytes'); assert.equal(r.session.images[0].name, 'new.png'); assert.equal(r.session.images[0].mimeType, 'image/png'); for (const upload of r.uploads) assert.equal(upload.Alice.sessions[0].images[0].driveFileId, 'new-file'); }, localNewer);
        }
        for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
            await run('image-identity-' + key, key => {
                const result = mergeSessionImageRefs({ images: [{ imageId: key, driveFileId: 'new', name: 'new' }] }, { images: [{ imageId: key, driveFileId: 'old', name: 'old' }] });
                return { result, polluted: Object.hasOwn(Object.prototype, 'driveFileId') || Object.hasOwn(Object, 'driveFileId') };
            }, r => { assert.equal(r.result.images.length, 1); assert.equal(r.result.images[0].driveFileId, 'new'); assert.equal(r.polluted, false); }, key);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
    if (process.env.WFT_CASE_OUTPUT) fs.writeFileSync(process.env.WFT_CASE_OUTPUT, JSON.stringify({ root, cases }, null, 2) + '\n');
    console.log(JSON.stringify({ suite: 'record-identity.browser', cases: cases.length, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).map(c => ({ name: c.name, error: c.error })) }, null, 2));
    if (cases.some(c => !c.passed)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
