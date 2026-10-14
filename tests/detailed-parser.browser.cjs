const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');

function runDetailedParserCases() {
    stopWftSyncPolling(); scheduleWftCloudSync = () => {};
    const cases = [], check = (name, passed, observed) => cases.push({name, passed:!!passed, observed});
    const labels = ['Ideas & Details','Grammar','Word Choice','Organization','Flow','Spelling & Punctuation'];
    const headings = ['1. Clear Ideas & Details','2. Grammar','3. Word Choice','4. Organization','5. Flow','6. Spelling & Punctuation'];
    const scores = [8,7,9,8,7,9];
    const original = Array(10).fill('We visited the park and played a game together.').join(' ');
    const candidate = {area:'Word Choice', skill:'Choose precise words', page1Connection:'Word Choice', originalQuote:'We visited the park and played a game together.', nextTimeExample:'We visited the park and played an exciting game together.', whyThisWorks:'Exciting tells more about the game.'};
    const sections = [
        '', '## Grow Goal Selection\n**Your Writing Strength:** Clear events.\n**Your Grow Goal:** Choose words.\n**Try This Next Time:** Use precise words.',
        '## What I Noticed\n- Area: 8 details\n  Comment: 7 examples.',
        '## Notebook Guide Candidate JSON\n```json\n'+JSON.stringify({candidates:[candidate]})+'\n```',
        '**Your Writing Strength:** 9 details.\n**Keep Writing!** Keep sharing.'
    ];
    const notice = i => '\n- Teacher Comment: Category '+i+' is clear.\n- What I Noticed:\n  - Area: Area '+i+'\n    Comment: Observed '+i+' details.\n- Growth Tip: Revise category '+i+'.';

    function checkCompleteCategories() {
        for (const bold of [false,true]) for (const section of sections) {
            const text = headings.map((h,i) => (bold ? '**'+h+':** ' : h+': ') + scores[i]+'/10'+notice(i)).join('\n')+'\n'+section;
            const parsed = parseDetailedAssessment(text, original, null);
            for (let i=0;i<labels.length;i++) {
                const item = parsed.categories[labels[i]];
                check('category '+bold+' '+sections.indexOf(section)+' '+labels[i], item?.score===scores[i], item?.score);
                check('native notices '+bold+' '+sections.indexOf(section)+' '+labels[i], item?.noticeRows?.[0]?.area==='Area '+i && item.growthTip==='Revise category '+i+'.' && !item.rawBody.includes('Category '+(i+1)), item);
            }
            if (section.includes('Candidate JSON')) check('native guide '+bold, parsed.notebookGuideCandidates.length===1 && parsed.notebookGuideCandidates[0].originalQuote===candidate.originalQuote, parsed.notebookGuideCandidates);
            if (section.includes('Grow Goal')) check('independent goal '+bold, parsed.strength==='Clear events.' && parsed.growGoal==='Choose words.' && parsed.nextTime.includes('precise words'), parsed);
        }
    }
    checkCompleteCategories();

    function checkPartialCategories() {
        for (const suffix of sections) for (const [name,a,b,expectedA,expectedB] of [
            ['absent-present','','7/10',undefined,7], ['present-absent','8/10','',8,undefined],
            ['both absent','','',undefined,undefined], ['explicit missing','Missing','7/10',null,7],
            ['malformed','18/10','7/10',undefined,7], ['decimal','7.5/10','7/10',undefined,7],
            ['bad denominator','8/100','7/10',undefined,7], ['unavailable','N/A','7/10',undefined,7]
        ]) {
            const parsed = parseDetailedAssessment('**1. Clear Ideas & Details:** '+a+'\n**2. Grammar:** '+b+'\n'+suffix, original);
            check(name+' '+sections.indexOf(suffix), parsed.categories['Ideas & Details']?.score===expectedA && parsed.categories.Grammar?.score===expectedB, parsed.categories);
        }
    }
    checkPartialCategories();

    function checkScoreLookup() {
        for (const [name,text,expected] of [
            ['plain','Ideas & Details: 8/10',8], ['dash','Ideas & Details - 8',8],
            ['bold','**Ideas & Details:** 8 / 10',8], ['score text','Ideas & Details: Score: 8/10',8],
            ['next score line','Ideas & Details:\nScore: 8/10',8], ['plain Missing','Ideas & Details: Missing',null],
            ['score full stop','Ideas & Details: 8.',8], ['ratio full stop','Ideas & Details: 8/10.',8],
            ['decimal denominator','Ideas & Details: 8/10.5',null],
            ['next category','Ideas & Details:\nGrammar: 7/10',null],
            ['inline next category','Ideas & Details: Grammar: 7/10',null],
            ['body number','Ideas & Details:\n- Evidence: 8 details.',null],
            ['body score text','Ideas & Details:\n- Evidence: score 8/10',null],
            ['section number','Ideas & Details:\n## Grow Goal Selection\n8 details.',null],
            ['inline section','Ideas & Details: ## Grow Goal Selection 8',null],
            ['malformed followed by score','Ideas & Details: N/A; score 8/10',null],
            ['embedded prose','My Ideas & Details: 8/10',null],
            ['duplicate first missing','Ideas & Details: Missing\nIdeas & Details: 8/10',null],
            ['duplicate first valid','Ideas & Details: 8/10\nIdeas & Details: 7/10',8]
        ]) check('score lookup '+name, extractScoreNearLabel(text,['Ideas & Details'])===expected, extractScoreNearLabel(text,['Ideas & Details']));
    }
    checkScoreLookup();

    function checkCategoryAliases() {
        for (const alias of ['Clear Ideas & Details','Ideas & Details','Clear Ideas and Details']) check('ideas alias '+alias, parseDetailedAssessment(alias+': 8/10',original).categories['Ideas & Details']?.score===8);
        for (const alias of ['5. Spelling & Punctuation','Spelling & Punctuation','Spelling and Punctuation']) check('convention alias '+alias, parseDetailedAssessment(alias+': 9/10',original).categories['Spelling & Punctuation']?.score===9);
    }
    checkCategoryAliases();

    function checkScoreRanges() {
        for (let i=0;i<labels.length;i++) for (const value of ['4','5/10','6 / 10','7','8/10','9','10/10','Missing','8.','8/10.']) {
            const p=parseDetailedAssessment('**'+headings[i]+':** '+value+'\r\n'+notice(i).replaceAll('\n','\r\n'),original);
            check('score range CRLF '+labels[i]+' '+value,p.categories[labels[i]]?.score===(value==='Missing'?null:parseInt(value,10)) && p.categories[labels[i]]?.noticeRows?.length===1,p.categories[labels[i]]);
        }
    }
    checkScoreRanges();

    function checkAdjacentCategories() {
        for (let i=0;i<labels.length-1;i++) for (const bold of [false,true]) {
            const header = j => bold ? '**'+headings[j]+':** ' : labels[j]+': ';
            const p=parseDetailedAssessment(header(i)+'\n'+header(i+1)+'7/10\n## Grow Goal Selection',original);
            check('each adjacent missing '+bold+' '+labels[i],p.categories[labels[i]]===undefined && p.categories[labels[i+1]]?.score===7,p.categories);
        }
    }
    checkAdjacentCategories();

    function checkCategoryBounds() {
        for (const format of [h=>'**'+h+'**: ',h=>'- '+h+': ',h=>'### '+h+': ',h=>h+': Score: ',h=>h+':\nScore: ']) {
            const p=parseDetailedAssessment(format('1. Clear Ideas & Details')+'8/10'+notice(0)+'\n'+format('3. Word Choice')+'9/10'+notice(2),original);
            check('header formats and reordered bounds '+format('Grammar'),p.categories['Ideas & Details']?.score===8 && p.categories['Ideas & Details']?.noticeRows?.[0]?.area==='Area 0' && !p.categories['Ideas & Details'].rawBody.includes('Category 2') && p.categories['Word Choice']?.score===9,p.categories);
        }
        const reordered = parseDetailedAssessment('**1. Clear Ideas & Details:** 8/10'+notice(0)+'\n**3. Word Choice:** 9/10'+notice(2)+'\n**2. Grammar:** 7/10'+notice(1), original);
        check('reordered category bodies', reordered.categories['Ideas & Details']?.growthTip==='Revise category 0.' && !reordered.categories['Ideas & Details'].rawBody.includes('Category 2') && reordered.categories.Grammar?.growthTip==='Revise category 1.', reordered.categories);
        const duplicate = parseDetailedAssessment('**2. Grammar:** 7/10'+notice(1)+'\n**2. Grammar:** 8/10'+notice(2),original);
        check('duplicate bounded first category', duplicate.categories.Grammar?.score===7 && !duplicate.categories.Grammar.rawBody.includes('Category 2'),duplicate.categories);
        const special=parseDetailedAssessment('**4. Organization:** 8/10\n- Content Organization: Events stay in order.\n**5. Flow:** 7/10\n- Flow Pattern: Short and long sentences.\n- Sentence Variety: Several lengths.\n**6. Spelling & Punctuation:** 9/10\n- Evidence: Correct stops.',original);
        check('organization and flow fields',special.categories.Organization?.contentOrganization==='Events stay in order.' && special.categories.Flow?.flowPattern==='Short and long sentences.' && special.categories.Flow?.sentenceVariety==='Several lengths.' && special.categories['Spelling & Punctuation']?.evidence==='Correct stops.',special.categories);
        for (const section of sections) check('no ghost categories '+sections.indexOf(section), Object.keys(parseDetailedAssessment(section,original).categories).length===0);
    }
    checkCategoryBounds();

    const evil = '<img src=x onerror="window.parserInjected=1">';
    function checkSafeRendering() {
        const malicious = parseDetailedAssessment('**3. Word Choice:** 8/10\n- Teacher Comment: '+evil+'\n- What I Noticed:\n  - Area: Words\n    Comment: '+evil+'\n- Growth Tip: '+evil+'\n## Grow Goal Selection', original);
        renderDetailedAssessment(malicious);
        check('safe native detailed rendering', !document.querySelector('#detailedAssessment img, #detailedAssessment script') && !window.parserInjected);
    }
    checkSafeRendering();

    function prepareAnalysis() {
        students=['Synthetic']; selectedStudent='Synthetic'; populateStudentDropdown(); document.getElementById('studentSelect').value='Synthetic';
        document.getElementById('studentWriting').value=original;
        document.getElementById('useWordCountTarget').checked=false; document.getElementById('assessScriptQuality').checked=false;
        selectedImages=[]; syncSelectedImageState();
    }

    async function checkAnalysisPipeline() {
        prepareAnalysis();
        const quick = '**Quick Rubric:**\n'+labels.map((k,i)=>'- '+k+': '+scores[i]+'/10 - Reread the writing.').join('\n');
        const calls = [];
        for (const [name,detailed,expectedIdeas,expectedWord,quickResponse=quick] of [
            ['plain with goal',labels.map((k,i)=>k+': '+scores[i]+'/10').join('\n')+'\n'+sections[1],8,9],
            ['missing category with sections',sections[1]+'\n'+sections[3],8,9],
            ['omitted current score next present','Ideas & Details:\nGrammar: 7/10\nWord Choice: 9/10\n'+sections[1],8,9],
            ['explicit missing','**1. Clear Ideas & Details:** Missing\n**3. Word Choice:** Missing\n'+sections[1],null,null],
            ['malformed allows quick fallback','**1. Clear Ideas & Details:** 18/10\n**3. Word Choice:** 7.5/10\n'+sections[1],8,9],
            ['plain missing','Ideas & Details: Missing\nWord Choice: Missing\n'+sections[1],null,null],
            ['score full stops','Ideas & Details: 8.\nWord Choice: 9.\n'+sections[1],8,9],
            ['ratio full stops','Ideas & Details: 8/10.\nWord Choice: 9/10.\n'+sections[1],8,9],
            ['untrusted model content','**3. Word Choice:** 9/10\n- Teacher Comment: '+evil+'\n- What I Noticed:\n  - Area: Words\n    Comment: '+evil+'\n- Growth Tip: '+evil+'\n'+sections[1],8,9],
            ['both responses missing',sections[1]+'\n'+sections[3],null,null,'No assessment available.'],
            ...sections.map((s,i)=>['absent categories following section '+i,s,8,9])
        ]) {
            let n=0;
            callOpenRouter=async (model,prompt) => {calls.push({name,step:++n}); return n===1 ? '# Corrected Story\n'+original : n===2 ? quickResponse : detailed;};
            await analyzeWriting();
            function checkAnalysisPersistence() {
                check('pipeline scores '+name,n===3 && latestAnalysisData?.categoryScores['Ideas & Details']===expectedIdeas && latestAnalysisData.categoryScores['Word Choice']===expectedWord,latestAnalysisData?.categoryScores);
                const pending=getPendingPortfolioSync()?.sessionData;
                check('pending scores '+name,pending?.categoryScores['Ideas & Details']===expectedIdeas && pending.categoryScores['Word Choice']===expectedWord,pending?.categoryScores);
                check('commit saved '+name,commitPendingPortfolioSync()===true);
                const saved=getPortfolioData().Synthetic.sessions.find(s=>s.id===pending.id);
                check('saved scores '+name,saved?.categoryScores['Ideas & Details']===expectedIdeas && saved.categoryScores['Word Choice']===expectedWord,saved?.categoryScores);
                check('saved snapshot '+name,!!saved?.notebookPrintHtml && !!saved.detailedFeedback && !/<img/i.test(saved.notebookPrintHtml));
                check('saved feedback score '+name,saved?.detailedFeedback.categories['Word Choice'].score===expectedWord,saved?.detailedFeedback.categories['Word Choice']);
                check('native saved export '+name,buildStudentSummaryHtml('Synthetic',{sessions:[saved]},'Synthetic').includes('Writing Portfolio'));
                if(name==='untrusted model content') check('actual publication and saved HTML safe',!document.querySelector('#detailedAssessment img, #detailedAssessment script') && !window.parserInjected && !/<img/i.test(buildNotebookPrintHtmlFromPortfolioSession('Synthetic',saved)));
                if(name==='missing category with sections') check('all allowed inheritance',latestAnalysisData.categoryScores.Organization===8 && latestAnalysisData.categoryScores['Spelling & Punctuation']===9 && latestAnalysisData.categoryScores.Flow===Math.min(7,flowScoreCap(latestAnalysisData.flowData)),latestAnalysisData.categoryScores);
            }
            checkAnalysisPersistence();
        }
        let step=0;
        callOpenRouter=async()=>++step===1?'# Corrected Story\n'+original:step===2?quick:headings.map(h=>'**'+h+':** Missing').join('\n')+'\n'+sections[1];
        await analyzeWriting();
        check('explicit missing category policy',labels.filter(k=>k!=='Grammar').every(k=>latestAnalysisData.categoryScores[k]===null) && latestAnalysisData.categoryScores.Grammar===10,latestAnalysisData.categoryScores);
        document.getElementById('useWordCountTarget').checked=true; document.getElementById('targetWordCount').value='200';
        step=0;
        callOpenRouter=async()=>++step===1?'# Corrected Story\n'+original:step===2?quick:sections[1];
        await analyzeWriting();
        const expectedAdjustment=calculateWordCountAdjustment(8,countWords(original),200,getGradeProfile()).adjustedScore;
        check('actual word count adjustment with inheritance',latestAnalysisData.categoryScores['Ideas & Details']===expectedAdjustment && latestAnalysisData.quickRubric['Ideas & Details'].score===expectedAdjustment && getPendingPortfolioSync().sessionData.categoryScores['Ideas & Details']===expectedAdjustment,latestAnalysisData.categoryScores);
        document.getElementById('useWordCountTarget').checked=false;
        const gated={categories:{}};
        applyEligibilityToDetailed(gated,{Organization:false,Flow:false});
        check('eligibility still unscored',gated.categories.Organization.score===null && gated.categories.Flow.score===null);
        return {cases, calls, scope:'Full shipped native Edge scripts and actual parse/adjust/publication/pending/save/render paths; only synthetic model responses and external requests intercepted.'};
    }
    return checkAnalysisPipeline();
}

(async () => {
    const browser = await chromium.launch({channel:'msedge', headless:true});
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const u = new URL(route.request().url());
            if (u.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
            return route.fulfill(fs.existsSync(file) ? {contentType:file.endsWith('.js') ? 'application/javascript' : 'text/html', body:fs.readFileSync(file)} : {status:404, body:''});
        });
        await page.goto('http://127.0.0.1:8765', {waitUntil:'domcontentloaded'});
        const result = await page.evaluate(runDetailedParserCases);
        const failed=result.cases.filter(c=>!c.passed);
        const report={root,...result,errors,total:result.cases.length,passed:result.cases.length-failed.length};
        if(process.env.WFT_PARSER_REPORT) fs.writeFileSync(process.env.WFT_PARSER_REPORT,JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({total:report.total,passed:report.passed,failed,errors},null,2));
        assert.deepEqual(errors,[]);
        if(!process.env.WFT_EXPECT_BASELINE) assert.deepEqual(failed,[]);
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
