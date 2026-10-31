const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const localAppRoute = require('./support/local-app-route');
const artifactDir = path.resolve(process.env.WFT_PREVIEW_ARTIFACT_DIR || path.join(process.env.WFT_TEST_REPORT ? path.dirname(process.env.WFT_TEST_REPORT) : path.join(root, 'test-results'), 'notebook-preview'));

(async () => {
    fs.mkdirSync(artifactDir, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const scenario of ['current-short', 'current-long', 'current-photos', 'saved-context', 'saved-legacy']) {
            const context = await browser.newContext({ viewport: { width: 1200, height: 900 } }), page = await context.newPage(), errors = [];
            context.on('page', popup => popup.on('pageerror', error => errors.push(error.message)));
            page.on('pageerror', error => errors.push(error.message));
            page.setDefaultTimeout(5000);
            await context.route('**/*', route => localAppRoute(route, root));
            let preview;
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const fixture = await page.evaluate(scenario => {
                    stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
                    students = ['Current Student', 'Saved Student']; selectedStudent = 'Current Student'; populateStudentDropdown();
                    document.getElementById('studentSelect').value = selectedStudent;
                    document.getElementById('gradeLevelSelect').value = '4';
                    const writing = scenario === 'current-long' ? 'I went to the park. I saw a friendly dog. '.repeat(80) : 'I went to the park. I saw a friendly dog.';
                    document.getElementById('studentWriting').value = writing;
                    const c = document.createElement('canvas'); c.width = 80; c.height = 120;
                    const ctx = c.getContext('2d'); ctx.fillStyle = '#246'; ctx.fillRect(0, 0, 80, 120);
                    const photo = { name: 'Synthetic notebook photo.png', dataUrl: c.toDataURL('image/png'), extractedText: writing };
                    selectedImages = scenario === 'current-photos' ? [photo] : []; syncSelectedImageState();
                    const scores = { 'Ideas & Details': 9, Grammar: 6, 'Word Choice': 5, Organization: 9, Flow: 4, 'Spelling & Punctuation': 9 };
                    const evidence = scenario === 'current-long' ? 'Your story includes a clear place and sequence with specific details about the friendly dog. '.repeat(3) : 'Your story includes clear details about the park.';
                    const categories = Object.fromEntries(Object.keys(scores).map(key => [key, { score: scores[key], evidence, growthTip: 'Use past tense to explain what happened.' }]));
                    latestAnalysisData = { overall: 70, gradeLevel: 5, assessmentPolicy: { gradeProfile: { grade: 5 } }, categoryScores: scores,
                        detailed: { categories, titleSuggestion: 'Current park story', growGoal: 'Use past tense.' }, correctedStory: writing,
                        actualWords: countWords(writing), targetWords: 100, sampleStatus: { status: 'scorable' }, writingGenre: { mainGenre: 'Narrative / Story' }, inputContext: captureCurrentWritingContext() };
                    const session = { id: 'saved-preview', date: '15/10/2026', createdAt: '2026-10-15T06:00:00Z', title: 'Saved park story', gradeLevel: 6,
                        originalText: 'Saved historical writing.', overall: 85, categoryScores: scores, detailedFeedback: { categories }, feedbackSummary: { strength: 'Historical strength.' }, images: [photo] };
                    if (scenario === 'saved-legacy') { delete session.gradeLevel; delete session.date; delete session.createdAt; }
                    session.notebookPrintHtml = buildNotebookPrintHtmlFromPortfolioSession('Saved Student', session);
                    localStorage.setItem('wft_portfolio', JSON.stringify({ 'Saved Student': { sessions: [session] } }));
                    pendingPortfolioSync = { studentName: 'Current Student', signature: 'protected-preview', sessionData: { id: 'pending-preview', originalText: writing, images: selectedImages.slice() } };
                    persistPendingPortfolioSync();
                    fillNotebookSummary();
                    window.previewState = () => JSON.stringify({ writing: document.getElementById('studentWriting').value, selectedStudent, selectedImages,
                        pending: pendingPortfolioSync, portfolio: localStorage.getItem('wft_portfolio'), pendingBytes: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), analysis: latestAnalysisData });
                    window.previewPrintCalls = 0; window.previewBefore = previewState();
                    const nativeOpen = window.open.bind(window);
                    window.open = (...args) => { const popup = nativeOpen(...args); if (popup) popup.print = () => { previewPrintCalls++; }; return popup; };
                    syncUiState();
                    return { expectedDate: new Date().toLocaleDateString('en-GB'), saved: scenario.startsWith('saved'), photo: photo.dataUrl };
                }, scenario);
                const opened = context.waitForEvent('page');
                if (fixture.saved) await page.evaluate(() => printPortfolioNotebookSummary('Saved Student', 'saved-preview'));
                else await page.locator('#printNotebookBtnBottom').click();
                preview = await opened;
                preview.setDefaultTimeout(5000);
                await preview.waitForLoadState('load');
                // The old timer printed at700ms. Waiting beyond that catches accidental automatic OS printing.
                await page.waitForTimeout(900);
                assert.equal(await page.evaluate(() => previewPrintCalls), 0, 'Opening a notebook preview must not start printing');
                assert.equal(await preview.evaluate(() => opener === null), true, 'Keep safe popup isolation');
                assert.equal(await preview.getByRole('heading', { name: 'Notebook preview', exact: true }).count(), 1);
                const controls = await preview.locator('.screen-controls').innerText();
                assert.ok(controls.includes(fixture.saved ? 'Saved portfolio entry' : 'Current analysis'));
                assert.ok(controls.includes(fixture.saved ? 'Saved Student' : 'Current Student'));
                assert.ok(controls.includes(fixture.saved ? 'Saved park story' : 'Current Park Story'));
                assert.ok(controls.includes(scenario === 'saved-legacy' ? 'Grade not recorded' : fixture.saved ? 'Grade 6' : 'Grade 5'), 'Preview must use recorded grade, never live Grade4');
                assert.ok(controls.includes(scenario === 'saved-legacy' ? 'Unknown date' : fixture.saved ? '15/10/2026' : fixture.expectedDate));
                assert.equal(await preview.locator('.page').count(), 2);
                assert.equal(await preview.locator('.page').first().innerText().then(text => text.includes(fixture.saved ? 'Saved Student' : 'Current Student')), true);
                assert.equal(await page.evaluate(() => previewState() === previewBefore), true, 'Opening preview preserves exact current and stored work');
                await preview.waitForFunction(() => typeof fitAllNotebookPages === 'function');
                await preview.evaluate(() => fitAllNotebookPages());
                for (let index = 0; index < 2; index++) await preview.locator('.page').nth(index).screenshot({ path: path.join(artifactDir, scenario + '-screen-page' + (index + 1) + '.png') });
                await preview.emulateMedia({ media: 'print' });
                assert.equal(await preview.locator('.screen-controls').isVisible(), false, 'Preview toolbar must not print');
                const layout = await preview.locator('.page').evaluateAll(pages => pages.map(p => ({ width: p.getBoundingClientRect().width, height: p.clientHeight, scroll: p.scrollHeight, warning: p.classList.contains('fit-warning') })));
                assert.ok(layout.every(p => Math.abs(p.width - 794) <= 1 && Math.abs(p.height - 1123) <= 1 && p.scroll <= p.height + 1 && !p.warning), JSON.stringify(layout));
                const pdf = await preview.pdf({ path: path.join(artifactDir, scenario + '.pdf'), preferCSSPageSize: true, printBackground: true });
                assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 2, 'Actual PDF must contain exactly two pages');
                await preview.emulateMedia({ media: 'screen' });
                await preview.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
                assert.equal(await page.evaluate(() => previewPrintCalls), 1, 'Explicit Print button invokes the OS boundary exactly once');
                const closed = preview.waitForEvent('close');
                await preview.getByRole('button', { name: fixture.saved ? 'Return to portfolio' : 'Return to editing', exact: true }).click();
                await closed;
                assert.equal(await page.evaluate(() => previewState() === previewBefore), true, 'Print and return preserve exact work');
                assert.deepEqual(errors, []);
                cases.push({ scenario, passed: true, layout, photosPreserved: scenario !== 'current-photos' || await page.evaluate(photo => selectedImages[0].dataUrl === photo, fixture.photo) });
            } catch (error) { cases.push({ scenario, passed: false, error: error.message }); }
            finally { await context.close(); }
        }
    } finally { await browser.close(); }
    const report = { suite: 'notebook-preview', cases, artifactDir, boundary: 'Real app, popup/render/fit/PDF and original identity; only OS print invocation counted. Synthetic records/photos; external requests blocked.' };
    fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); assert.deepEqual(cases.filter(row => !row.passed), []);
})().catch(error => { console.error(error); process.exitCode = 1; });
