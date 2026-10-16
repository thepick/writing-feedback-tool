const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

const scenarios = ['cancel-switch', 'student-switch', 'student-away-back', 'portfolio-student-away-back',
    'reopen-photo', 'reopen-same', 'second-apply', 'reset-pending-apply', 'preview-reset',
    'move', 'move-away-back', 'drag-reorder', 'remove', 'clear', 'replace-same-bytes', 'changed-bytes',
    'native-crop-close', 'reassessment', 'class-reset', 'roster-clear', 'student-delete', 'failed-class-reset-keeps-crop',
    'open-cancel', 'open-reopen', 'open-switch', 'open-reset', 'open-apply-before-load',
    'reset-cancel', 'reset-reopen', 'reset-switch', 'current-crop', 'current-reset',
    'current-reset-apply', 'current-preview-reset', 'current-secondary-crop', 'unrelated-writing-settings', 'reverse-scaled-crop', 'invalid-region'];

function localCropRoute(route) {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) })
        : route.fulfill({ status: 404, body: '' });
}

async function evaluateCropScenario(scenario) {
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
    function changeStudentOwnership() {
        if (scenario === 'cancel-switch') { closeCropModal(); changeStudent('Bob'); selectedImages = [bob]; syncSelectedImageState(); updateSelectedImagePreview(); }
        if (scenario === 'student-switch' || scenario === 'open-switch' || scenario === 'reset-switch') changeStudent('Bob');
        if (scenario === 'student-away-back') { changeStudent('Bob'); changeStudent('Alice'); }
        if (scenario === 'portfolio-student-away-back') { openStudentPortfolio('Bob'); openStudentPortfolio('Alice'); }
        if (scenario.endsWith('-cancel')) closeCropModal();
    }
    function changePhotoQueue() {
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
    }
    function changeWritingAndRegion() {
        if (scenario === 'unrelated-writing-settings') {
            document.getElementById('studentWriting').value = 'New unrelated typed text.';
            document.getElementById('studentWriting').dispatchEvent(new Event('input'));
            document.getElementById('assessScriptQuality').click();
        }
        if (scenario === 'reverse-scaled-crop') {
            canvas.width = 20; canvas.height = 15; _cropRect = { x: 12, y: 9, w: -8, h: -6 }; applyCrop(); pending = 2;
        }
    }
    async function changeCropRequests() {
        if (scenario === 'reopen-photo' || scenario === 'open-reopen' || scenario === 'reset-reopen') { openCropModal(1); await release(held.length - 1); }
        if (scenario === 'reopen-same') { closeCropModal(); openCropModal(0); await release(held.length - 1); }
        if (scenario === 'second-apply') { _cropRect = { x: 0, y: 0, w: 12, h: 8 }; applyCrop(); await release(2); }
        if (scenario === 'reset-pending-apply' || scenario === 'open-reset') { resetCrop(); await release(held.length - 1); }
    }
    async function changeClassOwnership() {
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
    }
    async function finishCropReset() {
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
    }
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
    changeStudentOwnership();
    await changeCropRequests();
    changePhotoQueue();
    await changeClassOwnership();
    if (scenario === 'reassessment') {
        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'synthetic', originalText: 'Synthetic reassessment writing.', images: [{ dataUrl: blue.src, name: 'Restored photo' }] }] } }));
        await reassessPortfolioSession('Alice', 'synthetic');
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    changeWritingAndRegion();
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
    await finishCropReset();
    window.Image = nativeImage;
    return { before, after, callbackError, dimensions, red: red.src, resetState, pendingLoads: held.length, final: snapshot() };
}

