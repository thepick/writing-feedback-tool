const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function getSessionKey(');
const end = source.indexOf('// ── WFT Sync Engine V2 portfolio index sync', start);
assert.ok(start >= 0 && end > start);
const helpers = ['stableStringify', 'cloneWftJson', 'normalizePortfolioData', 'normalizePortfolioShape', 'validateWftPortfolioShape', 'getEmptyDeletionsData', 'compactDeletions', 'normalizeDeletionsData', 'getDeletedStudentKey', 'getDeletedSessionKey', 'getWftTombstoneTimeMs', 'getWftDeletionRecords', 'isStudentSessionDeleted', 'isStudentDeletedByTombstone', 'applyDeletionsToPortfolio', 'downloadAndMergeDuplicatePortfolios'].map(name => {
    const from = source.indexOf('function ' + name + '(');
    const to = source.indexOf('\nfunction ', from + 1);
    assert.ok(from >= 0 && to > from, name);
    return source.slice(from, to);
}).join('\n');
const portfolio = (...ids) => ({ Alice: { sessions: ids.map(id => ({ id, originalText: id, date: '2026-10-01', title: 'Untitled', categoryScores: {}, images: [] })) } });
const clone = value => JSON.parse(JSON.stringify(value));
function gate() {
    let resolve, entered;
    const promise = new Promise(done => { resolve = done; });
    const started = new Promise(done => { entered = done; });
    return { resolve, started, wait() { entered(); return promise; } };
}
function setup({ files = [{ id: 'canonical' }], pending = true, findGate, downloadGate, uploadGate, failSave = false, localPortfolio = portfolio('old'), cloudPortfolio = portfolio('cloud'), duplicates = {}, deletions = {} } = {}) {
    let local = clone(localPortfolio);
    const writes = [], uploads = [];
    const state = { localPortfolioCounter: 1, pendingPortfolioPush: pending, lastSyncedPortfolioCounter: 0, lastSyncedPortfolioHash: 'previous', needsSyncAfterCurrent: false };
    const app = vm.runInNewContext(helpers + '\n' + source.slice(start, end) + '\n;globalThis', {
        preflightWftRequiredStorage() {}, markWftPortfolioIndexDirty() {}, getRawSettings: () => ({}), WFT_LAMPORT_V1: false,
        wftSyncState: state, WFT_PORTFOLIO_FILENAME: 'portfolio.json',
        WFT_TOMBSTONE_COMPACTION_V1: false, getDeletionsData: () => clone(deletions),
        getLocalPortfolioSnapshot: () => clone(local), getPortfolioFingerprint: JSON.stringify,
        findWftFilesByNamePromise: () => findGate ? findGate.wait() : Promise.resolve(files),
        noteDuplicateWftFiles() {}, chooseCanonicalWftFile: entries => entries[0], setCachedWftDriveFileId() {},
        downloadWftJsonFilePromise: id => downloadGate ? downloadGate.wait() : Promise.resolve(clone(duplicates[id] || cloudPortfolio)),
        uploadWftJsonFilePromise: (name, data) => { uploads.push(clone(data)); return uploadGate ? uploadGate.wait() : Promise.resolve('uploaded'); },
        localStorage: { setItem(key, value) { assert.equal(key, 'wft_portfolio'); if (failSave) throw new Error('Storage full'); local = JSON.parse(value); writes.push(clone(local)); } },
        renderStudentPortfolio() {}, refreshPortfolioDropdown() {}, wftSyncLog() {}, wftDebugWarn() {}
    });
    return { app, state, writes, uploads, get local() { return local; }, recover() { failSave = false; }, edit() { local = portfolio('old', 'new'); state.localPortfolioCounter++; state.pendingPortfolioPush = true; } };
}
async function delayedPull(pending) {
    const downloadGate = gate();
    const test = setup({ pending, downloadGate });
    const run = test.app.syncWftPortfolioIfNeeded('test');
    await downloadGate.started;
    test.edit();
    downloadGate.resolve(portfolio('cloud'));
    await run;
    assert.deepEqual(test.local, portfolio('old', 'new'), 'A delayed pull must not overwrite a newer local save');
    assert.deepEqual(test.writes, []);
    assert.deepEqual(test.uploads, []);
    assert.equal(test.state.pendingPortfolioPush, true);
    assert.equal(test.state.needsSyncAfterCurrent, true);
    assert.equal(test.state.lastSyncedPortfolioCounter, 0, 'An obsolete snapshot must not be acknowledged');
    await test.app.syncWftPortfolioIfNeeded('retry');
    assert.ok(test.uploads[0].Alice.sessions.some(s => s.id === 'new'));
    assert.deepEqual(test.uploads[0].Alice.sessions.map(s => s.id).sort(), ['cloud', 'new', 'old'], 'Follow-up sync must retain cloud-only writing too');
    assert.equal(test.state.pendingPortfolioPush, false);
    assert.equal(test.state.lastSyncedPortfolioCounter, 2);
}
async function delayedUpload(files) {
    const uploadGate = gate();
    const test = setup({ files, uploadGate });
    const run = test.app.syncWftPortfolioIfNeeded('test');
    await uploadGate.started;
    test.edit();
    uploadGate.resolve('uploaded');
    await run;
    assert.deepEqual(test.local, portfolio('old', 'new'));
    assert.equal(test.state.pendingPortfolioPush, true, 'Completing an older upload must leave the newer save dirty');
    assert.equal(test.state.needsSyncAfterCurrent, true);
    assert.equal(test.state.lastSyncedPortfolioCounter, 1);
}
(async () => {
    const union = setup();
    assert.equal(await union.app.syncWftPortfolioIfNeeded('union'), true);
    assert.deepEqual(union.local.Alice.sessions.map(s => s.id).sort(), ['cloud', 'old'], 'A pending local save cannot delete a distinct cloud essay');
    assert.deepEqual(union.uploads[0], union.local);
    const duplicate = setup({ files: [{ id: 'canonical' }, { id: 'duplicate' }], duplicates: { duplicate: portfolio('duplicate') } });
    await duplicate.app.syncWftPortfolioIfNeeded('duplicates');
    assert.deepEqual(duplicate.uploads[0].Alice.sessions.map(s => s.id).sort(), ['cloud', 'duplicate', 'old']);
    for (const localNewer of [false, true]) {
        const local = portfolio('same'), cloud = portfolio('same');
        local.Alice.sessions[0].updatedAt = localNewer ? '2026-10-03' : '2026-10-01';
        cloud.Alice.sessions[0].updatedAt = localNewer ? '2026-10-01' : '2026-10-03';
        local.Alice.sessions[0].originalText = 'local';
        cloud.Alice.sessions[0].originalText = 'cloud';
        local.Alice.sessions[0].images = [{ imageId: 'local-photo', driveFileId: 'local-file' }];
        cloud.Alice.sessions[0].images = [{ imageId: 'cloud-photo', driveFileId: 'cloud-file' }];
        const conflict = setup({ localPortfolio: local, cloudPortfolio: cloud });
        await conflict.app.syncWftPortfolioIfNeeded('conflict');
        assert.equal(conflict.local.Alice.sessions.length, 1);
        assert.equal(conflict.local.Alice.sessions[0].originalText, localNewer ? 'local' : 'cloud');
        assert.deepEqual(conflict.local.Alice.sessions[0].images.map(i => i.driveFileId).sort(), ['cloud-file', 'local-file']);
        assert.deepEqual(conflict.uploads[0], conflict.local);
    }
    for (const restored of [false, true]) {
        const tombstones = { deletedStudents: { 'student:bob': { deletedAt: '2026-10-02' } }, restoredStudents: { 'student:bob': { restoredAt: restored ? '2026-10-03' : '2026-10-01' } }, deletedSessions: { 'session:alice:deleted': { deletedAt: '2026-10-02' } } };
        const cloud = { ...portfolio('cloud', 'deleted'), Bob: { sessions: portfolio('bob').Alice.sessions } };
        const filtered = setup({ localPortfolio: portfolio('old', 'deleted'), cloudPortfolio: cloud, duplicates: { duplicate: cloud }, files: [{ id: 'canonical' }, { id: 'duplicate' }], deletions: tombstones });
        await filtered.app.syncWftPortfolioIfNeeded('tombstones');
        assert.deepEqual(filtered.local.Alice.sessions.map(s => s.id).sort(), ['cloud', 'old']);
        assert.equal(!!filtered.local.Bob, restored, 'Only a newer student restore may override its deletion');
        assert.deepEqual(filtered.uploads[0], filtered.local);
    }
    for (const pending of [false, true]) await delayedPull(pending);
    for (const files of [[], [{ id: 'canonical' }]]) await delayedUpload(files);
    const findGate = gate();
    const staleCreate = setup({ files: [], findGate });
    const run = staleCreate.app.syncWftPortfolioIfNeeded('test');
    await findGate.started;
    staleCreate.edit();
    findGate.resolve([]);
    await run;
    assert.deepEqual(staleCreate.uploads, [], 'An obsolete snapshot must not create a Drive file');
    assert.equal(staleCreate.state.needsSyncAfterCurrent, true);
    const failure = setup({ failSave: true });
    await assert.rejects(failure.app.syncWftPortfolioIfNeeded('test'), /Storage full/);
    assert.deepEqual(failure.local, portfolio('old'));
    assert.deepEqual(failure.uploads, []);
    assert.equal(failure.state.pendingPortfolioPush, true);
    assert.equal(failure.state.lastSyncedPortfolioCounter, 0);
    assert.equal(failure.state.lastSyncedPortfolioHash, 'previous');
    failure.recover();
    await failure.app.syncWftPortfolioIfNeeded('recovery');
    assert.deepEqual(failure.uploads[0].Alice.sessions.map(s => s.id).sort(), ['cloud', 'old']);
    const stable = setup();
    assert.equal(await stable.app.syncWftPortfolioIfNeeded('test'), true);
    assert.equal(stable.state.pendingPortfolioPush, false);
    assert.equal(stable.state.needsSyncAfterCurrent, false);
    console.log('Portfolio sync tests passed: delayed pulls, creates and uploads preserve newer saves; failed local merges are not acknowledged; normal sync still completes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
