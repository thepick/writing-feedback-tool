const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

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
            return route.fulfill(fs.existsSync(file) ? { contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) } : { status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        const result = await page.evaluate(async () => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [];
            const check = (name, passed, observed) => cases.push({ name, passed: !!passed, observed });
            const missing = [null, undefined, '', '   ', NaN, Infinity, -Infinity];
            const labels = CATEGORY_KEYS;
            const unknown = value => /not enough|not assessed|not scored|missing|no assessment/i.test(value);
            const lowClaim = value => /developing|needs support|still need attention|a few places still need|much more care|very uneven|needs more attention/i.test(value);
            const makeData = score => ({ categoryScores: Object.fromEntries(labels.map(k => [k, score])),
                detailed: { categories: Object.fromEntries(labels.map(k => [k, { score, evidence: 'No assessment note available yet.', growthTip: '' }])) }, sampleStatus: { status: 'scorable' } });
            for (const [i, score] of missing.entries()) {
                check('missing band ' + i, getScoreBandKey(score) === 'missing', getScoreBandKey(score));
                check('missing audit band ' + i, unknown(getAuditScoreBandLabel(score)), getAuditScoreBandLabel(score));
                check('missing label ' + i, getEvidenceLabel(score) === 'Missing', getEvidenceLabel(score));
                check('missing pill ' + i, getAssessmentScorePill(score).includes('score-missing'), getAssessmentScorePill(score));
                check('missing teacher ' + i, unknown(buildEvidenceBasedTeacherComment('Grammar', { score }, [])) && !lowClaim(buildEvidenceBasedTeacherComment('Grammar', { score }, [])));
                check('missing neatness criterion ' + i, unknown(getNeatnessComment('spacing', score)) && !lowClaim(getNeatnessComment('spacing', score)));
                const data = makeData(score);
                check('missing extrema ' + i, getLowestNotebookCategory(data.categoryScores) === null && getHighestNotebookCategory(data.categoryScores) === null);
                check('missing goal ' + i, !/Add a few more details/.test(getGoalPlan(data).growGoal), getGoalPlan(data));
                check('missing closing ' + i, !/solid start|strong writing|good ideas|nice job|clearly|engaging story/.test(buildEncouragingClosing(data)), buildEncouragingClosing(data));
                check('missing global teacher ' + i, unknown(pickTeacherComment(data)) && !/strength in|strong start/.test(pickTeacherComment(data)), pickTeacherComment(data));
                const quick = { quickRubric: { Flow: { score, reason: 'No assessment available.' } } };
                const detail = { categories: { Flow: { score, evidence: 'No assessment available.', growthTip: '' } } };
                applyComputedFlowToFlow(quick, detail, null);
                check('missing flow ' + i, quick.quickRubric.Flow.score === null && detail.categories.Flow.score === null, [quick.quickRubric.Flow.score, detail.categories.Flow.score]);
                const q = Object.fromEntries(labels.map(k => [k, { score, reason: 'No assessment note available yet.' }]));
                polishFeedback(q, data.detailed, 'A clear complete sentence.', 'A clear complete sentence.', null);
                check('no issues unknown convention ' + i, !lowClaim(q['Spelling & Punctuation'].reason) && !lowClaim(data.detailed.categories['Spelling & Punctuation'].evidence), q['Spelling & Punctuation']);
                const feedback = buildStudentFeedbackForCategory('Word Choice', { score, evidence: 'No assessment note available yet.' });
                check('unknown rendered comment ' + i, unknown(feedback.teacherComment) && !lowClaim(feedback.teacherComment), feedback);
                const saved = buildPortfolioDetailedFeedback(data);
                check('unknown saved score ' + i, saved.categories.Flow.score === null, saved.categories.Flow);
                check('unknown notebook score ' + i, renderNotebookDetailedAssessment(data.detailed).includes('Missing') && !renderNotebookDetailedAssessment(data.detailed).includes('Infinity'));
                check('unknown portfolio score ' + i, renderPortfolioFeedbackCategoryBlock('Flow', { score }, false).includes('Not scored'));
                check('unknown category average ' + i, getCategoryAverageMap([{ categoryScores: { Flow: score } }]).Flow === null);
                check('unknown chip color ' + i, getRubricScoreColorClass(score) === 'score-gray');
                check('unknown legacy notebook score ' + i, !renderNotebookDetailedAssessmentFromSavedSession({ categoryScores: { Flow: score } }).includes('Infinity') && !renderNotebookDetailedAssessmentFromSavedSession({ categoryScores: { Flow: score } }).includes(' / 10'));
                const org = { categories: {} };
                applyOrganizationFallback({ quickRubric: { Organization: { score, reason: 'No assessment note available yet.' } } }, org, { Organization: true });
                check('unknown organization fallback ' + i, !/sequence the reader can follow|clear, logical order/.test(org.categories.Organization.evidence + org.categories.Organization.contentOrganization), org.categories.Organization);
                check('unknown grammar clarity ' + i, unknown(buildGrammarPatternNotes(score, 'We went home.', 'We went home.')[4].comment), buildGrammarPatternNotes(score, 'We went home.', 'We went home.')[4]);
                const exported = buildStudentPortfolioHtml('Synthetic', { sessions: [{ id: 'unknown', categoryScores: { Flow: score } }] }, 'Synthetic');
                check('unknown portfolio export chip ' + i, exported.includes('Flow:</strong> -</span>'));
            }
            for (const score of [0, '0', 4, '6', 8, '10']) {
                const data = makeData(null); data.categoryScores.Grammar = score;
                check('mixed extrema ' + score, getHighestNotebookCategory(data.categoryScores) === 'Grammar' && getLowestNotebookCategory(data.categoryScores) === 'Grammar');
                check('valid band ' + score, getScoreBandKey(score) !== 'missing');
                check('valid display ' + score, getEvidenceLabel(score) === score + '/10');
                const q = { quickRubric: { Flow: { score, reason: 'Measured rhythm.' } } }, d = { categories: { Flow: { score } } };
                applyComputedFlowToFlow(q, d, { flowRating: 'Good' });
                check('valid capped flow ' + score, q.quickRubric.Flow.score === Math.min(Number(score), 8) && d.categories.Flow.score === Math.min(Number(score), 8), [q.quickRubric.Flow.score, d.categories.Flow.score]);
            }
            const known = { categories: { Flow: { score: null, evidence: 'Measured rhythm.' } } }, knownQ = { quickRubric: { Flow: { score: 8, reason: 'Measured rhythm.' } } };
            applyComputedFlowToFlow(knownQ, known, null);
            check('missing detailed flow remains unknown with scored quick', known.categories.Flow.score === null);
            const missingQuick = { quickRubric: {} }, scoredDetail = { categories: { Flow: { score: 10 } } };
            applyComputedFlowToFlow(missingQuick, scoredDetail, { flowRating: 'Good' });
            check('missing quick preserves scored detailed flow', missingQuick.quickRubric.Flow.score === null && scoredDetail.categories.Flow.score === 8);
            for (const value of [false, true, [], {}]) check('unsupported score type ' + JSON.stringify(value), getScoreBandKey(value) === 'missing');
            const evidence = { score: null, evidence: 'The sentence begins with lowercase i.', noticeRows: [{ area: 'Capitals', comment: 'Change lowercase i to I.' }] };
            const fb = buildStudentFeedbackForCategory('Spelling & Punctuation', evidence);
            check('missing score retains real evidence', fb.noticeRows[0].comment === evidence.noticeRows[0].comment && fb.teacherComment.includes('Change lowercase i'), fb);
            check('detected convention without score', /change "i" to "I"/.test(buildConventionReason(null, detectConventionIssues('i went home'))));
            const retained = makeData(null), retainedQ = { 'Spelling & Punctuation': { score: null, reason: 'The word park is spelled correctly.' } };
            retained.detailed.categories['Spelling & Punctuation'].evidence = 'The word park is spelled correctly.';
            polishFeedback(retainedQ, retained.detailed, 'We went to the park.', 'We went to the park.', null);
            check('unknown polishing retains supplied evidence', retained.detailed.categories['Spelling & Punctuation'].evidence === 'The word park is spelled correctly.');
            check('known low teacher', /developing/.test(buildEvidenceBasedTeacherComment('Grammar', { score: 4 }, [])));
            check('known high teacher', /strong/.test(buildEvidenceBasedTeacherComment('Grammar', { score: 10 }, [])));
            check('known neatness low and high', /much more care/.test(getNeatnessComment('letterFormation', 1)) && /clear, complete/.test(getNeatnessComment('letterFormation', '5')));
            for (const key of labels) {
                const data = makeData(null); data.categoryScores[key] = 6;
                data.detailed.categories[key] = { score: 6, evidence: 'A synthetic observed example.', growthTip: 'Reread the observed example and revise it.' };
                check('known category goal ' + key, getGoalPlan(data).growGoal !== 'Review my writing with my teacher before choosing a grow goal.');
                check('known category closing ' + key, buildEncouragingClosing(data).length > 50);
                check('known category teacher ' + key, pickTeacherComment(data).includes('synthetic observed example'));
            }
            for (const genre of ['Narrative / Story', 'Opinion / Argument', 'Informational / Explanatory', 'Procedural / How-To', 'Letter / Email', 'Poem / Creative Writing', 'Literary Analysis / Text Response', 'Journal / Reflection', 'Speech / Presentation']) {
                const data = makeData(null); data.writingGenre = makeWritingGenreInfo(genre, genre, 'piece of writing', 'manual', 'manual');
                check('unknown genre closing ' + genre, !/nice job|clearly|engaging story|strong writing/.test(buildEncouragingClosing(data)));
            }
            check('low sample policy retained', /one full sentence/.test(pickTeacherComment({ ...makeData(null), sampleStatus: { status: 'insufficient' } })));
            const criteria = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
            callOpenRouterImage = async () => '**Source Type:** HANDWRITTEN\n' + criteria.map((k, i) => '- ' + k + ': ' + (i === 1 ? 'Missing' : 4) + '/5').join('\n') + '\n- Neatness: 8/10 - Some letters are clear.';
            const neatness = await assessNeatnessFromImage('synthetic-image', 'synthetic-model');
            const neatFb = buildStudentFeedbackForCategory('Neatness', neatness.quickRubric);
            check('valid overall handwriting fallback', neatness.quickRubric.score === 8 && neatness.quickRubric.subScores.spacing === null);
            check('missing criterion neutral under fallback', unknown(neatFb.noticeRows.find(r => r.area === 'Spacing').comment) && !lowClaim(neatFb.noticeRows.find(r => r.area === 'Spacing').comment), neatFb);
            students = ['Alice']; selectedStudent = 'Alice'; populateStudentDropdown(); document.getElementById('studentSelect').value = 'Alice';
            document.getElementById('studentWriting').value = Array(10).fill('We visited the park and played a game together.').join(' ');
            document.getElementById('useWordCountTarget').checked = false;
            document.getElementById('assessScriptQuality').checked = false;
            selectedImages = []; syncSelectedImageState();
            document.getElementById('apiKeyInput').value = 'synthetic-key'; saveWftApiKeyFromForm();
            let calls = 0;
            callOpenRouter = async () => ++calls === 1 ? '# Corrected Story\n' + document.getElementById('studentWriting').value : 'No assessment available.';
            await analyzeWriting();
            check('actual analysis publication', calls === 3 && latestAnalysisData.categoryScores.Flow === null && latestAnalysisData.quickRubric.Flow.score === null, latestAnalysisData.categoryScores);
            check('actual convention rendering', !lowClaim(document.getElementById('detailedAssessment').textContent.split('Spelling & Punctuation')[1]?.split('Growth Tip:')[0] || ''), document.getElementById('detailedAssessment').textContent);
            check('actual pending record', getPendingPortfolioSync().sessionData.categoryScores.Flow === null);
            check('actual saved record', commitPendingPortfolioSync() === true && getPortfolioData().Alice.sessions[0].categoryScores.Flow === null);
            const session = getPortfolioData().Alice.sessions[0];
            check('actual saved feedback', unknown(session.detailedFeedback.categories['Word Choice'].teacherComment), session.detailedFeedback.categories['Word Choice']);
            check('actual notebook snapshot', session.notebookPrintHtml.includes('Missing') && !/>0 \/ 10</.test(session.notebookPrintHtml), { length: session.notebookPrintHtml.length });
            check('actual portfolio export', buildStudentSummaryHtml('Alice', getPortfolioData().Alice, 'Synthetic').includes('Writing Portfolio'));
            check('feature flags preserved', WFT_SPLIT_STUDENT_FILES_V1 === true && WFT_STUDENT_ID_MAP_V1 === false && WFT_LAZY_PORTFOLIO_LOAD_V1 === false && WFT_INDEXEDDB_CACHE_V1 === false && WFT_TOMBSTONE_COMPACTION_V1 === false);
            return { cases, count: cases.length, passed: cases.filter(c => c.passed).length, scope: 'Full native Edge app scripts; synthetic parsed/result data and intercepted model seams; no score/comment logic stubs or live services.' };
        });
        result.errors = errors;
        if (process.env.WFT_FEEDBACK_REPORT) fs.writeFileSync(process.env.WFT_FEEDBACK_REPORT, JSON.stringify(result, null, 2) + '\n');
        const failures = result.cases.filter(c => !c.passed);
        console.log(JSON.stringify({ count: result.count, passed: result.passed, failures, errors }, null, 2));
        assert.deepEqual(errors, []);
        assert.equal(failures.length, 0);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
