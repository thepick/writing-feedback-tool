const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const localAppRoute = require('./support/local-app-route');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const opaque of [false, true]) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => localAppRoute(route, root));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(async opaque => {
                stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                const source = document.createElement('canvas'); source.width = 200; source.height = 100;
                const ctx = source.getContext('2d');
                if (opaque) { ctx.fillStyle = '#4b8dce'; ctx.fillRect(0, 0, 200, 100); }
                ctx.fillStyle = '#000'; ctx.fillRect(20, 20, 50, 30);
                const blob = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
                const file = new File([blob], 'synthetic-crop.png', { type: 'image/png' });
                window.cropOriginal = await fileToDataUrl(file);
                selectedImages = []; syncSelectedImageState(); await handleSelectedImages([file]);
                window.cropBefore = selectedImages[0].dataUrl;
                openCropModal(0);
            }, opaque);
            await page.waitForFunction(() => _cropSession && _cropSession.ready);
            await page.evaluate(() => {
                const canvas = document.getElementById('cropCanvas');
                _cropRect = { x: 0, y: 0, w: canvas.width, h: canvas.height }; applyCrop();
            });
            await page.waitForFunction(() => !_cropSession);
            const observed = await page.evaluate(async () => {
                const photo = selectedImages[0], image = await loadImageElement(photo.dataUrl);
                const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
                return { before: cropBefore === cropOriginal, background: Array.from(ctx.getImageData(0, 0, 1, 1).data),
                    ink: Array.from(ctx.getImageData(30, 30, 1, 1).data), jpeg: photo.dataUrl.startsWith('data:image/jpeg;'),
                    originalKept: photo.originalDataUrl === cropOriginal, width: canvas.width, height: canvas.height };
            });
            const expected = opaque ? [75, 141, 206] : [255, 255, 255];
            cases.push({ name: opaque ? 'opaque color preserved' : 'transparent crop remains readable', passed: observed.before && observed.jpeg && observed.originalKept && observed.width === 200 && observed.height === 100
                && observed.background.slice(0, 3).every((value, index) => Math.abs(value - expected[index]) < 10)
                && observed.ink.slice(0, 3).every(value => value < 15), observed });
            const reset = await page.evaluate(() => { openCropModal(0); resetCrop(); return selectedImages[0].dataUrl === cropOriginal && !selectedImages[0].originalDataUrl; });
            cases.push({ name: (opaque ? 'opaque' : 'transparent') + ' reset restores exact original', passed: reset && !errors.length, errors });
            await page.close();
        }
    } finally { await browser.close(); }
    console.log(JSON.stringify({ suite: 'crop-transparency', cases }, null, 2));
    assert.deepEqual(cases.filter(row => !row.passed), []);
})().catch(error => { console.error(error); process.exitCode = 1; });
