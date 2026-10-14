const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/10-main-app.js'), 'utf8');
const patches = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const recovery = fs.readFileSync(path.join(__dirname, '../js/app/storage-recovery.js'), 'utf8');
const recoveryStart = recovery.indexOf('function restoreWftStudentChangeStorage(');
const recoveryEnd = recovery.indexOf('function parseWftBackupValue(', recoveryStart);
assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
const commitSource = recovery.slice(recoveryStart, recoveryEnd)
    + patches.slice(patches.indexOf('function saveWftStudentChange('), patches.indexOf('function applyDeletionsToStudents('));
const extracted = commitSource + [
    ['removeStudent', 'getPreferredStudentForManagement'],
    ['clearAllStudents', 'exportStudents'],
    ['resetCurrentClassData', 'updateSelectedImagePreview']
].map(([first, last]) => {
    const start = source.indexOf('async function ' + first + '(');
    const end = source.indexOf('function ' + last + '(', start);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}).join('\n');
function setup(options = {}) {
    let stored = JSON.stringify({ Alice: { sessions: [{ id: 'a' }] }, Bob: { sessions: [{ id: 'b' }] }, Archived: { sessions: [{ id: 'c' }] } });
    const events = [], markers = [], writes = [], alerts = [], confirmations = [];
    const app = vm.runInNewContext(extracted + '\n;globalThis', {
        students: ['Alice', 'Bob'], selectedStudent: 'Alice',
        wftConfirm: async message => { confirmations.push(message); return options.confirm !== false; },
        getPortfolioData: () => JSON.parse(stored),
        savePortfolioData: value => { if (options.failSave) throw new Error('Storage full'); stored = JSON.stringify(value); events.push('portfolio-save'); },
        getDeletionsData: () => ({ markers: [] }), getRawSettings: () => ({}),
        recordStudentDeletion: (name, data) => data.markers.push(['student', name]),
        recordSessionDeletion: (name, id, data) => data.markers.push(['session', name, id]),
        saveDeletionsData: data => { markers.push(...data.markers); data.markers.forEach(() => events.push('marker')); },
        syncSavedPortfolioData() {}, wftSuppressDirtyMarks: true,
        getSessionKey: session => session.id,
        // Required-read failures are exercised with the full native storage-integrity fixture.
        preflightWftRequiredStorage() {}, readWftRequiredStorage: () => ({}),
        cloneWftJson: value => JSON.parse(JSON.stringify(value)),
        localStorage: { getItem: () => null, setItem: (key, value) => { writes.push([key, value]); if (key === 'wft_students') events.push('roster-save'); } },
        WFT_DELETIONS_STORAGE_KEY: 'wft_deletions',
        saveStudents: () => events.push('roster-save'),
        renderStudentList: () => events.push('render'), populateStudentDropdown() {},
        refreshPortfolioDropdown() {}, renderStudentPortfolio() {},
        WFT_SYNC_ENGINE_V2: true,
        markWftSettingsDirty: () => events.push('settings-dirty'),
        markWftPortfolioDirty: () => events.push('portfolio-dirty'),
        markWftDeletionsDirty: () => events.push('deletions-dirty'),
        flushWftCloudSyncNow: () => events.push('flush'),
        setWftArchiveStatus: () => events.push('status'),
        alert: message => alerts.push(message), wftDebugError() {}, wftDebugWarn() {}
    });
    return { app, events, markers, writes, alerts, confirmations, get stored() { return stored; } };
}
function assertSuccessfulDeletion(action, success) {
    assert.equal(success.events[0], 'portfolio-save', action + ': save before markers or roster changes');
    assert.equal(success.events.filter(event => event === 'portfolio-save').length, 1);
    assert.equal(success.events.indexOf('roster-save') > success.events.lastIndexOf('marker'), true);
    assert.equal(success.app.selectedStudent, '');
    assert.deepEqual(success.alerts, []);
    if (action === 'removeStudent') {
        assert.deepEqual(Object.keys(JSON.parse(success.stored)), ['Bob', 'Archived']);
        assert.deepEqual(Array.from(success.app.students), ['Bob']);
        assert.deepEqual(success.markers, [['student', 'Alice']]);
    } else {
        assert.deepEqual(JSON.parse(success.stored), {});
        assert.deepEqual(Array.from(success.app.students), []);
        assert.ok(success.markers.some(marker => marker[1] === 'Bob'));
    }
    if (action === 'resetCurrentClassData') {
        assert.ok(success.markers.some(marker => marker[0] === 'student' && marker[1] === 'Archived'));
        assert.deepEqual(success.markers.filter(marker => marker[0] === 'session'), [['session', 'Alice', 'a'], ['session', 'Bob', 'b'], ['session', 'Archived', 'c']]);
        assert.deepEqual(success.events.slice(-5), ['settings-dirty', 'portfolio-dirty', 'deletions-dirty', 'flush', 'status']);
    }
    if (action === 'clearAllStudents') assert.match(success.confirmations[0], /all saved writing/i);
}
(async () => {
    const failures = [];
    for (const action of ['resetCurrentClassData', 'clearAllStudents', 'removeStudent']) {
        const test = setup({ failSave: true });
        const before = test.stored;
        let error;
        try { await test.app[action]('Alice'); } catch (failure) { error = failure; }
        failures.push({ action, test, before, error });
    }
    for (const { action, test, before, error } of failures) {
        assert.deepEqual(test.markers, [], action + ': a failed save must not tombstone saved writing');
        assert.equal(test.stored, before);
        assert.deepEqual(Array.from(test.app.students), ['Alice', 'Bob']);
        assert.equal(test.app.selectedStudent, 'Alice');
        assert.deepEqual(test.writes, [], action + ': selection and roster storage must be untouched');
        assert.deepEqual(test.events, [], action + ': no render, dirty mark, flush or success status');
        assert.equal(error, undefined, action + ': show an error without an unhandled rejection');
        assert.match(test.alerts[0], /could not/i);
    }
    for (const action of ['resetCurrentClassData', 'clearAllStudents', 'removeStudent']) {
        const cancelled = setup({ confirm: false });
        await cancelled.app[action]('Alice');
        assert.deepEqual(cancelled.events, []);
        assert.deepEqual(cancelled.writes, []);
        const success = setup();
        await success.app[action]('Alice');
        assertSuccessfulDeletion(action, success);
    }
    const nonselected = setup();
    await nonselected.app.removeStudent('Bob');
    assert.equal(nonselected.app.selectedStudent, 'Alice');
    assert.equal(nonselected.writes.find(([key]) => key === 'wft_selectedStudent')[1], 'Alice');
    console.log('Class deletion tests passed: reset, clear and individual deletion preserve writing, roster, selection and markers on failed saves; successful deletion order, reset sync and cancellation remain intact.');
})().catch(error => { console.error(error); process.exitCode = 1; });
