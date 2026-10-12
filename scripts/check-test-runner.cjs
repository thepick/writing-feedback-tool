const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const runTests = require('./run-tests.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wft-runner-check-'));
try {
    for (const dir of ['js', 'tests', 'scripts']) fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, 'google-drive-migration.js'), ''); fs.writeFileSync(path.join(root, 'test-google-drive-migration.cjs'), '');
    fs.writeFileSync(path.join(root, 'tests/pass.cjs'), ''); fs.writeFileSync(path.join(root, 'tests/fail.cjs'), 'throw Error("expected child failure");');
    fs.writeFileSync(path.join(root, 'tests/timeout.cjs'), 'setInterval(() => {}, 1000);');
    fs.writeFileSync(path.join(root, 'tests/empty.cjs'), 'require("node:fs").writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({cases:[]}));');
    fs.writeFileSync(path.join(root, 'tests/missing.cjs'), 'void process.env.WFT_TEST_REPORT;');
    const run = name => runTests({ root, out: path.join(root, 'out-' + name), selected: ['tests/' + name + '.cjs'], timeout: 2000 });
    assert.equal(run('pass').passed, true);
    const failed = run('fail'); assert.equal(failed.passed, false); assert(fs.readFileSync(failed.suites[0].log, 'utf8').includes('expected child failure'));
    const timeout = run('timeout'); assert.equal(timeout.passed, false); assert.match(timeout.suites[0].error, /ETIMEDOUT/);
    const empty = run('empty'); assert.equal(empty.passed, false); assert.match(empty.suites[0].error, /Empty/);
    const missing = run('missing'); assert.equal(missing.passed, false); assert.match(missing.suites[0].error, /missing/);
    fs.writeFileSync(path.join(root, 'out-missing/missing.json'), '{"cases":[{"passed":true}]}');
    assert.equal(run('missing').passed, false, 'Stale report cannot satisfy this run');
    assert.throws(() => runTests({ root, out: path.join(root, 'invalid'), selected: [''] }), /Unknown suite/);
    assert.throws(() => runTests({ root, out: path.join(root, 'invalid'), selected: ['tests/absent.cjs'] }), /Unknown suite/);
    const route = require('../tests/support/local-app-route');
    const asset = url => route({ request: () => ({ url: () => url }), abort: () => 'aborted', fulfill: value => value }, root);
    assert.equal(asset('https://external.invalid/file.js'), 'aborted');
    assert.equal(asset('http://127.0.0.1:8765/google-drive-migration.js').contentType, 'application/javascript');
    for (const name of ['/missing.js', '/%2e%2e%5csecret', '/tests']) assert.equal(asset('http://127.0.0.1:8765' + name).status, 404);
    console.log('Runner checks passed: pass, failure, timeout, empty/missing/stale reports and invalid/empty selection.');
} finally {
    // Delete only this uniquely created fixture directory, including after a failed assertion.
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true });
}
