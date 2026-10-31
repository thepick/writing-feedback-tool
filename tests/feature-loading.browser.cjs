const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const routeApp = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
const zipSource = fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'), 'utf8');
const chartSource = `window.Chart=function(canvas,config){
    window.chartRenders.push({canvas,labels:config.data.labels,values:config.data.datasets.map(d=>d.data)});
    this.destroy=function(){window.chartDestroyed.push(canvas)};
    this.setDatasetVisibility=function(index,visible){window.chartVisibility.push({index,visible})};
    this.update=function(){window.chartUpdates++};
};`;

async function seed(page) {
    await page.evaluate(() => {
        stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
        localStorage.clear(); sessionStorage.clear(); pendingPortfolioSync = null;
        wftSuppressDirtyMarks = true; WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false;
        driveAccessToken = ''; students = ['Alice', 'Bob']; selectedStudent = 'Alice';
        const session = { id: 'one', createdAt: '2026-10-01T00:00:00Z', date: 'October 1', title: 'River visit', overall: 75,
            originalText: 'Protected saved writing.', categoryScores: { Grammar: 7 }, images: [] };
        localStorage.setItem('wft_students', JSON.stringify(students));
        localStorage.setItem('wft_settings', JSON.stringify({ students }));
        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [session] }, Bob: { sessions: [{ ...session, id: 'bob', overall: 55 }] } }));
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
        const select = document.getElementById('portfolioStudentSelect');
        select.replaceChildren(new Option('Alice', 'Alice'), new Option('Bob', 'Bob')); select.value = 'Alice';
        window.chartRenders = []; window.chartDestroyed = []; window.chartVisibility = []; window.chartUpdates = 0;
        window.featureAlerts = []; alert = message => featureAlerts.push(String(message));
        window.protectedPortfolio = localStorage.getItem('wft_portfolio');
    });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    async function check(name, run) {
        const context = await browser.newContext(), page = await context.newPage(), errors = [], requests = [], held = [];
        let gate = false;
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', route => {
            const url = route.request().url();
            if (/cdn\.jsdelivr\.net\/npm\/(chart\.js@|jszip@)/.test(url)) {
                const library = url.includes('chart.js@') ? 'chart' : 'zip';
                requests.push(library);
                if (gate) { held.push({ route, library }); return; }
                return route.fulfill({ contentType: 'application/javascript', body: '' });
            }
            return routeApp(route, root);
        });
        const waitRequest = async library => {
            for (let i = 0; i < 100 && !held.some(request => request.library === library); i++) await new Promise(resolve => setTimeout(resolve, 10));
            assert(held.some(request => request.library === library), library + ' request must reach the controlled library boundary');
        };
        const release = async (library, body) => {
            await waitRequest(library);
            const request = held.splice(held.findIndex(request => request.library === library), 1)[0];
            if (body === null) await request.route.abort();
            else await request.route.fulfill({ contentType: 'application/javascript', body: body === undefined ? (library === 'chart' ? chartSource : zipSource) : body });
        };
        try {
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' }); await seed(page); gate = true;
            await run({ page, requests, held, waitRequest, release });
            assert.deepEqual(errors, [], 'Feature loading must not create uncaught page errors');
            cases.push({ name, passed: true, requests });
        } catch (error) { cases.push({ name, passed: false, error: error.message, requests }); }
        finally { await context.close(); }
    }
    try {
        await check('cold writing uses neither feature library', async ({ page, requests }) => {
            await page.locator('#studentWriting').fill('Our class visited the river.');
            assert.deepEqual(requests, [], 'Writing startup and input must not request chart or ZIP libraries');
        });
        await check('concurrent callers share one verified library load', async ({ page, requests, release }) => {
            assert.equal(await page.evaluate(() => typeof loadWftFeatureLibrary), 'function', 'Feature loader must be available');
            await page.evaluate(() => {
                const first = loadWftFeatureLibrary('chart'), second = loadWftFeatureLibrary('chart');
                window.sameFeaturePromise = first === second;
                window.featureResult = Promise.all([first, second]).then(results => results.every(result => result === window.Chart));
            });
            await release('chart');
            assert.equal(await page.evaluate(() => featureResult), true);
            assert.equal(await page.evaluate(() => sameFeaturePromise), true);
            assert.deepEqual(requests, ['chart']);
            assert.equal(await page.evaluate(() => loadWftFeatureLibrary('https://untrusted.invalid/code.js').then(() => false, () => true)), true, 'Unknown keys must reject');
            assert.deepEqual(requests, ['chart'], 'Unknown keys never admit external requests');
        });
        for (const failure of ['network', 'missing-global', 'timeout']) {
            await check(failure + ' rejects and permits user retry', async ({ page, requests, waitRequest, release, held }) => {
                assert.equal(await page.evaluate(() => typeof loadWftFeatureLibrary), 'function');
                if (failure === 'timeout') await page.clock.install();
                await page.evaluate(() => { window.featureFailure = loadWftFeatureLibrary('chart').then(() => '', error => error.message); });
                await waitRequest('chart');
                if (failure === 'timeout') await page.clock.fastForward(20000);
                else await release('chart', failure === 'network' ? null : 'window.unrelatedGlobal=true;');
                assert.match(await page.evaluate(() => featureFailure), /chart/i);
                assert.equal(await page.evaluate(() => typeof Chart), 'undefined');
                if (failure === 'timeout') {
                    await page.clock.resume();
                    // Finish the timed-out transport before retry; Edge coalesces simultaneous identical script requests.
                    const stale = held.shift(); await stale.route.abort();
                }
                await page.evaluate(() => { window.featureRetry = loadWftFeatureLibrary('chart').then(result => result === window.Chart); });
                await release('chart');
                assert.equal(await page.evaluate(() => featureRetry), true);
                assert.deepEqual(requests, ['chart', 'chart']);
            });
        }
        await check('portfolio table survives loading and failure; refresh retries', async ({ page, requests, release }) => {
            await page.evaluate(() => { switchTab('portfolio'); renderStudentPortfolio(); });
            assert.equal(await page.locator('.portfolio-chart-data tbody tr').count(), 1);
            assert.match(await page.locator('#portfolioContent').innerText(), /loading.*chart/i);
            assert.equal(await page.locator('.portfolio-chart-legend input:disabled').count(), 6);
            await page.evaluate(() => {
                const canvases = document.querySelectorAll('.portfolio-chart-canvas');
                setupWftPortfolioCharts(canvases[0].id, canvases[1].id, ['October 1'], [75], [{ label: 'Grammar', data: [7] }]);
            });
            await release('chart', null);
            await page.waitForFunction(() => document.querySelectorAll('.portfolio-chart-wrap .portfolio-empty').length === 2);
            assert.match(await page.locator('.portfolio-chart-wrap').first().innerText(), /unavailable/i);
            assert.equal(await page.locator('.portfolio-chart-data tbody tr').count(), 1);
            await page.evaluate(() => renderStudentPortfolio()); await release('chart');
            await page.waitForFunction(() => chartRenders.length === 2);
            await page.evaluate(() => {
                const canvases = document.querySelectorAll('.portfolio-chart-canvas');
                setupWftPortfolioCharts(canvases[0].id, canvases[1].id, ['October 1'], [75], [{ label: 'Grammar', data: [7] }]);
            });
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => chartRenders.length), 2, 'Repeated setup must not duplicate chart instances');
            await page.locator('.portfolio-chart-series').filter({ hasText: 'Show Grammar' }).locator('input').uncheck();
            assert.deepEqual(await page.evaluate(() => ({ calls: chartVisibility, updates: chartUpdates })), { calls: [{ index: 1, visible: false }], updates: 1 });
            assert.deepEqual(requests, ['chart', 'chart']);
            assert.equal(await page.evaluate(() => protectedPortfolio === localStorage.getItem('wft_portfolio')), true);
        });
        for (const next of ['Bob', 'removed']) {
            await check('pending charts ignore ' + (next === 'Bob' ? 'replaced student canvases with colliding IDs' : 'removed portfolio'), async ({ page, requests, release }) => {
                await page.evaluate(next => {
                    Date.now = () => 1790812800000;
                    switchTab('portfolio'); renderStudentPortfolio();
                    window.previousCanvases = [...document.querySelectorAll('.portfolio-chart-canvas')];
                    const select = document.getElementById('portfolioStudentSelect'); select.value = next === 'Bob' ? 'Bob' : '';
                    renderStudentPortfolio();
                }, next);
                await release('chart');
                if (next === 'Bob') {
                    await page.waitForFunction(() => chartRenders.length >= 2);
                    assert.deepEqual(await page.evaluate(() => chartRenders.map(render => ({ connected: render.canvas.isConnected, previous: previousCanvases.includes(render.canvas), values: render.values }))), [
                        { connected: true, previous: false, values: [[55]] }, { connected: true, previous: false, values: [[null], [7], [null], [null], [null], [null]] }
                    ]);
                } else {
                    await page.waitForTimeout(100);
                    assert.equal(await page.evaluate(() => chartRenders.length), 0);
                    assert.equal(await page.locator('.portfolio-chart-canvas').count(), 0);
                }
                assert.deepEqual(requests, ['chart']);
            });
        }
        await check('both archive builders wait for one ZIP library and retain actual archive contents', async ({ page, requests, release }) => {
            await page.evaluate(() => {
                window.zipResults = Promise.all([createSingleStudentArchiveZip('Alice', {}), createSchoolYearArchiveZip('Synthetic year', {})]);
                zipResults.catch(() => {});
            });
            assert.match(await page.locator('#archiveStatus').innerText(), /loading.*(zip|export)/i);
            await release('zip');
            const result = await page.evaluate(async () => {
                const archives = await zipResults;
                const single = await JSZip.loadAsync(await archives[0].blob.arrayBuffer());
                const year = await JSZip.loadAsync(await archives[1].blob.arrayBuffer());
                return { single: await single.file('Alice - Portfolio.html').async('string'), info: JSON.parse(await year.file('Synthetic year/archive-info.json').async('string')),
                    year: await year.file('Synthetic year/Students/Bob/Portfolio.html').async('string'), unchanged: protectedPortfolio === localStorage.getItem('wft_portfolio') };
            });
            assert(result.single.includes('Protected saved writing.')); assert(result.year.includes('Protected saved writing.'));
            assert.equal(result.info.studentCount, 2); assert.equal(result.unchanged, true); assert.deepEqual(requests, ['zip']);
            assert.match(await page.evaluate(() => { JSZip.prototype.generateAsync = () => Promise.reject(Error('Synthetic compression refusal')); return createSingleStudentArchiveZip('Alice', {}).then(() => '', error => error.message); }), /compression refusal/);
        });
        await check('public student export preserves saved writing on library failure and can retry', async ({ page, requests, release }) => {
            await page.evaluate(() => { window.publicExport = exportSelectedStudentPortfolio(); });
            await release('zip', null); await page.evaluate(() => publicExport);
            assert.match(await page.locator('#archiveStatus').innerText(), /export failed/i);
            assert.equal(await page.evaluate(() => protectedPortfolio === localStorage.getItem('wft_portfolio')), true);
            assert.match(await page.evaluate(() => featureAlerts.join(' ')), /JSZip/i);
            await page.evaluate(() => { window.downloadedArchive = null; downloadBlob = (blob, name) => { downloadedArchive = { size: blob.size, name }; }; window.publicExport = exportSelectedStudentPortfolio(); });
            await release('zip'); await page.evaluate(() => publicExport);
            assert.match(await page.locator('#archiveStatus').innerText(), /export complete/i);
            const download = await page.evaluate(() => downloadedArchive); assert(download.size > 500); assert.equal(download.name, 'Alice - Writing Portfolio.zip');
            assert.equal(await page.evaluate(() => protectedPortfolio === localStorage.getItem('wft_portfolio')), true); assert.deepEqual(requests, ['zip', 'zip']);
        });
        await check('year archive keeps owner guards while ZIP library loads', async ({ page, requests, release }) => {
            await page.evaluate(() => {
                driveAccessToken = wftSyncState.accessToken = 'synthetic-original-owner';
                wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 600000;
                driveFolderId = wftSyncState.folderId = 'synthetic-original-folder'; clearWftSyncBlockState();
                wftTextInput = async () => 'Synthetic year'; wftConfirm = async () => true;
                document.getElementById('archiveIncludeImages').checked = false;
                window.archiveUploads = 0; window.archiveDownloads = 0;
                saveArchiveZipToDrive = async () => { archiveUploads++; };
                downloadBlob = () => { archiveDownloads++; };
                window.publicYearArchive = archiveCurrentSchoolYear();
            });
            await page.waitForFunction(() => /loading.*(zip|export)/i.test(document.getElementById('archiveStatus').textContent), null, { timeout: 2000 });
            await page.evaluate(() => { driveAccessToken = wftSyncState.accessToken = 'synthetic-replacement-owner'; driveFolderId = wftSyncState.folderId = 'synthetic-replacement-folder'; });
            await release('zip'); await page.evaluate(() => publicYearArchive);
            assert.match(await page.locator('#archiveStatus').innerText(), /archive failed.*not cleared/i);
            assert.deepEqual(await page.evaluate(() => ({ unchanged: protectedPortfolio === localStorage.getItem('wft_portfolio'), students, uploads: archiveUploads, downloads: archiveDownloads })),
                { unchanged: true, students: ['Alice', 'Bob'], uploads: 0, downloads: 0 });
            assert.deepEqual(requests, ['zip']);
        });
    } finally { await browser.close(); }
    const report = { root, scope: 'Native Edge/real app DOM and public feature callers; controlled CDN boundary; locked installed JSZip actual bytes (test dependency version, not production CDN version). Chart renderer is a bounded constructor/control double. No live CDN or Drive access.', cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); assert(cases.every(test => test.passed), 'Feature loading checks failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
