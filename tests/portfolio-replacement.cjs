const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function functions(file, first, last) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const start = source.indexOf('function ' + first + '(');
    const end = last ? source.indexOf('function ' + last + '(', start) : source.length;
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}
const source = functions('js/app/10-main-app.js', 'findPortfolioSessionIndex', 'renderNotebookDetailedAssessmentFromSavedSession')
    + functions('js/app/00-storage-sync-patches.js', 'restoreWftStudentChangeStorage', 'parseWftBackupValue')
    + functions('js/app/00-storage-sync-patches.js', 'saveWftStudentChange', 'applyDeletionsToStudents')
    + functions('js/app/00-storage-sync-patches.js', 'commitPendingPortfolioReplacement');
const copy = value => JSON.parse(JSON.stringify(value));
function setup(portfolio, sourceId = 'old', target = 'Alice') {
    let stored = copy(portfolio), saves = 0, renders = 0, deletionSaves = 0;
    const events = [], deletions = [];
    const pending = { studentName: target, sessionData: { id: 'new', originalText: 'Keep my writing' }, replaceSource: { sourceStudentName: 'Alice', sourceSessionId: sourceId }, signature: 'new-signature' };
    const app = vm.runInNewContext(source + '\n;globalThis', {
        getPortfolioData: () => copy(stored),
        savePortfolioData: value => { stored = copy(value); saves++; events.push('save'); },
        getDeletionsData: () => ({ markers: [] }),
        recordSessionDeletion: (student, id, data) => data.markers.push([student, id]),
        saveDeletionsData: data => { deletionSaves++; deletions.push(...data.markers); data.markers.forEach(() => events.push('delete')); },
        // Required-read failures are exercised with the full native storage-integrity fixture.
        preflightWftRequiredStorage() {}, readWftRequiredStorage: () => ({}),
        localStorage: { getItem: () => null }, WFT_DELETIONS_STORAGE_KEY: 'wft_deletions', wftSuppressDirtyMarks: true,
        syncSavedPortfolioData() {},
        renderStudentPortfolio: () => { renders++; },
        wftDebugError() {}, wftSyncLog() {},
        getPendingPortfolioSync: () => pending,
        clearPendingPortfolioSync: () => { app.pendingCleared = true; },
        getCurrentPortfolioSessionSignature: () => 'current-signature',
        lastSyncedPortfolioSessionSignature: 'previous-signature'
    });
    return { app, pending, events, deletions, get stored() { return stored; }, get saves() { return saves; }, get renders() { return renders; }, get deletionSaves() { return deletionSaves; } };
}

let test = setup({ Alice: { sessions: [{ id: 'old' }, { id: 'keep' }] } });
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.deepEqual(test.stored.Alice.sessions.map(session => session.id), ['new', 'keep']);
assert.deepEqual(test.deletions, [['Alice', 'old']]);
assert.equal(test.app.pendingCleared, true);
assert.equal(test.app.lastSyncedPortfolioSessionSignature, 'new-signature');

test = setup({ Alice: { sessions: [{ id: 'keep' }] }, Bob: { sessions: [{ id: 'other' }] } }, 'missing', 'Bob');
const before = copy(test.stored);
assert.equal(test.app.commitPendingPortfolioSync(), false, 'A missing original must not silently add the replacement twice');
assert.deepEqual(test.stored, before);
assert.equal(test.saves, 0);
assert.deepEqual(test.deletions, []);
assert.equal(test.app.pendingCleared, undefined, 'Unsaved reassessment must stay pending');
assert.equal(test.app.lastSyncedPortfolioSessionSignature, 'previous-signature');

test = setup({}, 'missing', 'Bob');
assert.equal(test.app.commitPendingPortfolioReplacement(test.pending), false);
assert.deepEqual(test.stored, {}, 'Missing students must not be created on failed replacement');

test = setup({ Alice: { sessions: [{ id: 'keep' }] } }, 'missing');
assert.equal(test.app.commitPendingPortfolioSync(), false, 'A same-student missing original must not report success and discard pending work');
assert.equal(test.app.pendingCleared, undefined);

