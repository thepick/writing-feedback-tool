const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

function runNotebookGuidanceCases() {
    stopWftSyncPolling();
    const cases = [];
    const check = (name, passed, observed) => cases.push({name, passed:!!passed, observed});
    const original = 'We played in the park. We ate lunch at home.';
    const revision = 'We played in the park.\n\nWe ate lunch at home.';
    const candidate = {area:'Organization', skill:'Starting a new paragraph', page1Connection:'Organization', originalQuote:original, nextTimeExample:revision, whyThisWorks:'A new paragraph separates the two parts.'};
    const sanitize = changes => sanitizeNotebookGuideCandidate({...candidate, ...changes}, original, null, null);
    function checkConventionCases() {
        for (const [name, before, after, label] of [
            ['punctuation', 'My cat is big', 'My cat is big.', 'Checking Punctuation'],
            ['spelling', 'My cate is big.', 'My cat is big.', 'Checking Conventions'],
            ['both', 'My cate is big', 'My cat is big.', 'Checking Conventions'],
            ['no change', 'My cat is big.', 'My cat is big.', 'Checking Conventions'],
            ['capitalization', 'i went home.', 'I went home.', 'Checking Conventions'],
            ['comma', 'After lunch we played.', 'After lunch, we played.', 'Checking Punctuation'],
            ['plural', 'The bunnys hopped.', 'The bunnies hopped.', 'Fixing Plurals'],
            ['plural and complete verb', 'The bunnys playing catch.', 'The bunnies are playing catch.', 'Fixing Plurals and Complete Verbs']
        ]) check('convention ' + name, inferConventionSkill(before, after) === label, inferConventionSkill(before, after));
        const priority = {category:'Spelling & Punctuation'};
        for (const [name, before, after, label] of [
            ['marker caller spelling', 'i cate is big.', 'I cat is big.', 'Checking Conventions'],
            ['marker caller punctuation', 'i went home', 'I went home.', 'Checking Punctuation'],
            ['unmarked caller punctuation', 'My cat is big', 'My cat is big.', 'Checking Punctuation']
        ]) {
            const ex = buildFallbackExampleForPriority(priority, before, after);
            check(name, ex?.skill === label && ex.originalQuote === before && originalTextContainsNotebookQuote(before, ex.originalQuote), ex);
        }
        check('fallback no convention change', buildFallbackExampleForPriority(priority, 'My cat is big.', 'My cat is big.') === null);
    }
    checkConventionCases();
    function checkGroundedExamples() {
        const priority = {category:'Spelling & Punctuation'};
        for (const before of ['The mans hat fell.', 'The womans coat is blue.', 'The childs toy broke.', 'The bunnys ears are long.']) {
            const ex = buildFallbackExampleForPriority(priority, before, before);
            check('no guessed plural ' + before, ex === null, ex);
        }
        const possessive = buildFallbackExampleForPriority(priority, 'The mans hat fell.', "The man's hat fell.");
        check('corrected possessive retained', possessive?.nextTimeExample === "The man's hat fell.", possessive);
        const plural = buildFallbackExampleForPriority(priority, 'The bunnys hopped.', 'The bunnies hopped.');
        check('corrected plural retained', plural?.nextTimeExample === 'The bunnies hopped.', plural);
        const capital = buildFallbackExampleForPriority(priority, 'i went home.', 'i went home.');
        check('safe capitalization fallback retained', capital?.nextTimeExample === 'I went home.', capital);
        const saved = getNotebookGuideFromPortfolioSession({originalText:'The mans hat fell.', correctedPlainText:'The mans hat fell.',
            categoryScores:{'Spelling & Punctuation':0}, detailedFeedback:{categories:{}}});
        check('saved guide reconstruction does not guess plural', saved.examples.length === 0, saved);
        const source = 'i play with my dogs. I wonder about them.';
        const quoteCandidate = quote => ({area:'Grammar', skill:'Past tense', page1Connection:'Grammar', originalQuote:quote,
            nextTimeExample:quote.replace('play', 'played').replace('won', 'won yesterday'), whyThisWorks:'This shows past time.'});
        for (const quote of ['I play with my dogs.', 'i play with my dog', 'I won']) {
            const c = quoteCandidate(quote);
            check('fabricated quote rejected ' + quote, sanitizeNotebookGuideCandidate(c, source, null, null) === null);
            const guide = assembleNotebookGuideFromCandidates([c], source, null, [{category:'Grammar'}], {correctedText:source});
            check('fabricated quote absent from guide ' + quote, !guide.examples.some(ex => ex.originalQuote === quote), guide.examples);
        }
        for (const [text, quote] of [
            [source, 'i play with my dogs.'],
            ['I wonder. I won!', 'I won'],
            ['The dog ran.', 'dog'],
            ['She said “go home.”', 'She said "go home."'],
            ['We played.\n\nWe ate.', 'We played. We ate.']
        ]) check('exact quote retained ' + quote, originalTextContainsNotebookQuote(text, quote));
        for (const [text, quote] of [['The wildcats sleep.', 'cats sleep.'], ["The dog's hat fell.", 'dog'],
            ['We re-play today.', 'play today.'], ['The café opens.', 'caf']]) {
            check('word fragment rejected ' + quote, !originalTextContainsNotebookQuote(text, quote));
        }
    }
    checkGroundedExamples();
    const dictionaryPriorities = [{category:'Grammar'}];
    const constructorCandidate = {area:'Grammar', skill:'Complete phrase', page1Connection:'Grammar', originalQuote:'constructor',
        nextTimeExample:'The constructor', whyThisWorks:'This makes the phrase clearer.'};
    const constructorWords = getNotebookGuideContentWords('constructor');
    check('constructor remains a content word', JSON.stringify(constructorWords) === JSON.stringify(['constructor']), constructorWords);
    const constructorSanitized = sanitizeNotebookGuideCandidate(constructorCandidate, 'I saw the constructor near the bridge.', null, dictionaryPriorities);
    check('grounded constructor candidate accepted', constructorSanitized?.nextTimeExample === constructorCandidate.nextTimeExample, constructorSanitized);
    const constructorGuide = assembleNotebookGuideFromCandidates([constructorCandidate], 'I saw the constructor near the bridge.', null, dictionaryPriorities, {});
    check('constructor candidate retained in guide', constructorGuide.examples.some(ex => ex.originalQuote === 'constructor' && ex.nextTimeExample === constructorCandidate.nextTimeExample), constructorGuide.examples);
    const protoCandidate = {...constructorCandidate, originalQuote:'__proto__', nextTimeExample:'The __proto__ value'};
    const protoDuplicate = {...protoCandidate, nextTimeExample:'A __proto__ value'};
    const protoSanitized = sanitizeNotebookGuideCandidate(protoCandidate, '__proto__', null, dictionaryPriorities);
    check('prototype quote already meets candidate contract', protoSanitized?.nextTimeExample === protoCandidate.nextTimeExample, protoSanitized);
    const protoGuide = assembleNotebookGuideFromCandidates([protoCandidate, protoDuplicate], '__proto__', null, dictionaryPriorities, {});
    check('first prototype quote retained and duplicate rejected', protoGuide.examples.length === 1 && protoGuide.examples[0].nextTimeExample === protoCandidate.nextTimeExample, protoGuide.examples);
    const ordinaryCandidate = {...constructorCandidate, originalQuote:'We was happy.', nextTimeExample:'We were happy.'};
    const extraProtoGuide = assembleNotebookGuideFromCandidates([ordinaryCandidate, protoCandidate, protoDuplicate], 'We was happy. __proto__', null, dictionaryPriorities, {});
    check('prototype quote retained after required category without duplicate',
        JSON.stringify(extraProtoGuide.examples.map(ex => ex.nextTimeExample)) === JSON.stringify([ordinaryCandidate.nextTimeExample, protoCandidate.nextTimeExample]), extraProtoGuide.examples);
    const ordinaryContentWords = getNotebookGuideContentWords('THE and while cats play with toy 123');
    check('declared stop words and ordinary token rules unchanged', JSON.stringify(ordinaryContentWords) === JSON.stringify(['cats', 'play', 'toy', '123']), ordinaryContentWords);
    function checkParagraphRevisions() {
        const paragraphOnly = sanitize({});
        check('paragraph only concrete and retained', paragraphOnly?.nextTimeExample === revision, paragraphOnly);
        const paragraphWord = sanitize({nextTimeExample:'We played in the park.\n\nLater, we ate lunch at home.'});
        check('paragraph and word revision retained', paragraphWord?.nextTimeExample.includes('\n\n'), paragraphWord);
        check('CRLF normalized', sanitize({nextTimeExample:revision.replace(/\n/g, '\r\n')})?.nextTimeExample === revision);
        check('blank line spaces normalized', sanitize({nextTimeExample:'We played in the park.\n \t\nWe ate lunch at home.'})?.nextTimeExample === revision);
        check('ordinary wrap not concrete', !isConcreteNotebookGuideRevision(original, original.replace('. ', '.\n')));
        check('sentence metadata normalization unchanged', cleanNotebookGuideText(revision) === original);
        check('unchanged paragraph not concrete', !isConcreteNotebookGuideRevision(revision, revision.replace(/\n/g, '\r\n')));
        check('no break rejected for paragraph label', sanitize({nextTimeExample:'We played in the park. Later, we ate lunch at home.'}) === null);
        check('empty break rejected', sanitize({nextTimeExample:original + '\n\n'}) === null);
        check('off text quote rejected', sanitize({originalQuote:'The student never wrote this sentence.'}) === null);
        check('unrelated replacement rejected', sanitize({nextTimeExample:'Astronauts collected meteorites.\n\nSatellites orbited Mars.'}) === null);
        check('generic advice rejected', sanitize({nextTimeExample:'Try adding paragraphs.\n\nCheck your writing.'}) === null);
        check('malformed candidates rejected', [null, [], 12, 'bad'].every(value => sanitizeNotebookGuideCandidate(value, original, null, null) === null));
        for (const markup of ['We played in the park.<br><br>We ate lunch at home.', '<p>We played in the park.</p><p>We ate lunch at home.</p>']) {
            check('safe paragraph markup ' + markup.slice(0, 8), sanitize({nextTimeExample:markup})?.nextTimeExample === revision);
        }
        const made = makeNotebookGuideExample(candidate.area, candidate.skill, candidate.page1Connection, original, revision, candidate.whyThisWorks);
        check('fallback example factory retains paragraph', made?.nextTimeExample === revision, made);
        const fallback = buildNotebookGuideFallback(original, revision, {categoryScores:{Organization:4}}, null, [{category:'Organization'}]);
        check('grounded paragraph fallback', fallback.examples[0]?.nextTimeExample === revision && originalTextContainsNotebookQuote(original, fallback.examples[0]?.originalQuote), fallback);
        check('paragraph plus word fallback', buildFallbackExampleForPriority({category:'Organization'}, original, paragraphWord?.nextTimeExample || 'We played in the park.\n\nLater, we ate lunch at home.')?.nextTimeExample.includes('\n\n'));
        check('existing paragraph word change is not a paragraph fallback', buildFallbackExampleForPriority({category:'Organization'}, revision, 'We played in the park.\n\nLater, we ate lunch at home.') === null);
        check('off text fallback rejected', buildFallbackExampleForPriority({category:'Organization'}, original, 'Astronauts collected meteorites.\n\nSatellites orbited Mars.') === null);
        const long = 'We played in the park.\n\n' + 'We ate lunch at home. '.repeat(20);
        const truncated = truncateNotebookGuideText(long, 100, true);
        check('truncation keeps meaningful break and limit', truncated.length <= 100 && truncated.includes('\n\n') && truncated.endsWith('...'), truncated);
        const cutOriginal = 'We played at home. '.repeat(8).trim();
        const cutCandidate = {...candidate, originalQuote:cutOriginal, nextTimeExample:cutOriginal + ' ' + 'We played at home. '.repeat(5) + '\n\nWe ate lunch.'};
        check('break beyond truncation rejected', sanitizeNotebookGuideCandidate(cutCandidate, cutOriginal, null, null) === null);
    }
    checkParagraphRevisions();
    const json = '## Notebook Guide Candidate JSON\n```json\n' + JSON.stringify({candidates:[candidate, candidate, {...candidate, originalQuote:'Never written.'}]}) + '\n```';
    const parsed = parseDetailedAssessment(json, original, null);
    check('native model parsing retains paragraph', parsed.notebookGuideCandidates.length === 2 && parsed.notebookGuideCandidates.every(ex => ex.nextTimeExample === revision), parsed.notebookGuideCandidates);
    check('malformed model JSON safe', parseNotebookGuideCandidatesFromStep3Text('## Notebook Guide Candidate JSON\n{oops', original, null).length === 0);
    const data = {categoryScores:{Organization:4}, detailed:{categories:{Organization:{score:4, growthTip:'Start a new paragraph.'}}, notebookGuideCandidates:parsed.notebookGuideCandidates}, correctedStory:revision, sampleStatus:{status:'scorable'}};
    const guide = ensureNotebookGuide(data, original);
    check('sanitized guide deduplicates quotes', guide.examples.length === 1 && guide.examples[0]?.nextTimeExample === revision, guide);
    const missingCandidates = {...data, notebookGuide:null, detailed:{categories:data.detailed.categories, notebookGuideCandidates:[]}};
    check('missing model guide uses grounded paragraph fallback', ensureNotebookGuide(missingCandidates, original).examples[0]?.nextTimeExample === revision);
    const manyOriginal = 'I saw a dog. The dog was nice. I play with the dog yesterday. We ate lunch at home.';
    const many = [
        {area:'Flow', skill:'Vary openings', page1Connection:'Flow', originalQuote:'I saw a dog.', nextTimeExample:'At the park, I saw a dog.', whyThisWorks:'The opening varies.'},
        {area:'Word Choice', skill:'Precise words', page1Connection:'Word Choice', originalQuote:'The dog was nice.', nextTimeExample:'The dog was friendly.', whyThisWorks:'Friendly is precise.'},
        {area:'Grammar', skill:'Past tense', page1Connection:'Grammar', originalQuote:'I play with the dog yesterday.', nextTimeExample:'I played with the dog yesterday.', whyThisWorks:'Played shows past time.'},
        {area:'Grammar', skill:'Clear verb', page1Connection:'Grammar', originalQuote:'We ate lunch at home.', nextTimeExample:'We enjoyed lunch at home.', whyThisWorks:'Enjoyed is a clear verb.'}
    ];
    const bounded = assembleNotebookGuideFromCandidates(many, manyOriginal, null, [{category:'Flow'}, {category:'Word Choice'}], {});
    check('two priority candidate maximum', bounded.examples.length === 2 && new Set(bounded.examples.map(ex => ex.originalQuote)).size === 2, bounded.examples);
    function checkRenderedParagraphs() {
        const html = renderNotebookGuideHtml(guide, getNotebookPrintGuideRenderOptions());
        setWftSanitizedInnerHtml('notebookPage2Content', html);
        const after = document.querySelector('#notebookPage2Content .example-after');
        check('sanitized DOM paragraph markup', after?.querySelectorAll('br').length === 2 && after.innerHTML.includes('<br><br>'), after?.innerHTML);
        const evil = {...candidate, nextTimeExample:'We played in the park.\n\nWe ate <img src=x onerror="window.guideInjected=1"> lunch at home. & <script>window.guideInjected=2</script>'};
        const evilHtml = renderNotebookGuideExamples({examples:[evil]});
        setWftSanitizedInnerHtml('notebookPage2Content', evilHtml);
        check('escaped renderer no injection', !document.querySelector('#notebookPage2Content img, #notebookPage2Content script') && !window.guideInjected && evilHtml.includes('&amp;'), evilHtml);
    }
    checkRenderedParagraphs();
    function checkActionItems() {
        const actions = ['Add clear details.', 'Check my verbs.'];
        for (const [name, text, expected] of [
            ['two newline actions', 'Add clear details.\nCheck your verbs.', actions],
            ['CRLF actions', 'Add clear details.\r\nCheck your verbs.', actions],
            ['numbered actions', '1. Add clear details.\n2. Check your verbs.', actions],
            ['bulleted actions', '- Add clear details.\n- Check your verbs.', actions],
            ['bullet glyphs', '\u2022 Add clear details.\n\u2022 Check your verbs.', actions],
            ['semicolon fallback', 'Add clear details.; Check your verbs.', actions],
            ['single line action', 'Check your verbs.', ['Check my verbs.']],
            ['unstructured single line', 'Add clear details. Check your verbs.', ['Add clear details. Check my verbs.']],
            ['duplicate and max two', 'Add clear details.\nAdd clear details.\nCheck your verbs.\nUse stronger words.', actions],
            ['empty', '', []], ['whitespace', '\r\n\t ', []]
        ]) {
            const actual = extractNotebookActionItems(text);
            check('actions ' + name, JSON.stringify(actual) === JSON.stringify(expected), actual);
        }
        const checklist = buildNotebookActionChecklist({categoryScores:{Grammar:4}, detailed:{categories:{Grammar:{growthTip:'Add clear details.\nCheck your verbs.'}}}}, ['Unrelated fallback.'], 'Use stronger words.', 'Read aloud.');
        check('live checklist retains two actions without fallback', JSON.stringify(checklist) === JSON.stringify(actions), checklist);
        const compressed = extractNotebookActionItems('Next time, check your verbs (past tense).\nAdd ' + 'clear details '.repeat(30));
        check('per item compression first person and limit', compressed.length === 2 && /^Check my verbs\s*\.$/.test(compressed[0]) && compressed.every(s => s.length <= 160), compressed);
        for (const [name, text, expected] of [
            ['ASCII contraction', "You're checking your verbs.", 'I am checking my verbs.'],
            ['curly contraction', 'you\u2019re checking your verbs.', 'I am checking my verbs.'],
            ['full you are', 'You are checking your verbs.', 'I am checking my verbs.'],
            ['imperative', 'Check your verbs.', 'Check my verbs.'],
            ['existing first person', 'Read my writing aloud.', 'Read my writing aloud.'],
            ['plain you', 'Check that you use clear verbs.', 'Check that I use clear verbs.']
        ]) {
            const actual = buildNotebookActionChecklist({categoryScores:{Grammar:4}, detailed:{categories:{Grammar:{growthTip:text + '\nAdd clear details.'}}}}, [], '', '');
            check('live first-person ' + name, JSON.stringify(actual) === JSON.stringify([expected, 'Add clear details.']), actual);
        }
        const contractionData = {categoryScores:{Grammar:4}, detailed:{categories:{Grammar:{growthTip:"You're checking your verbs.\nYou are checking your verbs.\nRead your story aloud.\nAdd clear details."}}}};
        const contractionSnapshot = JSON.stringify(contractionData);
        const contractionActions = buildNotebookActionChecklist(contractionData, ['Unrelated fallback.'], '', '');
        check('live first-person deduplication order and two-item cap', JSON.stringify(contractionActions) === JSON.stringify(['I am checking my verbs.', 'Read my writing aloud.']), contractionActions);
        check('live first-person input unchanged', JSON.stringify(contractionData) === contractionSnapshot, contractionData);
    }
    checkActionItems();
    function checkNotebookGuidanceDecisions() {
        const tied = {
            categoryScores: {Flow:4, Grammar:4, 'Ideas & Details':4},
            detailed: {categories: {
                Flow: {growthTip:'Read your writing aloud.'},
                Grammar: {growthTip:'Check your verbs.'},
                'Ideas & Details': {growthTip:'Add clear details.'}
            }}
        };
        const tiedActions = buildNotebookActionChecklist(tied, [], '', '');
        check('tied checklist follows rubric order', JSON.stringify(tiedActions) === JSON.stringify(['Add clear details.', 'Check my verbs.']), tiedActions);
        const tiedPriorities = buildNotebookGuidePriorities(tied).map(item => item.category);
        check('tied guide priorities follow rubric order', JSON.stringify(tiedPriorities) === JSON.stringify(['Ideas & Details', 'Grammar', 'Flow']), tiedPriorities);

        const legacy = buildNotebookReconstructionDataFromSession({
            originalText: original,
            categoryScores: {'Ideas & Details':NaN, Grammar:null, Organization:'', Flow:undefined, 'Word Choice':0, 'Spelling & Punctuation':'0', Neatness:0},
            detailedFeedback: {growGoal:'Choose precise words.', nextTime:'Check your spelling.'},
            feedbackSummary: {growGoal:'Add details.', nextTime:'Read your writing aloud.'}
        });
        const legacyPriorities = buildNotebookGuidePriorities(legacy);
        check('legacy guide retains zero scores and saved goal precedence',
            legacy.detailed.growGoal === 'Choose precise words.' && legacy.detailed.nextTime === 'Check your spelling.' &&
            legacyPriorities[0].source === 'lowestScore' && JSON.stringify(legacyPriorities.map(item => item.category)) === JSON.stringify(['Word Choice', 'Spelling & Punctuation']), legacyPriorities);

        const strong = {categoryScores:{Grammar:8, Flow:9, 'Word Choice':9}, detailed:{categories:{Grammar:{growthTip:'Check your verbs.'}}}};
        const strongActions = buildNotebookActionChecklist(strong, [], 'Add clear details.\nUse stronger words.', '');
        check('checklist skips score eight growth tips', JSON.stringify(strongActions) === JSON.stringify(['Add clear details.', 'Use stronger words.']), strongActions);
        const strongPriorities = buildNotebookGuidePriorities(strong).map(item => item.category);
        check('guide keeps score eight priority and two category minimum', JSON.stringify(strongPriorities) === JSON.stringify(['Grammar', 'Word Choice']), strongPriorities);

        const fallbackActions = buildNotebookActionChecklist(null, ['Add clear details.', 'Read your story aloud.'], 'Add clear details.', '');
        check('checklist fallback deduplicates after text actions', JSON.stringify(fallbackActions) === JSON.stringify(['Add clear details.', 'Read my writing aloud.']), fallbackActions);
        const unchanged = sanitizeNotebookGuideCandidate({area:'Grammar', skill:'Verb tense', originalQuote:'We played in the park.', nextTimeExample:'We played in the park.', whyThisWorks:'The verb shows past time.'}, original, null, null);
        check('shared revision validator rejects unchanged candidate', unchanged === null, unchanged);
    }
    checkNotebookGuidanceDecisions();
    document.getElementById('studentWriting').value = original;
    selectedStudent = 'Synthetic';
    students = ['Synthetic'];
    populateStudentDropdown();
    latestAnalysisData = {...data, overall:60, actualWords:10, targetWords:100};
    latestAnalysisData.inputContext = captureCurrentWritingContext();
    fillNotebookSummary();
    check('full notebook summary renders break', document.querySelectorAll('#notebookPage2Content .example-after br').length === 2);
    saveCurrentSessionToPortfolio(latestAnalysisData);
    check('native save retains example and print snapshot', pendingPortfolioSync?.sessionData.notebookGuide.examples[0]?.nextTimeExample === revision && pendingPortfolioSync.sessionData.notebookPrintHtml.includes('park.<br><br>We ate'));
    const session = {originalText:original, correctedPlainText:revision, categoryScores:{Organization:4}, detailedFeedback:data.detailed, notebookGuide:guide, notebookGuideVersion:NOTEBOOK_GUIDE_VERSION};
    const portfolioHtml = buildNotebookPrintHtmlFromPortfolioSession('Synthetic', session);
    check('saved portfolio HTML renders break', /park\.<br><br>We ate/.test(portfolioHtml), portfolioHtml.includes('<br><br>'));
    check('legacy saved guide fallback renders break', /park\.<br><br>We ate/.test(buildNotebookPrintHtmlFromPortfolioSession('Synthetic', {...session, notebookGuide:null})));
    return {cases, html:buildNotebookPrintDocument(document.getElementById('notebookPrintDocument').innerHTML, 'Synthetic', 'Paragraph guide')};
}

