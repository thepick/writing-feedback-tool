const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');

function resolveTestOptions({ root, out, selected = [], timeout = 600000, env = process.env, supplements = [], reportSuites = require('./case-report-suites.json') }) {
    return { root, out, selected, timeout, env, supplements, reportSuites };
}

function selectTestSuites(inventory, selected) {
    if (selected.some(file => !inventory.includes(file))) throw Error('Unknown suite selection');
    const suites = selected.length ? inventory.filter(file => selected.includes(file)) : inventory;
    if (!suites.length) throw Error('Empty suite inventory');
    return suites;
}

function normalizeSupplementalSuites(supplements) {
    if (!Array.isArray(supplements)) throw Error('Supplemental manifest must be an array');
    const supplementalSuites = supplements.map(entry => typeof entry === 'string' ? { file: entry, reportRequired: true } : entry);
    if (supplementalSuites.some(entry => !entry || typeof entry.file !== 'string' || !entry.file.trim() || typeof entry.reportRequired !== 'boolean')) throw Error('Use supplemental paths or { file, reportRequired } entries');
    return supplementalSuites;
}

function listJavaScriptFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? listJavaScriptFiles(path.join(dir, entry.name)) : /\.(js|cjs)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
}

function getSyntaxResults(root, timeout) {
    const files = [path.join(root, 'google-drive-migration.js'), ...listJavaScriptFiles(path.join(root, 'js')), ...listJavaScriptFiles(path.join(root, 'tests')), ...listJavaScriptFiles(path.join(root, 'scripts')), path.join(root, 'test-google-drive-migration.cjs')];
    return files.map(file => {
        const check = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout });
        return { file: path.relative(root, file).replaceAll('\\', '/'), status: check.status, error: check.error?.message || check.stderr || null };
    });
}

function prepareSuiteExecution(env, { root, out, file, report, supplemental }) {
    const childEnv = { ...env };
    if (fs.existsSync(report)) fs.unlinkSync(report);
    for (const key of Object.keys(childEnv)) if (/^WFT_.*(FILTER|EXPECT_BASELINE)$/.test(key)) delete childEnv[key];
    const aliases = ['WFT_TEST_REPORT', 'WFT_TEST_EVIDENCE', 'WFT_CASE_OUTPUT', 'WFT_POLICY_REPORT', 'WFT_COMPAT_REPORT', 'WFT_PARSER_REPORT', 'WFT_FEEDBACK_REPORT', 'WFT_GUIDE_REPORT', 'WFT_ANALYSIS_REPORT'];
    for (const key of aliases) childEnv[key] = report;
    childEnv.WFT_TEST_ROOT = root;
    delete childEnv.NODE_OPTIONS; delete childEnv.WFT_COVERAGE_DIR; delete childEnv.WFT_COVERAGE_SOURCE_ROOT;
    if (env.WFT_COVERAGE_PRELOAD && (supplemental || file.endsWith('.browser.cjs'))) {
        childEnv.NODE_OPTIONS = '--require "' + env.WFT_COVERAGE_PRELOAD.replaceAll('\\', '/') + '"';
        childEnv.WFT_COVERAGE_DIR = path.join(out, 'native-coverage'); childEnv.WFT_COVERAGE_SOURCE_ROOT = root;
    }
    return childEnv;
}

function isPassedCaseRow(row) {
    return row && (row.pass === true || row.passed === true) && row.pass !== false && row.passed !== false;
}

function hasValidCaseSummary(data, rows, count) {
    return Array.isArray(rows)
        ? rows.length > 0 && rows.every(isPassedCaseRow)
        : Number.isSafeInteger(count) && count > 0 && data.passed === count;
}

function hasReportFailures(data) {
    return data.pass === false || data.passed === false || data.failed > 0 || (Array.isArray(data.failed) && data.failed.length) || (Array.isArray(data.failures) && data.failures.length);
}

