const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const sanitizerCases = [
 ['<p>Before<!--discard--><strong title="ok" onclick="bad()">Safe</strong>After</p>', '<p>Before<strong title="ok">Safe</strong>After</p>'],
 ['<script>bad()</script><unknown><b>text</b></unknown>', 'bad()text'],
 ['<a href="https://example.test">web</a><a href="mailto:a@example.test">mail</a><a href="#part">part</a>', '<a href="https://example.test">web</a><a href="mailto:a@example.test">mail</a><a href="#part">part</a>'],
 ['<a href="javascript:bad()" target="_blank" data-id="one" class="ok">link</a>', '<a data-id="one" class="ok">link</a>'],
 ['<span style="color: red" role="note" aria-label="note">safe</span>', '<span style="color: red" role="note" aria-label="note">safe</span>'],
 ...['expression(bad())', 'background: url(x)', 'javascript:bad()', 'behavior: x', '-moz-binding: x', ''].map(style => ['<span style="'+style+'">text</span>', '<span>text</span>']),
 ['<table><tbody><tr><td colspan="2" rowspan="3">cell</td></tr></tbody></table>', '<table><tbody><tr><td colspan="2" rowspan="3">cell</td></tr></tbody></table>']
];
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return route.fulfill(fs.existsSync(file) ? { contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html', body: fs.readFileSync(file) } : { status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
        // Check the renderer and imported HTML policy against full native scripts.
        const renderer = await page.evaluate(sanitizerCases => {
stopWftSyncPolling();scheduleWftCloudSync=()=>{};const cases=[];const check=(name,ok)=>{if(!ok)throw new Error(name);cases.push(name);};
const raw='<img src=x onerror="window.syntheticMarker=1">';window.syntheticMarker=0;
const rows=[{area:raw,comment:'**Clear** '+raw}];
for(const n of ['renderAuditEvidenceList','renderNoticeTable','renderPortfolioFeedbackRows']){const html=window[n](rows);check(n+' escape and content',html.includes('&lt;img')&&!html.includes('<img'));check(n+' empty',typeof window[n]([])==='string');}
const neutral=renderPortfolioFeedbackCategoryBlock(raw,{score:null,teacherComment:raw,noticeRows:rows,growthTip:raw},true);check('category null and escaped label',neutral.includes('Not scored')&&neutral.includes('&lt;img')&&!neutral.includes('<img'));check('category zero retained',renderPortfolioFeedbackCategoryBlock('Grammar',{score:0},false).includes('0/10'));
const goal=renderPortfolioGrowGoalBlock({growGoal:{strength:'**Clear**',growGoal:raw,nextTime:'Check verbs.',closing:'Keep writing.'}},{});check('goal escape/bold/sections',goal.includes('<strong>Clear</strong>')&&goal.includes('&lt;img')&&!goal.includes('<img'));check('goal fallback',renderPortfolioGrowGoalBlock(null,{growGoal:'Revise a sentence.'}).includes('Revise a sentence.'));check('goal empty',renderPortfolioGrowGoalBlock(null,{})==='');
const el=document.createElement('div');setWftSanitizedInnerHtml(el,'<strong>Safe</strong>'+raw);check('sanitized direct target',el.textContent==='Safe'&&!el.querySelector('img'));setWftSanitizedInnerHtml(el,null,'<em>Fallback</em>');check('sanitized fallback',el.innerHTML==='<em>Fallback</em>');setWftSanitizedInnerHtml('missing-synthetic-target',raw);check('sanitized missing target',true);
check('sanitizer nested tags and attribute policy', sanitizerCases.every(([input, expected]) => sanitizeWftHtmlFragment(input) === expected));
localStorage.setItem('wft_portfolio',JSON.stringify({Alice:{sessions:[{id:'one',title:raw,overall:0,detailedFeedback:{categories:{Grammar:{score:null,teacherComment:raw,noticeRows:rows,growthTip:'Revise.'}},growGoal:{growGoal:raw}}}]}}));
openPortfolioCategoryFeedback('Alice','one','Grammar');let modal=document.getElementById('portfolioFeedbackModalBackdrop');check('category modal actual shell',modal.textContent.includes('Not scored')&&modal.textContent.includes('0%')&&!modal.querySelector('img'));modal.querySelector('.btn-view-detailed-feedback').click();modal=document.getElementById('portfolioFeedbackModalBackdrop');check('detail navigation actual click',modal.querySelector('h2').textContent==='Detailed Writing Feedback'&&modal.textContent.includes('Not scored'));closePortfolioFeedbackModal();openPortfolioDetailedFeedback('Alice','missing');check('missing detail fallback',document.getElementById('portfolioFeedbackModalBackdrop').textContent.includes('older portfolio'));closePortfolioFeedbackModal();
const analysis={writingGenre:{mainGenre:'Narrative / Story',safeReference:'story'},categoryScores:{Grammar:7},detailed:{categories:{Grammar:{score:7,teacherComment:'Clear verbs',evidence:'Clear verbs',noticeRows:[{area:'Verbs',comment:'Check tense.'}],growthTip:'Check verbs.'}},strength:'Clear ideas',growGoal:'Revise verbs',nextTime:'Read aloud.',keepWriting:'Keep writing.'}};
const saved=buildPortfolioDetailedFeedback(analysis),summary=buildSessionFeedbackSummary(analysis);check('saved record score and goals',saved.categories.Grammar.score===7&&saved.growGoal.growGoal==='Revise verbs'&&summary.growGoal==='Revise verbs'&&summary.writingGenre.mainGenre==='Narrative / Story');
check('no imported image execution',window.syntheticMarker===0);return{cases,scope:'Full native scripts at WFT_TEST_ROOT; synthetic DOM/portfolio and intercepted external requests.'};
        }, sanitizerCases);
        // Retain all assertions in the coordinator's 10 Flow/grammar checks.
        const flow = await page.evaluate(() => {
            const assert = {
                equal(a, b) { if (a !== b) throw new Error(JSON.stringify([a, b])); },
                match(a, re) { if (!re.test(a)) throw new Error(a + ' fails ' + re); },
                ok(a) { if (!a) throw new Error('Expected truthy'); },
                deepEqual(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Different values'); }
            };
const plain=x=>JSON.parse(JSON.stringify(x));const cases=[];const check=(name,fn)=>{fn();cases.push(name);};
check('flow missing data',()=>{assert.equal(window.buildFlowReasonFromData(6,null),'');assert.equal(window.buildFlowEvidenceFromData(6,null),'');});
const flow={starterInfo:{ratio:.5,mostCommonStarter:'I'},shortRun:4,varietyScore:40,shortCount:4,mediumCount:1,longCount:1};
check('flow low mixed evidence',()=>{assert.match(window.buildFlowReasonFromData(6,flow),/50%.*short sentences/);assert.match(window.buildFlowEvidenceFromData(6,flow),/50%.*short sentences/);});
check('flow intermediate and high',()=>{assert.match(window.buildFlowReasonFromData(8,flow),/50%/);assert.equal(window.buildFlowReasonFromData(9,flow),'');assert.equal(window.buildFlowEvidenceFromData(9,flow),'');});
check('flow balanced high variety',()=>{const balanced={...flow,starterInfo:{ratio:.2},shortRun:0,varietyScore:90};assert.match(window.buildFlowReasonFromData(8,balanced),/variety is strong/);assert.match(window.buildFlowEvidenceFromData(8,balanced),/short: 4, medium: 1, long: 1/);});
check('grammar actual diff and bands',()=>{assert.match(window.buildGrammarReasonFromData(6,'I go home.','I went home.'),/verb tense/);assert.equal(window.buildGrammarReasonFromData(9,'I go home.','I went home.'),'');const low=window.buildGrammarPatternNotes(4,'I go home.','I went home.'),high=window.buildGrammarPatternNotes(8,'I go home.','I went home.');assert.equal(low.length,5);assert.equal(low[4].level,'Needs support');assert.equal(high[4].level,'Mostly clear');});
check('grammar density wording',()=>{assert.equal(window.alignGrammarWordingWithErrorData('only a few grammar edits',{totalErrors:0}),'only a few grammar edits');assert.equal(window.alignGrammarWordingWithErrorData('a few grammar edits',{totalErrors:25}),'several grammar edits');assert.equal(window.alignGrammarWordingWithErrorData('a few grammar edits',{errorDensity:10}),'a number of grammar edits');assert.equal(window.alignGrammarWordingWithErrorData('',null),'');});
check('notice need neutral and empty',()=>{assert.equal(window.pickNoticeComment([{comment:'Mostly clear.'},{comment:'Check tense.'}],true),'Check tense.');assert.equal(window.pickNoticeComment([{comment:'Check tense.'},{comment:'Clear idea.'}],false),'Clear idea.');assert.equal(window.pickNoticeComment([],true),'');});
check('action category branches',()=>{for(const k of ['Ideas & Details','Grammar','Word Choice','Organization','Flow','Spelling & Punctuation','Neatness','Unknown'])assert.ok(window.buildActionGrowthTip(k,{score:8},[]).length>20);assert.match(window.buildActionGrowthTip('Grammar',{score:6},[{comment:'Check verb tense.'}]),/underline/);assert.match(window.buildActionGrowthTip('Neatness',{score:6},[{comment:'Check spacing.'}]),/finger-width/);});
check('sentence bands and limits',()=>{assert.equal(window.analyzeSentenceVariety([],[]).varietyLabel,'No data');const balanced=window.analyzeSentenceVariety([7,14,15],['We went.','Then we ate.','Finally we left.']);assert.equal(balanced.shortCount,1);assert.equal(balanced.mediumCount,1);assert.equal(balanced.longCount,1);assert.equal(balanced.varietyScore,100);const repetitive=window.analyzeSentenceVariety([2,2,2,2,2,2],Array(6).fill('I went.'));assert.equal(repetitive.shortRun,6);assert.equal(repetitive.varietyScore,0);assert.equal(repetitive.flowRating,'Needs Improvement');});
check('convention focused heuristics',()=>{assert.deepEqual(plain(window.detectConventionIssues('')),[]);assert.deepEqual(plain(window.detectConventionIssues('I went home.')),[]);assert.ok(window.detectConventionIssues('i went home').some(x=>x.type==='lowercase-i'));assert.ok(window.detectConventionIssues('i went home').some(x=>x.type==='end-punctuation'));assert.ok(window.detectConventionIssues('We went. then we ate.').some(x=>x.type==='sentence-capital'));assert.ok(window.detectConventionIssues('We went .').some(x=>x.type==='space-before-punctuation'));});

            return { cases };
        });
        assert.deepEqual(errors, []);
        assert.equal(renderer.cases.length, 20);
        assert.equal(flow.cases.length, 10);
        const result = { count: 30, passed: 30, renderer, flow, errors, scope: 'Native Edge compatibility assertions, no service calls or grading-calibration change.' };
        if (process.env.WFT_COMPAT_REPORT) fs.writeFileSync(process.env.WFT_COMPAT_REPORT, JSON.stringify(result, null, 2) + '\n');
        console.log('Feedback compatibility: 20 renderer + 10 Flow/grammar checks passed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
