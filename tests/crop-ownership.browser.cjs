const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [], failures = [];
    const scenarios = ['cancel-switch', 'student-switch', 'student-away-back', 'portfolio-student-away-back',
        'reopen-photo', 'reopen-same', 'second-apply', 'reset-pending-apply', 'preview-reset',
        'move', 'move-away-back', 'drag-reorder', 'remove', 'clear', 'replace-same-bytes', 'changed-bytes',
        'native-crop-close', 'reassessment', 'class-reset', 'roster-clear', 'student-delete', 'failed-class-reset-keeps-crop',
        'open-cancel', 'open-reopen', 'open-switch', 'open-reset', 'open-apply-before-load',
        'reset-cancel', 'reset-reopen', 'reset-switch', 'current-crop', 'current-reset',
        'current-reset-apply', 'current-preview-reset', 'current-secondary-crop', 'unrelated-writing-settings', 'reverse-scaled-crop', 'invalid-region'];
    try {
        for (const scenario of scenarios) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
                const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) })
                    : route.fulfill({ status: 404, body: '' });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof applyCrop === 'function');
            try {
                const result = await page.evaluate(async scenario => {
                    stopWftSyncPolling(); scheduleWftCloudSync = () => {}; flushWftCloudSyncNow = () => {}; wftConfirm = async () => true;
                    window.alert = () => {};
                    const select = document.getElementById('studentSelect');
                    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown(); select.value = 'Alice';
                    const nativeImage = window.Image;
                    const makeImage = async (color, width, height) => {
                        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
                        const src = canvas.toDataURL('image/png'), image = new nativeImage();
                        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = src; });
                        return { src, image };
                    };
                    const red = await makeImage('red', 40, 30), blue = await makeImage('blue', 60, 50);
                    const alice = { dataUrl: red.src, name: 'Alice photo', extractedText: 'Old OCR', extractionPromise: Promise.resolve('Old OCR') };
                    const bob = { dataUrl: blue.src, name: 'Bob photo', extractedText: 'Bob OCR' };
                    if (scenario === 'preview-reset') { alice.originalDataUrl = red.src; alice.dataUrl = blue.src; }
                    selectedImages = [alice, bob]; syncSelectedImageState(); updateSelectedImagePreview();
                    const canvas = document.getElementById('cropCanvas');
                    let canvasDraws = 0;
                    const nativeDraw = CanvasRenderingContext2D.prototype.drawImage;
                    CanvasRenderingContext2D.prototype.drawImage = function(...args) {
                        if (this.canvas === canvas) canvasDraws++;
                        return nativeDraw.apply(this, args);
                    };
                    const held = [];
                    // Decode native images normally, but release the app's onload callback only on demand.
                    window.Image = function() {
                        const image = new nativeImage(); let callback, requestedSrc;
                        Object.defineProperty(image, 'onload', { configurable: true, get: () => callback, set: fn => { callback = fn; } });
                        Object.defineProperty(image, 'src', { configurable: true, get: () => requestedSrc, set(src) {
                            if (src !== red.src && src !== blue.src) throw new Error('Unexpected synthetic source');
                            requestedSrc = src; image.setAttribute('src', src);
                            held.push(async () => { await image.decode(); callback(); });
                        } });
                        return image;
                    };
                    const release = async index => { assertIndex(index); await held[index](); };
                    const assertIndex = index => { if (!held[index]) throw new Error('Missing controlled image load ' + index); };
                    const drawRegion = () => { _cropRect = { x: 4, y: 5, w: 20, h: 10 }; drawCropOverlay(); };
                    const changeStudent = name => { select.value = name; select.dispatchEvent(new Event('change')); };
                    const snapshot = () => ({ photos: selectedImages.map(photo => ({ name: photo.name, dataUrl: photo.dataUrl, originalDataUrl: photo.originalDataUrl || null, extractedText: photo.extractedText })),
                        alice: { dataUrl: alice.dataUrl, originalDataUrl: alice.originalDataUrl || null },
                        canvas: canvas.toDataURL(), canvasDraws, width: canvas.width, height: canvas.height,
                        open: document.getElementById('cropModal').classList.contains('open'),
                        title: document.getElementById('cropModalTitle').textContent,
                        status: document.getElementById('ocrStatus').textContent });
                    openCropModal(scenario === 'current-secondary-crop' ? 1 : 0);
                    const phase = scenario.startsWith('open-') ? 'open' : ['reset-cancel', 'reset-reopen', 'reset-switch'].includes(scenario) ? 'reset' : 'apply';
                    if (phase !== 'open') await release(0);
                    if (phase === 'reset' || scenario.startsWith('current-reset')) {
                        alice.originalDataUrl = red.src; alice.dataUrl = blue.src;
                        closeCropModal(); openCropModal(0); await release(1);
                    }
                    let pending;
                    if (phase === 'open') pending = 0;
                    else if (phase === 'reset') { resetCrop(); pending = 2; }
                    else { drawRegion(); applyCrop(); pending = scenario.startsWith('current-reset') ? 2 : 1; }
                    if (scenario === 'cancel-switch') { closeCropModal(); changeStudent('Bob'); selectedImages = [bob]; syncSelectedImageState(); updateSelectedImagePreview(); }
                    if (scenario === 'student-switch' || scenario === 'open-switch' || scenario === 'reset-switch') changeStudent('Bob');
                    if (scenario === 'student-away-back') { changeStudent('Bob'); changeStudent('Alice'); }
                    if (scenario === 'portfolio-student-away-back') { openStudentPortfolio('Bob'); openStudentPortfolio('Alice'); }
                    if (scenario.endsWith('-cancel')) closeCropModal();
                    if (scenario === 'reopen-photo' || scenario === 'open-reopen' || scenario === 'reset-reopen') { openCropModal(1); await release(held.length - 1); }
                    if (scenario === 'reopen-same') { closeCropModal(); openCropModal(0); await release(held.length - 1); }
                    if (scenario === 'second-apply') { _cropRect = { x: 0, y: 0, w: 12, h: 8 }; applyCrop(); await release(2); }
                    if (scenario === 'reset-pending-apply' || scenario === 'open-reset') { resetCrop(); await release(held.length - 1); }
                    if (scenario === 'open-apply-before-load') { drawRegion(); applyCrop(); }
                    if (scenario === 'preview-reset') document.querySelector('.ocr-preview-reset[data-index="0"]').click();
                    if (scenario === 'move' || scenario === 'move-away-back') { moveSelectedImage(0, 'later'); if (scenario === 'move-away-back') moveSelectedImage(1, 'earlier'); }
                    if (scenario === 'drag-reorder') {
                        const list = document.getElementById('ocrPreviewList'), target = list.querySelector('[data-index="1"]');
                        const transfer = new DataTransfer(); transfer.setData('application/x-ocr-preview-index', '0');
                        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: target.getBoundingClientRect().right + 1, clientY: target.getBoundingClientRect().bottom + 1 }));
                    }
                    if (scenario === 'remove') removeSelectedImageAt(0);
                    if (scenario === 'clear') { removeSelectedImageAt(1); removeSelectedImageAt(0); }
                    if (scenario === 'replace-same-bytes') { selectedImages[0] = { ...alice }; syncSelectedImageState(); updateSelectedImagePreview(); }
                    if (scenario === 'changed-bytes') { alice.dataUrl = blue.src; syncSelectedImageState(); updateSelectedImagePreview(); }
                    // Closing the live crop UI invalidates pending image callbacks.
                    if (scenario === 'native-crop-close') closeCropModal();
                    if (['class-reset', 'roster-clear', 'student-delete', 'failed-class-reset-keeps-crop'].includes(scenario)) {
                        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'synthetic', originalText: 'Synthetic saved writing.' }] } }));
                        if (scenario === 'roster-clear') await clearAllStudents();
                        else if (scenario === 'student-delete') await removeStudent('Alice');
                        else if (scenario === 'class-reset') await resetCurrentClassData();
                        else {
                            const setItem = Storage.prototype.setItem;
                            Storage.prototype.setItem = function(key, value) {
                                if (key === 'wft_portfolio') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
                                return setItem.call(this, key, value);
                            };
                            try { await resetCurrentClassData(); } finally { Storage.prototype.setItem = setItem; }
                        }
                    }
                    if (scenario === 'reassessment') {
                        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'synthetic', originalText: 'Synthetic reassessment writing.', images: [{ dataUrl: blue.src, name: 'Restored photo' }] }] } }));
                        await reassessPortfolioSession('Alice', 'synthetic');
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                    if (scenario === 'unrelated-writing-settings') {
                        document.getElementById('studentWriting').value = 'New unrelated typed text.';
                        document.getElementById('studentWriting').dispatchEvent(new Event('input'));
                        document.getElementById('assessScriptQuality').click();
                    }
                    if (scenario === 'reverse-scaled-crop') {
                        canvas.width = 20; canvas.height = 15; _cropRect = { x: 12, y: 9, w: -8, h: -6 }; applyCrop(); pending = 2;
                    }
                    if (scenario === 'invalid-region') { closeCropModal(); openCropModal(0); await release(2); _cropRect = { x: 0, y: 0, w: 3, h: 3 }; applyCrop(); }
                    const before = snapshot();
                    let callbackError = null;
                    try { await release(pending); } catch (error) { callbackError = error.message; }
                    const after = snapshot();
                    let dimensions = null;
                    if (scenario === 'current-crop' || scenario === 'unrelated-writing-settings' || scenario === 'reverse-scaled-crop') {
                        const image = new nativeImage(); await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = alice.dataUrl; });
                        dimensions = [image.naturalWidth, image.naturalHeight];
                    }
                    let resetState = null;
                    if (scenario === 'current-preview-reset') {
                        // OCR synchronizes the cropped primary source before the user can reset it later.
                        syncSelectedImageState();
                        document.querySelector('.ocr-preview-reset[data-index="0"]').click();
                        resetState = { dataUrl: alice.dataUrl, originalDataUrl: alice.originalDataUrl, extractedText: alice.extractedText,
                            promiseCleared: alice.extractionPromise === null, primary: selectedImageDataUrl };
                    }
                    if (scenario === 'current-reset' || scenario === 'current-reset-apply') {
                        openCropModal(0); await release(held.length - 1);
                        alice.extractedText = 'New stale OCR'; alice.extractionPromise = Promise.resolve('New stale OCR');
                        resetCrop(); await release(held.length - 1);
                        resetState = { dataUrl: alice.dataUrl, originalDataUrl: alice.originalDataUrl, extractedText: alice.extractedText, promiseCleared: alice.extractionPromise === null };
                        if (scenario === 'current-reset-apply') { drawRegion(); applyCrop(); await release(held.length - 1); }
                    }
                    window.Image = nativeImage;
                    return { before, after, callbackError, dimensions, red: red.src, resetState, pendingLoads: held.length, final: snapshot() };
                }, scenario);
                assert.deepEqual(errors, [], 'No browser exceptions');
                assert.equal(result.callbackError, null, 'No stale callback exception');
                const current = ['current-crop', 'current-reset', 'current-reset-apply', 'current-preview-reset', 'unrelated-writing-settings', 'reverse-scaled-crop', 'failed-class-reset-keeps-crop'];
                if (scenario === 'open-apply-before-load') {
                    assert.equal(result.pendingLoads, 1, 'Apply waits for the current preview to load');
                    assert.deepEqual(result.after.photos, result.before.photos);
                    assert.equal(result.after.open, true);
                } else if (scenario === 'current-secondary-crop') {
                    assert.deepEqual(result.after.alice, result.before.alice);
                    assert.notEqual(result.after.photos[1].dataUrl, result.before.photos[1].dataUrl);
                    assert.equal(result.after.photos[1].originalDataUrl, result.before.photos[1].dataUrl);
                    assert.equal(result.after.open, false);
                } else if (current.includes(scenario)) {
                    assert.notEqual(result.after.alice.dataUrl, result.red);
                    assert.equal(result.after.alice.originalDataUrl, result.red);
                    assert.equal(result.after.open, false);
                    if (result.dimensions) assert.deepEqual(result.dimensions, scenario === 'reverse-scaled-crop' ? [16, 12] : [20, 10]);
                    if (result.resetState) {
                        assert.equal(result.resetState.dataUrl, result.red);
                        assert.equal(result.resetState.originalDataUrl, null);
                        assert.equal(result.resetState.extractedText, '');
                        assert.equal(result.resetState.promiseCleared, true);
                        if (scenario === 'current-preview-reset') assert.equal(result.resetState.primary, result.red);
                        if (scenario === 'current-reset-apply') assert.notEqual(result.final.alice.dataUrl, result.red);
                    }
                } else assert.deepEqual(result.after, result.before, 'Stale completion must not mutate photos, canvas, modal or status');
                cases.push({ name: scenario, passed: true }); console.log('PASS ' + scenario);
            } catch (error) {
                failures.push(scenario); cases.push({ name: scenario, passed: false, error: error.message.split('\n')[0] }); console.error('FAIL ' + scenario + ': ' + error.message.split('\n')[0]);
            } finally { await page.close(); }
        }
        if (process.env.WFT_TEST_EVIDENCE) fs.writeFileSync(process.env.WFT_TEST_EVIDENCE, JSON.stringify({ cases, scope: 'Synthetic native Edge images/canvas; app image callbacks controlled; all external services blocked' }, null, 2));
        assert.deepEqual(failures, [], 'Crop ownership regressions failed');
        console.log('Crop ownership browser tests passed: ' + cases.length + ' cases.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
