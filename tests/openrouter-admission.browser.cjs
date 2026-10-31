const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const localAppRoute = require('./support/local-app-route');
const scenarios = [
    ...['text','image'].flatMap(kind => ['missing','whitespace','read-fault','key-recovery','settings-recovery','reader-throw','success','fallback','timeout','cancel-before','cancel-body','cancel-delay','edit-delay','remove-delay','recovery-delay','policy-delay'].map(mode => ({kind,mode}))),
    ...['session','remembered','legacy'].map(mode => ({kind:'text',mode})),
    ...['missing','whitespace','read-fault','remove-delay','cancel-delay','policy-delay'].map(mode => ({kind:'analysis',mode})),
    ...['missing','read-fault','success'].map(mode => ({kind:'ocr',mode})),
    ...['missing','success'].map(mode => ({kind:'neatness',mode})),
    {kind:'reassessment',mode:'missing'}
];

async function runAdmissionScenario({kind,mode}) {
    stopWftSyncPolling(); scheduleWftCloudSync=()=>{};
    const el=id=>document.getElementById(id), checks=[], check=(name,value)=>checks.push({name,passed:!!value});
    const alerts=[], waits=[], models=[], authorizationMatches=[]; window.alert=message=>alerts.push(String(message));
    const extractionChoices=[];
    if(kind==='ocr'&&mode==='success')wftConfirm=async(message,options)=>{extractionChoices.push({message,options});return true;};
    sessionStorage.clear(); localStorage.clear(); wftApiKeyStorageRecovery=null; wftStudentChangeRecovery=null;
    cancelAnalysis=false; analysisAbortController=null; activeAnalysisContext=null;
    const fake='synthetic-admission-key', edited='synthetic-edited-key';
    el('apiKeyInput').value=fake; API_KEY='synthetic-stale-runtime';
    const text=Array(12).fill('Yesterday we walked to the park and enjoyed the sunshine.').join(' ');
    students=['Synthetic']; selectedStudent='Synthetic'; populateStudentDropdown(); el('studentSelect').value='Synthetic'; el('studentWriting').value=text;
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    selectedImages=['ocr','neatness'].includes(kind)?[{name:'synthetic.png',dataUrl:image}]:[]; syncSelectedImageState();
    localStorage.setItem('wft_portfolio',JSON.stringify({Synthetic:{sessions:[{id:'saved',originalText:text,createdAt:'2026-01-01'}]}}));
    localStorage.setItem('wft_settings','{}');
    pendingPortfolioSync={studentName:'Synthetic',signature:'keep',sessionData:{id:'keep',originalText:'Earlier synthetic writing.',images:[]}}; persistPendingPortfolioSync();
    const previous={inputContext:captureCurrentWritingContext(),synthetic:'previous-result'}; latestAnalysisData=previous;
    el('detailedAssessment').innerHTML='<p>Previous synthetic report</p>';
    // Reassessment intentionally clears pending work when loading; test request retention after its real loading step.
    if(kind==='reassessment') { wftConfirm=async()=>true; await reassessPortfolioSession('Synthetic','saved'); await Promise.resolve(); check('actual reassessment loaded',activePortfolioReassessmentSource?.sourceSessionId==='saved'); previous.inputContext=captureCurrentWritingContext(); pendingPortfolioSync={studentName:'Synthetic',signature:'keep',sessionData:{id:'keep',originalText:'Earlier synthetic writing.',images:[]}}; persistPendingPortfolioSync(); latestAnalysisData=previous; el('detailedAssessment').innerHTML='<p>Previous synthetic report</p>'; }
    const primary=localStorage.getItem('wft_portfolio'), pending=localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), report=el('detailedAssessment').innerHTML;
    const actualReader=refreshApiKeyRuntimeValue, nativeGet=Storage.prototype.getItem;
    let reads=0, fetches=0, timerStarts=0, rawAbort=false;
    refreshApiKeyRuntimeValue=()=>{ reads++; if(mode==='reader-throw') throw new Error('Synthetic required reader failure'); return actualReader(); };
    function fault(){ Storage.prototype.getItem=function(key){if(this===sessionStorage&&key===WFT_API_KEY_SESSION_STORAGE_KEY)throw new Error('Synthetic read fault');return nativeGet.call(this,key);}; }
    configureAdmissionKey();
    const nativeTimeout=window.setTimeout, nativeClear=window.clearTimeout, timers=new Map();let timerId=1000000;
    window.setTimeout=(fn,ms,...args)=>{if(ms!==90000)return nativeTimeout(fn,ms,...args); timerStarts++; timers.set(++timerId,fn); return timerId;};
    window.clearTimeout=id=>timers.delete(id)||nativeClear(id);
    const body=(content,status=200)=>new Response(JSON.stringify({choices:[{message:{content}}]}),{status});
    const transient=()=>body('Synthetic provider busy',503);
    let enter, release; const started=new Promise(resolve=>enter=resolve), hold=new Promise(resolve=>release=resolve);
    sleepMs=async ms=>{waits.push(ms);if(mode.endsWith('-delay')&&waits.length===1){enter();await hold;}};
    window.fetch=fetchSyntheticProvider;
    if(mode==='cancel-before')cancelAnalysis=true;
    if(['text','image'].includes(kind)&&mode==='policy-delay')activeAnalysisContext={input:captureCurrentWritingContext(),policy:captureAssessmentPolicy(),cancelled:false};
    let value, error='';
    const call=()=>kind==='analysis'||kind==='reassessment'?analyzeWriting():kind==='ocr'?extractTextFromSelectedImage(false):kind==='neatness'?assessNeatnessFromImage(image,'synthetic-primary'):kind==='image'?callOpenRouterImage('synthetic-primary','Synthetic image prompt',image):callOpenRouter('synthetic-primary','Synthetic text prompt');
    const running=call().then(result=>value=result).catch(e=>error=e.message);
    if(mode.endsWith('-delay')||mode==='cancel-body'){
        await started;
        applyDelayedChange();
        release();
    }
    await running;
    checkRetainedState();
    checkAdmissionOutcome();
    checkTransportOutcome();
    checkDelayedOutcome();
    if(kind==='ocr'&&mode==='success')check('explicit extraction replacement choice',extractionChoices.length===1&&extractionChoices[0].options.confirmText==='Replace Writing'&&extractionChoices[0].options.alternativeText==='Append Text');
    check('all synthetic authorization checks',authorizationMatches.every(Boolean));check('no leaked synthetic credentials',![error,...alerts,el('debugRaw').textContent,el('ocrStatus').textContent].some(v=>v.includes(fake)||v.includes(edited)));
    check('no timeout remains',timers.size===0);
    return {checks,reads,fetches,models,waits,configuredBackoffMs:waits.reduce((a,b)=>a+b,0),timerStarts,error,alerts};

    function configureAdmissionKey() {
        if(['missing','whitespace','read-fault','settings-recovery'].includes(mode)){el('apiKeyInput').value=mode==='whitespace'?' \t ':'';}
        if(mode==='read-fault')fault();
        if(mode==='key-recovery')wftApiKeyStorageRecovery=[];
        if(mode==='settings-recovery')wftStudentChangeRecovery={wft_settings:'{}'};
        if(['session','remembered','legacy'].includes(mode)){el('apiKeyInput').value='';if(mode==='session')sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY,' '+fake+' ');if(mode==='remembered'){localStorage.setItem(WFT_API_KEY_LOCAL_STORAGE_KEY,' '+fake+' ');localStorage.setItem(WFT_API_KEY_REMEMBER_PREF_KEY,'true');}if(mode==='legacy')localStorage.setItem('wft_settings',JSON.stringify({apiKey:' '+fake+' '}));}
    }

    async function fetchSyntheticProvider(url,options) {
        check('provider URL',url==='https://openrouter.ai/api/v1/chat/completions');
        const payload=JSON.parse(options.body);fetches++;models.push(payload.model);authorizationMatches.push(options.headers.Authorization==='Bearer '+(mode==='edit-delay'&&fetches>1?edited:fake));
        if(mode==='fallback'&&fetches<=2)return transient();
        if(mode.endsWith('-delay')&&fetches===1)return transient();
        if((mode==='timeout'||mode==='cancel-body')&&fetches===1){
            return {ok:true,status:200,text:()=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{rawAbort=true;reject(new DOMException('Synthetic abort','AbortError'));},{once:true}); if(mode==='timeout')timers.values().next().value();else enter();})};
        }
        if(kind==='ocr')return body('Synthetic photo transcription.');
        if(kind==='neatness')return body('**Source Type:** HANDWRITTEN\n**Quick Rubric:**\n- Neatness: 8/10 - Clear letters.\n**Neatness Growth Tip:** Leave spaces.');
        return body('Synthetic request success');
    }

    function applyDelayedChange() {
        if(mode==='edit-delay')el('apiKeyInput').value=edited;
        if(mode==='remove-delay')el('apiKeyInput').value='';
        if(mode==='recovery-delay')wftApiKeyStorageRecovery=[];
        if(mode==='policy-delay')el('grammarStrictness').value=el('grammarStrictness').value==='5'?'3':'5';
        if(mode==='cancel-delay'||mode==='cancel-body'){if(isAnalyzing)requestStopAnalysis();else {cancelAnalysis=true;analysisAbortController.abort();}}
    }

    function checkRetainedState() {
        check('primary writing bytes retained',nativeGet.call(localStorage,'wft_portfolio')===primary);
        check('pending bytes retained',nativeGet.call(localStorage,PENDING_PORTFOLIO_SYNC_KEY)===pending);
        if(!['success','fallback','timeout','edit-delay','session','remembered','legacy'].includes(mode)){
            check('previous data retained',latestAnalysisData===previous);check('previous report retained',el('detailedAssessment').innerHTML===report);
            check('writing retained',el('studentWriting').value===text);
        }
    }

    function checkAdmissionOutcome() {
        const admission=['missing','whitespace','read-fault','key-recovery','settings-recovery','reader-throw'].includes(mode);
        if(admission){check('zero transport',fetches===0);check('zero backoff',waits.length===0);check('one actual reader admission',reads===1);check('no provider timeout',timerStarts===0);}
        if(admission&&['text','image'].includes(kind))check('useful thrown admission error',/No API key|could not be saved|Synthetic required reader failure/.test(error));
        if(admission&&['analysis','reassessment'].includes(kind))check('visible analysis error',/No API key|could not be saved/.test(el('debugRaw').textContent)&&alerts.length>0);
        if(admission&&kind==='ocr')check('visible OCR admission error',el('ocrStatus').classList.contains('error')&&/API key/.test(el('ocrStatus').textContent));
        if(admission&&kind==='neatness')check('unscored neatness failure',value===null);
        if(['read-fault','key-recovery','settings-recovery','recovery-delay'].includes(mode))check('original required storage alert',alerts.some(v=>/could not be saved/.test(v)));
    }

    function checkTransportOutcome() {
        if(['success','session','remembered','legacy'].includes(mode)){check('successful single transport',fetches===1&&waits.length===0);check('successful result',kind==='ocr'?value==='Synthetic photo transcription.':kind==='neatness'?value?.quickRubric.score===8:value==='Synthetic request success');}
        if(mode==='fallback'){check('exhausted retries never switch models',fetches===2&&models.every(model=>model==='~google/gemini-flash-latest'));check('one meaningful retry wait',JSON.stringify(waits)==='[1200]');check('terminal failure is reported',/OpenRouter request failed after retries/.test(error));}
        if(mode==='timeout'){check('body timeout abort propagated into retry',rawAbort&&fetches===2&&waits.length===1&&timerStarts===2);check('timeout recovered',value==='Synthetic request success');}
        if(mode==='cancel-before')check('cancel before admission',reads===0&&fetches===0&&waits.length===0&&/cancelled/.test(error));
        if(mode==='cancel-body')check('body cancellation no retry',rawAbort&&fetches===1&&waits.length===0&&/cancelled/.test(error));
    }

    function checkDelayedOutcome() {
        if(mode.endsWith('-delay')){
            check('one configured held backoff',waits.length===1&&waits[0]===1200);
            check('second transport only for admitted key edit',fetches===(mode==='edit-delay'?2:1));
            if(['remove-delay','recovery-delay'].includes(mode))check('credential reread after delay',reads===2);
            if(mode==='edit-delay')check('edited key accepted by current policy',value==='Synthetic request success'&&reads===2);
            if(['text','image'].includes(kind)&&mode!=='edit-delay')check('delay terminal error',new RegExp(mode==='policy-delay'?'Assessment settings changed':mode==='cancel-delay'?'cancelled':mode==='recovery-delay'?'could not be saved':'No API key').test(error));
            if(kind==='analysis')check('visible analysis terminal state',new RegExp(mode==='policy-delay'?'Assessment settings changed':mode==='cancel-delay'?'stopped by user':'No API key').test(el('debugRaw').textContent)&&!isAnalyzing);
        }
    }
}