(async () => {
    const browser = await chromium.launch({channel:'msedge', headless:true});
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return route.fulfill(fs.existsSync(file) ? {contentType:file.endsWith('.js') ? 'application/javascript' : 'text/html', body:fs.readFileSync(file)} : {status:404, body:''});
        });
        await page.goto('http://127.0.0.1:8765', {waitUntil:'domcontentloaded'});
        const result = await page.evaluate(runNotebookGuidanceCases);
        assert.deepEqual(errors, []);
        if (process.env.WFT_GUIDE_REPORT) fs.writeFileSync(process.env.WFT_GUIDE_REPORT, JSON.stringify({root, cases:result.cases, passed:result.cases.filter(c => c.passed).length, total:result.cases.length}, null, 2) + '\n');
        const failed = result.cases.filter(c => !c.passed);
        if (!process.env.WFT_EXPECT_BASELINE) assert.deepEqual(failed, []);
        if (!process.env.WFT_EXPECT_BASELINE) {
            await page.setContent(result.html, {waitUntil:'domcontentloaded'});
            await page.evaluate(() => window.fitAllNotebookPages());
            await page.emulateMedia({media:'print'});
            const layout = await page.locator('.page').evaluateAll(pages => pages.map(p => ({height:p.clientHeight, scroll:p.scrollHeight, warning:p.classList.contains('fit-warning')})));
            assert.equal(layout.length, 2);
            assert.ok(layout.every(p => !p.warning && p.scroll <= p.height + 1), JSON.stringify(layout));
            const paragraphBox = page.locator('.example-after').first();
            assert.equal(await paragraphBox.locator('br').count(), 2);
            assert.match(await paragraphBox.innerText(), /park\.\n\nWe ate/);
            if (process.env.WFT_GUIDE_PREVIEW) await page.locator('.page').nth(1).screenshot({path:process.env.WFT_GUIDE_PREVIEW});
        }
        console.log(JSON.stringify({passed:result.cases.length-failed.length, total:result.cases.length, failed}));
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
