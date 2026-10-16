const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

function exerciseMainAppHealth() {
    stopWftSyncPolling(); stopDriveAutoSync();
    const checks = [];
    const check = (name, passed) => checks.push({ name, passed: !!passed });
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    function checkTabs() {
        const ids = ['toolShell', 'adminPanel', 'portfolioPanel', 'toolTabBtn', 'portfolioTabBtn', 'adminTabBtn'];
        const before = ids.map(id => document.getElementById(id).className);
        for (const id of ids) {
            const element = document.getElementById(id), parent = element.parentNode, next = element.nextSibling;
            element.remove();
            try {
                switchTab('portfolio');
                check('missing tab element leaves classes intact: ' + id,
                    equal(ids.filter(key => key !== id).map(key => document.getElementById(key).className), before.filter((value, i) => ids[i] !== id)));
            } finally { parent.insertBefore(element, next); }
        }
        const refresh = refreshPortfolioDropdown, render = renderStudentPortfolio, calls = [];
        refreshPortfolioDropdown = () => calls.push('refresh'); renderStudentPortfolio = () => calls.push('render');
        try {
            for (const tab of ['admin', 'portfolio', 'tool', 'unknown']) {
                switchTab(tab);
                const active = tab === 'unknown' ? 'tool' : tab;
                check('tab selection: ' + tab, ids.slice(3).every((id, i) => document.getElementById(id).classList.contains('active') === (['tool', 'portfolio', 'admin'][i] === active)));
                check('tool visibility: ' + tab, document.getElementById('toolShell').classList.contains('hidden') === (active !== 'tool'));
            }
            check('portfolio refresh order', equal(calls, ['refresh', 'render']));
        } finally { refreshPortfolioDropdown = refresh; renderStudentPortfolio = render; }
    }

    function checkMerge() {
        const base = { child: { keep: 1, replace: [1] }, list: [2], scalar: 3 };
        const override = { child: { replace: [4], add: 5 }, scalar: null };
        const merged = mergeObjects(base, override);
        check('nested object merge and array replacement', equal(merged, { child: { keep: 1, replace: [4], add: 5 }, list: [2], scalar: null }));
        check('merge clones base nested objects and both arrays', merged.child !== base.child && merged.list !== base.list && merged.child.replace !== override.child.replace);
        check('merge retains inputs', equal(base.child, { keep: 1, replace: [1] }) && equal(override.child, { replace: [4], add: 5 }));
        for (const [left, right, expected] of [[null, null, {}], [{ v: [] }, { v: {} }, { v: {} }], [{ v: {} }, { v: [1] }, { v: [1] }], [{ v: {} }, { v: 0 }, { v: 0 }]]) {
            check('merge type boundary: ' + JSON.stringify([left, right]), equal(mergeObjects(left, right), expected));
        }
        const inherited = Object.create({ ignored: { value: 1 } }); inherited.own = 2;
        check('merge ignores inherited keys', equal(mergeObjects(inherited, inherited), { own: 2 }));
        const trace = [], a = {}, b = {};
        Object.defineProperty(a, 'child', { enumerable: true, get() { trace.push('base'); return { keep: 1 }; } });
        Object.defineProperty(b, 'child', { enumerable: true, get() { trace.push('override'); return { add: 2 }; } });
        check('merge getter result', equal(mergeObjects(a, b), { child: { keep: 1, add: 2 } }));
        check('merge preserves short-circuit property reads', equal(trace, ['base', 'base', 'base', 'base', 'override', 'override', 'override', 'override']));
    }

    function checkScoresAndGrammar() {
        const assess = shouldAssessNeatness, weight = getCategoryWeight, neatWeight = getNeatnessWeight;
        shouldAssessNeatness = () => true; getCategoryWeight = () => 0.5; getNeatnessWeight = () => 0.2;
        try {
            check('weighted core scores', computeOverallScore({ Grammar: 8, Flow: '6' }, {}) === 70);
            check('weighted neatness', computeOverallScore({ Grammar: 8, Flow: 6, Neatness: 10 }, {}) === 76);
            check('empty scores remain unscored', computeOverallScore({}, {}) === null);
            check('unsupported scores remain unscored', computeOverallScore({ Grammar: null, Flow: 'Missing', Other: 11 }, {}) === null);
            const inherited = Object.create({ Flow: 10 }); inherited.Grammar = 6;
            check('inherited category skipped', computeOverallScore(inherited, {}) === 60);
            shouldAssessNeatness = () => false;
            check('inactive neatness has no weight', computeOverallScore({ Neatness: 10 }, {}) === null);
        } finally { shouldAssessNeatness = assess; getCategoryWeight = weight; getNeatnessWeight = neatWeight; }
        const diff = getDiffOperations;
        try {
            for (const [tokens, verbs, helpers] of [[['constructor', 'toString'], 0, 0], [['go', 'was'], 1, 0], [['was', 'go'], 1, 1], [[], 0, 0]]) {
                getDiffOperations = () => [{ removed: tokens, added: [] }];
                const result = analyzeGrammarChanges('', '');
                check('grammar stops at first own verb: ' + tokens.join(','), result.totalEdits === 1 && result.verbIssues === verbs && result.helperVerbIssues === helpers);
            }
        } finally { getDiffOperations = diff; }
    }

    function checkGuide() {
        for (const word of ['spelling', 'punctuation', 'capital', 'comma', 'plural', 'word form', 'commander']) {
            check('conventions substring: ' + word, normalizeNotebookGuideQuickCheckKey('Read ' + word.toUpperCase() + ' out loud') === 'conventions');
        }
        for (const [text, expected] of [['Read out loud', 'read-aloud'], ['Sentence starts the same way', 'sentence-openings'], ['Check verbs', 'verb-tense'], ['Check tense', 'verb-tense'], ['Observe birds!', 'observe birds'], ['', '']]) {
            check('quick check normalization: ' + text, normalizeNotebookGuideQuickCheckKey(text) === expected);
        }
        const source = 'We was happy. I go home.', genre = { mainGenre: 'Narrative / Story', safeReference: 'story' };
        const make = (category, quote, revision) => ({ area: category, skill: 'Use clearer wording', page1Connection: category, originalQuote: quote, nextTimeExample: revision, whyThisWorks: 'This makes the meaning clearer.' });
        const flow = make('Flow', 'We was happy.', 'Yesterday, we was happy.');
        const duplicate = make('Grammar', 'We was happy.', 'We were happy.');
        const grammar = make('Grammar', 'I go home.', 'I went home.');
        const priorities = [{ category: 'Flow' }, { category: 'Grammar' }];
        const build = candidates => assembleNotebookGuideFromCandidates(candidates, source, genre, priorities, { correctedText: 'We were happy. I went home.' });
        const selected = build([duplicate, grammar, flow]);
        check('guide follows required category order', equal(selected.examples.map(ex => ex.page1Connection), ['Flow', 'Grammar']));
        check('guide skips rejected duplicate and keeps searching', selected.examples[1]?.originalQuote === grammar.originalQuote);
        const fallback = build([flow, duplicate]);
        check('missing candidate uses grounded duplicate-quote fallback', fallback.examples[1]?.originalQuote === duplicate.originalQuote && fallback.examples[1]?.nextTimeExample === duplicate.nextTimeExample);
        const missing = build([grammar]);
        check('unsupported Flow fallback adds no invented example', missing.examples.length > 0 && missing.examples.every(ex => ex.page1Connection === 'Grammar' && originalTextContainsNotebookQuote(source, ex.originalQuote)));
    }

    function checkVisibility() {
        const originals = [WFT_SYNC_ENGINE_V2, driveAccessToken, saveWftLocalSnapshotsBeforeHide, getPortfolioData, savePortfolioData, syncAllToDrive];
        const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
        const handlers = window.healthVisibilityHandlers.filter(handler => handler.toString().includes('savePortfolioData(getPortfolioData())'));
        check('one shipped main visibility handler captured', handlers.length === 1);
        if (handlers.length !== 1) return;
        try {
            for (const v2 of [false, true]) for (const hidden of [false, true]) for (const signedIn of [false, true]) for (const failure of ['', 'read', 'save', 'sync']) {
                const calls = [], hit = name => { calls.push(name); if (failure === name) throw Error('Synthetic ' + name); };
                WFT_SYNC_ENGINE_V2 = v2; driveAccessToken = signedIn ? 'synthetic' : '';
                Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
                saveWftLocalSnapshotsBeforeHide = () => hit('save'); getPortfolioData = () => { hit('read'); return 'portfolio'; };
                savePortfolioData = value => { if (value !== 'portfolio') throw Error('Wrong portfolio'); hit('save'); }; syncAllToDrive = () => hit('sync');
                handlers[0].call(document, new Event('visibilitychange'));
                const expected = !hidden ? [] : v2 ? ['save'] : failure === 'read' ? ['read'] : failure === 'save' || !signedIn ? ['read', 'save'] : ['read', 'save', 'sync'];
                check('visibility lifecycle ' + JSON.stringify({ v2, hidden, signedIn, failure }), equal(calls, expected));
            }
        } finally {
            [WFT_SYNC_ENGINE_V2, driveAccessToken, saveWftLocalSnapshotsBeforeHide, getPortfolioData, savePortfolioData, syncAllToDrive] = originals;
            if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor); else delete document.visibilityState;
        }
    }
    function checkWordCountMeter() {
        const writing = document.getElementById('studentWriting'), target = document.getElementById('targetWordCount'), toggle = document.getElementById('useWordCountTarget');
        const before = [writing.value, target.value, toggle.checked];
        const input = words => { writing.value = Array(words).fill('word').join(' '); writing.dispatchEvent(new Event('input', { bubbles: true })); };
        const change = enabled => { toggle.checked = enabled; toggle.dispatchEvent(new Event('change', { bubbles: true })); };
        function expectMeter(name, words, enabled, badge) {
            const observed = { badge: document.getElementById('statusBarStatus').textContent, words: document.getElementById('statusBarWordCount').textContent,
                fill: document.getElementById('statusBarMeterFill').style.width, originalFill: document.getElementById('studentPanelMeterFill').style.width,
                target: target.value, checked: toggle.checked, disabled: target.disabled };
            const fill = enabled ? Math.min(words, 100) + '%' : '0%';
            checks.push({ name: 'word-count meter: ' + name, passed: equal(observed, { badge, words: words + ' words', fill, originalFill: fill, target: '100', checked: enabled, disabled: !enabled }), observed });
        }
        try {
            change(true); target.value = '100'; target.dispatchEvent(new Event('input', { bubbles: true }));
            change(false);
            for (const words of [99, 100, 101, 0]) {
                input(words); expectMeter('disabled writing input ' + words, words, false, words ? 'Target off' : 'Start typing...');
            }
            change(true);
            for (const [words, badge] of [[0, 'Start typing...'], [74, 'Need more detail'], [75, 'Getting close'], [94, 'Getting close'], [95, 'Near target'], [99, 'Near target'], [100, 'On target'], [105, 'Near target'], [106, 'Above target'], [151, 'Above target']]) {
                input(words); expectMeter('enabled writing input ' + words, words, true, badge);
            }
            input(100); change(false); expectMeter('disabled checkbox change at exact count', 100, false, 'Target off');
            change(true); expectMeter('enabled checkbox change at exact count', 100, true, 'On target');
        } finally {
            [writing.value, target.value] = before; change(before[2]); writing.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    function checkEvidenceTokens() {
        const unrelated = [{ area: 'Details', comment: 'Birds gather nearby.' }], literal = [{ area: 'Details', comment: 'Constructor' }];
        const candidate = 'The constructor belongs in this phrase.';
        const own = (bag, key) => Object.prototype.hasOwnProperty.call(bag, key);
        check('evidence tokens: unrelated constructor rejected', !commentOverlapsEvidence(candidate, unrelated));
        check('evidence tokens: unrelated bag has no own constructor', !own(getEvidenceTokens(unrelated), 'constructor'));
        check('evidence tokens: literal constructor is an own token', own(getEvidenceTokens(literal), 'constructor') && getEvidenceTokens(literal).constructor === true);
        check('evidence tokens: literal constructor supported', commentOverlapsEvidence(candidate, literal));
        check('evidence tokens: ordinary case-insensitive match', commentOverlapsEvidence('BIRDS gather.', unrelated));
        check('evidence tokens: ordinary unrelated word rejected', !commentOverlapsEvidence('Lanterns glow.', unrelated));
        const stopOnly = [{ area: 'Your writing', comment: 'The reader makes this clear.' }];
        check('evidence tokens: stop-only rows supply no support', Object.keys(getEvidenceTokens(stopOnly)).length === 0 && !commentOverlapsEvidence('Your writing is clear.', stopOnly));
        check('evidence tokens: short tokens ignored', !commentOverlapsEvidence('Cat', [{ comment: 'Cat' }]));
        for (const rows of [null, undefined, []]) check('evidence tokens: absent rows neutral ' + String(rows), commentOverlapsEvidence(candidate, rows));
        const containers = ['detailedAssessment', 'growGoalBox', 'teacherAuditView'].map(id => document.getElementById(id));
        const html = containers.map(el => el.innerHTML), state = JSON.stringify([latestAnalysisData, pendingPortfolioSync]);
        try {
            for (const [name, rows, comment, supported, expected] of [
                ['unsupported', unrelated, candidate, false, 'Your grammar is mostly clear, and birds gather nearby.'],
                ['literal', literal, candidate, true, candidate],
                ['ordinary', unrelated, 'The birds gather nearby in this passage.', true, 'The birds gather nearby in this passage.']
            ]) {
                const parsed = parseDetailedAssessment('**2. Grammar:** 8/10\n- Teacher Comment: ' + comment + '\n- What I Noticed:\n  - Area: ' + rows[0].area + '\n    Comment: ' + rows[0].comment + '\n- Growth Tip: Reread each sentence and check the verb tense.', 'Birds gather nearby.');
                const item = parsed.categories.Grammar, before = JSON.stringify(item), detailed = { categories: { Grammar: item } };
                const feedback = buildStudentFeedbackForCategory('Grammar', item);
                check('evidence tokens: parsed rows retained ' + name, equal(item.noticeRows, rows) && equal(feedback.noticeRows, rows));
                check('evidence tokens: validator ' + name, isValidTeacherComment(comment, 'Grammar', item, rows) === supported);
                check('evidence tokens: shared builder ' + name, buildTeacherComment('Grammar', item, rows) === expected);
                const source = supported ? 'AI teacher comment passed validation.' : 'Fallback evidence-based comment used because the AI teacher comment did not pass validation.';
                check('evidence tokens: audit source ' + name, getAuditTeacherCommentSource('Grammar', item, rows) === source && feedback.audit.teacherCommentSource === source);
                const validation = buildAuditValidationRows('Grammar', item, rows, comment, feedback.growthTip, feedback);
                check('evidence tokens: original candidate audit ' + name, validation.find(row => row.label === 'Teacher Comment matches evidence rows').passed === supported);
                renderDetailedAssessment(detailed); renderTeacherAuditView({ detailed });
                const auditComment = [...containers[2].querySelectorAll('.teacher-audit-label')].find(el => el.textContent === 'Displayed Teacher Comment').nextElementSibling.textContent;
                const observed = { feedback: feedback.teacherComment, student: containers[0].querySelector('.assessment-sub').textContent, audit: auditComment, source: feedback.audit.teacherCommentSource };
                checks.push({ name: 'evidence tokens: native feedback and rendering ' + name, passed: observed.feedback === expected && observed.student === 'Teacher Comment: ' + expected && observed.audit === expected && containers[2].textContent.includes(source), observed });
                check('evidence tokens: saved feedback ' + name, buildPortfolioDetailedFeedback({ detailed, categoryScores: { Grammar: 8 } }).categories.Grammar.teacherComment === expected);
                check('evidence tokens: source score and rows unchanged ' + name, JSON.stringify(item) === before && item.score === 8);
            }
            check('evidence tokens: analysis and pending state unchanged', JSON.stringify([latestAnalysisData, pendingPortfolioSync]) === state);
        } finally { containers.forEach((el, i) => { el.innerHTML = html[i]; }); }
    }
    checkTabs(); checkMerge(); checkScoresAndGrammar(); checkGuide(); checkVisibility(); checkWordCountMeter(); checkEvidenceTokens();
    return checks;
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            window.healthVisibilityHandlers = [];
            const add = document.addEventListener;
            document.addEventListener = function(type, handler, options) {
                if (type === 'visibilitychange') window.healthVisibilityHandlers.push(handler);
                return add.call(this, type, handler, options);
            };
        });
        await page.route('**/*', route => localAppRoute(route, root));
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const checks = await page.evaluate(exerciseMainAppHealth);
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, checks, errors }, null, 2));
        assert.deepEqual(errors, []);
        assert.deepEqual(checks.filter(check => !check.passed), []);
        console.log('Main app health regressions passed: ' + checks.length + ' checks; external services intercepted.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
