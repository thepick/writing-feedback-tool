const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const runTests = require('./run-tests.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wft-runner-check-'));
try {
    for (const dir of ['js', 'tests', 'scripts']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'google-drive-migration.js'), ''); fs.writeFileSync(path.join(root, 'test-google-drive-migration.cjs'), '');
    fs.writeFileSync(path.join(root, 'tests/pass.cjs'), 'const fixture = "process.env.WFT_TEST_REPORT"; // process.env.WFT_GUIDE_REPORT'); fs.writeFileSync(path.join(root, 'tests/fail.cjs'), 'throw Error("expected child failure");');
    fs.writeFileSync(path.join(root, 'tests/timeout.cjs'), 'setInterval(() => {}, 1000);');
    fs.writeFileSync(path.join(root, 'tests/signal.cjs'), 'process.kill(process.pid, "SIGTERM");');
    fs.writeFileSync(path.join(root, 'tests/missing.cjs'), 'void process.env["WFT_TEST_" + "REPORT"];');
    const contracts = { emptyObject: {}, arrayReport: [], booleanReport: true, topFailure: { passed: false, cases: [{ passed: true }] }, malformedRows: { cases: [{}] }, failedChecks: { checks: [{ passed: false }] }, failedArray: { count: 1, passed: 1, failed: [{ name: 'failure' }] }, validChecks: { checks: [{ passed: true }] }, validSummary: { count: 2, passed: 2 }, incompleteSummary: { count: 2, passed: 1 } };
    const reports = { ...contracts, valid: { cases: [{ passed: true }] }, validPass: { cases: [{ pass: true }] }, empty: { cases: [] }, zeroCases: { cases: 0 }, zeroCount: { count: 0 }, failedCase: { cases: [{ passed: false }] }, failedPass: { cases: [{ pass: false }] }, failedCount: { failed: 1 }, failures: { failures: ['expected failure'] } };
    for (const [name, data] of Object.entries(reports)) fs.writeFileSync(path.join(root, 'tests/' + name + '.cjs'), 'require("node:fs").writeFileSync(process.env.WFT_GUIDE_REPORT, ' + JSON.stringify(JSON.stringify(data)) + ');');
    fs.writeFileSync(path.join(root, 'tests/malformed.cjs'), 'require("node:fs").writeFileSync(process.env.WFT_TEST_REPORT, "{");');
    fs.writeFileSync(path.join(root, 'tests/blank.cjs'), 'require("node:fs").writeFileSync(process.env.WFT_TEST_REPORT, "");');
    const reportSuites = [...Object.keys(reports), 'missing', 'malformed', 'blank'].map(name => 'tests/' + name + '.cjs');
    const run = name => runTests({ root, out: path.join(root, 'out-' + name), selected: ['tests/' + name + '.cjs'], timeout: 2000, reportSuites });
    const contractResults = runTests({ root, out: path.join(root, 'out-contracts'), selected: Object.keys(contracts).map(name => 'tests/' + name + '.cjs'), timeout: 2000, reportSuites });
    for (const row of contractResults.suites) {
        const valid = /\/valid(?:Checks|Summary)\.cjs$/.test(row.suite);
        assert.equal(row.status === 0 && !row.error, valid, 'Report contract: ' + row.suite);
    }
    assert.equal(run('pass').passed, true);
    const failed = run('fail'); assert.equal(failed.passed, false); assert(fs.readFileSync(failed.suites[0].log, 'utf8').includes('expected child failure'));
    const timeout = run('timeout'); assert.equal(timeout.passed, false); assert.match(timeout.suites[0].error, /ETIMEDOUT/);
    const signal = run('signal'); assert.equal(signal.passed, false); assert(signal.suites[0].status !== 0 || signal.suites[0].signal, 'Termination must not pass');
    assert.equal(run('valid').passed, true);
    assert.equal(run('validPass').passed, true);
    for (const name of ['empty', 'zeroCases', 'zeroCount', 'failedCase', 'failedPass', 'failedCount', 'failures']) {
        const failedReport = run(name); assert.equal(failedReport.passed, false); assert.match(failedReport.suites[0].error, /Empty or failed/);
    }
    for (const name of ['malformed', 'blank']) {
        const invalid = run(name); assert.equal(invalid.passed, false); assert.match(invalid.suites[0].error, /Invalid case report/);
    }
    const missing = run('missing'); assert.equal(missing.passed, false); assert.match(missing.suites[0].error, /missing/);
    fs.writeFileSync(path.join(root, 'out-missing/missing.json'), '{"cases":[{"passed":true}]}');
    assert.equal(run('missing').passed, false, 'Stale report cannot satisfy this run');
    const supplement = (name, entry) => runTests({ root, out: path.join(root, 'supplement-' + name), selected: ['tests/pass.cjs'], supplements: [entry], reportSuites, timeout: 2000 });
    assert.equal(supplement('valid', path.join(root, 'tests/valid.cjs')).passed, true);
    const supplementalMissing = supplement('missing', path.join(root, 'tests/missing.cjs')); assert.equal(supplementalMissing.passed, false); assert.match(supplementalMissing.supplemental[0].error, /missing/);
    assert.equal(supplement('reportless', { file: path.join(root, 'tests/pass.cjs'), reportRequired: false }).passed, true, 'Fixture strings do not require reports');
    assert.equal(supplement('required', { file: path.join(root, 'tests/missing.cjs'), reportRequired: true }).passed, false);
    assert.equal(supplement('optional-empty', { file: path.join(root, 'tests/empty.cjs'), reportRequired: false }).passed, false, 'Optional reports still require validation');
    const preload = path.join(root, 'preload check.cjs');
    fs.writeFileSync(preload, 'process.env.RUNNER_PRELOADED="yes";');
    fs.writeFileSync(path.join(root, 'tests/preload.browser.cjs'), 'require("node:assert/strict").equal(process.env.RUNNER_PRELOADED,"yes");');
    assert.equal(runTests({ root, out: path.join(root, 'out-preload'), selected: ['tests/preload.browser.cjs'], env: { ...process.env, WFT_COVERAGE_PRELOAD: preload } }).passed, true, 'Windows paths and spaces reach native preload');
    assert.throws(() => runTests({ root, out: path.join(root, 'invalid'), selected: [''] }), /Unknown suite/);
    assert.throws(() => runTests({ root, out: path.join(root, 'invalid'), selected: ['tests/absent.cjs'] }), /Unknown suite/);
    for (const supplements of [{}, [null], [''], [{ file: 'test.cjs' }], [{ file: 'test.cjs', reportRequired: 'false' }]]) assert.throws(() => runTests({ root, out: path.join(root, 'invalid'), supplements }), /Supplemental|supplemental/);
    const route = require('../tests/support/local-app-route');
    const asset = (url, fallbackContentType) => route({ request: () => ({ url: () => url }), abort: () => 'aborted', fulfill: value => value }, root, fallbackContentType);
    assert.equal(asset('https://external.invalid/file.js'), 'aborted');
    assert.equal(asset('http://127.0.0.1:8765/google-drive-migration.js').contentType, 'application/javascript');
    for (const name of ['/missing.js', '/%2e%2e%5csecret', '/tests']) assert.equal(asset('http://127.0.0.1:8765' + name).status, 404);
    fs.writeFileSync(path.join(root, 'index.html'), ''); fs.writeFileSync(path.join(root, 'favicon-32x32.png'), '');
    assert.equal(asset('http://127.0.0.1:8765/favicon-32x32.png').contentType, 'text/html', 'Existing default MIME is retained');
    assert.equal(asset('http://127.0.0.1:8765/favicon-32x32.png', 'application/octet-stream').contentType, 'application/octet-stream', 'Opted-in asset MIME is retained');
    assert.deepEqual(['/index.html', '/google-drive-migration.js'].map(name => asset('http://127.0.0.1:8765' + name, 'application/octet-stream').contentType), ['text/html', 'application/javascript'], 'HTML and JavaScript MIME override the fallback');
    console.log('Runner checks passed: fixture strings, required/optional reports, failure, timeout, termination, valid/empty/missing/stale/malformed/failed reports, preload, invalid selections/manifests and local routing.');
} finally {
    // Delete only this uniquely created fixture directory, including after a failed assertion.
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true });
}
