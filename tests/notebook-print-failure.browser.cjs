const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route'), root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        for (const kind of ['current', 'saved']) {
            const page = await browser.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const result = await page.evaluate(kind => {
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
                    const alerts = []; let attempts = 0;
                    window.alert = text => alerts.push(String(text)); window.open = () => { attempts++; return null; };
                    if (kind === 'current') printNotebookSummary(); else printPortfolioNotebookSummary('Synthetic', 'saved');
                    return { attempts, alerts, protectedBytes: keys.every((key, i) => localStorage.getItem(key) === before[i]), writingRetained: document.getElementById('studentWriting').value === writing, analysisRetained: latestAnalysisData === previous };
                }, kind);
                assert.equal(result.attempts, 1, 'Native print reaches the blocked popup boundary');
                assert.deepEqual(result.alerts, [kind === 'current' ? 'Please allow pop-ups for this page to print the notebook summary.' : 'Please allow pop-ups for this page to re-print the notebook summary.'], 'Blocked popup gives the actionable message');
                assert(result.protectedBytes && result.writingRetained && result.analysisRetained, 'Blocked popup preserves writing, pending and saved data');
                assert.deepEqual(errors, []); cases.push({ kind, passed: true, ...result });
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases, boundary: 'Only window.open returns null; native current/saved print callers and rendering; real popup success remains covered separately.' }, null, 2));
    assert.equal(cases.length, 2); console.log('Blocked current and saved print popup: 2 passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
