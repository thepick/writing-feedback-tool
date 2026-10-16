const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const cases = [];
const plain = value => JSON.parse(JSON.stringify(value));
function load(context, source, names) {
    for (const name of names) {
        const start = source.lastIndexOf('function ' + name + '(');
        const end = source.indexOf('\n}', start) + 2;
        assert.ok(start >= 0 && end > start, name);
        vm.runInContext(source.slice(start, end), context);
    }
}
function check(name, fn) {
    try { fn(); cases.push({ name, passed: true }); }
    catch (e) { cases.push({ name, passed: false, error: e.message }); }
}
const main = read('js/app/10-main-app.js'), textMetrics = read('js/app/20-text-metrics.js'), diffEngine = read('js/app/21-diff-engine.js'), patch = read('js/app/00-storage-sync-patches.js');
const ctx = vm.createContext({});
load(ctx, textMetrics, ['analyzeSentenceStarters', 'getShortSentenceRun', 'analyzeSentenceVariety', 'stripCorrectionMarkdown']);
load(ctx, diffEngine, ['normalizeDiffToken', 'tokenizeForDiff', 'buildLcsMatrix']);
load(ctx, main, ['titleCaseGeneratedWritingTitle', 'getDiffOperations', 'analyzeGrammarChanges']);
for (const word of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'ordinary']) {
    check('starter-count-' + word, () => assert.deepEqual(plain(ctx.analyzeSentenceStarters([word + ' arrives.', word + ' leaves.'])), { mostCommonStarter: word.toLowerCase(), count: 2, ratio: 1 }));
}
check('normal-flow-calibration', () => {
    const result = plain(ctx.analyzeSentenceVariety([3, 10, 17], ['We went home.', 'Then we arrived.', 'After that we left.']));
    assert.equal(result.varietyScore, 100); assert.equal(result.varietyLabel, 'Strong'); assert.equal(result.flowRating, 'Good');
    assert.deepEqual(result.starterInfo, { mostCommonStarter: 'we', count: 1, ratio: 1 / 3 });
});
check('repeated-inherited-starter-flow-penalty', () => {
    const result = ctx.analyzeSentenceVariety([3, 10, 17], ['constructor goes.', 'constructor stays.', 'constructor leaves.']);
    assert.equal(result.varietyScore, 80); assert.equal(result.flowRating, 'Needs Improvement');
});
check('normal-title-calibration', () => assert.equal(ctx.titleCaseGeneratedWritingTitle('a walk in the park'), 'A Walk in the Park'));
check('inherited-title-word', () => assert.equal(ctx.titleCaseGeneratedWritingTitle('My constructor story'), 'My Constructor Story'));
check('grammar-noun-not-verb-with-real-lcs', () => assert.equal(ctx.analyzeGrammarChanges('The constructor works.', 'The builder works.').verbIssues, 0));
check('grammar-real-verb-helper-with-real-lcs', () => { const r = ctx.analyzeGrammarChanges('We was happy.', 'We were happy.'); assert.equal(r.verbIssues, 1); assert.equal(r.helperVerbIssues, 1); });
const photos = vm.createContext({});
load(photos, patch, ['cloneWftJson', 'stableStringify', 'mergeSessionImageRefs', 'getTimeMs', 'chooseNewerSession']);
const mergePhoto = (a, b) => plain(photos.mergeSessionImageRefs({ images: [a] }, { images: [b] })).images[0];
check('same-revision-fill-missing-reference', () => {
    const p = mergePhoto({ imageId: 'photo', imageRevision: 'r1', name: 'new-name', driveFileId: '', dataUrl: '', pendingDriveUpload: true }, { imageId: 'photo', imageRevision: 'r1', driveFileId: 'uploaded', dataUrl: 'same-bytes', name: 'old-name' });
    assert.equal(p.driveFileId, 'uploaded'); assert.equal(p.dataUrl, 'same-bytes'); assert.equal(p.name, 'new-name'); assert.equal(p.pendingDriveUpload, false);
});
check('crop-revision-blocks-old-reference', () => {
    const a = { imageId: 'photo', imageRevision: 'new', dataUrl: 'crop', driveFileId: '', name: 'crop.png' };
    assert.deepEqual(mergePhoto(a, { imageId: 'photo', imageRevision: 'old', dataUrl: 'original', driveFileId: 'obsolete' }), a);
});
check('reset-revision-blocks-old-reference', () => {
    const a = { imageId: 'photo', imageRevision: 'reset', dataUrl: 'original', driveFileId: '' };
    assert.deepEqual(mergePhoto(a, { imageId: 'photo', dataUrl: 'crop', driveFileId: 'obsolete' }), a);
});
check('legacy-changed-bytes-block-old-reference', () => assert.equal(mergePhoto({ imageId: 'photo', dataUrl: 'new', driveFileId: '' }, { imageId: 'photo', dataUrl: 'old', driveFileId: 'old-ref' }).driveFileId, ''));
check('new-drive-reference-blocks-old-inline-bytes', () => assert.equal(mergePhoto({ imageId: 'photo', driveFileId: 'new-ref', dataUrl: '' }, { imageId: 'photo', driveFileId: 'old-ref', dataUrl: 'old-bytes' }).dataUrl, ''));
check('legacy-fill-missing-reference', () => assert.equal(mergePhoto({ driveFileId: 'legacy-ref', dataUrl: '' }, { driveFileId: 'legacy-ref', dataUrl: 'legacy-bytes' }).dataUrl, 'legacy-bytes'));
check('distinct-image-order-preserved', () => assert.deepEqual(plain(photos.mergeSessionImageRefs({ photos: [{ imageId: 'a' }, { imageId: 'b' }] }, { photos: [{ imageId: 'b' }, { imageId: 'c' }] })).photos.map(i => i.imageId), ['a', 'b', 'c']));
check('untrusted-image-field-cannot-change-prototype', () => {
    const p = photos.mergeSessionImageRefs({ images: [{ imageId: 'a' }] }, { images: [JSON.parse('{"imageId":"a","__proto__":{"tainted":true}}')] }).images[0];
    assert.equal(p.tainted, undefined); assert.equal(vm.runInContext('Object.prototype.tainted', photos), undefined);
});
const migration = vm.createContext({ window: {}, Blob });
vm.runInContext(read('google-drive-migration.js'), migration);
check('migration-text-keys-and-valid-media-reference', () => {
    const input = JSON.parse('{"constructor":"constructor","__proto__":{"title":"toString"},"originalText":"constructor","images":[{"driveFileId":"old-media"}]}');
    const ids = { 'old-media': 'new-media' };
    const expected = plain(input); expected.images[0].driveFileId = 'new-media';
    assert.deepEqual(plain(migration.window.GoogleDriveMigration.remap(input, ids)), expected);
});
check('migration-only-own-mappings', () => {
    const ids = Object.create({ constructor: 'inherited', 'old-media': 'inherited-media' });
    assert.deepEqual(plain(migration.window.GoogleDriveMigration.remap({ title: 'constructor', driveFileId: 'old-media' }, ids)), { title: 'constructor', driveFileId: 'old-media' });
});
check('migration-valid-unusual-own-mapping-and-blob', () => {
    const ids = JSON.parse('{"constructor":"new-id","__proto__":"new-other"}'), blob = new Blob(['synthetic']);
    const output = migration.window.GoogleDriveMigration.remap({ title: 'constructor', blob }, ids);
    assert.equal(output.title, 'new-id'); assert.equal(output.blob, blob);
    assert.deepEqual(plain(migration.window.GoogleDriveMigration.remap(JSON.parse('{"__proto__":"__proto__"}'), ids)), { 'new-other': 'new-other' });
});
// Shipped implementations are checked with their actual deletion and ID dependencies.
for (const file of ['js/app/00-storage-sync-patches.js']) {
    const c = vm.createContext({ WFT_LAMPORT_V1: false, WFT_TOMBSTONE_COMPACTION_V1: false });
    load(c, patch, ['cloneWftJson', 'stableStringify', 'mergeSessionImageRefs', 'getTimeMs', 'getEmptyDeletionsData', 'compactDeletions', 'normalizeDeletionsData']);
    const source = read(file);
    const names = ['getWftDeletionRecords', 'isStudentSessionDeleted', 'chooseNewerSession', 'mergeStudentSessions', 'mergeWftStringArrays'];
    load(c, source, names);
    for (const id of ['__proto__', 'constructor', 'toString']) {
        check(file + ':session-' + id, () => {
            const sess = { id, createdAt: '2026-10-01', updatedAt: '2026-10-01' };
            const result = c.mergeStudentSessions([sess], [], {});
            assert.equal(result.length, 1); assert.equal(result[0].id, id);
            assert.equal(c.mergeStudentSessions([sess], [], { records: [{ type: 'session', sessionId: id, deletedAt: '2026-10-02' }] }).length, 0);
        });
    }
    check(file + ':ordered-own-key-dedupe', () => assert.deepEqual(plain(c.mergeWftStringArrays(['constructor', '__proto__', 'Alice'], ['Alice', 'toString', 'constructor'])), ['constructor', '__proto__', 'Alice', 'toString']));
}
for (const file of ['js/app/00-storage-sync-patches.js']) {
    let stored = {};
    const c = vm.createContext({ readWftRequiredStorage: () => plain(stored), getRawSettings: () => plain(stored), saveSettingsToLocalStorage: settings => { stored = plain(settings); } });
    load(c, read(file), ['getWftShortIdPart', 'sanitizeStudentIdPart', 'createStableStudentId', 'getOrCreateStudentId']);
    for (const name of ['constructor', '__proto__', 'toString']) {
        check(file + ':student-id-' + name, () => { const a = c.getOrCreateStudentId(name); assert.equal(typeof a, 'string'); assert.equal(c.getOrCreateStudentId(name), a); assert.ok(Object.hasOwn(stored.studentIdMap, name)); });
    }
}
check('shipped-schema-normalization-own-student-key', () => {
    const c = vm.createContext({ WFT_STUDENT_ID_MAP_V1: false });
    load(c, patch, ['isWftPortfolioStudentKey', 'normalizeWftSessionDate', 'normalizeWftSessionForStorage', 'normalizeWftStudentRecord', 'normalizeWftPortfolioForSchemaV1']);
    const data = JSON.parse('{"__proto__":{"sessions":[{"id":"constructor","createdAt":"2026-10-01"}]}}');
    assert.deepEqual(plain(c.normalizeWftPortfolioForSchemaV1(data)), data);
});
check('shipped-storage-strip-own-student-key', () => {
    const c = vm.createContext({}); load(c, patch, ['makeImageMetadataLocalStorageSafe', 'makeSessionLocalStorageSafe', 'makePortfolioLocalStorageSafe']);
    const result = plain(c.makePortfolioLocalStorageSafe(JSON.parse('{"__proto__":{"sessions":[{"id":"constructor","images":[{"dataUrl":"synthetic","driveFileId":"ref"}]}]}}')));
    assert.ok(Object.hasOwn(result, '__proto__')); assert.equal(result.__proto__.sessions[0].images[0].driveFileId, 'ref'); assert.equal(result.__proto__.sessions[0].images[0].dataUrl, '');
});
check('shipped-portfolio-index-own-student-key', () => {
    const c = vm.createContext({ WFT_STUDENT_ID_MAP_V1: true, getRawSettings: () => ({ studentIdMap: {} }), localStorage: { getItem: () => null } });
    load(c, patch, ['sanitizeStudentIdPart']);
    load(c, patch, ['isWftPortfolioStudentKey', 'buildPortfolioIndexFromPortfolio']);
    const result = plain(c.buildPortfolioIndexFromPortfolio(JSON.parse('{"__proto__":{"sessions":[]},"constructor":{"sessions":[]}}')));
    assert.ok(Object.hasOwn(result.students, '__proto__')); assert.equal(result.students.constructor.studentId, '');
});
check('shipped-split-index-own-student-key', () => {
    const c = vm.createContext({}); load(c, patch, ['rebuildIndexFromStudentFiles']);
    assert.ok(Object.hasOwn(plain(c.rebuildIndexFromStudentFiles({ file: { studentId: '__proto__', format: 'student-portfolio-v1', sessions: [] } })).students, '__proto__'));
});
check('shipped-roster-ensure-and-rename-own-student-key', () => {
    let settings = {};
    const c = vm.createContext({ WFT_STUDENT_ID_MAP_V1: true, students: ['constructor', '__proto__'], readWftRequiredStorage: () => plain(settings), getRawSettings: () => plain(settings), saveSettingsToLocalStorage: value => { settings = plain(value); }, getPortfolioData: () => ({}) });
    load(c, patch, ['getWftShortIdPart', 'sanitizeStudentIdPart', 'createStableStudentId', 'getOrCreateStudentId']);
    load(c, patch, ['isWftPortfolioStudentKey', 'getStudentRecordByName', 'ensureStudentRecordsForRoster', 'updateStudentRecordOnRename']);
    c.ensureStudentRecordsForRoster();
    assert.equal(typeof settings.studentIdMap.constructor, 'string'); assert.ok(Object.hasOwn(settings.studentIdMap, '__proto__'));
    const first = settings.studentIdMap.constructor; c.updateStudentRecordOnRename('constructor', '__proto__', settings);
    assert.equal(settings.studentIdMap.__proto__, first);
});
if (process.env.WFT_CASE_OUTPUT) fs.writeFileSync(process.env.WFT_CASE_OUTPUT, JSON.stringify({ root, cases }, null, 2) + '\n');
console.log(JSON.stringify({ suite: 'record-identity', cases: cases.length, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed) }, null, 2));
if (cases.some(c => !c.passed)) process.exitCode = 1;
