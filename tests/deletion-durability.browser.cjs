const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function routeLocalAppRequest(route) {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
}

function createDeletionCases() {
    const destructive = ['student', 'session', 'rename', 'casing', 'emptyRename', 'clear', 'reset', 'replacement', 'archiveClear', 'classResetMarkers'];
    const cases = destructive.flatMap(action => ['portfolio', 'markers'].map(key => [action, key]));
    cases.push(['add', 'markers'], ['import', 'markers'], ['restore', 'markers'], ['saveMarkers', 'markers']);
    for (const action of ['student', 'rename', 'casing', 'emptyRename', 'clear', 'reset', 'archiveClear', 'classResetMarkers', 'add', 'import']) {
        cases.push([action, 'roster'], [action, 'settings']);
    }
    cases.push(['classResetMarkers', 'selection']);
    for (const action of ['idRename', 'idRenameMissingMap', 'rosterOnlyRename']) {
        for (const key of ['portfolio', 'markers', 'roster', 'settings', 'selection']) cases.push([action, key]);
    }
    return cases;
}

async function exerciseStorageFailure({ action, failedKey }) {
    stopWftSyncPolling();
    let schedules = 0, flushes = 0;
    scheduleWftCloudSync = () => { schedules++; };
    scheduleWftDriveSync = () => { schedules++; };
    flushWftCloudSyncNow = () => { flushes++; };
    wftConfirm = async () => true;
    wftTextInput = async () => action === 'casing' ? 'ALICE' : 'Alicia';
    const alerts = []; window.alert = message => alerts.push(message);
    const entry = id => ({ id, originalText: 'Synthetic writing ' + id, images: [] });
    const originalData = { Alice: { sessions: action === 'emptyRename' ? [] : [entry('a'), entry('keep')] }, Bob: { sessions: [entry('b')] }, Carol: { sessions: [entry('c')] } };
    if (action === 'rosterOnlyRename') delete originalData.Alice;
    const original = JSON.stringify(originalData);
    localStorage.setItem('wft_portfolio', original);
    localStorage.setItem('wft_students', JSON.stringify(['Alice', 'Bob']));
    localStorage.setItem('wft_selectedStudent', 'Alice');
    localStorage.setItem('wft_settings', JSON.stringify({ students: ['Alice', 'Bob'], studentIdMap: action === 'idRenameMissingMap' ? {} : { Alice: 'student-alice' }, studentRecords: [{ studentId: 'student-alice', displayName: 'Alice', legacyNameKeys: ['Alice'] }], unknown: 'keep' }));
    const originalSettings = localStorage.getItem('wft_settings');
    if (['idRename', 'idRenameMissingMap'].includes(action)) WFT_STUDENT_ID_MAP_V1 = true;
    const deletedName = ['add', 'import', 'restore', 'rename'].includes(action) ? 'Alicia' : 'Earlier';
    localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify({ deletedStudents: { ['student:' + deletedName.toLowerCase()]: { studentName: deletedName, deletedAt: '2026-10-01T00:00:00Z' } } }));
    const originalMarkers = localStorage.getItem(WFT_DELETIONS_STORAGE_KEY);
    students = ['Alice', 'Bob']; selectedStudent = 'Alice';
    renderStudentList(); populateStudentDropdown();
    document.getElementById('studentNameInput').value = 'Alicia';
    pendingPortfolioSync = { studentName: 'Bob', sessionData: entry('new'), replaceSource: { sourceStudentName: 'Alice', sourceSessionId: 'a' }, signature: 'new-signature' };
    persistPendingPortfolioSync();
    const originalPending = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
    lastSyncedPortfolioSessionSignature = 'previous-signature';
    wftSyncState.pendingPortfolioPush = true;
    wftSyncState.pendingSettingsPush = true;
    wftSyncState.pendingDeletionsPush = true;
    const syncState = () => [wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter, wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush];
    const beforeSync = JSON.stringify(syncState());
    async function invokeStorageFailureAction() {
        if (action === 'student') await removeStudent('Alice');
        if (action === 'session') await deletePortfolioSession('Alice', 'a');
        if (['rename', 'casing', 'emptyRename', 'idRename', 'idRenameMissingMap', 'rosterOnlyRename'].includes(action)) await renameStudent('Alice');
        if (action === 'clear') await clearAllStudents();
        if (action === 'reset') await resetCurrentClassData();
        if (action === 'replacement') return commitPendingPortfolioSync();
        if (action === 'archiveClear') clearCurrentClassAfterSuccessfulArchive();
        if (action === 'classResetMarkers') return resetCurrentClassData();
        if (action === 'add') addStudent();
        if (action === 'import') {
            importStudents({ target: { files: [new File(['Alicia\nDavid'], 'synthetic.txt')], value: 'synthetic' } });
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (action === 'restore') restoreStudentDeletion('Alicia', 'test');
        if (action === 'saveMarkers') saveDeletionsData(getEmptyDeletionsData());
    }
    const setItem = Storage.prototype.setItem;
    let markerWrites = 0;
    Storage.prototype.setItem = function(key, value) {
        if (key === WFT_DELETIONS_STORAGE_KEY) markerWrites++;
        if (key === ({ portfolio: 'wft_portfolio', markers: WFT_DELETIONS_STORAGE_KEY, roster: 'wft_students', settings: 'wft_settings', selection: 'wft_selectedStudent' })[failedKey]) throw new DOMException('Simulated storage failure', 'QuotaExceededError');
        return setItem.call(this, key, value);
    };
    let threw = false, committed;
    try { committed = await invokeStorageFailureAction(); } catch (e) { threw = true; }
    finally { Storage.prototype.setItem = setItem; }
    const failed = { portfolioKept: localStorage.getItem('wft_portfolio') === original,
        markersKept: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY) === originalMarkers,
        settingsKept: localStorage.getItem('wft_settings') === originalSettings,
        roster: students.slice(), storedRoster: JSON.parse(localStorage.getItem('wft_students')),
        selected: selectedStudent, storedSelected: localStorage.getItem('wft_selectedStudent'),
        uiSelected: document.getElementById('studentSelect').value,
        syncKept: beforeSync === JSON.stringify(syncState()), schedules, flushes, markerWrites,
        pendingKept: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === originalPending && !!getPendingPortfolioSync(),
        signatureKept: lastSyncedPortfolioSessionSignature === 'previous-signature',
        visible: !originalData.Alice || !!applyDeletionsToPortfolio(JSON.parse(original), getDeletionsData()).Alice,
        alerts: alerts.slice(), threw, committed, input: document.getElementById('studentNameInput').value };
    const retried = await invokeStorageFailureAction();
    return { failed, retried, portfolio: getPortfolioData(), roster: students, selected: selectedStudent,
        markers: getDeletionsData(), pending: getPendingPortfolioSync(), input: document.getElementById('studentNameInput').value,
        settings: getRawSettings(), markerWritesOnRetry: markerWrites, schedules, flushes };
}

