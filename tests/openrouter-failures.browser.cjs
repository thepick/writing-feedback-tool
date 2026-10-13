const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
const modes = ['non-json', 'payload-400', 'no-choices', 'non-string', 'http-401', 'http-429', 'network', 'timeout'];
const scenarios = [...['text', 'image'].flatMap(kind => modes.map(mode => ({ kind, mode }))), ...['non-json', 'http-401', 'network', 'timeout'].map(mode => ({ kind: 'analysis', mode }))];

async function runFailureScenario({ kind, mode }) {
    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
    localStorage.clear(); sessionStorage.clear();
    const el = id => document.getElementById(id), checks = [], alerts = [], models = [], waits = [], timers = new Map();
    const check = (name, passed) => checks.push({ name, passed: !!passed });
    const key = 'synthetic-failure-key'; el('apiKeyInput').value = key;
    students = ['Synthetic']; selectedStudent = 'Synthetic'; populateStudentDropdown(); el('studentSelect').value = 'Synthetic';
    const writing = Array(15).fill('Yesterday we walked around the park and enjoyed the sunshine.').join(' '); el('studentWriting').value = writing;
    localStorage.setItem('wft_settings', '{}');
    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', originalText: 'Protected saved writing.' }] } }));
    pendingPortfolioSync = { studentName: 'Synthetic', signature: 'keep', sessionData: { id: 'pending', originalText: 'Earlier pending writing.', images: [] } }; persistPendingPortfolioSync();
    const previous = { inputContext: captureCurrentWritingContext(), marker: 'previous' }; latestAnalysisData = previous;
    el('detailedAssessment').innerHTML = '<p>Previous report</p>';
    const primary = localStorage.getItem('wft_portfolio'), pending = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), report = el('detailedAssessment').innerHTML;
    window.alert = text => alerts.push(String(text)); sleepMs = async ms => waits.push(ms);
    const nativeTimeout = window.setTimeout, nativeClear = window.clearTimeout; let serial = 1000000;
    window.setTimeout = (fn, ms, ...args) => ms === 90000 ? (timers.set(++serial, fn), serial) : nativeTimeout(fn, ms, ...args);
    window.clearTimeout = id => timers.delete(id) || nativeClear(id);
    const expectedModels = buildFallbackModelList(kind === 'analysis' ? el('modelSelect').value : 'synthetic-primary', kind === 'image');

    function createFailureResponse(options) {
        if (mode === 'network') throw Error('Failed to fetch: synthetic network failure');
        if (mode === 'timeout') return { ok: true, status: 200, text: () => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('Synthetic body timeout', 'AbortError')), { once: true });
            timers.values().next().value();
        }) };
        const bodies = { 'non-json': '{broken', 'payload-400': JSON.stringify({ error: { code: 400, message: 'Synthetic refusal' } }), 'no-choices': '{"choices":[]}', 'non-string': '{"choices":[{"message":{"content":12}}]}' };
        const status = mode === 'http-401' ? 401 : mode === 'http-429' ? 429 : 200;
        return new Response(bodies[mode] || '{"error":{"message":"Synthetic service refusal"}}', { status });
    }

    function checkTerminalFailure(error) {
        const nonretryable = ['payload-400', 'http-401'].includes(mode), expectedAttempts = nonretryable ? 1 : expectedModels.length * 2;
        check('terminal failure consumes only configured attempt budget', models.length === expectedAttempts);
        check('model order remains bounded', JSON.stringify(models) === JSON.stringify(nonretryable ? [expectedModels[0]] : expectedModels.flatMap(model => [model, model])));
        check('nonretryable failure never backs off', nonretryable ? waits.length === 0 : waits.length === expectedAttempts - 1);
        const expectedError = mode === 'non-json' ? /non-JSON/ : mode === 'no-choices' ? /no choices/ : mode === 'non-string' ? /response shape/ : mode === 'timeout' ? /timed out/ : mode === 'network' ? /Failed to fetch/ : /401|429|payload error/;
        check('terminal error remains useful', expectedError.test(kind === 'analysis' ? el('debugRaw').textContent : error));
    }

    function checkRetainedState(error) {
        check('primary bytes retained', localStorage.getItem('wft_portfolio') === primary);
        check('pending bytes retained', localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === pending);
        check('previous data and report retained', latestAnalysisData === previous && el('detailedAssessment').innerHTML === report);
        check('writing retained', el('studentWriting').value === writing);
        check('all provider timeout handles cleared', timers.size === 0);
        check('analysis busy controls released', !isAnalyzing && !activeAnalysisContext && !el('thinking')?.classList.contains('show') && el('stopAnalysisBtn').disabled && (kind !== 'analysis' || !el('analyzeBtn').disabled));
        check('synthetic credential absent from errors', ![error, ...alerts, el('debugRaw').textContent].some(text => text.includes(key)));
        if (kind === 'analysis') check('actual analysis reports terminal failure', alerts.some(text => /Analysis failed/.test(text)));
    }

    fetch = async (url, options) => {
        check('request uses synthetic provider boundary', url === 'https://openrouter.ai/api/v1/chat/completions' && options.headers.Authorization === 'Bearer ' + key);
        models.push(JSON.parse(options.body).model);
        return createFailureResponse(options);
    };
    let error = '';
    try {
        if (kind === 'analysis') await analyzeWriting();
        else if (kind === 'image') await callOpenRouterImage('synthetic-primary', 'Synthetic image prompt', 'data:image/png;base64,AAAA');
        else await callOpenRouter('synthetic-primary', 'Synthetic text prompt');
    } catch (e) { error = e.message; }
    checkTerminalFailure(error);
    checkRetainedState(error);
    // The same native transport can be invoked again after a terminal failure.
    window.setTimeout = nativeTimeout; window.clearTimeout = nativeClear;
    fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered request' } }] }));
    check('next native request recovers', await callOpenRouter('synthetic-primary', 'Retry after failure') === 'Recovered request');
    return { checks, models, waits, error, debug: el('debugRaw').textContent };
}

async function runScenario(browser, scenario) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => localAppRoute(route, root));
    try {
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const result = await page.evaluate(runFailureScenario, scenario);
        assert.deepEqual(errors, [], 'No uncaught provider failure');
        return { ...scenario, ...result, passed: result.checks.every(c => c.passed) };
    } catch (e) { return { ...scenario, passed: false, error: e.message }; }
    finally { await page.close(); }
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of scenarios) cases.push(await runScenario(browser, scenario));
    } finally { await browser.close(); }
    const failures = cases.filter(c => !c.passed);
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, failures, boundary: 'Synthetic provider fetch/body/timers; shipped native wrappers and Analyze caller; no live AI.' }, null, 2));
    assert.equal(cases.length, 20); assert.deepEqual(failures, [], 'Native provider failure outcomes');
    console.log('Native provider failure outcomes: ' + cases.length + ' passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
