const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),JSZip=require('jszip');
const root=path.resolve(process.env.WFT_TEST_ROOT||path.join(__dirname,'..'));
const scenarios=['views-export-print','read-success','read-missing','read-malformed','duplicate-cancel','duplicate-existing','duplicate-create','duplicate-move-error','duplicate-folder-error','media-discover','media-create','media-cache','drop-image','drop-invalid'];
async function runStorageScenario(browser,scenario,cases){
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),requests=[],blockedExternalRequests=[],errors=[],alerts=[],checks=[];
 let observed,folderCreated=false;
 const copies=[{id:'newest',name:'wft-portfolio.json',modifiedTime:'2026-10-12T00:00:00Z',parents:['root-folder']},{id:'older',name:'wft-portfolio.json',modifiedTime:'2026-10-01T00:00:00Z',parents:['root-folder']}];
 // The OS print dialog is the only substituted boundary; the real popup/render/scheduling stays intact.
 await context.addInitScript(()=>{window.nativePrintCalls=0;window.print=()=>{window.nativePrintCalls++;};});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 await context.route('**/*',routeStorageRequest);
 async function routeStorageRequest(route){
  const req=route.request(),u=new URL(req.url()),q=u.searchParams.get('q')||'',reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:typeof data==='string'?data:JSON.stringify(data)});
  if(u.href==='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')return route.fulfill({body:fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')),contentType:'application/javascript'});
  if(u.origin==='http://127.0.0.1:8765'){const file=path.join(root,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'text/html'}):reply('',404);}
  if(u.origin!=='https://www.googleapis.com'){blockedExternalRequests.push(u.origin+u.pathname);return route.abort();}
  if(req.method()==='OPTIONS')return reply('',204);
  requests.push({url:u.href,method:req.method(),body:req.postData(),token:req.headers().authorization});
  return replyDriveRequest(req,u,q,reply);
 }
 function replyDriveRequest(req,u,q,reply){
  if(req.method()==='PATCH'&&u.pathname.endsWith('/older')){if(scenario==='duplicate-move-error')return reply({error:{message:'Synthetic move refused'}},403);copies[1].parents=['backup-folder'];return reply({id:'older',parents:['backup-folder']});}
  if(req.method()==='POST'){if(scenario==='duplicate-folder-error')return reply({error:{message:'Synthetic folder refused'}},403);folderCreated=true;const name=JSON.parse(req.postData()).name;return reply({id:name==='Duplicate Backups'?'backup-folder':name==='media'?'media-folder':'student-media-folder'});}
  if(u.searchParams.get('alt')==='media')return reply(scenario==='read-malformed'?'{broken':{Alice:{sessions:[{id:'remote',originalText:'Read callback synthetic exact writing'}]}});
  return replyDriveQuery(u,q,reply);
 }
 function replyDriveQuery(u,q,reply){
  if(q.includes("name='Duplicate Backups'"))return reply({files:scenario==='duplicate-existing'||folderCreated?[{id:'backup-folder'}]:[]});
  if(q.includes("name='media'"))return reply({files:scenario==='media-discover'?[{id:'media-folder',mimeType:'application/vnd.google-apps.folder'}]:[]});
  if(q.includes("name='student-"))return reply({files:scenario==='media-discover'?[{id:'student-media-folder',mimeType:'application/vnd.google-apps.folder'}]:[]});
  if(q.includes("name='wft-portfolio.json'"))return reply({files:scenario.startsWith('duplicate-')?copies.filter(f=>f.parents.includes('root-folder')):scenario==='read-missing'?[]:[{id:'read-file'}]});
  if(q)return reply({files:[]});
  if(u.pathname.endsWith('/root-folder'))return reply({id:'root-folder',name:'WritingFeedbackTool',mimeType:'application/vnd.google-apps.folder',trashed:false});
  return reply({});
 }
 try{
  await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
  await page.evaluate(initializeStorageScenario,scenario);
  const check=(name,condition)=>checks.push({name,passed:!!condition});
  async function checkPortfolioViews(){
   await page.locator('#adminTabBtn').click();
   if(await page.locator('#rosterSection').isVisible())await page.locator('#toggleRosterBtn').click();
   await page.locator('#toggleRosterBtn').click();check('Roster show button displays current students',await page.locator('#rosterSection').isVisible()&&(await page.locator('#studentList').textContent()).includes('Alice'));
   await page.locator('#toggleRosterBtn').click();check('Roster hide button hides section',!await page.locator('#rosterSection').isVisible());
   await page.locator('#portfolioTabBtn').click();
   await page.locator('#portfolioStudentSelect').selectOption('Alice');await page.waitForFunction(()=>document.getElementById('portfolioContent').textContent.includes('Original synthetic'));
   check('Public portfolio selection renders exact saved writing',await page.locator('#portfolioContent').textContent().then(t=>t.includes('Original synthetic exact writing.')));
   const downloadEvent=page.waitForEvent('download');await page.locator('#exportSelectedStudentBtn').click();const download=await downloadEvent;
   const zip=await JSZip.loadAsync(fs.readFileSync(await download.path())),names=Object.keys(zip.files),html=await zip.file('Alice - Portfolio.html').async('string');
   check('Actual student download contains only selected portfolio',download.suggestedFilename()==='Alice - Writing Portfolio.zip'&&names.length===1&&html.includes('Original synthetic exact writing.')&&!html.includes('Bob writing must not export'));
   const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'Re-print Notebook Summary',exact:true}).click();const popup=await popupEvent;
   await popup.getByRole('button',{name:'Print / Save as PDF',exact:true}).waitFor();
   check('Saved notebook opens for review before explicit printing',await popup.evaluate(()=>window.nativePrintCalls===0));
   await popup.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();
   await popup.waitForFunction(()=>window.nativePrintCalls===1);
   const printed=await popup.evaluate(()=>({openerDetached:window.opener===null,text:document.body.textContent,title:document.title,printCalls:window.nativePrintCalls}));
   check('Explicit printing uses saved notebook summary with detached opener',printed.openerDetached&&printed.text.includes('Alice')&&printed.text.includes('Synthetic story')&&printed.text.includes('4 words')&&printed.printCalls===1);await popup.close();
   observed={downloadNames:names,printed};
   return{names,printed};
  }
  async function checkWritingViews(names,printed){
   await page.locator('#toolTabBtn').click();await page.locator('#studentWriting').fill('Synthetic writing\n'.repeat(60));
   check('Current public writing flow keeps retained Expand button hidden',!await page.locator('#expandTextBtn').isVisible());
   const zen=await page.evaluate(()=>{
    const writing=document.getElementById('studentWriting').value;
    toggleZenMode();const entered=zenModeActive&&document.getElementById('studentWriting').classList.contains('zen-mode')&&document.getElementById('expandTextBtn').textContent==='Collapse';
    toggleZenMode();return{entered,exited:!zenModeActive&&!document.getElementById('studentWriting').classList.contains('zen-mode'),writingKept:document.getElementById('studentWriting').value===writing};
   });
   check('Retained Zen API enters and exits with writing unchanged',zen.entered&&zen.exited&&zen.writingKept);
   const diagnostics=await page.evaluate(()=>{markWftPortfolioDirty('native-diagnostics-check');return window.WFT_SYNC_DIAGNOSTICS();});
   check('Public diagnostics truthfully expose dirty state without token bytes',diagnostics.pendingPortfolioPush===true&&!JSON.stringify(diagnostics).includes('synthetic-token'));
   await page.locator('#studentWriting').fill('Original <writing> & exact\nSecond line.');
   await page.locator('#analyzeBtn').click();
   await page.evaluate(()=>{document.getElementById('correctedStory').innerHTML='<p>Corrected exact writing.</p>';});
   await page.locator('#diffControls').waitFor({state:'visible'});
   await page.locator('#diffBtnOriginal').click();check('Original diff uses escaped exact text and active button',await page.locator('#correctedStory').textContent().then(t=>t.includes('Original <writing> & exact'))&&await page.locator('#diffBtnOriginal').evaluate(el=>el.classList.contains('active')));
   await page.locator('#diffBtnCorrected').click();check('Corrected diff restores supplied corrected snapshot',await page.locator('#correctedStory').textContent()==='Corrected exact writing.');
   observed={downloadNames:names,printed,zen,diagnostics,zenDisposition:'CSS hides initial Expand button; main-app initialization/input callbacks check overflow. The tested typed flow stays hidden; retained API state/byte contract is tested separately. No ordinary button-entry UI execution claimed.'};
  }
  async function checkReadCallback(){
   observed=await page.evaluate(()=>new Promise(resolve=>readJsonFileFromDrive(WFT_PORTFOLIO_FILENAME,data=>resolve(data))));
   check('Read callback returns truthful parsed success or null',scenario==='read-success'?observed?.Alice?.sessions[0]?.originalText==='Read callback synthetic exact writing':observed===null);
   check('Native folder search and download used',requests.some(r=>r.url.includes('q='))&&(scenario==='read-missing'||requests.some(r=>r.url.includes('alt=media'))));
  }
  async function checkDuplicateCleanup(){
   await page.locator('#adminTabBtn').click();await page.evaluate(()=>checkDuplicateSyncFilesStatus());
   await page.locator('#duplicateSyncCleanupBtn').click();await page.locator('#wftConfirmTitle').waitFor();
   if(scenario==='duplicate-cancel'){await page.keyboard.press('Escape');check('Escape cancels duplicate moves before mutation',!requests.some(r=>['POST','PATCH'].includes(r.method)));}
   else{await page.getByRole('button',{name:'Move Files',exact:true}).click();await page.waitForFunction(()=>/complete|failed/.test(document.getElementById('archiveStatus').textContent));
    const failure=scenario.endsWith('error'),status=await page.locator('#archiveStatus').textContent();check('Duplicate operation reports actual result',failure?status==='Duplicate cleanup failed.':status.includes('Moved 1 duplicate'));
    check('Only older copy moves with correct parent parameters',scenario==='duplicate-folder-error'?!requests.some(r=>r.method==='PATCH'):requests.filter(r=>r.method==='PATCH').every(r=>new URL(r.url).pathname.endsWith('/older')&&new URL(r.url).searchParams.get('addParents')==='backup-folder'&&new URL(r.url).searchParams.get('removeParents')==='root-folder'));
    check('Canonical cache keeps newest file',scenario==='duplicate-folder-error'||await page.evaluate(()=>getCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME)==='newest'));
   }
   observed={requests,copies,folderCreated,alerts,status:await page.locator('#archiveStatus').textContent()};
  }
  async function checkMediaFolders(){
   observed=await page.evaluate(async()=>({media:await ensureWftMediaFolderPromise(),student:await ensureWftStudentMediaFolderPromise('synthetic-id'),again:await ensureWftStudentMediaFolderPromise('synthetic-id')}));
   check('Retained folder wrappers return and cache correct IDs',observed.media==='media-folder'&&observed.student==='student-media-folder'&&observed.again==='student-media-folder');
   check('Cache avoids requests; creation has exact parent metadata',scenario==='media-cache'?requests.length===0:scenario==='media-create'?requests.filter(r=>r.method==='POST').length===2&&requests.filter(r=>r.method==='POST').every(r=>JSON.parse(r.body).parents[0]===(JSON.parse(r.body).name==='media'?'root-folder':'media-folder')):!requests.some(r=>r.method==='POST'));
  }
  async function checkFileDrop(){
   await page.evaluate(scenario=>{
    const transfer=new DataTransfer();
    if(scenario==='drop-image'){const canvas=document.createElement('canvas');canvas.width=8;canvas.height=6;canvas.getContext('2d').fillRect(0,0,8,6);const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));transfer.items.add(new File([bytes],'synthetic.png',{type:'image/png'}));}
    else transfer.items.add(new File(['invalid'],'synthetic.txt',{type:'text/plain'}));
    document.querySelector('.app').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
   },scenario);
   if(scenario==='drop-image'){await page.waitForFunction(()=>selectedImages.length===1);check('Native file drop decodes image and opens OCR panel',await page.evaluate(()=>selectedImages[0].dataUrl.startsWith('data:image/')&&document.getElementById('ocrPanel').open));await page.locator('#extractTextBtn').click();check('OCR click without a key reports a truthful prerequisite',await page.locator('#ocrStatus').textContent().then(t=>t.includes('API key')));}
   else{await page.waitForFunction(()=>document.getElementById('ocrStatus').textContent.includes('Please drop'));check('Invalid file drop keeps images empty',await page.evaluate(()=>selectedImages.length===0));}
   check('Drop/OCR makes no paid AI request',!blockedExternalRequests.some(url=>url.includes('openrouter')));
  }
  if(scenario==='views-export-print'){
   const{names,printed}=await checkPortfolioViews();
   await checkWritingViews(names,printed);
  }else if(scenario.startsWith('read-')){
   await checkReadCallback();
  }else if(scenario.startsWith('duplicate-')){
   await checkDuplicateCleanup();
  }else if(scenario.startsWith('media-')){
   await checkMediaFolders();
  }else{
   await checkFileDrop();
  }
  check('Public readonly/control routes preserve primary portfolio and roster',await page.evaluate(()=>beforePrimary.portfolio===localStorage.getItem('wft_portfolio')&&beforePrimary.roster===localStorage.getItem('wft_students')));
  check('No browser script errors',errors.length===0);
  cases.push({name:scenario,passed:checks.every(c=>c.passed),checks,observed,errors,alerts,blockedExternalRequests,flags:await page.evaluate(()=>uiFlags)});
 }catch(e){cases.push({name:scenario,passed:false,error:e.message,checks,observed,errors,alerts,requests});}
 finally{await context.close();}
}
function initializeStorageScenario(scenario){
 stopWftSyncPolling();stopDriveAutoSync();localStorage.clear();sessionStorage.clear();
 const entry={id:'saved',createdAt:'2026-10-01T00:00:00Z',title:'Synthetic story',originalText:'Original synthetic exact writing.',correctedText:'Corrected synthetic exact writing.',images:[]};
 localStorage.setItem('wft_portfolio',JSON.stringify({Alice:{sessions:[entry]},Bob:{sessions:[{...entry,id:'bob',originalText:'Bob writing must not export'}]}}));
 localStorage.setItem('wft_students','["Alice","Bob"]');localStorage.setItem('wft_settings','{"students":["Alice","Bob"]}');localStorage.setItem(WFT_DELETIONS_STORAGE_KEY,'{"records":[]}');
 students=['Alice','Bob'];selectedStudent='Alice';pendingPortfolioSync=null;renderStudentList();populateStudentDropdown();refreshPortfolioDropdown();
 window.beforePrimary={portfolio:localStorage.getItem('wft_portfolio'),roster:localStorage.getItem('wft_students')};
 window.uiFlags={v2:WFT_SYNC_ENGINE_V2,split:WFT_SPLIT_STUDENT_FILES_V1,index:WFT_PORTFOLIO_INDEX_V1,lazy:WFT_LAZY_PORTFOLIO_LOAD_V1,idb:WFT_INDEXEDDB_CACHE_V1,debug:WFT_DEBUG,syncDebug:WFT_SYNC_DEBUG};
 if(scenario!=='views-export-print'&&!scenario.startsWith('drop-')){driveAccessToken=wftSyncState.accessToken='synthetic-token';wftSyncState.signedIn=true;wftSyncState.tokenExpiresAt=Date.now()+600000;driveFolderId=wftSyncState.folderId='root-folder';clearWftSyncBlockState();}
 if(scenario==='media-cache'){localStorage.setItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY,'media-folder');localStorage.setItem('wft_drive_media_folder_synthetic-id','student-media-folder');}
}

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),cases=[];
 try{
  for(const scenario of scenarios){
   await runStorageScenario(browser,scenario,cases);
  }
 }finally{await browser.close();}
 if(process.env.WFT_TEST_REPORT)fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify({root,cases,productionMethodsReplaced:[],nativeBoundarySubstitutions:['window.print records invocation; OS dialog suppressed'],passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length},null,2));
 const failed=cases.filter(c=>!c.passed);console.log(JSON.stringify({passed:cases.length-failed.length,total:cases.length,failures:failed.map(c=>({name:c.name,error:c.error,checks:c.checks}))}));assert.equal(failed.length,0,'Public storage route invariants');
})().catch(e=>{console.error(e);process.exitCode=1;});
