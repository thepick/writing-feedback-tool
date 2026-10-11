const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream', body: fs.readFileSync(file) });
        });
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
                let writes = 0, error = '';
                Storage.prototype.setItem = function(key, value) {
                    if (key === PENDING_PORTFOLIO_SYNC_KEY && (++writes === 1 || failBoth)) throw new DOMException('Storage full', 'QuotaExceededError');
                    return setItem.call(this, key, value);
                };
                try { persistPendingPortfolioSync(); } catch (failure) { error = failure.name; }
                finally { Storage.prototype.setItem = setItem; }
                updateSyncPortfolioButtonState();
                return { writes, error, sameObject: getPendingPortfolioSync() === original,
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
        }
        assert.deepEqual(errors, []);
        console.log('Browser pending-photo test passed: quota fallback and failed retry retain the original image bytes, and the actual Sync button uploads them before committing their Drive reference.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
