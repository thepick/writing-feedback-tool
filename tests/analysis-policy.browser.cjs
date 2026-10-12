const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const localAppRoute = require('./support/local-app-route');
const changes = ['grade', 'class', 'override', 'target', 'target-off', 'grammar', 'neatness', 'model', 'genre'];
const cases = ['correction', 'rubric', 'detail', 'photo', 'ocr', 'publish'].flatMap(boundary =>
    changes.map(change => ({ boundary, change })));
for (const change of ['profile-weights', 'profile-grammar', 'profile-wordcount', 'profile-neatness']) cases.push({ boundary: 'detail', change });
for (const boundary of ['correction', 'rubric', 'detail', 'photo', 'ocr', 'retry']) cases.push({ boundary: 'request-' + boundary, change: 'grade' });
for (const boundary of ['typed', 'photo', 'ocr', 'retry-success']) cases.push({ boundary: 'request-' + boundary, change: 'none' });
for (const mode of ['typed', 'photo', 'ocr', 'reassessment', 'no-neatness', 'target-off', 'custom-target', 'low-sample',
    'missing-neatness', 'fallback-neatness', 'grade4-photo', 'grammar-corrections', 'cancel', 'writing', 'student', 'reassessment-change', 'credentials', 'later-report']) {
    cases.push({ boundary: mode, change: 'none' });
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const outcomes = [];
    try {
        for (const scenario of cases.filter(value => !process.env.WFT_POLICY_FILTER || (value.boundary + '/' + value.change).includes(process.env.WFT_POLICY_FILTER))) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => localAppRoute(route, root));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof analyzeWriting === 'function');
            let result;
            try {
                result = await page.evaluate(async ({ boundary, change }) => {
                    const nativeRequest = boundary.startsWith('request-');
                    boundary = boundary.replace(/^request-/, '');
                    scheduleWftCloudSync = () => {};
                    stopWftSyncPolling();
                    const alerts = []; window.alert = value => alerts.push(value);
                    const el = id => document.getElementById(id);
                    const event = (id, value, type = 'change') => {
                        const node = el(id);
                        if (typeof value === 'boolean') node.checked = value; else node.value = value;
                        node.dispatchEvent(new Event(type));
                    };
                    students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown(); el('studentSelect').value = 'Alice';
                    el('gradeLevelSelect').value = '12'; el('classGradeLevelSelect').value = '12'; wftStudentGradeLevelOverride = false;
                    if (boundary === 'grade4-photo') { el('gradeLevelSelect').value = '4'; el('classGradeLevelSelect').value = '4'; }
                    el('targetWordCount').value = '330'; el('useWordCountTarget').checked = true;
                    el('grammarStrictness').value = '3';
                    const text = Array(15).fill('Yesterday we walked to the park and enjoyed the sunshine.').join(' ');
                    el('studentWriting').value = text;
                    const image = { name: 'synthetic.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
                    const hasPhoto = change !== 'none' || ['photo', 'ocr', 'reassessment', 'no-neatness', 'missing-neatness', 'fallback-neatness', 'grade4-photo', 'later-report'].includes(boundary);
                    selectedImages = hasPhoto ? [image] : []; syncSelectedImageState();
                    el('assessScriptQuality').checked = hasPhoto && boundary !== 'no-neatness';
                    saveSettingsToLocalStorage();
                    // Synthetic credentials exercise exclusion without reading any real credential.
                    el('apiKeyInput').value = 'synthetic-policy-key'; saveWftApiKeyFromForm();
                    localStorage.setItem('wft_settings', JSON.stringify({ ...getRawSettings(), apiKey: 'synthetic-legacy-secret', access_token: 'synthetic-access-secret' }));
                    const core = ['Ideas & Details', 'Grammar', 'Word Choice', 'Organization', 'Flow', 'Spelling & Punctuation'];
                    const labels = ['1. Clear Ideas & Details', '2. Grammar', '3. Word Choice', '4. Organization', '5. Flow', '6. Spelling & Punctuation'];
                    const criteria = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
                    const response = (index, writing) => index === 1 ? '# Corrected Story\n' + (boundary === 'grammar-corrections' ? writing.replace(/\bwalked\b/g, '**walked**') : writing)
                        : index === 2 ? '**Quick Rubric:**\n' + core.map(key => '- ' + key + ': 8/10 - Add one clear detail.').join('\n')
                        : labels.map(label => '**' + label + ':** 8/10\n- Evidence: Your ideas are clear.\n- Growth Tip: Add one clear detail.').join('\n');
                    let calls = 0, imageCalls = 0, holding = false;
                    const requests = [];
                    let enter, release;
                    const started = new Promise(resolve => { enter = resolve; });
                    const hold = new Promise(resolve => { release = resolve; });
                    const mutate = () => {
                        if (change === 'grade') event('gradeLevelSelect', '4');
                        if (change === 'class') event('classGradeLevelSelect', '4');
                        if (change === 'override') { event('classGradeLevelSelect', '5'); event('gradeLevelSelect', '12'); }
                        if (change === 'target') event('targetWordCount', '450', 'input');
                        if (change === 'target-off') event('useWordCountTarget', false);
                        if (change === 'grammar') event('grammarStrictness', '5', 'input');
                        if (change === 'neatness') event('assessScriptQuality', false);
                        if (change === 'model') event('modelSelect', Array.from(el('modelSelect').options).find(option => option.value !== el('modelSelect').value).value);
                        if (change === 'genre') event('writingGenreSelect', Array.from(el('writingGenreSelect').options).find(option => option.value !== '__auto__').value);
                        if (change === 'profile-weights') GRADE_PROFILES[12].weights.Grammar += 0.1;
                        if (change === 'profile-grammar') GRADE_PROFILES[12].grammarDensityTables[3][0] = -1;
                        if (change === 'profile-wordcount') GRADE_PROFILES[12].shortfallPenaltyFactor = 0.95;
                        if (change === 'profile-neatness') GRADE_PROFILES[12].neatnessWeight = 0.2;
                        if (boundary === 'cancel') requestStopAnalysis();
                        if (boundary === 'writing') { el('studentWriting').value = 'New writing must remain.'; el('studentWriting').dispatchEvent(new Event('input')); }
                        if (boundary === 'student') { event('studentSelect', 'Bob'); el('studentWriting').value = 'Bob has new writing.'; }
                        if (boundary === 'reassessment-change') activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'other' };
                        if (boundary === 'credentials') { el('apiKeyInput').value = 'synthetic-new-policy-key'; saveWftApiKeyFromForm(); }
                    };
                    const nativeTextRequest = callOpenRouter, nativeImageRequest = callOpenRouterImage;
                    const textResponse = async (model, prompt) => {
                        const index = ++calls;
                        requests.push({ stage: index, model, prompt });
                        const at = boundary === 'rubric' ? 2 : boundary === 'detail' ? 3 : 1;
                        if (holding && index === at && !['photo', 'ocr', 'publish'].includes(boundary)) { enter(); await hold; }
                        return response(index, el('studentWriting').value || text);
                    };
                    const imageResponse = async (model, prompt) => {
                        imageCalls++;
                        const ocr = prompt.startsWith('Transcribe');
                        requests.push({ stage: ocr ? 'ocr' : 'neatness', model, prompt });
                        if (holding && boundary === (ocr ? 'ocr' : 'photo')) { enter(); await hold; }
                        if (ocr) return text;
                        const value = boundary === 'missing-neatness' || boundary === 'fallback-neatness' ? 'Missing' : 4;
                        return '**Source Type:** HANDWRITTEN\n' + criteria.map(label => '- ' + label + ': ' + value + '/5').join('\n')
                            + '\n- Neatness: ' + (boundary === 'missing-neatness' ? 'Missing' : 8) + '/10 - Clear letters.';
                    };
                    callOpenRouter = textResponse;
                    callOpenRouterImage = imageResponse;
                    await analyzeWriting();
                    if (boundary === 'reassessment') {
                        saveStudentSession('Alice', { ...getPendingPortfolioSync().sessionData, id: 'old' });
                    }
                    const previous = latestAnalysisData;
                    const pendingBefore = JSON.stringify(getPendingPortfolioSync());
                    const pendingBytesBefore = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
                    const reportBefore = el('detailedAssessment').innerHTML;
                    const gradeBefore = el('gradeLevelResultNote').textContent;
                    const weightBefore = el('overallScoreNote').textContent;
                    if (nativeRequest) {
                        callOpenRouter = nativeTextRequest; callOpenRouterImage = nativeImageRequest;
                        let retryFailed = false;
                        sleepMs = async () => {};
                        fetch = async (url, options) => {
                            if (url !== 'https://openrouter.ai/api/v1/chat/completions') throw new Error('Unexpected external request');
                            const body = JSON.parse(options.body);
                            const content = body.messages[0].content;
                            const prompt = typeof content === 'string' ? content : content.find(item => item.type === 'text').text;
                            if (['retry', 'retry-success'].includes(boundary) && !retryFailed) {
                                retryFailed = true;
                                return { ok: false, status: 503, text: async () => {
                                    if (holding) { enter(); await hold; }
                                    return JSON.stringify({ error: { message: 'Synthetic provider busy' } });
                                } };
                            }
                            return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: {
                                content: await (typeof content === 'string' ? textResponse : imageResponse)(body.model, prompt)
                            } }] }) };
                        };
                    }
                    if (boundary === 'reassessment' || boundary === 'reassessment-change') activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'old' };
                    if (boundary === 'ocr') { el('studentWriting').value = ''; selectedImages[0].extractedText = ''; syncSelectedImageState(); }
                    if (boundary === 'target-off') event('useWordCountTarget', false);
                    if (boundary === 'custom-target') event('targetWordCount', '175', 'input');
                    if (boundary === 'low-sample') el('studentWriting').value = 'Alice has a dog.';
                    calls = 0; imageCalls = 0; requests.length = 0;
                    holding = change !== 'none' || ['cancel', 'writing', 'student', 'reassessment-change', 'credentials'].includes(boundary);
                    const originalGoalPlan = getGoalPlan;
                    if (boundary === 'publish') getGoalPlan = data => { if (holding) { holding = false; mutate(); } return originalGoalPlan(data); };
                    const running = analyzeWriting();
                    if (holding && boundary !== 'publish') {
                        await Promise.race([started, new Promise((resolve, reject) => setTimeout(() => reject(new Error('Native boundary was not reached')), 5000))]);
                        mutate(); release();
                    }
                    await running;
                    getGoalPlan = originalGoalPlan;
                    const data = latestAnalysisData;
                    const pending = getPendingPortfolioSync();
                    const status = el('debugRaw').textContent;
                    const visibleReport = { grade: el('gradeLevelResultNote').textContent, weights: el('overallScoreNote').textContent,
                        overall: el('overallScore').textContent, assessment: el('detailedAssessment').innerText };
                    const retained = JSON.stringify(pending) === pendingBefore;
                    const bytesRetained = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === pendingBytesBefore;
                    const dataRetained = data === previous;
                    const reportRetained = el('detailedAssessment').innerHTML === reportBefore;
                    const successful = change === 'none' && !['cancel', 'writing', 'student', 'reassessment-change'].includes(boundary);
                    const writingAfterRun = el('studentWriting').value;
                    const pendingBytes = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
                    let saved, committed, fresh, stored, exported;
                    if (successful) {
                        committed = commitPendingPortfolioSync();
                        saved = getPortfolioData().Alice.sessions.find(session => session.id === pending.sessionData.id);
                        stored = JSON.parse(localStorage.getItem('wft_portfolio')).Alice.sessions.find(session => session.id === pending.sessionData.id);
                        exported = buildStudentPortfolioHtml('Alice', getPortfolioData().Alice, 'synthetic-school-year');
                    } else {
                        // Retry adopts the changed native controls, without rewriting the old pending result first.
                        holding = false; calls = 0;
                        if (boundary === 'student') { selectedStudent = 'Bob'; el('studentSelect').value = 'Bob'; }
                        el('studentWriting').value = text;
                        await analyzeWriting();
                        fresh = { grade: latestAnalysisData.gradeLevel, target: latestAnalysisData.targetWords,
                            policy: latestAnalysisData.assessmentPolicy, student: getPendingPortfolioSync().studentName,
                            ideas: latestAnalysisData.categoryScores['Ideas & Details'], overall: latestAnalysisData.overall,
                            model: el('modelSelect').value, scores: latestAnalysisData.categoryScores };
                    }
                    let laterReport;
                    if (boundary === 'later-report') {
                        event('gradeLevelSelect', '4'); event('assessScriptQuality', false); event('targetWordCount', '900', 'input');
                        refreshScoreWeightingDescription(); renderDetailedAssessment(data.detailed); fillNotebookSummary();
                        laterReport = { grade: el('gradeLevelResultNote').textContent, weights: el('overallScoreNote').textContent,
                            detailed: el('detailedAssessment').innerText, notebook: el('notebookDetailedAssessment').innerText };
                    }
                    let strictGrammar;
                    if (boundary === 'grammar-corrections') {
                        event('grammarStrictness', '5', 'input'); calls = 0;
                        await analyzeWriting();
                        strictGrammar = { score: latestAnalysisData.categoryScores.Grammar, strictness: latestAnalysisData.assessmentPolicy && latestAnalysisData.assessmentPolicy.grammarStrictness };
                    }
                    const serialized = JSON.stringify({ data, pending, saved, stored, fresh, requests, laterReport, exported, pendingBytes });
                    return { calls, imageCalls, requests, successful, retained, bytesRetained, dataRetained, reportRetained, status,
                        gradeBefore, weightBefore, alerts, busy: isAnalyzing, writing: el('studentWriting').value,
                        data: data && { grade: data.gradeLevel, overall: data.overall, target: data.targetWords,
                            words: data.actualWords, scores: data.categoryScores, policy: data.assessmentPolicy },
                        pending: pending && pending.sessionData, replaceSource: pending && pending.replaceSource,
                        saved, stored, pendingBytes, committed, fresh, laterReport, writingAfterRun, visibleReport, strictGrammar,
                        secretFree: !/synthetic-(?:legacy|access|policy|new-policy)-(?:secret|key)/.test(serialized),
                        defaults: { split: WFT_SPLIT_STUDENT_FILES_V1, id: WFT_STUDENT_ID_MAP_V1, lazy: WFT_LAZY_PORTFOLIO_LOAD_V1,
                            idb: WFT_INDEXEDDB_CACHE_V1, compaction: WFT_TOMBSTONE_COMPACTION_V1 } };
                }, scenario);
                assert.deepEqual(errors, []);
                assert.equal(result.busy, false);
                assert.equal(result.secretFree, true, 'Credentials must not enter analysis/pending/saved/report/prompt data');
                assert.deepEqual(result.defaults, { split: true, id: false, lazy: false, idb: false, compaction: false });
                if (!result.successful) {
                    assert.equal(result.retained, true, 'Earlier pending analysis must survive');
                    assert.equal(result.bytesRetained, true, 'Durable pending bytes must survive');
                    if (!['ocr', 'request-ocr', 'writing', 'student', 'reassessment-change'].includes(scenario.boundary)) {
                        assert.equal(result.dataRetained, true, 'Earlier successful result must survive');
                        assert.equal(result.reportRetained, true, 'Earlier visible feedback must survive');
                    }
                    assert.match(result.status, scenario.change !== 'none' ? /Assessment settings changed/
                        : scenario.boundary === 'cancel' ? /stopped by user/ : /Writing changed/);
                    if (scenario.change !== 'none') assert.ok(result.alerts.includes('Assessment settings changed. Analyze the current writing again.'));
                    assert.ok(result.fresh.policy);
                    if (['grade', 'class'].includes(scenario.change)) {
                        assert.equal(result.fresh.grade, 4);
                        assert.equal(result.fresh.ideas, 4);
                        assert.equal(result.fresh.overall, 70);
                    }
                    assert.equal(result.fresh.policy.model, result.fresh.model);
                    assert.equal(result.requests.at(-1).model, result.fresh.model);
                    if (scenario.change === 'target') assert.equal(result.fresh.target, 450);
                    if (scenario.change === 'target-off') assert.equal(result.fresh.target, 0);
                    if (scenario.change === 'grammar') assert.equal(result.fresh.policy.grammarStrictness, 5);
                    if (scenario.change === 'neatness') assert.equal(result.fresh.policy.neatnessActive, false);
                    if (scenario.boundary === 'student') assert.equal(result.fresh.student, 'Bob');
                    if (scenario.boundary === 'writing') assert.equal(result.writingAfterRun, 'New writing must remain.');
                    if (scenario.boundary === 'student') assert.equal(result.writingAfterRun, 'Bob has new writing.');
                    if (scenario.boundary === 'ocr' || scenario.boundary === 'request-ocr') assert.equal(result.writingAfterRun, '');
                } else {
                    assert.equal(result.committed, true);
                    assert.equal(result.data.grade, scenario.boundary === 'grade4-photo' ? 4 : 12);
                    assert.ok(result.data.policy);
                    assert.deepEqual(result.pending.assessmentPolicy, result.data.policy);
                    assert.deepEqual(result.saved.assessmentPolicy, result.data.policy);
                    assert.deepEqual(result.stored.assessmentPolicy, result.data.policy);
                    assert.deepEqual(JSON.parse(result.pendingBytes).sessionData.assessmentPolicy, result.data.policy);
                    assert.deepEqual(result.saved.categoryScores, result.data.scores);
                    assert.equal(result.pending.targetWords, result.data.target);
                    assert.equal(result.saved.targetWords, result.data.target);
                    assert.equal(result.saved.overall, result.data.overall);
                    if (scenario.boundary === 'low-sample') { assert.equal(result.data.overall, null); assert.equal(result.calls, 0); }
                    else {
                        assert.equal(result.data.words, 150);
                        assert.equal(result.data.target, scenario.boundary === 'target-off' ? 0 : scenario.boundary === 'custom-target' ? 175 : 330);
                        assert.equal(result.data.scores['Ideas & Details'], scenario.boundary === 'target-off' ? 8 : scenario.boundary === 'custom-target' ? 7 : scenario.boundary === 'grade4-photo' ? 4 : 5);
                        assert.equal(result.data.scores.Grammar, scenario.boundary === 'grammar-corrections' ? 7 : 10);
                        assert.equal(result.data.scores['Word Choice'], 8);
                        assert.equal(result.data.scores.Organization, 8);
                        assert.equal(result.data.scores.Flow, 4);
                        assert.equal(result.data.scores['Spelling & Punctuation'], 8);
                        assert.equal(result.data.overall, scenario.boundary === 'target-off' ? 79 : scenario.boundary === 'custom-target' ? 76 : scenario.boundary === 'grammar-corrections' ? 66 : 70);
                        assert.match(result.visibleReport.grade, new RegExp('Grade ' + result.data.grade));
                        assert.equal(result.visibleReport.overall, result.data.overall + '%');
                    }
                    if (scenario.boundary === 'grade4-photo') assert.match(result.visibleReport.weights, /Neatness \(10%\)/);
                    if (result.strictGrammar) assert.deepEqual(result.strictGrammar, { score: 5, strictness: 5 });
                    if (scenario.boundary === 'missing-neatness') assert.equal(result.data.scores.Neatness, null);
                    if (scenario.boundary === 'fallback-neatness') assert.equal(result.data.scores.Neatness, 8);
                    if (scenario.boundary === 'no-neatness') assert.equal(result.data.scores.Neatness, undefined);
                    if (scenario.boundary === 'reassessment') assert.equal(result.replaceSource.sourceSessionId, 'old');
                    if (result.laterReport) {
                        assert.equal(result.laterReport.grade, result.gradeBefore);
                        assert.equal(result.laterReport.weights, result.weightBefore);
                        assert.match(result.laterReport.detailed, /7\. Neatness/);
                        assert.match(result.laterReport.notebook, /Neatness/);
                    }
                }
                outcomes.push({ ...scenario, passed: true, result });
                console.log('PASS ' + scenario.boundary + '/' + scenario.change);
            } catch (error) {
                outcomes.push({ ...scenario, passed: false, error: error.message, result });
                console.error('FAIL ' + scenario.boundary + '/' + scenario.change + ': ' + error.message);
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_POLICY_REPORT) fs.writeFileSync(process.env.WFT_POLICY_REPORT, JSON.stringify({ root, count: outcomes.length,
        passed: outcomes.filter(value => value.passed).length, cases: outcomes }, null, 2) + '\n');
    assert.equal(outcomes.filter(value => !value.passed).length, 0, 'Native analysis policy cases failed');
    console.log('Native analysis policy tests passed: ' + outcomes.length + ' cases; external services intercepted, synthetic records only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
