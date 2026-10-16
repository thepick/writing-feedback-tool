const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const localAppRoute = require('./support/local-app-route');

function seed({ late }) {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    const png = canvas.toDataURL('image/png');
    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
    localStorage.clear(); sessionStorage.clear();
    const saved = { id: 'saved-alice', title: 'Synthetic saved essay', createdAt: '2026-10-01T00:00:00.000Z', gradeLevel: 6,
        originalText: 'Alice saved an older story about a mountain.', sourceType: 'typed+photo', neatnessAssessed: true,
        images: [{ name: 'saved-alice.png', dataUrl: png, imageId: 'saved-photo', imageRevision: 'saved-revision' }] };
    localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [saved] }, Bob: { sessions: [] } }));
    localStorage.setItem('wft_students', JSON.stringify(['Alice', 'Bob']));
    localStorage.setItem('wft_settings', JSON.stringify({ students: ['Alice', 'Bob'], classGradeLevel: 5, gradeLevel: 5, assessScriptQuality: false, targetWordCount: '100' }));
    localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(getEmptyDeletionsData()));
    students = ['Alice', 'Bob']; selectedStudent = 'Bob'; localStorage.setItem('wft_selectedStudent', 'Bob');
    renderStudentList(); populateStudentDropdown(); document.getElementById('studentSelect').value = 'Bob';
    document.getElementById('classGradeLevelSelect').value = '5'; document.getElementById('gradeLevelSelect').value = '5';
    wftStudentGradeLevelOverride = false; document.getElementById('assessScriptQuality').checked = false;
    const writing = late
        ? 'Yesterday I went to the park with my family and we played near the big trees. My sister brought a red ball and we took turns throwing it to each other. After a while we sat down on a blanket and ate the lunch that my mother had packed. Then we walked around the pond and watched the ducks swimming in the water. I felt happy because we had spent a wonderful day together.'
        : 'Bob has current unsaved writing.  Keep the exact spacing.\nSecond line.';
    document.getElementById('studentWriting').value = writing;
    selectedImages = late ? [] : [{ name: 'current-bob.png', dataUrl: png, imageId: 'bob-photo', imageRevision: 'bob-revision' }];
    syncSelectedImageState(); updateSelectedImagePreview();
    activePortfolioReassessmentSource = null; latestAnalysisData = null;
    pendingPortfolioSync = late ? null : { studentName: 'Bob', signature: 'earlier-bob-result', sessionData: { id: 'pending-bob', originalText: writing, images: structuredClone(selectedImages) } };
    persistPendingPortfolioSync(); syncUiState();
    globalThis.fixtureAlerts = []; window.alert = text => fixtureAlerts.push(text);
    globalThis.fixtureSnapshot = () => ({
        bytes: Object.fromEntries(['wft_portfolio', WFT_DELETIONS_STORAGE_KEY, 'wft_students', 'wft_settings', 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY].map(key => [key, localStorage.getItem(key)])),
        writing: document.getElementById('studentWriting').value,
        selectedStudent, studentSelect: document.getElementById('studentSelect').value,
        grade: document.getElementById('gradeLevelSelect').value, classGrade: document.getElementById('classGradeLevelSelect').value,
        gradeOverride: wftStudentGradeLevelOverride, neatness: document.getElementById('assessScriptQuality').checked,
        images: structuredClone(selectedImages), primaryImage: selectedImageDataUrl,
        pending: pendingPortfolioSync ? structuredClone(pendingPortfolioSync) : null,
        source: activePortfolioReassessmentSource ? structuredClone(activePortfolioReassessmentSource) : null,
        latest: latestAnalysisData ? structuredClone(latestAnalysisData) : null,
        genre: structuredClone(currentWritingGenreInfo), genreOverride: manualGenreOverrideValue, correctedHtml: correctedHtmlForDiff,
        output: { corrected: document.getElementById('correctedStory').innerHTML, status: document.getElementById('ocrStatus').textContent },
        analyzing: isAnalyzing
    });
    if (late) {
        const core = ['Ideas & Details', 'Grammar', 'Word Choice', 'Organization', 'Flow', 'Spelling & Punctuation'];
        const labels = ['1. Clear Ideas & Details', '2. Grammar', '3. Word Choice', '4. Organization', '5. Flow', '6. Spelling & Punctuation'];
        const responses = ['# Corrected Story\n' + writing,
            '**Quick Rubric:**\n' + core.map(key => '- ' + key + ': 8/10 - Add one clear detail.').join('\n'),
            labels.map(label => '**' + label + ':** 8/10\n- Evidence: Your ideas are clear.\n- Growth Tip: Add one clear detail.').join('\n')];
        globalThis.fixtureCalls = 0; globalThis.fixtureRequestHeld = false;
        const waiting = new Promise(resolve => { globalThis.fixtureReleaseAnalysis = resolve; });
        callOpenRouter = async () => {
            const response = responses[fixtureCalls++];
            if (fixtureCalls === 1) { fixtureRequestHeld = true; await waiting; }
            return response;
        };
    }
}
async function showAlicePortfolio(page) {
    await page.locator('#portfolioTabBtn').click();
    await page.locator('#portfolioStudentSelect').selectOption('Alice');
    await page.locator('.btn-reassess').waitFor({ state: 'visible' });
}
const cases = [];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const names = ['ordinary-confirm', 'ordinary-cancel', 'source-delete-confirm', 'source-delete-cancel', 'late-analysis-confirm', 'late-analysis-cancel', 'grade-save-failure', 'ordinary-no-dates-confirm', 'legacy-timestamp-confirm', 'pending-read-failure-confirm', 'portfolio-read-failure-confirm', 'pending-parse-failure-confirm', 'storage-only-pending-confirm', 'original-photo-change-confirm', 'source-save-confirm', 'deletion-only-confirm'];
        assert.ok(names.length, 'No native cases selected');
        for (const name of names) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const errors = [], assertions = [];
            page.on('pageerror', e => errors.push(e.message));
            await context.route('**/*', route => localAppRoute(route, root));
            const check = (label, fn) => { try { fn(); assertions.push({ label, passed: true }); } catch (e) { assertions.push({ label, passed: false, error: e.code || e.name }); } };
            const result = { name, assertions, errors };
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => typeof reassessPortfolioSession === 'function');
                await page.evaluate(seed, { late: name.startsWith('late-analysis') });
                if (name === 'ordinary-no-dates-confirm' || name === 'legacy-timestamp-confirm') await page.evaluate(name => {
                    const portfolio = JSON.parse(localStorage.getItem('wft_portfolio'));
                    if (name === 'ordinary-no-dates-confirm') delete portfolio.Alice.sessions[0].createdAt;
                    else delete portfolio.Alice.sessions[0].id;
                    localStorage.setItem('wft_portfolio', JSON.stringify(portfolio));
                    if (name === 'ordinary-no-dates-confirm') { pendingPortfolioSync = null; persistPendingPortfolioSync(); }
                }, name);
                if (name.startsWith('late-analysis')) {
                    await page.locator('#analyzeBtn').click();
                    await page.waitForFunction(() => fixtureRequestHeld);
                }
                await showAlicePortfolio(page);
                if (name === 'legacy-timestamp-confirm') await page.evaluate(() => { globalThis.legacyRun = reassessPortfolioSession('Alice', '2026-10-01T00:00:00.000Z'); });
                else await page.locator('.btn-reassess[data-session="saved-alice"]').click();
                await page.locator('#wftConfirmTitle').waitFor({ state: 'visible' });
                result.dialog = await page.locator('#wftConfirmBody').innerText();
                result.atDialog = await page.evaluate(() => fixtureSnapshot());
                if (name.startsWith('source-delete')) {
                    const other = await context.newPage();
                    other.on('pageerror', e => errors.push(e.message));
                    await other.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
                    await other.waitForFunction(() => typeof reassessPortfolioSession === 'function');
                    await other.evaluate(() => { stopWftSyncPolling(); scheduleWftCloudSync = () => {}; });
                    await showAlicePortfolio(other);
                    await other.locator('.btn-delete[data-session="saved-alice"]').click();
                    await other.getByRole('button', { name: 'Remove Entry', exact: true }).click();
                    await other.waitForFunction(() => !findPortfolioSession('Alice', 'saved-alice'));
                    result.otherTab = await other.evaluate(() => ({ portfolio: localStorage.getItem('wft_portfolio'), deletions: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY), visibleSessionCount: document.querySelectorAll('.session-card').length }));
                    await page.waitForFunction(() => !findPortfolioSession('Alice', 'saved-alice'));
                    // Leave the second tab open so its unload cannot influence the first tab's result.
                    check('Deletion came from second-tab public Remove Entry UI', () => assert.equal(result.otherTab.visibleSessionCount, 0));
                    const sourceExists = await page.evaluate(() => !!findPortfolioSession('Alice', 'saved-alice'));
                    check('First tab sees source deletion before teacher confirms', () => assert.equal(sourceExists, false));
                }
                if (name.startsWith('late-analysis')) {
                    await page.evaluate(() => fixtureReleaseAnalysis());
                    await page.waitForFunction(() => !isAnalyzing && !!pendingPortfolioSync);
                    result.analysisCalls = await page.evaluate(() => fixtureCalls);
                    check('Started analysis finishes and persists Bob result behind the actual dialog', () => assert.equal(result.analysisCalls, 3));
                    check('Dialog did not warn about replacing a result that arrived later', () => assert.equal(/unsynced portfolio result/.test(result.dialog), false));
                }
                if (name === 'source-save-confirm') await page.evaluate(() => {
                    const portfolio = getLocalPortfolioSnapshot(), saved = portfolio.Alice.sessions.find(s => s.id === 'saved-alice');
                    saved.originalText = 'Newer saved Alice writing.'; saved.gradeLevel = 12; saved.images[0].imageRevision = 'new-saved-revision';
                    savePortfolioLocalOnly(portfolio, 'synthetic-competing-source-edit');
                });
                if (name === 'deletion-only-confirm') result.deletionPolicy = await page.evaluate(() => {
                    const source = findPortfolioSession('Alice', 'saved-alice'), deletions = getDeletionsData();
                    recordSessionDeletion('Alice', getSessionKey(source), deletions);
                    saveDeletionsLocalOnly(deletions, 'synthetic-held-sync-deletion-arrival');
                    const savedDeletions = getDeletionsData();
                    const filtered = applyDeletionsToPortfolio(getLocalPortfolioSnapshot(), savedDeletions);
                    return { writer: 'recordSessionDeletion + real saveDeletionsLocalOnly; controlled sync-writer seam',
                        physicalSourcePresent: !!findPortfolioSession('Alice', 'saved-alice'),
                        sourceExcludedByPolicy: !(filtered.Alice && filtered.Alice.sessions.some(s => s.id === 'saved-alice')),
                        sourceCreatedAt: source.createdAt, tombstone: savedDeletions.deletedSessions[getDeletedSessionKey('Alice', 'saved-alice')] };
                });
                if (name === 'original-photo-change-confirm') await page.evaluate(() => { selectedImages[0].originalDataUrl = selectedImages[0].dataUrl; });
                if (name === 'pending-parse-failure-confirm') await page.evaluate(() => { localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, '{broken pending bytes'); });
                if (name === 'storage-only-pending-confirm') {
                    const previous = await page.evaluate(() => localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY));
                    const other = await context.newPage();
                    other.on('pageerror', e => errors.push(e.message));
                    await other.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
                    await other.waitForFunction(() => !!pendingPortfolioSync);
                    await other.locator('#studentSelect').selectOption('Bob');
                    await other.evaluate(() => {
                        stopWftSyncPolling(); scheduleWftCloudSync = () => {};
                        pendingPortfolioSync.sessionData.originalText = 'New pending payload with the same ID and signature.';
                        persistPendingPortfolioSync();
                    });
                    await page.waitForFunction(previous => localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) !== previous, previous);
                }
                result.before = await page.evaluate(() => fixtureSnapshot());
                if (name === 'deletion-only-confirm') {
                    check('Real newer tombstone excludes the still-present source by actual deletion policy', () => {
                        assert.equal(result.deletionPolicy.physicalSourcePresent, true);
                        assert.equal(result.deletionPolicy.sourceExcludedByPolicy, true);
                        assert.ok(Date.parse(result.deletionPolicy.tombstone.deletedAt) > Date.parse(result.deletionPolicy.sourceCreatedAt));
                    });
                    check('Only deletion bytes changed while the real confirmation was held', () => {
                        for (const key of ['writing', 'selectedStudent', 'studentSelect', 'grade', 'classGrade', 'gradeOverride', 'neatness', 'images', 'primaryImage', 'source', 'pending', 'latest', 'genre', 'genreOverride', 'correctedHtml', 'output']) assert.deepEqual(result.before[key], result.atDialog[key], key);
                        for (const key of ['wft_portfolio', 'wft_settings', 'wft_selectedStudent', 'wft_students', 'wft_pending_portfolio_sync_v1']) assert.equal(result.before.bytes[key], result.atDialog.bytes[key], key);
                        assert.notEqual(result.before.bytes.wft_deletions, result.atDialog.bytes.wft_deletions);
                    });
                }
                if (name === 'source-save-confirm') check('Competing save changes the same stored source ID instead of adding a duplicate', () => {
                    const sessions = JSON.parse(result.before.bytes.wft_portfolio).Alice.sessions;
                    assert.equal(sessions.length, 1); assert.equal(sessions[0].id, 'saved-alice'); assert.equal(sessions[0].originalText, 'Newer saved Alice writing.');
                });
                if (name === 'storage-only-pending-confirm') check('Storage-only update leaves cached runtime and other saved inputs unchanged', () => {
                    assert.deepEqual(result.before.pending, result.atDialog.pending);
                    for (const key of ['wft_settings', 'wft_selectedStudent', 'wft_portfolio']) assert.equal(result.before.bytes[key], result.atDialog.bytes[key], key);
                    assert.notEqual(result.before.bytes.wft_pending_portfolio_sync_v1, result.atDialog.bytes.wft_pending_portfolio_sync_v1);
                });
                if (name === 'legacy-timestamp-confirm' || name === 'ordinary-no-dates-confirm') await page.waitForTimeout(20);
                if (name === 'pending-read-failure-confirm') await page.evaluate(() => {
                    const original = Storage.prototype.getItem;
                    Storage.prototype.getItem = function(key) { if (key === PENDING_PORTFOLIO_SYNC_KEY) { Storage.prototype.getItem = original; throw new Error('Synthetic pending read failure'); } return original.call(this, key); };
                    globalThis.fixtureRestoreStorage = () => { Storage.prototype.getItem = original; };
                });
                if (name === 'portfolio-read-failure-confirm') await page.evaluate(() => {
                    const original = Storage.prototype.getItem;
                    Storage.prototype.getItem = function(key) { if (key === 'wft_portfolio') { Storage.prototype.getItem = original; throw new Error('Synthetic portfolio read failure'); } return original.call(this, key); };
                    globalThis.fixtureRestoreStorage = () => { Storage.prototype.getItem = original; };
                });
                if (name === 'grade-save-failure') await page.evaluate(() => {
                    const original = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (key === 'wft_settings') throw new DOMException('Synthetic settings failure', 'QuotaExceededError'); return original.call(this, key, value); };
                    globalThis.fixtureRestoreStorage = () => { Storage.prototype.setItem = original; };
                });
                await page.getByRole('button', { name: name.endsWith('-cancel') ? 'Cancel' : 'Load for Reassessment', exact: true }).click();
                await page.waitForFunction(() => !document.getElementById('wftConfirmTitle'));
                if (!name.endsWith('-cancel') && name !== 'grade-save-failure') await page.waitForFunction(() => !/Restoring/.test(document.getElementById('ocrStatus').textContent));
                result.after = await page.evaluate(() => { if (globalThis.fixtureRestoreStorage) fixtureRestoreStorage(); return fixtureSnapshot(); });
                result.alerts = await page.evaluate(() => fixtureAlerts);
                check('No page errors', () => assert.deepEqual(errors, []));
                check('Saved portfolio/deletion bytes stay current through confirmation', () => {
                    assert.equal(result.after.bytes.wft_portfolio, result.before.bytes.wft_portfolio);
                    assert.equal(result.after.bytes.wft_deletions, result.before.bytes.wft_deletions);
                });
                if (name.endsWith('-cancel') || name === 'grade-save-failure' || name === 'pending-read-failure-confirm' || name === 'portfolio-read-failure-confirm' || name === 'pending-parse-failure-confirm') {
                    check('Cancellation or failed grade save preserves exact current work and preferences', () => assert.deepEqual(result.after, result.before));
                    if (name === 'grade-save-failure') check('Failed grade save tells teacher that current writing was kept', () => assert.ok(result.alerts.some(t => /current writing was kept/.test(t))));
                    if (name !== 'grade-save-failure' && !name.endsWith('-cancel')) check('Failed evidence read/parse tells teacher to retry without losing work', () => assert.ok(result.alerts.some(t => /could not be checked.*kept.*try again/.test(t))));
                } else if (name === 'ordinary-confirm' || name === 'ordinary-no-dates-confirm' || name === 'legacy-timestamp-confirm') {
                    check('Ordinary confirm loads original text, owner, source, grade and photo; intentionally clears pre-existing pending result', () => {
                        assert.equal(result.after.writing, 'Alice saved an older story about a mountain.');
                        assert.equal(result.after.selectedStudent, 'Alice'); assert.equal(result.after.studentSelect, 'Alice');
                        assert.equal(result.after.grade, '6'); assert.equal(result.after.images[0].imageId, 'saved-photo');
                        assert.equal(result.after.source.sourceSessionId, name === 'legacy-timestamp-confirm' ? '2026-10-01T00:00:00.000Z' : 'saved-alice'); assert.equal(result.after.pending, null);
                        assert.equal(result.after.bytes.wft_pending_portfolio_sync_v1, null, 'ordinary success clears stored pending');
                        assert.equal(/unsynced portfolio result/.test(result.dialog), name !== 'ordinary-no-dates-confirm');
                    });
                } else if (name === 'source-delete-confirm') {
                    check('Stale source gives teacher an explicit review/retry notice', () => assert.ok(result.alerts.some(t => /changed.*dialog.*review.*try again/.test(t))));
                    check('Deleted source must not replace current writing after held confirmation', () => assert.equal(result.after.writing, result.before.writing));
                    check('Deleted source must not publish a stale reassessment owner', () => assert.deepEqual(result.after.source, result.before.source));
                    check('Deleted source must preserve current pending writing/photo result', () => assert.deepEqual(result.after.pending, result.before.pending));
                    check('Deleted source must preserve current grade and photo', () => { assert.equal(result.after.grade, result.before.grade); assert.deepEqual(result.after.images, result.before.images); });
                } else if (name === 'late-analysis-confirm') {
                    check('Changed pending work gives teacher an explicit review/retry notice', () => assert.ok(result.alerts.some(t => /changed.*dialog.*review.*try again/.test(t))));
                    check('Newly completed pending result must remain durable after an older confirmation', () => assert.equal(result.after.bytes.wft_pending_portfolio_sync_v1, result.before.bytes.wft_pending_portfolio_sync_v1));
                    check('Newly completed result must retain its runtime owner and report', () => { assert.deepEqual(result.after.pending, result.before.pending); assert.deepEqual(result.after.latest, result.before.latest); });
                    check('Newly completed result must keep its writing/owner until teacher reviews the changed context', () => { assert.equal(result.after.writing, result.before.writing); assert.equal(result.after.selectedStudent, result.before.selectedStudent); });
                }
                if (['source-delete-confirm', 'late-analysis-confirm', 'storage-only-pending-confirm', 'original-photo-change-confirm', 'source-save-confirm', 'deletion-only-confirm'].includes(name)) {
                    check('Changed work or source refuses old consent with a retry notice', () => assert.ok(result.alerts.some(t => /changed.*dialog.*review.*try again/.test(t))));
                    check('Rejected confirmation preserves complete current work, owner, preferences and report', () => {
                        for (const key of ['writing', 'selectedStudent', 'studentSelect', 'grade', 'classGrade', 'gradeOverride', 'neatness', 'images', 'primaryImage', 'source', 'pending', 'latest', 'genre', 'genreOverride', 'correctedHtml']) assert.deepEqual(result.after[key], result.before[key], key);
                        for (const key of ['wft_selectedStudent', 'wft_settings', 'wft_students', 'wft_pending_portfolio_sync_v1']) assert.equal(result.after.bytes[key], result.before.bytes[key], key);
                        assert.equal(result.after.output.corrected, result.before.output.corrected, 'corrected output');
                    });
                }
            } catch (e) { result.operationalError = e.message; }
            const failed = assertions.filter(a => !a.passed);
            const record = { name, passed: !failed.length && !result.operationalError && !errors.length,
                assertions, pageErrors: errors, operationalError: result.operationalError || null };
            cases.push(record);
            console.log(JSON.stringify({ name, passed: record.passed, checks: assertions.length, failed: failed.map(a => a.label), operationalError: record.operationalError }));
            await context.close();
        }
    } finally { await browser.close(); }
    const failed = cases.filter(c => !c.passed);
    const report = { root, scope: 'Complete shipped app in native Edge; real dialogs, storage and persistence helpers; synthetic data/AI and explicit boundary failures; external origins blocked.',
        count: cases.length, passed: cases.length - failed.length, failed: failed.length,
        assertions: cases.reduce((n, c) => n + c.assertions.length, 0),
        failedAssertions: cases.reduce((n, c) => n + c.assertions.filter(a => !a.passed).length, 0),
        pageErrors: cases.reduce((n, c) => n + c.pageErrors.length, 0),
        operationalErrors: cases.filter(c => c.operationalError).length, cases };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log('Portfolio reassessment: ' + report.passed + '/' + report.count + ' cases, ' + report.assertions + ' checks, ' + report.failedAssertions + ' failed checks.');
    assert.equal(report.count, 16, 'All reassessment cases ran');
    assert.equal(report.assertions, 79, 'All preservation checks and premises ran');
    assert.equal(failed.length, 0, 'Portfolio reassessment: ' + failed.map(c => c.name).join(', '));
})().catch(error => { console.error(error); process.exitCode = 1; });
