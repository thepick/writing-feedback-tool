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
        await page.waitForFunction(() => typeof syncWftDeletionsIfNeeded === 'function');
        const result = await page.evaluate(async () => {
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            const old = '2026-10-01T00:00:00Z', middle = '2026-10-02T00:00:00Z', newest = '2026-10-03T00:00:00Z';
            const local = {
                deletedStudents: { 'student:bob': { studentName: 'Bob', deletedAt: old } },
                restoredStudents: { 'student:alice': { studentName: 'Alice', restoredAt: old }, 'student:bob': { studentName: 'Bob', restoredAt: middle } },
                records: [{ id: 'local-action', type: 'archive-remove', studentId: 'alice', sessionId: 'archived', deletedAt: newest, lamportClock: 5 }]
            };
            let cloud = {
                deletedStudents: { 'student:alice': { studentName: 'Alice', deletedAt: middle }, 'student:bob': { studentName: 'Bob', deletedAt: newest } },
                restoredStudents: { 'student:alice': { studentName: 'Alice', restoredAt: newest } },
                deletedSessions: { 'session:alice:deleted': { studentName: 'Alice', sessionId: 'deleted', deletedAt: newest } },
                records: [{ id: 'cloud-action', type: 'session', studentId: 'alice', sessionId: 'deleted', deletedAt: newest }]
            };
            localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(local));
            wftSyncState.pendingDeletionsPush = true;
            wftSyncState.localDeletionsCounter = 1;
            findWftFilesByNamePromise = () => Promise.resolve([{ id: 'canonical', modifiedTime: newest }]);
            downloadWftJsonFilePromise = () => Promise.resolve(cloud);
            const uploads = [];
            uploadWftJsonFilePromise = (name, data) => {
                if (name !== WFT_DELETIONS_FILENAME) throw new Error('Unexpected upload');
                cloud = JSON.parse(JSON.stringify(data));
                uploads.push(cloud);
                return Promise.resolve('canonical');
            };
            await syncWftDeletionsIfNeeded('test');
            const merged = getDeletionsData();
            const roster = applyDeletionsToStudents(['Alice', 'Bob'], merged);
            const portfolio = applyDeletionsToPortfolio({ Alice: { sessions: [{ id: 'keep' }, { id: 'deleted' }] }, Bob: { sessions: [{ id: 'bob-essay' }] } }, merged);
            const splitFile = applyDeletionsToFile({ studentId: 'alice', sessions: [{ id: 'archived', updatedAt: old, lamportClock: 4 }, { id: 'keep', updatedAt: old, lamportClock: 4 }] }, merged);
            await syncWftDeletionsIfNeeded('repeat');
            const repeatCount = getDeletionsData().records.length;

            // Exercise the caller's second merge when a new local action arrives during a pull.
            downloadWftJsonFilePromise = () => {
                const latest = getDeletionsData();
                latest.records.push({ id: 'during-pull', type: 'session', sessionId: 'new-delete', deletedAt: newest });
                saveDeletionsData(latest);
                return Promise.resolve(cloud);
            };
            await syncWftDeletionsIfNeeded('edited-during-pull');
            return { roster, portfolio, splitFile, uploads, repeatCount, final: getDeletionsData(), pending: wftSyncState.pendingDeletionsPush, syncedCounter: wftSyncState.lastSyncedDeletionsCounter, localCounter: wftSyncState.localDeletionsCounter };
        });
        assert.deepEqual(result.roster, ['Alice']);
        assert.deepEqual(Object.keys(result.portfolio), ['Alice']);
        assert.deepEqual(result.portfolio.Alice.sessions.map(s => s.id), ['keep']);
        assert.deepEqual(result.splitFile.sessions.map(s => s.id), ['keep']);
        assert.equal(result.repeatCount, 2);
        assert.equal(result.uploads.length, 2, 'A repeated unchanged sync must not upload; a new action during the pull must upload');
        assert.deepEqual(result.uploads[0].records.map(r => r.id).sort(), ['cloud-action', 'local-action']);
        assert.deepEqual(result.final.records.map(r => r.id).sort(), ['cloud-action', 'during-pull', 'local-action']);
        assert.deepEqual(result.uploads[1].records, result.final.records);
        assert.equal(result.pending, false);
        assert.equal(result.syncedCounter, result.localCounter);
        assert.deepEqual(errors, []);
        console.log('Browser deletion sync passed: restored students remain visible, newer deletions filter writing, both histories reach Drive, and edits during a pull survive the second merge.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
