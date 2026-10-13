// Native request boundaries only; service responses and identity are synthetic.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const held = [], requests = [], errors = [], checks = [];
  let observed;
  function checkHeldRequestInvariants(timedOut, late) {
    const check = (name,pass) => checks.push({name,passed:!!pass});
    check('Three actual uploads timed out and run returned false',held.length===3 && timedOut.result===false && timedOut.dirty && !timedOut.active && /TIMEOUT/.test(timedOut.error));
    check('Held upload payloads never contain newer writing',requests.filter(r=>r.url.includes('/upload/')).every(r=>!r.body.includes('Newer synthetic writing')));
    check('Late callback never resolves failed run or clears newer dirty/pending bytes',late.result===false && late.dirty && late.bytesUnchanged && late.pending.sessionData.id==='newer' && late.portfolio.Synthetic.sessions.some(s=>s.id==='newer'));
    check('Late obsolete upload cannot advertise synced while newer writing remains dirty',!late.dot.split(' ').includes('synced') && !/^Synced/.test(late.status));
    check('No browser script errors',errors.length===0);
  }
  try {
    const context = await browser.newContext(), page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const reply = data => route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      if (url.origin === 'http://127.0.0.1:8765') {
        const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
        return fs.existsSync(file) ? route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'text/html'}) : route.fulfill({status:404,body:''});
      }
      if (url.origin !== 'https://www.googleapis.com') return route.abort();
      if (req.method() === 'OPTIONS') return route.fulfill({status:204,body:''});
      requests.push({url:url.href,method:req.method(),body:req.postData(),token:req.headers().authorization});
      if (url.pathname.startsWith('/upload/')) { held.push(route); return; }
      if (url.searchParams.has('q')) return reply({files:[]});
      if (url.pathname.endsWith('/root-folder')) return reply({id:'root-folder',name:'WritingFeedbackTool',mimeType:'application/vnd.google-apps.folder',trashed:false});
      return reply({});
    });
    await page.clock.install();
    await page.goto('http://127.0.0.1:8765', {waitUntil:'load'});
    await page.evaluate(() => {
      stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('wft_settings','{}'); localStorage.setItem('wft_students','["Synthetic"]'); localStorage.setItem('wft_deletions','{"records":[]}');
      localStorage.setItem('wft_portfolio',JSON.stringify({Synthetic:{sessions:[{id:'original',createdAt:'2026-10-12T00:00:00Z',originalText:'Original synthetic writing',images:[]}]}}));
      students = ['Synthetic']; pendingPortfolioSync = null;
      driveAccessToken = wftSyncState.accessToken = 'synthetic-token'; wftSyncState.signedIn = true; wftSyncState.tokenExpiresAt = Date.now()+600000;
      driveFolderId = wftSyncState.folderId = 'root-folder'; clearWftSyncBlockState();
      wftSyncState.pendingSettingsPush = wftSyncState.pendingDeletionsPush = false;
      markWftPortfolioDirty('held-request-check');
      window.heldRunResult = null;
      window.heldRun = syncWftNow('manual',{immediate:true}).then(result => {window.heldRunResult=result;return result;});
    });
    const waitHeld = async count => { for(let i=0;i<200 && held.length<count;i++) await page.waitForTimeout(10); assert.equal(held.length,count,'Real multipart upload reached the intercepted service'); };
    await waitHeld(1);
    for (let attempt=1; attempt<=3; attempt++) {
      await page.clock.runFor(30001);
      if(attempt<3) { await page.clock.runFor(attempt===1?500:1000); await waitHeld(attempt+1); }
    }
    await page.waitForFunction(() => window.heldRunResult !== null);
    const timedOut = await page.evaluate(() => ({result:heldRunResult,dirty:wftSyncState.pendingPortfolioPush,active:wftSyncState.isSyncing,status:document.getElementById('driveSyncTextHeader').textContent,error:String(wftSyncState.lastError && wftSyncState.lastError.message)}));
    await page.evaluate(() => {
      saveStudentSession('Synthetic',{id:'newer',createdAt:'2026-10-12T00:01:00Z',originalText:'Newer synthetic writing absent from every held upload',images:[]});
      pendingPortfolioSync = {studentName:'Synthetic',signature:'newer',sessionData:{id:'newer',createdAt:'2026-10-12T00:01:00Z',originalText:'Newer synthetic writing absent from every held upload',images:[]}};
      persistPendingPortfolioSync(); updateSyncPortfolioButtonState();
      window.beforeLate = localStorage.getItem('wft_portfolio');
    });
    await held[0].fulfill({contentType:'application/json',body:JSON.stringify({id:'accepted-old-upload'})});
    await page.waitForFunction(() => getCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME) === 'accepted-old-upload');
    const late = await page.evaluate(() => ({result:heldRunResult,dirty:wftSyncState.pendingPortfolioPush,active:wftSyncState.isSyncing,status:document.getElementById('driveSyncTextHeader').textContent,dot:document.getElementById('driveSyncDotHeader').className,pending:pendingPortfolioSync,bytesUnchanged:beforeLate===localStorage.getItem('wft_portfolio'),portfolio:JSON.parse(localStorage.getItem('wft_portfolio')),error:String(wftSyncState.lastError && wftSyncState.lastError.message),flags:{v2:WFT_SYNC_ENGINE_V2,split:WFT_SPLIT_STUDENT_FILES_V1,index:WFT_PORTFOLIO_INDEX_V1,lazy:WFT_LAZY_PORTFOLIO_LOAD_V1,idb:WFT_INDEXEDDB_CACHE_V1,debug:WFT_DEBUG,syncDebug:WFT_SYNC_DEBUG}}));
    checkHeldRequestInvariants(timedOut, late);
    observed={timedOut,late,requests,errors,checks,sourceRoot:root,browser:browser.version(),timeoutMs:30000,productionMethodsReplaced:[]};
  } finally {
    for(const route of held.slice(1)) await route.abort().catch(()=>{});
    await browser.close();
    if(process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify(observed||{errors,requests,checks},null,2));
  }
  console.log(JSON.stringify(checks));
  assert.ok(checks.length && checks.every(c=>c.passed),'Held request invariants failed; see native evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
