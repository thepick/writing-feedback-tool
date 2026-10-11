const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream', body: fs.readFileSync(file) });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof analyzeWriting === 'function');
        const result = await page.evaluate(async () => {
            scheduleWftCloudSync = () => {};
            stopWftSyncPolling();
            const alerts = [];
            window.alert = message => alerts.push(message);
            const text = 'Yesterday I went to the park with my family and we played near the big trees. My sister brought a red ball and we took turns throwing it to each other. After a while we sat down on a blanket and ate the lunch that my mother had packed. Then we walked around the pond and watched the ducks swimming in the water. I felt happy because we had spent a wonderful day together.';
            document.getElementById('studentWriting').value = text;
            localStorage.setItem('wft_settings', JSON.stringify({ assessScriptQuality: true, classGradeLevel: 5 }));
            document.getElementById('assessScriptQuality').checked = true;
            localStorage.setItem('wft_students', JSON.stringify(['Alice']));
            students = ['Alice']; selectedStudent = 'Alice';
            populateStudentDropdown();
            selectedImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
            selectedImages = [{ id: 'test-image', name: 'test.png', dataUrl: selectedImageDataUrl }];
            const core = ['Ideas & Details', 'Grammar', 'Word Choice', 'Organization', 'Flow', 'Spelling & Punctuation'];
            const labels = ['1. Clear Ideas & Details', '2. Grammar', '3. Word Choice', '4. Organization', '5. Flow', '6. Spelling & Punctuation'];
            const criteria = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
            const outcomes = [];
            for (const [type, value, expected] of [['HANDWRITTEN', 'Missing', null], ['MIXED', 4, 8], ['NOT_SCORABLE', 5, null]]) {
                let calls = 0;
                callOpenRouter = async () => {
                    calls++;
                    if (calls === 1) return '# Corrected Story\n' + text;
                    if (calls === 2) return '**Quick Rubric:**\n' + core.map(key => '- ' + key + ': 8/10 - Add one clear detail.').join('\n');
                    return labels.map(label => '**' + label + ':** 8/10\n- Evidence: Your ideas are clear.\n- Growth Tip: Add one clear detail.').join('\n') + '\n## Grow Goal Selection\n**Your Writing Strength:** You described a family trip.';
                };
                callOpenRouterImage = async () => '**Source Type:** ' + type + '\n**Source Type Reason:** Test image classification.\n'
                    + criteria.map(label => '- ' + label + ': ' + value + '/5').join('\n')
                    + '\n- Neatness: ' + (expected == null ? 'Missing' : expected) + '/10 - Test image observation.';
                await analyzeWriting();
                const pending = getPendingPortfolioSync();
                const scores = { ...latestAnalysisData.categoryScores };
                delete scores.Neatness;
                const outcome = { type, calls, score: latestAnalysisData.categoryScores.Neatness,
                    source: latestAnalysisData.detailed.categories.Neatness.sourceType,
                    overall: latestAnalysisData.overall, withoutNeatness: computeOverallScore(scores, getGradeProfile()),
                    pendingScore: pending.sessionData.categoryScores.Neatness, pendingAssessed: pending.sessionData.neatnessAssessed,
                    committed: commitPendingPortfolioSync() };
                const saved = getPortfolioData().Alice.sessions.find(session => session.id === pending.sessionData.id);
                outcome.savedScore = saved.categoryScores.Neatness;
                outcome.savedAssessed = saved.neatnessAssessed;
                outcome.savedOverall = saved.overall;
                outcomes.push(outcome);
            }
            return { outcomes, alerts };
        });
        for (const outcome of result.outcomes) {
            const expected = outcome.type === 'MIXED' ? 8 : null;
            assert.equal(outcome.calls, 3);
            assert.equal(outcome.score, expected, JSON.stringify(outcome));
            assert.equal(outcome.source, outcome.type);
            assert.equal(outcome.pendingScore, expected);
            assert.equal(outcome.savedScore, expected);
            assert.equal(outcome.pendingAssessed, expected != null);
            assert.equal(outcome.savedAssessed, expected != null);
            assert.equal(outcome.savedOverall, outcome.overall);
            assert.equal(outcome.committed, true);
            if (expected == null) assert.equal(outcome.overall, outcome.withoutNeatness, 'Unscored handwriting must not lower the overall grade');
        }
        assert.deepEqual(result.alerts, []);
        assert.deepEqual(errors, []);
        console.log('Browser neatness test passed: full analysis excludes missing/unscorable handwriting from the overall grade, retains valid mixed-source scores and saves the correct portfolio metadata.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
