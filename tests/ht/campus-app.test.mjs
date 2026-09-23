// Real HT Hub UI + explicit demo store only. No production accounts or writes.
// Run with the local repository HTTP server on HT_CAMPUS_BASE (default :8871).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const playwright=createRequire(new URL('../../tools/ht-campus-tests/package.json',import.meta.url))('playwright');
const base=process.env.HT_CAMPUS_BASE || 'http://127.0.0.1:8871';
const output=process.env.HT_CAMPUS_SCREENSHOTS || '/tmp/ht-campus-review';
await fs.mkdir(output,{recursive:true});
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const blocked=[];
await context.route('**/*', route => {
 const url=new URL(route.request().url());
 if(url.origin===new URL(base).origin || ['data:','blob:'].includes(url.protocol))return route.continue();
 blocked.push(url.origin);return route.abort('blockedbyclient');
});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const results=[];
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log(`PASS ${name}`);}catch(error){results.push({name,ok:false,error:error.message});console.log(`FAIL ${name}: ${error.message}`);try{await page.screenshot({path:path.join(output,`failure-${results.length}.png`),fullPage:true});}catch{}}}
async function settled(target=page){await target.waitForSelector('#htMain');await target.waitForFunction(()=>!document.querySelector('.campus-loading'));}
async function visit(route='',role='student',target=page){await target.goto(`${base}/ht/hub/${route?`${route}/`:''}${role?`?demo=${role}`:''}`,{waitUntil:'domcontentloaded'});await settled(target);}
const subject=`Demo request ${Date.now()}`;
const reply='Your career adviser can review the portfolio during office hours.';
try {
 await check('Primary navigation stays focused and secondary campus destinations are grouped under More',async()=>{
  await visit('');
  for(const label of ['Today','Learning','Community','Messages','Campus'])assert.equal(await page.locator('.campus-nav-inner').getByText(label,{exact:true}).count(),1,label);
  const more=page.locator('.campus-nav-more');
  assert.equal(await more.locator('summary').getAttribute('aria-current'),null);
  await more.locator('summary').click();
  for(const label of ['Events','Classrooms','Academic calendar'])assert.equal(await more.getByText(label,{exact:true}).count(),1,label);
  assert.equal(new URL(await more.getByRole('link',{name:'Academic calendar'}).getAttribute('href'),base).pathname,'/ht/hub/calendar/');
  await visit('events');
  assert.equal(await page.locator('.campus-nav-more > summary').getAttribute('aria-current'),'page');
 });
 await check('Campus directory cards carry a photo and an icon; all thirteen destination pages show their own photography',async()=>{
  await visit('spaces');
  const directory=page.locator('.campus-spaces-directory');
  assert.equal(await directory.locator('.campus-office-card').count(),13);
  assert.equal(await directory.locator('.campus-office-card .campus-office-photo img').count(),13,'Every campus-space card leads with its own photo.');
  const srcs=await directory.locator('.campus-office-photo img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
  assert.equal(new Set(srcs).size,13,'No photo repeats across the directory.');
  assert.ok(!srcs.some(src=>src.includes('athletics')),'The Rams-mark athletics photo stays off non-athletics spaces.');
  assert.equal(await directory.locator('.campus-office-icon svg').count(),13,'Every campus-space card has a small icon.');
  const keys=await page.evaluate(()=>window.HT.order.slice());
  for(const key of keys){
   await visit(key);
   const selector=['events','live','learn','community'].includes(key)?'.campus-space-feature img':'.intro .art img';
   const image=page.locator(selector).first();
   await image.waitFor({state:'visible'});
   const loaded=await image.evaluate(node=>({src:node.getAttribute('src'),complete:node.complete,width:node.naturalWidth}));
   assert.ok(loaded.src,`${key} has a destination image source.`);
   assert.ok(loaded.complete&&loaded.width>0,`${key} destination image loads: ${JSON.stringify(loaded)}`);
  }
  await visit('spaces');
 });
 await check('The guided tour walks every stop in order across roles and keeps the role selector available',async()=>{
  await visit('spaces','leadership');
  const journey=await page.evaluate(()=>window.HT.leadershipWalkthrough.map(step=>({key:step.key,role:step.role||'leadership',href:window.HTTour.href(step)})));
  assert.ok(journey.length>=17,'tour covers the new work and all spaces');
  for(const key of await page.evaluate(()=>window.HT.order.slice()))assert.ok(journey.some(step=>step.key===key),`${key} is on the tour`);
  for(const key of ['success','insights','trust'])assert.ok(journey.some(step=>step.key===key),`${key} is on the tour`);
  assert.ok(journey.some(step=>step.key==='courses'&&step.role==='staff'),'grading stop views as the instructor');
  for(let index=0;index<journey.length;index++){
   const step=journey[index];
   await page.goto(new URL(step.href,base).href,{waitUntil:'domcontentloaded'});await settled();
   const tour=page.locator('.campus-leadership-tour');
   assert.equal(await tour.count(),1,`${step.key} (${step.role}) has one tour panel.`);
   assert.match(await tour.innerText(),new RegExp(`Stop\\s+${index+1}\\s+of\\s+${journey.length}`),`${step.key} shows its tour position.`);
   const next=await tour.locator('.campus-leadership-next').getAttribute('href');
   if(index<journey.length-1){const u=new URL(next,base);assert.equal(u.pathname+u.search+u.hash,journey[index+1].href,`${step.key} links to the next stop.`);}
   assert.equal(await page.locator('.site-header .nav-cta a[href^="/login/"]').count(),0,`${step.key} does not offer sign-in inside the demo header.`);
   const selector=page.locator('#campusDemoRole');
   assert.equal(await selector.count(),1,`${step.key} keeps its demo role switcher.`);
   assert.equal(await selector.evaluate(node=>node.value),step.role);
   if(step.role==='leadership')assert.equal(await page.locator('.campus-account').getAttribute('aria-label'),'Avery W., sample account',`${step.key} shows the leadership persona.`);
  }
  await visit('president','leadership');
  await page.locator('#campusDemoRole').selectOption('staff');
  await settled();
  assert.equal(new URL(page.url()).searchParams.get('demo'),'staff','The role switcher preserves its route and changes the selected demo role.');
 });
 await check('Student creates a support request in explicit demo mode',async()=>{
  await visit('support');
  await page.getByRole('combobox',{name:'Topic',exact:true}).selectOption('Career');
  await page.getByLabel('Subject',{exact:true}).fill(subject);
  await page.getByLabel('What do you need help with?').fill('I would like to connect my learning project with a portfolio.');
  await page.getByRole('button',{name:'Send request',exact:true}).click();
  await page.getByRole('button').filter({hasText:subject}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('demo'),'student');
  assert.equal(await page.locator('.campus-workspace-links').count(),0);
 });
 await check('Staff replies, assigns an owner, and resolves the same demo request',async()=>{
  await visit('support','staff');
  await page.getByRole('button').filter({hasText:subject}).click();
  await page.getByLabel('Reply',{exact:true}).fill(reply);
  await page.getByRole('button',{name:'Send reply',exact:true}).click();
  await page.getByText(reply,{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Staff owner',exact:true}).selectOption({label:'Morgan T.'});
  await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('resolved');
  await page.getByRole('button',{name:'Update request',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-form="request-status"] select[name="status"]')?.value==='resolved' && !document.querySelector('[data-form="request-status"] button[type="submit"]')?.disabled);
  assert.equal(await page.locator('.campus-workspace-links a').count(),3,'Staff, Student success, Insights');
 });
 await check('Student sees the staff response and resolution after changing roles',async()=>{
  await visit('support','student');
  await page.locator('[data-request-filter]').selectOption('resolved');
  await page.getByRole('button').filter({hasText:subject}).click();
  await page.getByText(reply,{exact:true}).waitFor();
  assert.equal(await page.locator('[data-form="request-status"]').count(),0);
  assert.equal(await page.locator('[data-form="request-reply"]').count(),0);
  assert.equal(await page.getByText('This request is resolved. Start a new request if you need more help.',{exact:true}).count(),1);
  await page.screenshot({path:path.join(output,'student-support-desktop.png'),fullPage:true});
 });
 await check('Community likes preserve drafts; posting clears only the submitted form',async()=>{
  await visit('community');
  const post=page.locator('[data-campus-post]').first();
  const postId=await post.locator('[data-campus-action="like"]').getAttribute('data-post-id');
  await post.locator('summary').click();
  const replyForm=page.locator(`[data-campus-command="reply"][data-post-id="${postId}"]`);
  const replyDraft='I am still writing this reply. Keep it when I like another post.';
  const postDraft='Demo community post: I completed my first learning project.';
  await replyForm.locator('textarea').fill(replyDraft);
  await page.getByLabel('Share with your campus',{exact:true}).fill(postDraft);
  await page.locator(`[data-campus-action="like"][data-post-id="${postId}"]`).click();
  await page.waitForFunction(id=>document.querySelector(`[data-campus-action="like"][data-post-id="${id}"]`)?.getAttribute('aria-pressed')==='true',postId);
  assert.equal(await page.getByLabel('Share with your campus',{exact:true}).inputValue(),postDraft);
  assert.equal(await replyForm.locator('textarea').inputValue(),replyDraft);
  await page.getByRole('button',{name:'Share post',exact:true}).click();
  await page.locator('[data-campus-post]').filter({hasText:postDraft}).waitFor();
  assert.equal(await page.getByLabel('Share with your campus',{exact:true}).inputValue(),'');
  assert.equal(await replyForm.locator('textarea').inputValue(),replyDraft);
 });
 await check('Role navigation and insights guards protect individual student views',async()=>{
  await visit('insights','student');
  assert.equal(await page.locator('.campus-metric').count(),0);
  assert.equal(await page.getByRole('button',{name:'Export CSV',exact:true}).count(),0);
  assert.equal(await page.locator('.campus-workspace-links').count(),0);
  await visit('insights','leadership');
  assert.equal(await page.locator('.campus-metric').count(),0,'Leadership sees the campus-scale sample, not the demo record counts.');
  assert.equal(await page.locator('.lead-kpi').count(),4);
  assert.equal(await page.locator('.campus-workspace-links a').count(),2,'Student success, Insights');
  assert.equal(await page.getByText(subject,{exact:true}).count(),0);
  await visit('insights','staff');
  await page.locator('.lead-live-totals summary').click();
  assert.equal(await page.locator('.campus-metric').count(),9);
  await page.getByRole('heading',{name:'Sample campus overview',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'leadership-insights-desktop.png'),fullPage:true});
  await visit('staff','leadership');
  assert.equal(await page.locator('form').count(),0);
  await visit('staff','staff');
  assert.equal(await page.getByRole('tab').count(),5);
 });
 await check('Staff tabs retain unsaved drafts and Cancel editing discards only that form',async()=>{
  await visit('staff','staff');
  await page.getByLabel('Title',{exact:true}).fill('Unsent staff announcement');
  await page.getByLabel('Message',{exact:true}).fill('This draft must survive a visit to the Events tab.');
  await page.getByRole('tab',{name:'Events',exact:true}).click();
  await page.getByRole('tab',{name:'Announcements',exact:true}).click();
  assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Unsent staff announcement');
  assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),'This draft must survive a visit to the Events tab.');
  const edit=page.locator('[data-action="edit-announcement"]').first();
  const id=await edit.getAttribute('data-id');
  await edit.click();
  const originalTitle=await page.getByLabel('Title',{exact:true}).inputValue();
  await page.getByLabel('Title',{exact:true}).fill('Discard this edit');
  await page.getByRole('button',{name:'Cancel editing',exact:true}).click();
  assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Unsent staff announcement');
  await page.locator(`[data-action="edit-announcement"][data-id="${id}"]`).click();
  assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),originalTitle);
 });
 await check('Brand home link keeps the explicit demo role',async()=>{
  await visit('learn','staff');
  const brand=page.locator('.site-header a.brand');
  const destination=new URL(await brand.getAttribute('href'),base);
  assert.equal(destination.pathname,'/ht/hub/');
  assert.equal(destination.searchParams.get('demo'),'staff');
  await brand.click();await settled();
  assert.equal(new URL(page.url()).pathname,'/ht/hub/');
  assert.equal(new URL(page.url()).searchParams.get('demo'),'staff');
 });
 const routes=[['','student'],['learn','student'],['events','student'],['community','student'],['people','student'],['spaces','student'],['live','student'],['support','student'],['staff','staff'],['insights','leadership']];
 for(const width of [1440,390,320]) {
  await check(`Ten real routes fit the ${width}px viewport`,async()=>{
   await page.setViewportSize({width,height:width===1440?1000:844});
   const overflows=[];
   for(const [route,role] of routes){
    await visit(route,role);
    const measurement=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth,body:document.body.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const box=el.getBoundingClientRect();return box.width>0&&(box.right>innerWidth+1||box.left< -1)&&getComputedStyle(el).position!=='absolute';}).slice(0,8).map(el=>({tag:el.tagName,class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))}));
    if(measurement.width>measurement.viewport+1||measurement.body>measurement.viewport+1)overflows.push({route:route||'home',...measurement});
    if((width===1440&&['','staff'].includes(route)) || (width===390&&['learn','events','support','insights'].includes(route)) || (width===320&&route===''))await page.screenshot({path:path.join(output,`${role}-${route||'home'}-${width}.png`),fullPage:true});
   }
   assert.deepEqual(overflows,[],'Document horizontal overflow: '+JSON.stringify(overflows));
  });
 }
 await check('Initial delayed load cannot revive a signed-out staff session',async()=>{
  const authPage=await context.newPage();authPage.setDefaultTimeout(10000);
  const fixture={mode:'live',user:{id:'delayed-staff'},member:{user_id:'delayed-staff',display_name:'Demo Staff',role:'staff'},announcements:[],events:[],rsvps:[],attendance:[],courses:[],modules:[],enrollments:[],progress:[],submissions:[],requests:[],responses:[],posts:[],replies:[],likes:[],members:[],messages:[],notifications:[],settings:{},metrics:null};
  const stub=`export function createCampusStore(){const listeners=new Set();const stale=${JSON.stringify(fixture)};let first=true,current=stale;window.__campusAuthTest={subscribers:0,loads:0};return {load(){window.__campusAuthTest.loads++;if(first){first=false;return new Promise(resolve=>{window.__campusAuthTest.finish=()=>resolve(stale);window.__campusAuthTest.signout=()=>{current={...stale,mode:'guest',user:null,member:null};listeners.forEach(fn=>fn({reason:'auth',event:'SIGNED_OUT',user_id:null}));};});}return Promise.resolve(current);},subscribe(fn){listeners.add(fn);window.__campusAuthTest.subscribers=listeners.size;return()=>listeners.delete(fn);},command(){throw Error('Commands are disabled in the auth regression fixture.');},destroy(){listeners.clear();}}}`;
  await authPage.route('**/campus-store.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:stub}));
  try {
   await authPage.goto(`${base}/ht/hub/staff/`,{waitUntil:'domcontentloaded'});
   await authPage.waitForFunction(()=>typeof window.__campusAuthTest?.finish==='function');
   assert.ok(await authPage.evaluate(()=>__campusAuthTest.subscribers)>0,'Subscribe before waiting for the initial load.');
   await authPage.evaluate(()=>{__campusAuthTest.signout();__campusAuthTest.finish();});
   await authPage.waitForFunction(()=>window.__campusAuthTest.loads>=2 && !document.querySelector('.campus-loading'));
   assert.equal(await authPage.getByRole('tab').count(),0,'A signed-out session cannot regain staff forms from a stale response.');
   assert.equal(await authPage.locator('.campus-workspace-links').count(),0);
   assert.equal(await authPage.getByText('Explore the HT Hub',{exact:true}).count(),1);
  } finally {await authPage.close();}
 });
 await check('A restored browser snapshot reopens its store and interactive controls',async()=>{
  await visit('community');
  const navigation=page.waitForEvent('domcontentloaded');
  await page.evaluate(()=>{
   window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
  });
  await navigation;await settled();
  const button=page.locator('[data-campus-action="like"]').first();
  const id=await button.getAttribute('data-post-id');
  const before=await button.getAttribute('aria-pressed');
  await button.click();
  await page.waitForFunction(({id,before})=>document.querySelector(`[data-campus-action="like"][data-post-id="${id}"]`)?.getAttribute('aria-pressed')!==before,{id,before});
 });
 await check('No uncaught application errors',async()=>assert.deepEqual(errors,[]));
} finally {
 await fs.writeFile(path.join(output,'integration-results.json'),JSON.stringify({base,results,pageErrors:errors,blockedExternalOrigins:[...new Set(blocked)]},null,2));
 await browser.close();
}
const failed=results.filter(result=>!result.ok);
console.log(`${results.length-failed.length}/${results.length} integration groups passed. Screenshots: ${output}`);
if(failed.length)process.exitCode=1;
