const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const at of [1, 2]) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const chartError = page.waitForEvent('pageerror').then(e => e.message, e => 'Chart error event missing: ' + e.message);
                const failed = await page.evaluate(at => {
                    stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear();
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'protected', originalText: 'Protected chart writing.', overall: 0, categoryScores: { Grammar: null, Flow: 0 } }] } }));
                    const select = document.getElementById('portfolioStudentSelect'); select.innerHTML = '<option value="Synthetic">Synthetic</option>'; select.value = 'Synthetic';
                    window.chartBefore = localStorage.getItem('wft_portfolio'); window.chartAttempts = 0; window.chartDestroyed = [];
                    window.Chart = function(canvas, config) {
                        chartAttempts++; if (chartAttempts === at) throw Error('Synthetic chart constructor ' + at);
                        this.destroy = () => chartDestroyed.push(canvas.id);
                    };
                    renderStudentPortfolio();
                    return { text: document.getElementById('portfolioContent').textContent };
                }, at);
                await page.waitForFunction(() => chartAttempts > 0);
                assert.equal(await chartError, 'Synthetic chart constructor ' + at);
                assert.deepEqual(errors, ['Synthetic chart constructor ' + at], 'Only the injected deferred error is expected');
                assert(failed.text.includes('Protected chart writing.'), 'Session history remains readable despite Chart failure');
                const recovered = await page.evaluate(() => {
                    const unchanged = localStorage.getItem('wft_portfolio') === chartBefore;
                    const partialRegistry = Object.keys(wftPortfolioChartInstances);
                    window.Chart = function(canvas) { chartAttempts++; this.destroy = () => chartDestroyed.push(canvas.id); };
                    renderStudentPortfolio();
                    return { unchanged, partialRegistry, destroyed: chartDestroyed.length };
                });
                assert.equal(recovered.unchanged, true, 'Chart failure preserves stored essay bytes');
                await page.waitForFunction(() => Object.keys(wftPortfolioChartInstances).length === 2);
                assert.deepEqual(recovered.partialRegistry, at === 1 ? [] : ['overall'], 'Only completed charts are registered');
                assert.equal(recovered.destroyed, at === 1 ? 0 : 1, 'Refresh cleans the successful partial chart');
                assert.equal(await page.evaluate(() => localStorage.getItem('wft_portfolio') === chartBefore), true, 'Successful refresh remains read-only');
                assert.deepEqual(errors, ['Synthetic chart constructor ' + at], 'Next refresh recovers without another error');
                cases.push({ at, passed: true, observedError: errors[0], recovered });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, limit: 'Existing deferred Chart exceptions remain uncaught; no new graceful fallback is claimed. Chart library is synthetic; storage/history and next native refresh are real.' }, null, 2));
    assert.equal(cases.length, 2); console.log('Chart constructor preservation and recovery: 2 passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
