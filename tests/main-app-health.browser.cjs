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
    checkTabs(); checkMerge(); checkScoresAndGrammar(); checkGuide(); checkVisibility();
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
