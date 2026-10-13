const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const scenarios = ['chooser-cancel-enter','chooser-cancel-space','chooser-escape','text-cancel-enter','text-cancel-space','text-escape','text-submit-confirm-cancel-enter','text-submit-confirm-submit-enter'];
scenarios.push('chooser-submit-enter','chooser-submit-space','text-button-submit-enter','text-button-submit-space','text-submit-confirm-cancel-space','text-submit-confirm-submit-space');
scenarios.push('archive-cancel-enter','archive-cancel-space','archive-escape','archive-input-submit-enter','archive-button-submit-enter','archive-button-submit-space');
for (const field of ['chooser','text']) for (const signal of ['composing','229']) for (const key of ['Enter','Escape']) scenarios.push(`${field}-ime-${signal}-${key}`);

async function checkCompositionSignal(page, scenario, selector, check) {
  const result=await page.locator(selector).evaluate((el,name)=>{
    const parts=name.split('-'),event=new KeyboardEvent('keydown',{key:parts[3],bubbles:true,cancelable:true,isComposing:parts[2]==='composing',keyCode:parts[2]==='229'?229:0});
    el.dispatchEvent(event);
    return {prevented:event.defaultPrevented,connected:el.isConnected,composing:event.isComposing,keyCode:event.keyCode,trusted:event.isTrusted};
  },scenario);
  check('Synthetic IME signal delivered accurately',!result.trusted&&(scenario.includes('-composing-')?result.composing:!result.composing&&result.keyCode===229));
  check('Composition key is left to IME and does not close dialog',!result.prevented&&result.connected);
  check('Composition key does not advance workflow',await page.locator(selector==='#wftManageStudentSelect'?'#wftTextInputField':'#wftConfirmTitle').count()===0);
  await page.keyboard.press('Escape');
}

async function runArchiveWorkflow(page, scenario, key, check) {
  await page.locator('#adminTabBtn').click();
  await page.locator('#toggleRosterBtn').click();
  await page.getByRole('button',{name:'Archive Current School Year',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='wftTextInputField');
  check('Archive caller focuses actual name input',await page.locator('#wftTextInputField').evaluate(el=>document.activeElement===el));
  await page.locator('#wftTextInputField').fill('Synthetic year');
  if(scenario.startsWith('archive-cancel-')||scenario.startsWith('archive-button-')) {
    await page.keyboard.press('Tab');
    if(scenario.startsWith('archive-button-')) await page.keyboard.press('Tab');
    check('Tab reaches intended archive button',await page.getByRole('button',{name:scenario.startsWith('archive-button-')?'Continue':'Cancel',exact:true}).evaluate(el=>document.activeElement===el));
  }
  await page.keyboard.press(key);
  await page.waitForFunction(()=>!document.getElementById('wftTextInputField'));
  if(scenario.includes('-submit-')) {
    await page.waitForFunction(()=>document.activeElement?.classList.contains('wft-confirm-cancel'));
    check('Archive submission reaches real confirmation',await page.getByRole('button',{name:'Create Archive',exact:true}).count()===1);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.getElementById('wftConfirmTitle'));
  } else check('Archive cancellation does not start confirmation',await page.locator('#wftConfirmTitle').count()===0);
}

async function runChooserWorkflow(page, scenario, key, check) {
  if(scenario.includes('-ime-')) {
    await checkCompositionSignal(page, scenario, '#wftManageStudentSelect', check);
    return;
  }
  if(scenario!=='chooser-escape') {
    await page.keyboard.press('Tab');
    if(scenario.startsWith('chooser-submit-')) await page.keyboard.press('Tab');
    if(scenario.startsWith('chooser-submit-')) check('Tab reaches actual Rename button',await page.getByRole('button',{name:'Rename Student',exact:true}).evaluate(el=>document.activeElement===el));
    else
    check('Tab reaches actual Cancel button',await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>document.activeElement===el));
  }
  await page.keyboard.press(key);
  await page.waitForFunction(()=>!document.getElementById('wftManageStudentSelect'));
  if(scenario.startsWith('chooser-submit-')) {
    await page.waitForFunction(()=>document.activeElement?.id==='wftTextInputField');
    check('Focused Rename button opens real name dialog',await page.locator('#wftTextInputTitle').textContent()==='Rename Student');
    await page.keyboard.press('Escape');
  }
  check('Cancelling chooser does not start Rename Student',await page.locator('#wftTextInputField').count()===0);
}

async function runRenameWorkflow(page, scenario, key, accepted, check) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.activeElement?.id==='wftTextInputField');
  check('Actual rename dialog focuses and selects current name',await page.locator('#wftTextInputField').evaluate(el=>document.activeElement===el&&el.value==='Alice'&&el.selectionStart===0&&el.selectionEnd===5));
  await page.locator('#wftTextInputField').fill('Alicia');
  if(scenario.includes('-ime-')) {
    await checkCompositionSignal(page, scenario, '#wftTextInputField', check);
    return;
  }
  if(scenario.startsWith('text-cancel-')||scenario.startsWith('text-button-')) {
    await page.keyboard.press('Tab');
    if(scenario.startsWith('text-button-')) {
      await page.keyboard.press('Tab');
      check('Tab reaches actual Save Name button',await page.getByRole('button',{name:'Save Name',exact:true}).evaluate(el=>document.activeElement===el));
    } else
    check('Tab reaches actual Cancel button',await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>document.activeElement===el));
  }
  await page.keyboard.press(scenario.startsWith('text-submit-')?'Enter':key);
  await page.waitForFunction(()=>!document.getElementById('wftTextInputField'));
  if(scenario.startsWith('text-submit-')||scenario.startsWith('text-button-')) {
    await page.waitForFunction(()=>document.activeElement?.classList.contains('wft-confirm-cancel'));
    check('Submitting rename shows the actual confirmation',await page.locator('#wftConfirmTitle').textContent()==='Confirm Rename');
    if(accepted) await page.keyboard.press('Tab');
    await page.keyboard.press(scenario.startsWith('text-button-')?'Escape':key);
    await page.waitForFunction(()=>!document.getElementById('wftConfirmTitle'));
    if(accepted) await page.waitForFunction(()=>students.includes('Alicia'));
  } else check('Cancelling rename does not start Confirm Rename',await page.locator('#wftConfirmTitle').count()===0);
}

