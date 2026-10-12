const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const cases = [];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext();
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
        });
        const specs = [];
        for (const stage of ['input', 'confirmation']) {
            for (const action of ['save', 'other-save', 'roster-settings', 'source-remove', 'source-rename', 'target-roster', 'target-portfolio', 'cancel', 'corrupt', 'delete-session']) specs.push({ stage, action });
        }
        for (const failedKey of ['wft_portfolio', 'wft_deletions', 'wft_students', 'wft_selectedStudent', 'wft_settings']) specs.push({ stage: 'confirmation', action: 'failed-write', failedKey });
        for (const newName of ['Alicia', 'ALICE', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) specs.push({ stage: 'confirmation', action: 'ordinary', newName });
        for (const oldName of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) specs.push({ stage: 'confirmation', action: 'save', oldName });
        specs.push({ stage: 'confirmation', action: 'roster-only' }, { stage: 'confirmation', action: 'read-failure' });
        for (const spec of specs) {
            const page = await context.newPage();
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            let observed;
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
                await page.evaluate(spec => {
                    const oldName = spec.oldName || 'Alice';
                    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                    localStorage.clear(); wftStudentChangeRecovery = null; WFT_STUDENT_ID_MAP_V1 = true;
                    const entry = id => ({ id, originalText: 'Synthetic writing ' + id, images: [{ id: 'photo', imageId: 'image-' + id, imageRevision: 'revision-' + id, driveFileId: 'synthetic-drive-' + id, name: 'synthetic.jpg' }] });
                    const sourceIds = ['save', 'cancel', 'failed-write'].includes(spec.action) ? ['first'] : ['first', 'keep'];
                    localStorage.setItem('wft_portfolio', JSON.stringify({ [oldName]: { sessions: sourceIds.map(entry) }, Bob: { sessions: [entry('bob')] } }));
                    localStorage.setItem('wft_students', JSON.stringify([oldName, 'Bob']));
                    localStorage.setItem('wft_selectedStudent', oldName);
                    localStorage.setItem('wft_settings', JSON.stringify({ students: [oldName, 'Bob'], studentIdMap: { [oldName]: 'id-alice', Bob: 'id-bob' }, studentRecords: [{ studentId: 'id-alice', displayName: oldName, legacyNameKeys: [oldName] }], unknown: 'preserve' }));
                    localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(getEmptyDeletionsData()));
                    if (spec.action === 'roster-only') localStorage.setItem('wft_portfolio', '{}');
                    students = [oldName, 'Bob']; selectedStudent = oldName; renderStudentList(); populateStudentDropdown();
                    globalThis.renameAlerts = []; window.alert = text => renameAlerts.push(text);
                    globalThis.renameSnapshot = () => ({ bytes: Object.fromEntries(['wft_portfolio', WFT_DELETIONS_STORAGE_KEY, 'wft_students', 'wft_selectedStudent', 'wft_settings'].map(key => [key, localStorage.getItem(key)])), roster: students.slice(), selected: selectedStudent, uiSelected: document.getElementById('studentSelect').value, counters: [wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter], pending: [wftSyncState.pendingPortfolioPush, wftSyncState.pendingSettingsPush, wftSyncState.pendingDeletionsPush] });
                    globalThis.renameMutate = () => {
                        if (['save', 'cancel', 'failed-write'].includes(spec.action)) saveStudentSession(oldName, entry('second'));
                        if (spec.action === 'other-save') saveStudentSession('Bob', entry('second-bob'));
                        if (spec.action === 'roster-settings') {
                            document.getElementById('studentNameInput').value = 'Carol'; addStudent();
                            const settings = getRawSettings(); settings.unknown = 'newer'; settings.studentIdMap.Carol = 'id-carol'; settings.studentRecords.push({ studentId: 'id-carol', displayName: 'Carol', legacyNameKeys: ['Carol'] });
                            localStorage.setItem('wft_settings', JSON.stringify(settings));
                            saveStudentSession('Carol', entry('carol'));
                        }
                        if (spec.action === 'source-remove' || spec.action === 'source-rename') {
                            const portfolio = getLocalPortfolioSnapshot(), deletions = getDeletionsData(), settings = getRawSettings();
                            if (spec.action === 'source-rename') { portfolio.Ally = portfolio.Alice; updateStudentRecordOnRename('Alice', 'Ally', settings); }
                            delete portfolio.Alice; recordStudentDeletion('Alice', deletions);
                            saveWftStudentChange({ portfolio, deletions, settings, students: spec.action === 'source-remove' ? ['Bob'] : ['Ally', 'Bob'], selectedStudent: 'Bob' });
                            renderStudentList(); populateStudentDropdown(); document.getElementById('studentSelect').value = 'Bob';
                        }
                        if (spec.action === 'target-roster') { document.getElementById('studentNameInput').value = 'ALICIA'; addStudent(); }
                        if (spec.action === 'target-portfolio') saveStudentSession('ALICIA', entry('target'));
                        if (spec.action === 'corrupt') localStorage.setItem('wft_portfolio', '{broken synthetic portfolio');
                        if (spec.action === 'delete-session') removeStudentSession('Alice', 'first');
                        globalThis.renameBefore = renameSnapshot();
                        if (spec.action === 'failed-write') {
                            const original = Storage.prototype.setItem;
                            Storage.prototype.setItem = function(key, value) { if (key === spec.failedKey) throw new DOMException('Synthetic write failure', 'QuotaExceededError'); return original.call(this, key, value); };
                            globalThis.renameRestoreStorage = () => { Storage.prototype.setItem = original; };
                        }
                        if (spec.action === 'read-failure') {
                            const original = Storage.prototype.getItem;
                            Storage.prototype.getItem = function(key) { if (key === 'wft_portfolio') throw Error('Synthetic read failure'); return original.call(this, key); };
                            globalThis.renameRestoreStorage = () => { Storage.prototype.getItem = original; };
                        }
                    };
                    globalThis.renameDone = false; globalThis.renameError = null;
                    renameStudent(oldName).catch(e => { renameError = e.message; }).finally(() => { renameDone = true; });
                }, spec);
                await page.locator('#wftTextInputField').waitFor();
                if (spec.stage === 'input') await page.evaluate(() => renameMutate());
                if (spec.stage === 'input' && spec.action === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
                else {
                    await page.locator('#wftTextInputField').fill(spec.newName || 'Alicia');
                    await page.getByRole('button', { name: 'Save Name', exact: true }).click();
                    await page.waitForFunction(() => renameDone || !!document.getElementById('wftConfirmTitle'));
                    if (await page.locator('#wftConfirmTitle').count()) {
                        if (spec.stage === 'confirmation') await page.evaluate(() => renameMutate());
                        await page.getByRole('button', { name: spec.action === 'cancel' ? 'Cancel' : 'Rename Student', exact: true }).click();
                    }
                }
                await page.waitForFunction(() => renameDone);
                observed = JSON.parse(await page.evaluate(() => {
                    if (globalThis.renameRestoreStorage) renameRestoreStorage();
                    return JSON.stringify({ before: renameBefore, after: renameSnapshot(), alerts: renameAlerts, error: renameError, dialogs: document.querySelectorAll('.wft-confirm-backdrop').length, polluted: Object.hasOwn(Object.prototype, 'sessions') });
                }));
                assert.deepEqual(errors, []); assert.equal(observed.error, null); assert.equal(observed.dialogs, 0); assert.equal(observed.polluted, false);
                if (['source-remove', 'source-rename', 'target-roster', 'target-portfolio', 'cancel', 'corrupt', 'failed-write', 'read-failure'].includes(spec.action)) {
                    assert.deepEqual(observed.after, observed.before, 'Invalid/cancelled/failed rename must retain current storage, roster, selection and sync state');
                    assert.equal(observed.alerts.some(text => /^Student renamed to/.test(text)), false, 'No false success');
                    if (spec.action !== 'cancel') assert.ok(observed.alerts.some(text => /roster|portfolio|could not/i.test(text)), 'Teacher gets clear failure feedback');
                } else {
                    const portfolio = JSON.parse(observed.after.bytes.wft_portfolio), settings = JSON.parse(observed.after.bytes.wft_settings), newName = spec.newName || 'Alicia';
                    assert.equal(Object.hasOwn(portfolio, spec.oldName || 'Alice'), false);
                    const ids = spec.action === 'roster-only' ? [] : spec.action === 'delete-session' ? ['keep'] : spec.action === 'save' ? ['first', 'second'] : ['first', 'keep'];
                    assert.deepEqual((portfolio[newName]?.sessions.map(s => s.id) || []).sort(), ids.sort());
                    for (const session of portfolio[newName]?.sessions || []) { assert.equal(session.images[0].imageId, 'image-' + session.id); assert.equal(session.images[0].imageRevision, 'revision-' + session.id); assert.equal(session.images[0].driveFileId, 'synthetic-drive-' + session.id); }
                    if (spec.action === 'other-save') assert.deepEqual(portfolio.Bob.sessions.map(s => s.id).sort(), ['bob', 'second-bob']);
                    if (spec.action === 'roster-settings') { assert.ok(observed.after.roster.includes('Carol')); assert.equal(portfolio.Carol.sessions[0].id, 'carol'); assert.equal(settings.studentIdMap.Carol, 'id-carol'); assert.equal(settings.studentRecords[1].displayName, 'Carol'); }
                    assert.equal(settings.unknown, spec.action === 'roster-settings' ? 'newer' : 'preserve');
                    assert.equal(settings.studentIdMap[newName], 'id-alice'); assert.equal(settings.studentIdMap[spec.oldName || 'Alice'], 'id-alice'); assert.equal(settings.studentRecords[0].displayName, newName);
                    assert.equal(observed.after.selected, newName); assert.equal(observed.after.uiSelected, newName); assert.ok(observed.alerts.some(text => text === 'Student renamed to ' + newName + '.'));
                    const markers = JSON.parse(observed.after.bytes.wft_deletions);
                    assert.equal(!!markers.deletedStudents['student:' + (spec.oldName || 'Alice').toLowerCase()], newName !== 'ALICE');
                }
                cases.push({ ...spec, passed: true, observed });
            } catch (e) { cases.push({ ...spec, passed: false, error: e.message, observed }); }
            finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, fixture: 'Full app, native Edge dialogs, real saveStudentSession/storage/ID/deletion/UI helpers; external requests blocked; synthetic records only.', passed: cases.filter(c => c.passed).length, failed: cases.filter(c => !c.passed).length, cases }, null, 2));
    const failed = cases.filter(c => !c.passed);
    console.log(JSON.stringify({ passed: cases.length - failed.length, total: cases.length, failures: failed.map(({ observed, ...rest }) => rest) }, null, 2));
    assert.equal(failed.length, 0, 'Rename confirmation cases');
})().catch(e => { console.error(e); process.exitCode = 1; });
