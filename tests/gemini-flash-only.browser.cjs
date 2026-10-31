const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root));
        await page.addInitScript(() => {
            localStorage.setItem('wft_settings', JSON.stringify({ model: 'openai/gpt-5.4-nano', targetWordCount: '275' }));
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const result = await page.evaluate(async () => {
            stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
            const select = document.getElementById('modelSelect');
            const startup = { model: select.value, target: document.getElementById('targetWordCount').value };
            applyLoadedSettings({ model: 'xiaomi/mimo-v2-omni', targetWordCount: '300' });
            const cloud = { model: select.value, target: document.getElementById('targetWordCount').value };
            saveSettingsToLocalStorage();
            const savedModel = JSON.parse(localStorage.getItem('wft_settings')).model;
            document.getElementById('apiKeyInput').value = 'synthetic-single-model-key';
            sleepMs = async () => {};
            const requests = [];
            let fail = false;
            fetch = async (url, options) => {
                if (url !== 'https://openrouter.ai/api/v1/chat/completions') throw Error('Unexpected request');
                requests.push(JSON.parse(options.body));
                return new Response(JSON.stringify({ choices: [{ message: { content: 'Synthetic result' } }] }), { status: fail ? 503 : 200 });
            };
            await callOpenRouter('openai/gpt-5.4-nano', 'Synthetic writing');
            await callOpenRouterImage('xiaomi/mimo-v2-omni', 'Synthetic image', 'data:image/png;base64,AAAA');
            fail = true;
            const failures = [];
            for (const call of [() => callOpenRouter('old-text-model', 'Synthetic writing'),
                () => callOpenRouterImage('old-image-model', 'Synthetic image', 'data:image/png;base64,AAAA')]) {
                try { await call(); } catch (error) { failures.push(error.message); }
            }
            return { startup, cloud, savedModel, disabled: select.disabled,
                options: Array.from(select.options, option => option.value), policy: captureAssessmentPolicy(), requests, failures };
        });
        const model = '~google/gemini-flash-latest';
        assert.deepEqual(errors, []);
        assert.deepEqual(result.startup, { model, target: '275' });
        assert.deepEqual(result.cloud, { model, target: '300' });
        assert.equal(result.savedModel, model);
        assert.equal(result.disabled, true);
        assert.deepEqual(result.options, [model]);
        assert.equal(result.policy.model, model);
        assert.equal(result.policy.ocrModel, model);
        assert.deepEqual(result.requests.map(request => request.model), Array(6).fill(model));
        assert.equal(result.requests[0].messages[0].content, 'Synthetic writing');
        assert.equal(result.requests[1].messages[0].content[1].image_url.url, 'data:image/png;base64,AAAA');
        assert.equal(result.failures.length, 2);
        for (const message of result.failures) assert.match(message, /OpenRouter request failed after retries/);
        console.log('Gemini Flash only: local/cloud settings, policy, text/image payloads and terminal retries passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
