const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const localAppRoute = require('./support/local-app-route');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    async function run(name, action, viewport = { width: 1280, height: 720 }) {
        const page = await browser.newPage({ viewport, hasTouch: true }), errors = [];
        page.setDefaultTimeout(5000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root));
        try {
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(() => {
                stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                const source = document.createElement('canvas'); source.width = 800; source.height = 1200;
                const ctx = source.getContext('2d'); ctx.fillStyle = '#00f'; ctx.fillRect(0, 0, 800, 1200);
                ctx.fillStyle = '#f00'; ctx.fillRect(80, 120, 640, 960);
                selectedImages = [{ name: 'Synthetic portrait.png', dataUrl: source.toDataURL('image/png'), extractedText: 'Old OCR' }];
                syncSelectedImageState(); updateSelectedImagePreview();
                window.cropBytesBefore = selectedImages[0].dataUrl;
                openCropModal(0);
            });
            await page.waitForFunction(() => _cropSession && _cropSession.ready);
            await action(page);
            assert.deepEqual(errors, [], 'No uncaught browser errors');
            cases.push({ name, passed: true });
        } catch (error) { cases.push({ name, passed: false, error: error.message }); }
        finally { await page.close(); }
    }
    const bounds = page => page.evaluate(() => {
        const canvas = document.getElementById('cropCanvas'), overlay = document.getElementById('cropOverlay');
        const r = overlay.getBoundingClientRect(), wrap = document.getElementById('cropCanvasWrap').getBoundingClientRect();
        return { width: canvas.width, height: canvas.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            wrapRight: wrap.right, wrapBottom: wrap.bottom, viewport: [innerWidth, innerHeight] };
    });
    function fits(r) {
        assert.ok(r.height > 0 && r.width > 0);
        assert.ok(r.bottom <= r.wrapBottom + 1 && r.right <= r.wrapRight + 1, 'Entire portrait must fit crop workspace: ' + JSON.stringify(r));
        assert.ok(r.top >= 0 && r.left >= 0 && r.bottom <= r.viewport[1] && r.right <= r.viewport[0], 'All page bounds must be reachable');
        assert.ok(Math.abs(r.height / r.width - 1.5) < 0.01, 'Preserve image proportions');
    }
    await run('portrait fits height and width at laptop size, then refits through phone rotation', async page => {
        fits(await bounds(page));
        for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 720 }]) {
            const before = await page.evaluate(() => _cropSession.request);
            await page.setViewportSize(viewport);
            await page.waitForFunction(before => _cropSession.ready && _cropSession.request > before, before);
            fits(await bounds(page));
        }
    });
    await run('keyboard bounds select intended pixels and apply without any pointer operation', async page => {
        await page.keyboard.press('Escape');
        await page.evaluate(() => document.getElementById('ocrPanel').open = true);
        await page.locator('.ocr-preview-crop').first().focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => _cropSession && _cropSession.ready);
        assert.equal(await page.getByRole('spinbutton', { name: 'Left (%)', exact: true }).count(), 1, 'Labeled keyboard crop bounds must exist');
        for (const [name, value] of [['Left (%)', '10'], ['Top (%)', '10'], ['Right (%)', '90'], ['Bottom (%)', '90']]) {
            const field = page.getByRole('spinbutton', { name, exact: true });
            await field.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(value); await page.keyboard.press('Tab');
        }
        const left = page.getByRole('spinbutton', { name: 'Left (%)', exact: true });
        await left.focus(); await page.keyboard.press('ArrowUp');
        assert.equal(await left.inputValue(), '11', 'Arrow adjusts native number control');
        await page.keyboard.press('ArrowDown');
        assert.match(await page.locator('#cropSelectionStatus').textContent(), /10.*10.*90.*90/);
        await page.locator('#cropApplyBtn').focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => !_cropSession);
        const observed = await page.evaluate(async () => {
            const image = await loadImageElement(selectedImages[0].dataUrl), c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
            const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
            return { size: [image.width, image.height], center: [...ctx.getImageData(320, 480, 1, 1).data], original: selectedImages[0].originalDataUrl === cropBytesBefore, ocr: selectedImages[0].extractedText };
        });
        assert.deepEqual(observed.size, [640, 960]); assert.ok(observed.center[0] > 240 && observed.center[2] < 20);
        assert.equal(observed.original, true); assert.equal(observed.ocr, '');
    });
    await run('number controls offer drag-free pointer selection and constrain crossed bounds', async page => {
        assert.equal(await page.locator('#cropLeft').count(), 1, 'Drag-free crop control must exist');
        await page.locator('#cropLeft').fill('95'); await page.locator('#cropRight').fill('20');
        await page.locator('#cropTop').fill('-20'); await page.locator('#cropBottom').fill('120');
        const observed = await page.evaluate(() => ({ rect: _cropRect, width: cropCanvas.width, height: cropCanvas.height, values: ['cropLeft','cropTop','cropRight','cropBottom'].map(id => +document.getElementById(id).value) }));
        assert.ok(observed.rect.w > 0 && observed.rect.h > 0 && observed.rect.x >= 0 && observed.rect.y >= 0);
        assert.ok(observed.rect.x + observed.rect.w <= observed.width && observed.rect.y + observed.rect.h <= observed.height);
        assert.ok(observed.values.every(value => value >= 0 && value <= 100));
        const box = await page.locator('#cropLeft').boundingBox();
        await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2 + 5);
        assert.notEqual(await page.locator('#cropLeft').inputValue(), String(observed.values[0]), 'Native spinner changes crop without dragging');
    });
    await run('resize invalidates pending Apply and preserves selected source area after refit', async page => {
        await page.evaluate(() => {
            _cropRect = { x: cropCanvas.width * .1, y: cropCanvas.height * .1, w: cropCanvas.width * .8, h: cropCanvas.height * .8 };
            drawCropOverlay(); applyCrop(); window.dispatchEvent(new Event('resize'));
        });
        await page.waitForFunction(() => _cropSession && _cropSession.ready);
        assert.equal(await page.evaluate(() => selectedImages[0].dataUrl === cropBytesBefore), true, 'Pre-resize Apply must not mutate photo');
        const before = await page.evaluate(() => _cropSession.request);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(before => _cropSession.ready && _cropSession.request > before, before);
        const normalized = await page.evaluate(() => [_cropRect.x / cropCanvas.width, _cropRect.y / cropCanvas.height, _cropRect.w / cropCanvas.width, _cropRect.h / cropCanvas.height]);
        normalized.forEach((value, index) => assert.ok(Math.abs(value - [.1,.1,.8,.8][index]) < .001));
        await page.locator('#cropApplyBtn').click(); await page.waitForFunction(() => !_cropSession);
        assert.deepEqual(await page.evaluate(async () => { const image = await loadImageElement(selectedImages[0].dataUrl); return [image.width,image.height]; }), [640,960]);
    });
    await run('blur, touch cancellation and lost pointer capture stop interrupted selections', async page => {
        for (const interrupt of ['blur', 'touchcancel', 'lostpointercapture']) {
            await page.evaluate(interrupt => {
                const overlay = document.getElementById('cropOverlay'), r = overlay.getBoundingClientRect();
                overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 10, clientY: r.top + 10 }));
                document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 30, clientY: r.top + 40 }));
                window.interruptedRect = JSON.stringify(_cropRect);
                (interrupt === 'blur' ? window : overlay).dispatchEvent(new Event(interrupt, { bubbles: true }));
                document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 60, clientY: r.top + 80 }));
            }, interrupt);
            assert.equal(await page.evaluate(() => _cropDragStart), null, interrupt + ' clears drag');
            assert.equal(await page.evaluate(() => JSON.stringify(_cropRect) === interruptedRect), true, interrupt + ' blocks later movement');
        }
        await page.locator('#cropCancelBtn').click(); assert.equal(await page.evaluate(() => _cropDragStart), null);
    });
    await run('selected thumbnail supports keyboard inspection and returns focus', async page => {
        await page.locator('#cropCancelBtn').click();
        await page.evaluate(() => document.getElementById('ocrPanel').open = true);
        const button = page.getByRole('button', { name: 'Enlarge selected writing sample 1', exact: true });
        assert.equal(await button.count(), 1, 'Selected photo must have a native named enlargement button');
        await button.focus(); await page.keyboard.press('Space');
        await page.waitForFunction(() => document.getElementById('imgLightbox').classList.contains('open'));
        await page.keyboard.press('Escape'); assert.equal(await button.evaluate(el => el === document.activeElement), true);
    });
    await run('saved portfolio thumbnails support keyboard inspection and retain Drive status', async page => {
        await page.locator('#cropCancelBtn').click();
        await page.evaluate(() => {
            const fixture = document.createElement('div'); fixture.id = 'savedPhotoFixture';
            fixture.innerHTML = renderPortfolioSessionImageHtml({ name: 'Saved synthetic photo', dataUrl: selectedImages[0].dataUrl })
                + renderPortfolioSessionImageHtml({ name: 'Drive synthetic photo', driveFileId: 'synthetic-file' });
            document.body.appendChild(fixture);
        });
        const button = page.getByRole('button', { name: 'Enlarge Saved synthetic photo', exact: true });
        assert.equal(await button.count(), 1, 'Saved photo must have native enlargement button');
        await button.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.getElementById('imgLightbox').classList.contains('open'));
        await page.keyboard.press('Escape'); assert.equal(await button.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.getByRole('button', { name: 'Enlarge Drive synthetic photo', exact: true }).count(), 1);
        await page.route('https://www.googleapis.com/drive/v3/files/synthetic-file?alt=media', async route => {
            const data = await page.evaluate(() => cropBytesBefore.split(',')[1]);
            await route.fulfill({ contentType: 'image/png', body: Buffer.from(data, 'base64') });
        });
        await page.evaluate(() => { driveAccessToken = 'synthetic-only'; hydratePortfolioDriveImages(document.getElementById('savedPhotoFixture')); });
        await page.waitForFunction(() => document.querySelector('#savedPhotoFixture .drive-image-status').textContent === 'Loaded from Drive');
        await page.getByRole('button', { name: 'Enlarge Drive synthetic photo', exact: true }).focus();
        await page.keyboard.press('Space');
        await page.waitForFunction(() => document.getElementById('imgLightbox').classList.contains('open'));
        await page.keyboard.press('Escape');
    });
    await browser.close();
    const report = { suite: 'crop-accessibility', cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); assert.deepEqual(cases.filter(row => !row.passed), []);
})().catch(error => { console.error(error); process.exitCode = 1; });