function assertSavedClassBytes(failed) {
    assert.equal(failed.portfolioKept, true, 'saved writing bytes');
    assert.equal(failed.markersKept, true, 'existing deletion log bytes');
    assert.equal(failed.settingsKept, true, 'settings and student identity bytes');
}

function assertRosterSelection(failed) {
    assert.deepEqual(failed.roster, ['Alice', 'Bob'], 'memory roster');
    assert.deepEqual(failed.storedRoster, ['Alice', 'Bob'], 'stored roster');
    assert.equal(failed.selected, 'Alice');
    assert.equal(failed.storedSelected, 'Alice');
    assert.equal(failed.uiSelected, 'Alice');
}

function assertSyncRecovery(failed) {
    assert.equal(failed.syncKept, true, 'pending sync counters and flags');
    assert.equal(failed.schedules, 0, 'no scheduling on failure');
    assert.equal(failed.flushes, 0);
    assert.equal(failed.pendingKept, true, 'pending reassessment preserved');
    assert.equal(failed.signatureKept, true);
    assert.equal(failed.visible, true, 'still-saved writing stays visible to sync');
    assert.ok(failed.threw || failed.committed === false || failed.alerts.some(message => /could not/i.test(message)), 'failure reported');
}

function assertFailureReporting(action, failedKey, failed) {
    if (!['archiveClear', 'restore', 'saveMarkers'].includes(action)) assert.equal(failed.threw, false, 'UI handles failure');
    if (failedKey === 'portfolio') assert.equal(failed.markerWrites, 0, 'no marker before portfolio saves');
    if (failedKey === 'markers') assert.equal(failed.markerWrites, 1, 'one batch marker write');
}

