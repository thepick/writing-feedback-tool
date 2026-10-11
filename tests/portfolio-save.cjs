const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/app/00-storage-sync-patches.js'), 'utf8');
const start = source.indexOf('function savePortfolioData(');
const end = source.indexOf('function loadPortfolioFromDrive(', start);
assert.ok(start >= 0 && end > start);
function setup(flags = {}) {
    const original = '{"Alice":{"sessions":[{"id":"saved"}]}}';
    let stored = original;
    const events = [];
    const app = vm.runInNewContext(source.slice(start, end) + '\n;globalThis', {
        WFT_STORAGE_SCHEMA_VERSION: 1, WFT_PROACTIVE_STRIP_V1: false, WFT_SYNC_ENGINE_V2: true,
        isWftStorageSafeMode: () => false,
        normalizeWftPortfolioForSchemaV1: data => data,
        normalizePortfolioData: data => data,
        makePortfolioLocalStorageSafe: data => ({ ...data, proactivelyStripped: true }),
        stripPortfolioHeavyFields: data => ({ ...data, retryStripped: true }),
        localStorage: { setItem(key, value) { assert.equal(key, 'wft_portfolio'); stored = value; events.push('write'); } },
        markWftPortfolioDirty: () => events.push('portfolio-dirty'),
        markWftPortfolioIndexDirty: () => events.push('index-dirty'),
        scheduleWftCloudSync: () => events.push('schedule'),
        driveAccessToken: '',
        saveFileToDrive: (name, value) => { assert.equal(name, 'wft-portfolio.json'); assert.equal(value, JSON.stringify(JSON.parse(stored), null, 2)); events.push('upload'); },
        wftDebugError() {}, wftDebugWarn() {}, ...flags
    });
    return { app, events, original, get stored() { return stored; } };
}
const data = { Alice: { sessions: [{ id: 'new', originalText: 'Keep this writing' }] } };
for (const normalizer of ['normalizeWftPortfolioForSchemaV1', 'normalizePortfolioData']) {
    const test = setup();
    const failure = new Error('Invalid portfolio data');
    test.app[normalizer] = () => { throw failure; };
    assert.throws(() => test.app.savePortfolioData(data), error => error === failure);
    assert.equal(test.stored, test.original, 'Preparation failure must preserve the saved portfolio byte for byte');
    assert.deepEqual(test.events, [], 'A failed preparation must not write or queue a sync');
}
for (const proactive of [false, true]) {
    const test = setup({ WFT_PROACTIVE_STRIP_V1: proactive });
    const saved = test.app.savePortfolioData(data);
    assert.equal(saved.Alice.sessions[0].originalText, 'Keep this writing');
    assert.equal(!!saved.proactivelyStripped, proactive);
    assert.deepEqual(JSON.parse(test.stored), saved);
    assert.deepEqual(test.events, ['write', 'portfolio-dirty', 'index-dirty', 'schedule']);

    const firstWrite = test.app.localStorage.setItem;
    let writes = 0;
    test.events.length = 0;
    test.app.localStorage.setItem = (key, value) => {
        if (++writes === 1) throw new Error('Quota exhausted');
        firstWrite(key, value);
    };
    const recovered = test.app.savePortfolioData(data);
    assert.equal(writes, 2);
    assert.equal(recovered.retryStripped, true);
    assert.equal(recovered.Alice.sessions[0].id, 'new');
    assert.deepEqual(JSON.parse(test.stored), recovered);
    assert.deepEqual(test.events, ['write', 'portfolio-dirty', 'index-dirty', 'schedule']);
}
let test = setup();
const failure = new Error('All writes failed');
test.app.localStorage.setItem = () => { throw failure; };
assert.throws(() => test.app.savePortfolioData(data), error => error === failure);
assert.equal(test.stored, test.original);
assert.deepEqual(test.events, []);

test = setup({ WFT_PROACTIVE_STRIP_V1: true });
test.app.makePortfolioLocalStorageSafe = () => { throw new Error('Strip failed'); };
assert.equal(test.app.savePortfolioData(data).retryStripped, true, 'Keep the existing alternate stripping recovery');

test = setup({ WFT_PROACTIVE_STRIP_V1: true, isWftStorageSafeMode: () => true, driveAccessToken: 'test-token' });
test.app.normalizeWftPortfolioForSchemaV1 = () => { throw new Error('Safe mode must skip schema conversion'); };
test.app.makePortfolioLocalStorageSafe = () => { throw new Error('Safe mode must skip proactive stripping'); };
assert.equal(test.app.savePortfolioData(data), data);
assert.deepEqual(test.events, ['write', 'upload']);

test = setup({ WFT_SYNC_ENGINE_V2: false, driveAccessToken: 'test-token' });
test.app.savePortfolioData({});
assert.equal(test.stored, '{}', 'Explicitly saving an empty portfolio must still work');
assert.deepEqual(test.events, ['write', 'upload']);
console.log('Portfolio save tests passed: preparation errors, byte-preserved history, stripping modes, quota recovery, failed retries, safe mode, sync ordering and intentional clearing.');
