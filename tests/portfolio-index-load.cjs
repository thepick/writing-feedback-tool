const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function loadPortfolioIndexFromDrive(');
const end = source.indexOf('function assignMissingPortfolioIndexStudentIds(', start);
assert.ok(start >= 0 && end > start);
const payload = { format: 'portfolio-index-v1', students: {} };

async function check(options, expectedCalls, hasPayload, synchronousCallback = false) {
    const calls = [], callbacks = [], failure = new Error('Synthetic download failure');
    let synchronous = true;
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        WFT_PORTFOLIO_INDEX_V1: options.enabled !== false,
        isWftStorageSafeMode: () => !!options.safe,
        getCachedWftDriveFileId() { if (options.cacheReadThrows) throw Error('Synthetic cache read'); return options.cached || ''; },
        downloadWftJsonFilePromise(id, kind) { assert.equal(id, options.cached || 'file'); assert.equal(kind, 'index'); calls.push('download'); return options.reject ? Promise.reject(failure) : Promise.resolve(options.invalid ? {} : payload); },
        findWftFilesByNamePromise(name) { assert.equal(name, 'portfolio-index.json'); calls.push('find'); return Promise.resolve(Object.hasOwn(options, 'files') ? options.files : [{ id: 'file' }]); },
        isWftTokenValid: () => options.token !== false,
        chooseCanonicalWftFile(files) { calls.push('choose'); return files[0]; },
        setCachedWftDriveFileId(name, id) { assert.equal(name, 'portfolio-index.json'); assert.equal(id, 'file'); calls.push('cache'); if (options.cacheWriteThrows) throw Error('Synthetic cache write'); },
        updateDuplicateSyncMaintenanceFromFiles(name, files) { assert.equal(name, 'portfolio-index.json'); calls.push('maintenance'); if (options.maintenanceThrows) throw Error('Synthetic maintenance'); },
        wftDebugLog() {}, wftDebugWarn() {}
    });
    if (options.noDownload) app.downloadWftJsonFilePromise = undefined;
    if (options.noFind) app.findWftFilesByNamePromise = undefined;
    app.loadPortfolioIndexFromDrive((error, data) => callbacks.push({ error, data, synchronous }));
    synchronous = false;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(callbacks.length, 1);
    assert.equal(callbacks[0].synchronous, synchronousCallback);
    assert.equal(callbacks[0].error, options.reject ? failure : null);
    assert.equal(callbacks[0].data, hasPayload ? payload : null);
    assert.deepEqual(calls, expectedCalls);
}

(async () => {
    const normal = ['find', 'choose', 'cache', 'maintenance', 'download'];
    const cases = [
        [{}, normal, true], [{ enabled: false }, [], false, true], [{ safe: true }, [], false, true],
        [{ token: false }, [], false, true], [{ noFind: true }, [], false, true],
        [{ cached: 'cached' }, ['download'], true], [{ cached: 'cached', reject: true }, ['download'], false],
        [{ files: null }, ['find'], false], [{ files: [] }, ['find'], false], [{ files: { length: NaN } }, ['find'], false],
        [{ files: [{}] }, ['find', 'choose'], false], [{ files: [{ id: '' }] }, ['find', 'choose'], false],
        [{ invalid: true }, normal, false], [{ reject: true }, normal, false],
        [{ noDownload: true }, ['find', 'choose', 'cache', 'maintenance'], false],
        [{ cacheReadThrows: true }, normal, true], [{ cacheWriteThrows: true }, normal, true], [{ maintenanceThrows: true }, normal, true]
    ];
    for (const scenario of cases) await check(...scenario);
    console.log('Portfolio-index load: 18 cases passed; guards, callback timing, downloads, caches and tolerated maintenance failures intact.');
})().catch(error => { console.error(error); process.exitCode = 1; });
