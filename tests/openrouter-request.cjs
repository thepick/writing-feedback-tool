const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/10-main-app.js'), 'utf8');
const start = source.indexOf('function sleepMs(');
const end = source.indexOf('function setOcrStatus(', start);
assert.ok(start >= 0 && end > start);
const content = text => JSON.stringify({ choices: [{ message: { content: text } }] });
const response = (body, status = 200) => ({ ok: status === 200, status, text: async () => body });
function setup(fetcher, models = ['primary']) {
    const timers = new Map(), attempts = [], sleeps = [];
    let timerId = 0;
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        cancelAnalysis: false, analysisAbortController: null, AbortController,
        API_KEY: 'test-key', OCR_MODEL: 'ocr', window: { location: { href: 'http://127.0.0.1/' } },
        refreshApiKeyRuntimeValue() {},
        getWftApiKeyStorageError() { return new Error('Synthetic required key storage failure'); },
        fetch: (url, options) => { assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); attempts.push(options); return fetcher(options, attempts.length); },
        setTimeout: (callback, ms) => { assert.equal(ms, 90000); timers.set(++timerId, callback); return timerId; },
        clearTimeout: id => timers.delete(id)
    });
    app.buildFallbackModelList = () => models;
    app.sleepMs = async ms => { sleeps.push(ms); };
    return { app, timers, attempts, sleeps, request: (retries = 0) => app.requestOpenRouterWithFallback('primary', model => ({ model }), { maxRetriesPerModel: retries }) };
}
async function stalledBody() {
    let bodyStarted;
    const ready = new Promise(resolve => { bodyStarted = resolve; });
    let hits = 0;
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (++hits === 1) res.write('{"choices":');
        else res.end(content('recovered'));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const test = setup(async options => {
        const res = await fetch('http://127.0.0.1:' + server.address().port, options);
        const read = res.text.bind(res);
        res.text = () => { bodyStarted(); return read(); };
        return res;
    });
    const run = test.request(1);
    run.catch(() => {});
    try {
        await ready;
        assert.equal(test.timers.size, 1, 'Receiving headers must not cancel the timeout while the actual HTTP body is stalled');
        const [id, timeout] = test.timers.entries().next().value;
        test.timers.delete(id);
        timeout();
        assert.equal(await run, 'recovered');
        assert.equal(hits, 2);
        assert.equal(test.attempts[0].signal.aborted, true);
        assert.equal(test.attempts[1].signal.aborted, false, 'A timeout retry must get a fresh controller');
        assert.equal(test.timers.size, 0);
    } finally {
        test.app.cancelAnalysis = true;
        test.app.analysisAbortController.abort();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
async function cancelledBody() {
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const test = setup(async options => ({ ok: true, status: 200, text: () => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })), { once: true });
        started();
    }) }));
    const run = test.request(1);
    await ready;
    test.app.cancelAnalysis = true;
    test.app.analysisAbortController.abort();
    await assert.rejects(run, /Analysis cancelled by user/);
    assert.equal(test.attempts.length, 1);
    assert.equal(test.timers.size, 0);
}
(async () => {
    await stalledBody();
    await cancelledBody();
    for (const failure of ['missing', 'recovery', 'throw']) {
        const test = setup(async () => { throw new Error('Admission must precede transport'); });
        let payloads = 0;
        if (failure === 'missing') test.app.API_KEY = '';
        if (failure === 'recovery') test.app.refreshApiKeyRuntimeValue = () => false;
        if (failure === 'throw') test.app.refreshApiKeyRuntimeValue = () => { throw new Error('Synthetic required key reader failure'); };
        await assert.rejects(test.app.requestOpenRouterWithFallback('primary', () => { payloads++; return {}; }),
            failure === 'missing' ? /No API key/ : /Synthetic required key/);
        assert.equal(payloads, 0);
        assert.equal(test.attempts.length, 0);
        assert.equal(test.sleeps.length, 0);
        assert.equal(test.timers.size, 0);
    }
    const success = setup(async () => response(content('done')));
    assert.equal(await success.app.callOpenRouter('primary', 'writing prompt'), 'done');
    assert.equal(await success.app.callOpenRouterImage('primary', 'image prompt', 'data:image/jpeg;base64,AAAA'), 'done');
    assert.equal(JSON.parse(success.attempts[0].body).messages[0].content, 'writing prompt');
    assert.equal(JSON.parse(success.attempts[1].body).messages[0].content[1].image_url.url, 'data:image/jpeg;base64,AAAA');
    assert.equal(success.timers.size, 0);
    for (const [body, status, expected] of [
        ['not JSON', 200, /returned non-JSON/],
        [content('denied'), 401, /error 401/],
        [JSON.stringify({ error: { code: 400, message: 'Invalid' } }), 200, /payload error/],
        [JSON.stringify({ choices: [] }), 200, /no choices/],
        [JSON.stringify({ choices: [{ message: {} }] }), 200, /Unexpected.*shape/]
    ]) {
        const test = setup(async () => response(body, status));
        await assert.rejects(test.request(), expected);
        assert.equal(test.timers.size, 0);
    }
    const fallback = setup(async (options, attempt) => attempt === 1 ? response(content('busy'), 503) : response(content('fallback')), ['primary', 'backup']);
    assert.equal(await fallback.request(), 'fallback');
    assert.deepEqual(fallback.attempts.map(attempt => JSON.parse(attempt.body).model), ['primary', 'backup']);
    assert.equal(fallback.timers.size, 0);
    console.log('OpenRouter request tests passed: real stalled HTTP body times out and retries, cancellation does not retry, text/image wrappers and response validation remain intact.');
})().catch(error => { console.error(error); process.exitCode = 1; });