function isValidCaseReport(data) {
    const rows = data?.cases ?? data?.checks, count = data?.count ?? data?.total ?? rows;
    return data && typeof data === 'object' && !Array.isArray(data) && hasValidCaseSummary(data, rows, count) && !hasReportFailures(data);
}

function getCaseReportError(report, reportRequired) {
    let reportError = reportRequired && !fs.existsSync(report) ? 'Expected case report missing' : null;
    if (fs.existsSync(report)) {
        try {
            const data = JSON.parse(fs.readFileSync(report));
            if (!isValidCaseReport(data)) reportError = 'Empty or failed case report';
        }
        catch (e) { reportError = 'Invalid case report: ' + e.message; }
    }
    return reportError;
}

function runTests(options) {
    const { root, out, selected, timeout, env, supplements, reportSuites } = resolveTestOptions(options);
    const inventory = ['test-google-drive-migration.cjs', ...fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.cjs')).map(name => 'tests/' + name)].sort();
    const suites = selectTestSuites(inventory, selected);
    const supplementalSuites = normalizeSupplementalSuites(supplements);
    fs.mkdirSync(out, { recursive: true });
    const result = { root, inventory, selected: suites, partial: selected.length > 0, started: new Date().toISOString(), syntax: [], suites: [], supplemental: [], complete: false, passed: false };
    const persist = () => fs.writeFileSync(path.join(out, 'suite-results.json'), JSON.stringify(result, null, 2));
    result.syntax = getSyntaxResults(root, timeout);
    persist();
    if (result.syntax.some(row => row.status !== 0)) return result;
    function run(file, label, supplemental, reportRequired) {
        const report = path.join(out, path.basename(file, '.cjs') + '.json');
        const childEnv = prepareSuiteExecution(env, { root, out, file, report, supplemental });
        const started = new Date().toISOString(), at = Date.now();
        const child = cp.spawnSync(process.execPath, [file], { cwd: root, env: childEnv, encoding: 'utf8', timeout, maxBuffer: 24 * 1024 * 1024 });
        const log = path.join(out, path.basename(file, '.cjs') + '.log'); fs.writeFileSync(log, (child.stdout || '') + (child.stderr || ''));
        const reportError = getCaseReportError(report, reportRequired);
        const row = { suite: label, status: child.status, signal: child.signal, error: child.error?.message || reportError, started, seconds: (Date.now() - at) / 1000, log, report: fs.existsSync(report) ? report : null, nativeInstrumented: !!childEnv.WFT_COVERAGE_DIR };
        (supplemental ? result.supplemental : result.suites).push(row); persist(); console.log(JSON.stringify(row));
    }
    for (const suite of suites) run(path.join(root, suite), suite, false, reportSuites.includes(suite));
    for (const { file, reportRequired } of supplementalSuites) run(path.resolve(file), path.basename(file), true, reportRequired);
    result.complete = result.suites.length === suites.length && result.supplemental.length === supplements.length;
    result.passed = result.complete && [...result.suites, ...result.supplemental].every(row => row.status === 0 && !row.error);
    result.finished = new Date().toISOString(); persist(); return result;
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2), selected = []; let out;
        while (args.length) { const flag = args.shift(), value = args.shift(); if (!value) throw Error('Missing option value'); if (flag === '--suite') selected.push(value); else if (flag === '--out') out = path.resolve(value); else throw Error('Unknown option ' + flag); }
        if (!out || selected.some(value => !value.trim())) throw Error('Use --out directory and optional --suite tests/name.cjs');
        const supplements = process.env.WFT_SUPPLEMENTAL_MANIFEST ? JSON.parse(fs.readFileSync(process.env.WFT_SUPPLEMENTAL_MANIFEST)) : [];
        const result = runTests({ root: path.resolve(__dirname, '..'), out, selected, supplements }); process.exitCode = result.passed ? 0 : 1;
    } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = runTests;
