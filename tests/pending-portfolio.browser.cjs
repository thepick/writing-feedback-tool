const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
const cases = [];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root, 'application/octet-stream'));
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof persistPendingPortfolioSync === 'function');
        for (const failBoth of [false, true]) {
            const prepared = await page.evaluate(failBoth => {
                scheduleWftCloudSync = () => {};
                stopWftSyncPolling();
                driveAccessToken = 'test-token';
                WFT_IMAGE_COMPRESSION_V1 = false;
                window.photoUploads = [];
                window.photoCloud = [];
                uploadBlobToDrive = async (name, blob, mimeType, callback) => {
                    photoUploads.push({ name, mimeType, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
                    callback({ id: 'drive-photo', name });
                };
                flushWftCloudSyncNow = async () => { photoCloud.push(getPortfolioData()); return true; };
                const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
                pendingPortfolioSync = { studentName: 'Alice', signature: 'photo-assessment', sessionData: {
                    id: failBoth ? 'failed-storage' : 'quota-recovered', originalText: 'Writing with a photo', categoryScores: { Grammar: 8 }, images: [
                        { id: 'photo', name: 'test.png', dataUrl, originalDataUrl: dataUrl, extractedText: 'Writing with a photo', pendingDriveUpload: true },
                        { id: 'already-uploaded', driveFileId: 'existing-drive-photo', dataUrl: '', mimeType: 'image/png' }
                    ]
                } };
                const original = pendingPortfolioSync;
                const setItem = Storage.prototype.setItem;
                let writes = 0, error = '', durable;
                Storage.prototype.setItem = function(key, value) {
                    if (key === PENDING_PORTFOLIO_SYNC_KEY && (++writes === 1 || failBoth)) throw new DOMException('Storage full', 'QuotaExceededError');
                    return setItem.call(this, key, value);
                };
                try { durable = persistPendingPortfolioSync(); } catch (failure) { error = failure.name; }
                finally { Storage.prototype.setItem = setItem; }
                updateSyncPortfolioButtonState();
                return { writes, error, durable, warning: document.getElementById('syncPortfolioBtnBottomPersistenceNotice').textContent, sameObject: getPendingPortfolioSync() === original,
                    dataKept: getPendingPortfolioSync().sessionData.images[0].dataUrl === dataUrl,
                    uploadable: pendingPortfolioSessionHasUploadableImages(getPendingPortfolioSync()),
                    persisted: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY),
                    expectedBytes: Array.from(Uint8Array.from(atob(dataUrl.split(',')[1]), char => char.charCodeAt(0))) };
            }, failBoth);
            assert.equal(prepared.sameObject, true);
            assert.equal(prepared.dataKept, true);
            assert.equal(prepared.uploadable, true);
            assert.equal(prepared.writes, 2);
            assert.equal(prepared.error, failBoth ? 'QuotaExceededError' : '');
            assert.equal(prepared.durable, failBoth ? undefined : false);
            assert.match(prepared.warning, /only in this tab/);
            if (!failBoth) {
                const storedImage = JSON.parse(prepared.persisted).sessionData.images[0];
                assert.equal(storedImage.dataUrl, '');
                assert.equal(storedImage.originalDataUrl, undefined);
                assert.equal(storedImage.extractedText, undefined);
            }
            await page.locator('#syncPortfolioBtnBottom').evaluate(button => button.click());
            await page.waitForFunction(() => !getPendingPortfolioSync() && !manualSyncInProgress);
            const result = await page.evaluate(id => ({ uploads: photoUploads, cloud: photoCloud,
                saved: getPortfolioData().Alice.sessions.find(session => session.id === id),
                persistedPending: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) }), failBoth ? 'failed-storage' : 'quota-recovered');
            assert.equal(result.uploads.length, 1, 'The retained photo must reach the real pre-commit upload routine');
            assert.equal(result.uploads[0].mimeType, 'image/png');
            assert.deepEqual(result.uploads[0].bytes, prepared.expectedBytes);
            assert.deepEqual(result.saved.images.map(image => image.driveFileId), ['drive-photo', 'existing-drive-photo']);
            assert.equal(result.saved.originalText, 'Writing with a photo');
            assert.equal(result.saved.categoryScores.Grammar, 8);
            assert.equal(result.cloud.length, 1);
            assert.ok(result.cloud[0].Alice.sessions.some(session => session.id === result.saved.id && session.images[0].driveFileId === 'drive-photo'));
            assert.equal(result.persistedPending, null);
            cases.push({ name: failBoth ? 'failed storage retains photos for actual sync retry' : 'quota fallback retains photos for actual sync retry', passed: true });
        }
        for (const mode of ['full', 'quota', 'retry', 'fail-both', 'drive-backed']) {
            const prepared = await page.evaluate(mode => {
                stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                localStorage.clear(); wftStudentChangeRecovery = null;
                localStorage.setItem('wft_portfolio', '{"Alice":{"sessions":[]}}');
                const previous = JSON.stringify({ studentName: 'Alice', sessionData: { id: 'previous', originalText: 'Previous draft', images: [] } });
                if (mode === 'fail-both') localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, previous);
                const dataUrl = 'data:image/png;base64,AAAA';
                pendingPortfolioSync = { studentName: 'Alice', signature: mode, sessionData: {
                    id: mode, createdAt: '2026-10-15T00:00:00Z', originalText: 'Reload protected writing', overall: 0,
                    images: [{ dataUrl, originalDataUrl: dataUrl, pendingDriveUpload: mode !== 'drive-backed', ...(mode === 'drive-backed' ? { driveFileId: 'durable-photo' } : {}) }]
                } };
                const original = pendingPortfolioSync, set = Storage.prototype.setItem;
                let writes = 0, outcome, error = '';
                Storage.prototype.setItem = function(key, value) {
                    if (key === PENDING_PORTFOLIO_SYNC_KEY && ++writes && (mode === 'fail-both' || (mode !== 'full' && writes === 1))) throw new DOMException('Synthetic quota', 'QuotaExceededError');
                    return set.call(this, key, value);
                };
                try { outcome = persistPendingPortfolioSync(); } catch (failure) { error = failure.name; }
                finally { Storage.prototype.setItem = set; }
                const fallbackOutcome = outcome;
                if (mode === 'retry') outcome = persistPendingPortfolioSync();
                updateSyncPortfolioButtonState();
                const notice = document.getElementById('syncPortfolioBtnBottomPersistenceNotice');
                return { outcome, fallbackOutcome, error, sameObject: pendingPortfolioSync === original,
                    photo: pendingPortfolioSync.sessionData.images[0].dataUrl,
                    status: pendingPortfolioSyncPersistence, warning: notice && !notice.hidden ? notice.textContent : '',
                    previousRetained: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === previous,
                    indexedDbEnabled: WFT_INDEXEDDB_CACHE_V1 };
            }, mode);
            assert.equal(prepared.sameObject, true);
            assert.equal(prepared.photo, 'data:image/png;base64,AAAA');
            assert.equal(prepared.indexedDbEnabled, false);
            if (mode === 'quota' || mode === 'retry') assert.equal(prepared.fallbackOutcome, false);
            if (mode === 'quota') {
                assert.equal(prepared.outcome, false); assert.equal(prepared.status, 'photos-in-tab');
                assert.match(prepared.warning, /before closing or reloading/);
            } else if (mode === 'fail-both') {
                assert.equal(prepared.error, 'QuotaExceededError'); assert.equal(prepared.previousRetained, true);
                assert.equal(prepared.status, 'memory'); assert.match(prepared.warning, /Emergency Backup/);
            } else {
                assert.equal(prepared.outcome, true); assert.equal(prepared.status, 'full'); assert.equal(prepared.warning, '');
            }
            await page.reload({ waitUntil: 'load' });
            const reloaded = await page.evaluate(mode => {
                stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                const pending = getPendingPortfolioSync(); updateSyncPortfolioButtonState();
                const before = localStorage.getItem('wft_portfolio'), signature = lastSyncedPortfolioSessionSignature;
                const committed = mode === 'quota' ? commitPendingPortfolioSync() : null;
                const notice = document.getElementById('syncPortfolioBtnBottomPersistenceNotice');
                return { id: pending.sessionData.id, text: pending.sessionData.originalText, score: pending.sessionData.overall,
                    photo: pending.sessionData.images[0] || null, status: pendingPortfolioSyncPersistence,
                    warning: notice && !notice.hidden ? notice.textContent : '', committed,
                    unchangedPortfolio: before === localStorage.getItem('wft_portfolio'),
                    retained: getPendingPortfolioSync() === pending && !!localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY),
                    unchangedSignature: signature === lastSyncedPortfolioSessionSignature };
            }, mode);
            assert.equal(reloaded.id, mode === 'fail-both' ? 'previous' : mode);
            assert.equal(reloaded.unchangedPortfolio, true);
            if (mode === 'quota') {
                assert.equal(reloaded.photo.dataUrl, ''); assert.equal(reloaded.photo.dataUrlRemovedForStorage, true);
                assert.equal(reloaded.status, 'missing-photos'); assert.match(reloaded.warning, /Reattach the photos and analyze again/);
                assert.equal(reloaded.committed, false); assert.equal(reloaded.retained, true); assert.equal(reloaded.unchangedSignature, true);
            } else if (mode === 'drive-backed') {
                assert.equal(reloaded.photo.driveFileId, 'durable-photo'); assert.equal(reloaded.warning, '');
            } else if (mode !== 'fail-both') {
                assert.equal(reloaded.photo.dataUrl, 'data:image/png;base64,AAAA'); assert.equal(reloaded.warning, '');
            }
            if (mode !== 'fail-both') { assert.equal(reloaded.text, 'Reload protected writing'); assert.equal(reloaded.score, 0); }
            cases.push({ name: mode + ' draft durability and reload', passed: true, prepared, reloaded });
        }
        assert.deepEqual(errors, []);
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ cases, passed: cases.length, failed: 0 }, null, 2));
        console.log('Pending portfolio browser checks passed: ' + cases.length + ' sync, durability and reload scenarios.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
