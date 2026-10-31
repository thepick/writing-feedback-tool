const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

const serveLocalRequest = route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
        };

const prepareRecoveryScenario = scenario => {
                stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                wftConfirm = async () => true;
                window.recoveryAlerts = []; window.alert = message => recoveryAlerts.push(message);
                students = ['Alice', 'Bob']; selectedStudent = 'Alice';
                window.recoveryOriginal = {
                    wft_portfolio: JSON.stringify({ Alice: { sessions: [{ id: 'a', originalText: 'Exact original writing', images: [] }] }, Bob: { sessions: [{ id: 'b', originalText: 'Bob writing', images: [] }] } }),
                    wft_students: JSON.stringify(students), wft_selectedStudent: 'Alice',
                    wft_settings: JSON.stringify({ students, unknown: 'keep' }),
                    [WFT_DELETIONS_STORAGE_KEY]: JSON.stringify({ deletedStudents: { 'student:earlier': { studentName: 'Earlier', deletedAt: '2026-10-01T00:00:00Z' } } })
                };
                Object.entries(recoveryOriginal).forEach(([key, value]) => localStorage.setItem(key, value));
                renderStudentList(); populateStudentDropdown();
                const draftOwners = scenario === 'portfolio-restore' ? ['Alice'] : students.concat('');
                draftOwners.forEach(owner => {
                    const key = wftWritingDraftKey(owner);
                    recoveryOriginal[key] = localStorage.getItem(key);
                });
                pendingPortfolioSync = { studentName: 'Bob', sessionData: { id: 'new', originalText: 'Pending writing' }, signature: 'pending' };
                persistPendingPortfolioSync();
                wftSyncState.pendingPortfolioPush = true;
                wftSyncState.pendingSettingsPush = true;
                wftSyncState.pendingDeletionsPush = true;
                window.recoveryCounters = [wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter];
                window.recoverySetItem = Storage.prototype.setItem;
                const writes = {};
                Storage.prototype.setItem = function(key, value) {
                    writes[key] = (writes[key] || 0) + 1;
                    if (scenario === 'portfolio-restore' && (key === WFT_DELETIONS_STORAGE_KEY || (key === 'wft_portfolio' && writes[key] > 1))) throw new DOMException('Simulated failure', 'QuotaExceededError');
                    if (scenario === 'marker-restore' && (key === 'wft_settings' || (key === WFT_DELETIONS_STORAGE_KEY && writes[key] > 1))) throw new DOMException('Simulated failure', 'QuotaExceededError');
                    return recoverySetItem.call(this, key, value);
                };
            };

const beginRecoveryUpload = async scenario => {
                let releaseUpload, uploadStarted;
                const started = new Promise(resolve => { uploadStarted = resolve; });
                const upload = new Promise(resolve => { releaseUpload = resolve; });
                window.recoveryReleaseUpload = releaseUpload;
                findWftFilesByNamePromise = async () => [];
                uploadWftJsonFilePromise = () => { uploadStarted(); return upload; };
                window.recoveryPreviousHash = scenario === 'portfolio-restore' ? wftSyncState.lastSyncedPortfolioHash : wftSyncState.lastSyncedSettingsHash;
                window.recoveryInFlight = (scenario === 'portfolio-restore' ? syncWftPortfolioIfNeeded('test') : syncWftSettingsIfNeeded('test')).then(() => false, () => true);
                await started;
            };

const inspectFailedRecovery = async scenario => {
                recoveryReleaseUpload('synthetic-file');
                const inFlightBlocked = await recoveryInFlight;
                const hashKept = recoveryPreviousHash === (scenario === 'portfolio-restore' ? wftSyncState.lastSyncedPortfolioHash : wftSyncState.lastSyncedSettingsHash);
                const backup = buildWftEmergencyBackupObject();
                let driveCalls = 0;
                findWftFilesByNamePromise = async () => { driveCalls++; return []; };
                ensureDriveFolderPromise = async () => { driveCalls++; return 'fake-folder'; };
                uploadWftJsonFilePromise = async () => { driveCalls++; return 'fake-file'; };
                wftSyncState.signedIn = true; wftSyncState.accessToken = 'synthetic';
                driveAccessToken = 'synthetic'; wftSyncState.tokenExpiresAt = Date.now() + 60000;
                const synced = await syncWftNow('manual', { immediate: true });
                let directBlocked = false;
                try { await syncWftPortfolioIfNeeded('manual'); } catch (e) { directBlocked = true; }
                let otherStreamsBlocked = 0;
                for (const sync of [syncWftSettingsIfNeeded, syncWftDeletionsIfNeeded, syncWftPortfolioIndexIfNeeded]) {
                    try { await sync('manual'); } catch (e) { otherStreamsBlocked++; }
                }
                return { alert: recoveryAlerts[0], backup, original: recoveryOriginal, driveCalls, synced, directBlocked,
                    inFlightBlocked, hashKept, otherStreamsBlocked,
                    portfolio: getPortfolioData(), deletions: getDeletionsData(), roster: students, selected: selectedStudent,
                    countersKept: JSON.stringify(recoveryCounters) === JSON.stringify([wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter]),
                    pendingFlags: [wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush],
                    pending: !!getPendingPortfolioSync(), restoredPortfolio: localStorage.getItem('wft_portfolio') === recoveryOriginal.wft_portfolio };
            };