function assertDeletionRenameRetry(action, result) {
    if (action === 'student') assert.equal(result.portfolio.Alice, undefined);
    if (action === 'session') assert.deepEqual(result.portfolio.Alice.sessions.map(s => s.id), ['keep']);
    if (['rename', 'emptyRename', 'casing', 'idRename', 'idRenameMissingMap'].includes(action)) {
        assert.equal(result.portfolio.Alice, undefined);
        assert.ok(result.portfolio[action === 'casing' ? 'ALICE' : 'Alicia']);
    }
}

function assertRenameIdentityRetry(action, result) {
    if (action === 'idRename') {
        assert.equal(result.settings.studentIdMap.Alicia, 'student-alice');
        assert.equal(result.settings.studentIdMap.Alice, 'student-alice');
        assert.equal(result.settings.studentRecords[0].displayName, 'Alicia');
    }
    if (action === 'idRenameMissingMap') {
        assert.ok(result.settings.studentIdMap.Alicia);
        assert.equal(result.settings.studentIdMap.Alice, result.settings.studentIdMap.Alicia);
        assert.equal(result.settings.studentRecords[0].studentId, result.settings.studentIdMap.Alicia);
        assert.equal(result.settings.studentRecords[0].displayName, 'Alicia');
    }
    if (action === 'rosterOnlyRename') { assert.equal(result.portfolio.Alice, undefined); assert.deepEqual(result.roster, ['Alicia', 'Bob']); }
}

function assertClassClearRetry(action, result) {
    if (['clear', 'reset', 'archiveClear'].includes(action)) { assert.deepEqual(result.portfolio, {}); assert.deepEqual(result.roster, []); }
    if (action === 'reset') { assert.ok(result.markers.deletedStudents['student:carol']); assert.ok(result.markers.deletedSessions['session:carol:c']); }
}

function assertReplacementRetry(action, result) {
    if (action === 'replacement') { assert.equal(result.retried, true); assert.equal(result.pending, null); assert.deepEqual(result.portfolio.Alice.sessions.map(s => s.id), ['keep']); assert.deepEqual(result.portfolio.Bob.sessions.map(s => s.id), ['b', 'new']); }
}

function assertResetMarkersRetry(action, result) {
    if (action === 'classResetMarkers') {
        assert.deepEqual(result.portfolio, {}); assert.deepEqual(result.roster, []);
        for (const key of ['session:alice:a', 'session:alice:keep', 'session:bob:b', 'session:carol:c']) assert.ok(result.markers.deletedSessions[key], key);
        assert.ok(result.markers.deletedStudents['student:earlier'], 'Existing markers survive the class reset');
    }
}

function assertRestoreRetry(action, result, failed) {
    if (['add', 'import', 'restore'].includes(action)) assert.equal(result.markers.deletedStudents['student:alicia'], undefined);
    if (action === 'add') { assert.ok(result.roster.includes('Alicia')); assert.equal(failed.input, 'Alicia'); assert.equal(result.input, ''); }
    if (action === 'import') assert.deepEqual(result.roster, ['Alice', 'Alicia', 'Bob', 'David']);
}

async function runDeletionDurability() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const failures = [];
    let passed = 0;
    try {
        const context = await browser.newContext();
        await context.route('**/*', routeLocalAppRequest);
        const cases = createDeletionCases();
        for (const [action, failedKey] of cases) {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof removeStudent === 'function');
            const result = await page.evaluate(exerciseStorageFailure, { action, failedKey });
            try {
                const failed = result.failed;
                assertSavedClassBytes(failed);
                assertRosterSelection(failed);
                assertSyncRecovery(failed);
                assertFailureReporting(action, failedKey, failed);
                assertDeletionRenameRetry(action, result);
                assertRenameIdentityRetry(action, result);
                assertClassClearRetry(action, result);
                assertReplacementRetry(action, result);
                assertResetMarkersRetry(action, result);
                assertRestoreRetry(action, result, failed);
                assert.deepEqual(errors, [], 'no unhandled browser errors');
                passed++;
            } catch (error) { failures.push(`${action}/${failedKey}: ${error.message}`); }
            await page.close();
        }
        console.log(`Deletion durability browser cases: ${passed}/${cases.length} passed, ${failures.length} failed. Synthetic records; all external network blocked.`);
        assert.deepEqual(failures, []);
    } finally { await browser.close(); }
}

runDeletionDurability().catch(error => { console.error(error); process.exitCode = 1; });
