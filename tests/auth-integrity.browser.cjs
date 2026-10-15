const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    let lastObserved;
    async function pageFor(seed, fragment = '') {
        const page = await browser.newPage();
        await page.route('**/*', route => {
            const u = new URL(route.request().url());
            if (u.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        if (seed) await page.addInitScript(seed);
        await page.goto('http://127.0.0.1:8765' + fragment, { waitUntil: 'load' });
        await page.evaluate(() => {
            stopWftSyncPolling(); stopDriveAutoSync();
            scheduleWftCloudSync = scheduleWftDriveSync = startWftSyncPolling = () => {};
            syncWftNow = () => Promise.resolve(false); syncAllToDrive = callback => { if (callback) callback(); };
            fetch = async () => new Response('{}');
        });
        return page;
    }
    async function run(name, fn) {
        lastObserved = undefined;
        try { await fn(); cases.push({ name, passed: true, observed: lastObserved }); }
        catch (error) { cases.push({ name, passed: false, error: error.message, observed: lastObserved }); }
        console.log((cases.at(-1).passed ? 'PASS ' : 'FAIL ') + name);
    }
    try {
        async function checkDraftRecovery() {
            const page = await pageFor();
            function draftScenarioCases() {
                const cases = [], set = Storage.prototype.setItem, get = Storage.prototype.getItem, remove = Storage.prototype.removeItem;
                const ta = document.getElementById('studentWriting'), select = document.getElementById('studentSelect'), genre = document.getElementById('writingGenreSelect');
                const check = (condition, message) => { if (!condition) throw new Error(message); };
                function reset() {
                    Storage.prototype.setItem = set; Storage.prototype.getItem = get; Storage.prototype.removeItem = remove;
                    localStorage.clear(); sessionStorage.clear(); ta.value = ''; selectedStudent = ''; manualGenreOverrideValue = '__auto__'; genre.value = '__auto__';
                    select.innerHTML = '<option value=""></option><option value="Alice">Alice</option><option value="Bob">Bob</option>';
                }
                function run(name, fn) { reset(); try { fn(); cases.push({ name, passed: true }); } catch (e) { cases.push({ name, passed: false, error: e.message }); } finally { reset(); } }
                const draft = { text: 'Synthetic draft writing', selectedStudent: 'Alice', manualGenreOverrideValue: 'narrative', writingGenreSelectValue: 'narrative' };
                const raw = JSON.stringify(draft);
                function checkDraftRestoration() {
                    run('shipped optional defaults', () => check(WFT_SPLIT_STUDENT_FILES_V1 && !WFT_STUDENT_ID_MAP_V1 && !WFT_LAZY_PORTFOLIO_LOAD_V1 && !WFT_INDEXEDDB_CACHE_V1 && !WFT_TOMBSTONE_COMPACTION_V1, 'defaults'));
                    for (const damaged of ['{unreadable synthetic writing', JSON.stringify({ text: { writing: 'Synthetic text' } }), JSON.stringify({ text: 'Synthetic text', selectedStudent: {} }), JSON.stringify({ text: 'Synthetic text', manualGenreOverrideValue: [] })]) run('unreadable draft retained ' + damaged.length, () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, damaged);
                        check(restoreWftOAuthDraftAfterRedirect() === false, 'failure returned');
                        check(localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === damaged && !ta.value, 'raw bytes recoverable');
                        check(document.getElementById('ocrStatus').textContent.includes('recover'), 'useful error');
                    });
                    run('valid draft restores actual fields and consumes once', () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw);
                        check(restoreWftOAuthDraftAfterRedirect() === true, 'restored');
                        check(ta.value === draft.text && selectedStudent === 'Alice' && select.value === 'Alice', 'writing/student coherence');
                        check(manualGenreOverrideValue === 'narrative' && genre.value === 'narrative', 'genre coherence');
                        check(!localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY), 'consumed after restore');
                        check(restoreWftOAuthDraftAfterRedirect() === false && ta.value === draft.text, 'no duplicate restoration');
                    });
                }
                checkDraftRestoration();
                function checkDraftStorageFailures() {
                    for (const failure of ['read', 'remove', 'selection-hint']) run('draft ' + failure + ' failure and retry', () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw);
                        Storage.prototype.getItem = function(key) { if (key === WFT_OAUTH_TEXTAREA_DRAFT_KEY && failure === 'read') throw new Error('Synthetic read failure'); return get.call(this, key); };
                        Storage.prototype.removeItem = function(key) { if (key === WFT_OAUTH_TEXTAREA_DRAFT_KEY && failure === 'remove') throw new Error('Synthetic remove failure'); return remove.call(this, key); };
                        Storage.prototype.setItem = function(key, value) { if (key === 'wft_selectedStudent' && failure === 'selection-hint') throw new Error('Synthetic hint failure'); return set.call(this, key, value); };
                        const result = restoreWftOAuthDraftAfterRedirect();
                        if (failure === 'selection-hint') check(result === true && ta.value === draft.text && !get.call(localStorage, WFT_OAUTH_TEXTAREA_DRAFT_KEY), 'optional hint not required to consume');
                        else {
                            check(result === false && get.call(localStorage, WFT_OAUTH_TEXTAREA_DRAFT_KEY) === raw, 'failed bytes retained');
                            if (failure === 'remove') check(ta.value === draft.text && selectedStudent === 'Alice', 'writing restored before removal');
                            Storage.prototype.getItem = get; Storage.prototype.removeItem = remove;
                            check(restoreWftOAuthDraftAfterRedirect() === true && !localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY), 'retry consumes safely');
                        }
                    });
                }
                checkDraftStorageFailures();
                function checkDraftOccupancy() {
                    for (const current of ['Current synthetic writing', '   ']) run('occupied textarea preserved ' + current.length, () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw); ta.value = current; selectedStudent = 'Bob'; select.value = 'Bob'; genre.value = 'opinion'; manualGenreOverrideValue = 'opinion';
                        check(restoreWftOAuthDraftAfterRedirect() === false, 'occupied not restored');
                        check(ta.value === current && selectedStudent === 'Bob' && select.value === 'Bob' && manualGenreOverrideValue === 'opinion' && genre.value === 'opinion', 'current coherent');
                        check(localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === raw, 'unconsumed retained');
                        check(!document.getElementById('ocrStatus').textContent.includes('Restored'), 'no false success');
                        ta.value = ''; check(restoreWftOAuthDraftAfterRedirect() === true && ta.value === draft.text, 'explicit retry after clearing');
                    });
                    for (const text of ['', '   ']) run('empty/whitespace draft consumes supported bytes ' + text.length, () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify({ ...draft, text }));
                        check(restoreWftOAuthDraftAfterRedirect() === true && ta.value === text && selectedStudent === 'Alice', 'supported empty bytes/selection restored');
                        check(!localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY), 'consumed');
                    });
                    run('no draft is inert', () => check(restoreWftOAuthDraftAfterRedirect() === false && ta.value === '' && selectedStudent === '', 'no draft'));
                    run('missing recovered student represented without resurrecting roster', () => {
                        select.innerHTML = '<option value=""></option>'; students = [];
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw);
                        check(restoreWftOAuthDraftAfterRedirect() === true && selectedStudent === 'Alice' && select.value === 'Alice' && students.length === 0, 'recovered selection coherent');
                    });
                    run('same text under different current student/genre is occupied', () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw); ta.value = draft.text; selectedStudent = 'Bob'; select.value = 'Bob'; manualGenreOverrideValue = 'opinion'; genre.value = 'opinion';
                        check(restoreWftOAuthDraftAfterRedirect() === false && selectedStudent === 'Bob' && genre.value === 'opinion' && localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === raw, 'current owner preserved');
                    });
                }
                checkDraftOccupancy();
                function checkDraftPreservation() {
                    for (const text of ['Synthetic unsaved writing', '   ', '']) run('draft save exact bytes ' + text.length, () => {
                        ta.value = text; selectedStudent = 'Alice'; select.value = 'Alice'; genre.value = 'narrative'; manualGenreOverrideValue = 'narrative';
                        check(saveWftOAuthDraftBeforeRedirect('sync') === true, 'required save succeeds');
                        const saved = JSON.parse(localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY));
                        check(saved.text === text && saved.selectedStudent === 'Alice' && saved.manualGenreOverrideValue === 'narrative' && saved.writingGenreSelectValue === 'narrative', 'actual fields');
                    });
                    run('draft write failure preserves writing/previous raw bytes', () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw); ta.value = 'New synthetic text'; selectedStudent = 'Bob';
                        Storage.prototype.setItem = function(key, value) { if (key === WFT_OAUTH_TEXTAREA_DRAFT_KEY) throw new Error('Synthetic write failure'); return set.call(this, key, value); };
                        check(saveWftOAuthDraftBeforeRedirect('sync') === false && ta.value === 'New synthetic text' && selectedStudent === 'Bob' && localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === raw, 'required failure');
                    });
                    for (const previous of [raw, '{unreadable synthetic draft']) run('redirect preservation cannot overwrite previous draft ' + previous.length, () => {
                        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, previous); ta.value = 'Different current writing';
                        check(saveWftOAuthDraftBeforeRedirect('sync') === false && localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === previous && ta.value === 'Different current writing', 'unconsumed bytes retained');
                    });
                    run('draft preservation read failure stops redirect preparation', () => {
                        ta.value = draft.text;
                        Storage.prototype.getItem = function(key) { if (key === WFT_OAUTH_TEXTAREA_DRAFT_KEY) throw new Error('Synthetic read failure'); return get.call(this, key); };
                        check(saveWftOAuthDraftBeforeRedirect('sync') === false && ta.value === draft.text, 'unknown previous bytes not overwritten');
                    });
                }
                checkDraftPreservation();
                return cases;
            }
            const draftCases = await page.evaluate(draftScenarioCases);
            cases.push(...draftCases);
            await page.close();
        }
        await checkDraftRecovery();
        async function checkStartup() {
            await run('actual startup keeps restored writing after load', async () => {
                const p = await pageFor(() => {
                    if (location.origin === 'http://127.0.0.1:8765') localStorage.setItem('wft_oauth_textarea_draft_v1', JSON.stringify({ text: 'Startup synthetic draft', selectedStudent: '', manualGenreOverrideValue: 'narrative', writingGenreSelectValue: 'narrative' }));
                });
                lastObserved = await p.evaluate(() => ({ writingPresentAfterLoad: document.getElementById('studentWriting').value === 'Startup synthetic draft', draftConsumed: !localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) }));
                assert.equal(lastObserved.writingPresentAfterLoad, true);
                assert.equal(await p.evaluate(() => localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY)), null);
                await p.close();
            });
            await run('actual redirect startup completes and calls current sync callback', async () => {
                const p = await pageFor(() => {
                    addEventListener('load', () => {
                        window.__syncCallbacks = 0;
                        GoogleDriveMigration.ensure = async () => ({ user: { name: 'Synthetic redirect' } });
                        fetch = async () => new Response('{}'); manualSaveToDrive = () => __syncCallbacks++;
                        syncWftNow = () => Promise.resolve(false); startWftSyncPolling = () => {};
                    });
                }, '#access_token=synthetic-redirect&expires_in=3600');
                await p.waitForTimeout(1600);
                lastObserved = await p.evaluate(() => ({ connected: wftSyncState.signedIn && isWftTokenValid(), callbacks: __syncCallbacks, hashRemoved: !location.hash }));
                assert.equal(lastObserved.connected, true); assert.equal(lastObserved.callbacks, 1); assert.equal(lastObserved.hashRemoved, true);
                await p.close();
            });
        }
        await checkStartup();
        async function checkFragmentCleanupFailures() {
            for (const mode of ['token', 'error', 'notice-unavailable', 'status-unavailable']) await run('OAuth fragment cleanup failure ' + mode, async () => {
                const p = await pageFor(), notices = [];
                p.on('dialog', async dialog => { notices.push(dialog.message()); await dialog.dismiss(); });
                await p.evaluate(mode => {
                    GoogleDriveMigration.ensure = async () => ({ user: { name: 'Synthetic cleanup' } });
                    window.__cleanupCallbacks = 0; manualSaveToDrive = () => __cleanupCallbacks++;
                    document.getElementById('studentWriting').value = 'Tab-only cleanup writing';
                    selectedStudent = 'Alice';
                    pendingPortfolioSync = { studentName: 'Alice', sessionData: { id: 'cleanup', originalText: 'Tab-only cleanup writing', images: [{ dataUrl: 'data:image/png;base64,AAAA', pendingDriveUpload: true }] } };
                    window.__cleanupPending = pendingPortfolioSync;
                    window.__cleanupPendingBytes = JSON.stringify(pendingPortfolioSync);
                    window.__cleanupDocument = document;
                    localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, 'Synthetic recovery bytes');
                    window.__cleanupDraft = localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
                    window.__cleanupDiagnostics = [];
                    wftDebugWarn = wftDebugError = (...args) => __cleanupDiagnostics.push(args.map(String).join(' '));
                    const fragment = mode === 'error' ? '#error=access_denied&error_description=Synthetic+denial' : '#access_token=synthetic-cleanup-secret&expires_in=3600';
                    history.replaceState(null, '', location.pathname + '?cleanup=1' + fragment);
                    window.__cleanupHash = location.hash;
                    history.replaceState = () => { throw Error('Synthetic history failure ' + location.href); };
                    if (mode === 'notice-unavailable') window.alert = () => { throw Error('Synthetic notice failure ' + location.href); };
                    if (mode === 'status-unavailable') setOcrStatus = () => { throw Error('Synthetic status failure ' + location.href); };
                    window.__cleanupHandled = checkHashForOAuthTokens();
                }, mode);
                await p.waitForTimeout(80);
                lastObserved = await p.evaluate(() => ({
                    handled: __cleanupHandled, connected: wftSyncState.signedIn && isWftTokenValid(), callbacks: __cleanupCallbacks,
                    sameDocument: document === __cleanupDocument, hashRetained: location.hash === __cleanupHash,
                    writingPreserved: document.getElementById('studentWriting').value === 'Tab-only cleanup writing',
                    pendingPreserved: pendingPortfolioSync === __cleanupPending && JSON.stringify(pendingPortfolioSync) === __cleanupPendingBytes,
                    draftPreserved: localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY) === __cleanupDraft,
                    notice: document.getElementById('ocrStatus').textContent,
                    diagnosticLeakedUrl: __cleanupDiagnostics.some(text => text.includes('synthetic-cleanup-secret') || text.includes('http://127.0.0.1')),
                    queryPreserved: location.search === '?cleanup=1', providerError: document.getElementById('driveSyncTextHeader').textContent.includes('Synthetic denial')
                }));
                assert.equal(lastObserved.handled, mode !== 'error'); assert.equal(lastObserved.connected, mode !== 'error');
                assert.equal(lastObserved.callbacks, mode === 'error' ? 0 : 1);
                for (const key of ['sameDocument', 'hashRetained', 'writingPreserved', 'pendingPreserved', 'draftPreserved', 'queryPreserved']) assert.equal(lastObserved[key], true, key);
                const notice = mode === 'status-unavailable' ? notices[0] : lastObserved.notice;
                assert.match(notice, /could not.*address/i); assert.match(notice, /save.*writing.*close.*reopen/i);
                assert.equal(notices.length, mode === 'notice-unavailable' ? 0 : 1);
                assert.equal(lastObserved.diagnosticLeakedUrl, false);
                if (mode === 'error') assert.equal(lastObserved.providerError, true);
                await p.close();
            });
            await run('ordinary URL fragment is not OAuth cleanup work', async () => {
                const p = await pageFor();
                lastObserved = await p.evaluate(() => {
                    history.replaceState(null, '', location.pathname + '?ordinary=1#writing');
                    let calls = 0; history.replaceState = () => calls++;
                    return { handled: checkHashForOAuthTokens(), calls, unchanged: location.search === '?ordinary=1' && location.hash === '#writing' };
                });
                assert.equal(lastObserved.handled, false); assert.equal(lastObserved.calls, 0); assert.equal(lastObserved.unchanged, true);
                await p.close();
            });
        }
        await checkFragmentCleanupFailures();
        async function checkSignInModes() {
            for (const mode of ['write-fails', 'popup-throws-write-fails', 'redirect', 'popup-success', 'popup-cancel', 'popup-error']) await run('actual sign-in UI ' + mode, async () => {
                const p = await pageFor(); let navigations = 0;
                await p.route('https://accounts.google.com/**', route => { navigations++; return route.abort(); });
                function prepareSignInUi(mode) {
                    document.getElementById('studentWriting').value = 'Current synthetic text'; selectedStudent = 'Bob'; manualGenreOverrideValue = 'narrative'; document.getElementById('writingGenreSelect').value = 'narrative';
                    window.__callbacks = 0; window.__ensureCalls = 0;
                    GoogleDriveMigration.ensure = async () => { __ensureCalls++; return { user: { name: 'Synthetic user' } }; };
                    if (mode.includes('write-fails')) { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === WFT_OAUTH_TEXTAREA_DRAFT_KEY) throw new Error('Synthetic quota'); return set.call(this, key, value); }; }
                    window.google = mode === 'redirect' || mode === 'write-fails' ? undefined : { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken() {
                        if (mode === 'popup-throws-write-fails') throw new Error('Synthetic popup unavailable');
                        if (mode === 'popup-cancel') config.callback({ error: 'access_denied' });
                        else if (mode === 'popup-error') config.error_callback({ type: 'popup_closed' });
                        else config.callback({ access_token: 'synthetic-popup', expires_in: 3600 });
                    } }) } } };
                }
                await p.evaluate(prepareSignInUi, mode);
                if (mode.startsWith('popup-') && mode !== 'popup-throws-write-fails') {
                    await p.evaluate(() => requestDriveAccess(() => __callbacks++));
                    await p.waitForTimeout(50);
                    const state = await p.evaluate(() => ({ callbacks: __callbacks, connected: wftSyncState.signedIn, text: document.getElementById('studentWriting').value, error: document.getElementById('driveSyncDotHeader').classList.contains('error') }));
                    assert.equal(state.callbacks, mode === 'popup-success' ? 1 : 0); assert.equal(state.connected, mode === 'popup-success');
                    assert.equal(state.text, 'Current synthetic text'); if (mode !== 'popup-success') assert.equal(state.error, true);
                } else {
                    const before = await p.evaluate(() => { handleGoogleSignIn(); return { text: document.getElementById('studentWriting').value, student: selectedStudent, genre: manualGenreOverrideValue, saved: !!localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY), status: document.getElementById('driveSyncTextHeader').textContent }; });
                    assert.equal(before.text, 'Current synthetic text'); assert.equal(before.student, 'Bob'); assert.equal(before.genre, 'narrative');
                    if (mode.includes('write-fails')) { assert.equal(before.saved, false); assert.match(before.status, /writing|draft/i); }
                    else assert.equal(before.saved, true);
                    await p.waitForTimeout(100);
                }
                assert.equal(navigations, mode === 'redirect' ? 1 : 0, 'provider navigation always intercepted');
                await p.close();
            });
        }
        await checkSignInModes();
        async function checkRedirectRecovery() {
            const modes = ['quota', 'memory', 'retry', 'full', 'drive-backed', 'selected-photo', 'selected-original', 'rollback-recovery', 'popup-throws', 'popup-success', 'popup-cancel', 'popup-error'];
            for (const mode of modes) await run('redirect preserves current work ' + mode, async () => {
                const p = await pageFor(); let navigations = 0;
                await p.route('https://accounts.google.com/**', route => { navigations++; return route.abort(); });
                await p.evaluate(mode => {
                    localStorage.clear(); sessionStorage.clear();
                    document.getElementById('studentWriting').value = 'Current synthetic recovery writing';
                    selectedStudent = 'Alice';
                    window.__photo = 'data:image/png;base64,AAAA'; window.__callbacks = 0;
                    pendingPortfolioSync = { studentName: 'Alice', signature: 'recovery', sessionData: { id: 'recovery', originalText: 'Current synthetic recovery writing', images: [{ dataUrl: __photo, originalDataUrl: __photo, pendingDriveUpload: true }] } };
                    if (mode === 'drive-backed') { pendingPortfolioSync.sessionData.images[0].driveFileId = 'durable-photo'; pendingPortfolioSync.sessionData.images[0].pendingDriveUpload = false; }
                    if (mode.startsWith('selected-') || mode === 'rollback-recovery') pendingPortfolioSync = null;
                    selectedImages = mode.startsWith('selected-') ? [{ [mode === 'selected-original' ? 'originalDataUrl' : 'dataUrl']: __photo }] : [];
                    window.__pendingBefore = pendingPortfolioSync; window.__selectedBefore = selectedImages;
                    const set = Storage.prototype.setItem; window.__restoreStorage = () => { Storage.prototype.setItem = set; };
                    window.__blockPending = !['full', 'retry'].includes(mode);
                    Storage.prototype.setItem = function(key, value) {
                        if (key === PENDING_PORTFOLIO_SYNC_KEY && __blockPending && (mode === 'memory' || String(value).includes(__photo))) throw new DOMException('Synthetic quota', 'QuotaExceededError');
                        return set.call(this, key, value);
                    };
                    if (mode === 'retry') { __blockPending = true; persistPendingPortfolioSync(); __blockPending = false; }
                    else if (pendingPortfolioSync) { try { persistPendingPortfolioSync(); } catch (e) {} }
                    wftStudentChangeRecovery = mode === 'rollback-recovery' ? { wft_portfolio: 'Synthetic before-image' } : null;
                    GoogleDriveMigration.ensure = async () => ({ user: { name: 'Synthetic user' } });
                    window.google = mode.startsWith('popup-') ? { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken() {
                        if (mode === 'popup-throws') throw new Error('Synthetic unavailable popup');
                        if (mode === 'popup-cancel') config.callback({ error: 'access_denied' });
                        else if (mode === 'popup-error') config.error_callback({ type: 'popup_closed' });
                        else config.callback({ access_token: 'synthetic-popup', expires_in: 3600 });
                    } }) } } } : undefined;
                }, mode);
                // Exercise the sync and Sign In entry points, including callback sign-in via the popup.
                await p.evaluate(mode => {
                    if (mode.startsWith('selected-') || mode === 'rollback-recovery') handleGoogleSignIn();
                    else if (['quota', 'memory', 'retry', 'full', 'drive-backed', 'popup-throws'].includes(mode)) manualSaveToDrive();
                    else requestDriveAccess(() => __callbacks++);
                }, mode);
                await p.waitForTimeout(100);
                const allowedRedirect = ['full', 'retry', 'drive-backed'].includes(mode);
                assert.equal(navigations, allowedRedirect ? 1 : 0, 'Unsafe redirect must not leave the tab');
                if (!allowedRedirect) {
                    lastObserved = await p.evaluate(() => ({
                        samePending: pendingPortfolioSync === __pendingBefore, sameSelected: selectedImages === __selectedBefore,
                        photoRetained: pendingPortfolioSync ? pendingPortfolioSync.sessionData.images[0].dataUrl === __photo : !selectedImages.length || (selectedImages[0].dataUrl || selectedImages[0].originalDataUrl) === __photo,
                        text: document.getElementById('studentWriting').value, student: selectedStudent,
                        draft: localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY), callbacks: __callbacks,
                        status: document.getElementById('driveSyncTextHeader').textContent
                    }));
                    assert.equal(lastObserved.samePending, true); assert.equal(lastObserved.sameSelected, true); assert.equal(lastObserved.photoRetained, true);
                    assert.equal(lastObserved.text, 'Current synthetic recovery writing'); assert.equal(lastObserved.student, 'Alice');
                    assert.equal(lastObserved.draft, null); assert.equal(lastObserved.callbacks, mode === 'popup-success' ? 1 : 0);
                    if (!['popup-success', 'popup-cancel', 'popup-error'].includes(mode)) assert.match(lastObserved.status, /tab|popup|recover/i);
                }
                await p.close();
            });
        }
        await checkRedirectRecovery();
        async function checkTokenStorage() {
            const tokenPage = await pageFor();
            async function tokenScenarioCases() {
                const cases = [], set = Storage.prototype.setItem, get = Storage.prototype.getItem, remove = Storage.prototype.removeItem;
                const check = (condition, message) => { if (!condition) throw new Error(message); };
                function reset() { Storage.prototype.setItem = set; Storage.prototype.getItem = get; Storage.prototype.removeItem = remove; localStorage.clear(); sessionStorage.clear(); showSignedOutState(); wftTokenSessionBlocked = false; wftTokenPersistenceWarning = ''; }
                function connect(token = 'synthetic-A') { driveAccessToken = wftSyncState.accessToken = token; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 60000; saveWftTokenSession(token, wftSyncState.tokenExpiresAt); googleUser = { name: 'Synthetic profile' }; showSignedInState(googleUser); }
                async function run(name, fn) { reset(); try { await fn(); cases.push({ name, passed: true }); } catch (e) { cases.push({ name, passed: false, error: e.message }); } finally { reset(); } }
                async function checkTokenValidation() {
                    const invalid = [null, {}, [], { accessToken: {}, tokenExpiresAt: Date.now() + 60000 }, { accessToken: 1, tokenExpiresAt: Date.now() + 60000 }, { accessToken: '  ', tokenExpiresAt: Date.now() + 60000 }, ...['not-a-number', 'Infinity', '6000000000000', null, 0, -1, 1e300, Date.now() - 60000].map(tokenExpiresAt => ({ accessToken: 'synthetic', tokenExpiresAt }))];
                    for (let i = 0; i < invalid.length; i++) await run('invalid persisted token ' + i, () => {
                        sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify(invalid[i]));
                        check(restoreWftTokenSession() === false && !wftSyncState.signedIn && !driveAccessToken && !isWftTokenValid() && getWftSessionTokenExpiry() === 0, 'invalid rejected at every boundary');
                    });
                    await run('malformed JSON rejected', () => { sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, '{broken'); check(!restoreWftTokenSession() && getWftSessionTokenExpiry() === 0, 'malformed'); });
                    await run('valid token restore/expiry/validity control', () => { const expiry = Date.now() + 60000; sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify({ accessToken: 'synthetic-valid', tokenExpiresAt: expiry })); check(restoreWftTokenSession() && isWftTokenValid() && getWftSessionTokenExpiry() === expiry, 'supported session'); });
                    for (const expiry of [0, NaN, Infinity, 'Infinity', 'not-a-number']) await run('invalid runtime expiry ' + expiry, () => { connect(); wftSyncState.tokenExpiresAt = expiry; check(!isWftTokenValid(), 'finite number required'); });
                }
                await checkTokenValidation();
                async function checkCompletionExpiry() {
                    for (const ttl of [undefined, 3600, '3600', 60]) await run('ordinary completion TTL ' + ttl, () => { check(completeWftGoogleSignInWithAccessToken('synthetic', ttl, '', 'test', null) && isWftTokenValid(), 'ordinary supported completion'); });
                    for (const ttl of ['Infinity', 'bad', '3600junk', 0, -5, Infinity, 1e300]) await run('invalid completion TTL ' + ttl, () => { check(completeWftGoogleSignInWithAccessToken('synthetic', ttl, '', 'test', null) === false && !wftSyncState.signedIn, 'bad TTL rejected'); });
                }
                await checkCompletionExpiry();
                async function checkSignOutRetention() {
                    for (const failure of ['session-remove', 'legacy-token-remove', 'legacy-expiry-remove', 'optional-user-remove', 'optional-cache-remove', 'all-removes']) await run('actual sign-out ' + failure + ' preserves writing and retry', () => {
                        connect(); const ta = document.getElementById('studentWriting'); ta.value = 'Retained synthetic writing'; students = ['Alice']; selectedStudent = 'Alice'; populateStudentDropdown(); manualGenreOverrideValue = 'narrative'; document.getElementById('writingGenreSelect').value = 'narrative';
                        const keys = ['wft_portfolio', 'wft_students', 'wft_settings', 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY, WFT_OAUTH_TEXTAREA_DRAFT_KEY];
                        const retained = Object.fromEntries(keys.map(key => [key, key === 'wft_selectedStudent' ? 'Alice' : 'retained-' + key]));
                        keys.forEach(key => localStorage.setItem(key, retained[key]));
                        localStorage.setItem(DRIVE_TOKEN_CACHE_KEY, 'synthetic-legacy'); localStorage.setItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY, '6000000000000'); localStorage.setItem(GOOGLE_USER_CACHE_KEY, '{}'); localStorage.setItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY, 'synthetic-folder');
                        Storage.prototype.removeItem = function(key) {
                            if (removalFails(key)) throw new Error('Synthetic removal failure');
                            function removalFails(key) {
                                if (failure === 'all-removes') return true;
                                if (failure === 'session-remove' && key === DRIVE_TOKEN_SESSION_KEY) return true;
                                if (failure === 'legacy-token-remove' && key === DRIVE_TOKEN_CACHE_KEY) return true;
                                if (failure === 'legacy-expiry-remove' && key === DRIVE_TOKEN_EXPIRY_CACHE_KEY) return true;
                                if (failure === 'optional-user-remove' && key === GOOGLE_USER_CACHE_KEY) return true;
                                return failure === 'optional-cache-remove' && key === WFT_DRIVE_FOLDER_ID_CACHE_KEY;
                            }
                            return remove.call(this, key);
                        };
                        handleGoogleSignOut();
                        check(!driveAccessToken && !wftSyncState.signedIn, 'runtime disconnected');
                        check(ta.value === 'Retained synthetic writing' && selectedStudent === 'Alice' && manualGenreOverrideValue === 'narrative', 'writing coherent: ' + JSON.stringify({ text: ta.value === 'Retained synthetic writing', student: selectedStudent === 'Alice', genre: manualGenreOverrideValue === 'narrative' }));
                        keys.forEach(key => check(localStorage.getItem(key) === retained[key], 'retained ' + key));
                        const required = !failure.startsWith('optional');
                        const status = document.getElementById('driveSyncTextHeader').textContent;
                        check(required ? /retry|reload/i.test(status) && document.getElementById('driveSyncDotHeader').classList.contains('error') : /Signed out/.test(status), 'truthful removal result');
                        if (failure === 'session-remove' || failure === 'all-removes') check(!restoreWftTokenSession(), 'failed removal cannot reconnect same page');
                        Storage.prototype.removeItem = remove; handleGoogleSignOut();
                        check(!sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY) && !localStorage.getItem(DRIVE_TOKEN_CACHE_KEY) && /Signed out/.test(document.getElementById('driveSyncTextHeader').textContent), 'bounded retry removes tokens');
                    });
                }
                await checkSignOutRetention();
                async function checkSessionStorageFailures() {
                    await run('session save failure remains connected with truthful warning', () => {
                        Storage.prototype.setItem = function(key, value) { if (key === DRIVE_TOKEN_SESSION_KEY) throw new Error('Synthetic session unavailable'); return set.call(this, key, value); };
                        check(completeWftGoogleSignInWithAccessToken('synthetic', 3600, '', 'test', null) && isWftTokenValid(), 'current connection works');
                        check(!sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY) && /reload|session|saved/i.test(document.getElementById('driveSyncTextHeader').textContent), 'persistence accurately reported');
                    });
                    await run('session read failure fails closed', () => { connect(); driveAccessToken = wftSyncState.accessToken = null; wftSyncState.signedIn = false; Storage.prototype.getItem = function(key) { if (key === DRIVE_TOKEN_SESSION_KEY) throw new Error('Synthetic read unavailable'); return get.call(this, key); }; check(!restoreWftTokenSession() && !driveAccessToken && getWftSessionTokenExpiry() === 0, 'read failure'); });
                    await run('failed revoke does not prevent successful local sign-out', async () => {
                        connect(); fetch = async () => { throw new Error('Synthetic offline revoke'); };
                        handleGoogleSignOut(); await Promise.resolve();
                        check(!driveAccessToken && !wftSyncState.signedIn && !sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY) && /Signed out/.test(document.getElementById('driveSyncTextHeader').textContent), 'local removal is authoritative, no revocation claim');
                        fetch = async () => new Response('{}');
                    });
                }
                await checkSessionStorageFailures();
                return cases;
            }
            cases.push(...await tokenPage.evaluate(tokenScenarioCases));
            await tokenPage.close();
        }
        await checkTokenStorage();
        async function checkReloadRecovery() {
            await run('failed local removal warning describes native reload risk and retry', async () => {
                const p = await pageFor();
                lastObserved = await p.evaluate(() => {
                    completeWftGoogleSignInWithAccessToken('synthetic-reload', 3600, '', 'test', null);
                    const remove = Storage.prototype.removeItem;
                    Storage.prototype.removeItem = function(key) { if (key === DRIVE_TOKEN_SESSION_KEY) throw new Error('Synthetic removal failure'); return remove.call(this, key); };
                    handleGoogleSignOut();
                    return { disconnected: !driveAccessToken && !wftSyncState.signedIn, tokenRemains: !!sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY), warned: /reload/i.test(document.getElementById('driveSyncTextHeader').textContent) && document.getElementById('driveSyncDotHeader').classList.contains('error') };
                });
                assert.equal(lastObserved.disconnected, true); assert.equal(lastObserved.tokenRemains, true); assert.equal(lastObserved.warned, true);
                await p.reload({ waitUntil: 'load' });
                assert.equal(await p.evaluate(() => wftSyncState.signedIn && isWftTokenValid()), true, 'reload can restore an unremoved token; warning must not claim success');
                await p.evaluate(() => { syncAllToDrive = callback => callback(); fetch = async () => new Response('{}'); handleGoogleSignOut(); });
                assert.equal(await p.evaluate(() => !sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY) && !driveAccessToken), true);
                await p.close();
            });
        }
        await checkReloadRecovery();
        async function checkCallbackOwnership() {
            for (const boundary of ['profile-body', 'profile-error', 'migration', 'migration-idb-open', 'queued-callback', 'signout-sync', 'popup']) for (const mode of ['sign-out', 'newer-B', 'away-and-back-A']) await run('ownership ' + boundary + ' / ' + mode, async () => {
                const p = await pageFor();
                async function observeOwnership({ boundary, mode }) {
                    function connect(token, name) { driveAccessToken = wftSyncState.accessToken = token; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now() + 60000; googleUser = { name }; saveWftTokenSession(token, wftSyncState.tokenExpiresAt); showSignedInState(googleUser); }
                    connect('synthetic-A', 'Synthetic A');
                    let release, callbacks = 0, remaps = 0;
                    if (boundary.startsWith('profile')) {
                        function holdProfileResponse() {
                            fetch = async url => String(url).includes('/userinfo') ? new Response(new ReadableStream({ start(c) { release = () => boundary === 'profile-error' ? c.error(new Error('Synthetic body error')) : (c.enqueue(new TextEncoder().encode('{"name":"Delayed synthetic A"}')), c.close()); } })) : new Response('{}');
                            fetchGoogleUserInfo('synthetic-A');
                        }
                        holdProfileResponse();
                    } else if (boundary === 'migration' || boundary === 'migration-idb-open') {
                        async function holdMigrationResult() {
                            localStorage.setItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY, 'current-folder'); localStorage.setItem('wft_test_remap', '{"id":"old"}');
                            if (boundary === 'migration') GoogleDriveMigration.ensure = () => new Promise(resolve => release = () => resolve({ user: { name: 'Delayed synthetic A' }, ids: { old: 'new' } }));
                            else {
                                const db = await WftIndexedDb.open();
                                WftIndexedDb.open = () => new Promise(resolve => release = () => resolve(db));
                                GoogleDriveMigration.ensure = async () => ({ user: { name: 'Delayed synthetic A' }, ids: { old: 'new' } });
                            }
                            GoogleDriveMigration.remap = value => { remaps++; return value; };
                            finishWftGoogleSignInWithAccessToken('synthetic-delayed-A', 3600, '', 'test', () => callbacks++);
                            if (boundary === 'migration-idb-open') while (!release) await new Promise(resolve => setTimeout(resolve, 1));
                        }
                        await holdMigrationResult();
                    } else if (boundary === 'queued-callback') {
                        completeWftGoogleSignInWithAccessToken('synthetic-A', 3600, '', 'test', () => callbacks++); release = () => {};
                    } else if (boundary === 'popup') {
                        window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken() { release = () => config.callback({ access_token: 'synthetic-delayed-A', expires_in: 3600 }); } }) } } };
                        GoogleDriveMigration.ensure = async () => ({ user: { name: 'Delayed synthetic A' } });
                        requestDriveAccess(() => callbacks++);
                    } else {
                        syncAllToDrive = callback => { release = callback; }; handleGoogleSignOut();
                    }
                    if (mode === 'sign-out') { syncAllToDrive = callback => callback(); handleGoogleSignOut(); }
                    else if (mode === 'newer-B') connect('synthetic-B', 'Synthetic B');
                    else { showSignedOutState(); connect('synthetic-A', 'New synthetic A'); }
                    const beforeSession = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY), beforeFolder = localStorage.getItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY), beforeRemaps = remaps;
                    release(); await new Promise(resolve => setTimeout(resolve, 80));
                    const afterSession = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
                    const result = { sessionUnchanged: beforeSession === afterSession, callbacks, remaps: remaps - beforeRemaps, signedIn: wftSyncState.signedIn, newerB: driveAccessToken === 'synthetic-B', oldA: driveAccessToken === 'synthetic-A', delayedPublished: googleUser?.name === 'Delayed synthetic A', signInVisible: document.getElementById('googleSignInBtnHeader').style.display !== 'none', folderIntact: localStorage.getItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY) === beforeFolder };
                    if (mode !== 'sign-out') result.restoreCurrent = restoreWftTokenSession() && driveAccessToken === (mode === 'newer-B' ? 'synthetic-B' : 'synthetic-A');
                    return result;
                }
                const observed = await p.evaluate(observeOwnership, { boundary, mode });
                lastObserved = observed;
                assert.equal(observed.sessionUnchanged, true); assert.equal(observed.callbacks, 0); assert.equal(observed.delayedPublished, false); assert.equal(observed.remaps, 0);
                if (boundary === 'migration') assert.equal(observed.folderIntact, true);
                if (mode === 'sign-out') { assert.equal(observed.signedIn, false); assert.equal(observed.signInVisible, true); }
                else { assert.equal(observed.signedIn, true); assert.equal(observed.restoreCurrent, true); }
                await p.close();
            });
        }
        await checkCallbackOwnership();
    } finally { await browser.close(); }
    const report = { root, count: cases.length, passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, cases,
        scope: 'Full shipped native Edge scripts, actual UI/state/storage/async callbacks. Synthetic tokens, held response bodies/migration and sync/revoke services, intercepted provider navigation. No live provider, Drive, AI, real accounts or students.' };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2)); assert.equal(report.failed, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
