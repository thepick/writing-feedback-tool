const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const generateArchiveFixtures = async () => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {}; wftConfirm = async () => true;
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
            canvas.getContext('2d').fillRect(0, 0, 2, 2);
            const safeImage = canvas.toDataURL('image/png');
            const payload = '<img src="/blocked-marker" onerror="window.injected=true">';
            const badImage = 'data:image/png;base64,invalid" onerror="window.injected=true';
            const name = 'Alice " & ' + payload;
            const sessions = [
                { id: 'untrusted', createdAt: '2026-10-10T00:00:00Z', date: payload, title: payload,
                    originalText: 'Synthetic original ' + payload, overall: payload, gradeLabel: payload,
                    categoryScores: { Grammar: payload }, feedbackSummary: { strength: '**Good detail** ' + payload },
                    correctedHtml: '<strong>Keep formatting</strong><span class="corrected-highlight">fixed</span>' + payload,
                    notebookPrintHtml: '<div class="page">Notebook ' + payload + '</div>',
                    images: [{ name: 'Valid " & photo', dataUrl: safeImage }, { name: payload, dataUrl: badImage },
                        { name: 'SVG', dataUrl: 'data:image/svg+xml,<svg onload="window.injected=true"/>' },
                        { name: 'External', dataUrl: 'https://blocked.invalid/photo.png' },
                        { name: 'Drive photo', driveFileId: 'synthetic_drive-id' }] },
                { id: 'zero', createdAt: '2026-10-09T00:00:00Z', overall: 0, originalText: 'Zero score', correctedMarkup: '**Corrected** writing' },
                { id: 'numeric', createdAt: '2026-10-08T00:00:00Z', overall: 85, originalText: 'Numeric score' },
                { id: 'missing', createdAt: '2026-10-07T00:00:00Z', overall: null, originalText: 'Missing score' }
            ];
            window.syntheticFixture = { name, sessions, safeImage, badImage, payload };
            localStorage.setItem('wft_portfolio', JSON.stringify({ [name]: { sessions } }));
            localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
            // Capture the real generators' file contents without CDN ZIP compression or network.
            window.syntheticArchives = [];
            window.JSZip = class {
                constructor(files = {}, prefix = '') { this.files = files; this.prefix = prefix; if (!prefix) syntheticArchives.push(files); }
                file(name, body) { this.files[this.prefix + name] = body; return this; }
                folder(name) { return new JSZip(this.files, this.prefix + name + '/'); }
                generateAsync() { return Promise.resolve(new Blob(['synthetic archive'.repeat(100)])); }
            };
            await createSingleStudentArchiveZip(name, {});
            await createSchoolYearArchiveZip('Synthetic year ' + payload, { includeImages: false });
            downloadDriveFileAsBlobPromise = async () => new Blob([Uint8Array.from(atob(safeImage.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/png' });
            // Requested unsafe photo bytes now fail the archive; HTML-only exports still render safe placeholders.
            var rejectedBadPhotos = false;
            try { await createSchoolYearArchiveZip('Invalid requested photos', { includeImages: true }); }
            catch (e) { rejectedBadPhotos = /requested available photo/.test(e.message); }
            syntheticArchives.pop();
            var availableSessions = cloneWftJson(sessions);
            availableSessions[0].images.forEach(image => { if (image.dataUrl && !isSafeWftImageDataUrl(image.dataUrl)) delete image.dataUrl; });
            localStorage.setItem('wft_portfolio', JSON.stringify({ [name]: { sessions: availableSessions } }));
            await createSchoolYearArchiveZip('Synthetic year with photos', { includeImages: true });
            const media = Object.entries(syntheticArchives[2]).filter(([file, body]) => file.includes('/Photos/') && body instanceof Blob).map(([file, body]) => ({ file, size: body.size }));
            const html = syntheticArchives.flatMap((files, archive) => Object.entries(files).filter(([file]) => file.endsWith('.html')).map(([file, body]) => ({ archive, file, body })));
            html.push({ archive: 'notebook', file: 'notebook.html', body: buildNotebookPrintDocument(refreshNotebookPage2Guide(sessions[0].notebookPrintHtml, name, sessions[0]), name, payload) });
            const manifests = syntheticArchives.map(files => ({ names: Object.keys(files), json: Object.entries(files).filter(([file]) => file.endsWith('.json')).map(([file, body]) => ({ file, data: JSON.parse(body) })) }));
            return { html, safeImage, payload, media, rejectedBadPhotos, manifests };
        };

const exerciseLivePortfolio = async () => {
            delete window.injected;
            const { name, sessions, safeImage, badImage } = syntheticFixture;
            const select = document.getElementById('portfolioStudentSelect');
            select.appendChild(new Option(name, name)); select.value = name;
            renderStudentPortfolio();
            await new Promise(resolve => setTimeout(resolve, 100));
            const portfolioInjected = window.injected === true;
            const driveNode = document.querySelector('[data-drive-file-id="synthetic_drive-id"]');
            driveAccessToken = 'synthetic';
            const originalFetch = window.fetch;
            window.fetch = async url => {
                if (String(url).startsWith('https://www.googleapis.com/drive/v3/files/synthetic_drive-id?alt=media')) {
                    return new Response(Uint8Array.from(atob(safeImage.split(',')[1]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png' } });
                }
                return originalFetch(url);
            };
            hydratePortfolioDriveImages(document.getElementById('portfolioContent'));
            await new Promise(resolve => setTimeout(resolve, 100));
            const galleryDriveLoaded = driveNode?.naturalWidth > 0;
            window.fetch = originalFetch; driveAccessToken = '';
            delete window.injected;
            selectedImages = [{ dataUrl: badImage, name: 'Direct preview' }, { dataUrl: safeImage, name: 'Valid " & preview' }];
            updateSelectedImagePreview();
            await new Promise(resolve => setTimeout(resolve, 100));
            const directInjected = window.injected === true;
            delete window.injected;
            await reassessPortfolioSession(name, 'untrusted');
            await new Promise(resolve => setTimeout(resolve, 150));
            const restored = selectedImages.map(image => image.dataUrl);
            const previewInjected = window.injected === true;
            driveAccessToken = 'synthetic'; downloadDriveFileAsBlobPromise = async () => new Blob([Uint8Array.from(atob(safeImage.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/png' });
            const driveRestore = await restorePortfolioSessionImagesForReassessment({ images: [sessions[0].images[4]] });
            await new Promise(resolve => setTimeout(resolve, 50));
            const driveLoaded = document.querySelector('#ocrPreviewList img')?.naturalWidth > 0;
            const fallback = await getPortfolioImageDataUrlForReassessment({ dataUrl: badImage, originalDataUrl: safeImage });
            const unavailable = await getPortfolioImageDataUrlForReassessment({ dataUrl: 'javascript:window.injected=true' });
            downloadDriveFileAsBlobPromise = async () => new Blob(['<svg onload="window.injected=true"/>'], { type: 'image/svg+xml' });
            const unsafeDrive = await getPortfolioImageDataUrlForReassessment({ driveFileId: 'unsafe_synthetic' });
            const originalMediaFetch = window.fetch;
            let invalidMediaRequests = 0, invalidMediaRejections = 0;
            window.fetch = () => { invalidMediaRequests++; return Promise.reject(new Error('Unexpected request')); };
            for (const src of [badImage, 'https://blocked.invalid/photo.png', 'data:image/svg+xml,<svg/>', 'javascript:window.injected=true']) {
                try { await dataUrlToBlobPromise(src); } catch (error) { if (error.message === 'Invalid image data URL.') invalidMediaRejections++; }
            }
            window.fetch = originalMediaFetch;
            const downloads = []; downloadBlob = (blob, fileName) => downloads.push(fileName);
            exportSelectedStudentPortfolio(); await new Promise(resolve => setTimeout(resolve, 50));
            let saved = 0, cleared = 0;
            wftTextInput = async () => 'Synthetic year'; saveArchiveZipToDrive = async () => { saved++; };
            clearCurrentClassAfterSuccessfulArchive = () => { cleared++; }; window.alert = () => {};
            await archiveCurrentSchoolYear(); await new Promise(resolve => setTimeout(resolve, 100));
            return { portfolioInjected, directInjected, previewInjected, restored, driveNode: !!driveNode, galleryDriveLoaded, driveRestore, driveLoaded, fallback, unavailable, unsafeDrive, invalidMediaRequests, invalidMediaRejections, downloads, saved, cleared };
        };

function checkGeneratedArchives(generated, check) {
    check('requested unsafe photo bytes reject archive completion', () => assert.equal(generated.rejectedBadPhotos, true));
    check('year archive with photos includes safe local and Drive image bytes', () => { assert.equal(generated.media.length, 2); assert.ok(generated.media.every(image => image.size > 0)); });
    check('live single/year ZIP entries preserve student sessions and manifests', () => {
        assert.equal(generated.manifests.length, 3);
        for (const [index, archive] of generated.manifests.entries()) {
            assert.ok(archive.names.some(file => file.endsWith('Portfolio.html')));
            if (index > 0) {
                assert.ok(archive.json.some(({ data }) => data.sessions?.length === 4));
                assert.ok(archive.json.some(({ file, data }) => file.endsWith('archive-info.json') && data.studentCount === 1));
            }
            if (index === 2) assert.ok(archive.json.some(({ file }) => file.endsWith('photos-manifest.json')));
        }
    });
}

function checkExportedDocument(item, state, generated, check) {
    check('served ' + item.archive + '/' + item.file + ' rejects executable imports', () => {
        assert.equal(state.injected, false);
        assert.ok(state.handlers.every(value => !value.includes('window.injected')));
    });
    if (item.file.endsWith('Portfolio.html')) check('valid photos, zero/numeric/missing scores and formatting survive ' + item.archive + '/' + item.file, () => {
        assert.deepEqual(state.scores, [generated.payload + '%', '0%', '85%', 'N/A']);
        assert.equal(state.photos.length, 1); assert.equal(state.photos[0].src, generated.safeImage);
        assert.equal(state.photos[0].alt, 'Valid " & photo'); assert.equal(state.photos[0].loaded, true);
        assert.equal(state.formatted, true);
    });
}

function checkLivePortfolio(live, generated, check) {
    check('live portfolio raw score and corrected HTML are safe', () => assert.equal(live.portfolioInjected, false));
    check('direct selected photo preview is safe', () => assert.equal(live.directInjected, false));
    check('actual reassessment rejects unsafe saved sources and keeps valid data image', () => { assert.equal(live.previewInjected, false); assert.deepEqual(live.restored, [generated.safeImage]); });
    check('Drive references, live gallery loading and downloaded image restoration survive', () => { assert.equal(live.driveNode, true); assert.equal(live.galleryDriveLoaded, true); assert.equal(live.driveRestore.restored, 1); assert.equal(live.driveLoaded, true); });
    check('safe original photo fallback and unsafe local/Drive image rejection', () => { assert.equal(live.fallback, generated.safeImage); assert.equal(live.unavailable, ''); assert.equal(live.unsafeDrive, ''); });
    check('archive media rejects unsafe sources before fetching', () => { assert.equal(live.invalidMediaRequests, 0); assert.equal(live.invalidMediaRejections, 4); });
    check('student/year export handlers complete through tested generators', () => { assert.equal(live.downloads.length, 2); assert.equal(live.saved, 1); assert.equal(live.cleared, 1); });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [], failures = [];
    const check = (name, run) => {
        try { run(); cases.push({ name, passed: true }); }
        catch (error) { cases.push({ name, passed: false, error: error.message }); failures.push(name); }
    };
    try {
        const context = await browser.newContext();
        const documents = new Map();
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            if (documents.has(url.pathname)) return route.fulfill({ contentType: 'text/html', body: documents.get(url.pathname) });
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
        });
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof reassessPortfolioSession === 'function');
        const generated = await page.evaluate(generateArchiveFixtures);
        await page.waitForTimeout(100);
        const generationInjected = await page.evaluate(() => window.injected === true);
        check('export generation cannot execute imported corrected HTML', () => assert.equal(generationInjected, false));
        checkGeneratedArchives(generated, check);
        for (let i = 0; i < generated.html.length; i++) {
            const item = generated.html[i];
            const url = '/generated-' + i + '.html'; documents.set(url, item.body);
            const exported = await context.newPage();
            await exported.goto('http://127.0.0.1:8765' + url, { waitUntil: 'load' });
            const state = await exported.evaluate(() => ({ injected: window.injected === true, handlers: [...document.querySelectorAll('*')].flatMap(node => [...node.attributes].filter(attr => /^on/i.test(attr.name)).map(attr => attr.value)), scores: [...document.querySelectorAll('.session-score')].map(node => node.textContent), photos: [...document.querySelectorAll('.export-image')].map(img => ({ src: img.getAttribute('src'), alt: img.alt, loaded: img.naturalWidth > 0 })), formatted: !!document.querySelector('.corrected-highlight') && !!document.querySelector('strong'), text: document.body.textContent }));
            checkExportedDocument(item, state, generated, check);
            await exported.close();
        }
        const live = await page.evaluate(exerciseLivePortfolio);
        checkLivePortfolio(live, generated, check);
        const performance = await page.evaluate(() => {
            const sessions = Array.from({ length: 100 }, (_, i) => ({ id: String(i), overall: 85, originalText: 'Synthetic text '.repeat(100), correctedMarkup: '**Corrected** writing '.repeat(100), feedbackSummary: { strength: 'Good detail' } }));
            const samples = {};
            for (const [name, build] of [['portfolio', buildStudentPortfolioHtml], ['summary', buildStudentSummaryHtml]]) {
                build('Synthetic', { sessions }, '2026-2027');
                samples[name] = Array.from({ length: 10 }, () => { const start = performance.now(); const html = build('Synthetic', { sessions }, '2026-2027'); return { ms: performance.now() - start, bytes: new Blob([html]).size }; });
            }
            return samples;
        });
        const evidence = { cases, performance, scope: 'Synthetic Edge browser; actual served scripts and generated HTML; all external requests blocked; ZIP/media/Drive writes stubbed' };
        if (process.env.WFT_TEST_EVIDENCE) fs.writeFileSync(process.env.WFT_TEST_EVIDENCE, JSON.stringify(evidence, null, 2));
        console.log(JSON.stringify(evidence, null, 2));
        assert.deepEqual(failures, [], 'Portfolio HTML security regressions');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
