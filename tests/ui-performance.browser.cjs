const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const routeApp = require('./support/local-app-route');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
    const cases = [], metrics = { scope: 'Synthetic local routes; Edge, 390px viewport, 4x CPU slowdown. External library admissions counted; vendor code replaced by bounded test doubles. These are lab timings, not Core Web Vitals or a real phone benchmark.' }, errors = [], libraries = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    metrics.sources = Object.fromEntries(['index.html', 'js/app/10-main-app.js', 'js/app/00-storage-sync-patches.js', 'js/app/21-diff-engine.js', 'js/app/writing-drafts.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
    await context.route('**/*', async route => {
        const url = route.request().url();
        if (/chart\.js@/.test(url)) { libraries.push('chart'); return route.fulfill({ contentType: 'application/javascript', body: 'window.Chart=function(){window.__chartReadyCount=(window.__chartReadyCount||0)+1;this.destroy=function(){};this.setDatasetVisibility=function(){};this.update=function(){};};' }); }
        if (/jszip@/.test(url)) { libraries.push('zip'); return route.fulfill({ contentType: 'application/javascript', body: 'window.JSZip=function(){};' }); }
        if (url.includes('/js/app/10-main-app.js')) {
            const body = fs.readFileSync(path.join(root, 'js/app/10-main-app.js'), 'utf8').replace('function updateGenreReviewBox() {', 'function updateGenreReviewBox() { window.__genreRuns = (window.__genreRuns || 0) + 1;');
            return route.fulfill({ contentType: 'application/javascript', body });
        }
        return routeApp(route, root);
    });
    try {
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        metrics.startupLibraries = libraries.slice();
        await page.evaluate(() => { stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {}; });
        metrics.paste = await page.evaluate(() => {
            const sentence = 'Our class visited the river to observe plants and animals. We recorded clear details and compared our notes after returning to school.';
            const text = Array(60).fill(sentence).join('\n');
            const input = document.getElementById('studentWriting'), beforeRuns = window.__genreRuns;
            const start = performance.now(); input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }));
            return { milliseconds: performance.now() - start, genreRuns: window.__genreRuns - beforeRuns, words: countWords(text), characters: text.length };
        });
        metrics.typing = await page.evaluate(() => {
            const input = document.getElementById('studentWriting'), start = performance.now(), beforeRuns = window.__genreRuns;
            for (const character of ' More detail.') { input.value += character; input.dispatchEvent(new Event('input', { bubbles: true })); }
            return { milliseconds: performance.now() - start, events: ' More detail.'.length, genreRuns: window.__genreRuns - beforeRuns };
        });
        metrics.correction = await page.evaluate(async () => {
            const text = document.getElementById('studentWriting').value, corrected = text.replaceAll('visited', 'explored');
            latestAnalysisData = { inputContext: captureCurrentWritingContext(), gradeLevel: 5, overall: 70, categoryScores: {}, detailed: {} }; syncUiState();
            const start = performance.now(), html = renderCorrected(text, corrected);
            document.getElementById('correctedStory').innerHTML = html;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return { milliseconds: performance.now() - start, renderedCharacters: html.length };
        });
        metrics.portfolio = await page.evaluate(async () => {
            WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false; wftSuppressDirtyMarks = true;
            students = ['Synthetic'];
            localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'one', title: 'River visit', overall: 75, createdAt: '2026-10-01T00:00:00Z', categoryScores: { Grammar: 7 } }] } }));
            const start = performance.now(); refreshPortfolioDropdown(); document.getElementById('portfolioStudentSelect').value = 'Synthetic'; switchTab('portfolio');
            while ((window.__chartReadyCount || 0) < 2 && performance.now() - start < 5000) await new Promise(resolve => setTimeout(resolve, 10));
            if ((window.__chartReadyCount || 0) < 2) throw new Error('Charts did not finish loading');
            return { milliseconds: performance.now() - start, sessions: document.querySelectorAll('.session-card').length };
        });
        metrics.featureLibraries = libraries.slice();
        await page.getByRole('button', { name: 'Writing Tool', exact: true }).click();
        await page.evaluate(() => {
            document.getElementById('apiKeyInput').value = 'synthetic-no-network'; refreshApiKeyRuntimeValue();
            window.__providerStarted = false;
            callOpenRouter = () => { window.__providerStarted = true; return new Promise((resolve, reject) => analysisAbortController.signal.addEventListener('abort', () => reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })), { once: true })); };
            syncUiState();
        });
        await page.locator('#analyzeBtn').click();
        await page.waitForFunction(() => window.__providerStarted);
        const stopStart = performance.now(); await page.locator('#stopAnalysisBtn').click(); await page.waitForFunction(() => !isAnalyzing);
        metrics.cancelMilliseconds = performance.now() - stopStart;
        assert.deepEqual(errors, []);
        cases.push({ name: 'long-writing-correction-portfolio-and-cancel-complete', passed: true });
        if (!process.env.WFT_PROFILE_ONLY) {
            assert.deepEqual(metrics.startupLibraries, []);
            assert.equal(metrics.paste.genreRuns, 1);
            assert.equal(metrics.typing.genreRuns, metrics.typing.events);
            assert.equal(metrics.featureLibraries.filter(name => name === 'chart').length, 1);
            assert(metrics.cancelMilliseconds < 5000, 'Stop remains responsive with pending provider');
            cases.push({ name: 'feature-only-admission-and-one-genre-pass-per-input', passed: true });
        }
    } catch (error) { cases.push({ name: 'performance-check', passed: false, error: error.message }); }
    finally {
        const { profile } = await cdp.send('Profiler.stop');
        if (process.env.WFT_TEST_REPORT) { metrics.cpuProfile = process.env.WFT_TEST_REPORT.replace(/\.json$/, '.cpuprofile'); fs.writeFileSync(metrics.cpuProfile, JSON.stringify(profile)); }
        await context.close(); await browser.close();
    }
    const report = { cases, metrics };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    assert(cases.every(test => test.passed), 'Performance check failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
