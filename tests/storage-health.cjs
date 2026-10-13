const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function section(file, start, end) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, 'Missing source section: ' + file);
    return source.slice(first, last);
}
function context(source, globals) {
    return vm.runInNewContext(source + '\n;globalThis', globals);
}

(async () => {
    const production = 'js/app/00-storage-sync-patches.js';
    for (const file of [production]) {
        const source = section(file, 'function loadPortfolioAsync()', 'function renderStudentPortfolioAsync(');
        const portfolio = { Alice: { sessions: [{ id: 'keep' }] } };
        let saves = 0;
        const app = context(source, {
            WFT_ASYNC_PORTFOLIO_ACCESS_V1: true, WFT_STUDENT_ID_MAP_V1: true,
            getLocalPortfolioSnapshot: () => portfolio,
            savePortfolioData: value => { saves++; assert.equal(value, portfolio); return true; },
            readWftRequiredStorage: () => ({ studentIdMap: { Alice: 'student-1' } })
        });
        assert.equal(await app.loadStudentPortfolioAsync('Alice'), portfolio.Alice);
        assert.equal(await app.loadStudentPortfolioAsync('student-1'), portfolio.Alice);
        assert.equal((await app.loadStudentPortfolioAsync('missing')).sessions.length, 0);
        const updated = { sessions: [{ id: 'new' }] };
        assert.equal(await app.saveStudentPortfolioAsync('student-1', updated), true);
        assert.equal(portfolio.Alice, updated);
        assert.equal(Object.hasOwn(portfolio, 'student-1'), false);

        const failure = new Error('settings lookup failed');
        app.readWftRequiredStorage = () => { throw failure; };
        await assert.rejects(app.loadStudentPortfolioAsync('student-1'), error => error === failure);
        await assert.rejects(app.saveStudentPortfolioAsync('student-1', { sessions: [] }), error => error === failure);
        assert.equal(saves, 1, 'Failed ID resolution must not save a portfolio under the wrong key');
        assert.equal(portfolio.Alice, updated);
        app.WFT_STUDENT_ID_MAP_V1 = false;
        assert.equal((await app.loadStudentPortfolioAsync('missing')).sessions.length, 0);

        app.getLocalPortfolioSnapshot = () => { throw new Error('read failed'); };
        let promise;
        assert.doesNotThrow(() => { promise = app.loadPortfolioAsync(); });
        await assert.rejects(promise, /read failed/);
        app.savePortfolioData = () => { throw new Error('write failed'); };
        assert.doesNotThrow(() => { promise = app.savePortfolioAsync(portfolio); });
        await assert.rejects(promise, /write failed/);
    }

    for (const file of ['js/app/storage-recovery.js']) {
        const source = section(file, '// ── Emergency Backup ──', 'function downloadWftEmergencyBackup(');
        const flags = Object.fromEntries([...source.matchAll(/\b(WFT_[A-Z0-9_]+)\b/g)].map(match => [match[1], false]));
        const values = { wft_settings: '{"unknown":{"keep":true}}', wft_students: 'null', wft_portfolio: '{invalid', wft_selectedStudent: 'Alice', wft_google_user: '' };
        const app = context(source, {
            ...flags, WFT_STORAGE_SCHEMA_VERSION: 2,
            localStorage: { getItem(key) { if (key === 'wft_deletions') throw new Error('unavailable'); return Object.hasOwn(values, key) ? values[key] : null; } },
            getPortfolioData: () => ({ Alice: { sessions: [{}, {}] }, Bob: {}, _meta: {}, updatedAt: 'date', __syncMeta: {}, syncMeta: {}, lastSyncedAt: 'date', lastSyncStatus: 'ok' })
        });
        const backup = JSON.parse(JSON.stringify(app.buildWftEmergencyBackupObject()));
        assert.deepEqual(backup.contents, { wft_settings: { unknown: { keep: true } }, wft_students: null, wft_portfolio: '{invalid', wft_deletions: null, wft_selectedStudent: 'Alice', wft_google_user: '' });
        assert.deepEqual(backup.studentNames, ['Alice', 'Bob']);
        assert.equal(backup.sessionCount, 2);
        assert.equal(backup.schemaVersion, 2);
        assert.ok(!isNaN(Date.parse(backup.timestamp)));
        app.getPortfolioData = () => { throw new Error('portfolio unavailable'); };
        const fallback = app.buildWftEmergencyBackupObject();
        assert.equal(fallback.studentNames.length, 0);
        assert.equal(fallback.sessionCount, 0);
        assert.equal(fallback.contents.wft_portfolio, '{invalid', 'Unreadable JSON must remain recoverable');
    }
    console.log('Storage health tests passed for shipped code: ID lookup, no write on lookup failure, promise errors, raw backup preservation, inaccessible keys, metadata exclusion and portfolio fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
