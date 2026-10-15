const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const scenarios = ['backup-local', 'backup-drive', 'backup-empty-id', 'backup-upload-error', 'backup-sync-throw', 'backup-no-helper',
    'backup-download-error', 'backup-fallback-error', 'backup-corrupt', 'backup-unreadable', 'backup-recovery', 'backup-settings-corrupt', 'backup-settings-corrupt-recovery',
    'cache-cancel', 'cache-escape', 'cache-clear', 'cache-remove-error', 'cache-meta-remove-error', 'cache-idb-abort',
    'cache-idb-open-error', 'cache-idb-late-abort', 'cache-idb-clear-throw', 'cache-concurrent-abort', 'cache-concurrent-complete', 'cache-rollback-error', 'cache-corrupt', 'cache-unreadable', 'cache-recovery',
    'cache-settings-corrupt', 'cache-roster-corrupt', 'cache-deletions-corrupt', 'safe-toggle', 'safe-enter-write-error', 'safe-exit-write-error', 'safe-unreadable', 'safe-corrupt'];

function checkBackupCallback(scenario, observed, check, failingDownload, driveSuccess) {
    if (scenario !== 'backup-download-error') {
        check('backup callback settles exactly once', observed.callbacks.length === 1);
        const outcome = observed.callbacks[0];
        check('callback outcome truthful', outcome && (failingDownload ? !!outcome.error && outcome.result === null : driveSuccess ? !outcome.error && outcome.result === 'backup-file' : ['backup-empty-id', 'backup-upload-error', 'backup-sync-throw', 'backup-settings-corrupt'].includes(scenario) ? !!outcome.error && outcome.result === 'fallback-local' : !outcome.error && outcome.result === 'local-only'));
    }
}

async function checkBackupScenario(scenario, observed, downloads, requests, alerts, check) {
    check('backup action leaves portfolio and storage metadata byte exact', ['wft_portfolio', 'wft_storage_meta'].every(k => observed.contents[k] === (scenario.endsWith('recovery') && k === 'wft_portfolio' ? '{}' : observed.originals[k])));
    const failingDownload = ['backup-download-error', 'backup-fallback-error'].includes(scenario);
    const driveSuccess = scenario === 'backup-drive';
    checkBackupCallback(scenario, observed, check, failingDownload, driveSuccess);
    check('expected actual download count', downloads.length === (failingDownload || driveSuccess ? 0 : 1));
    let backup;
    if (downloads.length) backup = JSON.parse(fs.readFileSync(await downloads[0].path(), 'utf8'));
    if (driveSuccess) { const upload = requests.find(r => r.url.includes('/upload/')); backup = upload && JSON.parse(upload.body.split(/\r\n\r\n|\r\n--/)[3]); check('native upload carries valid parent and acknowledged backup', upload && upload.method === 'POST' && upload.body.includes('root-folder')); }
    if (backup) {
        check('export redacts credential', !JSON.stringify(backup).includes('synthetic-private-key'));
        const expectedDraft = scenario === 'backup-corrupt' ? observed.originals.wft_oauth_textarea_draft_v1 : JSON.parse(observed.originals.wft_oauth_textarea_draft_v1);
        check('export preserves saved sign-in draft writing student and genres', JSON.stringify(backup.contents.wft_oauth_textarea_draft_v1) === JSON.stringify(expectedDraft));
        check('backup leaves saved draft bytes unchanged', observed.contents.wft_oauth_textarea_draft_v1 === observed.originals.wft_oauth_textarea_draft_v1);
        check('export includes full pending photo/writing and persisted pending root', backup.pendingPortfolioSync?.sessionData.originalText === 'Pending exact writing' && backup.pendingPortfolioSync?.sessionData.images[0].dataUrl === 'data:image/png;base64,c3ludGhldGlj' && backup.contents.wft_pending_portfolio_sync_v1?.sessionData.id === 'pending');
        check('corrupt and recovery writing retained', scenario === 'backup-corrupt' ? backup.contents.wft_portfolio === '{damaged writing' : scenario === 'backup-recovery' ? JSON.parse(backup.studentChangeRecovery.wft_portfolio).Synthetic.sessions[0].originalText === 'Saved exact writing' : true);
        if (scenario === 'backup-unreadable') check('unreadable root explicitly marked and incomplete backup reported', backup.readErrors?.includes('wft_portfolio') && alerts.some(a => /could not be read|incomplete/i.test(a)));
        if (scenario.startsWith('backup-settings-corrupt')) {
            check('unredactable settings omitted with visible incomplete backup warning', backup.contents.wft_settings === null && backup.readErrors?.includes('wft_settings') && alerts.some(a => /incomplete/i.test(a)));
            if (scenario === 'backup-settings-corrupt') check('strict Drive storage guard prevents unsafe upload and uses local fallback', !requests.some(r => r.url.includes('/upload/')));
            if (scenario.endsWith('recovery')) check('export omits unsafe recovery settings without changing retained originals', backup.studentChangeRecovery.wft_settings === null && observed.recovery.wft_settings === observed.originals.wft_settings);
        }
    }
    if (failingDownload) check('download failure visible with no success', alerts.some(a => /failed|could not/i.test(a)) && !alerts.some(a => /saved|downloaded/i.test(a)));
    check('backup success or fallback visible', failingDownload || alerts.some(a => /Drive|download/i.test(a)));
}

