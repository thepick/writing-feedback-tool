const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const failures = [];
    const cases = ['automatic-student', 'ocr-student', 'typed-student', 'typed-writing', 'step2-images',
        'neatness-images', 'step3-source', 'stop', 'class-reset-restart', 'unchanged-ocr', 'unchanged-typed',
        'stale-preparation', 'stale-helper', 'stale-writing', 'consecutive-results', 'reassessment-loading',
        'reassessment-student', 'reassessment-unchanged', 'no-student', 'reset', 'ocr-stop', 'image-preparation'];
    try {
        for (const scenario of cases) {
            const page = await browser.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
                const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
                return fs.existsSync(file) ? route.fulfill({ status: 200,
                    contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) })
                    : route.fulfill({ status: 404, body: '' });
            });
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof analyzeWriting === 'function');
            try {
                const result = await page.evaluate(async scenario => {
                    scheduleWftCloudSync = () => {};
                    stopWftSyncPolling();
                    const alerts = [];
                    window.alert = text => alerts.push(text);
                    const text = 'Yesterday I went to the park with my family and we played near the big trees. My sister brought a red ball and we took turns throwing it to each other. After a while we sat down on a blanket and ate the lunch that my mother had packed. Then we walked around the pond and watched the ducks swimming in the water. I felt happy because we had spent a wonderful day together.';
                    const writing = document.getElementById('studentWriting');
                    const select = document.getElementById('studentSelect');
                    students = ['Alice', 'Bob']; selectedStudent = 'Alice';
                    populateStudentDropdown(); select.value = 'Alice';
                    writing.value = text;
                    const photo = name => ({ name, dataUrl: 'data:image/png;base64,' + name });
                    selectedImages = []; syncSelectedImageState();
                    const keep = { studentName: 'Alice', signature: 'keep', sessionData: {
                        id: 'keep', originalText: 'Earlier valid writing.', correctedMarkup: 'Earlier valid writing.', images: [] } };
                    pendingPortfolioSync = keep; persistPendingPortfolioSync();
                    const retained = JSON.stringify(getPendingPortfolioSync());
                    const core = ['Ideas & Details', 'Grammar', 'Word Choice', 'Organization', 'Flow', 'Spelling & Punctuation'];
                    const labels = ['1. Clear Ideas & Details', '2. Grammar', '3. Word Choice', '4. Organization', '5. Flow', '6. Spelling & Punctuation'];
                    const responses = ['# Corrected Story\n' + text,
                        '**Quick Rubric:**\n' + core.map(key => '- ' + key + ': 8/10 - Add one clear detail.').join('\n'),
                        labels.map(label => '**' + label + ':** 8/10\n- Evidence: Your ideas are clear.\n- Growth Tip: Add one clear detail.').join('\n')];
                    const gate = () => {
                        let enter, release;
                        const started = new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => reject(new Error('Expected simulated request was not reached')), 5000);
                            enter = () => { clearTimeout(timeout); resolve(); };
                        });
                        const waiting = new Promise(resolve => { release = resolve; });
                        return { enter, release, started, waiting };
                    };
                    const changeStudent = name => { select.value = name; select.dispatchEvent(new Event('change')); };
                    const state = () => ({ writing: writing.value, corrected: latestAnalysisData && latestAnalysisData.correctedStory,
                        pending: getPendingPortfolioSync(), retained: JSON.stringify(getPendingPortfolioSync()) === retained,
                        analyzing: isAnalyzing, alerts });
                    let calls = 0;
                    callOpenRouter = async () => responses[calls++];

                    if (scenario.startsWith('stale-')) {
                        writing.value = 'Alice has a dog.';
                        clearPendingPortfolioSync();
                        await analyzeWriting();
                        const data = latestAnalysisData;
                        const first = getPendingPortfolioSync();
                        const committed = commitPendingPortfolioSync();
                        if (scenario !== 'stale-writing') changeStudent('Bob');
                        writing.value = 'Bob writes about a fish.';
                        writing.dispatchEvent(new Event('input'));
                        const prepared = scenario === 'stale-helper' ? (saveCurrentSessionToPortfolio(data), !!getPendingPortfolioSync())
                            : prepareCurrentAnalysisForPortfolioSync();
                        const printable = fillNotebookSummary();
                        return { ...state(), first, committed, prepared, printable, portfolio: getPortfolioData() };
                    }
                    if (scenario === 'consecutive-results') {
                        writing.value = 'Alice has a dog.'; await analyzeWriting();
                        writing.value = 'Alice has a cat.'; await analyzeWriting();
                        return state();
                    }
                    if (scenario === 'reassessment-loading' || scenario === 'image-preparation') {
                        const wait = gate();
                        activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'old' };
                        getPortfolioImageDataUrlForReassessment = async () => { wait.enter(); await wait.waiting; return photo('Alice').dataUrl; };
                        optimizeImageForOcr = async () => { wait.enter(); await wait.waiting; return photo('Alice').dataUrl; };
                        const running = scenario === 'image-preparation' ? handleSelectedImages([{ name: 'Alice', type: 'image/png' }])
                            : restorePortfolioSessionImagesForReassessment({ images: [photo('Alice')] });
                        await wait.started;
                        changeStudent('Bob'); writing.value = 'Bob writes about a fish.';
                        selectedImages = [photo('Bob')]; syncSelectedImageState();
                        wait.release(); await running;
                        return { ...state(), image: selectedImages[0].name, imageCount: selectedImages.length };
                    }
                    if (['reassessment-student', 'reassessment-unchanged', 'no-student'].includes(scenario)) {
                        activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'old' };
                        changeStudent(scenario === 'no-student' ? '' : scenario === 'reassessment-unchanged' ? 'Alice' : 'Bob');
                        writing.value = 'Bob writes about a fish.';
                        await analyzeWriting();
                        return state();
                    }
                    if (scenario === 'class-reset-restart') {
                        const old = gate();
                        let requests = 0;
                        localStorage.setItem('wft_settings', JSON.stringify({ apiKey: 'fake-test-key' }));
                        fetch = async () => {
                            requests++;
                            return { ok: true, status: 200, text: async () => {
                                if (requests === 1) {
                                    old.enter(); await old.waiting;
                                    throw Object.assign(new Error('Aborted old body'), { name: 'AbortError' });
                                }
                                return JSON.stringify({ choices: [{ message: { content: responses[0] } }] });
                            } };
                        };
                        callOpenRouter = (model, prompt) => requestOpenRouterWithFallback(model, () => ({ model, messages: [{ role: 'user', content: prompt }] }));
                        sleepMs = async () => {};
                        const older = analyzeWriting();
                        await old.started;
                        wftConfirm = async () => true; flushWftCloudSyncNow = () => {};
                        await resetCurrentClassData();
                        requestStopAnalysis();
                        const stopped = analysisAbortController.signal.aborted;
                        old.release(); await older;
                        const resetKept = students.length === 0 && selectedStudent === '';
                        students = ['Bob']; selectedStudent = 'Bob'; populateStudentDropdown(); select.value = 'Bob';
                        writing.value = text;
                        const newer = gate(); calls = 0;
                        callOpenRouter = async () => { const response = responses[calls++]; if (calls === 1) { newer.enter(); await newer.waiting; } return response; };
                        const running = analyzeWriting(); await newer.started;
                        const controller = analysisAbortController;
                        const protectedNewRun = isAnalyzing && analysisAbortController === controller && !controller.signal.aborted;
                        newer.release(); await running;
                        return { ...state(), requests, protectedNewRun, stopped, resetKept };
                    }

                    const wait = gate();
                    let running;
                    if (['automatic-student', 'ocr-student', 'ocr-stop', 'unchanged-ocr'].includes(scenario)) {
                        writing.value = ''; selectedImages = [photo('Alice')]; syncSelectedImageState();
                        localStorage.setItem('wft_settings', JSON.stringify({ apiKey: 'fake-test-key' }));
                        if (scenario === 'automatic-student') {
                            extractTextFromSelectedImage = async () => { wait.enter(); await wait.waiting; return 'Alice has a dog.'; };
                        } else {
                            callOpenRouterImage = async () => { wait.enter(); await wait.waiting; return 'Alice has a dog.'; };
                        }
                        running = scenario.startsWith('ocr-') ? extractTextFromSelectedImage().catch(() => {}) : analyzeWriting();
                    } else {
                        const at = scenario === 'step2-images' ? 2 : scenario === 'step3-source' ? 3 : 1;
                        if (scenario === 'neatness-images') {
                            selectedImages = [photo('Alice')]; syncSelectedImageState();
                            localStorage.setItem('wft_settings', JSON.stringify({ assessScriptQuality: true }));
                            document.getElementById('assessScriptQuality').checked = true;
                            assessNeatnessFromImage = async () => { wait.enter(); await wait.waiting; return null; };
                        }
                        callOpenRouter = async () => {
                            const response = responses[calls++];
                            if (calls === at && scenario !== 'neatness-images') { wait.enter(); await wait.waiting; }
                            return response;
                        };
                        running = analyzeWriting();
                    }
                    await wait.started;
                    const busyBeforeAwait = isAnalyzing;
                    if (scenario.endsWith('-student')) {
                        changeStudent('Bob'); writing.value = 'Bob writes about a fish.';
                        selectedImages = []; syncSelectedImageState();
                    } else if (scenario === 'typed-writing') {
                        writing.value = 'Alice writes something newer.';
                    } else if (scenario.endsWith('-images')) {
                        selectedImages = [photo('new-photo')]; syncSelectedImageState();
                    } else if (scenario === 'step3-source') {
                        activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'other' };
                    } else if (scenario === 'stop' || scenario === 'ocr-stop') {
                        requestStopAnalysis();
                    } else if (scenario === 'reset') {
                        wftConfirm = async () => true;
                        flushWftCloudSyncNow = () => {};
                        await resetCurrentClassData();
                    }
                    wait.release(); await running;
                    return { ...state(), busyBeforeAwait, calls, image: selectedImages[0] && selectedImages[0].name };
                }, scenario);
                const diagnostic = JSON.stringify({ writing: result.writing, corrected: result.corrected,
                    pendingStudent: result.pending && result.pending.studentName,
                    original: result.pending && result.pending.sessionData.originalText,
                    retained: result.retained, prepared: result.prepared });
                assert.deepEqual(errors, []);
                if (scenario.startsWith('stale-')) {
                    assert.equal(result.first.studentName, 'Alice');
                    assert.equal(result.committed, true);
                    assert.equal(result.prepared, false, diagnostic);
                    assert.equal(result.printable, false);
                    assert.equal(result.pending, null);
                    assert.equal(result.portfolio.Bob, undefined);
                } else if (scenario === 'reassessment-loading' || scenario === 'image-preparation') {
                    assert.equal(result.image, 'Bob', diagnostic);
                    assert.equal(result.imageCount, 1);
                    assert.equal(result.writing, 'Bob writes about a fish.');
                    assert.equal(result.retained, true);
                } else if (scenario === 'reassessment-student') {
                    assert.equal(result.pending.studentName, 'Bob');
                    assert.equal(result.pending.replaceSource, null, diagnostic);
                } else if (scenario === 'reassessment-unchanged') {
                    assert.equal(result.pending.studentName, 'Alice');
                    assert.equal(result.pending.replaceSource.sourceSessionId, 'old');
                } else if (scenario === 'consecutive-results') {
                    assert.equal(result.pending.sessionData.originalText, 'Alice has a cat.');
                    assert.equal(result.pending.sessionData.correctedPlainText, 'Alice has a cat.');
                    assert.match(result.pending.sessionData.correctedHtml, /cat/);
                    assert.doesNotMatch(result.pending.sessionData.correctedHtml, /dog/);
                } else if (scenario === 'no-student') {
                    assert.equal(result.retained, true, diagnostic);
                } else if (scenario === 'class-reset-restart') {
                    assert.equal(result.requests, 1, diagnostic);
                    assert.equal(result.stopped, true);
                    assert.equal(result.resetKept, true);
                    assert.equal(result.protectedNewRun, true);
                    assert.equal(result.pending.studentName, 'Bob');
                    assert.equal(result.analyzing, false);
                } else if (scenario.startsWith('unchanged-')) {
                    assert.equal(result.busyBeforeAwait, true);
                    assert.equal(result.pending.studentName, 'Alice');
                    assert.equal(result.pending.sessionData.originalText, result.writing);
                    assert.equal(result.pending.sessionData.correctedMarkup, result.writing);
                    assert.equal(result.pending.sessionData.images.length, scenario === 'unchanged-ocr' ? 1 : 0);
                    assert.equal(result.analyzing, false);
                    assert.deepEqual(result.alerts, []);
                } else {
                    assert.equal(result.retained, true, diagnostic);
                    assert.equal(result.corrected, null);
                    assert.equal(result.busyBeforeAwait, true);
                    assert.equal(result.analyzing, false);
                    if (scenario.endsWith('-student')) assert.equal(result.writing, 'Bob writes about a fish.');
                    if (scenario === 'typed-writing') assert.equal(result.writing, 'Alice writes something newer.');
                    if (scenario === 'ocr-stop') assert.equal(result.writing, '', 'Stopped OCR must not insert its transcription');
                    if (scenario === 'typed-student') assert.equal(result.calls, 1);
                }
                console.log('PASS ' + scenario);
            } catch (error) {
                failures.push(scenario);
                console.error('FAIL ' + scenario + ': ' + error.message);
            } finally { await page.close(); }
        }
        assert.deepEqual(failures, [], 'Analysis identity regressions failed');
        console.log('Analysis identity browser tests passed: ' + cases.length + ' cases; all external services simulated.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
