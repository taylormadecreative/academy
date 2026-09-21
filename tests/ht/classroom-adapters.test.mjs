// Real room/replay adapters, local shells, fully mocked auth/DB/meeting engine.
// No production data or conferencing requests. Run after node ht/build.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../tools/ht-campus-tests/package.json', import.meta.url))('playwright');
const base = process.env.HT_CAMPUS_BASE || 'http://127.0.0.1:8871';
const stub = (await fs.readFile(new URL('./harness/stub-supabase.js', import.meta.url), 'utf8')).replace("if (name === 'ea_room_state')", "if (name === 'ht_classroom_access') return { data: window.__db.access, error: window.__db.accessError || null };\n    if (name === 'ea_room_state')");
const engine = await fs.readFile(new URL('./harness/stub-room-v2.js', import.meta.url), 'utf8');
const slug = 'htc-' + 'a'.repeat(24), secondSlug = 'htc-' + 'b'.repeat(24);
const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const seed = {k: 'AbC123_-xyzXYZ0987ab-_', t: Date.now()};
const session = {user:{id:'u1',email:'admin@example.test'},access_token:'fake-token'};
function fixture(options={}) {
 const state = {id:roomId,slug,title:'Cohort seminar',host_name:'Dr. Gray',signed_in:true,is_host:true,can_join:true,is_live:false,bad_link:false,recording_url:null,...options.state};
 return {session,admin:true,state,room:{...state,host_emails:['admin@example.test'],link_key:seed.k,max_participants:50},access:{managed:true,can_join:true,is_host:true,room_id:state.id},replays:[],members:[],profiles:[],...options};
}
const browser = await chromium.launch({channel:'chrome',headless:true});
const failures=[]; let count=0;
async function check(name,fn){try{await fn();count++;console.log('PASS '+name);}catch(error){failures.push(name+': '+error.message);console.error('FAIL '+name+': '+error.stack);}}
async function open(db=fixture(),path=`/ht/hub/session/?room=${slug}&k=${seed.k}`) {
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(7000);const rec=[];const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({db,seed})=>{window.__db=db;window.__calls=[];localStorage.setItem('ht-room-key',JSON.stringify(seed));},{db,seed});
 await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='esm.sh')return route.fulfill({status:200,contentType:'application/javascript',body:stub});
   if(u.pathname==='/js/rtk-room-v2.js')return route.fulfill({status:200,contentType:'application/javascript',body:engine});
   if(u.pathname.endsWith('/ea-rtk-record')) {rec.push(JSON.parse(route.request().postData()||'{}'));return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"stopped":true}'});}
   if(u.origin===new URL(base).origin)return route.continue();
   return route.abort('blockedbyclient');
 });
 await page.goto(base+path,{waitUntil:'domcontentloaded'});
 if(path.includes('/replay/'))await page.waitForFunction(()=>document.querySelector('#idle b')?.textContent!=='Finding the replay…'&&document.querySelector('#idle b'));
 else await page.waitForFunction(()=>!document.querySelector('.ht-room-loading')||/could not/.test(document.querySelector('.ht-room-loading').textContent));
 return {page,context,rec,errors};
}
const calls = p => p.evaluate(()=>window.__calls||[]);
try {
 await check('Managed host keeps unique session links and hides legacy controls',async()=>{
  const {page,context,errors}=await open();
  try{
   await page.locator('#rmStart').waitFor();
   assert.equal(await page.locator('#rmLink').inputValue(),base+`/ht/hub/session/?room=${slug}`);
   assert.equal(await page.locator('#rmNew,#rmTitle,#rmHost,#rmMax,#rmHosts,#rmNextTitle,#rmNextAt').count(),0);
   const log=await calls(page);const rpc=log.filter(x=>x[0]==='rpc');
   assert.equal(rpc[0][1],'ht_classroom_access');
   assert(rpc.some(x=>x[1]==='ea_room_state'&&x[2].p_slug===slug&&x[2].p_key===null));
   assert(!rpc.some(x=>x[1]==='ea_is_admin'));
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ht-room-key'))),seed);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await check('Managed host engine and recording stay scoped to the scheduled room',async()=>{
  const {page,context,rec}=await open();
  try{
   await page.locator('#rmStart').click();await page.waitForFunction(()=>!!window.__mount);
   const target=await page.evaluate(()=>window.__mount.target);
   assert.equal(target.slug,slug);assert.equal(target.id,roomId);assert.equal(target.key,null);
   await page.evaluate(()=>window.__room.state('joined'));
   await page.waitForFunction(()=>window.__rec===true);
   assert(rec.some(x=>x.room===slug&&x.action==='start'));
   assert(rec.every(x=>x.room===slug));
  }finally{await context.close();}
 });
 await check('Two simultaneous student sessions never mount the shared room or legacy key',async()=>{
  const pages=[];
  try{
   for(const [s,id] of [[slug,roomId],[secondSlug,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']]){
    const db=fixture({state:{id,slug:s,title:'Seminar',host_name:'Instructor',signed_in:true,is_host:true,can_join:true,is_live:false},access:{managed:true,can_join:true,is_host:false,room_id:id}});
    const x=await open(db,`/ht/hub/session/?room=${s}`);pages.push(x);await x.page.waitForFunction(()=>!!window.__mount);
    const m=await x.page.evaluate(()=>window.__mount);assert.equal(m.mode,'waiting');assert.equal(m.target.slug,s);assert.equal(m.target.id,id);assert.equal(m.target.key,null);
   }
  }finally{await Promise.all(pages.map(x=>x.context.close()));}
 });
 await check('Denied, unavailable and mismatched membership cannot use Academy admin or keys',async()=>{
  for(const patch of [{access:{managed:true,can_join:false,is_host:false,room_id:null}},{access:null},{accessError:{message:'RPC unavailable'}},{access:{managed:true,can_join:true,is_host:true,room_id:'different'}}]){
   const {page,context}=await open(fixture(patch));
   try{
    assert.equal(await page.locator('#rmStart').count(),0);assert.equal(await page.evaluate(()=>!!window.__mount),false);
    const log=await calls(page);assert(!log.some(x=>x[0]==='rpc'&&x[1]==='ea_is_admin'));
    assert(log.filter(x=>x[0]==='rpc'&&x[1]==='ea_room_state').every(x=>x[2].p_slug===slug&&x[2].p_key===null));
    assert.match(await page.locator('.ht-room-ctl').innerText(),/not available|could not|try again/i);
   }finally{await context.close();}
  }
 });
 await check('Signed-out session and replay retain the exact destination through sign-in',async()=>{
  for(const kind of ['session','replay']){
   const {page,context}=await open(fixture({session:null}),`/ht/hub/${kind}/?room=${slug}`);
   try{
    const links=await page.locator('a[href^="/login/"]').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
    assert(links.length>=2);assert(links.every(x=>new URL(x,'https://test').searchParams.get('next')===`/ht/hub/${kind}/?room=${slug}`));
    assert(!(await calls(page)).some(x=>x[1]==='ea_room_state'));
   }finally{await context.close();}
  }
 });
 await check('Scoped replay reads only its room key and scoped replay tables',async()=>{
  const {page,context}=await open(fixture(),`/ht/hub/replay/?room=${slug}`);
  try{
   await page.waitForFunction(()=>window.__calls.some(x=>x[0]==='from'&&x[1]==='ea_opil_materials'));
   const log=await calls(page);
   for(const table of ['ea_class_events','ea_class_summaries','ea_class_transcripts','ea_opil_materials'])assert(log.some(x=>x[0]==='from'&&x[1]===table&&x[3].some(f=>f[0]==='room_key'&&f[1]==='room:'+roomId)),table);
   assert(log.some(x=>x[1]==='ea_room_replays'&&x[3].some(f=>f[0]==='room_id'&&f[1]===roomId)));
  }finally{await context.close();}
 });
 await check('Missing and malformed managed routes fail without shared-room requests',async()=>{
  for(const query of ['', '?room=ht', '?room=htc-invalid']){
   const {page,context}=await open(fixture(),'/ht/hub/session/'+query);
   try{assert.equal(await page.evaluate(()=>!!window.__mount),false);assert(!(await calls(page)).some(x=>x[1]==='ea_room_state'));}
   finally{await context.close();}
  }
 });
}finally{await browser.close();}
console.log(`${count} passed, ${failures.length} failed`);
if(failures.length)process.exitCode=1;