async function checkCacheScenario(page, scenario, observed, dialogText, requests, alerts, check) {
    const canceled = ['cache-cancel', 'cache-escape'].includes(scenario), success = scenario === 'cache-clear';
    check('clear warning covers local-only writing and photos', /not.*synced|unsynced|local-only/i.test(dialogText) && /photo/i.test(dialogText));
    check('cloud bytes untouched', requests.length === 0);
    if (success) check('confirmed clear deletes intended caches', observed.contents.wft_portfolio === null && observed.contents.wft_storage_meta === null && Object.values(observed.idb).every(n => n === 0));
    else {
        check('refused canceled or failed clear preserves recoverable portfolio', scenario.startsWith('cache-concurrent-') ? observed.contents.wft_portfolio === observed.concurrentBytes && ['during-clear', 'saved'].every(id => JSON.parse(observed.contents.wft_portfolio).Synthetic.sessions.some(s => s.id === id)) : scenario === 'cache-rollback-error' ? observed.recovery?.wft_portfolio === observed.originals.wft_portfolio && observed.backup.contents.wft_portfolio.Synthetic.sessions[0].originalText === 'Saved exact writing' : observed.contents.wft_portfolio === (scenario === 'cache-recovery' ? '{}' : observed.originals.wft_portfolio));
        const committedIdbClear = ['cache-concurrent-complete', 'cache-remove-error', 'cache-meta-remove-error', 'cache-rollback-error'].includes(scenario);
        check('IDB outcome matches transaction completion', Object.values(observed.idb).every(n => n === (committedIdbClear ? 0 : 1)));
        if (committedIdbClear) check('partial cache outcome is disclosed', alerts.some(a => /some cache data may already have been removed/i.test(a)));
    }
    check('clear completion truthful', canceled ? alerts.length === 0 : success ? alerts.some(a => /cache cleared/i.test(a)) : alerts.some(a => /could not|failed|recovery/i.test(a)) && !alerts.some(a => /^Local cache cleared/i.test(a)));
    if (!canceled && !success && !scenario.endsWith('corrupt') && scenario !== 'cache-recovery') {
        const firstAlerts = alerts.slice(); alerts.length = 0;
        // Existing class-change retry restores retained before-images before allowing another mutation.
        if (scenario === 'cache-rollback-error') await page.evaluate(() => saveWftStudentChange({}));
        await page.locator('#btnClearLocalCache').click(); await page.locator('.wft-confirm-ok').click(); await page.waitForTimeout(100);
        const retry = await page.evaluate(() => ({ portfolio: localStorage.getItem('wft_portfolio'), pending: JSON.stringify(pendingPortfolioSync) === pendingBefore, recovery: wftStudentChangeRecovery }));
        check('controlled retry succeeds and retains pending writing', retry.portfolio === null && retry.pending && !retry.recovery && alerts.some(a => /cache cleared/i.test(a)));
        alerts.unshift(...firstAlerts);
    }
}

