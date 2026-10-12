const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const scenarios = ['chooser-cancel-enter','chooser-cancel-space','chooser-escape','text-cancel-enter','text-cancel-space','text-escape','text-submit-confirm-cancel-enter','text-submit-confirm-submit-enter'];
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true}), cases=[];
  try {
    for(const scenario of scenarios) {
      const page=await browser.newPage(), errors=[], alerts=[], requests=[], checks=[];
      let observed;
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.origin!=='http://127.0.0.1:8765') {requests.push(u.origin+u.pathname);return route.abort();}
        const file=path.join(root,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
        return fs.existsSync(file)?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'text/html'}):route.fulfill({status:404,body:''});
      });
      try {
        await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
        await page.evaluate(()=>{
          stopWftSyncPolling();stopDriveAutoSync();localStorage.clear();sessionStorage.clear();
          const entry={id:'writing',createdAt:'2026-10-01T00:00:00Z',originalText:'Synthetic writing must stay with its student',images:[]};
          localStorage.setItem('wft_portfolio',JSON.stringify({Alice:{sessions:[entry]},Bob:{sessions:[]}}));
          localStorage.setItem('wft_students','["Alice","Bob"]');localStorage.setItem('wft_selectedStudent','Alice');localStorage.setItem('wft_settings','{"students":["Alice","Bob"],"unknown":"preserve"}');localStorage.setItem(WFT_DELETIONS_STORAGE_KEY,'{"records":[]}');
          students=['Alice','Bob'];selectedStudent='Alice';pendingPortfolioSync=null;renderStudentList();populateStudentDropdown();
          window.keyboardSnapshot=()=>({bytes:Object.fromEntries(['wft_portfolio','wft_students','wft_selectedStudent','wft_settings',WFT_DELETIONS_STORAGE_KEY].map(k=>[k,localStorage.getItem(k)])),roster:students.slice(),selected:selectedStudent,dirty:[wftSyncState.pendingPortfolioPush,wftSyncState.pendingSettingsPush,wftSyncState.pendingDeletionsPush]});
          window.keyboardBefore=keyboardSnapshot();
          window.keyboardFlags={v2:WFT_SYNC_ENGINE_V2,split:WFT_SPLIT_STUDENT_FILES_V1,index:WFT_PORTFOLIO_INDEX_V1,lazy:WFT_LAZY_PORTFOLIO_LOAD_V1,idb:WFT_INDEXEDDB_CACHE_V1,debug:WFT_DEBUG,syncDebug:WFT_SYNC_DEBUG};
        });
        await page.locator('#adminTabBtn').click();
        await page.locator('#toggleRosterBtn').click();
        await page.getByRole('button',{name:'Manage Student',exact:true}).click();
        await page.waitForFunction(()=>document.activeElement?.id==='wftManageStudentSelect');
        const check=(name,passed)=>checks.push({name,passed:!!passed});
        check('Actual chooser focuses the student select',await page.locator('#wftManageStudentSelect').evaluate(el=>document.activeElement===el));
        if(scenario.startsWith('chooser-')) {
          if(scenario!=='chooser-escape') {
            await page.keyboard.press('Tab');
            check('Tab reaches actual Cancel button',await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>document.activeElement===el));
          }
          await page.keyboard.press(scenario.endsWith('space')?'Space':scenario.endsWith('escape')?'Escape':'Enter');
          await page.waitForFunction(()=>!document.getElementById('wftManageStudentSelect'));
          check('Cancelling chooser does not start Rename Student',await page.locator('#wftTextInputField').count()===0);
        } else {
          await page.keyboard.press('Enter');
          await page.waitForFunction(()=>document.activeElement?.id==='wftTextInputField');
          check('Actual rename dialog focuses and selects current name',await page.locator('#wftTextInputField').evaluate(el=>document.activeElement===el&&el.value==='Alice'&&el.selectionStart===0&&el.selectionEnd===5));
          await page.locator('#wftTextInputField').fill('Alicia');
          if(scenario.startsWith('text-cancel-')) {
            await page.keyboard.press('Tab');
            check('Tab reaches actual Cancel button',await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>document.activeElement===el));
          }
          await page.keyboard.press(scenario.endsWith('space')?'Space':scenario==='text-escape'?'Escape':'Enter');
          await page.waitForFunction(()=>!document.getElementById('wftTextInputField'));
          if(scenario.startsWith('text-submit-')) {
            await page.waitForFunction(()=>document.activeElement?.classList.contains('wft-confirm-cancel'));
            check('Submitting rename shows the actual confirmation',await page.locator('#wftConfirmTitle').textContent()==='Confirm Rename');
            if(scenario==='text-submit-confirm-submit-enter') await page.keyboard.press('Tab');
            await page.keyboard.press('Enter');
            await page.waitForFunction(()=>!document.getElementById('wftConfirmTitle'));
            if(scenario==='text-submit-confirm-submit-enter') await page.waitForFunction(()=>students.includes('Alicia'));
          } else check('Cancelling rename does not start Confirm Rename',await page.locator('#wftConfirmTitle').count()===0);
        }
        observed=await page.evaluate(()=>({before:keyboardBefore,after:keyboardSnapshot(),flags:keyboardFlags,dialogTitles:Array.from(document.querySelectorAll('.wft-confirm-header')).map(el=>el.textContent)}));
        if(scenario==='text-submit-confirm-submit-enter') {
          const portfolio=JSON.parse(observed.after.bytes.wft_portfolio);
          check('Keyboard-confirmed rename retains writing with corrected name',observed.after.roster.includes('Alicia')&&!observed.after.roster.includes('Alice')&&portfolio.Alicia.sessions[0].originalText==='Synthetic writing must stay with its student');
        } else check('Cancelled workflow preserves bytes, roster, selection and dirty state',JSON.stringify(observed.before)===JSON.stringify(observed.after));
        check('No browser script errors',errors.length===0);
        cases.push({name:scenario,passed:checks.every(c=>c.passed),checks,observed,errors,alerts,blockedExternalRequests:requests});
      } catch(e) {cases.push({name:scenario,passed:false,error:e.message,checks,observed,errors,alerts});}
      finally {await page.close();}
    }
  } finally {await browser.close();}
  const failed=cases.filter(c=>!c.passed);
  if(process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify({root,browser:'Native headless Edge',productionMethodsReplaced:[],passed:cases.length-failed.length,failed:failed.length,cases},null,2));
  console.log(JSON.stringify({passed:cases.length-failed.length,total:cases.length,failures:failed.map(c=>({name:c.name,error:c.error,checks:c.checks}))}));
  assert.equal(failed.length,0,'Native dialog keyboard invariants');
})().catch(e=>{console.error(e);process.exitCode=1;});
