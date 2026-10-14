{
    stopWftSyncPolling(); stopDriveAutoSync();
    const defaultFlags = { split: WFT_SPLIT_STUDENT_FILES_V1, id: WFT_STUDENT_ID_MAP_V1,
        lazy: WFT_LAZY_PORTFOLIO_LOAD_V1, indexedDB: WFT_INDEXEDDB_CACHE_V1, compaction: WFT_TOMBSTONE_COMPACTION_V1 };
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem, get = Storage.prototype.getItem;
    const originals = { fetch, findWftFilesByNamePromise, ensureDriveFolderPromise, ensureDriveFolder,
        syncStateFromLegacyGoogleGlobals, syncWftPortfolioIfNeeded, syncWftDeletionsIfNeeded,
        syncWftPortfolioIndexIfNeeded, checkDuplicateSyncFilesStatus, isWftTokenValid, savePortfolioIndexToDrive };
    let alerts = [], schedules = 0;
    const cases = [{ name: 'shipped optional-feature defaults preserved', pass: defaultFlags.split === true && defaultFlags.id === false && defaultFlags.lazy === false && defaultFlags.indexedDB === false && defaultFlags.compaction === false, observed: defaultFlags }], copy = value => JSON.parse(JSON.stringify(value));
    const check = (value, message) => { if (!value) throw new Error(message); };
    const equal = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), message);
    const threw = fn => { try { fn(); return false; } catch (e) { return true; } };
    const el = id => document.getElementById(id);
    const base = () => ({ model: el('modelSelect').options[0].value, targetWordCount: '200', useWordCountTarget: true,
        grammarStrictness: 3, assessScriptQuality: false, gradeLevel: 5, classGradeLevel: 5, studentGradeLevelOverride: false,
        students: ['Local'], unknown: { keep: true } });
    const reset = function reset() {
        Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; Storage.prototype.getItem = get;
        Object.assign(globalThis, originals);
        localStorage.clear(); sessionStorage.clear();
        wftStudentChangeRecovery = null; wftApiKeyStorageRecovery = null;
        wftCommittedApiKeyInput = { key: '', remember: false };
        wftSuppressDirtyMarks = false; WFT_STUDENT_ID_MAP_V1 = false; WFT_INDEXEDDB_CACHE_V1 = false;
        WFT_PORTFOLIO_INDEX_V1 = false; WFT_LAZY_PORTFOLIO_LOAD_V1 = false; WFT_TOMBSTONE_COMPACTION_V1 = false;
        students = ['Local']; selectedStudent = 'Local'; selectedImages = []; activePortfolioReassessmentSource = null;
        localStorage.setItem('wft_settings', JSON.stringify(base()));
        localStorage.setItem('wft_students', JSON.stringify(students));
        localStorage.setItem('wft_portfolio', '{}'); localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, '{}');
        localStorage.setItem('wft_selectedStudent', 'Local');
        el('classGradeLevelSelect').value = el('gradeLevelSelect').value = '5'; wftStudentGradeLevelOverride = false;
        el('modelSelect').value = base().model; el('targetWordCount').value = '200'; el('targetWordCount').disabled = false;
        el('useWordCountTarget').checked = true; el('assessScriptQuality').checked = false;
        el('grammarStrictness').value = '3'; el('grammarStrictnessVal').textContent = '3';
        el('apiKeyInput').value = ''; el('rememberApiKeyOnDevice').checked = false; API_KEY = '';
        alerts = []; schedules = 0; alert = message => alerts.push(message); scheduleWftCloudSync = () => schedules++;
        Object.assign(wftSyncState, { localSettingsCounter: 0, lastSyncedSettingsCounter: 0, lastSyncedSettingsHash: 'previous',
            pendingSettingsPush: false, needsSyncAfterCurrent: false, lastError: null, isSyncing: false, syncPromise: null,
            signedIn: false, accessToken: '', blockReason: '', blockedUntil: 0 });
        driveAccessToken = '';
    };
    const failSettings = () => { Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && key === 'wft_settings') throw new Error('Synthetic preference write failure');
        return set.call(this, key, value);
    }; };
    const committed = () => {
        equal(el('gradeLevelSelect').value, '5', 'grade form kept'); check(!wftStudentGradeLevelOverride, 'override kept');
        check(!el('assessScriptQuality').checked && !shouldAssessNeatness(), 'neatness form/policy kept');
        check(wftSyncState.localSettingsCounter === 0 && schedules === 0 && !wftSyncState.pendingSettingsPush, 'no false dirty/schedule');
        check(JSON.parse(localStorage.getItem('wft_settings')).unknown.keep, 'metadata kept');
    };
    const run = async function run(name, fn) {
        reset();
        try { await fn(); cases.push({ name, pass: true }); }
        catch (e) { cases.push({ name, pass: false, error: e.message }); }
        finally { Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; Storage.prototype.getItem = get; }
    };
    const checkRequiredPreferenceSaves = async function checkRequiredPreferenceSaves() {
        await run('ordinary required save rejects/preserves bytes and restores complete preference form', () => {
            const before = localStorage.getItem('wft_settings'); selectedImages = [{}]; failSettings();
            el('targetWordCount').value = '450'; el('useWordCountTarget').checked = false; el('targetWordCount').disabled = true;
            el('grammarStrictness').value = '5'; el('assessScriptQuality').checked = true;
            el('gradeLevelSelect').value = '12'; wftStudentGradeLevelOverride = true;
            check(threw(() => saveSettingsToLocalStorage()), 'save must reject');
            equal(localStorage.getItem('wft_settings'), before, 'old bytes kept'); committed();
            equal(el('targetWordCount').value, '200', 'target kept'); check(!el('targetWordCount').disabled, 'disabled policy restored');
            equal(el('grammarStrictnessVal').textContent, '3', 'grammar label restored');
            equal(el('targetWordCount').min, String(getGradeProfile(5).targetWordCountRange[0]), 'grade range restored');
        });
        for (const action of ['model', 'neatness', 'grammar-inline', 'student-grade-inline', 'class-grade-inline', 'grade-defaults', 'drawer-close']) {
            await run('native preference handler/' + action, async () => {
                const before = localStorage.getItem('wft_settings'); failSettings();
                if (action === 'model') { el('modelSelect').selectedIndex = 1; el('modelSelect').dispatchEvent(new Event('change')); }
                if (action === 'neatness') { el('assessScriptQuality').checked = true; el('assessScriptQuality').dispatchEvent(new Event('change')); }
                if (action === 'grammar-inline') { el('grammarStrictness').value = '5'; el('grammarStrictness').dispatchEvent(new Event('input')); }
                if (action === 'student-grade-inline') { el('gradeLevelSelect').value = '12'; el('gradeLevelSelect').dispatchEvent(new Event('change')); }
                if (action === 'class-grade-inline') { el('classGradeLevelSelect').value = '12'; el('classGradeLevelSelect').dispatchEvent(new Event('change')); }
                if (action === 'grade-defaults') { el('gradeLevelSelect').value = '12'; applyGradeDefaults(); }
                if (action === 'drawer-close') { openSettingsDrawer(); el('targetWordCount').value = '450'; el('settingsDrawer').querySelector('.settings-drawer-close').click(); check(el('settingsDrawer').classList.contains('open'), 'drawer remains for retry'); }
                await new Promise(resolve => setTimeout(resolve, 0));
                equal(localStorage.getItem('wft_settings'), before, 'bytes kept'); committed();
                check(alerts.length === 1 && /could not be saved/.test(alerts[0]), 'one visible failure');
            });
        }
        for (const helper of ['grade', 'neatness']) await run('reassessment required helper/' + helper, () => {
            failSettings(); selectedImages = [{}];
            check(threw(() => helper === 'grade' ? setGradeLevelForPortfolioReassessment({ gradeLevel: 12 }) : setNeatnessForPortfolioReassessment(true)), 'helper rejects');
            committed();
        });
        await run('required preflight failure restores valid saved preferences', () => {
            localStorage.setItem('wft_students', '{recoverable roster fragment');
            el('gradeLevelSelect').value = '12'; wftStudentGradeLevelOverride = true;
            el('assessScriptQuality').checked = true;
            check(threw(() => saveSettingsToLocalStorage()), 'required read rejects'); committed();
            equal(localStorage.getItem('wft_students'), '{recoverable roster fragment', 'roster bytes kept');
        });
        await run('page-hide failed required save preserves previous suppression', () => {
            failSettings(); wftSuppressDirtyMarks = true; saveWftLocalSnapshotsBeforeHide();
            check(wftSuppressDirtyMarks && schedules === 0 && wftSyncState.localSettingsCounter === 0, 'previous suppression retained');
        });
    };
    const checkReassessmentLoads = async function checkReassessmentLoads() {
        await run('reassessment grade failure keeps current writing, pending result and selection', async () => {
            const originalConfirm = wftConfirm;
            try {
                localStorage.setItem('wft_portfolio', JSON.stringify({ Local: { sessions: [{ id: 'saved', gradeLevel: 12, originalText: 'Saved synthetic writing.', images: [] }] } }));
                el('studentWriting').value = 'Current synthetic writing.';
                pendingPortfolioSync = { studentName: 'Local', signature: 'pending', sessionData: { id: 'pending', originalText: 'Pending synthetic writing.' } };
                const before = JSON.stringify(pendingPortfolioSync); wftConfirm = async () => true; failSettings();
                await reassessPortfolioSession('Local', 'saved');
                equal(el('studentWriting').value, 'Current synthetic writing.', 'current writing retained');
                equal(JSON.stringify(pendingPortfolioSync), before, 'pending retained');
                check(activePortfolioReassessmentSource === null && selectedStudent === 'Local', 'no half-loaded owner');
                check(alerts.length === 1 && /current writing was kept/.test(alerts[0]), 'load failure visible'); committed();
            } finally { wftConfirm = originalConfirm; }
        });
        await run('reassessment late neatness failure retains loaded writing and saved policy', async () => {
            const confirm = wftConfirm, restore = restorePortfolioSessionImagesForReassessment;
            try {
                localStorage.setItem('wft_portfolio', JSON.stringify({ Local: { sessions: [{ id: 'saved', gradeLevel: 5, neatnessAssessed: true, originalText: 'Saved synthetic writing.', images: [{}] }] } }));
                wftConfirm = async () => true;
                restorePortfolioSessionImagesForReassessment = async () => { selectedImages = [{}]; failSettings(); return { restored: 1, total: 1 }; };
                await reassessPortfolioSession('Local', 'saved'); await new Promise(resolve => setTimeout(resolve, 0));
                equal(el('studentWriting').value, 'Saved synthetic writing.', 'loaded writing retained');
                check(!el('assessScriptQuality').checked && !shouldAssessNeatness(), 'saved neatness policy consistent');
                check(alerts.some(x => /neatness preference could not be saved/.test(x)), 'late failure visible');
                check(/Check Settings/.test(el('ocrStatus').textContent), 'loading completes with actionable status');
            } finally { wftConfirm = confirm; restorePortfolioSessionImagesForReassessment = restore; }
        });
    };
    const checkSuccessfulPreferenceSaves = async function checkSuccessfulPreferenceSaves() {
        for (const action of ['save', 'class', 'student', 'defaults', 'suppressed']) await run('successful preferences/' + action, () => {
            el('classGradeLevelSelect').value = '6'; el('gradeLevelSelect').value = '6';
            el('targetWordCount').value = '333'; el('useWordCountTarget').checked = false; el('grammarStrictness').value = '4';
            if (action === 'suppressed') wftSuppressDirtyMarks = true;
            if (action === 'class') onGradeLevelChanged('class');
            else if (action === 'student') { el('gradeLevelSelect').value = '12'; onGradeLevelChanged('student'); }
            else if (action === 'defaults') applyGradeDefaults(); else saveSettingsToLocalStorage();
            const saved = JSON.parse(localStorage.getItem('wft_settings'));
            check(saved.unknown.keep && !Object.hasOwn(saved, 'apiKey'), 'metadata/no key');
            equal(wftSyncState.localSettingsCounter, action === 'suppressed' ? 0 : 1, 'one durable mark');
            equal(schedules, action === 'suppressed' ? 0 : 1, 'one schedule');
            if (action === 'defaults') {
                const profile = getGradeProfile(6);
                equal(saved.targetWordCount, String(profile.targetWordCountBase || profile.targetWordCount), 'grade default words');
                equal(saved.grammarStrictness, profile.grammarStrictnessDefault, 'grade default grammar');
                equal(saved.assessScriptQuality, profile.neatnessDefaultEnabled, 'grade default neatness');
            } else { equal(saved.targetWordCount, '333', 'custom words kept'); equal(saved.grammarStrictness, 4, 'custom grammar kept'); }
            if (action === 'student') check(saved.studentGradeLevelOverride && saved.gradeLevel === 12 && saved.classGradeLevel === 6, 'student override preserved');
        });
        await run('ordinary save does not mutate helper input or lose own metadata', () => {
            const input = JSON.parse('{"apiKey":"synthetic-input-key","__proto__":{"keep":true},"constructor":"ordinary","studentIdMap":{"__proto__":"own-id"}}');
            const before = JSON.stringify(input), result = saveSettingsToLocalStorage(input);
            equal(JSON.stringify(input), before, 'source unchanged'); check(!Object.hasOwn(result, 'apiKey'), 'return excludes key');
            const saved = JSON.parse(localStorage.getItem('wft_settings'));
            check(Object.hasOwn(saved, '__proto__') && saved.__proto__.keep && saved.constructor === 'ordinary' && saved.studentIdMap.__proto__ === 'own-id', 'own data retained');
        });
    };
    const checkMetadataMerges = async function checkMetadataMerges() {
        for (const preferLocal of [false, true]) for (const source of ['local', 'cloud', 'both', 'empty']) await run(`metadata merge/${preferLocal}/${source}`, () => checkMetadataMerge(preferLocal, source));
        function checkMetadataMerge(preferLocal, source) {
            const marker = JSON.parse('{"__proto__":{"keep":"local"},"constructor":"local","toString":"metadata","students":["Local","constructor","Local"],"apiKey":"synthetic-key"}');
            const cloudMarker = JSON.parse('{"__proto__":{"keep":"cloud"},"constructor":"cloud","unknown":{"future":true},"students":["Cloud","constructor","Cloud"]}');
            const a = source === 'cloud' || source === 'empty' ? {} : marker, b = source === 'local' || source === 'empty' ? {} : cloudMarker;
            const before = [JSON.stringify(a), JSON.stringify(b)], merged = mergeWftSettings(a, b, preferLocal), serialized = JSON.parse(JSON.stringify(merged));
            equal([JSON.stringify(a), JSON.stringify(b)], before, 'sources unchanged'); check(!Object.hasOwn(merged, 'apiKey'), 'key excluded');
            if (source === 'empty') equal(serialized, {}, 'empty settings valid');
            else {
                check(Object.hasOwn(merged, '__proto__') && Object.hasOwn(serialized, '__proto__'), 'own __proto__ serialized');
                equal(serialized.__proto__.keep, source === 'both' ? (preferLocal ? 'local' : 'cloud') : source, 'preference wins');
                if (source === 'both') equal(serialized.students, ['Cloud', 'constructor', 'Local'], 'roster union ordered/deduped');
            }
        }
    };
    const checkSettingsApply = async function checkSettingsApply() {
        for (const writer of ['localOnly', 'loaded']) for (const stage of ['settings', 'roster', 'rollback']) await run(`multi-key apply/${writer}/${stage}`, () => checkSettingsApplyFailure(writer, stage));
        async function checkSettingsApplyFailure(writer, stage) {
            const before = { settings: localStorage.getItem('wft_settings'), roster: localStorage.getItem('wft_students'), memory: copy(students), target: el('targetWordCount').value };
            let settingsWrites = 0;
            Storage.prototype.setItem = function(key, value) {
                if (this === localStorage && key === 'wft_settings') {
                    settingsWrites++;
                    if (stage === 'settings' || (stage === 'rollback' && settingsWrites > 1)) throw new Error('Synthetic settings rejection');
                }
                if (this === localStorage && key === 'wft_students' && stage !== 'settings') throw new Error('Synthetic roster rejection');
                return set.call(this, key, value);
            };
            const incoming = { students: ['Cloud'], targetWordCount: '450', gradeLevel: 12, classGradeLevel: 12, assessScriptQuality: true };
            check(threw(() => writer === 'localOnly' ? saveSettingsLocalOnly(incoming, 'test') : applyLoadedSettings(incoming)), 'apply rejects');
            equal(students, before.memory, 'runtime roster kept'); equal(el('targetWordCount').value, before.target, 'form unpublished');
            equal(localStorage.getItem('wft_students'), before.roster, 'roster bytes kept');
            check(!wftSuppressDirtyMarks && schedules === 0 && wftSyncState.localSettingsCounter === 0, 'marks/suppression coherent');
            if (stage !== 'rollback') { equal(localStorage.getItem('wft_settings'), before.settings, 'settings rollback'); check(!wftStudentChangeRecovery, 'no recovery needed'); }
            else {
                check(wftStudentChangeRecovery && wftStudentChangeRecovery.wft_settings === before.settings, 'original settings retained for recovery');
                equal(readWftRequiredStorage('wft_settings').targetWordCount, '200', 'runtime reads recovery');
                check(threw(() => saveSettingsToLocalStorage()), 'save blocked pending recovery');
                let rejected = false; try { await syncWftSettingsIfNeeded('test'); } catch (e) { rejected = true; } check(rejected, 'sync blocked');
                Storage.prototype.setItem = set;
                saveWftStudentChange({}); check(!wftStudentChangeRecovery, 'existing recovery retry works');
                equal(localStorage.getItem('wft_settings'), before.settings, 'retry restores originals');
            }
        }
        await run('successful cloud/local apply keeps metadata, union roster, form and suppression', () => {
            students.push('Unsynced');
            const incoming = JSON.parse('{"students":["Cloud","Cloud","__proto__"],"__proto__":{"future":true},"targetWordCount":"450","useWordCountTarget":false,"classGradeLevel":6,"gradeLevel":12,"studentGradeLevelOverride":true,"assessScriptQuality":true}');
            const before = JSON.stringify(incoming), result = saveSettingsLocalOnly(incoming, 'test');
            equal(JSON.stringify(incoming), before, 'incoming unchanged');
            equal(students, ['__proto__', 'Cloud', 'Local', 'Unsynced'], 'local union sorted');
            equal(JSON.parse(localStorage.getItem('wft_students')), students, 'durable roster');
            equal(JSON.parse(localStorage.getItem('wft_settings')).students, students, 'durable settings roster');
            check(result.unknown.keep && Object.hasOwn(result, '__proto__') && result.__proto__.future, 'unknown metadata');
            check(el('targetWordCount').disabled && getSelectedGradeLevel() === 12 && getClassGradeLevel() === 6 && wftStudentGradeLevelOverride, 'form policy');
            check(schedules === 0 && wftSyncState.localSettingsCounter === 0 && !wftSuppressDirtyMarks, 'suppressed marks restored');
            const savedBytes = localStorage.getItem('wft_settings');
            check(threw(() => saveSettingsLocalOnly(null)) && threw(() => applyLoadedSettings(null)), 'invalid incoming root rejects');
            equal(localStorage.getItem('wft_settings'), savedBytes, 'invalid apply leaves valid bytes');
        });
    };
    const cloudSetup = function cloudSetup() {
        ensureDriveFolderPromise = async () => 'synthetic-folder'; ensureDriveFolder = callback => callback('synthetic-folder');
        findWftFilesByNamePromise = async name => name === WFT_SETTINGS_FILENAME ? [{ id: 'synthetic-settings' }] : [];
        syncStateFromLegacyGoogleGlobals = () => {};
        syncWftPortfolioIfNeeded = syncWftDeletionsIfNeeded = syncWftPortfolioIndexIfNeeded = async () => false;
        checkDuplicateSyncFilesStatus = () => {}; isWftTokenValid = () => true;
        wftSyncState.signedIn = true; wftSyncState.accessToken = driveAccessToken = 'synthetic-drive-connection';
    };
    const checkCloudSettingsTransport = async function checkCloudSettingsTransport() {
        for (const stage of ['settings', 'roster', 'rollback', 'local-addition']) await run('actual delayed cloud body/apply/' + stage, async () => {
            cloudSetup(); wftSyncState.pendingSettingsPush = stage === 'local-addition';
            const before = localStorage.getItem('wft_settings'); let release, entered, uploads = 0;
            const ready = new Promise(resolve => { entered = resolve; });
            fetch = async (url, options = {}) => {
                if (options.method && options.method !== 'GET') { uploads++; return new Response(JSON.stringify({ id: 'synthetic-settings' })); }
                return new Response(new ReadableStream({ start(controller) { entered(); release = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...base(), students: ['Cloud'], targetWordCount: '450' }))); controller.close(); }; } }));
            };
            const run = syncWftNow('manual', { immediate: true });
            await ready;
            equal(el('targetWordCount').value, '200', 'headers do not apply settings');
            equal(wftSyncState.lastSyncedSettingsHash, 'previous', 'headers do not acknowledge');
            let settingsWrites = 0;
            if (stage === 'local-addition') { students.push('AddedDuringBody'); saveStudents(); }
            else Storage.prototype.setItem = function(key, value) {
                if (this === localStorage && key === 'wft_settings') {
                    settingsWrites++;
                    if (stage === 'settings' || (stage === 'rollback' && settingsWrites > 1)) throw new Error('Synthetic settings failure');
                }
                if (this === localStorage && key === 'wft_students' && stage !== 'settings') throw new Error('Synthetic roster failure');
                return set.call(this, key, value);
            };
            release(); const result = await run;
            if (stage === 'local-addition') {
                check(result && students.includes('AddedDuringBody') && students.includes('Cloud'), 'local addition preserved');
                equal(JSON.parse(localStorage.getItem('wft_settings')).students, students, 'settings matches applied roster');
                check(uploads === 1 && !wftSyncState.pendingSettingsPush && wftSyncState.lastSyncedSettingsCounter === 1, 'one durable acknowledged push');
            } else {
                check(result === false && uploads === 0, 'failed apply no upload/success');
                equal(wftSyncState.lastSyncedSettingsHash, 'previous', 'old hash kept'); equal(wftSyncState.lastSyncedSettingsCounter, 0, 'old counter kept');
                equal(students, ['Local'], 'runtime roster unchanged'); equal(el('targetWordCount').value, '200', 'form unchanged');
                check(wftSyncState.lastError && /needs attention/i.test(el('driveSyncTextHeader').textContent), 'visible sync error');
                if (stage !== 'rollback') equal(localStorage.getItem('wft_settings'), before, 'bytes restored');
                else check(wftStudentChangeRecovery && readWftRequiredStorage('wft_settings').targetWordCount === '200', 'before-image reads');
            }
        });
        await run('actual legacy settings load callback reports required apply failure', async () => {
            cloudSetup();
            fetch = async url => new Response(JSON.stringify(String(url).includes('alt=media') ? { ...base(), students: ['Cloud'], targetWordCount: '450' } : { files: [{ id: 'synthetic-settings' }] }));
            failSettings(); loadSettingsFromDrive();
            for (let i = 0; i < 100 && !alerts.length; i++) await new Promise(resolve => setTimeout(resolve, 5));
            check(alerts.some(x => /could not be saved locally/.test(x)), 'callback failure visible');
            equal(el('targetWordCount').value, '200', 'old form'); equal(students, ['Local'], 'old roster');
            check(/could not be saved/.test(el('driveSyncTextHeader').textContent), 'error status');
        });
    };
    const checkStudentIdentity = async function checkStudentIdentity() {
        for (const name of ['Local', '__proto__', 'constructor', 'toString', 'Local Student']) await run('student identity required save/' + name, () => {
            failSettings(); const before = localStorage.getItem('wft_settings');
            check(threw(() => getOrCreateStudentId(name)), 'unstored ID not returned');
            equal(localStorage.getItem('wft_settings'), before, 'valid settings unchanged');
            check(threw(() => getOrCreateStudentId(name)), 'repeated failed save rejects');
            Storage.prototype.setItem = set; const id = getOrCreateStudentId(name);
            check(typeof id === 'string' && JSON.parse(localStorage.getItem('wft_settings')).studentIdMap[name] === id, 'retry durably saves ID');
            failSettings(); equal(getOrCreateStudentId(name), id, 'stored own ID stable without write');
        });
        await run('student identity strict invalid settings read stays recoverable', () => {
            localStorage.setItem('wft_settings', '{recoverable synthetic fragment'); const before = localStorage.getItem('wft_settings');
            check(threw(() => getOrCreateStudentId('Local')), 'invalid read rejects'); equal(localStorage.getItem('wft_settings'), before, 'invalid bytes preserved');
        });
        await run('optional identity normalization/index/deletions/startup retain honest legacy names', async () => {
            WFT_STUDENT_ID_MAP_V1 = true; WFT_PORTFOLIO_INDEX_V1 = true; failSettings();
            const data = { Local: { sessions: [{ id: 'saved', createdAt: '2026-10-12T00:00:00Z' }] } };
            const normalized = normalizeWftPortfolioForSchemaV1(copy(data)); check(normalized.Local.sessions.length === 1, 'name-keyed writing retained');
            let sent; savePortfolioIndexToDrive = (index, callback) => { sent = copy(index); callback(null, 'synthetic-index'); };
            localStorage.setItem('wft_portfolio', JSON.stringify(data));
            await new Promise((resolve, reject) => rebuildPortfolioIndex((error, index) => error ? reject(error) : resolve(index)));
            check(sent.students.Local.studentId === '', 'no unstored ID in index');
            const deletions = getDeletionsData(); recordSessionDeletion('Local', 'saved', deletions);
            check(deletions.records.some(x => x.studentName === 'Local' && x.studentId === ''), 'legacy deletion identity');
            ensureStudentRecordsForRoster(); check(!JSON.parse(localStorage.getItem('wft_settings')).studentIdMap, 'startup did not publish generated map');
        });
    };
    const checkLegacyKeyMigration = async function checkLegacyKeyMigration() {
        for (const stage of ['session-read', 'session-copy', 'settings-read', 'settings-cleanup']) await run('legacy key migration failure/' + stage, () => {
            const legacy = { ...base(), apiKey: 'synthetic-legacy-credential' }; localStorage.setItem('wft_settings', JSON.stringify(legacy));
            const before = localStorage.getItem('wft_settings');
            Storage.prototype.getItem = function(key) {
                if ((stage === 'session-read' && this === sessionStorage && key === WFT_API_KEY_SESSION_STORAGE_KEY)
                    || (stage === 'settings-read' && this === localStorage && key === 'wft_settings')) throw new Error('Synthetic read failure');
                return get.call(this, key);
            };
            Storage.prototype.setItem = function(key, value) {
                if ((stage === 'session-copy' && this === sessionStorage) || (stage === 'settings-cleanup' && this === localStorage && key === 'wft_settings')) throw new Error('Synthetic write failure');
                return set.call(this, key, value);
            };
            check(threw(() => migrateLegacyApiKeyStorage()), 'migration reports failure');
            Storage.prototype.getItem = get; Storage.prototype.setItem = set;
            equal(localStorage.getItem('wft_settings'), before, 'only legacy copy retained');
            check(!JSON.stringify(getLocalSettingsSnapshot()).includes('synthetic-legacy-credential'), 'snapshot redacted');
            migrateLegacyApiKeyStorage(); check(!Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey'), 'retry removes legacy only after copy');
            equal(getStoredApiKey(), 'synthetic-legacy-credential', 'retry key recoverable');
        });
        for (const existing of ['none', 'same', 'different', 'different-with-safe-copy', 'empty-key']) await run('legacy key migration destination/' + existing, () => {
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: existing === 'empty-key' ? '' : 'synthetic-legacy-credential' }));
            if (existing === 'same') sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, 'synthetic-legacy-credential');
            if (existing.startsWith('different')) sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, 'synthetic-active-key');
            if (existing === 'different-with-safe-copy') localStorage.setItem(WFT_API_KEY_LOCAL_STORAGE_KEY, 'synthetic-legacy-credential');
            if (existing === 'different') { check(threw(() => migrateLegacyApiKeyStorage()), 'conflicting only copy retained/reported'); check(Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey'), 'legacy retained'); }
            else { migrateLegacyApiKeyStorage(); check(!Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey'), 'safe migration'); }
            if (existing.startsWith('different')) equal(sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY), 'synthetic-active-key', 'active key unchanged');
            check(JSON.parse(localStorage.getItem('wft_settings')).unknown.keep, 'settings metadata');
        });
    };
    const seedKey = function seedKey() {
        el('apiKeyInput').value = 'synthetic-old-key'; el('rememberApiKeyOnDevice').checked = true;
        persistApiKeyStorageFromInput(); alerts = [];
    };
    const keyBytes = () => [sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY), localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY), localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY), localStorage.getItem('wft_settings')];
    const checkKeyPersistenceAndHandlers = async function checkKeyPersistenceAndHandlers() {
        for (const mode of ['remember', 'session-only', 'forget', 'no-key']) await run('successful key mode/' + mode, () => {
            seedKey(); const hasKey = mode === 'remember' || mode === 'session-only';
            el('apiKeyInput').value = hasKey ? 'synthetic-replacement-key' : ''; el('rememberApiKeyOnDevice').checked = mode === 'remember' || mode === 'no-key';
            persistApiKeyStorageFromInput();
            equal(sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY), hasKey ? 'synthetic-replacement-key' : null, 'session mode');
            equal(localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY), mode === 'remember' ? 'synthetic-replacement-key' : null, 'remembered mode');
            equal(getStoredApiKey(), hasKey ? 'synthetic-replacement-key' : '', 'read mode');
            equal(API_KEY, hasKey ? 'synthetic-replacement-key' : EMBEDDED_API_KEY, 'runtime mode');
        });
        const keyFailures = [
            ['getItem', 'session', WFT_API_KEY_SESSION_STORAGE_KEY], ['getItem', 'local', WFT_API_KEY_LOCAL_STORAGE_KEY],
            ['getItem', 'local', WFT_API_KEY_REMEMBER_PREF_KEY], ['getItem', 'local', 'wft_settings'],
            ['setItem', 'session', WFT_API_KEY_SESSION_STORAGE_KEY], ['setItem', 'local', WFT_API_KEY_LOCAL_STORAGE_KEY],
            ['setItem', 'local', WFT_API_KEY_REMEMBER_PREF_KEY], ['removeItem', 'session', WFT_API_KEY_SESSION_STORAGE_KEY],
            ['removeItem', 'local', WFT_API_KEY_LOCAL_STORAGE_KEY]
        ];
        for (const [operation, store, key] of keyFailures) await run(`key storage failure/${operation}/${store}/${key}`, () => {
            seedKey(); const before = keyBytes(); el('apiKeyInput').value = operation === 'removeItem' ? '' : 'synthetic-replacement-key'; el('rememberApiKeyOnDevice').checked = operation !== 'removeItem';
            const native = Storage.prototype[operation];
            Storage.prototype[operation] = function(name, value) {
                if (this === (store === 'session' ? sessionStorage : localStorage) && name === key) throw new Error('Synthetic key storage failure');
                return native.call(this, name, value);
            };
            check(threw(() => persistApiKeyStorageFromInput()), 'failure surfaced'); Storage.prototype[operation] = native;
            equal(keyBytes(), before, 'bounded rollback/original bytes');
            equal(el('apiKeyInput').value, 'synthetic-old-key', 'key input restored'); check(el('rememberApiKeyOnDevice').checked, 'remember checkbox restored');
            equal(getStoredApiKey(), 'synthetic-old-key', 'old key remains explicit');
            el('apiKeyInput').value = 'synthetic-replacement-key'; persistApiKeyStorageFromInput(); equal(getStoredApiKey(), 'synthetic-replacement-key', 'retry durable');
        });
        for (const event of ['input', 'change']) await run('native key handler/' + event, () => {
            seedKey();
            if (event === 'input') { el('apiKeyInput').value = ''; Storage.prototype.removeItem = function(key) { if (this === sessionStorage) throw new Error('Synthetic forget failure'); return remove.call(this, key); }; el('apiKeyInput').dispatchEvent(new Event('input')); }
            else { el('rememberApiKeyOnDevice').checked = false; Storage.prototype.removeItem = function(key) { if (this === localStorage && key === WFT_API_KEY_LOCAL_STORAGE_KEY) throw new Error('Synthetic forget remembered failure'); return remove.call(this, key); }; el('rememberApiKeyOnDevice').dispatchEvent(new Event('change')); }
            equal(el('apiKeyInput').value, 'synthetic-old-key', 'failed UI does not pretend forgotten'); check(el('rememberApiKeyOnDevice').checked, 'remember policy restored');
            check(alerts.length === 1 && /could not be saved/.test(alerts[0]), 'visible failure');
            equal(API_KEY, 'synthetic-old-key', 'runtime kept');
        });
        await run('explicit key replacement failed legacy cleanup restores all original stores', () => {
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential' }));
            const before = keyBytes(); el('apiKeyInput').value = 'synthetic-replacement-key'; el('rememberApiKeyOnDevice').checked = true;
            failSettings(); check(threw(() => persistApiKeyStorageFromInput()), 'cleanup failure surfaced');
            equal(keyBytes(), before, 'original key and preference bytes restored');
            equal(el('apiKeyInput').value, 'synthetic-legacy-credential', 'legacy input retained explicitly');
            Storage.prototype.setItem = set;
            el('apiKeyInput').value = 'synthetic-replacement-key'; el('rememberApiKeyOnDevice').checked = true;
            persistApiKeyStorageFromInput();
            check(!Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey') && getStoredApiKey() === 'synthetic-replacement-key', 'retry safely replaces legacy key');
        });
    };
    const checkKeyRecovery = async function checkKeyRecovery() {
        for (const store of ['session', 'remembered']) await run('key rollback failed removal of new destination/' + store, () => {
            el('apiKeyInput').value = 'synthetic-new-key'; el('rememberApiKeyOnDevice').checked = true;
            Storage.prototype.setItem = function(key, value) {
                if (this === localStorage && key === WFT_API_KEY_REMEMBER_PREF_KEY) throw new Error('Synthetic preference rejection');
                return set.call(this, key, value);
            };
            Storage.prototype.removeItem = function(key) {
                if ((store === 'session' && this === sessionStorage && key === WFT_API_KEY_SESSION_STORAGE_KEY)
                    || (store === 'remembered' && this === localStorage && key === WFT_API_KEY_LOCAL_STORAGE_KEY)) throw new Error('Synthetic rollback removal failure');
                return remove.call(this, key);
            };
            check(threw(() => persistApiKeyStorageFromInput()) && wftApiKeyStorageRecovery, 'bounded recovery retained');
            check(el('apiKeyInput').value === '' && !el('rememberApiKeyOnDevice').checked, 'previous no-key policy restored');
            check(!JSON.stringify(buildWftEmergencyBackupObject()).includes('synthetic-new-key'), 'private recovery not exported');
            Storage.prototype.setItem = set; Storage.prototype.removeItem = remove;
            el('apiKeyInput').value = 'synthetic-new-key'; el('rememberApiKeyOnDevice').checked = true;
            persistApiKeyStorageFromInput(); check(!wftApiKeyStorageRecovery && getStoredApiKey() === 'synthetic-new-key', 'retry completes');
        });
        await run('key failed rollback retains private before-images and blocks runtime until retry', () => {
            seedKey(); el('apiKeyInput').value = 'synthetic-replacement-key'; let sessionWrites = 0;
            Storage.prototype.setItem = function(key, value) {
                if (this === sessionStorage && ++sessionWrites > 1) throw new Error('Synthetic session rollback failure');
                if (this === localStorage && key === WFT_API_KEY_LOCAL_STORAGE_KEY) throw new Error('Synthetic remembered save failure');
                return set.call(this, key, value);
            };
            check(threw(() => persistApiKeyStorageFromInput()), 'rollback failure reports'); check(wftApiKeyStorageRecovery, 'private recovery retained');
            equal(el('apiKeyInput').value, 'synthetic-old-key', 'old form kept');
            check(threw(() => getStoredApiKey()), 'strict getter blocks inconsistent storage');
            check(refreshApiKeyRuntimeValue() === false && API_KEY === '', 'runtime visibly blocked');
            const backup = JSON.stringify(buildWftEmergencyBackupObject()); check(!backup.includes('synthetic-old-key') && !backup.includes('synthetic-replacement-key') && !backup.includes('wftApiKeyStorageRecovery'), 'key before-images never exported');
            Storage.prototype.setItem = set; el('apiKeyInput').value = 'synthetic-replacement-key'; persistApiKeyStorageFromInput();
            check(!wftApiKeyStorageRecovery && getStoredApiKey() === 'synthetic-replacement-key', 'bounded retry recovery');
        });
        await run('private key retry does not revert later durable class/preferences', () => {
            seedKey(); el('apiKeyInput').value = 'synthetic-replacement-key'; let writes = 0;
            Storage.prototype.setItem = function(key, value) {
                if (this === sessionStorage && ++writes > 1) throw new Error('Synthetic session rollback failure');
                if (this === localStorage && key === WFT_API_KEY_LOCAL_STORAGE_KEY) throw new Error('Synthetic remembered failure');
                return set.call(this, key, value);
            };
            check(threw(() => persistApiKeyStorageFromInput()) && wftApiKeyStorageRecovery, 'private recovery retained');
            Storage.prototype.setItem = set;
            el('targetWordCount').value = '333'; saveSettingsToLocalStorage();
            saveWftStudentChange({ students: ['Local', 'Later'], selectedStudent: 'Local' });
            const before = localStorage.getItem('wft_settings');
            el('apiKeyInput').value = 'synthetic-replacement-key'; persistApiKeyStorageFromInput();
            equal(localStorage.getItem('wft_settings'), before, 'later settings/class bytes retained');
            check(students.includes('Later') && getStoredApiKey() === 'synthetic-replacement-key', 'independent retry durable');
        });
        await run('key verification read failure retains unresolved original destination for retry', () => {
            seedKey(); el('apiKeyInput').value = 'synthetic-replacement-key'; let written = false;
            Storage.prototype.setItem = function(key, value) { if (this === sessionStorage) written = true; return set.call(this, key, value); };
            Storage.prototype.getItem = function(key) { if (written && this === sessionStorage) throw new Error('Synthetic verification read failure'); return get.call(this, key); };
            check(threw(() => persistApiKeyStorageFromInput()) && wftApiKeyStorageRecovery, 'unverified destination retained');
            equal(el('apiKeyInput').value, 'synthetic-old-key', 'old key remains explicit');
            Storage.prototype.setItem = set; Storage.prototype.getItem = get;
            persistApiKeyStorageFromInput(); check(!wftApiKeyStorageRecovery && getStoredApiKey() === 'synthetic-old-key', 'retry confirms original key');
        });
        await run('credential change cannot erase pending settings before-image recovery', () => {
            const raw = JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential' });
            localStorage.setItem('wft_settings', raw); wftStudentChangeRecovery = { wft_settings: raw };
            el('apiKeyInput').value = 'synthetic-replacement-key';
            check(threw(() => persistApiKeyStorageFromInput()), 'change waits for settings recovery');
            check(threw(() => migrateLegacyApiKeyStorage()), 'migration waits for settings recovery');
            equal(localStorage.getItem('wft_settings'), raw, 'raw legacy before-image untouched');
            check(!sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY), 'no new destination');
        });
    };
    const checkKeyReadsAndRetainedLegacy = async function checkKeyReadsAndRetainedLegacy() {
        for (const mode of ['session-read', 'pref-read', 'remembered-read']) await run('key runtime read failure/' + mode, () => {
            if (mode !== 'session-read') { localStorage.setItem(WFT_API_KEY_REMEMBER_PREF_KEY, 'true'); localStorage.setItem(WFT_API_KEY_LOCAL_STORAGE_KEY, 'synthetic-remembered'); }
            const key = mode === 'session-read' ? WFT_API_KEY_SESSION_STORAGE_KEY : mode === 'pref-read' ? WFT_API_KEY_REMEMBER_PREF_KEY : WFT_API_KEY_LOCAL_STORAGE_KEY;
            Storage.prototype.getItem = function(name) { if (name === key) throw new Error('Synthetic key read failure'); return get.call(this, name); };
            check(threw(() => getStoredApiKey()), 'strict getter reports read failure');
            check(refreshApiKeyRuntimeValue() === false && API_KEY === '' && alerts.length === 1, 'runtime read visibly fails');
        });
        await run('startup key migration failure does not strand preference loading', () => {
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential', gradeLevel: 6, classGradeLevel: 6, targetWordCount: '333' }));
            Storage.prototype.setItem = function(key, value) { if (this === sessionStorage) throw new Error('Synthetic startup copy failure'); return set.call(this, key, value); };
            loadSettingsFromLocalStorage();
            check(alerts.some(x => /API key change could not be saved/.test(x)), 'startup failure visible');
            check(getSelectedGradeLevel() === 6 && el('targetWordCount').value === '333', 'other preferences load');
            check(Object.hasOwn(JSON.parse(localStorage.getItem('wft_settings')), 'apiKey'), 'legacy key retained');
        });
        for (const writer of ['ordinary', 'loaded', 'localOnly', 'class-change']) await run('unrelated local writer preserves retained legacy key/' + writer, () => {
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential' }));
            Storage.prototype.setItem = function(key, value) { if (this === sessionStorage) throw new Error('Synthetic migration blocked'); return set.call(this, key, value); };
            check(threw(() => migrateLegacyApiKeyStorage()), 'copy failed');
            if (writer === 'ordinary') saveSettingsToLocalStorage({ unknown: { keep: true }, apiKey: 'synthetic-untrusted-override' });
            else if (writer === 'loaded') applyLoadedSettings({ students: ['Cloud'], targetWordCount: '333', apiKey: 'synthetic-cloud-key' });
            else if (writer === 'localOnly') saveSettingsLocalOnly({ students: ['Cloud'], targetWordCount: '333' });
            else { const input = { students: ['Local', 'Added'], selectedStudent: 'Local', settings: { unknown: { keep: true }, apiKey: 'synthetic-untrusted-override' } }; const before = JSON.stringify(input.settings); saveWftStudentChange(input); equal(JSON.stringify(input.settings), before, 'class input unchanged'); }
            equal(JSON.parse(localStorage.getItem('wft_settings')).apiKey, 'synthetic-legacy-credential', 'only legacy copy kept');
            check(!JSON.stringify(getLocalSettingsSnapshot()).includes('synthetic-legacy-credential'), 'snapshot excludes key');
            check(!JSON.stringify(buildWftEmergencyBackupObject()).includes('synthetic-legacy-credential'), 'backup excludes key');
        });
        await run('settings failed rollback before-image export redacts retained legacy key', () => {
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential' }));
            let writes = 0;
            Storage.prototype.setItem = function(key, value) { if (this === localStorage && ((key === 'wft_settings' && ++writes > 1) || key === 'wft_students')) throw new Error('Synthetic apply rollback failure'); return set.call(this, key, value); };
            check(threw(() => saveSettingsLocalOnly({ students: ['Cloud'], targetWordCount: '333' })), 'apply fails');
            check(wftStudentChangeRecovery && JSON.parse(wftStudentChangeRecovery.wft_settings).apiKey, 'key retained privately for recovery');
            check(!JSON.stringify(buildWftEmergencyBackupObject()).includes('synthetic-legacy-credential'), 'before-image export redacted');
        });
    };
    const checkOutgoingCredentialRedaction = async function checkOutgoingCredentialRedaction() {
        for (const writer of ['sync-after-failed-copy', 'sync-after-failed-cleanup', 'uploader-raw', 'uploader-retry', 'legacy-save', 'raw-save']) await run('actual outgoing multipart excludes credentials/' + writer, async () => {
            cloudSetup(); findWftFilesByNamePromise = async () => []; wftSyncState.pendingSettingsPush = true; wftSyncState.localSettingsCounter = 1;
            localStorage.setItem('wft_settings', JSON.stringify({ ...base(), apiKey: 'synthetic-legacy-credential' }));
            if (writer.startsWith('sync-after')) {
                Storage.prototype.setItem = function(key, value) {
                    if ((writer.endsWith('copy') && this === sessionStorage) || (writer.endsWith('cleanup') && this === localStorage && key === 'wft_settings')) throw new Error('Synthetic migration failure');
                    return set.call(this, key, value);
                };
                expectKeyMigrationFailure();
            }
            const bodies = [];
            fetch = async (url, options) => {
                const body = String(options.body); bodies.push({ field: body.includes('"apiKey"'), value: body.includes('synthetic-legacy-credential') });
                if (writer === 'uploader-retry' && bodies.length === 1) throw new TypeError('Synthetic network failure');
                return new Response(JSON.stringify({ id: 'synthetic-upload' }), { status: 200 });
            };
            const input = { ...base(), apiKey: 'synthetic-legacy-credential' }, before = JSON.stringify(input);
            if (writer.startsWith('sync-after')) await syncWftSettingsIfNeeded('synthetic-boundary');
            else if (writer.startsWith('uploader')) await uploadWftJsonFilePromise(WFT_SETTINGS_FILENAME, input);
            else if (writer === 'raw-save') await new Promise((resolve, reject) => saveFileToDrive(WFT_SETTINGS_FILENAME, JSON.stringify(input), 'application/json', error => error ? reject(error) : resolve()));
            else { saveSettingsToDrive(); for (let i = 0; i < 100 && !bodies.length; i++) await new Promise(resolve => setTimeout(resolve, 5)); }
            equal(JSON.stringify(input), before, 'outgoing caller unchanged');
            check(bodies.length === (writer === 'uploader-retry' ? 2 : 1) && bodies.every(x => !x.field && !x.value), 'all actual final multipart attempts redacted');
            check(!Object.hasOwn(getLocalSettingsSnapshot(), 'apiKey'), 'snapshot excludes field');
            if (writer.startsWith('sync-after')) check(!wftSyncState.pendingSettingsPush && wftSyncState.lastSyncedSettingsCounter === 1, 'only sanitized upload acknowledged');
        });
    };
    const expectKeyMigrationFailure = function expectKeyMigrationFailure() {
        try { getStoredApiKey(); }
        catch (error) {
            if (!(error instanceof Error) || error.message !== getWftApiKeyStorageError().message) throw error;
            return;
        }
        throw new Error('Expected key migration failure before outgoing redaction');
    };
    const preferenceCases = async function preferenceCases() {
        await checkRequiredPreferenceSaves();
        await checkReassessmentLoads();
        await checkSuccessfulPreferenceSaves();
        await checkMetadataMerges();
        await checkSettingsApply();
        await checkCloudSettingsTransport();
        await checkStudentIdentity();
        await checkLegacyKeyMigration();
        await checkKeyPersistenceAndHandlers();
        await checkKeyRecovery();
        await checkKeyReadsAndRetainedLegacy();
        await checkOutgoingCredentialRedaction();
        reset(); return cases;
    };
    preferenceCases();
}
