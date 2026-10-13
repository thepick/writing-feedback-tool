const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
// Frozen original orchestration at the accepted Stage 1 commit; all other code stays shipped.
const reference = fs.readFileSync(path.join(__dirname, 'fixtures/analysis-pipeline-baseline.js'), 'utf8').replace(/\r\n/g, '\n');
assert.equal(crypto.createHash('sha256').update(reference).digest('hex'), 'b7db67e08a7c289c78aa4080f3c61c18ea0c75dc466638a3f1e9b4f0b826df36');
const cases = [
    ...['insufficient', 'limited', 'typed', 'corrections', 'missing-detail', 'missing-quick', 'missing-both',
        'explicit-missing', 'malformed-detail', 'zero-detail', 'undefined-detail', 'absent-detail-score', 'unsafe-detail', 'guide', 'genre', 'no-student',
        'reassessment', 'save-failure', 'low-save-failure', 'ocr-single', 'ocr-multiple', 'ocr-cached',
        'photo-off', 'handwritten', 'mixed', 'typed-photo', 'unscorable-photo', 'missing-neatness', 'fallback-neatness',
        'native-retry', 'native-timeout'].map(mode => ({ mode })),
    ...[4, 5, 12].flatMap(grade => ['below-threshold', 'at-threshold', 'target-under', 'target-met', 'target-over', 'target-off'].map(mode => ({ mode, grade }))),
    ...[1, 2, 3, 4, 5].map(strictness => ({ mode: 'strictness', strictness })),
    ...['correction', 'rubric', 'neatness', 'detail', 'ocr'].flatMap(boundary => ['cancel', 'writing', 'policy'].map(action => ({ mode: 'held', boundary, action }))),
    { mode: 'held', boundary: 'detail', action: 'student' },
    { mode: 'held', boundary: 'neatness', action: 'images' },
    { mode: 'held', boundary: 'detail', action: 'source' },
    { mode: 'held', boundary: 'detail', action: 'supersede' },
    { mode: 'publish-policy' }
];

