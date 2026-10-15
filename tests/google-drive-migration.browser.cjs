const {chromium} = require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname,'..'));
const localAppRoute=require('./support/local-app-route');
const base='http://127.0.0.1:8765', folderType='application/vnd.google-apps.folder';
(async function runNativeMigrationCases(){
 const browser=await chromium.launch({channel:'msedge',headless:true}), cases=[],errors=[];
 try {
  for(const scenario of ['cancel','account-mismatch','verified-copy','corrupt-retry']){
   let serial=0, corrupt=scenario==='corrupt-retry'; const files=[],calls=[],uploads=new Map();
   const add=(token,name,data,parent='root',mimeType='application/json')=>{const f={id:'synthetic-'+(++serial),token,name,mimeType,parents:[parent],data:Buffer.from(typeof data==='string'?data:JSON.stringify(data)),appProperties:{}};files.push(f);return f;};
   const folder=add('old','WritingFeedbackTool','', 'root',folderType),media=add('old','media','',folder.id,folderType);
   const photo=add('old','photo.jpg','synthetic-image-bytes',media.id,'image/jpeg');
   const portfolio=add('old','portfolio.json',{Synthetic:{sessions:[{id:'session',images:[{driveFileId:photo.id}]}]},unknown:'preserve',unknownScalars:{score:0,enabled:false,empty:null}},folder.id);
   const originals=files.map(f=>({id:f.id,bytes:f.data.toString('base64'),parents:[...f.parents]}));
   const page=await browser.newPage(); page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async function migrationRoute(route){
    const req=route.request(),url=new URL(req.url()),method=req.method();
    const reply=(data,status=200,headers={})=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,PUT,OPTIONS',...headers},body:Buffer.isBuffer(data)?data:typeof data==='string'?data:JSON.stringify(data)});
    if(url.origin===base)return localAppRoute(route,root);
    if(url.origin!=='https://www.googleapis.com')return route.abort();
    if(method==='OPTIONS')return reply('',204);
    const token=(req.headers().authorization||'').replace('Bearer ',''); calls.push({url:url.href,method,token});
    assert.ok(['old','new'].includes(token)); assert.ok(token!=='old'||method==='GET','Original connection must be read only');
    if(url.pathname.endsWith('/userinfo'))return reply({id:token==='old'&&scenario==='account-mismatch'?'other':'same',email:'synthetic@example.invalid'});
    if(uploads.has(url.href)){
     const {meta,id}=uploads.get(url.href);let f=files.find(f=>f.id===id);
     if(!f)f=add(token,meta.name,'',meta.parents?.[0]||'root',meta.mimeType);
     f.appProperties={...f.appProperties,...meta.appProperties};f.data=corrupt?Buffer.from('corrupt-upload'):req.postDataBuffer();return reply({id:f.id});
    }
    if(url.searchParams.get('uploadType')==='resumable'){
     const id=url.pathname.match(/\/files\/([^/]+)$/)?.[1],location='https://www.googleapis.com/upload/session/'+(++serial);
     uploads.set(location,{id,meta:JSON.parse(req.postData())});return reply({},200,{Location:location,'access-control-expose-headers':'Location'});
    }
    if(method==='POST'){
     const meta=JSON.parse(req.postData()),f=add(token,meta.name,'',meta.parents?.[0]||'root',meta.mimeType);f.appProperties=meta.appProperties||{};return reply({id:f.id});
    }
    const id=url.pathname.match(/\/files\/([^/]+)$/)?.[1];
    if(id){const f=files.find(f=>f.id===decodeURIComponent(id)&&f.token===token);return f?reply(f.data):reply({},404);}
    const q=url.searchParams.get('q')||'',space=url.searchParams.get('spaces');let found=files.filter(f=>f.token===token&&(space!=='appDataFolder'||f.parents.includes('appDataFolder')));
    const name=q.match(/name\s*=\s*'([^']+)'/),parent=q.match(/'([^']+)' in parents/);
    if(name)found=found.filter(f=>f.name===name[1]);if(parent)found=found.filter(f=>f.parents.includes(parent[1]));
    if(q.includes('mimeType='))found=found.filter(f=>f.mimeType===folderType);
    if(q.includes('oauthSource'))found=found.filter(f=>f.appProperties.oauthSource==='oldclient');
    return reply({files:found.map(({token,data,...meta})=>meta)});
   });
   await page.goto(base,{waitUntil:'load'});
   await page.evaluate(()=>{
    stopWftSyncPolling();stopDriveAutoSync();
    window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:cfg=>({requestAccessToken(){cfg.callback({access_token:'old'});}})}}};
    window.__migrationConfig={oldClient:'oldclient',newClient:'newclient',folderName:'WritingFeedbackTool',scope:'drive profile email'};
    window.__migrationPromise=GoogleDriveMigration.ensure(__migrationConfig,'new').then(result=>{window.__migrationResult=result;},error=>{window.__migrationError=error.message;});
   });
   const dialog=page.locator('dialog[aria-label="Keep your saved Google progress"]');await dialog.waitFor({state:'visible'});
   if(scenario==='cancel'){
    await dialog.getByRole('button',{name:'Cancel sign-in'}).click();await page.waitForFunction(()=>!!window.__migrationError);
    assert.match(await page.evaluate(()=>__migrationError),/cancelled/);assert.equal(calls.filter(c=>c.method!=='GET').length,0);
   } else {
    await dialog.getByRole('button',{name:'Keep my saved progress',exact:true}).click();
    if(scenario==='account-mismatch'){
     await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent.includes('same Google account'));
     assert.equal(calls.filter(c=>c.method!=='GET').length,0);assert.equal(await dialog.getByRole('button',{name:'I have never used Google sync here'}).isDisabled(),true);
     await dialog.getByRole('button',{name:'Cancel sign-in'}).click();await page.waitForFunction(()=>!!window.__migrationError);
    } else {
     if(scenario==='corrupt-retry'){
      await page.waitForFunction(()=>document.querySelector('dialog [role="status"]')?.textContent.includes('could not be verified'));
      assert.equal(await dialog.getByRole('button',{name:'I have never used Google sync here'}).isDisabled(),true);
      assert.equal(files.filter(f=>f.token==='new'&&f.name.endsWith('google-migration-v1.json')).length,0);
      const copiedCount=files.filter(f=>f.token==='new').length;corrupt=false;
      await dialog.getByRole('button',{name:'Keep my saved progress',exact:true}).click();
      await page.waitForFunction(()=>!!window.__migrationResult);assert.equal(files.filter(f=>f.token==='new').length,copiedCount+1,'Retry reuses copies and adds only marker');
     } else await page.waitForFunction(()=>!!window.__migrationResult);
     assert.equal(await dialog.count(),0);const result=await page.evaluate(()=>__migrationResult),ids=result.ids;
     assert.equal(result.user.id,'same');assert.equal(files.find(f=>f.id===ids[photo.id]).data.toString(),'synthetic-image-bytes');
     assert.deepEqual(files.find(f=>f.id===ids[photo.id]).parents,[ids[media.id]]);
     const copied=JSON.parse(files.find(f=>f.id===ids[portfolio.id]).data.toString());assert.equal(copied.Synthetic.sessions[0].images[0].driveFileId,ids[photo.id]);assert.equal(copied.unknown,'preserve');
     assert.deepEqual(copied.unknownScalars,{score:0,enabled:false,empty:null},'Unknown scalar fields survive native recovery');
     const markers=files.filter(f=>f.token==='new'&&f.name.endsWith('google-migration-v1.json'));assert.equal(markers.length,1);assert.equal(JSON.parse(markers[0].data.toString()).userId,'same');
     const before=calls.length;await page.evaluate(async()=>{const result=await GoogleDriveMigration.ensure(__migrationConfig,'new');if(result.user.id!=='same')throw new Error('Marker retry account changed');});
     assert.ok(calls.slice(before).every(c=>c.method==='GET'),'Completed marker retry is read only');
    }
   }
   assert.deepEqual(files.filter(f=>f.token==='old').map(f=>({id:f.id,bytes:f.data.toString('base64'),parents:[...f.parents]})),originals);
   assert.ok(calls.every(c=>c.token!=='old'||c.method==='GET'));cases.push({name:scenario,passed:true,calls,new_files:files.filter(f=>f.token==='new').map(({data,token,...f})=>f)});
   await page.close();
  }
  assert.equal(cases.length,4,'All native migration scenarios must run');
  assert.deepEqual(errors,[]);if(process.env.WFT_TEST_REPORT)fs.writeFileSync(process.env.WFT_TEST_REPORT,JSON.stringify({root,cases,page_errors:errors,scope:'Full exact shipped page and real native DOM dialog, unmodified public GoogleDriveMigration.ensure, request/list/resumable upload/hash/ID remap/folder traversal/marker/retry paths. Actual browser fetch/Blob/SHA-256; synthetic intercepted Google responses/OAuth callback. No real Drive/OAuth/account/privacy/permission/device claim.'},null,2)+'\n');
  console.log(JSON.stringify({passed:cases.length}));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