function checkRetainedStudentData(observed, accepted, check) {
  if(accepted) {
    const portfolio=JSON.parse(observed.after.bytes.wft_portfolio);
    const beforePortfolio=JSON.parse(observed.before.bytes.wft_portfolio);
    check('Keyboard-confirmed rename retains writing with corrected name',observed.after.roster.includes('Alicia')&&!observed.after.roster.includes('Alice')&&portfolio.Alicia.sessions[0].originalText==='Synthetic writing must stay with its student');
    check('Accepted rename preserves all original writing fields and other student portfolio',portfolio.Alicia.sessions.length===beforePortfolio.Alice.sessions.length&&beforePortfolio.Alice.sessions.every((session,i)=>Object.keys(session).every(key=>JSON.stringify(portfolio.Alicia.sessions[i][key])===JSON.stringify(session[key])))&&JSON.stringify(portfolio.Bob)===JSON.stringify(beforePortfolio.Bob)&&!Object.hasOwn(portfolio,'Alice'));
    check('Accepted rename selects the corrected student',observed.after.selected==='Alicia'&&observed.after.bytes.wft_selectedStudent==='Alicia');
  } else check('Cancelled workflow preserves bytes, roster, selection and dirty state',JSON.stringify(observed.before)===JSON.stringify(observed.after));
}

async function runKeyboardScenario(browser, scenario, cases) {
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
      window.keyboardSnapshot=()=>({bytes:Object.fromEntries(['wft_portfolio','wft_students','wft_selectedStudent','wft_settings',WFT_DELETIONS_STORAGE_KEY,PENDING_PORTFOLIO_SYNC_KEY].map(k=>[k,localStorage.getItem(k)])),roster:students.slice(),selected:selectedStudent,pending:pendingPortfolioSync,dirty:[wftSyncState.pendingPortfolioPush,wftSyncState.pendingSettingsPush,wftSyncState.pendingDeletionsPush]});
      window.keyboardBefore=keyboardSnapshot();
      window.keyboardFlags={v2:WFT_SYNC_ENGINE_V2,split:WFT_SPLIT_STUDENT_FILES_V1,index:WFT_PORTFOLIO_INDEX_V1,lazy:WFT_LAZY_PORTFOLIO_LOAD_V1,idb:WFT_INDEXEDDB_CACHE_V1,debug:WFT_DEBUG,syncDebug:WFT_SYNC_DEBUG};
    });
    const check=(name,passed)=>checks.push({name,passed:!!passed});
    const key=scenario.endsWith('space')?'Space':scenario.endsWith('escape')?'Escape':'Enter';
    const accepted=scenario.startsWith('text-submit-confirm-submit-');
    if(scenario.startsWith('archive-')) {
      await runArchiveWorkflow(page, scenario, key, check);
    } else {
      await page.locator('#adminTabBtn').click();
      await page.locator('#toggleRosterBtn').click();
      await page.getByRole('button',{name:'Manage Student',exact:true}).click();
      await page.waitForFunction(()=>document.activeElement?.id==='wftManageStudentSelect');
      check('Actual chooser focuses the student select',await page.locator('#wftManageStudentSelect').evaluate(el=>document.activeElement===el));
      if(scenario.startsWith('chooser-')) await runChooserWorkflow(page, scenario, key, check);
      else await runRenameWorkflow(page, scenario, key, accepted, check);
    }
    observed=await page.evaluate(()=>({before:keyboardBefore,after:keyboardSnapshot(),flags:keyboardFlags,dialogTitles:Array.from(document.querySelectorAll('.wft-confirm-header')).map(el=>el.textContent)}));
    checkRetainedStudentData(observed, accepted, check);
    check('No browser script errors',errors.length===0);
    cases.push({name:scenario,passed:checks.every(c=>c.passed),checks,observed,errors,alerts,blockedExternalRequests:requests});
  } catch(e) {cases.push({name:scenario,passed:false,error:e.message,checks,observed,errors,alerts});}
  finally {await page.close();console.log(`${scenario}: ${cases[cases.length-1].passed?'passed':'failed'}`);}
}

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true}), cases=[];
  try {
    for(const scenario of scenarios) {
      await runKeyboardScenario(browser, scenario, cases);
    }
  } finally {await browser.close();}
  const failed=cases.filter(c=>!c.passed);
  if(process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify({root,browser:'Native headless Edge',productionMethodsReplaced:[],passed:cases.length-failed.length,failed:failed.length,cases},null,2));
  console.log(JSON.stringify({passed:cases.length-failed.length,total:cases.length,failures:failed.map(c=>({name:c.name,error:c.error,checks:c.checks}))}));
  assert.equal(failed.length,0,'Native dialog keyboard invariants');
})().catch(e=>{console.error(e);process.exitCode=1;});
