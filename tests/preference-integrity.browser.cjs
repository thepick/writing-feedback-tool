const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        const cases = await page.evaluate(fs.readFileSync(path.join(__dirname, 'fixtures/preference-integrity-scenarios.js'), 'utf8'));
        cases.push({ name: 'no-unhandled-native-events/startup/async-callbacks', pass: errors.length === 0, errors });
        const startup = await browser.newPage(), startupErrors = [];
        startup.on('pageerror', error => startupErrors.push(error.message));
        await startup.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await startup.addInitScript(() => {
            globalThis.startupAlerts = []; alert = message => startupAlerts.push(message);
            localStorage.setItem('wft_settings', JSON.stringify({ apiKey: 'synthetic-startup-key', gradeLevel: 6, classGradeLevel: 6, targetWordCount: '333', students: ['Synthetic Student'] }));
            localStorage.setItem('wft_students', '["Synthetic Student"]');
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) { if (this === sessionStorage && key === 'wft_api_key_session') throw new Error('Synthetic startup failure'); return set.call(this, key, value); };
        });
        await startup.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        const started = await startup.evaluate(() => ({ keyRetained: Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey'),
            feedback: startupAlerts.some(message => /API key change could not be saved/.test(message)), grade: getSelectedGradeLevel(),
            target: document.getElementById('targetWordCount').value, roster: students.length }));
        cases.push({ name: 'full native startup with failed legacy destination keeps key, loads preferences and reports', pass: started.keyRetained && started.feedback && started.grade === 6 && started.target === '333' && started.roster === 1 && startupErrors.length === 0, observed: started, errors: startupErrors });
        await startup.close();
        const report = { root, scope: 'Native Edge, complete shipped scripts and inline events; synthetic preferences/keys/rosters/cloud headers and held native response body; final multipart inspected at intercepted fetch, external requests blocked. No actual credentials, students, model calls or live services.', cases, passed: cases.filter(c => c.pass).length, failed: cases.filter(c => !c.pass).length };
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(`Preference integrity: ${report.passed}/${cases.length} passed, ${report.failed} failed.`);
        assert.equal(report.failed, 0, cases.filter(c => !c.pass).map(c => c.name + ': ' + (c.error || c.errors?.join(', '))).join('\n'));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
