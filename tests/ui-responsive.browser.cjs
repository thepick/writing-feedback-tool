const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const routeApp = require('./support/local-app-route');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    try {
        for (const reducedMotion of ['reduce', 'no-preference']) {
            const context = await browser.newContext({ reducedMotion, viewport: { width: 390, height: 844 } }), page = await context.newPage();
            await context.route('**/*', route => routeApp(route, path.resolve(__dirname, '..')));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.evaluate(() => {
                    document.getElementById('analyzeBtn').classList.add('pulse-ready');
                    document.getElementById('studentPanel').classList.add('slide-in');
                    setLoadingButtonState(document.getElementById('stopAnalysisBtn'), true, 'Stopping analysis…');
                });
                if (reducedMotion === 'reduce') {
                    for (const selector of ['#analyzeBtn', '#studentPanel']) assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).animationName), 'none');
                }
                assert.match(await page.locator('#stopAnalysisBtn').innerText(), /Stopping analysis/);
                assert.equal(await page.locator('#stopAnalysisBtn').getAttribute('aria-busy'), 'true');
                cases.push({ name: 'finding16-motion-and-busy-text-' + reducedMotion, passed: true });
            } catch (error) { cases.push({ name: 'finding16-motion-and-busy-text-' + reducedMotion, passed: false, error: error.message }); }
            finally { await context.close(); }
        }
        for (const width of [390, 640, 1280]) {
            const context = await browser.newContext({ viewport: { width, height: 720 } }), page = await context.newPage();
            await context.route('**/*', route => routeApp(route, path.resolve(__dirname, '..')));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
                const label = page.locator('label').filter({ has: page.locator('#archiveIncludeImages') });
                assert.equal(await label.evaluate(el => getComputedStyle(el).textTransform), 'none');
                assert(await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 14));
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page-wide horizontal overflow');
                await page.getByRole('button', { name: 'Open settings', exact: true }).click();
                assert(await page.locator('label[for="assessScriptQuality"]').evaluate(el => getComputedStyle(el).textTransform === 'none'));
                assert((await page.locator('label[for="assessScriptQuality"]').boundingBox()).height >= 44);
                await page.keyboard.press('Tab');
                assert(await page.evaluate(() => document.activeElement.closest('#settingsDrawer') !== null));
                cases.push({ name: 'finding18-reading-and-reflow-' + width, passed: true });
            } catch (error) { cases.push({ name: 'finding18-reading-and-reflow-' + width, passed: false, error: error.message }); }
            finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ cases }, null, 2));
    console.log(JSON.stringify(cases, null, 2));
    assert(cases.every(test => test.passed), 'Responsive regression failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
