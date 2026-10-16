const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
    const browser = await chromium.launch({ channel:'msedge', headless:true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return route.fulfill(fs.existsSync(file) ? {contentType:file.endsWith('.js') ? 'application/javascript' : 'text/html', body:fs.readFileSync(file)} : {status:404, body:''});
        });
        await page.goto('http://127.0.0.1:8765', {waitUntil:'domcontentloaded'});
        const result = await page.evaluate(() => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [], check = (name, passed) => cases.push({name, passed:!!passed});
            // Exact matrix algorithm retained from 63cc721 as an independent parity oracle.
            function originalMatrix(a, b) {
                var rows = a.length + 1;
                var cols = b.length + 1;
                var dp = [];
                for (var i = 0; i < rows; i++) {
                    dp[i] = [];
                    for (var j = 0; j < cols; j++) dp[i][j] = 0;
                }
                for (var ai = a.length - 1; ai >= 0; ai--) {
                    for (var bi = b.length - 1; bi >= 0; bi--) {
                        if (normalizeDiffToken(a[ai]) === normalizeDiffToken(b[bi])) dp[ai][bi] = dp[ai + 1][bi + 1] + 1;
                        else dp[ai][bi] = Math.max(dp[ai + 1][bi], dp[ai][bi + 1]);
                    }
                }
                return dp;
            }
            const candidate = buildLcsMatrix, normalizer = normalizeDiffToken;
            const inputs = [
                ['', ''], ['', 'Hello!'], ['Hello!', ''], ['a b a b', 'b a b a'],
                ['Word word WORD', 'word WORD word added'], ['One two three', 'One three'],
                ['One two three', 'One new two three'], ['We was happy.', 'We were happy.'],
                ["We don't go.", "We didn't go."], ['We don’t go.', 'We don\'t go.'],
                ['Hello, world!', 'Hello world.'], ['“Hello,” she said.', '"Hello," she said.'],
                ['café naïve ไทย 😀', 'CAFÉ naïve ไทย 😁'], ['İ Σ ς ß', 'i σ Σ SS'],
                ['Story\r\nI run.\r\n\r\nWe go.', 'Story\nI ran.\n\nWe went.'],
                ['We run.', 'We **ran**.'], ['We **run**.', 'We ran.'],
                ['<img src=x onerror="window.diffInjected=1"> & <script>x</script>', '<img src=y onerror="window.diffInjected=1"> & <script>y</script>'],
                ['A title\n\nThis is the story.', 'A title\n\nThis was the story.'],
                ['`_~ a\t b', 'a b'], ['same', 'SAME'], ['word . word , word', 'word , word . word']
            ];
            let seed = 827163;
            const next = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const vocabulary = ['a', 'A', 'b', 'b', 'was', 'were', "don't", '’', '.', '!', '\n\n', 'é', 'ไทย', '😀', '<', '&'];
            for (let n = 0; n < 100; n++) {
                const a = Array.from({length:1 + next() % 45}, () => vocabulary[next() % vocabulary.length]), b = a.slice();
                for (let j = 0; j < 1 + next() % 7; j++) {
                    const i = next() % (b.length + 1), op = next() % 3;
                    b.splice(i, op === 0 ? 1 : 0, ...(op === 2 ? [vocabulary[next() % vocabulary.length]] : []));
                }
                inputs.push([a.join(' '), b.join(' ')]);
            }
            const observe = (a, b, matrix) => ({
                ...(matrix ? {matrix:buildLcsMatrix(tokenizeForDiff(a), tokenizeForDiff(b))} : {}),
                changed:markChangedTokens(a, b), operations:getDiffOperations(a, b),
                grammar:analyzeGrammarChanges(a, b), minimal:buildMinimalCorrectionMarkup(a, b),
                parsed:parseStep1('# Corrected Story\n' + b, a, 100), html:renderCorrected(a, b),
                reasons:[null, 5, 7, 9].map(score => [buildGrammarReasonFromData(score, a, b), buildGrammarEvidenceFromData(score, a, b), buildGrammarPatternNotes(score, a, b)])
            });
            for (const [i, [a, b]] of inputs.entries()) {
                buildLcsMatrix = originalMatrix; const expected = observe(a, b, true);
                buildLcsMatrix = candidate; check('exact matrix/callers parity ' + i, JSON.stringify(observe(a, b, true)) === JSON.stringify(expected));
            }
            for (const n of [500, 1000, 2000, 4000]) {
                const a = Array(n).fill('word').join(' '), b = a + ' added';
                buildLcsMatrix = originalMatrix; const expected = {changed:markChangedTokens(a,b), operations:getDiffOperations(a,b), grammar:analyzeGrammarChanges(a,b), minimal:buildMinimalCorrectionMarkup(a,b), html:renderCorrected(a,b)};
                buildLcsMatrix = candidate;
                check('long exact callers parity ' + n, JSON.stringify({changed:markChangedTokens(a,b), operations:getDiffOperations(a,b), grammar:analyzeGrammarChanges(a,b), minimal:buildMinimalCorrectionMarkup(a,b), html:renderCorrected(a,b)}) === JSON.stringify(expected));
            }
            let count = 0;
            normalizeDiffToken = token => { count++; return normalizer(token); };
            const a = Array(80).fill('Word'), b = Array(81).fill('word');
            buildLcsMatrix(a, b);
            check('normalization work is once per input token', count === a.length + b.length);
            normalizeDiffToken = normalizer;
            check('raw token arrays retained', a.every(token => token === 'Word') && b.every(token => token === 'word'));
            check('case-only edits retained', JSON.stringify(getDiffOperations('word', 'WORD')) === '[]');
            check('minimal grammar markup retained', buildMinimalCorrectionMarkup('We was happy.', 'We were happy.') === 'We **were** happy.');
            check('model-marked corrections retained', buildMinimalCorrectionMarkup('We run.', 'We **ran**.') === 'We **ran**.');
            const hostile = renderCorrected('Safe', '<img src=x onerror="window.diffInjected=1"> & <script>x</script>');
            setWftSanitizedInnerHtml('correctedStory', hostile);
            check('actual corrected result rejects HTML injection', !document.querySelector('#correctedStory img, #correctedStory script') && !window.diffInjected && hostile.includes('&lt;') && hostile.includes('&amp;'));
            setWftSanitizedInnerHtml('correctedStory', renderCorrected('We was happy.', 'We were happy.'));
            check('actual result highlights only corrected word', document.querySelectorAll('#correctedStory .corrected-highlight').length === 1 && document.querySelector('#correctedStory .corrected-highlight').textContent === 'were');
            const grammarGuardObservations = [], grammarAnalyzer = analyzeGrammarChanges, grammarLcs = buildLcsMatrix;
            let analyzerCalls = 0, lcsCalls = 0;
            analyzeGrammarChanges = function(...args) { analyzerCalls++; return grammarAnalyzer.apply(this, args); };
            buildLcsMatrix = function(...args) { lcsCalls++; return grammarLcs.apply(this, args); };
            const checkGrammarGuard = (name, expected, calls, run) => {
                analyzerCalls = lcsCalls = 0;
                const output = run();
                grammarGuardObservations.push({name, output, analyzerCalls, lcsCalls});
                check(name + ' literal original output', output === expected);
                check(name + ' delegated analyzer count', analyzerCalls === calls);
                check(name + ' delegated LCS count', lcsCalls === calls);
            };
            try {
                const helperReason = 'Your ideas are clear, though many sentences need verb form fixes. Try reading each sentence aloud and check that every verb matches its subject.';
                const midVerbReason = 'Your grammar is mostly clear, and your ideas come through well. Before you finish, reread each sentence and make sure every verb stays in the right tense.';
                const smallEditReason = 'Your ideas come through clearly. A few grammar fixes are still needed - check that each sentence has a clear subject and the right verb form.';
                const scores = [
                    ['null', null, '', 0], ['undefined', undefined, '', 0], ['zero', 0, helperReason, 1], ['negative', -1, helperReason, 1],
                    ['string-zero', '0', helperReason, 1], ['string-six', '6', helperReason, 1], ['string-seven', '7', midVerbReason, 1], ['string-eight', '8', midVerbReason, 1],
                    ['string-eight-half', '8.5', '', 0], ['string-nine', '9', '', 0], ['string-ten', '10', '', 0],
                    ['six', 6, helperReason, 1], ['seven', 7, midVerbReason, 1], ['eight', 8, midVerbReason, 1], ['eight-half', 8.5, '', 0], ['nine', 9, '', 0], ['ten', 10, '', 0],
                    ['trimmed-high', ' 9 ', '', 0], ['empty', '', '', 0], ['blank', '   ', '', 0], ['invalid', 'not-a-score', '', 0],
                    ['nan', NaN, '', 0], ['infinite', Infinity, '', 0], ['negative-infinite', -Infinity, '', 0], ['above-rubric', 11, '', 0], ['boolean', true, '', 0]
                ];
                for (const [label, score, expected, calls] of scores) checkGrammarGuard('grammar score/' + label, expected, calls, () => buildGrammarReasonFromData(score, 'We was happy.', 'We were happy.'));
                const manyOriginal = 'A cat sleeps. The dog sits. A bird sings. The fish swims.';
                const manyCorrected = 'A kitten sleeps. The puppy sits. A parrot sings. The shark swims.';
                const branches = [
                    ['helper', 6, 'We was happy.', 'We were happy.', helperReason],
                    ['verb', 6, 'I go home.', 'I went home.', 'Your message makes sense, but verb tense shifts throughout. Pick one tense (past or present) and use it consistently all the way through.'],
                    ['many-low', 6, manyOriginal, manyCorrected, 'Your writing is easy to follow, but several grammar issues need attention. Do a line-by-line proofread focusing on subject-verb agreement and complete sentences.'],
                    ['small-low', 6, 'The cat sleeps.', 'The kitten sleeps.', smallEditReason],
                    ['verb-mid', 7, 'I go home.', 'I went home.', midVerbReason],
                    ['many-mid', 7, manyOriginal, manyCorrected, 'Your grammar is mostly strong. Do one more careful reread and look for any missing words, small verb changes, or sentences that sound incomplete.'],
                    ['small-mid', 7, 'The cat sleeps.', 'The kitten sleeps.', '']
                ];
                for (const [label, score, original, corrected, expected] of branches) checkGrammarGuard('grammar branch/' + label, expected, 1, () => buildGrammarReasonFromData(score, original, corrected));
                const primitiveTexts = [['null', null, null], ['undefined', undefined, undefined], ['zero', 0, 0], ['number', 123, 456], ['boolean', true, false], ['empty', '', ''], ['unicode', 'ไทย café 😀', 'ไทย CAFÉ 😁']];
                for (const [label, original, corrected] of primitiveTexts) for (const score of [6, 9]) checkGrammarGuard('grammar primitive/' + label + '/' + score, score === 6 ? smallEditReason : '', score === 6 ? 1 : 0, () => buildGrammarReasonFromData(score, original, corrected));
                const polishedHighReason = 'Your sentences are mostly clear; next, proofread for complete sentences and verb tense.';
                const callerScores = [[null, 'Existing grammar reason.', 0], [0, 'Your ideas are clear, though many sentences need verb form fixes.', 1], [6, 'Your ideas are clear, though many sentences need verb form fixes.', 1], [7, 'Your grammar is mostly clear, and your ideas come through well.', 1], [8, 'Your grammar is mostly clear, and your ideas come through well.', 1], [8.5, polishedHighReason, 0], [9, polishedHighReason, 0], [10, polishedHighReason, 0], ['9', polishedHighReason, 0], ['invalid', 'Existing grammar reason.', 0]];
                for (const [index, [score, expected, calls]] of callerScores.entries()) checkGrammarGuard('grammar actual caller/' + index, expected, calls, () => {
                    const quick = {Grammar:{score, reason:'Existing grammar reason.'}};
                    polishFeedback(quick, {categories:{}}, 'We was happy.', 'We were happy.', null);
                    return quick.Grammar.reason;
                });
                const helperEvidence = 'Several grammar edits were needed, especially with verb forms and helping words in some sentences.';
                const lowEvidence = 'Several sentences needed grammar corrections before the meaning was fully clear.';
                const midEvidence = 'Only a few grammar edits were needed, mostly small fixes that will make your sentences sound smoother and more correct.';
                for (const [label, score, , calls] of scores) checkGrammarGuard('evidence score/' + label, calls && Number(score) <= 6 ? helperEvidence : '', calls, () => buildGrammarEvidenceFromData(score, 'We was happy.', 'We were happy.'));
                const evidenceBranches = [
                    ['verb', 6, 'I go home.', 'I went home.', 'Several grammar edits were needed, especially to keep verb tense steady across the story.'],
                    ['small-low', 6, 'The cat sleeps.', 'The kitten sleeps.', lowEvidence],
                    ['many-seven', 7, manyOriginal, manyCorrected, midEvidence], ['many-eight', 8, manyOriginal, manyCorrected, midEvidence]
                ];
                for (const [label, score, original, corrected, expected] of evidenceBranches) checkGrammarGuard('evidence branch/' + label, expected, 1, () => buildGrammarEvidenceFromData(score, original, corrected));
                for (const [label, original, corrected] of primitiveTexts) for (const score of [6, 9]) checkGrammarGuard('evidence primitive/' + label + '/' + score, score === 6 ? lowEvidence : '', score === 6 ? 1 : 0, () => buildGrammarEvidenceFromData(score, original, corrected));
                const evidenceCallers = [
                    ['null', null, polishedHighReason, 0], ['zero', 0, helperEvidence, 1], ['negative', -1, helperEvidence, 1], ['six', 6, helperEvidence, 1],
                    ['seven', 7, polishedHighReason, 1], ['eight', 8, polishedHighReason, 1], ['eight-half', 8.5, polishedHighReason, 0], ['nine', 9, polishedHighReason, 0], ['string-nine', '9', polishedHighReason, 0], ['invalid', 'invalid', polishedHighReason, 0],
                    ['many-mid', 7, midEvidence, 1, false, true],
                    ['high-density', 9, 'a number of grammar edits remain before this draft is ready.', 0, true],
                    ['mid-density', 7, 'a number of grammar edits were needed, important fixes that will make your sentences sound smoother and more correct.', 1, true, true]
                ];
                for (const [label, score, expected, calls, dense, many] of evidenceCallers) {
                    const quick = {UnrelatedFixture:{value:'quick-other'}}, detailed = {categories:{Grammar:{score, evidence:dense ? 'Only a few grammar edits remain before this draft is ready.' : polishedHighReason, teacherComment:dense ? 'Only a few grammar edits need a final careful reread.' : 'Keep this teacher comment exactly.', totalErrors:dense ? 40 : 2, errorDensity:dense ? 10 : 1, growthTip:'Reread each sentence carefully and check every subject and verb.', contentOrganization:'Specific details stay in their original order.', sentenceVariety:'The sentence pattern stays unchanged in this fixture.', metadata:{token:'keep-exact'}}, UnrelatedFixture:{value:'detail-other'}}, metadata:{token:'detail-root'}};
                    const before = structuredClone({quick, detailed});
                    checkGrammarGuard('evidence detailed caller/' + label, JSON.stringify([expected, dense ? 'a number of grammar edits need a final careful reread.' : 'Keep this teacher comment exactly.']), calls, () => {
                        polishFeedback(quick, detailed, many ? manyOriginal : 'We was happy.', many ? manyCorrected : 'We were happy.', null);
                        return JSON.stringify([detailed.categories.Grammar.evidence, detailed.categories.Grammar.teacherComment]);
                    });
                    const after = structuredClone({quick, detailed}), preserved = structuredClone(after);
                    grammarGuardObservations.at(-1).callerState = {before, after};
                    preserved.detailed.categories.Grammar.evidence = before.detailed.categories.Grammar.evidence;
                    preserved.detailed.categories.Grammar.teacherComment = before.detailed.categories.Grammar.teacherComment;
                    check('evidence detailed caller/' + label + ' retains score and all other data without quick Grammar', Object.is(detailed.categories.Grammar.score, score) && JSON.stringify(preserved) === JSON.stringify(before) && !Object.hasOwn(quick, 'Grammar'));
                }
                checkGrammarGuard('evidence separate pattern consumer', 'Minor issue|Minor to moderate issue|Mostly clear|Not a major issue|Mostly clear', 1, () => buildGrammarPatternNotes(9, 'We was happy.', 'We were happy.').map(note => note.level).join('|'));
            } finally { analyzeGrammarChanges = grammarAnalyzer; buildLcsMatrix = grammarLcs; }
            return {cases, normalizationCalls:count, grammarGuardObservations};
        });
        result.errors = errors; result.root = root;
        result.passed = result.cases.filter(c => c.passed).length; result.failed = result.cases.length - result.passed;
        result.scope = 'Full shipped native Edge source; synthetic exact original-matrix/caller parity and safe DOM rendering; external requests blocked.';
        if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify({suite:'correction-performance', passed:result.passed, failed:result.failed, normalizationCalls:result.normalizationCalls, failures:result.cases.filter(c => !c.passed), errors}));
        assert.deepEqual(errors, []); assert.equal(result.failed, 0);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
