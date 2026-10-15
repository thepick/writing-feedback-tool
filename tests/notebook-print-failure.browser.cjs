const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route'), root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const kind of ['current', 'saved']) for (const mode of ['blocked', 'setter-throws', 'setter-ignored', 'close-throws', 'success']) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.context().route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const result = await page.evaluate(async ({ kind, mode }) => {
                    stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); sessionStorage.clear();
                    students = ['Synthetic']; selectedStudent = students[0]; populateStudentDropdown();
                    const writing = 'I play with a friendly dog yesterday. The dog was happy.';
                    document.getElementById('studentWriting').value = writing;
                    localStorage.setItem('wft_students', JSON.stringify(students));
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Synthetic: { sessions: [{ id: 'saved', originalText: writing, overall: 70, title: 'Synthetic story' }] } }));
                    pendingPortfolioSync = { studentName: 'Synthetic', signature: 'keep', sessionData: { id: 'pending', originalText: 'Protected pending writing.', images: [] } }; persistPendingPortfolioSync();
                    const scores = { 'Ideas & Details': 9, Grammar: 6, 'Word Choice': 5, Organization: 9, Flow: 4, 'Spelling & Punctuation': 9 };
                    const categories = Object.fromEntries(Object.keys(scores).map(key => [key, { score: scores[key], evidence: 'Clear ideas.', growthTip: 'Use past tense.' }]));
                    latestAnalysisData = { overall: 70, categoryScores: scores, detailed: { categories, titleSuggestion: 'Synthetic story', growGoal: 'Use past tense.' }, correctedStory: writing, actualWords: 11, targetWords: 100, sampleStatus: { status: 'scorable' }, writingGenre: { mainGenre: 'Narrative / Story' }, inputContext: captureCurrentWritingContext() };
                    const previous = latestAnalysisData, keys = ['wft_portfolio', 'wft_students', PENDING_PORTFOLIO_SYNC_KEY], before = keys.map(key => localStorage.getItem(key));
                    const alerts = []; let attempts = 0, writes = 0, prints = 0, closeAttempts = 0, popup;
                    const nativeOpen = window.open.bind(window);
                    window.alert = text => alerts.push(String(text));
                    window.open = (...args) => {
                        attempts++;
                        if (mode === 'blocked') return null;
                        popup = nativeOpen(...args);
                        const nativeWrite = popup.document.write.bind(popup.document), nativeClose = popup.close.bind(popup);
                        popup.document.write = (...html) => { writes++; return nativeWrite(...html); };
                        popup.print = () => { prints++; };
                        popup.close = () => { closeAttempts++; if (mode === 'close-throws') throw Error('Synthetic close failure'); nativeClose(); };
                        if (mode !== 'success') Object.defineProperty(popup, 'opener', { configurable: true, get: () => window, set: () => { if (mode !== 'setter-ignored') throw Error('Synthetic opener failure'); } });
                        return popup;
                    };
                    if (kind === 'current') printNotebookSummary(); else printPortfolioNotebookSummary('Synthetic', 'saved');
                    await new Promise(resolve => setTimeout(resolve, 850));
                    return { attempts, writes, prints, closeAttempts, popupClosed: !!popup && popup.closed, openerDetached: !!popup && !popup.closed && popup.opener === null, printedText: popup && !popup.closed ? popup.document.body.textContent : '', alerts, protectedBytes: keys.every((key, i) => localStorage.getItem(key) === before[i]), writingRetained: document.getElementById('studentWriting').value === writing, analysisRetained: latestAnalysisData === previous };
                }, { kind, mode });
                const blocked = mode === 'blocked', success = mode === 'success';
                const expectedAlert = blocked ? (kind === 'current' ? 'Please allow pop-ups for this page to print the notebook summary.' : 'Please allow pop-ups for this page to re-print the notebook summary.') : 'Could not safely open the notebook summary for printing. Please try again.';
                const checks = {
                    oneAttempt: result.attempts === 1,
                    writesAndPrints: success ? result.writes === 1 && result.prints === 1 : result.writes === 0 && result.prints === 0,
                    notice: JSON.stringify(result.alerts) === JSON.stringify(success ? [] : [expectedAlert]),
                    isolatedSuccess: !success || result.openerDetached && result.printedText.includes('Synthetic'),
                    failedPopupCleanup: blocked || success || result.closeAttempts === 1 && (mode === 'close-throws' ? !result.popupClosed : result.popupClosed),
                    protectedState: result.protectedBytes && result.writingRetained && result.analysisRetained,
                    noPageErrors: errors.length === 0
                };
                cases.push({ kind, mode, passed: Object.values(checks).every(Boolean), checks, ...result, errors });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, boundary: 'Real popup/Window/document/render/callers. Only blocked window.open, opener property failure, close failure and OS print boundaries substituted; external requests aborted.' }, null, 2));
    assert.equal(cases.length, 10);
    for (const item of cases) assert(item.passed, JSON.stringify(item));
    console.log('Current and saved print isolation: 10 passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