function assertCropScenario(scenario, result, errors) {
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
}
const dropScenarios = [
    { name: 'drop-source-negative', from: '-1', target: 1, unchanged: true },
    { name: 'drop-source-past-end', from: '3', target: 0, unchanged: true },
    { name: 'drop-target-negative', from: '0', target: 1, targetValue: '-1', unchanged: true },
    { name: 'drop-target-past-end', from: '0', target: 1, targetValue: '3', unchanged: true },
    { name: 'drop-stale-after-remove', start: 2, target: 0, stale: true, unchanged: true },
    { name: 'drop-desktop-later-after', from: '0', target: 2, after: true, order: ['b', 'c', 'a'] },
    { name: 'drop-desktop-earlier-before', from: '2', start: 2, target: 0, order: ['c', 'a', 'b'] },
    { name: 'drop-mobile-later-before', from: '0', target: 2, mobile: true, order: ['b', 'a', 'c'] },
    { name: 'drop-mobile-earlier-after', from: '2', start: 2, target: 0, mobile: true, after: true, order: ['a', 'c', 'b'] },
    { name: 'drop-text-prefix', from: '2tail', start: 2, target: 0, text: true, order: ['c', 'a', 'b'] },
    { name: 'drop-fraction-target-prefix', from: '0.9', target: 2, targetValue: '2tail', after: true, order: ['b', 'c', 'a'] },
    { name: 'drop-drag-index-fallback', from: 'not-an-index', start: 2, target: 0, text: true, order: ['c', 'a', 'b'] },
    { name: 'drop-same-index', from: '1', start: 1, target: 1, unchanged: true }
];

function evaluateReorderDrop(spec) {
    stopWftSyncPolling(); scheduleWftCloudSync = () => {}; window.alert = () => {};
    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown();
    document.getElementById('studentSelect').value = 'Alice'; localStorage.setItem('wft_selectedStudent', 'Alice');
    document.getElementById('studentWriting').value = 'Current writing stays with Alice.  Exact spacing.\nSecond line.';
    const raster = color => { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 8, 8); return canvas.toDataURL(); };
    const colors = ['red', 'blue', 'green'];
    selectedImages = ['a', 'b', 'c'].map((id, i) => ({ name: id + '.png', studentName: 'Alice', imageId: id, imageRevision: 'revision-' + id,
        driveFileId: 'synthetic-' + id, dataUrl: raster(colors[i]), originalDataUrl: raster(colors[(i + 1) % 3]), mimeType: 'image/png',
        extractedText: 'OCR ' + id, extractionPromise: Promise.resolve('OCR ' + id) }));
    syncSelectedImageState(); updateSelectedImagePreview();
    activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'keep-source' };
    pendingPortfolioSync = { studentName: 'Alice', signature: 'keep-pending', sessionData: { id: 'keep-pending', originalText: 'Earlier pending writing.', images: getSessionImagePayloads() } };
    persistPendingPortfolioSync();
    const list = document.getElementById('ocrPreviewList'), transfer = new DataTransfer();
    const start = spec.start || 0;
    list.querySelector('.ocr-preview-card[data-index="' + start + '"]').dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    if (spec.stale) list.querySelector('.ocr-preview-remove[data-index="0"]').click();
    else if (spec.from !== undefined) {
        if (spec.text) transfer.clearData('application/x-ocr-preview-index');
        transfer.setData(spec.text ? 'text/plain' : 'application/x-ocr-preview-index', spec.from);
    }
    const target = list.querySelector('.ocr-preview-card[data-index="' + spec.target + '"]');
    if (spec.targetValue !== undefined) target.setAttribute('data-index', spec.targetValue);
    const queue = selectedImages.slice(), promises = selectedImages.map(image => image.extractionPromise), pending = pendingPortfolioSync;
    const snapshot = () => ({ photos: selectedImages.map(image => image ? { ...image, extractionPromise: !!image.extractionPromise } : null),
        writing: document.getElementById('studentWriting').value, owner: selectedStudent, selection: document.getElementById('studentSelect').value,
        primary: { dataUrl: selectedImageDataUrl, name: selectedImageName, text: selectedImageExtractedText, promise: !!selectedImageExtractionPromise },
        source: activePortfolioReassessmentSource, pending: JSON.parse(JSON.stringify(pendingPortfolioSync)),
        stored: Object.fromEntries(['wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY, 'wft_portfolio', 'wft_settings', WFT_DELETIONS_STORAGE_KEY].map(key => [key, localStorage.getItem(key)])) });
    const before = snapshot(), rect = target.getBoundingClientRect();
    const clientX = spec.mobile ? (spec.after ? rect.left + 1 : rect.right - 1) : rect.left + rect.width * (spec.after ? .75 : .25);
    const clientY = spec.mobile ? rect.top + rect.height * (spec.after ? .75 : .25) : (spec.after ? rect.top + 1 : rect.bottom - 1);
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX, clientY }));
    const after = snapshot();
    return { before, after, sameQueueReferences: selectedImages.length === queue.length && selectedImages.every((image, i) => image === queue[i]),
        samePromiseReferences: selectedImages.length === promises.length && selectedImages.every((image, i) => image && image.extractionPromise === promises[i]),
        samePendingReference: pendingPortfolioSync === pending, dragIndex: previewDragIndex,
        dragging: list.classList.contains('is-dragging'), dragClasses: list.querySelectorAll('.dragging,.drag-over,.drag-over-left,.drag-over-right,.drag-over-top,.drag-over-bottom').length,
        transferSource: transfer.getData('application/x-ocr-preview-index') || transfer.getData('text/plain'), queueLengthAtDrop: queue.length,
        definedQueue: selectedImages.every(Boolean) };
}

