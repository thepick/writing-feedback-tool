const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function savePortfolioLocalOnly(');
const end = source.indexOf('// ── WFT Sync Engine V2 portfolio index sync', start);
assert.ok(start >= 0 && end > start);
const portfolio = (...ids) => ({ Alice: { sessions: ids.map(id => ({ id, originalText: id })) } });
const clone = value => JSON.parse(JSON.stringify(value));
function gate() {
    let resolve, entered;
    const promise = new Promise(done => { resolve = done; });
    const started = new Promise(done => { entered = done; });
    return { resolve, started, wait() { entered(); return promise; } };
}
function setup({ files = [{ id: 'canonical' }], pending = true, findGate, downloadGate, uploadGate, failSave = false } = {}) {
    let local = portfolio('old');
    const writes = [], uploads = [];
    const state = { localPortfolioCounter: 1, pendingPortfolioPush: pending, lastSyncedPortfolioCounter: 0, lastSyncedPortfolioHash: 'previous', needsSyncAfterCurrent: false };
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        wftSyncState: state, WFT_PORTFOLIO_FILENAME: 'portfolio.json',
        getDeletionsData: () => ({}), applyDeletionsToPortfolio: data => data,
        getLocalPortfolioSnapshot: () => clone(local), getPortfolioFingerprint: JSON.stringify,
        findWftFilesByNamePromise: () => findGate ? findGate.wait() : Promise.resolve(files),
        noteDuplicateWftFiles() {}, chooseCanonicalWftFile: entries => entries[0], setCachedWftDriveFileId() {},
        downloadAndMergeDuplicatePortfolios: (duplicates, data) => Promise.resolve(data),
        downloadWftJsonFilePromise: () => downloadGate ? downloadGate.wait() : Promise.resolve(portfolio('cloud')),
        mergeWftPortfolios: (a, b) => portfolio(...new Set([...a.Alice.sessions, ...b.Alice.sessions].map(s => s.id))),
        uploadWftJsonFilePromise: (name, data) => { uploads.push(clone(data)); return uploadGate ? uploadGate.wait() : Promise.resolve('uploaded'); },
        localStorage: { setItem(key, value) { assert.equal(key, 'wft_portfolio'); if (failSave) throw new Error('Storage full'); local = JSON.parse(value); writes.push(clone(local)); } },
        renderStudentPortfolio() {}, refreshPortfolioDropdown() {}, wftSyncLog() {}, wftDebugWarn() {}
    });
    return { app, state, writes, uploads, get local() { return local; }, edit() { local = portfolio('old', 'new'); state.localPortfolioCounter++; state.pendingPortfolioPush = true; } };
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
    const stable = setup();
    assert.equal(await stable.app.syncWftPortfolioIfNeeded('test'), true);
    assert.equal(stable.state.pendingPortfolioPush, false);
    assert.equal(stable.state.needsSyncAfterCurrent, false);
    console.log('Portfolio sync tests passed: delayed pulls, creates and uploads preserve newer saves; failed local merges are not acknowledged; normal sync still completes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