async function performRecoveryAction(page, scenario, check) {
    let dialogText = '';
    if (scenario.startsWith('cache-')) {
        await page.locator('#btnClearLocalCache').click();
        dialogText = await page.locator('#wftConfirmBody').textContent();
        if (scenario === 'cache-escape') await page.keyboard.press('Escape');
        else await page.locator(scenario === 'cache-cancel' ? '.wft-confirm-cancel' : '.wft-confirm-ok').click();
        if (scenario.startsWith('cache-concurrent-')) {
            await page.waitForFunction(() => window.clearStarted);
            await page.evaluate(() => {
                saveStudentSession('Synthetic', { id: 'during-clear', createdAt: new Date().toISOString(), originalText: 'Newer writing during cache clear', images: [] });
                window.concurrentBytes = localStorage.getItem('wft_portfolio');
                for (const key of ['wft_settings', 'wft_students', 'wft_deletions']) originals[key] = localStorage.getItem(key);
                window.syncBefore = JSON.stringify([wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush, wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter]);
                window.releaseClear = true;
            });
        }
    } else if (scenario.startsWith('safe-')) {
        await page.locator('#btnSafeMode').click();
        if (scenario === 'safe-toggle') { check('enter mode reflected by actual button', await page.locator('#btnSafeMode').textContent() === 'Exit Safe Mode'); await page.locator('#btnSafeMode').click(); }
    } else {
        const download = ['backup-drive', 'backup-download-error', 'backup-fallback-error'].includes(scenario)
            ? null : page.waitForEvent('download', { timeout: 5000 });
        await Promise.all([download, page.getByRole('button', { name: scenario === 'backup-download-error' ? 'Download Emergency Backup' : 'Create Drive Backup', exact: true }).click()]);
    }
    return dialogText;
}

async function waitForRecoveryCompletion(page, scenario) {
    if (scenario.startsWith('backup-') && scenario !== 'backup-download-error')
        await page.waitForFunction(() => backupCallbacks.length > 0, null, { timeout: 5000 });
    else await page.waitForTimeout(150);
}