async function exercise(page, scenario) {
    return page.evaluate(async scenario => {
        stopWftSyncPolling(); stopDriveAutoSync(); scheduleWftCloudSync = () => {};
        localStorage.clear(); sessionStorage.clear(); driveAccessToken = '';
        const NativeDate = Date;
        window.Date = class extends NativeDate {
            constructor(...args) { super(...(args.length ? args : ['2026-01-15T06:30:00.000Z'])); }
            static now() { return 1768458600000; }
        };
        let seed = 17;
        Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
        const el = id => document.getElementById(id), alerts = [], logs = [], requests = [], effects = [];
        window.alert = message => alerts.push(String(message));
        wftDebugError = (...args) => logs.push(args.map(v => v && v.message ? v.message : String(v)));
        students = ['Synthetic', 'Other']; selectedStudent = 'Synthetic'; populateStudentDropdown(); el('studentSelect').value = 'Synthetic';
        el('classGradeLevelSelect').value = String(scenario.grade || 5); el('gradeLevelSelect').value = String(scenario.grade || 5);
        wftStudentGradeLevelOverride = false; el('grammarStrictness').value = String(scenario.strictness || 3);
        el('useWordCountTarget').checked = scenario.mode !== 'target-off'; el('targetWordCount').value = '175';
        const phrase = 'Yesterday we walked to the park and enjoyed the sunshine.';
        let text = Array(15).fill(phrase).join(' ');
        if (scenario.mode === 'insufficient' || scenario.mode === 'low-save-failure') text = 'My dog';
        if (scenario.mode === 'limited') text = 'We walked to the park and played with our friends. We felt happy.';
        if (scenario.mode.includes('threshold')) {
            const words = getGradeProfile().sampleStatusMinWords.scorable - (scenario.mode === 'below-threshold' ? 1 : 0);
            text = ['We walked home.', 'We played together.', 'We felt happy.', ...Array(words - 9).fill('sunshine')].join(' ') + '.';
        }
        if (scenario.mode === 'target-under') el('targetWordCount').value = '330';
        if (scenario.mode === 'target-met') el('targetWordCount').value = '150';
        if (scenario.mode === 'target-over') el('targetWordCount').value = '100';
        el('writingGenreSelect').value = scenario.mode === 'genre' ? 'opinion' : '__auto__';
        // Some UI options use display strings; choose a real manual genre option.
        if (scenario.mode === 'genre' && !el('writingGenreSelect').value) el('writingGenreSelect').value = [...el('writingGenreSelect').options].find(o => o.value !== '__auto__').value;
        el('studentWriting').value = '  ' + text + '\n';
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
        canvas.getContext('2d').fillRect(0, 0, 2, 2);
        const image = canvas.toDataURL('image/png');
        const photoModes = ['handwritten', 'mixed', 'typed-photo', 'unscorable-photo', 'missing-neatness', 'fallback-neatness', 'photo-off'];
        const hasPhoto = photoModes.includes(scenario.mode) || scenario.mode.startsWith('ocr-') || ['neatness', 'ocr'].includes(scenario.boundary);
        selectedImages = hasPhoto ? [{ name: 'cropped.png', dataUrl: image, originalDataUrl: 'data:image/png;base64,original', extractedText: scenario.mode === 'ocr-cached' ? text : '' }] : [];
        if (scenario.mode === 'ocr-multiple') selectedImages.push({ name: 'second.png', dataUrl: image, extractedText: '' });
        syncSelectedImageState(); el('assessScriptQuality').checked = hasPhoto && !scenario.mode.startsWith('ocr-') && scenario.mode !== 'photo-off' && scenario.boundary !== 'ocr';
        saveSettingsToLocalStorage(); el('apiKeyInput').value = 'synthetic-parity-key'; saveWftApiKeyFromForm();
        if (scenario.mode.startsWith('ocr-') || scenario.boundary === 'ocr') el('studentWriting').value = '';
        if (scenario.mode === 'no-student') { selectedStudent = null; el('studentSelect').value = ''; }
        if (scenario.mode === 'reassessment' || scenario.action === 'source') activePortfolioReassessmentSource = { sourceStudentName: 'Synthetic', sourceSessionId: 'old' };
        const previousPending = { studentName: 'Synthetic', signature: 'earlier', sessionData: { id: 'earlier', originalText: 'Earlier writing.', images: [] } };
        pendingPortfolioSync = previousPending; persistPendingPortfolioSync();
        const pendingBefore = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
        const core = CATEGORY_KEYS.slice(), labels = ['1. Clear Ideas & Details', '2. Grammar', '3. Word Choice', '4. Organization', '5. Flow', '6. Spelling & Punctuation'];
        const criteria = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
        const malicious = '<img src=x onerror="window.injected=true">';
        let step = 0, enter, release;
        const started = new Promise(resolve => { enter = resolve; }), hold = new Promise(resolve => { release = resolve; });
        const respond = async (kind, model, prompt, payloadImage) => {
            requests.push({ kind, model, prompt, image: payloadImage || null });
            if (scenario.mode === 'held' && scenario.boundary === kind) { enter(); await hold; }
            if (kind === 'ocr') return text;
            if (kind === 'neatness') {
                const source = scenario.mode === 'typed-photo' ? 'TYPED_OR_PRINTED' : scenario.mode === 'unscorable-photo' ? 'NOT_SCORABLE' : scenario.mode === 'mixed' ? 'MIXED' : 'HANDWRITTEN';
                const missing = ['missing-neatness', 'fallback-neatness'].includes(scenario.mode);
                return '**Source Type:** ' + source + '\n**Source Type Reason:** Synthetic source evidence.\n'
                    + criteria.map((label, i) => '- ' + label + ': ' + (missing && i === 1 ? 'Missing' : 4) + '/5').join('\n')
                    + '\n- Neatness: ' + (scenario.mode === 'missing-neatness' ? 'Missing' : 8) + '/10 - Visible synthetic letters.\n**Neatness Growth Tip:** Leave clearer spaces.';
            }
            if (kind === 'correction') return '# Corrected Story\n' + (['corrections', 'strictness'].includes(scenario.mode) ? text.replace('walked', '**went**') : text);
            if (kind === 'rubric') return ['missing-quick', 'missing-both'].includes(scenario.mode) ? 'No assessment available.' : '**Quick Rubric:**\n' + core.map(key => '- ' + key + ': 8/10 - Add one clear detail.').join('\n');
            if (['missing-detail', 'missing-both'].includes(scenario.mode)) return '## Grow Goal Selection\n**Your Writing Strength:** Clear events.';
            let detail = labels.map(label => '**' + label + ':** ' + (scenario.mode === 'explicit-missing' ? 'Missing' : scenario.mode === 'malformed-detail' ? '7.5' : '8/10')
                + '\n- Teacher Comment: ' + (scenario.mode === 'unsafe-detail' ? malicious : 'The events are clear.')
                + '\n- What I Noticed:\n  - Area: Details\n    Comment: ' + (scenario.mode === 'unsafe-detail' ? malicious : 'The writing names a park.')
                + '\n- Growth Tip: Add one clear detail.').join('\n')
                + '\n## Grow Goal Selection\n**Your Writing Strength:** Clear events.\n**Your Grow Goal:** Add details.\n**Try This Next Time:** Add an example.\n**Keep Writing!** Keep sharing your ideas.';
            if (scenario.mode === 'guide') detail += '\n## Notebook Guide Candidate JSON\n```json\n' + JSON.stringify({ candidates: [{ area: 'Organization', skill: 'Use paragraphs', page1Connection: 'Organization', originalQuote: text.slice(0, 120), nextTimeExample: text.slice(0, 60) + '\n\n' + text.slice(60, 120), whyThisWorks: 'The paragraph separates events.' }] }) + '\n```';
            return detail;
        };
        callOpenRouter = (model, prompt) => respond(['correction', 'rubric', 'detail'][step++], model, prompt);
        callOpenRouterImage = (model, prompt, imageUrl) => respond(prompt.startsWith('Transcribe') ? 'ocr' : 'neatness', model, prompt, imageUrl);
        if (['zero-detail', 'undefined-detail', 'absent-detail-score'].includes(scenario.mode)) {
            const nativeParser = parseDetailedAssessment;
            parseDetailedAssessment = (...args) => {
                const d = nativeParser(...args);
                if (scenario.mode === 'zero-detail') d.categories.Flow.score = 0;
                else if (scenario.mode === 'undefined-detail') d.categories['Word Choice'].score = undefined;
                else delete d.categories['Word Choice'].score;
                return d;
            };
        }
        let capturedInput, capturedPolicy;
        const captureInput = captureCurrentWritingContext, capturePolicy = captureAssessmentPolicy;
        captureCurrentWritingContext = () => { const value = captureInput(); if (!capturedInput) capturedInput = value; return value; };
        captureAssessmentPolicy = () => { const value = capturePolicy(); if (!capturedPolicy) capturedPolicy = value; return value; };
        const nativeSave = saveCurrentSessionToPortfolio;
        saveCurrentSessionToPortfolio = data => { effects.push({ kind: 'prepare', debug: el('debugRaw').textContent, report: el('detailedAssessment').innerHTML }); return nativeSave(data); };
        if (['save-failure', 'low-save-failure'].includes(scenario.mode)) {
            const nativeSet = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) { if (key === PENDING_PORTFOLIO_SYNC_KEY) throw Error('Synthetic pending storage failure'); return nativeSet.call(this, key, value); };
        }
        if (scenario.mode === 'publish-policy') {
            const nativeGoal = getGoalPlan;
            getGoalPlan = data => { el('grammarStrictness').value = '5'; return nativeGoal(data); };
        }
        if (scenario.mode.startsWith('native-')) {
            // Restore the real wrappers for timeout/retry integration; only transport is synthetic.
            callOpenRouter = window.nativeParityTextRequest; callOpenRouterImage = window.nativeParityImageRequest;
            sleepMs = async () => {};
            let attempted = false;
            const nativeTimeout = window.setTimeout;
            window.setTimeout = (fn, ms, ...args) => nativeTimeout(fn, ms === 90000 && !attempted ? 0 : ms, ...args);
            fetch = async (url, options) => {
                if (url !== 'https://openrouter.ai/api/v1/chat/completions') throw Error('Unexpected external transport');
                const body = JSON.parse(options.body), prompt = body.messages[0].content;
                if (!attempted) {
                    attempted = true; requests.push({ kind: scenario.mode, model: body.model, prompt });
                    if (scenario.mode === 'native-timeout') return { ok: true, status: 200, text: () => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(Error('Synthetic body abort'), { name: 'AbortError' })), { once: true })) };
                    return { ok: false, status: 503, text: async () => JSON.stringify({ error: { message: 'Synthetic busy' } }) };
                }
                return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: await respond(['correction', 'rubric', 'detail'][step++], body.model, prompt) } }] }) };
            };
        }
        const run = analyzeWriting();
        if (scenario.mode === 'held') {
            await Promise.race([started, new Promise((resolve, reject) => setTimeout(() => reject(Error('Held boundary not reached')), 5000))]);
            if (scenario.action === 'cancel') requestStopAnalysis();
            if (scenario.action === 'writing') el('studentWriting').value = 'Newer writing must survive.';
            if (scenario.action === 'policy') el('grammarStrictness').value = '5';
            if (scenario.action === 'student') { selectedStudent = 'Other'; el('studentSelect').value = 'Other'; }
            if (scenario.action === 'images') { selectedImages = []; syncSelectedImageState(); }
            if (scenario.action === 'source') activePortfolioReassessmentSource = { sourceStudentName: 'Synthetic', sourceSessionId: 'new-source' };
            if (scenario.action === 'supersede') { activeAnalysisContext = { input: captureInput(), policy: capturePolicy(), cancelled: false }; analysisAbortController = new AbortController(); }
            release();
        }
        await run;
        const data = latestAnalysisData, pending = getPendingPortfolioSync();
        const serialize = value => JSON.parse(JSON.stringify(value, (key, item) => item === undefined ? '[undefined]' : typeof item === 'number' && !Number.isFinite(item) ? String(item) : item));
        const output = { data: serialize(data), pending: serialize(pending), pendingBytes: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY),
            keyOrder: { data: Object.keys(data || {}), scores: Object.keys(data?.categoryScores || {}), quick: Object.keys(data?.quickRubric || {}), detailed: Object.keys(data?.detailed || {}), categories: Object.keys(data?.detailed?.categories || {}) },
            inputIdentity: !data || data.inputContext === capturedInput, policyIdentity: !data || data.assessmentPolicy === capturedPolicy,
            pendingRetained: localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === pendingBefore,
            requests, effects, alerts, logs, writing: el('studentWriting').value, source: activePortfolioReassessmentSource,
            ui: Object.fromEntries(['overallScore', 'overallScoreNote', 'gradeLevelResultNote', 'sampleStatusLine', 'correctedStory', 'detailedAssessment', 'growGoalBox', 'teacherAuditView', 'step1Raw', 'step3Raw', 'grammarCalc', 'debugRaw', 'ocrStatus'].map(id => [id, el(id).innerHTML])),
            busy: isAnalyzing, cancel: cancelAnalysis, active: !!activeAnalysisContext, controller: !!analysisAbortController,
            buttons: ['analyzeBtn', 'stopAnalysisBtn', 'extractTextBtn'].map(id => ({ id, text: el(id).textContent, disabled: el(id).disabled, loading: el(id).classList.contains('is-loading'), aria: el(id).getAttribute('aria-busy') })),
            unsafeExecuted: !!window.injected };
        if (data && !['save-failure', 'low-save-failure', 'no-student'].includes(scenario.mode)) {
            output.committed = commitPendingPortfolioSync();
            const saved = getPortfolioData().Synthetic?.sessions?.find(s => s.id === pending?.sessionData?.id);
            output.saved = serialize(saved); output.portfolioBytes = localStorage.getItem('wft_portfolio');
            if (saved) { output.reconstructedNotebook = buildNotebookPrintHtmlFromPortfolioSession('Synthetic', saved); output.exported = buildStudentPortfolioHtml('Synthetic', { sessions: [saved] }, 'Synthetic'); }
        }
        return output;
    }, scenario);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), outcomes = [];
    try {
        for (const scenario of cases) {
            const observed = [];
            for (const side of ['original', 'refactored']) {
                const context = await browser.newContext(), page = await context.newPage(), errors = [], external = [];
                page.on('pageerror', e => errors.push(e.message));
                await page.route('**/*', route => {
                    const url = new URL(route.request().url());
                    if (url.origin !== 'http://127.0.0.1:8765') { external.push(url.origin); return route.abort(); }
                    const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                    return route.fulfill(fs.existsSync(file) ? { contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) } : { status: 404, body: '' });
                });
                try {
                    await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
                    await page.evaluate(() => { window.nativeParityTextRequest = callOpenRouter; window.nativeParityImageRequest = callOpenRouterImage; });
                    if (side === 'original') await page.evaluate(source => window.eval(source), reference);
                    const result = await exercise(page, scenario);
                    assert.deepEqual(errors, [], JSON.stringify(scenario));
                    assert.equal(result.inputIdentity, true); assert.equal(result.policyIdentity, true); assert.equal(result.unsafeExecuted, false);
                    assert.equal(result.busy, scenario.action === 'supersede');
                    if (scenario.mode === 'held' || scenario.mode === 'publish-policy') assert.equal(result.pendingRetained, true);
                    if (['insufficient', 'limited', 'low-save-failure'].includes(scenario.mode)) { assert.equal(result.requests.length, 0); assert.equal(result.data.overall, null); assert.equal(Object.hasOwn(result.data, 'grammarAudit'), false); }
                    if (scenario.mode === 'zero-detail') assert.equal(result.data.categoryScores.Flow, 0);
                    if (scenario.mode === 'undefined-detail') { assert.equal(result.data.detailed.categories['Word Choice'].score, '[undefined]'); assert.equal(Object.hasOwn(result.data.detailed.categories['Word Choice'], 'score'), true); }
                    if (scenario.mode === 'absent-detail-score') assert.equal(Object.hasOwn(result.data.detailed.categories['Word Choice'], 'score'), false);
                    if (scenario.mode === 'explicit-missing') assert.equal(result.data.categoryScores['Word Choice'], null);
                    if (['typed-photo', 'unscorable-photo', 'missing-neatness'].includes(scenario.mode)) assert.equal(result.data.categoryScores.Neatness, null);
                    if (scenario.mode === 'fallback-neatness') assert.equal(result.data.categoryScores.Neatness, 8);
                    if (scenario.mode === 'reassessment') { assert.equal(result.pending.replaceSource.sourceSessionId, 'old'); assert.equal(result.data.inputContext.reassessmentSource, null); }
                    observed.push(result);
                } finally { await context.close(); }
            }
            assert.deepEqual(observed[1], observed[0], 'Original/refactored mismatch: ' + JSON.stringify(scenario));
            outcomes.push({ scenario, passed: true, original: observed[0], refactored: observed[1] });
            console.log('PASS ' + JSON.stringify(scenario));
        }
    } finally {
        await browser.close();
        if (process.env.WFT_ANALYSIS_REPORT) fs.writeFileSync(process.env.WFT_ANALYSIS_REPORT, JSON.stringify({ root, referenceSHA256: crypto.createHash('sha256').update(reference).digest('hex'), count: outcomes.length, expected: cases.length, cases: outcomes }, null, 2));
    }
    assert.equal(outcomes.length, cases.length);
    console.log('Analysis pipeline native parity passed: ' + cases.length + ' scenarios; original and refactored outputs, ownership and cleanup identical. External services intercepted.');
})().catch(error => { console.error(error); process.exitCode = 1; });
