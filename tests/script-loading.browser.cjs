const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const cases = [];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const seeded of [false, true]) {
            const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage();
            const scripts = [], errors = [], dialogs = [], external = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
            await context.addInitScript(seeded => {
                const OriginalDate = Date, instant = Date.UTC(2026, 9, 13, 0, 0, 0);
                window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } };
                window.loadingWrites = [];
                const originalSet = Storage.prototype.setItem;
                Storage.prototype.setItem = function(key, value) { loadingWrites.push(key); return originalSet.call(this, key, value); };
                window.addEventListener('unhandledrejection', event => { (window.loadingRejections ||= []).push(String(event.reason)); });
                if (seeded) {
                    localStorage.setItem('wft_students', '["Synthetic Alice"]');
                    localStorage.setItem('wft_selectedStudent', 'Synthetic Alice');
                    localStorage.setItem('wft_settings', '{"students":["Synthetic Alice"],"targetWordCount":"200","unknown":"keep"}');
                    localStorage.setItem('wft_portfolio', '{"Synthetic Alice":{"sessions":[{"id":"saved","createdAt":"2026-10-01T00:00:00Z","originalText":"Synthetic saved writing.","correctedText":"Synthetic corrected writing.","images":[],"date":"01/10/2026","title":"Untitled","categoryScores":{}}]}}');
                    localStorage.setItem('wft_deletions', '{"records":[]}');
                }
                loadingWrites.length = 0;
            }, seeded);
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.href === 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js') return route.fulfill({ body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')), contentType: 'application/javascript' });
                if (url.origin !== 'http://127.0.0.1:8765') { external.push(url.origin + url.pathname); return route.abort(); }
                if (url.pathname.endsWith('.js')) scripts.push(url.pathname);
                const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
            });
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const startup = await page.evaluate(() => {
                    stopWftSyncPolling(); stopDriveAutoSync();
                    const functions = ['wftConfirm','wftTextInput','openSettingsDrawer','closeSettingsDrawer','readWftRequiredStorage','restoreWftStudentChangeStorage','buildWftEmergencyBackupObject','saveWftPreMigrationBackupToDrive','buildStudentPortfolioHtml','archiveCurrentSchoolYear','exportSelectedStudentPortfolio','isCurrentCropSession','openCropModal','applyCrop','resetCrop','closeCropModal','setWftPhotoBytes','openImageLightbox'];
                    const handlers = [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].filter(attr => /^on/.test(attr.name)).map(attr => attr.value.match(/^([\w$]+)\(/)?.[1]).filter(name => name && name !== 'if'));
                    return { localScripts: [...document.scripts].filter(script => script.src && new URL(script.src).origin === location.origin).map(script => new URL(script.src).pathname), functions: Object.fromEntries([...functions, ...handlers].map(name => [name, typeof window[name]])), crop: [_cropSession,_cropDragStart,_cropRect,_cropLastFocusedEl], students: students.slice(), selected: selectedStudent, settings: getRawSettings(), pending: pendingPortfolioSync, writing: document.getElementById('studentWriting').value, metadataWrites: loadingWrites.filter(key => key === WFT_STORAGE_META_KEY).length, flags: [WFT_SYNC_ENGINE_V2,WFT_SPLIT_STUDENT_FILES_V1,WFT_PORTFOLIO_INDEX_V1,WFT_STORAGE_HEALTH_UI_V1,WFT_LAZY_PORTFOLIO_LOAD_V1,WFT_INDEXEDDB_CACHE_V1,WFT_STUDENT_ID_MAP_V1], rejections: window.loadingRejections || [] };
                });
                assert.deepEqual(scripts, startup.localScripts, 'Every native app script must load exactly once in HTML order');
                assert(Object.values(startup.functions).every(type => type === 'function'), 'Moved APIs and native inline handlers must remain globals: ' + JSON.stringify(startup.functions));
                assert.deepEqual(startup.crop, [null,null,null,null]); assert.equal(startup.metadataWrites, 1, 'Original PATCH 14 initialization must run once');
                assert.deepEqual(startup.flags, [true,true,true,true,false,false,false]);
                assert.equal(startup.writing, ''); assert.equal(startup.pending, null);
                assert.deepEqual(startup.students, seeded ? ['Synthetic Alice'] : []);
                const portfolioBefore = await page.evaluate(() => localStorage.getItem('wft_portfolio'));
                await page.getByRole('button', { name: 'Open settings', exact: true }).click();
                assert(await page.locator('#settingsDrawer').evaluate(element => element.classList.contains('open')));
                assert.notEqual(await page.locator('#storageHealthSummary').textContent(), 'Loading...', 'Opening the drawer must refresh actual health UI');
                await page.locator('.settings-drawer-close').click();
                assert(!(await page.locator('#settingsDrawer').evaluate(element => element.classList.contains('open'))));
                const exportHtml = await page.evaluate(() => buildStudentPortfolioHtml('Synthetic Alice', { sessions: [{ id: 'test', createdAt: '2026-10-01T00:00:00Z', originalText: 'Synthetic export <safe>.', images: [] }] }, 'Synthetic year'));
                assert(exportHtml.includes('Synthetic export &lt;safe&gt;.'));
                await page.evaluate(() => {
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20;
                    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#123456'; ctx.fillRect(0, 0, 20, 20);
                    selectedImages = [{ name: 'synthetic.png', dataUrl: canvas.toDataURL('image/png') }];
                    syncSelectedImageState(); updateSelectedImagePreview();
                });
                if (!(await page.locator('#ocrPanel').evaluate(element => element.open))) await page.locator('#ocrPanel > summary').click();
                await page.locator('.ocr-preview-crop').first().click();
                await page.waitForFunction(() => _cropSession && _cropSession.ready);
                await page.keyboard.press('Escape');
                assert.equal(await page.evaluate(() => _cropSession), null);
                await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
                const final = await page.evaluate(() => ({ crop: [_cropSession,_cropDragStart,_cropRect,_cropLastFocusedEl], portfolio: localStorage.getItem('wft_portfolio'), settings: getRawSettings(), signedIn: wftSyncState.signedIn, channelOpen: !!wftSyncChannel, rejections: window.loadingRejections || [] }));
                if (seeded) assert.equal(final.portfolio, portfolioBefore, 'Loading/drawer/crop/lifecycle must preserve saved portfolio bytes');
                assert.equal(final.signedIn, false); assert.deepEqual(errors, []); assert.deepEqual(final.rejections, []);
                cases.push({ name: seeded ? 'saved-local-startup' : 'empty-startup', passed: true, startup, final, exportHtml, scripts, dialogs, external });
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    const report = { root, cases, passed: cases.length, scope: 'Native HTML/script load, actual drawer and crop controls, lifecycle dispatch and export; synthetic storage/clock/image, all external services blocked, reviewed JSZip served locally.' };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log('Native script loading, globals, initialization and caller checks passed: ' + cases.length);
})().catch(error => { console.error(error); process.exitCode = 1; });
