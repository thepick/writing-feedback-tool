const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const scenarios = ['sync-add', 'sync-edit', 'sync-delete-session', 'sync-delete-student', 'sync-rename',
    'sync-new-photo', 'sync-photo-add', 'sync-new-reference', 'sync-photo-delete', 'sync-photo-reorder', 'sync-upload-failure',
    'sync-write-failure', 'sync-corrupt', 'sync-recovery', 'sync-retry', 'sync-happy-multiple',
    'sync-entry-corrupt', 'sync-entry-recovery', 'sync-upload-throws', 'sync-invalid-bytes',
    'pending-happy', 'pending-student-switch', 'pending-delete-owner', 'pending-class-reset', 'pending-replacement', 'pending-analysis-bob', 'pending-analysis-alice',
    'pending-clear', 'pending-photo-change', 'pending-session-change', 'pending-upload-failure',
    'pending-persist-failure', 'pending-clear-failure', 'pending-clear-retry', 'pending-rollback-failure', 'pending-corrupt', 'pending-recovery',
    'pending-access-change', 'pending-retry', 'pending-new-during-flush', 'pending-signout-during-flush',
    'photo-crop', 'photo-recrop', 'photo-modal-reset', 'photo-preview-reset', 'photo-merge',
    'photo-quota-metadata', 'photo-restoration', 'photo-download-restoration', 'photo-legacy-merge', 'photo-compressed', 'photo-unchanged'];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    try {
        for (const scenario of scenarios) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
                const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            let observed;
            try {
                const result = await page.evaluate(async scenario => {
                    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                    window.alert = () => {}; window.confirm = () => true;
                    wftConfirm = async () => true;
                    localStorage.setItem('wft_settings', '{}'); localStorage.setItem('wft_portfolio', '{}');
                    driveAccessToken = 'synthetic'; WFT_IMAGE_COMPRESSION_V1 = false;
                    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown();
                    document.getElementById('studentSelect').value = 'Alice';
                    const raster = (color, width = 40, height = 30) => {
                        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
                        return canvas.toDataURL('image/png');
                    };
                    const red = raster('red'), blue = raster('blue');
                    const photo = () => ({ name: 'synthetic.png', imageId: 'photo-one', dataUrl: red, mimeType: 'image/png' });
                    const session = () => ({ id: 'first', createdAt: '2026-10-10T00:00:00Z', originalText: 'Synthetic writing.', images: [photo()] });
                    const pending = () => ({ studentName: 'Alice', signature: 'alice-old', sessionData: session() });
                    const uploads = [], releases = [], uploadedBlobs = [];
                    uploadBlobToDrive = async (name, blob, type, callback) => {
                        if (!blob) { callback(null); return; }
                        uploadedBlobs.push(blob);
                        uploads.push({ name, type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
                        if (scenario === 'sync-entry-recovery') callback({ id: 'recovery-upload' });
                        else releases.push(callback);
                    };
                    let flushes = 0;
                    flushWftCloudSyncNow = async () => { flushes++; return true; };
                    const wait = async predicate => {
                        for (let i = 0; i < 500; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
                        throw new Error('Synthetic callback boundary timeout');
                    };
                    const state = () => ({ portfolio: getPortfolioData(), pending: getPendingPortfolioSync(),
                        raw: localStorage.getItem('wft_portfolio'), storedPending: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY),
                        uploads, flushes, status: document.getElementById('driveSyncTextHeader').textContent,
                        synced: document.getElementById('driveSyncDotHeader').classList.contains('synced'), recovery: !!wftStudentChangeRecovery });
                    if (scenario.startsWith('sync-')) {
                        const first = session();
                        if (scenario === 'sync-photo-reorder' || scenario === 'sync-happy-multiple') first.images.push({ ...photo(), imageId: 'photo-two', name: 'second.png', dataUrl: blue });
                        localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [first] } }));
                        if (scenario === 'sync-entry-corrupt') localStorage.setItem('wft_portfolio', '{broken');
                        if (scenario === 'sync-entry-recovery') wftStudentChangeRecovery = { wft_portfolio: localStorage.getItem('wft_portfolio') };
                        if (scenario === 'sync-upload-throws') uploadBlobToDrive = () => { throw new Error('Upload service threw'); };
                        if (scenario === 'sync-invalid-bytes') { first.images[0].dataUrl = 'invalid raster bytes'; localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [first] } })); }
                        let finished = false, error = '';
                        syncPendingPortfolioMedia(failure => { finished = true; error = failure ? failure.message : ''; });
                        if (['sync-entry-corrupt', 'sync-entry-recovery', 'sync-upload-throws', 'sync-invalid-bytes'].includes(scenario)) { await wait(() => finished); return { ...state(), error }; }
                        await wait(() => releases.length === 1);
                        if (scenario === 'sync-add') saveStudentSession('Alice', { id: 'second', originalText: 'Later essay.', images: [] });
                        let current = getLocalPortfolioSnapshot();
                        if (scenario === 'sync-edit') current.Alice.sessions[0].originalText = 'Edited while uploading.';
                        if (scenario === 'sync-delete-session') current.Alice.sessions = [];
                        if (scenario === 'sync-delete-student') delete current.Alice;
                        if (scenario === 'sync-rename') { current.Alicia = current.Alice; delete current.Alice; }
                        if (scenario === 'sync-new-photo') current.Alice.sessions[0].images[0].dataUrl = blue;
                        if (scenario === 'sync-photo-add') current.Alice.sessions[0].images.push({ ...photo(), imageId: 'new-photo', dataUrl: blue });
                        if (scenario === 'sync-new-reference') { current.Alice.sessions[0].images[0].driveFileId = 'newer-file'; current.Alice.sessions[0].images[0].dataUrl = ''; }
                        if (scenario === 'sync-photo-delete') current.Alice.sessions[0].images = [];
                        if (scenario === 'sync-photo-reorder') current.Alice.sessions[0].images.reverse();
                        if (!['sync-add', 'sync-corrupt', 'sync-recovery', 'sync-write-failure'].includes(scenario)) savePortfolioLocalOnly(current);
                        const setItem = Storage.prototype.setItem;
                        if (scenario === 'sync-write-failure') Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio') throw new Error('Required portfolio write failed'); return setItem.call(this, key, value); };
                        if (scenario === 'sync-corrupt') localStorage.setItem('wft_portfolio', '{broken');
                        if (scenario === 'sync-recovery') wftStudentChangeRecovery = { originalBytes: { wft_portfolio: localStorage.getItem('wft_portfolio') }, reason: 'synthetic recovery' };
                        releases[0](scenario === 'sync-upload-failure' || scenario === 'sync-retry' ? null : { id: 'uploaded-file' });
                        if (scenario === 'sync-happy-multiple' || scenario === 'sync-photo-reorder') {
                            await wait(() => releases.length === 2 || finished);
                            if (releases[1]) releases[1]({ id: 'uploaded-second' });
                        }
                        await wait(() => finished); Storage.prototype.setItem = setItem;
                        const firstError = error;
                        if (scenario === 'sync-retry') {
                            if (!firstError) throw new Error('Failed photo upload reported success instead of retaining retryable media');
                            finished = false; syncPendingPortfolioMedia(failure => { finished = true; error = failure ? failure.message : ''; });
                            await wait(() => releases.length === 2); releases[1]({ id: 'retry-file' }); await wait(() => finished);
                        }
                        return { ...state(), error, firstError };
                    }
                    if (scenario.startsWith('pending-')) {
                        pendingPortfolioSync = pending(); persistPendingPortfolioSync();
                        const owner = pendingPortfolioSync;
                        let releaseFlush;
                        if (scenario === 'pending-new-during-flush' || scenario === 'pending-signout-during-flush') flushWftCloudSyncNow = () => { flushes++; if (flushes > 1) return Promise.resolve(true); return new Promise(resolve => { releaseFlush = resolve; }); };
                        manualSaveToDrive(); await wait(() => releases.length === 1);
                        if (scenario === 'pending-student-switch') { const select = document.getElementById('studentSelect'); select.value = 'Bob'; select.dispatchEvent(new Event('change')); }
                        if (scenario === 'pending-delete-owner') await removeStudent('Alice');
                        if (scenario === 'pending-class-reset') await resetCurrentClassData();
                        if (scenario === 'pending-replacement') { pendingPortfolioSync = { ...pending(), studentName: 'Bob', signature: 'bob-new', sessionData: { ...session(), id: 'second' } }; persistPendingPortfolioSync(); }
                        if (scenario.startsWith('pending-analysis-')) {
                            const name = scenario.endsWith('bob') ? 'Bob' : 'Alice';
                            const select = document.getElementById('studentSelect'); select.value = name; select.dispatchEvent(new Event('change'));
                            selectedImages = [{ ...photo(), name: name + '.png', dataUrl: blue }]; syncSelectedImageState();
                            document.getElementById('studentWriting').value = name + ' writes about a blue bird in the park.';
                            const keys = ['Ideas & Details', 'Grammar', 'Word Choice', 'Organization', 'Flow', 'Spelling & Punctuation'];
                            let calls = 0;
                            callOpenRouter = async () => [ '# Corrected Story\nA blue bird sings in the park.',
                                '**Quick Rubric:**\n' + keys.map(key => '- ' + key + ': 8/10 - Add a detail.').join('\n'),
                                keys.map((key, i) => '**' + (i + 1) + '. ' + key + ':** 8/10\n- Evidence: Clear writing.\n- Growth Tip: Add a detail.').join('\n') ][calls++];
                            document.getElementById('assessScriptQuality').checked = false;
                            await analyzeWriting();
                            if (getPendingPortfolioSync() === owner) throw new Error('Actual analysis did not replace pending');
                        }
                        if (scenario === 'pending-clear') clearPendingPortfolioSync();
                        if (scenario === 'pending-photo-change') owner.sessionData.images[0].dataUrl = blue;
                        if (scenario === 'pending-session-change') owner.sessionData.originalText = 'Changed current session';
                        if (scenario === 'pending-corrupt') localStorage.setItem('wft_portfolio', '{broken');
                        if (scenario === 'pending-recovery') wftStudentChangeRecovery = { originalBytes: { wft_portfolio: '{}' }, reason: 'synthetic recovery' };
                        if (scenario === 'pending-access-change') { handleGoogleSignOut(); await wait(() => !driveAccessToken); }
                        const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem;
                        if (scenario === 'pending-persist-failure') Storage.prototype.setItem = function(key, value) { if (key === PENDING_PORTFOLIO_SYNC_KEY) throw new Error('Required pending write failed'); return setItem.call(this, key, value); };
                        if (['pending-clear-failure', 'pending-clear-retry', 'pending-rollback-failure'].includes(scenario)) Storage.prototype.removeItem = function(key) { if (key === PENDING_PORTFOLIO_SYNC_KEY) throw new Error('Required pending clear failed'); return removeItem.call(this, key); };
                        if (scenario === 'pending-rollback-failure') Storage.prototype.setItem = function(key, value) { if (key === 'wft_portfolio' && value === '{}') throw new Error('Rollback write failed'); return setItem.call(this, key, value); };
                        releases[0](scenario === 'pending-upload-failure' || scenario === 'pending-retry' ? null : { id: 'uploaded-file' });
                        if (scenario === 'pending-new-during-flush') {
                            await wait(() => releaseFlush);
                            pendingPortfolioSync = { ...pending(), studentName: 'Bob', signature: 'bob-new' }; persistPendingPortfolioSync(); releaseFlush(true);
                        }
                        if (scenario === 'pending-signout-during-flush') { await wait(() => releaseFlush); handleGoogleSignOut(); await wait(() => !driveAccessToken); releaseFlush(true); }
                        await wait(() => !manualSyncInProgress);
                        Storage.prototype.setItem = setItem; Storage.prototype.removeItem = removeItem;
                        const beforeRetry = state();
                        if (scenario === 'pending-retry') { if (!beforeRetry.pending) throw new Error('Failed photo upload consumed pending writing'); manualSaveToDrive(); await wait(() => releases.length === 2); releases[1]({ id: 'retry-file' }); await wait(() => !manualSyncInProgress); }
                        if (scenario === 'pending-clear-retry') { manualSaveToDrive(); await wait(() => !manualSyncInProgress); }
                        return { ...state(), beforeRetry, ownerChanged: getPendingPortfolioSync() !== owner };
                    }
                    const original = { ...photo(), driveFileId: 'old-original-file', driveName: 'old.png', driveUploadedAt: '2026-10-10T00:00:00Z' };
                    if (scenario === 'photo-legacy-merge') delete original.imageId;
                    const oldSavedPhoto = JSON.parse(JSON.stringify(original));
                    if (scenario === 'photo-download-restoration') {
                        original.dataUrl = '';
                        downloadDriveFileAsBlobPromise = async id => { if (id !== 'old-original-file') throw new Error('Wrong restored photo reference'); return dataUrlToBlob(red); };
                    }
                    selectedImages = [original]; syncSelectedImageState(); updateSelectedImagePreview();
                    if (scenario === 'photo-restoration' || scenario === 'photo-download-restoration') {
                        await restorePortfolioSessionImagesForReassessment({ images: [original] });
                    }
                    const currentPhoto = selectedImages[0];
                    let crops = 0;
                    const crop = async () => { openCropModal(0); await wait(() => _cropSession && _cropSession.ready); _cropRect = { x: crops++, y: 0, w: crops === 1 ? 10 : 8, h: 10 }; const previous = currentPhoto.dataUrl; applyCrop(); await wait(() => !_cropSession); if (currentPhoto.dataUrl === previous) throw new Error('Crop did not change pixels'); };
                    if (scenario !== 'photo-unchanged') await crop();
                    if (scenario === 'photo-recrop') await crop();
                    if (scenario === 'photo-modal-reset') { openCropModal(0); await wait(() => _cropSession && _cropSession.ready); resetCrop(); }
                    if (scenario === 'photo-preview-reset') document.querySelector('.ocr-preview-reset').click();
                    const changed = { ...session(), images: getSessionImagePayloads(), updatedAt: '2026-10-12T00:00:00Z' };
                    if (scenario === 'photo-merge' || scenario === 'photo-legacy-merge') changed.images = mergeSessionImageRefs(changed, { ...session(), images: [oldSavedPhoto] }).images;
                    const beforeUpload = JSON.parse(JSON.stringify(changed.images[0]));
                    const expectedData = currentPhoto.dataUrl;
                    let completed = false, uploadError = '';
                    if (scenario === 'photo-compressed') WFT_IMAGE_COMPRESSION_V1 = true;
                    uploadSessionImagesToDrive('Alice', changed, error => { completed = true; uploadError = error ? error.message : ''; }, true);
                    await wait(() => completed || releases.length);
                    if (releases.length) releases[0]({ id: 'new-cropped-file' }); await wait(() => completed);
                    saveStudentSession('Alice', changed);
                    const saved = getPortfolioData().Alice.sessions[0];
                    const fallback = stripPortfolioHeavyFields({ Alice: { sessions: [changed] } }).Alice.sessions[0].images[0];
                    await restorePortfolioSessionImagesForReassessment({ images: [beforeUpload] });
                    const restored = selectedImages[0];
                    downloadDriveFileAsBlobPromise = async id => { if (id !== saved.images[0].driveFileId) throw new Error('Wrong saved photo reference'); return uploadedBlobs[0] || dataUrlToBlob(expectedData); };
                    await restorePortfolioSessionImagesForReassessment(saved);
                    const exported = [];
                    const folder = { folder: () => folder, file: (name, value) => { exported.push({ name, value }); } };
                    await addAvailableImagesToStudentFolder(folder, 'Alice', { sessions: [saved] }, { includeImages: true });
                    const exportedPhoto = exported.find(file => file.value instanceof Blob);
                    const dimensions = async dataUrl => { const image = new Image(); image.src = dataUrl; await image.decode(); return [image.naturalWidth, image.naturalHeight]; };
                    return { ...state(), beforeUpload, saved, fallback, uploadError, expectedData,
                        restored, reloaded: selectedImages[0], reloadedDimensions: await dimensions(selectedImages[0].dataUrl), expectedDimensions: await dimensions(expectedData),
                        exportedBytes: Array.from(new Uint8Array(await exportedPhoto.value.arrayBuffer())),
                        expectedBytes: Array.from(Uint8Array.from(atob(expectedData.split(',')[1]), char => char.charCodeAt(0))) };
                }, scenario);
                observed = { students: Object.fromEntries(Object.entries(result.portfolio).map(([name, data]) => [name, data.sessions.map(session => ({ id: session.id, text: session.originalText,
                    photos: session.images.map(image => ({ imageId: image.imageId, imageRevision: image.imageRevision, driveFileId: image.driveFileId, bytesRetained: !!image.dataUrl })) }))])),
                    pendingStudent: result.pending?.studentName || null, pendingId: result.pending?.sessionData.id || null,
                    pendingPhotoBytesRetained: !!result.pending?.sessionData.images[0]?.dataUrl,
                    synced: result.synced, flushes: result.flushes, uploadCount: result.uploads.length,
                    uploadNames: result.uploads.map(upload => upload.name), error: result.error || result.uploadError || null };
                assert.deepEqual(errors, [], 'No uncaught app errors');
                if (scenario.startsWith('sync-')) {
                    const entry = result.portfolio.Alice?.sessions.find(item => item.id === 'first');
                    if (scenario === 'sync-add') assert.deepEqual(result.portfolio.Alice.sessions.map(item => item.id).sort(), ['first', 'second']);
                    if (scenario === 'sync-edit') assert.equal(entry.originalText, 'Edited while uploading.');
                    if (scenario === 'sync-delete-session') assert.equal(result.portfolio.Alice.sessions.length, 0);
                    if (scenario === 'sync-delete-student') assert.deepEqual(result.portfolio, {});
                    if (scenario === 'sync-rename') { assert.equal(result.portfolio.Alice, undefined); assert.equal(result.portfolio.Alicia.sessions.length, 1); assert.equal(result.portfolio.Alicia.sessions[0].images[0].driveFileId, undefined); }
                    if (scenario === 'sync-new-photo') { assert.ok(entry.images[0].dataUrl); assert.equal(entry.images[0].driveFileId, undefined); }
                    if (scenario === 'sync-photo-add') { assert.equal(entry.images.length, 2); assert.ok(entry.images[1].dataUrl); assert.equal(entry.images[0].driveFileId, 'uploaded-file'); }
                    if (scenario === 'sync-new-reference') assert.equal(entry.images[0].driveFileId, 'newer-file');
                    if (scenario === 'sync-photo-delete') assert.equal(entry.images.length, 0);
                    if (scenario === 'sync-photo-reorder') assert.deepEqual(entry.images.map(image => image.imageId), ['photo-two', 'photo-one']);
                    if (['sync-upload-failure', 'sync-write-failure', 'sync-corrupt', 'sync-recovery', 'sync-entry-corrupt', 'sync-entry-recovery', 'sync-upload-throws', 'sync-invalid-bytes'].includes(scenario)) assert.ok(result.error, 'Required failures must propagate');
                    else assert.equal(result.error, '');
                    if (scenario === 'sync-corrupt') assert.equal(result.raw, '{broken');
                    if (scenario === 'sync-entry-corrupt' || scenario === 'sync-entry-recovery') assert.equal(result.uploads.length, 0, 'Damaged storage and recovery mode must block uploads before they start');
                    if (scenario === 'sync-write-failure' || scenario === 'sync-upload-failure') assert.ok(entry.images[0].dataUrl, 'Failed completion keeps upload bytes');
                    if (scenario === 'sync-retry') { assert.ok(result.firstError); assert.equal(entry.images[0].driveFileId, 'retry-file'); }
                    if (scenario === 'sync-happy-multiple') assert.deepEqual(entry.images.map(image => image.driveFileId), ['uploaded-file', 'uploaded-second']);
                    if (scenario === 'sync-add' || scenario === 'sync-edit') assert.equal(entry.images[0].driveFileId, 'uploaded-file');
                } else if (scenario.startsWith('pending-')) {
                    if (scenario === 'pending-signout-during-flush') {
                        assert.equal(result.pending, null); assert.equal(result.synced, false); assert.equal(result.portfolio.Alice.sessions.length, 1);
                        assert.equal(result.flushes, 2); assert.match(result.status, /Signed out/);
                    } else if (scenario === 'pending-happy' || scenario === 'pending-student-switch' || scenario === 'pending-retry' || scenario === 'pending-clear-retry') {
                        assert.equal(result.pending, null); assert.equal(result.synced, true); assert.equal(result.flushes, 1);
                        assert.equal(result.portfolio.Alice.sessions[0].images[0].driveFileId, scenario === 'pending-retry' ? 'retry-file' : 'uploaded-file');
                        assert.equal(result.portfolio.Alice.sessions.length, 1);
                    } else {
                        assert.equal(result.synced, false, 'Old completion must not report current writing synced');
                        if (scenario !== 'pending-clear') assert.ok(result.pending, 'Current work must remain retryable');
                        if (scenario !== 'pending-new-during-flush') assert.deepEqual(result.portfolio, {});
                        if (scenario === 'pending-replacement' || scenario === 'pending-analysis-bob' || scenario === 'pending-new-during-flush') assert.equal(result.pending.studentName, 'Bob');
                        if (scenario === 'pending-analysis-alice') assert.equal(result.pending.studentName, 'Alice');
                        if (scenario === 'pending-analysis-alice' || scenario === 'pending-analysis-bob') assert.match(result.pending.sessionData.originalText, /blue bird/);
                        if (scenario !== 'pending-new-during-flush') assert.equal(result.flushes, ['pending-class-reset', 'pending-access-change'].includes(scenario) ? 1 : 0);
                        if (scenario === 'pending-upload-failure') assert.ok(result.pending.sessionData.images[0].dataUrl);
                        if (scenario === 'pending-corrupt') assert.equal(result.raw, '{broken');
                    }
                    if (scenario === 'pending-retry') { assert.ok(result.beforeRetry.pending); assert.equal(result.beforeRetry.synced, false); }
                    if (scenario === 'pending-rollback-failure') assert.equal(result.recovery, true, 'A failed rollback must retain the original portfolio for recovery and block sync');
                } else {
                    assert.equal(result.uploadError, '');
                    if (scenario === 'photo-unchanged') { assert.equal(result.uploads.length, 0); assert.equal(result.saved.images[0].driveFileId, 'old-original-file'); }
                    else {
                        assert.equal(result.beforeUpload.driveFileId, ''); assert.equal(result.beforeUpload.pendingDriveUpload, true);
                        assert.equal(result.uploads.length, 1);
                        assert.deepEqual(result.exportedBytes, result.uploads[0].bytes);
                        if (scenario !== 'photo-compressed') assert.deepEqual(result.uploads[0].bytes, result.expectedBytes);
                        else { assert.equal(result.uploads[0].type, 'image/jpeg'); assert.ok(result.uploads[0].bytes.length > 0); }
                        assert.equal(result.saved.images[0].driveFileId, 'new-cropped-file');
                        assert.equal(result.saved.images[0].imageId, scenario === 'photo-legacy-merge' ? 'old-original-file' : 'photo-one'); assert.ok(result.saved.images[0].imageRevision);
                        assert.equal(result.fallback.imageId, result.saved.images[0].imageId); assert.equal(result.fallback.imageRevision, result.saved.images[0].imageRevision);
                        assert.equal(result.restored.imageId, result.saved.images[0].imageId); assert.equal(result.restored.imageRevision, result.saved.images[0].imageRevision);
                        if (scenario !== 'photo-compressed') assert.equal(result.reloaded.dataUrl, result.expectedData);
                        assert.deepEqual(result.reloadedDimensions, result.expectedDimensions);
                        if (scenario === 'photo-merge' || scenario === 'photo-legacy-merge') assert.equal(result.saved.images.length, 1);
                    }
                }
                cases.push({ name: scenario, passed: true, observed });
            } catch (error) { cases.push({ name: scenario, passed: false, error: error.message, observed }); }
            console.log((cases[cases.length - 1].passed ? 'PASS ' : 'FAIL ') + scenario + (cases[cases.length - 1].error ? ': ' + cases[cases.length - 1].error : ''));
            await page.close();
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases }, null, 2) + '\n');
    console.log(JSON.stringify(cases, null, 2));
    assert.equal(cases.filter(test => !test.passed).length, 0, 'Every media ownership case must pass');
})().catch(error => { console.error(error); process.exitCode = 1; });