test = setup({ Alice: { sessions: [{ id: 'old' }, { id: 'keep' }] }, Bob: { sessions: [{ id: 'other' }] } }, 'old', 'Bob');
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.deepEqual(test.stored.Alice.sessions.map(session => session.id), ['keep']);
assert.deepEqual(test.stored.Bob.sessions.map(session => session.id), ['other', 'new']);
assert.deepEqual(test.events, ['save', 'delete'], 'Do not record a deletion until the replacement saves');
assert.deepEqual(test.deletions, [['Alice', 'old']]);

test = setup({ Alice: { sessions: [{ id: 'first' }, { id: 'second' }, { id: '1' }] } }, '1');
assert.equal(test.app.findPortfolioSession('Alice', '1').id, '1', 'Stable IDs take priority over list positions');
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.deepEqual(test.stored.Alice.sessions.map(session => session.id), ['first', 'second', 'new']);

for (const [session, id] of [[{ createdAt: '2026-01-01' }, '2026-01-01'], [{ id: 'assigned-later', createdAt: '2026-01-01' }, '2026-01-01'], [{ title: 'Legacy' }, '0']]) {
    test = setup({ Alice: { sessions: [session] } }, id);
    assert.ok(test.app.findPortfolioSession('Alice', id));
    assert.equal(test.app.commitPendingPortfolioSync(), true, 'Legacy timestamp and ID-less index references still work');
}
test = setup({ Alice: { sessions: [{ id: 'stable' }] } }, '0');
assert.equal(test.app.findPortfolioSession('Alice', '0'), null, 'A stale index must not select an entry with a different stable ID');
assert.equal(test.app.commitPendingPortfolioSync(), false);

test = setup({ Alice: { sessions: [{ id: 'old' }] } });
test.pending.sessionData.id = 'old';
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.deepEqual(test.deletions, [], 'Replacing in place with the same ID must not tombstone the replacement');
assert.equal(test.deletionSaves, 0, 'An in-place update does not need a deletion-log write');

test = setup({ Alice: { sessions: [{ id: 'old' }] } }, 'old', 'Bob');
test.pending.sessionData.id = 'old';
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.deepEqual(test.stored.Bob.sessions.map(session => session.id), ['old']);
assert.deepEqual(test.deletions, [['Alice', 'old']], 'Moving with the same ID still removes the source student copy');

test = setup({ Alice: { sessions: [{ id: 'old' }] }, Bob: { sessions: Array.from({ length: 50 }, (_, index) => ({ id: 'b' + index })) } }, 'old', 'Bob');
assert.equal(test.app.commitPendingPortfolioSync(), true);
assert.equal(test.stored.Bob.sessions.length, 50);
assert.equal(test.stored.Bob.sessions[0].id, 'b1');
assert.equal(test.stored.Bob.sessions[49].id, 'new');

test = setup({ Alice: { sessions: [{ id: 'old' }] } });
test.app.savePortfolioData = () => { throw new Error('Storage full'); };
assert.equal(test.app.commitPendingPortfolioSync(), false);
assert.equal(test.stored.Alice.sessions[0].id, 'old');
assert.deepEqual(test.deletions, [], 'A failed portfolio save must not mark the still-saved original as deleted');
assert.equal(test.app.pendingCleared, undefined);
assert.equal(test.renders, 0);

test = setup({ Alice: { sessions: [{ id: 'old' }] } });
test.app.renderStudentPortfolio = () => { throw new Error('Render failed'); };
assert.equal(test.app.commitPendingPortfolioSync(), true, 'A display failure must not undo a successful save');
assert.equal(test.stored.Alice.sessions[0].id, 'new');
assert.equal(test.app.commitPendingPortfolioReplacement(null), false);
console.log('Portfolio replacement tests passed: exact matching, single moves, missing-source preservation, legacy references, retention limit, save failures and display failures.');