function assertRecoveryWarning(failed) {
            assert.match(failed.alert, /emergency backup/i);
            assert.match(failed.alert, /keep.*tab.*open/i);
            assert.doesNotMatch(failed.alert, /have been kept/i, 'Do not promise successful disk restoration');
}

function assertRecoveredWriting(failed) {
            assert.equal(failed.backup.contents.wft_portfolio.Alice.sessions[0].originalText, 'Exact original writing');
            assert.deepEqual(failed.backup.studentChangeRecovery, failed.original, 'Backup retains exact raw recovery bytes');
            assert.equal(failed.portfolio.Alice.sessions[0].originalText, 'Exact original writing');
            assert.ok(failed.deletions.deletedStudents['student:earlier']);
            assert.deepEqual(failed.roster, ['Alice', 'Bob']);
            assert.equal(failed.selected, 'Alice');
}

function assertRecoverySyncPaused(failed, scenario) {
            assert.equal(failed.driveCalls, 0, 'Neither manual nor direct sync may publish partial state');
            assert.equal(failed.synced, false);
            assert.equal(failed.directBlocked, true);
            assert.equal(failed.inFlightBlocked, true, 'A delayed upload must not acknowledge a failed local recovery');
            assert.equal(failed.hashKept, true);
            assert.equal(failed.otherStreamsBlocked, 3);
            assert.equal(failed.countersKept, true);
            assert.deepEqual(failed.pendingFlags, [true, true, true]);
            assert.equal(failed.pending, true);
            if (scenario === 'marker-restore') assert.equal(failed.restoredPortfolio, true, 'Continue restoring other keys after one restoration fails');
}

function assertSuccessfulRetry(retry, scenario, alertsBeforeRetry) {
            assert.equal(retry.portfolio.Alice, undefined);
            if (scenario === 'portfolio-restore') assert.equal(retry.portfolio.Bob.sessions[0].originalText, 'Bob writing');
            else assert.deepEqual(retry.portfolio, {});
            assert.equal(retry.backup.studentChangeRecovery, undefined, 'Clear recovery only after storage is restored');
            assert.equal(retry.pending, true);
            assert.equal(retry.alerts, alertsBeforeRetry, 'Successful retry adds no failure alert');
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const scenario of ['portfolio-restore', 'marker-restore']) {
            const context = await browser.newContext({ acceptDownloads: true });
            await context.route('**/*', serveLocalRequest);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(prepareRecoveryScenario, scenario);
            await page.evaluate(beginRecoveryUpload, scenario);
            await page.evaluate(async scenario => { if (scenario === 'portfolio-restore') await removeStudent('Alice'); else await resetCurrentClassData(); }, scenario);
            const failed = await page.evaluate(inspectFailedRecovery, scenario);
            assertRecoveryWarning(failed);
            assertRecoveredWriting(failed);
            assertRecoverySyncPaused(failed, scenario);
            const downloadPromise = page.waitForEvent('download');
            await page.locator('button[onclick="downloadWftEmergencyBackup()"]').evaluate(button => button.click());
            const downloaded = await downloadPromise;
            const exported = JSON.parse(fs.readFileSync(await downloaded.path(), 'utf8'));
            assert.deepEqual(exported.studentChangeRecovery, failed.original);
            const alertsBeforeRetry = await page.evaluate(() => recoveryAlerts.length);
            await page.evaluate(() => { Storage.prototype.setItem = recoverySetItem; driveAccessToken = ''; wftSyncState.signedIn = false; wftSyncState.accessToken = ''; });
            await page.evaluate(async scenario => { if (scenario === 'portfolio-restore') await removeStudent('Alice'); else await resetCurrentClassData(); }, scenario);
            const retry = await page.evaluate(() => ({ portfolio: getPortfolioData(), backup: buildWftEmergencyBackupObject(), pending: !!getPendingPortfolioSync(), alerts: recoveryAlerts.length }));
            assertSuccessfulRetry(retry, scenario, alertsBeforeRetry);
            assert.deepEqual(errors, []);
            await context.close();
        }
        console.log('Deletion recovery browser cases: 2/2 passed; failed rollbacks preserve exact emergency backup bytes, block sync, restore remaining keys and allow retry.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
