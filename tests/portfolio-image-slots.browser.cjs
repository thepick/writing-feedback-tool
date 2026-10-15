const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const mixed of [false, true]) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => localAppRoute(route, root));
            let observed;
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                observed = await page.evaluate(mixed => {
                    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                    localStorage.clear(); driveAccessToken = '';
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
                    const valid = { name: 'Synthetic photo', dataUrl: canvas.toDataURL('image/png') };
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{
                        id: 'saved', createdAt: '2026-10-15T00:00:00Z', title: 'Protected writing',
                        originalText: 'Exact synthetic student writing.', overall: 0, categoryScores: { Grammar: 0 },
                        images: mixed ? [null, valid, null] : [null]
                    }] } }));
                    const before = localStorage.getItem('wft_portfolio');
                    const select = document.getElementById('portfolioStudentSelect');
                    select.appendChild(new Option('Synthetic', 'Synthetic')); select.value = 'Synthetic';
                    let error = '';
                    try { renderStudentPortfolio(); } catch (failure) { error = failure.message; }
                    const content = document.getElementById('portfolioContent');
                    return { error, unchanged: localStorage.getItem('wft_portfolio') === before,
                        text: content.textContent, slots: content.querySelectorAll('.session-photo-thumb').length,
                        images: content.querySelectorAll('.session-photo-thumb img').length,
                        unavailable: [...content.querySelectorAll('.thumb-caption')].filter(node => node.textContent === 'Image not available offline.').length,
                        score: content.querySelector('.session-score')?.textContent,
                        action: content.querySelector('.btn-reassess')?.dataset.session };
                }, mixed);
                assert.equal(observed.error, '', 'A null photo slot must not block the saved portfolio');
                assert.equal(observed.unchanged, true, 'Rendering must preserve the saved bytes');
                assert.ok(observed.text.includes('Exact synthetic student writing.'));
                assert.equal(observed.slots, mixed ? 3 : 1);
                assert.equal(observed.images, mixed ? 1 : 0, 'Valid photos still render alongside unavailable slots');
                assert.equal(observed.unavailable, mixed ? 2 : 1);
                assert.equal(observed.score, '0%'); assert.equal(observed.action, 'saved');
                assert.deepEqual(errors, []);
                cases.push({ name: mixed ? 'null slots around a valid photo' : 'single null photo slot', passed: true, observed });
            } catch (error) { cases.push({ name: mixed ? 'null slots around a valid photo' : 'single null photo slot', passed: false, error: error.message, observed }); }
            finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, passed: cases.filter(row => row.passed).length, failed: cases.filter(row => !row.passed).length }, null, 2));
    for (const row of cases) console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.name}${row.error ? ': ' + row.error : ''}`);
    assert.equal(cases.filter(row => !row.passed).length, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
