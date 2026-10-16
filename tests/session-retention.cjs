const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const cases = [];
function load(file, names, globals) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    return vm.runInNewContext(names.map(name => {
        const start = source.indexOf('function ' + name + '(');
        assert(start >= 0);
        const next = source.slice(start + 1).search(/^function /m);
        return source.slice(start, next < 0 ? source.length : start + 1 + next);
    }).join('\n') + '\n;globalThis', globals);
}
function run(name, fn) { try { fn(); cases.push({ name, passed: true }); } catch (error) { cases.push({ name, passed: false, error: error.message }); } }
for (const file of ['js/app/00-storage-sync-patches.js']) {
    let ticks = 0, ids = 0;
    // A ticking clock exposes order changes caused by assigning a different "now" to each undated record.
    class TickingDate extends Date { constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 9, 12) + ticks++])); } }
    const app = load(file, ['normalizeWftSessionDate', 'normalizeWftSessionForStorage', 'normalizeWftStudentRecord'], { Date: TickingDate, createWftId: () => 'assigned-' + ++ids });
    run(file + ': parsed chronological dates and fallback precedence', () => {
        const entries = [
            { id: 'old', createdAt: 'Sun, 01 Feb 2026 00:00:00 GMT' },
            { id: 'latest', createdAt: '2026-03-01T00:00:00+00:00', timestamp: '2020-01-01' },
            { id: 'timestamp', createdAt: 'bad', timestamp: '2026-02-20', date: '2026-03-10' },
            { id: 'date', createdAt: 'bad', timestamp: 'bad', date: '2026-02-10' }
        ];
        assert.deepEqual(Array.from(app.normalizeWftStudentRecord('Alice', entries), s => s.id), ['latest', 'timestamp', 'date', 'old']);
        assert.equal(entries[1].createdAt, '2026-02-20'); assert.equal(entries[2].createdAt, '2026-02-10');
    });
    run(file + ': absent and invalid dates use one stable batch fallback', () => {
        const entries = [{ id: 'first' }, { id: 'second', createdAt: 'bad', timestamp: 'bad', date: 'Unknown date' }, { id: 'third' }];
        app.normalizeWftStudentRecord('Alice', entries);
        assert.deepEqual(entries.map(s => s.id), ['first', 'second', 'third']);
        assert(entries.every(s => s.createdAt === entries[0].createdAt));
        const bytes = JSON.stringify(entries); app.normalizeWftStudentRecord('Alice', entries);
        assert.equal(JSON.stringify(entries), bytes, 'Normalization retry does not refresh dates or IDs');
    });
    run(file + ': equivalent dates retain input order and ID assignment is stable', () => {
        const entries = [{ createdAt: '2026-02-01' }, { id: 'second', createdAt: 'Sun, 01 Feb 2026 00:00:00 GMT' }, { id: 'third', createdAt: '2026-02-01T00:00:00Z' }];
        app.normalizeWftStudentRecord('Alice', entries); const assigned = entries[0].id;
        assert(assigned.startsWith('assigned-')); assert.deepEqual(entries.map(s => s.id), [assigned, 'second', 'third']);
        app.normalizeWftStudentRecord('Alice', entries); assert.equal(entries[0].id, assigned);
    });
}
for (const file of ['js/app/00-storage-sync-patches.js']) run(file + ': index latest uses chronology with legacy dates', () => {
    const app = load(file, ['isWftPortfolioStudentKey', 'buildPortfolioIndexFromPortfolio'], { WFT_STUDENT_ID_MAP_V1: false, sanitizeStudentIdPart: value => value, localStorage: { getItem: () => null } });
    const result = app.buildPortfolioIndexFromPortfolio({ Alice: { sessions: [{ createdAt: 'Sun, 01 Feb 2026 00:00:00 GMT' }, { createdAt: '2026-03-01T00:00:00Z' }] } });
    assert.equal(result.students.Alice.latestSessionAt, '2026-03-01T00:00:00Z');
});
const report = { root, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, cases };
if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2)); assert.equal(report.failed, 0);
