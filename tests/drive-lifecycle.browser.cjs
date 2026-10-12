const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const scenarios = ['fetch-401', 'fetch-permission', 'fetch-quota', 'fetch-rate', 'fetch-404', 'fetch-malformed', 'fetch-network', 'fetch-offline', 'fetch-expired', 'fetch-url', 'fetch-redaction',
    'xhr-403', 'xhr-quota', 'xhr-401', 'xhr-malformed', 'xhr-network', 'backup-folder-error', 'backup-offline', 'backup-empty', 'legacy-read-error', 'legacy-read-offline', 'legacy-no-token',
    'manual-success', 'manual-permission', 'manual-quota', 'manual-401', 'manual-network', 'manual-empty', 'manual-offline', 'manual-newer', 'manual-expired', 'manual-no-writer', 'manual-redaction',
    'split-stale', 'split-poison', 'split-poison-null', 'split-poison-undefined', 'split-wrong-parent', 'split-cache-permission', 'split-root-poison', 'split-token-folder', 'split-token-upload', 'index-malformed', 'index-error', 'index-shape', 'index-success',
    'poll-lifecycle', 'poll-expired', 'poll-hidden', 'poll-visible', 'poll-blocks', 'legacy-timer', 'broadcast'];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of scenarios) {
            const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage();
            const errors = [], logs = [], requests = [], alerts = [], downloads = [], checks = [];
            let failing = true, changed = false;
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => logs.push(m.text()));
            page.on('dialog', async d => { alerts.push(d.message()); await d.accept(); });
            page.on('download', d => downloads.push(d));
            await context.route('**/*', async route => {
                const req = route.request(), url = new URL(req.url()), query = url.searchParams.get('q') || '';
                const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: typeof data === 'string' ? data : JSON.stringify(data) });
                if (url.origin === 'http://127.0.0.1:8765') {
                    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : reply('', 404);
                }
                if (url.origin !== 'https://www.googleapis.com') return route.abort();
                if (req.method() === 'OPTIONS') return reply('', 204);
                requests.push({ url: url.href, method: req.method(), body: req.postData(), token: req.headers().authorization });
                if (url.pathname.endsWith('/probe')) {
                    if (scenario === 'fetch-network') return route.abort();
                    const status = scenario === 'fetch-401' ? 401 : scenario === 'fetch-404' ? 404 : scenario === 'fetch-malformed' ? 500 : 403;
                    if (scenario === 'fetch-malformed') return reply('{broken', status);
                    return reply({ error: { code: status, message: scenario === 'fetch-redaction' ? 'access_token=ya29.synthetic-secret Authorization: Bearer ya29.synthetic-secret' : 'Synthetic refusal', errors: [{ reason: scenario === 'fetch-quota' ? 'storageQuotaExceeded' : scenario === 'fetch-rate' ? 'rateLimitExceeded' : 'permissionDenied' }] } }, status);
                }
                if (failing && scenario === 'backup-folder-error' && query.includes("name='WritingFeedbackTool'")) return reply({}, 403);
                if (scenario.startsWith('xhr-') && req.method() === 'POST' && !url.pathname.startsWith('/upload/')) {
                    if (scenario === 'xhr-network') return route.abort();
                    return reply(scenario === 'xhr-malformed' ? '{broken' : { error: { message: 'Synthetic folder refusal', errors: [{ reason: scenario === 'xhr-quota' ? 'storageQuotaExceeded' : 'permissionDenied' }] } }, scenario === 'xhr-401' ? 401 : scenario === 'xhr-malformed' ? 200 : 403);
                }
                if (!changed && ((scenario === 'split-token-folder' && req.method() === 'POST' && !url.pathname.startsWith('/upload/')) || (scenario === 'split-token-upload' && url.pathname.startsWith('/upload/')))) {
                    changed = true;
                    await page.evaluate(() => { driveAccessToken = wftSyncState.accessToken = 'synthetic-other-account'; });
                }
                if (url.pathname.startsWith('/upload/')) {
                    if (!changed && scenario === 'manual-newer') {
                        changed = true;
                        await page.evaluate(() => { pendingPortfolioSync = { studentName: 'Synthetic', signature: 'newer', sessionData: { id: 'newer', originalText: 'Newer pending exact writing', images: [] } }; persistPendingPortfolioSync(); });
                    }
                    if (failing && ['manual-permission', 'manual-quota', 'manual-401', 'manual-network', 'manual-redaction'].includes(scenario)) {
                        if (scenario === 'manual-network') return route.abort();
                        return reply({ error: { message: scenario === 'manual-redaction' ? 'access_token=ya29.synthetic-secret Authorization: Bearer ya29.synthetic-secret' : 'Synthetic refusal', errors: [{ reason: scenario === 'manual-quota' ? 'storageQuotaExceeded' : 'permissionDenied' }] } }, scenario === 'manual-401' ? 401 : 403);
                    }
                    if (failing && ['manual-empty', 'backup-empty'].includes(scenario)) return reply({});
                    if (failing && scenario === 'split-stale' && (req.postData() || '').includes('stale-students')) return reply({}, 404);
                    return reply({ id: 'saved-file' });
                }
                if (url.searchParams.get('alt') === 'media') {
                    if (scenario === 'legacy-read-error' || scenario === 'index-error') return reply({ error: { message: 'Synthetic permission refusal' } }, 403);
                    if (scenario === 'index-malformed') return reply('{broken');
                    if (scenario === 'index-shape') return reply({ format: 'portfolio-index-v1' });
                    return reply(scenario.startsWith('index-') ? { format: 'portfolio-index-v1', students: { Synthetic: {} } } : { Synthetic: { sessions: [] } });
                }
                if (req.method() === 'POST') return reply({ id: 'students-folder' });
                if (query) {
                    if (query.includes("name='WritingFeedbackTool'")) return reply({ files: [{ id: 'root-folder' }] });
                    if (query.includes("name='students'")) return reply({ files: [] });
                    if (query.includes("name='portfolio-index.json'") || (scenario === 'legacy-read-error' && query.includes("name='wft-portfolio.json'"))) return reply({ files: [{ id: 'index-file' }] });
                    return reply({ files: [] });
                }
                if (url.pathname.endsWith('/root-folder')) return reply({ id: 'root-folder', name: 'WritingFeedbackTool', mimeType: 'application/vnd.google-apps.folder', trashed: false });
                if (url.pathname.endsWith('/stale-students')) return reply({}, 404);
                if (url.pathname.endsWith('/students-folder') && failing && scenario === 'split-cache-permission') return reply({ error: { message: 'Synthetic cached folder permission refusal' } }, 403);
                if (url.pathname.endsWith('/students-folder') && failing && scenario === 'split-wrong-parent') return reply({ id: 'students-folder', name: 'students', parents: ['wrong-root'], mimeType: 'application/vnd.google-apps.folder', trashed: false });
                return reply({ id: 'students-folder', name: 'students', parents: ['root-folder'], mimeType: 'application/vnd.google-apps.folder', trashed: false });
            });
            await page.clock.install();
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
            await page.evaluate(scenario => {
                stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); sessionStorage.clear();
                localStorage.setItem('wft_settings', '{}'); localStorage.setItem('wft_students', '["Synthetic"]'); localStorage.setItem('wft_deletions', '{"records":[]}');
                localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', createdAt: '2026-10-01T00:00:00Z', originalText: 'Saved exact writing', images: [] }] } }));
                students = ['Synthetic']; pendingPortfolioSync = null; wftSyncState.pendingPortfolioPush = false; wftSyncState.pendingSettingsPush = false; wftSyncState.pendingDeletionsPush = false;
                driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 600000;
                driveFolderId = wftSyncState.folderId = 'root-folder'; clearWftSyncBlockState(); wftSyncState.lastPollAt = 0;
                window.originalBytes = localStorage.getItem('wft_portfolio'); window.callbackResults = [];
                window.defaultFlags = { debug: WFT_DEBUG, syncDebug: WFT_SYNC_DEBUG, v2: WFT_SYNC_ENGINE_V2, split: WFT_SPLIT_STUDENT_FILES_V1, index: WFT_PORTFOLIO_INDEX_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, idb: WFT_INDEXEDDB_CACHE_V1, identity: WFT_STUDENT_ID_MAP_V1 };
                if (scenario.startsWith('manual-')) { pendingPortfolioSync = { studentName: 'Synthetic', signature: 'pending', sessionData: { id: 'pending', createdAt: '2026-10-12T00:00:00Z', originalText: 'Pending exact writing', images: [] } }; persistPendingPortfolioSync(); updateSyncPortfolioButtonState(); }
                if (scenario === 'backup-folder-error') driveFolderId = wftSyncState.folderId = '';
                if (scenario === 'split-stale' || scenario === 'split-poison') localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, scenario === 'split-stale' ? 'stale-students' : '  ');
                if (scenario === 'split-poison-null' || scenario === 'split-poison-undefined') localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, scenario === 'split-poison-null' ? 'null' : 'undefined');
                if (scenario === 'split-wrong-parent' || scenario === 'split-cache-permission') localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, 'students-folder');
                if (scenario === 'split-root-poison') driveFolderId = wftSyncState.folderId = 'undefined';
                if (['fetch-expired', 'poll-expired', 'manual-expired'].includes(scenario)) wftSyncState.tokenExpiresAt = Date.now() - 1;
                if (scenario === 'legacy-no-token') driveAccessToken = wftSyncState.accessToken = '';
                if (scenario === 'fetch-redaction') WFT_SYNC_DEBUG = true;
                if (scenario === 'manual-redaction') WFT_DEBUG = true;
                window.originalSaveFile = saveFileToDrive;
                if (scenario === 'manual-no-writer') saveFileToDrive = undefined;
            }, scenario);
            const check = (name, condition) => checks.push({ name, passed: !!condition });
            const finishManual = async () => {
                for (let i = 0; i < 40; i++) {
                    await page.clock.runFor(1000);
                    await page.waitForFunction(() => !manualSyncInProgress, null, { timeout: 100 }).catch(() => {});
                    if (await page.evaluate(() => !manualSyncInProgress)) return;
                }
                throw new Error('Manual save did not reach its production completion signal');
            };
            if (scenario.includes('offline')) await context.setOffline(true);
            if (scenario.startsWith('fetch-')) {
                const r = await page.evaluate(async scenario => { try { await wftDriveFetch(scenario === 'fetch-url' ? 'https://example.invalid/probe' : 'https://www.googleapis.com/drive/v3/files/probe'); return {}; } catch (e) { return { message: e.message, status: e.status, reason: e.reason, notFound: e.notFound, auth: wftSyncState.authBlocked, quota: wftSyncState.quotaBlocked, permission: wftSyncState.permissionBlocked }; } }, scenario);
                check('fetch rejects through native response boundary', !!r.message);
                check('status classification', scenario === 'fetch-401' ? r.auth : ['fetch-quota', 'fetch-rate'].includes(scenario) ? r.quota : scenario === 'fetch-404' ? r.notFound : ['fetch-permission', 'fetch-redaction'].includes(scenario) ? r.permission : true);
                check('offline expired and blocked URL emit no API request', !['fetch-offline', 'fetch-expired', 'fetch-url'].includes(scenario) || requests.length === 0);
                if (scenario === 'fetch-redaction') check('debug logs redact synthetic token', !logs.join('\n').includes('ya29.synthetic-secret'));
            } else if (scenario.startsWith('xhr-')) {
                const r = await page.evaluate(async () => { try { await createWftSubfolder('students', 'root-folder'); return {}; } catch (e) { return { message: e.message, status: e.status, reason: e.reason }; } });
                check('native XHR rejects error response', !!r.message); check('XHR emitted metadata', requests.some(r => r.body && JSON.parse(r.body).parents[0] === 'root-folder'));
                if (['xhr-403', 'xhr-quota', 'xhr-401'].includes(scenario)) check('XHR retains Google status and reason', r.status === (scenario === 'xhr-401' ? 401 : 403) && r.reason === (scenario === 'xhr-quota' ? 'storageQuotaExceeded' : 'permissionDenied'));
            } else if (scenario.startsWith('backup-') || scenario.startsWith('legacy-') && scenario !== 'legacy-timer') {
                await page.evaluate(scenario => { const cb = (...args) => callbackResults.push(args.map(a => a instanceof Error ? { error: a.message } : a)); if (scenario.startsWith('backup-')) saveWftPreMigrationBackupToDrive(cb); else readJsonFileFromDrive('wft-portfolio.json', cb); }, scenario);
                await page.clock.runFor(3000);
                await page.waitForFunction(() => callbackResults.length > 0, null, { timeout: 1500 }).catch(() => {});
                const r = await page.evaluate(() => callbackResults);
                check('legacy callback settles once', r.length === 1);
                if (scenario.startsWith('backup-')) {
                    check('failed backup downloads fallback', downloads.length === 1); check('fallback is disclosed', r[0] && r[0][1] === 'fallback-local');
                    if (downloads.length) { const backup = JSON.parse(fs.readFileSync(await downloads[0].path(), 'utf8')); check('download retains exact writing', JSON.stringify(backup).includes('Saved exact writing')); }
                }
                else check('failed legacy read returns no error JSON as writing', r[0] && r[0][0] === null);
            } else if (scenario.startsWith('manual-')) {
                await page.locator('#syncPortfolioBtnBottom').click();
                await finishManual();
                let r = await page.evaluate(() => ({ pending: getPendingPortfolioSync(), push: wftSyncState.pendingPortfolioPush, text: document.getElementById('syncPortfolioBtnBottom').textContent, disabled: document.getElementById('syncPortfolioBtnBottom').disabled, bytes: localStorage.getItem('wft_portfolio') }));
                check('saved and committed writing retained', r.bytes.includes('Saved exact writing') && r.bytes.includes('Pending exact writing'));
                if (scenario === 'manual-newer') check('newer edit stays pending with ready UI', r.pending && r.pending.signature === 'newer' && !r.disabled);
                else if (scenario === 'manual-success') check('success acknowledged', !r.push && !r.pending);
                else {
                    check('failed cloud save stays dirty and offers retry', r.push && /Retry/.test(r.text) && !r.disabled);
                    if (scenario === 'manual-redaction') check('legacy debug error logs redact synthetic token', !logs.join('\n').includes('ya29.synthetic-secret'));
                    failing = false; await context.setOffline(false); await page.evaluate(() => { wftSyncState.tokenExpiresAt = Date.now() + 600000; saveFileToDrive = originalSaveFile; });
                    if (!r.disabled) { await page.locator('#syncPortfolioBtnBottom').click(); await finishManual(); }
                    check('actual retry clears cloud dirty state', await page.evaluate(() => !wftSyncState.pendingPortfolioPush));
                }
                check('multipart contains pending writing', scenario === 'manual-offline' || requests.some(r => r.body && r.body.includes('Pending exact writing')));
            } else if (scenario.startsWith('split-')) {
                const invoke = () => page.evaluate(() => new Promise(resolve => saveStudentFileToDrive('synthetic-id', { displayName: 'Synthetic', sessions: [{ id: 'split', originalText: 'Split exact writing', images: [] }] }, (err, id) => resolve({ error: err && err.message, id, cached: localStorage.getItem('wft_drive_student_file_synthetic-id') }))));
                const r = await invoke();
                if (scenario.includes('token')) { check('changed account refuses acknowledgement', !!r.error && !r.cached); if (scenario.endsWith('folder')) check('changed account never uploads', !requests.some(r => r.url.includes('/upload/'))); }
                else {
                    if (scenario === 'split-cache-permission') check('permission failure preserves cache and refuses upload', !!r.error && !r.cached && requests.every(r => !r.url.includes('/upload/')));
                    else check('stale or poisoned folder recovers', !r.error && r.id === 'saved-file');
                    failing = false; const retry = await invoke(); check('retry succeeds on usable parent', !retry.error);
                    check('uploads avoid invalid parent', !requests.some(r => r.body && (r.body.includes('stale-students') || r.body.includes('"parents":["  "]') || r.body.includes('"parents":["null"]') || r.body.includes('"parents":["undefined"]'))));
                }
            } else if (scenario.startsWith('index-')) {
                await page.locator('button', { hasText: 'Reload Index from Drive' }).evaluate(b => b.click());
                await page.waitForFunction(() => document.readyState === 'complete');
                for (let i = 0; i < 50 && !alerts.length; i++) await page.waitForTimeout(20);
                check('index UI reports result', scenario === 'index-success' ? alerts.some(a => /1 students/.test(a)) : alerts.some(a => /could not|failed|invalid/i.test(a)));
            } else if (scenario === 'broadcast') {
                const other = await context.newPage(); await other.goto('http://127.0.0.1:8765');
                const available = await page.evaluate(() => !!wftSyncChannel);
                check('shipped lifecycle retains broadcast channel after signed-out startup', available);
                if (available) {
                    const synced = await page.evaluate(() => syncWftNow('manual', { immediate: true }));
                    const timestamp = await page.evaluate(() => wftSyncState.lastPollAt);
                    await other.waitForFunction(ts => wftSyncState.lastPollAt === ts, timestamp);
                    check('shipped completed sync reaches real same-origin channel', synced && timestamp > 0 && await other.evaluate(ts => wftSyncState.lastPollAt === ts, timestamp));
                    await page.evaluate(() => wftSyncChannel.postMessage({ type: 'sync-complete', ts: 'invalid' }));
                    check('invalid broadcast cannot change received timestamp', await other.evaluate(ts => wftSyncState.lastPollAt === ts, timestamp));
                }
                await other.close();
            } else if (scenario === 'legacy-timer') {
                await page.evaluate(() => startDriveAutoSync()); await page.clock.runFor(60000); await page.waitForFunction(() => !!getCachedWftDriveFileId('wft-settings.json'));
                check('legacy timer emits actual settings save', requests.some(r => r.url.includes('/upload/')));
                await page.evaluate(() => stopDriveAutoSync()); const n = requests.length; await page.clock.runFor(60000); check('legacy timer stops', requests.length === n);
            } else {
                if (scenario === 'poll-hidden' || scenario === 'poll-visible') await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
                if (scenario === 'poll-blocks') {
                    const r = await page.evaluate(() => { const values = {}; for (const key of ['isSyncing', 'explicitSaveInProgress', 'imageUploadInProgress', 'quotaBlocked', 'permissionBlocked', 'authBlocked']) { wftSyncState[key] = true; values[key] = shouldPollWftCloudNow(); wftSyncState[key] = false; } driveAccessToken = ''; wftSyncState.accessToken = ''; values.signedOut = shouldPollWftCloudNow(); return values; });
                    check('poll gates writer, media, block and signed-out states', Object.values(r).every(v => v === false));
                } else if (scenario === 'poll-hidden') {
                    check('existing hidden-page polling remains eligible', await page.evaluate(() => shouldPollWftCloudNow()));
                    await page.evaluate(() => startWftSyncPolling()); await page.clock.runFor(60000);
                    await page.waitForFunction(() => wftSyncState.lastPollAt > 0 && !wftSyncState.isSyncing);
                    check('hidden lifecycle preserves snapshots and completes native poll', requests.length > 0);
                } else if (scenario === 'poll-visible') {
                    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
                    await page.evaluate(async () => { if (wftSyncState.currentSyncPromise) await wftSyncState.currentSyncPromise; });
                    check('visible lifecycle performs native sync', requests.length > 0);
                } else {
                    if (scenario !== 'poll-lifecycle') check('ineligible environment fails production polling gate before timer', await page.evaluate(() => !shouldPollWftCloudNow()));
                    await page.evaluate(() => { startWftSyncPolling(); startWftSyncPolling(); }); await page.clock.runFor(60000);
                    if (scenario !== 'poll-lifecycle') {
                        check('ineligible environment fails production polling gate', await page.evaluate(() => !shouldPollWftCloudNow()));
                        check('ineligible timer emits no request', requests.length === 0);
                    }
                    else {
                        await page.waitForFunction(() => wftSyncState.lastPollAt > 0 && !wftSyncState.isSyncing);
                        const runId = await page.evaluate(() => wftSyncState.syncRunId);
                        check('repeated start retains one timer and real poll completes', requests.length > 0 && runId === 1); await page.evaluate(() => stopWftSyncPolling()); const n = requests.length; await page.clock.runFor(60000); check('poll timer stops', await page.evaluate(() => wftSyncState.syncRunId) === runId);
                        await context.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline'))); check('offline visible in UI', await page.evaluate(() => document.body.textContent.includes('Offline - will sync later')));
                        await context.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.evaluate(async () => { if (wftSyncState.currentSyncPromise) await wftSyncState.currentSyncPromise; }); check('online handler performs real sync', requests.length > n);
                    }
                }
            }
            const state = await page.evaluate(() => ({ bytes: localStorage.getItem('wft_portfolio'), original: originalBytes, flags: defaultFlags }));
            check('original writing survives', state.bytes && state.bytes.includes('Saved exact writing'));
            if (!scenario.startsWith('manual-') && !scenario.startsWith('poll-') && scenario !== 'broadcast') check('read failures and split operations preserve exact primary bytes', state.bytes === state.original);
            check('default optional flags unchanged', state.flags.v2 && state.flags.split && state.flags.index && !state.flags.debug && !state.flags.syncDebug && !state.flags.lazy && !state.flags.idb && !state.flags.identity);
            check('no uncaught browser errors', errors.length === 0);
            cases.push({ scenario, passed: checks.every(c => c.passed), checks, errors, alerts, requests, downloads: downloads.map(d => d.suggestedFilename()) });
            console.log(scenario + ': ' + (cases.at(-1).passed ? 'pass' : 'FAIL'));
            await context.close();
        }
    } finally { await browser.close(); }
    const report = { root, scenarios: cases.length, assertions: cases.reduce((n, c) => n + c.checks.length, 0), cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    const failures = cases.filter(c => !c.passed).map(c => ({ scenario: c.scenario, checks: c.checks.filter(a => !a.passed) }));
    console.log(JSON.stringify({ scenarios: cases.length, assertions: report.assertions, failures }, null, 2)); assert.equal(failures.length, 0);
})().catch(e => { console.error(e); process.exitCode = 1; });
