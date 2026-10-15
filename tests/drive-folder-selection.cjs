const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function chooseCanonicalDriveFolderPromise(');
const end = source.indexOf('function ensureDriveFolder(', start);
assert.ok(start >= 0 && end > start);

async function choose(summaries, options = {}) {
    const calls = [], folders = summaries.map((summary, i) => ({ id: String(i), modifiedTime: summary.modifiedTime || '' }));
    const context = {};
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        wftSyncWarn() {}, WFT_SETTINGS_FILENAME: 'settings', WFT_PORTFOLIO_FILENAME: 'portfolio', WFT_DELETIONS_FILENAME: 'deletions',
        getWftFolderSyncFileSummary(id, connection) {
            assert.equal(connection, context); calls.push(id);
            if (options.reject === id) return Promise.reject(new Error('Synthetic listing failure'));
            return Promise.resolve({ ...summaries[Number(id)] });
        },
        assertWftArchiveConnection(connection) { assert.equal(connection, context); if (options.stale) throw new Error('Synthetic stale connection'); },
        setCachedWftDriveFileId(name, id) { calls.push([name, id]); }
    });
    const run = app.chooseCanonicalDriveFolderPromise(folders, context);
    if (options.reject || options.stale) {
        await assert.rejects(run, /Synthetic (listing failure|stale connection)/);
        assert.ok(calls.every(call => typeof call === 'string'), 'Failures must not update cached IDs');
        return;
    }
    const selected = await run;
    if (!folders.length) { assert.equal(selected, null); assert.deepEqual(calls, []); return; }
    assert.equal(selected, folders[options.expected ?? 0]);
    if (folders.length === 1) { assert.deepEqual(calls, []); return; }
    assert.deepEqual(calls.slice(0, folders.length), folders.map(folder => folder.id), 'Summaries must load in folder order');
    const winner = summaries[options.expected ?? 0];
    assert.deepEqual(calls.slice(folders.length), [['settings', winner.settingsFileId], ['portfolio', winner.portfolioFileId], ['deletions', winner.deletionsFileId]].filter(([, id]) => id));
}

(async () => {
    await choose([]); await choose([{}]);
    const cases = [
        [{}, { hasSettings: true }, 1],
        [{ hasPortfolio: true }, { hasDeletions: true, newestTime: '2026-10-15' }, 0],
        [{ hasSettings: true }, { hasPortfolio: true }, 0],
        [{ newestTime: '2026-10-14' }, { newestTime: '2026-10-15' }, 1],
        [{ newestTime: '2026-10-15' }, { newestTime: '2026-10-14' }, 0],
        [{ newestTime: 'same' }, { newestTime: 'same' }, 0],
        [{ modifiedTime: '2026-10-14' }, { modifiedTime: '2026-10-15' }, 1],
        [{}, {}, 0],
        [{ hasSettings: true, modifiedTime: '2026-10-15' }, { hasPortfolio: true, modifiedTime: '2026-10-14' }, 0],
        [{ hasSettings: true, newestTime: 'old' }, { hasPortfolio: true, hasDeletions: true }, 1]
    ];
    for (const [first, second, expected] of cases) {
        const summaries = [first, second].map((summary, i) => ({ settingsFileId: 'settings-' + i, portfolioFileId: 'portfolio-' + i, deletionsFileId: 'deletions-' + i, ...summary }));
        await choose(summaries, { expected });
    }
    await choose([{}, {}], { reject: '1' });
    await choose([{}, {}], { stale: true });
    console.log('Drive-folder selection: 14 cases passed; ranking, tie-breaks, cache writes and connection failures preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
