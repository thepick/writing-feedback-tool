const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const names = ['stableStringify', 'cloneWftJson', 'getEmptyDeletionsData', 'compactDeletions', 'normalizeDeletionsData', 'getDeletedStudentKey', 'getWftTombstoneTimeMs', 'isStudentDeletedByTombstone', 'mergeWftDeletions', 'getWftDeletionRecords', 'isStudentSessionDeleted'];
const code = names.map(name => {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\nfunction ', start + 1);
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}).join('\n');
const app = vm.runInNewContext(code + '\n;globalThis', { WFT_TOMBSTONE_COMPACTION_V1: false, WFT_LAMPORT_V1: true });
const clone = value => JSON.parse(JSON.stringify(value));
const old = '2026-10-01T00:00:00Z', middle = '2026-10-02T00:00:00Z', newest = '2026-10-03T00:00:00Z';
const local = {
    deletedStudents: { 'student:bob': { deletedAt: old }, 'student:local': { deletedAt: newest } },
    restoredStudents: { 'student:alice': { restoredAt: old }, 'student:bob': { restoredAt: middle } },
    deletedSessions: { 'session:alice:essay': { deletedAt: old, lamportClock: 1 } },
    records: [{ id: 'local', type: 'archive-remove', sessionId: 'archived', studentId: 'alice', deletedAt: newest, lamportClock: 5 }, { id: 'same', deletedAt: old }, { sessionId: 'legacy', deletedAt: old }]
};
const cloud = {
    deletedStudents: { 'student:alice': { deletedAt: middle }, 'student:bob': { deletedAt: newest } },
    restoredStudents: { 'student:alice': { restoredAt: newest } },
    deletedSessions: { 'session:alice:essay': { deletedAt: newest, lamportClock: 7 } },
    records: [{ id: 'cloud', sessionId: 'cloud-essay', deletedAt: newest }, { id: 'same', deletedAt: newest, lamportClock: 9 }, { deletedAt: old, sessionId: 'legacy' }]
};
const before = clone({ local, cloud });
const merged = app.mergeWftDeletions(local, cloud);
assert.equal(app.isStudentDeletedByTombstone('Alice', merged), false, 'A newer cloud restore must survive an older local restore');
assert.equal(app.isStudentDeletedByTombstone('Bob', merged), true, 'A newer cloud deletion must survive an older local deletion');
assert.equal(merged.deletedSessions['session:alice:essay'].lamportClock, 7);
assert.ok(merged.deletedStudents['student:local']);
assert.equal(merged.records.length, 4, 'Keep both histories and deduplicate shared IDs and identical ID-less records');
assert.equal(merged.records.find(r => r.id === 'same').lamportClock, 9);
assert.equal(app.isStudentSessionDeleted('archived', 'alice', merged, newest, 4), true, 'Record-only archive removals must still filter split student files');
assert.equal(app.isStudentSessionDeleted('archived', 'alice', merged, newest, 5), false, 'Preserve the existing Lamport comparison');
assert.deepEqual(clone({ local, cloud }), before);
merged.records.find(r => r.id === 'local').reason = 'changed';
merged.deletedStudents['student:local'].reason = 'changed';
assert.deepEqual(clone({ local, cloud }), before, 'Merged values must not alias the source');
for (const collection of ['deletedStudents', 'restoredStudents', 'deletedSessions']) {
    const field = collection === 'restoredStudents' ? 'restoredAt' : 'deletedAt';
    for (const [localTime, cloudTime, expected] of [[newest, old, 'local'], [old, newest, 'cloud'], [newest, newest, 'local'], ['invalid', newest, 'cloud'], [newest, 'invalid', 'local']]) {
        const result = app.mergeWftDeletions({ [collection]: { key: { [field]: localTime, origin: 'local' } } }, { [collection]: { key: { [field]: cloudTime, origin: 'cloud' } } });
        assert.equal(result[collection].key.origin, expected, collection);
    }
}
const repeated = app.mergeWftDeletions(local, app.mergeWftDeletions(local, cloud));
assert.equal(repeated.records.length, 4, 'A repeated merge must not grow the deletion history');
assert.equal(repeated.records.find(r => r.id === 'same').lamportClock, 9);
assert.equal(app.mergeWftDeletions({}, {}).records.length, 0);
console.log('Deletion merge tests passed: newest markers win, restores/deletions retain their meaning, histories survive and repeated merges do not duplicate records.');
