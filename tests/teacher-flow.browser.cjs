const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const routeApp = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    const tests = {
        'finding10-mobile-setup-and-privacy': async page => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.reload({ waitUntil: 'load' });
            assert.equal(await page.evaluate(() => window.scrollY), 0, 'Startup must retain the setup guidance at the top of the page');
            assert.equal(await page.locator('#studentWriting').evaluate(el => el === document.activeElement), false, 'Startup must not open a phone keyboard');
            assert(await page.getByRole('button', { name: 'Set up AI access', exact: true }).isVisible());
            assert(await page.getByRole('button', { name: 'Add first student', exact: true }).isVisible());
            assert.match(await page.locator('#setupReadiness').innerText(), /Drive is optional/i);
            assert(await page.locator('#setupReadiness a[href="privacy.html"]').isVisible());
            const positions = await page.locator('.student-selector, .writing-box-wrap, #writingDraftStatus, #assessmentContext, .workflow-status').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top));
            assert.deepEqual(positions, positions.slice().sort((a, b) => a - b), 'Mobile reading order follows the workflow');
            await page.getByRole('button', { name: 'Set up AI access', exact: true }).click();
            assert(await page.locator('#apiKeyInput').evaluate(el => el === document.activeElement));
            assert(await page.locator('a[href="https://openrouter.ai/settings/keys"]').isVisible());
        },
        'finding11-quiet-empty-and-current-report': async page => {
            assert(await page.locator('#reportEmptyState').isVisible());
            assert(await page.locator('#reportContent').isHidden());
            await page.locator('#studentWriting').fill('Synthetic writing.');
            await page.evaluate(() => { latestAnalysisData = { inputContext: captureCurrentWritingContext(), overall: 70, categoryScores: {}, detailed: {} }; syncUiState(); });
            assert(await page.locator('#reportEmptyState').isHidden());
            assert(await page.locator('#reportContent').isVisible());
            assert(await page.evaluate(() => !!(document.getElementById('growGoalBox').compareDocumentPosition(document.getElementById('correctedStory')) & Node.DOCUMENT_POSITION_FOLLOWING)));
            await page.locator('#studentWriting').fill('New text invalidates old report.');
            assert(await page.locator('#reportContent').isHidden());
        },
        'finding12-drive-state-visible-while-signed-out': async page => {
            for (const [state, text] of [['', 'Not connected'], ['error', 'Offline - will sync later'], ['error', 'Drive quota or rate limit reached.'], ['error', 'Session expired - please sign in again.'], ['synced', 'Portfolio synced']]) {
                await page.evaluate(([state, text]) => setDriveSyncStatus(state, text), [state, text]);
                assert(await page.locator('#portfolioSaveStatus').isVisible());
                assert((await page.locator('#portfolioSaveStatus').innerText()).includes(text));
                assert.equal(await page.locator('#syncRecoveryAction').isVisible(), state === 'error');
            }
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            assert(await page.locator('#advancedStorageDiagnostics').isVisible());
            assert.equal(await page.locator('#advancedStorageDiagnostics').getAttribute('open'), null);
        },
        'finding12-real-local-commit-awaits-drive-acknowledgment': async page => {
            await page.evaluate(() => {
                stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                students = ['Alice']; saveStudents(); populateStudentDropdown(); document.getElementById('studentSelect').value = 'Alice'; updateSelectedStudent();
                latestAnalysisData = null; WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false; driveAccessToken = 'synthetic-no-network';
                pendingPortfolioSync = { studentName: 'Alice', signature: 'synthetic-save', sessionData: { id: 'synthetic-save', createdAt: '2026-10-31T00:00:00Z', title: 'Synthetic', originalText: 'Protected writing.', categoryScores: {}, images: [] } };
                persistPendingPortfolioSync();
                flushWftCloudSyncNow = () => new Promise(resolve => { window.acknowledgeDriveFixture = success => { if (success) wftSyncState.pendingPortfolioPush = false; resolve(success); }; });
                manualSaveToDrive();
            });
            assert.equal(await page.evaluate(() => getLocalPortfolioSnapshot().Alice.sessions[0].originalText), 'Protected writing.');
            assert.match(await page.locator('#portfolioSaveStatus').innerText(), /saved on this device.*waiting for Drive/i);
            assert.doesNotMatch(await page.locator('#portfolioSaveStatus').innerText(), /Confirmed/);
            await page.evaluate(() => acknowledgeDriveFixture(false));
            await page.waitForFunction(() => !manualSyncInProgress);
            assert.match(await page.locator('#portfolioSaveStatus').innerText(), /Saved locally.*failed/i);
            assert(await page.locator('#syncRecoveryAction').isVisible());
            await page.evaluate(() => { manualSaveToDrive(); acknowledgeDriveFixture(true); });
            await page.waitForFunction(() => !manualSyncInProgress);
            assert.match(await page.locator('#portfolioSaveStatus').innerText(), /Manual sync complete.*Confirmed/i);
        },
        'finding12-signed-out-save-explains-drive-boundary': async page => {
            assert.match(await page.locator('#setupReadiness').innerText(), /Portfolio saving requires a Drive connection/i);
            const result = await page.evaluate(() => {
                stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                students = ['Alice']; saveStudents(); populateStudentDropdown(); document.getElementById('studentSelect').value = 'Alice'; updateSelectedStudent();
                driveAccessToken = ''; latestAnalysisData = null;
                pendingPortfolioSync = { studentName: 'Alice', signature: 'signed-out', sessionData: { id: 'signed-out', originalText: 'Protected signed-out writing.', categoryScores: {}, images: [] } };
                persistPendingPortfolioSync();
                let requested = 0; requestDriveAccess = () => { requested++; };
                const before = localStorage.getItem('wft_portfolio'); manualSaveToDrive();
                return { requested, unchangedPortfolio: before === localStorage.getItem('wft_portfolio'), retainedText: getPendingPortfolioSync().sessionData.originalText };
            });
            assert.deepEqual(result, { requested: 1, unchangedPortfolio: true, retainedText: 'Protected signed-out writing.' });
            assert.match(await page.locator('#portfolioSaveStatus').innerText(), /Connecting to Drive/i);
        },
        'finding13-empty-class-creation-and-explicit-scope': async page => {
            await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
            assert(await page.getByLabel('Student name', { exact: true }).isVisible());
            assert.equal(await page.locator('#toggleRosterBtn').getAttribute('aria-expanded'), 'true');
            assert(await page.getByRole('button', { name: 'Delete class roster and saved writing', exact: true }).isVisible());
            assert(await page.getByRole('button', { name: 'Delete class roster and saved writing', exact: true }).isDisabled(), 'An empty roster must not offer a no-op deletion');
            await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
            assert.match(await page.locator('#portfolioContent').innerText(), /Add.*student/i);
            await page.locator('#portfolioContent button').click();
            assert(await page.getByLabel('Student name', { exact: true }).evaluate(el => el === document.activeElement));
        },
        'finding14-shortcut-and-next-student-preserves-drafts': async page => {
            await page.evaluate(() => { students = ['Alice', 'Bob']; saveStudents(); populateStudentDropdown(); });
            await page.locator('#studentSelect').selectOption('Alice');
            await page.locator('#studentWriting').fill('Alice unfinished text.');
            assert.match(await page.locator('#analysisShortcutHint').innerText(), /Ctrl.*Enter|Cmd.*Enter/);
            await page.evaluate(() => { latestAnalysisData = { inputContext: captureCurrentWritingContext(), gradeLevel: 5, overall: 70, categoryScores: {}, detailed: {} }; lastSyncedPortfolioSessionSignature = getCurrentPortfolioSessionSignature(); wftSyncState.pendingPortfolioPush = false; updateSyncPortfolioButtonState(); });
            await page.locator('#nextStudentBtn').click();
            assert.equal(await page.locator('#studentSelect').inputValue(), 'Bob');
            assert.equal(await page.locator('#studentWriting').inputValue(), '');
            await page.locator('#studentSelect').selectOption('Alice');
            assert.equal(await page.locator('#studentWriting').inputValue(), 'Alice unfinished text.');
        },
        'finding17-context-inheritance-overrides-and-saved-state': async page => {
            await page.evaluate(() => { students = ['Alice']; saveStudents(); populateStudentDropdown(); });
            await page.locator('#studentSelect').selectOption('Alice');
            assert.match(await page.locator('#assessmentContext').innerText(), /Alice.*Grade 5.*class default/i);
            await page.locator('#studentWriting').fill('Previous analysis text.');
            await page.evaluate(() => { latestAnalysisData = { inputContext: captureCurrentWritingContext(), assessmentPolicy: captureAssessmentPolicy(), gradeLevel: 5, overall: 70, categoryScores: {}, detailed: {} }; syncUiState(); });
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            await page.locator('#gradeLevelSelect').selectOption('4');
            await page.locator('#gradeLevelSelect').dispatchEvent('change');
            assert.match(await page.locator('#assessmentContext').innerText(), /Grade 4.*override/i);
            assert.match(await page.locator('#resultAssessmentContext').innerText(), /Grade 5.*class default/i, 'Existing report retains its captured assessment context');
            const strictness = await page.evaluate(() => {
                const previous = latestAnalysisData.assessmentPolicy.grammarStrictness, next = previous === 5 ? 4 : 5;
                const input = document.getElementById('grammarStrictness'); input.value = String(next); input.dispatchEvent(new Event('input', { bubbles: true }));
                return { previous, next };
            });
            assert((await page.locator('#assessmentContext').innerText()).includes('strictness ' + strictness.next + '/5'));
            assert((await page.locator('#resultAssessmentContext').innerText()).includes('strictness ' + strictness.previous + '/5'));
            assert.match(await page.locator('#preferenceSaveStatus').innerText(), /Saved on this device/i);
            assert(await page.locator('#fixedModelDescription').isVisible());
            assert(await page.locator('#modelSelect').isHidden());
        },
        'finding17-preference-failure-preserves-error-state': async page => {
            await page.evaluate(() => { window.alert = () => {}; const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'wft_settings') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return set.call(this, key, value); }; saveWftPreferencesFromForm(); });
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            assert.match(await page.locator('#preferenceSaveStatus').innerText(), /could not be saved/i);
        },
        'finding17-word-target-commit-and-save-status': async page => {
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            await page.locator('#targetWordCount').fill('151');
            assert.match(await page.locator('#preferenceSaveStatus').innerText(), /not.*saved/i);
            await page.locator('#targetWordCount').press('Tab');
            assert.match(await page.locator('#preferenceSaveStatus').innerText(), /Saved on this device/i);
            assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wft_settings')).targetWordCount), '151');
        }
    };
    try {
        for (const [name, test] of Object.entries(tests)) {
            if (process.argv[2] && !name.includes(process.argv[2])) continue;
            const context = await browser.newContext(), page = await context.newPage();
            page.setDefaultTimeout(5000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await context.route('**/*', route => routeApp(route, root));
            try { await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' }); await test(page); assert.deepEqual(errors, []); cases.push({ name, passed: true }); }
            catch (error) { cases.push({ name, passed: false, error: error.message }); }
            finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ cases }, null, 2));
    console.log(JSON.stringify(cases, null, 2));
    assert(cases.length && cases.every(test => test.passed), 'Teacher workflow regression failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