async function runRecoveryScenario(browser, scenario, cases) {
    const page = await browser.newPage({ acceptDownloads: true }), errors = [], alerts = [], requests = [], downloads = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
    page.on('download', download => downloads.push(download));
    await page.route('**/*', route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === 'http://127.0.0.1:8765') {
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        }
        if (url.hostname !== 'www.googleapis.com') return route.abort();
        requests.push({ url: url.href, method: req.method(), body: req.postData() });
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (url.pathname.includes('/upload/')) return scenario.includes('upload-error') || scenario === 'backup-fallback-error' ? reply({ error: { message: 'Synthetic upload refusal' } }, 403) : reply(scenario === 'backup-empty-id' ? {} : { id: 'backup-file' });
        if (url.pathname.endsWith('/root-folder')) return reply({ id: 'root-folder', name: 'WritingFeedbackTool', mimeType: 'application/vnd.google-apps.folder', trashed: false });
        return reply({ files: [] });
    });
    await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async scenario => {
        stopWftSyncPolling(); scheduleWftCloudSync = () => {};
        window.originalGet = Storage.prototype.getItem; window.originalSet = Storage.prototype.setItem; window.originalRemove = Storage.prototype.removeItem;
        window.originalTransaction = IDBDatabase.prototype.transaction;
        window.originalClear = IDBObjectStore.prototype.clear;
        window.originalOpen = IDBFactory.prototype.open; window.originalUrl = URL.createObjectURL;
        window.originalSave = saveFileToDrive;
        window.backupCallbacks = [];
        const originalBackup = saveWftPreMigrationBackupToDrive;
        saveWftPreMigrationBackupToDrive = callback => originalBackup((err, result) => { backupCallbacks.push({ error: err && err.message, result }); if (callback) callback(err, result); });
        window.originals = {
            wft_portfolio: JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', originalText: 'Saved exact writing', images: [{ driveFileId: 'photo-file' }] }] } }),
            wft_settings: JSON.stringify({ students: ['Synthetic'], unknown: 'keep', apiKey: 'synthetic-private-key' }),
            wft_students: '["Synthetic"]', wft_deletions: '{"records":[]}',
            wft_oauth_textarea_draft_v1: JSON.stringify({ text: 'Only unsaved synthetic writing', selectedStudent: 'Synthetic draft student', manualGenreOverrideValue: 'opinion', writingGenreSelectValue: 'narrative' }),
            wft_storage_meta: JSON.stringify({ safeMode: scenario === 'safe-exit-write-error', safeModeReason: 'fixture', activePortfolioFormat: 'monolithic-v1' }),
            wft_pending_portfolio_sync_v1: JSON.stringify({ studentName: 'Synthetic', signature: 'pending', sessionData: { id: 'pending', originalText: 'Pending exact writing', images: [{ dataUrl: '', dataUrlRemovedForStorage: true }] } })
        };
        Object.entries(originals).forEach(([k, v]) => localStorage.setItem(k, v));
        pendingPortfolioSync = JSON.parse(originals.wft_pending_portfolio_sync_v1);
        pendingPortfolioSync.sessionData.images[0].dataUrl = 'data:image/png;base64,c3ludGhldGlj';
        Storage.prototype.setItem = function(key, value) {
            if (key === PENDING_PORTFOLIO_SYNC_KEY && JSON.parse(value).sessionData.images[0].dataUrl) throw new DOMException('Synthetic photo quota limit', 'QuotaExceededError');
            return originalSet.call(this, key, value);
        };
        persistPendingPortfolioSync();
        Storage.prototype.setItem = originalSet;
        originals.wft_pending_portfolio_sync_v1 = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
        wftSyncState.pendingPortfolioPush = true; wftSyncState.pendingSettingsPush = true; wftSyncState.pendingDeletionsPush = true;
        window.pendingBefore = JSON.stringify(pendingPortfolioSync);
        window.syncBefore = JSON.stringify([wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush, wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter]);
        driveAccessToken = wftSyncState.accessToken = scenario.startsWith('backup-') && !['backup-local', 'backup-corrupt', 'backup-unreadable', 'backup-recovery', 'backup-settings-corrupt-recovery', 'backup-download-error'].includes(scenario) ? 'synthetic-token' : '';
        wftSyncState.signedIn = !!driveAccessToken; wftSyncState.tokenExpiresAt = Date.now() + 600000;
        driveFolderId = wftSyncState.folderId = 'root-folder';
        if (scenario.startsWith('cache-')) {
            for (const [store, value] of Object.entries({ metadata: { key: 'fixture' }, studentPortfolios: { studentId: 'fixture', originalText: 'IDB writing' }, thumbnails: { imageId: 'fixture', dataUrl: 'IDB photo' }, portfolioIndex: { id: 'fixture' }, syncQueue: { id: 1, writing: 'queued' } })) await WftIndexedDb.put(store, value);
        }
        function installScenarioFaults(scenario) {
            if (['backup-corrupt', 'cache-corrupt'].includes(scenario)) { localStorage.setItem('wft_portfolio', '{damaged writing'); originals.wft_portfolio = '{damaged writing'; }
            if (scenario === 'backup-corrupt') localStorage.setItem('wft_oauth_textarea_draft_v1', originals.wft_oauth_textarea_draft_v1 = '{damaged unsaved synthetic writing');
            if (scenario.startsWith('backup-settings-corrupt')) localStorage.setItem('wft_settings', originals.wft_settings = '{"apiKey":"synthetic-private-key",');
            if (['cache-settings-corrupt', 'cache-roster-corrupt', 'cache-deletions-corrupt', 'safe-corrupt'].includes(scenario)) {
                const key = { 'cache-settings-corrupt': 'wft_settings', 'cache-roster-corrupt': 'wft_students', 'cache-deletions-corrupt': 'wft_deletions', 'safe-corrupt': 'wft_storage_meta' }[scenario];
                originalSet.call(localStorage, key, originals[key] = '{damaged');
            }
            if (scenario.endsWith('recovery')) { wftStudentChangeRecovery = { ...originals }; localStorage.setItem('wft_portfolio', '{}'); }
            if (scenario.endsWith('unreadable')) Storage.prototype.getItem = function(k) { if (k === (scenario === 'safe-unreadable' ? 'wft_storage_meta' : 'wft_portfolio')) throw new Error('Synthetic unreadable storage'); return originalGet.call(this, k); };
            if (scenario.includes('download-error') || scenario === 'backup-fallback-error') URL.createObjectURL = () => { throw new Error('Synthetic download failure'); };
            if (scenario === 'backup-sync-throw') saveFileToDrive = () => { throw new Error('Synthetic synchronous Drive failure'); };
            if (scenario === 'backup-no-helper') saveFileToDrive = undefined;
            if (scenario.includes('remove-error') || scenario === 'cache-rollback-error') Storage.prototype.removeItem = function(k) { if (k === (scenario === 'cache-remove-error' ? 'wft_portfolio' : 'wft_storage_meta')) throw new Error('Synthetic remove failure'); return originalRemove.call(this, k); };
            if (scenario === 'cache-rollback-error') Storage.prototype.setItem = function(k, v) { if (k === 'wft_portfolio') throw new Error('Synthetic rollback failure'); return originalSet.call(this, k, v); };
            if (scenario === 'cache-idb-abort') IDBDatabase.prototype.transaction = function(...args) { const tx = originalTransaction.apply(this, args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx; };
            if (scenario === 'cache-idb-late-abort') IDBObjectStore.prototype.clear = function() { const req = originalClear.call(this); req.addEventListener('success', () => req.transaction.abort()); return req; };
            if (scenario === 'cache-idb-clear-throw') IDBObjectStore.prototype.clear = function() { if (this.name === 'studentPortfolios') throw new Error('Synthetic clear request failure'); return originalClear.call(this); };
            if (scenario.startsWith('cache-concurrent-')) IDBDatabase.prototype.transaction = function(...args) {
                const tx = originalTransaction.apply(this, args);
                if (args[1] === 'readwrite') {
                    const store = tx.objectStore(tx.objectStoreNames[0]);
                    const hold = () => { const req = store.get('keep-alive'); req.onsuccess = () => { window.clearStarted = true; if (!window.releaseClear) hold(); else if (scenario === 'cache-concurrent-abort') tx.abort(); }; };
                    hold();
                }
                return tx;
            };
            if (scenario === 'cache-idb-open-error') { WftIndexedDb.db.close(); WftIndexedDb.db = null; WftIndexedDb._ready = false; IDBFactory.prototype.open = () => { throw new Error('Synthetic IDB open failure'); }; }
            if (scenario.startsWith('safe-') && scenario.endsWith('write-error')) Storage.prototype.setItem = function(k, v) { if (k === 'wft_storage_meta') throw new Error('Synthetic safe mode write failure'); return originalSet.call(this, k, v); };
        }
        installScenarioFaults(scenario);
    }, scenario);
    await page.getByRole('button', { name: 'Open settings', exact: true }).click();
    const checks = [], check = (label, passed) => checks.push({ label, passed: !!passed });
    const dialogText = await performRecoveryAction(page, scenario, check);
    await waitForRecoveryCompletion(page, scenario);
    const observed = await page.evaluate(async () => {
        Storage.prototype.getItem = originalGet; Storage.prototype.setItem = originalSet; Storage.prototype.removeItem = originalRemove;
        IDBDatabase.prototype.transaction = originalTransaction; IDBObjectStore.prototype.clear = originalClear; IDBFactory.prototype.open = originalOpen; URL.createObjectURL = originalUrl; saveFileToDrive = originalSave;
        const contents = Object.fromEntries(Object.keys(originals).map(k => [k, localStorage.getItem(k)]));
        return { contents, originals, pendingKept: JSON.stringify(pendingPortfolioSync) === pendingBefore,
            syncKept: JSON.stringify([wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush, wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter]) === syncBefore,
            recovery: wftStudentChangeRecovery, backup: buildWftEmergencyBackupObject(), safeMode: isWftStorageSafeMode(), callbacks: backupCallbacks, concurrentBytes: window.concurrentBytes,
            idb: Object.fromEntries(await Promise.all(['metadata', 'studentPortfolios', 'thumbnails', 'portfolioIndex', 'syncQueue'].map(async s => [s, (await WftIndexedDb.getAll(s)).length]))),
            flags: [WFT_INDEXEDDB_CACHE_V1, WFT_LAZY_PORTFOLIO_LOAD_V1, WFT_STUDENT_ID_MAP_V1, WFT_ASYNC_PORTFOLIO_ACCESS_V1, WFT_SPLIT_STUDENT_FILES_V1, WFT_PORTFOLIO_INDEX_V1] };
    });
    check('default flags unchanged', JSON.stringify(observed.flags) === '[false,false,false,false,true,true]');
    check('pending full writing/photos and sync retry state retained', observed.pendingKept && observed.syncKept && observed.contents.wft_pending_portfolio_sync_v1 === observed.originals.wft_pending_portfolio_sync_v1);
    const persistedPhoto = JSON.parse(observed.contents.wft_pending_portfolio_sync_v1).sessionData.images[0];
    check('actual quota fallback persists stripped photo marker', persistedPhoto.dataUrl === '' && persistedPhoto.dataUrlRemovedForStorage === true);
    check('settings roster and deletion bytes retained', ['wft_settings', 'wft_students', 'wft_deletions'].every(k => observed.contents[k] === observed.originals[k]));
    if (scenario.startsWith('backup-')) {
        await checkBackupScenario(scenario, observed, downloads, requests, alerts, check);
    } else if (scenario.startsWith('cache-')) {
        await checkCacheScenario(page, scenario, observed, dialogText, requests, alerts, check);
    } else {
        check('safe mode matches successful persistence', observed.safeMode === (scenario === 'safe-exit-write-error'));
        check('failed safe transition visible', scenario === 'safe-toggle' || alerts.some(a => /could not|failed/i.test(a)));
        check('safe operation preserves writing', observed.contents.wft_portfolio === observed.originals.wft_portfolio);
        if (scenario !== 'safe-toggle') check('failed safe transition preserves exact metadata bytes', observed.contents.wft_storage_meta === observed.originals.wft_storage_meta);
    }
    check('no uncaught browser errors', errors.length === 0);
    cases.push({ scenario, passed: checks.every(c => c.passed), assertions: checks, observed, alerts: alerts.slice(), errors: errors.slice(), requests: requests.slice(), downloads: downloads.map(d => d.suggestedFilename()) });
    await page.close();
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of scenarios) {
            await runRecoveryScenario(browser, scenario, cases);
        }
    } finally { await browser.close(); }
    const report = { root, scenarios: cases.length, assertions: cases.reduce((n, c) => n + c.assertions.length, 0), cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    const failures = cases.filter(c => !c.passed).map(c => ({ scenario: c.scenario, assertions: c.assertions.filter(a => !a.passed) }));
    console.log(JSON.stringify({ scenarios: cases.length, assertions: report.assertions, failures }, null, 2));
    assert.equal(failures.length, 0, 'Native recovery/cache regression failures');
})().catch(e => { console.error(e); process.exitCode = 1; });
