const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
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
        for (const input of ['mouse', 'touch-reverse']) {
            const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, hasTouch: true }), errors = [];
            let observed;
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.evaluate(async () => {
                    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown(); document.getElementById('studentSelect').value = 'Alice';
                    const source = document.createElement('canvas'); source.width = 200; source.height = 100;
                    const ctx = source.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(20, 20, 40, 20);
                    ctx.fillStyle = '#f00'; ctx.fillRect(90, 50, 20, 20); ctx.fillStyle = '#00f'; ctx.fillRect(140, 15, 25, 25);
                    const png = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
                    const file = new File([png], 'native-gesture.png', { type: 'image/png' });
                    window.gestureOriginal = await fileToDataUrl(file);
                    ctx.fillStyle = '#4b8dce'; ctx.fillRect(0, 0, 200, 100);
                    const otherPng = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
                    selectedImages = []; syncSelectedImageState(); await handleSelectedImages([file, new File([otherPng], 'unrelated.png', { type: 'image/png' })]);
                    Object.assign(selectedImages[0], { imageId: 'gesture-target', imageRevision: 'before-gesture', driveFileId: 'old-target-drive', driveName: 'old-target.png', driveUploadedAt: '2026-10-01', extractedText: 'Old target OCR', extractionPromise: Promise.resolve('Old target OCR') });
                    Object.assign(selectedImages[1], { imageId: 'unrelated-photo', driveFileId: 'unrelated-drive', extractedText: 'Unrelated OCR', extractionPromise: Promise.resolve('Unrelated OCR') });
                    syncSelectedImageState(); updateSelectedImagePreview(); document.getElementById('studentWriting').value = 'Protected current writing.';
                    pendingPortfolioSync = { studentName: 'Alice', signature: 'protected-pending', sessionData: { id: 'pending', originalText: 'Protected pending writing.', images: [] } }; persistPendingPortfolioSync();
                    activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'saved' };
                    window.gestureState = () => JSON.stringify({ students, selectedStudent, writing: document.getElementById('studentWriting').value, pending: pendingPortfolioSync, source: activePortfolioReassessmentSource,
                        storage: ['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY].map(key => localStorage.getItem(key)) });
                    window.gestureBefore = { state: gestureState(), images: selectedImages, target: selectedImages[0], other: selectedImages[1], otherBytes: JSON.stringify(selectedImages[1]),
                        otherPromise: selectedImages[1].extractionPromise, pending: pendingPortfolioSync, source: activePortfolioReassessmentSource, originalAcquired: selectedImages[0].dataUrl === gestureOriginal };
                    window.gestureEvents = [];
                    for (const type of ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend']) document.addEventListener(type, event => gestureEvents.push({ type, trusted: event.isTrusted, target: event.target.id }), true);
                });
                if (!(await page.locator('#ocrPanel').evaluate(element => element.open))) await page.locator('#ocrPanel > summary').click();
                await page.locator('.ocr-preview-crop').first().click();
                await page.waitForFunction(() => _cropSession && _cropSession.ready);
                const bitmap = await page.evaluate(() => {
                    for (const id of ['cropCanvas', 'cropOverlay']) { const canvas = document.getElementById(id); canvas.style.width = '100px'; canvas.style.height = '50px'; }
                    // Native mouse coordinates are integral; align this fixed-scale fixture to a whole-pixel origin.
                    const rect = document.getElementById('cropOverlay').getBoundingClientRect();
                    for (const id of ['cropCanvas', 'cropOverlay']) document.getElementById(id).style.transform = `translate(${Math.ceil(rect.left) - rect.left}px, ${Math.ceil(rect.top) - rect.top}px)`;
                    return [document.getElementById('cropCanvas').width, document.getElementById('cropCanvas').height];
                });
                assert.deepEqual(bitmap, [200, 100]);
                const box = await page.locator('#cropOverlay').boundingBox(); assert.equal(box.width, 100); assert.equal(box.height, 50);
                let touch;
                if (input === 'mouse') {
                    await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down();
                    await page.mouse.move(box.x + 55, box.y + 35, { steps: 3 }); await page.mouse.up();
                } else {
                    touch = await page.context().newCDPSession(page);
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 55, y: box.y + 35, id: 1 }] });
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 5, y: box.y + 5, id: 1 }] });
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                }
                const released = await page.evaluate(() => ({ rect: _cropRect, stopped: _cropDragStart === null }));
                assert.deepEqual(released, { rect: input === 'mouse' ? { x: 10, y: 10, w: 100, h: 60 } : { x: 110, y: 70, w: -100, h: -60 }, stopped: true });
                if (input === 'mouse') await page.mouse.move(box.x + 90, box.y + 45);
                else {
                    const title = await page.locator('#cropModalTitle').boundingBox();
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: title.x + 20, y: title.y + 5, id: 2 }] });
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: title.x + 60, y: title.y + 5, id: 2 }] });
                    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                }
                assert.deepEqual(await page.evaluate(() => ({ rect: _cropRect, stopped: _cropDragStart === null })), released, 'Document release stops later movement from changing the region');
                await page.locator('#cropApplyBtn').click(); await page.waitForFunction(() => !_cropSession);
                observed = await page.evaluate(async () => {
                    const photo = selectedImages[0], image = await loadImageElement(photo.dataUrl), canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
                    return { dimensions: [canvas.width, canvas.height], pixels: [[4, 4], [20, 20], [70, 20], [90, 50], [50, 50]].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data)),
                        originalAcquired: gestureBefore.originalAcquired, originalKept: photo.originalDataUrl === gestureOriginal, jpeg: photo.dataUrl.startsWith('data:image/jpeg;'),
                        id: photo.imageId, revisionAdvanced: !!photo.imageRevision && photo.imageRevision !== 'before-gesture', driveCleared: photo.driveFileId === '' && !Object.hasOwn(photo, 'driveName') && !Object.hasOwn(photo, 'driveUploadedAt'),
                        ocrCleared: photo.extractedText === '' && photo.extractionPromise === null && selectedImageExtractedText === '' && selectedImageExtractionPromise === null,
                        pendingUpload: photo.pendingDriveUpload, primaryUpdated: selectedImageDataUrl === photo.dataUrl,
                        preserved: { state: gestureState() === gestureBefore.state, queue: selectedImages === gestureBefore.images, target: photo === gestureBefore.target,
                            other: selectedImages[1] === gestureBefore.other && JSON.stringify(selectedImages[1]) === gestureBefore.otherBytes && selectedImages[1].extractionPromise === gestureBefore.otherPromise,
                            pending: pendingPortfolioSync === gestureBefore.pending, source: activePortfolioReassessmentSource === gestureBefore.source }, events: gestureEvents };
                });
                assert.deepEqual(observed.dimensions, [100, 60]);
                const expectedPixels = [[255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 0, 0], [255, 255, 255]];
                observed.pixels.forEach((pixel, index) => { assert.ok(pixel.slice(0, 3).every((value, channel) => Math.abs(value - expectedPixels[index][channel]) < 15), 'Independent source-relative ink/marker/background pixel ' + index); assert.equal(pixel[3], 255); });
                for (const field of ['originalAcquired', 'originalKept', 'jpeg', 'revisionAdvanced', 'driveCleared', 'ocrCleared', 'pendingUpload', 'primaryUpdated']) assert.equal(observed[field], true, field);
                assert.equal(observed.id, 'gesture-target'); assert.ok(Object.values(observed.preserved).every(Boolean));
                assert.ok(observed.events.some(event => event.type === (input === 'mouse' ? 'mouseup' : 'touchend') && event.target === 'cropOverlay' && event.trusted));
                assert.ok(observed.events.every(event => event.trusted)); assert.deepEqual(errors, []);
                cases.push({ name: 'native scaled ' + input + ' selects intended pixels and retains other work', passed: true, released, observed });
            } catch (error) { cases.push({ name: 'native scaled ' + input + ' selects intended pixels and retains other work', passed: false, error: error.message, observed }); }
            finally { await page.close(); }
        }
    } finally { await browser.close(); }
    const report = { suite: 'crop-transparency', cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    assert.deepEqual(cases.filter(row => !row.passed), []);
})().catch(error => { console.error(error); process.exitCode = 1; });
