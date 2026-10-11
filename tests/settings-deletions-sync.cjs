const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const names = ['stableStringify', 'getWftHash', 'cloneWftJson', 'normalizeSettingsForFingerprint', 'getSettingsFingerprint', 'normalizeDeletionsForFingerprint', 'getDeletionsFingerprint', 'getEmptyDeletionsData', 'compactDeletions', 'normalizeDeletionsData', 'getDeletedStudentKey', 'getWftTombstoneTimeMs', 'isStudentDeletedByTombstone', 'applyDeletionsToStudents', 'mergeWftDeletions', 'saveDeletionsLocalOnly', 'getWftDeletionCounts', 'getWftStudentName', 'normalizeStudentKey', 'mergeWftStudents', 'mergeWftSettings', 'saveSettingsLocalOnly', 'syncWftSettingsIfNeeded', 'syncWftDeletionsIfNeeded'];
const code = names.map(name => {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\nfunction ', start + 1);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end);
}).join('\n');
const clone = value => JSON.parse(JSON.stringify(value));
const settings = target => ({ students: ['Test Student'], targetWordCount: target });
const deletions = (...ids) => ({ deletedSessions: Object.fromEntries(ids.map(id => [id, { sessionId: id, deletedAt: '2026-10-10T00:00:00Z' }])), records: ids.map(id => ({ id, sessionId: id, deletedAt: '2026-10-10T00:00:00Z' })) });
function gate() {
    let resolve, entered;
    const promise = new Promise(done => { resolve = done; });
    const started = new Promise(done => { entered = done; });
    return { resolve, started, wait() { entered(); return promise; } };
}
function setup(stream, { files = [{ id: 'canonical' }], pending = true, uploadGate, downloadGate, failSave = false } = {}) {
    const key = stream === 'Settings' ? 'wft_settings' : 'deletions';
    let local = stream === 'Settings' ? settings('200') : deletions('old');
    let cloud = stream === 'Settings' ? { ...settings('100'), students: ['Cloud Student'] } : deletions('cloud');
    let ui = clone(local);
    let stored = JSON.stringify(local);
    const uploads = [], writes = [];
    const state = { ['local' + stream + 'Counter']: 1, ['pending' + stream + 'Push']: pending, ['lastSynced' + stream + 'Counter']: 0, ['lastSynced' + stream + 'Hash']: 'previous', needsSyncAfterCurrent: false };
    const app = vm.runInNewContext(code + '\n;globalThis', {
        wftSyncState: state, wftSuppressDirtyMarks: false, WFT_TOMBSTONE_COMPACTION_V1: false,
        WFT_SETTINGS_FILENAME: 'settings', WFT_DELETIONS_FILENAME: 'deletions', WFT_DELETIONS_STORAGE_KEY: 'deletions',
        getLocalSettingsSnapshot: () => clone(local), getDeletionsData: () => stream === 'Deletions' ? clone(local) : ({}),
        findWftFilesByNamePromise: () => Promise.resolve(files), noteDuplicateWftFiles() {},
        chooseCanonicalWftFile: entries => entries[0], setCachedWftDriveFileId() {},
        downloadAndMergeDuplicateSettings: (duplicates, data) => Promise.resolve(data),
        downloadWftJsonFilePromise: () => downloadGate ? downloadGate.wait() : Promise.resolve(clone(cloud)),
        uploadWftJsonFilePromise: async (name, data) => {
            uploads.push(clone(data));
            if (uploadGate) await uploadGate.wait();
            cloud = clone(data);
            files = [{ id: 'canonical' }];
            return 'canonical';
        },
        localStorage: {
            getItem: () => stored,
            setItem(name, value) {
                assert.equal(name, key);
                if (failSave) throw new Error('Storage full');
                stored = value;
                local = JSON.parse(value);
                writes.push(clone(local));
            }
        },
        applyLoadedSettings(data) { ui = clone(data); }, refreshApiKeyRuntimeValue() {}, wftSyncLog() {}, wftDebugWarn() {}
    });
    return {
        app, state, uploads, writes, sync: () => app['syncWft' + stream + 'IfNeeded']('test'),
        get local() { return local; }, get ui() { return ui; }, get stored() { return stored; }, get cloud() { return cloud; },
        recover() { failSave = false; },
        edit() {
            local = stream === 'Settings' ? settings('300') : deletions('old', 'new');
            ui = clone(local);
            stored = JSON.stringify(local);
            state['local' + stream + 'Counter']++;
            state['pending' + stream + 'Push'] = true;
        }
    };
}
async function delayedUpload(stream, files) {
    const uploadGate = gate();
    const test = setup(stream, { files, uploadGate });
    const run = test.sync();
    await uploadGate.started;
    test.edit();
    const newest = test.stored;
    uploadGate.resolve();
    await run;
    assert.equal(test.stored, newest, 'An older upload must preserve newer local data');
    assert.equal(test.state['lastSynced' + stream + 'Counter'], 1);
    assert.equal(test.state['pending' + stream + 'Push'], true, 'An older upload must leave the newer edit pending');
    assert.equal(test.state.needsSyncAfterCurrent, true, 'Request a follow-up without another user edit');
    await test.sync();
    assert.equal(test.state['lastSynced' + stream + 'Counter'], 2);
    assert.equal(test.state['pending' + stream + 'Push'], false);
    if (stream === 'Settings') {
        assert.equal(test.local.targetWordCount, '300');
        assert.equal(test.cloud.targetWordCount, '300', 'The next sync must prefer the newer local setting');
    } else {
        assert.ok(test.cloud.deletedSessions.new, 'The next sync must upload the newer deletion');
        assert.deepEqual(test.cloud.records.map(r => r.id).sort(), files.length ? ['cloud', 'new', 'old'] : ['new', 'old']);
    }
    assert.equal(test.uploads.length, 2);
}
async function failedMerge(stream, pending) {
    const test = setup(stream, { pending, failSave: true });
    const before = clone({ local: test.local, ui: test.ui, stored: test.stored, state: test.state });
    await assert.rejects(test.sync(), /Storage full/, 'A failed local merge must reject before upload or acknowledgement');
    assert.deepEqual(test.local, before.local);
    assert.deepEqual(test.ui, before.ui, 'A failed settings write must not change the UI');
    assert.equal(test.stored, before.stored);
    assert.deepEqual(test.state, before.state, 'Keep the dirty flag, counters and last-synced hash on failure');
    assert.equal(test.app.wftSuppressDirtyMarks, false);
    assert.deepEqual(test.uploads, []);
    test.recover();
    await test.sync();
    assert.equal(test.state['lastSynced' + stream + 'Counter'], 1);
    assert.equal(test.state['pending' + stream + 'Push'], false);
    assert.equal(test.uploads.length, pending ? 1 : 0);
}
async function delayedPull(stream) {
    const downloadGate = gate();
    const test = setup(stream, { pending: false, downloadGate });
    const run = test.sync();
    await downloadGate.started;
    test.edit();
    downloadGate.resolve(stream === 'Settings' ? settings('100') : deletions('cloud'));
    await run;
    assert.equal(test.state['lastSynced' + stream + 'Counter'], 2);
    assert.equal(test.state['pending' + stream + 'Push'], false);
    if (stream === 'Settings') assert.equal(test.cloud.targetWordCount, '300');
    else assert.deepEqual(test.cloud.records.map(r => r.id).sort(), ['cloud', 'new', 'old']);
}
(async () => {
    let passed = 0, failed = 0;
    async function check(name, test) {
        try { await test(); passed++; console.log('PASS', name); }
        catch (error) { failed++; console.error('FAIL', name + ':', error.message); }
    }
    for (const stream of ['Settings', 'Deletions']) {
        for (const files of [[], [{ id: 'canonical' }]]) {
            await check(stream + ' delayed ' + (files.length ? 'update' : 'create') + ' and next sync', () => delayedUpload(stream, files));
            await check(stream + ' stable ' + (files.length ? 'update' : 'create'), async () => {
                const test = setup(stream, { files });
                assert.equal(await test.sync(), true);
                assert.equal(test.state['pending' + stream + 'Push'], false);
                assert.equal(test.state.needsSyncAfterCurrent, false);
                assert.equal(test.state['lastSynced' + stream + 'Counter'], 1);
            });
        }
        for (const pending of [false, true]) await check(stream + ' failed ' + (pending ? 'push merge' : 'pull merge') + ' and recovery', () => failedMerge(stream, pending));
        await check(stream + ' edit during pull', () => delayedPull(stream));
    }
    console.log(`Settings/deletions sync: ${passed} passed, ${failed} failed.`);
    if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
