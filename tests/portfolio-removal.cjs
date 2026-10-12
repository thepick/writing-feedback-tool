const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function functions(file, first, last) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const start = source.indexOf('function ' + first + '(');
    const end = source.indexOf('function ' + last + '(', start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}
const source = functions('js/app/10-main-app.js', 'findPortfolioSessionIndex', 'findPortfolioSession')
    + functions('js/app/00-storage-sync-patches.js', 'restoreWftStudentChangeStorage', 'parseWftBackupValue')
    + functions('js/app/00-storage-sync-patches.js', 'saveWftStudentChange', 'applyDeletionsToStudents')
    + functions('js/app/00-storage-sync-patches.js', 'getSessionKey', 'getTimeMs')
    + functions('js/app/00-storage-sync-patches.js', 'removeStudentSession', 'toggleRosterVisibility');
function setup(sessions, options = {}) {
    let stored = JSON.stringify({ Alice: { sessions }, Bob: { sessions: [{ id: 'other' }] } });
    const events = [], markers = [], alerts = [];
    const app = vm.runInNewContext(source + '\n;globalThis', {
        getPortfolioData: () => JSON.parse(stored),
        savePortfolioData: value => { if (options.failSave) throw new Error('Storage full'); stored = JSON.stringify(value); events.push('save'); },
        getDeletionsData: () => ({ markers: [] }),
        recordSessionDeletion: (student, id, data) => data.markers.push([student, id]),
        saveDeletionsData: data => { markers.push(...data.markers); data.markers.forEach(() => events.push('marker')); },
        // Required-read failures are exercised with the full native storage-integrity fixture.
        preflightWftRequiredStorage() {}, readWftRequiredStorage: () => ({}),
        localStorage: { getItem: () => null }, WFT_DELETIONS_STORAGE_KEY: 'wft_deletions', wftSuppressDirtyMarks: true,
        syncSavedPortfolioData() {},
        document: { getElementById: () => ({ value: 'Alice' }) },
        renderStudentPortfolio: () => { if (options.failRender) throw new Error('Display failed'); events.push('render'); },
        wftConfirm: async () => options.confirm !== false,
        alert: message => alerts.push(message), wftDebugError() {}
    });
    return { app, events, markers, alerts, get stored() { return stored; } };
}
(async () => {
    let test = setup([{ id: 'saved' }, { id: 'keep' }], { failSave: true });
    const before = test.stored;
    let error;
    try { await test.app.deletePortfolioSession('Alice', 'saved'); } catch (failure) { error = failure; }
    assert.equal(test.stored, before);
    assert.deepEqual(test.markers, [], 'A failed save must not mark still-saved writing as deleted');
    assert.equal(error, undefined, 'Report a failed removal to the teacher without an unhandled rejection');
    assert.match(test.alerts[0], /could not be removed/i);
    assert.deepEqual(test.events, []);

    for (const [sessions, selector, remaining, deleted] of [
        [[{ id: 'other', createdAt: 'selected' }, { id: 'selected' }, { id: 'keep' }], 'selected', ['other', 'keep'], 'selected'],
        [[{ id: 'first' }, { id: 'second' }, { id: '1' }], '1', ['first', 'second'], '1'],
        [[{ id: 7 }, { id: 'keep' }], '7', ['keep'], '7'],
        [[{ id: 'assigned', createdAt: 'legacy' }, { id: 'keep' }], 'legacy', ['keep'], 'assigned'],
        [[{ createdAt: 'legacy' }, { id: 'keep' }], 'legacy', ['keep'], 'legacy'],
        [[{ id: 'a', createdAt: 'same' }, { id: 'b', createdAt: 'same' }], 'same', ['b'], 'a'],
        [[{ title: 'Legacy', studentName: 'Alice', date: '2020-01-01' }, { id: 'keep' }], '0', ['keep'], 'Alice|2020-01-01|Legacy']
    ]) {
        test = setup(sessions);
        assert.equal(test.app.removeStudentSession('Alice', selector), true);
        const saved = JSON.parse(test.stored);
        assert.deepEqual(saved.Alice.sessions.map(session => session.id), remaining);
        assert.equal(saved.Bob.sessions[0].id, 'other');
        assert.deepEqual(test.markers, [['Alice', deleted]], 'The marker must use the removed entry\'s sync identity');
        assert.deepEqual(test.events, ['save', 'marker', 'render']);
    }
    for (const [student, selector] of [['Alice', '0'], ['Alice', 'missing'], ['Missing', 'saved'], ['', 'saved'], ['Alice', '']]) {
        test = setup([{ id: 'saved' }, { id: 'keep' }]);
        const original = test.stored;
        assert.equal(test.app.removeStudentSession(student, selector), false);
        assert.equal(test.stored, original);
        assert.deepEqual(test.events, []);
    }
    test = setup([{ id: 'saved' }]);
    await test.app.deletePortfolioSession('Alice', 'missing');
    assert.match(test.alerts[0], /could not be found/i);
    test = setup([{ id: 'saved' }], { confirm: false });
    await test.app.deletePortfolioSession('Alice', 'saved');
    assert.deepEqual(test.events, []);
    test = setup([{ id: 'saved' }], { failRender: true });
    await test.app.deletePortfolioSession('Alice', 'saved');
    assert.deepEqual(JSON.parse(test.stored).Alice.sessions, []);
    assert.deepEqual(test.alerts, [], 'A display error must not misreport a successful removal as a failed save');
    console.log('Portfolio removal tests passed: one exact entry, stable and legacy identities, stale references, save-before-marker ordering, quota failure, cancellation and display failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