async function runScenario(browser,scenario,rows) {
    const page = await browser.newPage(), errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => localAppRoute(route, root));
    try {
        await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
        const result=await page.evaluate(runAdmissionScenario,scenario);
        assert.deepEqual(errors,[]);
        rows.push({...scenario,...result,passed:result.checks.every(check=>check.passed)});
        console.log((rows.at(-1).passed?'PASS ':'FAIL ')+scenario.kind+'/'+scenario.mode);
    } catch(error){rows.push({...scenario,passed:false,error:error.message});console.error('FAIL '+scenario.kind+'/'+scenario.mode+': '+error.message);}
    finally{await page.close();}
}

(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true}), rows=[];
    try {
        for (const scenario of scenarios) await runScenario(browser,scenario,rows);
    } finally{await browser.close();}
    const report={root,scope:'Full shipped native Edge callers and real key readers; synthetic intercepted fetch/body aborts and controlled backoff/90-second timers. Configured waits are not measured latency. Reassessment preservation is checked after its intentional load reset.',cases:rows.length,checks:rows.reduce((n,r)=>n+(r.checks?.length||0),0),passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,results:rows};
    if(process.env.WFT_TEST_REPORT)fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({cases:report.cases,checks:report.checks,passed:report.passed,failed:report.failed}));
    assert.equal(report.failed,0,'Native OpenRouter admission cases failed');
})().catch(error=>{console.error(error);process.exitCode=1;});
