// Real app methods and request boundaries; Google identity and service replies are synthetic.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.WFT_TEST_ROOT||path.join(__dirname,'..'));
const scenarios=['current','legacy-current','retry-late-success','retry-late-error','newer-during-upload','signout-current','signout-timeout-reconnect','reconnect-during-upload'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),cases=[];
 try{for(const scenario of scenarios){
  const context=await browser.newContext(),page=await context.newPage(),held=[],requests=[],errors=[],checks=[],snapshots={},files=new Map(),uploads=new Map();
  let hold=true;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),query=url.searchParams.get('q')||'';
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.origin==='http://127.0.0.1:8765'){const file=path.join(root,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'text/html'}):reply({},404);}
   if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/revoke')return reply({});
   if(url.origin!=='https://www.googleapis.com')return route.abort();
   if(req.method()==='OPTIONS')return reply({},204);
   requests.push({url:url.href,method:req.method(),body:req.postData(),token:req.headers().authorization});
   if(url.pathname.startsWith('/upload/')){
    const parts=req.postData().split('\r\n\r\n'),meta=JSON.parse(parts[1].split('\r\n')[0]);
    const prior=files.get(url.pathname.split('/').pop()),name=meta.name||prior.name;
    uploads.set(route,{name,token:req.headers().authorization,data:JSON.parse(parts[2].slice(0,parts[2].lastIndexOf('\r\n--')))});
    if(hold&&(name==='wft-portfolio.json'||name==='wft-deletions.json')){held.push(route);return;}
    return accept(route);
   }
   async function replyToReadRequest(){
   if(url.pathname.includes('/userinfo'))return reply({id:'synthetic-account',email:'synthetic@example.invalid',name:'Synthetic'});
   if(query.includes('.google-migration-v1.json'))return reply({files:[{id:'migration-marker'}]});
   if(url.searchParams.get('alt')==='media'&&url.pathname.endsWith('/migration-marker'))return reply({userId:'synthetic-account',oldClient:'546695859117-18drps6vl0l8u6pcp9mgfhcc972rebl0.apps.googleusercontent.com',newClient:await page.evaluate(()=>GOOGLE_CLIENT_ID)});
   if(query.includes("name='WritingFeedbackTool'"))return reply({files:[{id:'root-folder'}]});
   if(query){const name=query.match(/name='([^']+)'/)?.[1];return reply({files:Array.from(files.values()).filter(f=>f.name===name&&f.token===req.headers().authorization).map(({id,name,modifiedTime})=>({id,name,modifiedTime}))});}
   if(url.pathname.endsWith('/root-folder'))return reply({id:'root-folder',name:'WritingFeedbackTool',mimeType:'application/vnd.google-apps.folder',trashed:false});
   const saved=files.get(url.pathname.split('/').pop());
   if(saved)return reply(url.searchParams.get('alt')==='media'?saved.data:{id:saved.id,name:saved.name,parents:['root-folder'],mimeType:'application/json',trashed:false,modifiedTime:saved.modifiedTime});
   return reply({});
   }
   return replyToReadRequest();
  });
  await page.clock.install();await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
  await page.evaluate(()=>{
   stopWftSyncPolling();stopDriveAutoSync();localStorage.clear();sessionStorage.clear();
   localStorage.setItem('wft_settings','{}');localStorage.setItem('wft_students','["Synthetic"]');localStorage.setItem('wft_deletions','{"records":[]}');
   localStorage.setItem('wft_portfolio',JSON.stringify({Synthetic:{sessions:[{id:'original',createdAt:'2026-10-12T00:00:00Z',originalText:'Original synthetic writing',images:[]}]}}));
   students=['Synthetic'];pendingPortfolioSync=null;
   driveAccessToken=wftSyncState.accessToken='synthetic-token-A';wftSyncState.signedIn=true;wftSyncState.tokenExpiresAt=Date.now()+600000;
   driveFolderId=wftSyncState.folderId='root-folder';clearWftSyncBlockState();
   wftSyncState.pendingSettingsPush=wftSyncState.pendingDeletionsPush=false;markWftPortfolioDirty('ownership-check');
   window.beforeBytes=localStorage.getItem('wft_portfolio');window.runResult=null;window.legacyResult=null;
  });
  const check=(name,passed)=>checks.push({name,passed:!!passed});
  const waitHeld=async count=>{for(let i=0;i<300&&held.length<count;i++)await page.waitForTimeout(10);assert.equal(held.length,count,'Actual upload reaches intercepted service');};
  const capture=()=>page.evaluate(()=>({token:driveAccessToken,result:window.runResult,legacy:window.legacyResult,active:wftSyncState.isSyncing,hasPromise:!!wftSyncState.currentSyncPromise,dirty:wftSyncState.pendingPortfolioPush,status:document.getElementById('driveSyncTextHeader').textContent,dot:document.getElementById('driveSyncDotHeader').className,bytes:localStorage.getItem('wft_portfolio'),pending:getPendingPortfolioSync(),error:String(wftSyncState.lastError&&wftSyncState.lastError.message),counter:wftSyncState.localPortfolioCounter,syncedCounter:wftSyncState.lastSyncedPortfolioCounter,blocked:wftSyncState.authBlocked||wftSyncState.quotaBlocked||wftSyncState.permissionBlocked}));
  const accept=route=>{const file={...uploads.get(route),id:'accepted-'+(files.size+1),modifiedTime:new Date().toISOString()};files.set(file.id,file);return route.fulfill({contentType:'application/json',body:JSON.stringify({id:file.id})});};
  const reconnect=async()=>{
   await page.evaluate(()=>finishWftGoogleSignInWithAccessToken('synthetic-token-B',3600,'synthetic-scope','gis-popup'));
   await page.waitForFunction(()=>driveAccessToken==='synthetic-token-B');
  };
  async function startScenario(){
  if(scenario==='legacy-current'){
   await page.evaluate(()=>saveFileToDrive(WFT_PORTFOLIO_FILENAME,localStorage.getItem('wft_portfolio'),'application/json',(err,id)=>{window.legacyResult={error:err&&err.message,id};}));
  }else if(scenario==='signout-current'||scenario==='signout-timeout-reconnect'){
   // The actual sign-out handler waits for syncAllToDrive; no lock/reset methods are replaced.
   await page.evaluate(()=>handleGoogleSignOut());
  }else await page.evaluate(()=>{window.run=syncWftNow('manual',{immediate:true}).then(r=>{window.runResult=r;return r;});});
  }
  await startScenario();
  await waitHeld(1);
  async function finishScenario(){
  if(scenario==='retry-late-success'||scenario==='retry-late-error'){
   await page.clock.runFor(30001);await page.clock.runFor(500);await waitHeld(2);
   snapshots.retry=await capture();
   if(scenario==='retry-late-success')await accept(held[0]);else await held[0].fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic old permission error'}})});
   await page.waitForTimeout(100);snapshots.late=await capture();
   check('Late first attempt cannot replace the active retry status or block it',snapshots.late.active&&snapshots.late.hasPromise&&snapshots.late.result===null&&snapshots.late.status===snapshots.retry.status&&snapshots.late.dot===snapshots.retry.dot&&!snapshots.late.blocked);
   hold=false;await accept(held[1]);await page.waitForFunction(()=>window.runResult!==null);
  }else if(scenario==='signout-timeout-reconnect'){
   async function finishSignoutReconnect(){
   for(let attempt=1;attempt<=3;attempt++){await page.clock.runFor(30001);if(attempt<3){await page.clock.runFor(attempt===1?500:1000);await waitHeld(attempt+1);}}
   await page.waitForFunction(()=>!driveAccessToken);snapshots.signedOut=await capture();
   check('Real sign-out disconnects after bounded V2 failure and retains writing',!snapshots.signedOut.token&&/Signed out/.test(snapshots.signedOut.status)&&JSON.parse(snapshots.signedOut.bytes).Synthetic.sessions[0].originalText==='Original synthetic writing');
   await page.evaluate(()=>saveStudentSession('Synthetic',{id:'reconnected-writing',createdAt:'2026-10-12T00:02:00Z',originalText:'Writing saved while signed out',images:[]}));
   await reconnect();await waitHeld(4);snapshots.reconnected=await capture();
   await accept(held[0]);await page.waitForTimeout(100);snapshots.late=await capture();
   check('Old accepted reply cannot alter reconnecting account status/ownership',snapshots.late.status===snapshots.reconnected.status&&snapshots.late.dot===snapshots.reconnected.dot&&snapshots.late.active&&snapshots.late.hasPromise&&snapshots.late.token==='synthetic-token-B');
   hold=false;await accept(held[3]);await page.waitForFunction(()=>!wftSyncState.isSyncing);
   }
   await finishSignoutReconnect();
  }else if(scenario==='newer-during-upload'){
   await page.evaluate(()=>{saveStudentSession('Synthetic',{id:'newer',createdAt:'2026-10-12T00:01:00Z',originalText:'Newer writing',images:[]});pendingPortfolioSync={studentName:'Synthetic',signature:'pending-newer',sessionData:{id:'pending-newer',originalText:'Pending uncommitted writing',images:[]}};persistPendingPortfolioSync();});
   await accept(held[0]);await waitHeld(2);snapshots.followup=await capture();
   check('New writing causes actual follow-up; stale payload excludes it',uploads.get(held[0]).data.Synthetic.sessions.every(s=>s.id!=='newer')&&uploads.get(held[1]).name==='wft-portfolio.json'&&uploads.get(held[1]).data.Synthetic.sessions.some(s=>s.id==='newer')&&snapshots.followup.active&&snapshots.followup.dirty);
   hold=false;await accept(held[1]);await page.waitForFunction(()=>window.runResult!==null);
  }else if(scenario==='reconnect-during-upload'){
   await reconnect();snapshots.reconnected=await capture();
   await accept(held[0]);await waitHeld(2);snapshots.followup=await capture();
   check('Reconnection queues behind the old run then owns a real new upload',snapshots.followup.token==='synthetic-token-B'&&snapshots.followup.active&&snapshots.followup.hasPromise&&requests.filter(r=>r.url.includes('/upload/'))[1].token==='Bearer synthetic-token-B');
   hold=false;await accept(held[1]);await page.waitForFunction(()=>window.runResult!==null);
  }else{
   hold=false;await accept(held[0]);
   if(scenario==='legacy-current')await page.waitForFunction(()=>window.legacyResult!==null);
   else if(scenario==='signout-current')await page.waitForFunction(()=>!driveAccessToken);
   else await page.waitForFunction(()=>window.runResult!==null);
  }
  }
  await finishScenario();
  snapshots.final=await capture();
  function checkFinal(){
  if(scenario==='legacy-current')check('Direct legacy callback reports accepted file ID and successful status',snapshots.final.legacy.id==='accepted-1'&&!snapshots.final.legacy.error&&/^Synced/.test(snapshots.final.status));
  else if(scenario==='signout-current')check('Actual sign-out waits for uploads and keeps local portfolio',!snapshots.final.token&&!snapshots.final.active&&/Signed out/.test(snapshots.final.status)&&JSON.parse(snapshots.final.bytes).Synthetic.sessions[0].originalText==='Original synthetic writing');
  else if(scenario==='newer-during-upload')check('Successful current snapshot cannot advertise synced over uncommitted pending writing',snapshots.final.result===true&&!snapshots.final.active&&!snapshots.final.dirty&&!snapshots.final.dot.split(' ').includes('synced')&&!/^Synced/.test(snapshots.final.status));
  else check('Current successful run clears its lock/dirty work and publishes Synced',!snapshots.final.active&&!snapshots.final.hasPromise&&!snapshots.final.dirty&&!snapshots.final.blocked&&/^Synced/.test(snapshots.final.status)&&(scenario==='signout-timeout-reconnect'||snapshots.final.result===true));
  if(scenario==='newer-during-upload')check('Uncommitted pending writing survives actual successful retry',snapshots.final.pending.sessionData.id==='pending-newer'&&JSON.parse(snapshots.final.bytes).Synthetic.sessions.some(s=>s.id==='newer')&&snapshots.final.counter===snapshots.final.syncedCounter);
  check('No browser script errors',errors.length===0);
  }
  checkFinal();
  cases.push({scenario,checks,snapshots,requests,errors});
  for(const route of held)await route.abort().catch(()=>{});
  await context.close();console.log(JSON.stringify({scenario,checks}));
 }}finally{await browser.close();if(process.env.WFT_TEST_REPORT)fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify({cases,sourceRoot:root,browser:browser.version(),productionMethodsReplaced:[],defaultsUnchanged:true},null,2));}
 assert.equal(cases.length,scenarios.length);assert.ok(cases.every(c=>c.checks.every(x=>x.passed)),'Upload ownership invariant failed; see native evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
