const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const cases = [];
for (const [file, symbol, split] of [
    ['js/data/portfolio-index.js', 'buildPortfolioIndexFromPortfolio', false],
    ['js/sync/merge.js', 'rebuildIndexFromStudentFiles', true]
]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8'), from = source.indexOf('function ' + symbol + '('), to = source.indexOf('\nfunction ', from + 1);
    assert(from >= 0 && to > from);
    const app = vm.runInNewContext(source.slice(from, to) + '\n;globalThis', { WFT_STUDENT_ID_MAP_V1: false, sanitizeStudentIdPart: name => name, localStorage: { getItem: () => 'synthetic-student-file' } });
    for (const [name, scores, expected] of [
        ['actual', [{ overall: 80 }], 80], ['zero', [{ overall: 0 }], 0], ['legacy', [{ overallScore: 70 }], 70],
        ['legacy string', [{ overall: '80' }], 80], ['current wins', [{ overall: 90, overallScore: 10 }], 90],
        ['null wins', [{ overall: null, overallScore: 10 }], null], ['missing', [{}], null],
        ['invalid', [{ overall: '' }, { overall: 'bad' }, { overall: Infinity }], null],
        ['mixed', [{ overall: 80 }, { overall: null }, { overallScore: 60 }, {}], 70]
    ]) {
        try {
            const sessions = scores.map((score, i) => ({ id: 'synthetic-' + i, createdAt: '2026-10-12T00:00:00Z', images: [{ driveFileId: 'synthetic-photo' }], ...score }));
            const data = split ? { file: { format: 'student-portfolio-v1', studentId: 'Synthetic', displayName: 'Synthetic', legacyNameKeys: ['Synthetic'], sessions } } : { Synthetic: { sessions } };
            const before = JSON.stringify(data), result = app[symbol](data).students.Synthetic;
            assert.equal(result.averageScore, expected); assert.equal(result.sessionCount, sessions.length);
            assert.equal(result.latestSessionAt, sessions[0].createdAt); assert.equal(result.legacyNameKey, 'Synthetic');
            assert.equal(JSON.stringify(data), before);
            cases.push({ name: file + '/' + name, passed: true });
        } catch (error) { cases.push({ name: file + '/' + name, passed: false, error: error.message }); }
    }
}
const report = { root, scope: 'Retained unshipped score builders only; no claim about their save/dirty or cloud paths. Removal remains CLEANUP-001.', passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, cases };
if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2)); assert.equal(report.failed, 0);
