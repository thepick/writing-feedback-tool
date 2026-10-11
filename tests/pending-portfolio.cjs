const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function stripPendingPortfolioImageDataUrls(');
const end = source.indexOf('function getPendingPortfolioSync(', start);
assert.ok(start >= 0 && end > start);
const pending = () => ({ studentName: 'Alice', signature: 'assessment', replaceSource: { sourceSessionId: 'old' }, sessionData: {
    id: 'new', originalText: 'Writing to keep', categoryScores: { Grammar: 8 }, images: [
        { id: 'photo', dataUrl: 'data:image/png;base64,AAAA', originalDataUrl: 'original-photo', extractedText: 'OCR text', pendingDriveUpload: true },
        { id: 'uploaded', driveFileId: 'drive-id', dataUrl: '', mimeType: 'image/png' }, null
    ]
} });
function setup(mode, value = pending()) {
    let stored = 'previous pending entry';
    const writes = [], removed = [];
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        pendingPortfolioSync: value, PENDING_PORTFOLIO_SYNC_KEY: 'pending',
        cloneWftJson: value => JSON.parse(JSON.stringify(value)),
        localStorage: {
            setItem: (key, data) => {
                assert.equal(key, 'pending'); writes.push(data);
                if (mode === 'fail' || (mode === 'quota' && writes.length === 1)) throw new Error('Storage full');
                stored = data;
            }, removeItem: key => removed.push(key)
        }, wftDebugWarn() {}, wftDebugError() {}
    });
    return { app, value, writes, removed, get stored() { return stored; } };
}
const quota = setup('quota');
const original = JSON.stringify(quota.value);
quota.app.persistPendingPortfolioSync();
assert.equal(quota.app.pendingPortfolioSync, quota.value, 'Quota recovery must retain the original pending object for media upload');
assert.equal(JSON.stringify(quota.app.pendingPortfolioSync), original, 'Photos and OCR must remain in memory');
assert.equal(quota.writes.length, 2);
const trimmed = JSON.parse(quota.stored);
assert.equal(trimmed.sessionData.images[0].dataUrl, '');
assert.equal(trimmed.sessionData.images[0].originalDataUrl, undefined);
assert.equal(trimmed.sessionData.images[0].extractedText, undefined);
assert.equal(trimmed.sessionData.images[0].dataUrlRemovedForStorage, true);
assert.equal(trimmed.sessionData.images[1].driveFileId, 'drive-id');
assert.equal(trimmed.sessionData.originalText, 'Writing to keep');
assert.equal(trimmed.sessionData.categoryScores.Grammar, 8);
assert.equal(trimmed.replaceSource.sourceSessionId, 'old');
assert.equal(trimmed.signature, 'assessment');

const failed = setup('fail');
const before = JSON.stringify(failed.value);
assert.throws(() => failed.app.persistPendingPortfolioSync(), /Storage full/);
assert.equal(failed.app.pendingPortfolioSync, failed.value);
assert.equal(JSON.stringify(failed.app.pendingPortfolioSync), before, 'A failed retry must retain the complete in-memory assessment');
assert.equal(failed.stored, 'previous pending entry');
assert.equal(failed.writes.length, 2);

const normal = setup('normal');
normal.app.persistPendingPortfolioSync();
assert.equal(normal.writes.length, 1);
assert.equal(normal.stored, JSON.stringify(normal.value));
for (const value of [null, {}, { studentName: 'Alice' }]) {
    const cleared = setup('normal', value);
    cleared.app.persistPendingPortfolioSync();
    assert.deepEqual(cleared.removed, ['pending']);
    assert.deepEqual(cleared.writes, []);
}
console.log('Pending portfolio tests passed: quota fallback trims only the stored copy, failed retries retain memory and previous storage, and normal saves and clearing remain intact.');
