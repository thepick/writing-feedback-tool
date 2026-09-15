const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = path.resolve(__dirname, '..');
const artifactDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'wft-guide-test-'));

async function assertNotebookPrintColors(page) {
 const colors = await page.evaluate(() => {
  const style = selector => getComputedStyle(document.querySelector(selector));
  return {
   adjustment: style('.score-bar-fill').printColorAdjust,
   bar: style('.score-bar-fill').backgroundColor,
   badge: style('.score-badge').backgroundColor,
   strength: style('.info-box').backgroundColor,
   revision: style('.example-after').backgroundColor
  };
 });
 assert.deepEqual(colors, {
  adjustment: 'exact', bar: 'rgb(37, 99, 235)', badge: 'rgb(219, 234, 254)',
  strength: 'rgb(236, 253, 245)', revision: 'rgb(236, 253, 245)'
 });
}

(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 try {
 const page = await browser.newPage({viewport:{width:1000,height:1100}});
 const errors=[];
 page.on('pageerror', e => errors.push(e.message));
 await page.route('**/*', route => {
  const url=new URL(route.request().url());
  if (url.origin!=='http://127.0.0.1:8765') return route.abort();
  const file=path.join(repoRoot,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
  if (!fs.existsSync(file)) return route.fulfill({status:404,body:''});
  return route.fulfill({status:200,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream',body:fs.readFileSync(file)});
 });
 await page.goto('http://127.0.0.1:8765', {waitUntil:'domcontentloaded'});
 await page.waitForFunction(() => typeof ensureNotebookGuide === 'function');
 const result = await page.evaluate(() => {
  const original = 'I went to the park. I saw a dog. The dog was nice. I play with the dog yesterday.';
  const candidates = [
   {area:'Sentence Flow',skill:'Vary sentence openings',page1Connection:'Flow',originalQuote:'I saw a dog.',nextTimeExample:'At the park, I saw a dog.',whyThisWorks:'Starting with the place helps vary your sentence openings.'},
   {area:'Word Choice',skill:'Choose precise words',page1Connection:'Word Choice',originalQuote:'The dog was nice.',nextTimeExample:'The dog was friendly.',whyThisWorks:'Friendly tells the reader more clearly what nice means.'},
   {area:'Grammar',skill:'Use past tense',page1Connection:'Grammar',originalQuote:'I play with the dog yesterday.',nextTimeExample:'I played with the dog yesterday.',whyThisWorks:'Played shows that this happened in the past.'}
  ];
  const scores={'Ideas & Details':9,Grammar:6,'Word Choice':5,Organization:9,Flow:4,'Spelling & Punctuation':9};
  const categories=Object.fromEntries(Object.keys(scores).map(key=>[key,{score:scores[key],evidence:'Your ideas are clear.',growthTip: key==='Flow' ? 'Vary sentence openings.' : key==='Word Choice' ? 'Choose precise vocabulary.' : 'Use past tense.'}]));
  const response='**Writing Title:** A Friendly Dog\n## Notebook Guide Candidate JSON\n```json\n'+JSON.stringify({candidates})+'\n```';
  const parsed=parseDetailedAssessment(response,original,{mainGenre:'Narrative / Story'});
  const data={overall:70,categoryScores:scores,detailed:{categories,notebookGuideCandidates:parsed.notebookGuideCandidates,growGoal:'Improve sentence flow.'},correctedStory:original.replace('I play','I played'),actualWords:24,targetWords:100,sampleStatus:{status:'scorable'},writingGenre:{mainGenre:'Narrative / Story'}};
  const guide=ensureNotebookGuide(data,original);
  const invalid=sanitizeNotebookGuideCandidate({...candidates[0],originalQuote:'A sentence that the student never wrote.'},original,data.writingGenre);
  const generic=sanitizeNotebookGuideCandidate({...candidates[0],nextTimeExample:'Try using stronger words.'},original,data.writingGenre);
  const malformed=parseNotebookGuideCandidatesFromStep3Text('## Notebook Guide Candidate JSON\n{oops',original,data.writingGenre);
  const low=ensureNotebookGuide({sampleStatus:{status:'insufficient'},writingGenre:data.writingGenre},'dog');
  const missing=buildNotebookGuidePriorities({categoryScores:{Flow:4,Grammar:null}});
  document.getElementById('studentWriting').value=original;
  latestAnalysisData=data;
  selectedStudent='Test Student';
  fillNotebookSummary();
  const prompt=buildStep3Prompt(data.correctedStory,'',{},100,24,getGradeProfile(),data.writingGenre,original,buildNotebookGuidePriorities(data));
  saveCurrentSessionToPortfolio(data);
  const saved=pendingPortfolioSync && pendingPortfolioSync.sessionData;
  const newSnapshot=document.getElementById('notebookPrintDocument').innerHTML;
  const session={originalText:original,correctedPlainText:data.correctedStory,categoryScores:scores,detailedFeedback:{categories},feedbackSummary:{},notebookGuide:guide,notebookGuideVersion:3,title:'A Friendly Dog',overall:70,writingGenre:'Narrative / Story'};
  const reconstructed=buildNotebookPrintHtmlFromPortfolioSession('Test Student',session);
  const oldSnapshot='<div class="page"><p>Keep this saved page one.</p></div><div class="page"><div class="corrected-writing"><div>Corrected Writing</div><p>Old text.</p></div></div>';
  const refreshed=refreshNotebookPage2Guide(oldSnapshot,'Test Student',session);
  const legacy=refreshNotebookPage2Guide(newSnapshot,'Test Student',{...session,notebookGuide:null});
  return {prompt,savedCount:saved && saved.notebookGuide.examples.length,savedSnapshot:saved && saved.notebookPrintHtml,count:guide.examples.length,areas:guide.examples.map(e=>e.page1Connection),parsed:parsed.notebookGuideCandidates.length,invalid,generic,malformed,low,missing,refreshed,legacy,rendered:document.getElementById('notebookPage2Content').innerText,html:buildNotebookPrintDocument(newSnapshot,'Test Student','A Friendly Dog'),portfolioHtml:buildNotebookPrintDocument(reconstructed,'Test Student','A Friendly Dog')};
 });
 assert.equal(result.parsed,3);
 assert.match(result.prompt,/Notebook Guide Candidate JSON/);
 assert.match(result.prompt,/I play with the dog yesterday/);
 assert.equal(result.savedCount,3);
 assert.match(result.savedSnapshot,/Next Time Writing Guide/);
 assert.equal(result.count,3);
 assert.deepEqual(new Set(result.areas),new Set(['Flow','Word Choice','Grammar']));
 assert.equal(result.invalid,null);
 assert.equal(result.generic,null);
 assert.deepEqual(result.malformed,[]);
 assert.equal(result.low.examples.length,0);
 assert.match(result.low.focusItems[0],/full sentence/);
 assert.equal(result.missing[0].category,'Flow');
 assert.match(result.refreshed,/Keep this saved page one/);
 assert.match(result.refreshed,/Next Time Writing Guide/);
 assert.doesNotMatch(result.refreshed,/Old text/);
 assert.match(result.legacy,/EXAMPLE 3/);
 assert.match(result.rendered,/Why this works:/i);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(artifactDir,'guide-preview.html'),result.html);
 await page.setContent(result.html,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>window.fitAllNotebookPages());
 await page.emulateMedia({media:'print'});
 await assertNotebookPrintColors(page);
 const layout=await page.locator('.page').evaluateAll(pages=>pages.map(p=>({height:p.clientHeight,scroll:p.scrollHeight,warning:p.classList.contains('fit-warning')})));
 assert.equal(layout.length,2);
 assert.ok(layout.every(p=>Math.abs(p.height-1123)<=1),'A4 pages should be 297 mm tall');
 assert.match(result.html, /size: A4 portrait/);
 const paperWidth=await page.locator('.page').first().evaluate(p=>p.getBoundingClientRect().width);
 assert.ok(Math.abs(paperWidth-794)<=1,'A4 pages should be 210 mm wide');
 const guideFont=await page.locator('.example-after').first().evaluate(p=>parseFloat(getComputedStyle(p).fontSize));
 assert.ok(guideFont>=12,'A4 guide text should be enlarged, not just the paper');
 assert.ok(layout.every(p=>!p.warning && p.scroll<=p.height+1),JSON.stringify(layout));
 await page.locator('.page').first().screenshot({path:path.join(artifactDir,'guide-page1.png')});
 await page.locator('.page').nth(1).screenshot({path:path.join(artifactDir,'guide-page2.png')});
 await page.pdf({path:path.join(artifactDir,'guide-test.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.pdf({path:path.join(artifactDir,'guide-no-backgrounds.pdf'),preferCSSPageSize:true,printBackground:false});
 console.log('Print preview artifacts: '+artifactDir);
 await page.setContent(result.portfolioHtml,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>window.fitAllNotebookPages());
 await assertNotebookPrintColors(page);
 assert.equal(await page.locator('.guide-example').count(),3);
 assert.equal(await page.locator('.fit-warning').count(),0);
 console.log(JSON.stringify({passed:true,examples:result.count,areas:result.areas,layout,checks:['candidate parsing','exact source quotes','generic advice rejection','malformed response fallback','low sample coaching','missing scores','new assessment rendering','saved portfolio rendering','legacy snapshot preservation','two-page print fit','no browser exceptions']}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
