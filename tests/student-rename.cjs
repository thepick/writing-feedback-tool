const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const patches = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const commitSource = patches.slice(patches.indexOf('function restoreWftStudentChangeStorage('), patches.indexOf('function parseWftBackupValue('))
    + patches.slice(patches.indexOf('function saveWftStudentChange('), patches.indexOf('function applyDeletionsToStudents('));
const source = fs.readFileSync(path.join(__dirname, '../js/app/10-main-app.js'), 'utf8');
const start = source.indexOf('async function renameStudent(');
const end = source.indexOf('async function clearAllStudents(', start);
assert.ok(start >= 0 && end > start);
function setup(options = {}) {
    const original = options.portfolio || { Alice: { sessions: [{ id: 'saved', originalText: 'Keep this writing' }] }, Bob: { sessions: [{ id: 'other' }] } };
    let stored = JSON.stringify(original);
    const events = [], alerts = [], writes = [];
    const app = vm.runInNewContext(commitSource + source.slice(start, end) + '\n;globalThis', {
        students: ['Alice', 'Bob'], selectedStudent: 'Alice',
        wftTextInput: async () => Object.hasOwn(options, 'name') ? options.name : 'Alicia', wftConfirm: async () => options.confirm !== false,
        getLocalPortfolioSnapshot: () => JSON.parse(stored),
        savePortfolioData: data => { if (options.failSave) throw new Error('Storage full'); stored = JSON.stringify(data); events.push('portfolio-save'); },
        getDeletionsData: () => ({ events: [] }), getRawSettings: () => ({}),
        clearStudentDeletion: (name, data) => data.events.push('restore:' + name),
        recordStudentDeletion: (name, data) => data.events.push('delete:' + name),
        saveDeletionsData: data => events.push(...data.events),
        updateStudentRecordOnRename: (oldName, newName, settings) => { settings.recordEvent = 'record:' + oldName + ':' + newName; },
        syncSavedPortfolioData() {}, wftSuppressDirtyMarks: true, WFT_DELETIONS_STORAGE_KEY: 'wft_deletions',
        // Required-read failures are exercised with the full native storage-integrity fixture.
        preflightWftRequiredStorage() {}, readWftRequiredStorage: () => ({}),
        localStorage: { getItem: () => null, setItem: (key, value) => { writes.push([key, value]); if (key === 'wft_students') events.push('roster-save'); if (key === 'wft_settings') events.push(JSON.parse(value).recordEvent); } },
        saveStudents: () => events.push('roster-save'),
        document: { getElementById: () => null }, renderStudentList() {}, populateStudentDropdown() {},
        refreshPortfolioDropdown() {}, renderStudentPortfolio() {}, updateExportSelectedStudentButton() {},
        alert: message => alerts.push(message), wftDebugError() {}
    });
    return { app, events, alerts, writes, original, get stored() { return stored; } };
}
(async () => {
    const failure = setup({ failSave: true });
    const before = failure.stored;
    let failureError;
    try { await failure.app.renameStudent('Alice'); } catch (error) { failureError = error; }
    assert.equal(failure.stored, before);
    assert.deepEqual(Array.from(failure.app.students), ['Alice', 'Bob']);
    assert.equal(failure.app.selectedStudent, 'Alice');
    assert.deepEqual(failure.events, [], 'Failed renames must not change deletion/restoration markers, student records or roster');
    assert.equal(failureError, undefined, 'A failed save must be reported to the teacher');
    assert.deepEqual(failure.writes, []);
    assert.match(failure.alerts[0], /could not be renamed/i);
    const success = setup();
    await success.app.renameStudent('Alice');
    const saved = JSON.parse(success.stored);
    assert.equal(saved.Alicia.sessions[0].originalText, 'Keep this writing');
    assert.equal(saved.Alice, undefined);
    assert.deepEqual(saved.Bob, success.original.Bob);
    assert.deepEqual(success.events, ['portfolio-save', 'restore:Alicia', 'delete:Alice', 'roster-save', 'record:Alice:Alicia']);
    assert.deepEqual(Array.from(success.app.students), ['Alicia', 'Bob']);
    assert.equal(success.app.selectedStudent, 'Alicia');
    const casing = setup({ name: 'ALICE' });
    await casing.app.renameStudent('Alice');
    assert.equal(casing.events.some(event => event.startsWith('delete:')), false, 'A casing correction must not delete the same normalized student');
    assert.equal(JSON.parse(casing.stored).ALICE.sessions[0].id, 'saved');
    for (const options of [{ name: 'Bob' }, { name: 'Alice' }, { name: ' ' }, { name: null }, { confirm: false }, { portfolio: { Alice: { sessions: [] }, Alicia: { sessions: [] } } }]) {
        const test = setup(options);
        await test.app.renameStudent('Alice');
        assert.deepEqual(test.events, []);
        assert.deepEqual(test.writes, []);
        assert.deepEqual(JSON.parse(test.stored), test.original);
    }
    console.log('Student rename tests passed: failed saves preserve history, roster, selection and deletion markers; successful and casing-only renames and validation remain intact.');
})().catch(error => { console.error(error); process.exitCode = 1; });