function assertReorderDrop(spec, result, errors) {
    assert.deepEqual(errors, [], 'Drop must not throw');
    assert.equal(result.definedQueue, true, 'No undefined photo may enter the queue');
    assert.equal(result.dragIndex, -1); assert.equal(result.dragging, false); assert.equal(result.dragClasses, 0, 'Terminal drag cleanup');
    assert.equal(result.samePendingReference, true);
    if (spec.unchanged) {
        assert.deepEqual(result.after, result.before, 'Rejected/stale/no-op drop keeps all photo/OCR/owner/writing/pending bytes');
        assert.equal(result.sameQueueReferences, true); assert.equal(result.samePromiseReferences, true);
    } else {
        const ordered = spec.order.map(id => ({ ...result.before.photos.find(image => image.imageId === id), extractedText: '', extractionPromise: false }));
        assert.deepEqual(result.after.photos, ordered, 'Valid drop preserves photo bytes/revisions and clears only OCR caches');
        for (const key of ['writing', 'owner', 'selection', 'source', 'pending', 'stored']) assert.deepEqual(result.after[key], result.before[key], key);
        assert.deepEqual(result.after.primary, { dataUrl: ordered[0].dataUrl, name: ordered[0].name, text: '', promise: false });
    }
}


(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [], failures = [];
    try {
        for (const scenario of scenarios) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', localCropRoute);
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof applyCrop === 'function');
            try {
                const result = await page.evaluate(evaluateCropScenario, scenario);
                assertCropScenario(scenario, result, errors);
                cases.push({ name: scenario, passed: true }); console.log('PASS ' + scenario);
            } catch (error) {
                failures.push(scenario); cases.push({ name: scenario, passed: false, error: error.message.split('\n')[0] }); console.error('FAIL ' + scenario + ': ' + error.message.split('\n')[0]);
            } finally { await page.close(); }
        }
        for (const spec of dropScenarios) {
            const page = await browser.newPage({ viewport: spec.mobile ? { width: 390, height: 844 } : { width: 1100, height: 900 } });
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', localCropRoute);
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            let observed;
            try {
                const result = await page.evaluate(evaluateReorderDrop, spec);
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
                observed = { beforeOrder: result.before.photos.map(image => image.imageId), afterOrder: result.after.photos.map(image => image && image.imageId),
                    exactStateKept: JSON.stringify(result.before) === JSON.stringify(result.after), definedQueue: result.definedQueue,
                    sameQueueReferences: result.sameQueueReferences, samePromiseReferences: result.samePromiseReferences,
                    pendingKept: result.samePendingReference, dragIndex: result.dragIndex, dragging: result.dragging, dragClasses: result.dragClasses,
                    queueLengthAtDrop: result.queueLengthAtDrop, transferSource: result.transferSource, errors };
                assertReorderDrop(spec, result, errors);
                cases.push({ name: spec.name, passed: true, observed }); console.log('PASS ' + spec.name);
            } catch (error) {
                failures.push(spec.name); cases.push({ name: spec.name, passed: false, error: error.message.split('\n')[0], observed }); console.error('FAIL ' + spec.name + ': ' + error.message.split('\n')[0]);
            } finally { await page.close(); }
        }
        if (process.env.WFT_TEST_EVIDENCE) fs.writeFileSync(process.env.WFT_TEST_EVIDENCE, JSON.stringify({ cases, scope: 'Synthetic native Edge images/canvas; app image callbacks controlled; all external services blocked' }, null, 2));
        assert.deepEqual(failures, [], 'Crop ownership regressions failed');
        console.log('Crop ownership browser tests passed: ' + cases.length + ' cases.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
