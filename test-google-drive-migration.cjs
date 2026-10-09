const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname + (fs.existsSync(__dirname+'/google-drive-migration.js') ? '/google-drive-migration.js' : '/public/google-drive-migration.js'),'utf8');
const bytes=s=>new TextEncoder().encode(typeof s==='string'?s:JSON.stringify(s));
function setup(){
 const files=[], calls=[], uploads=new Map(); let count=0, badUser=false, corrupt=false, fail=false, changed=false, dialog;
 function file(token,name,data,parent='appDataFolder',mimeType='application/json'){const f={id:'id'+(++count),token,name,mimeType,parents:[parent],data:bytes(data),appProperties:{}};files.push(f);return f;}
 function element(tag){return {tag,children:[],style:{},textContent:'',setAttribute(){},addEventListener(){},append(...els){this.children.push(...els);},showModal(){},close(){},remove(){}};}
 const document={createElement:element,body:{append(d){dialog=d;}}};
 const reply=(data,status=200,headers={})=>new Response(typeof data==='string'||data instanceof Uint8Array?data:JSON.stringify(data),{status,headers});
 const context={window:{google:{accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:cfg=>({requestAccessToken(){cfg.callback({access_token:'old',expires_in:3600});}})}}}},document,Blob,AbortSignal,URLSearchParams,TextEncoder,TextDecoder,crypto:webcrypto,console};
 context.fetch=async(url,opts={})=>{
  const token=opts.headers.Authorization.replace('Bearer ',''),method=opts.method||'GET';calls.push({url,token,method});
  assert.ok(token!=='old'||method==='GET','Original must be read only');
  if(fail)return reply({},500);
  if(url.includes('/userinfo'))return reply({id:token==='old'&&badUser?'other':'same',email:'test@example.com'});
  if(uploads.has(url)){
   const {meta,id}=uploads.get(url);let f=files.find(x=>x.id===id);
   if(!f){f=file(token,meta.name,'',meta.parents?.[0]||'root',meta.mimeType);}
   f.appProperties={...f.appProperties,...meta.appProperties};f.data=new Uint8Array(await opts.body.arrayBuffer());
   if(corrupt)f.data=bytes('bad');return reply({id:f.id});
  }
  if(url.includes('uploadType=resumable')){
   const id=url.match(/\/files\/([^?]+)/)?.[1],location='https://www.googleapis.com/upload/session/'+(++count);
   uploads.set(location,{id,meta:JSON.parse(opts.body)});return reply({},200,{Location:location});
  }
  if(method==='POST'){
   const m=JSON.parse(opts.body),f=file(token,m.name,'',m.parents?.[0]||'root',m.mimeType);f.appProperties=m.appProperties||{};return reply({id:f.id});
  }
  const id=url.match(/\/files\/([^?]+)/)?.[1];
  if(id){const f=files.find(x=>x.id===decodeURIComponent(id)&&x.token===token);if(!f)return reply({},404);if(changed&&token==='old')f.data=bytes({progress:'changed'});return reply(f.data);}
  const q=new URL(url).searchParams.get('q')||'',space=new URL(url).searchParams.get('spaces');
  let matching=files.filter(f=>f.token===token&&(space!=='appDataFolder'||f.parents.includes('appDataFolder')));
  const name=q.match(/name\s*=\s*'([^']+)'/);if(name)matching=matching.filter(f=>f.name===name[1]);
  const parent=q.match(/'([^']+)' in parents/);if(parent)matching=matching.filter(f=>f.parents.includes(parent[1]));
  if(q.includes('mimeType='))matching=matching.filter(f=>f.mimeType==='application/vnd.google-apps.folder');
  if(q.includes('oauthSource'))matching=matching.filter(f=>f.appProperties.oauthSource==='oldclient');
  return reply({files:matching.map(({data,token,...metadata})=>metadata)});
 };
 vm.createContext(context);vm.runInContext(source.replace('window.GoogleDriveMigration = {ensure, remap};','window.GoogleDriveMigration = {ensure, remap, recoverAppData, recoverFolder, list};'),context);
 const api=context.window.GoogleDriveMigration;
 const config={oldClient:'oldclient',newClient:'newclient',fileName:'progress.json',scope:'drive profile email'};
 return {api,config,file,files,calls,get dialog(){return dialog;},set badUser(v){badUser=v;},set corrupt(v){corrupt=v;},set fail(v){fail=v;},set changed(v){changed=v;}};
}
async function until(fn){for(let i=0;i<50&&!fn();i++)await new Promise(setImmediate);assert.ok(fn(),'Condition did not complete');}
(async()=>{
 const binary = new Blob(['image']);
 let binaryCheck = setup();
 assert.equal(binaryCheck.api.remap({binary}, {}).binary, binary, 'IndexedDB photograph blobs must remain blobs');
 // New-client empty storage gets every raw byte including unknown fields. No old-token writes.
 let s=setup();const original=s.file('old','progress.json',{progress:{history:[1,2],settings:{speed:30}},extra:'retained'});
 await s.api.recoverAppData(s.config,'old','new');assert.deepEqual(Buffer.from(s.files.find(f=>f.token==='new').data),Buffer.from(original.data));assert.equal(s.files.filter(f=>f.token==='old').length,1);
 await s.api.recoverAppData(s.config,'old','new');assert.equal(s.files.filter(f=>f.token==='new').length,1,'Retry must not duplicate');
 // Existing differing data cannot be overwritten without an explicit application merge.
 s=setup();s.file('old','progress.json',{history:[1]});const dest=s.file('new','progress.json',{history:[2]});await assert.rejects(s.api.recoverAppData(s.config,'old','new'),/No file was overwritten/);assert.deepEqual(JSON.parse(new TextDecoder().decode(dest.data)),{history:[2]});
 s.config.merge=(a,b)=>({history:[...a.history,...b.history]});await s.api.recoverAppData(s.config,'old','new');assert.deepEqual(JSON.parse(new TextDecoder().decode(dest.data)),{history:[1,2]});
 // Corruption must prevent success; duplicate originals must not be collapsed silently.
 s=setup();s.file('old','progress.json',{history:[1]});s.corrupt=true;await assert.rejects(s.api.recoverAppData(s.config,'old','new'),/verified/);
 s=setup();s.file('old','progress.json',{});s.file('old','progress.json',{});await assert.rejects(s.api.recoverAppData(s.config,'old','new'),/Several saved files/);assert.equal(s.files.filter(f=>f.token==='new').length,0);
 // Same-account gate executes before copying. Cancel/error never records migration completion.
 s=setup();s.badUser=true;const blocked=s.api.ensure(s.config,'new');await until(()=>s.dialog);await s.dialog.children[2].onclick();await until(()=>s.dialog.children[1].textContent.includes('same Google account'));assert.equal(s.files.length,0);s.dialog.children[4].onclick();await assert.rejects(blocked,/cancelled/);
 s=setup();s.file('old','progress.json',{history:[1]});const ready=s.api.ensure(s.config,'new');await until(()=>s.dialog);await s.dialog.children[2].onclick();await ready;assert.equal(s.files.filter(f=>f.name.endsWith('google-migration-v1.json')).length,1);const calls=s.calls.length;await s.api.ensure(s.config,'new');assert.ok(s.calls.slice(calls).every(c=>c.method==='GET'),'Completed recovery is read only');
 // Nested portfolio media, archive JSON, per-student files and ID references recover together.
 s=setup();const folder=s.file('old','WritingFeedbackTool','', 'root','application/vnd.google-apps.folder'),media=s.file('old','media','',folder.id,'application/vnd.google-apps.folder');
 const image=s.file('old','photo.jpg','image-bytes',media.id,'image/jpeg'),portfolio=s.file('old','portfolio.json',{student:{sessions:[{image:{driveFileId:image.id}}]},unknown:'keep'},folder.id);
 const config={...s.config,fileName:undefined,folderName:'WritingFeedbackTool'};const ids=await s.api.recoverFolder(config,'old','new');
 assert.equal(new TextDecoder().decode(s.files.find(f=>f.id===ids[image.id]).data),'image-bytes');const recovered=JSON.parse(new TextDecoder().decode(s.files.find(f=>f.id===ids[portfolio.id]).data));assert.equal(recovered.student.sessions[0].image.driveFileId,ids[image.id]);assert.equal(recovered.unknown,'keep');assert.deepEqual(s.files.find(f=>f.id===ids[image.id]).parents,[ids[media.id]]);
 const n=s.files.length;await s.api.recoverFolder(config,'old','new');assert.equal(s.files.length,n,'Portfolio retry must not duplicate files');
 console.log('Migration tests passed: raw progress, merge, read-back corruption, duplicates, same-account gate, cancellation, persistent completion, nested portfolio/media IDs, retry without duplicates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
