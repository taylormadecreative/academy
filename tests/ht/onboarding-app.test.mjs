// Browser-local onboarding, with fictional accounts and no production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../tools/ht-campus-tests/package.json',import.meta.url))('playwright');
const base=process.env.HT_CAMPUS_BASE||'http://127.0.0.1:8871',output='/tmp/ht-onboarding-review';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const outside=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();outside.push({url:url.href,method:route.request().method()});return route.abort('blockedbyclient');});
const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
let checks=0;
async function ready(){await page.locator('#htMain').waitFor();await page.waitForFunction(()=>!document.querySelector('.campus-loading'));}
async function visit(route='',role='student',params={}){await page.goto(`${base}/ht/hub/${route?route+'/':''}?${new URLSearchParams({...role?{demo:role}:{},...params})}`,{waitUntil:'domcontentloaded'});await ready();}
async function check(name,run){await run();checks++;console.log(`PASS ${name}`);}
const guide=()=>page.locator('.site-header').getByRole('link',{name:'Guide',exact:true});
const records=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('ht-hub-onboarding:')).map(key=>[key,JSON.parse(localStorage.getItem(key))])));
const progress=async role=>Object.entries(await records()).find(([key])=>key.includes(`:demo:${role}:`))?.[1];
const actions=()=>page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('ht-campus-demo-v2'));return Object.fromEntries(['cohort_members','assignment_attempts','assignment_grades','posts','replies','requests','responses','rsvps','attendance','progress','enrollments','events','assignments','settings'].map(key=>[key,data[key]]));});
try{
 await check('First visit offers a nonblocking guide and dismissing preserves an unfinished support request',async()=>{
  await visit('support');await page.locator('.campus-onboarding-prompt').waitFor();assert.equal(await guide().count(),1);assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByLabel('Subject',{exact:true}).fill('An unfinished support request');
  await page.getByLabel('What do you need help with?').fill('I am drafting my question before sending it.');
  await page.getByRole('button',{name:'Not now',exact:true}).click();await page.locator('.campus-onboarding-prompt').waitFor({state:'detached'});
  assert.equal(await page.getByLabel('Subject',{exact:true}).inputValue(),'An unfinished support request');
  assert.equal((await progress('student')).status,'dismissed');await page.reload();await ready();assert.equal(await page.locator('.campus-onboarding-prompt').count(),0);
 });
 await check('Permanent Guide opens the student guide, with relevant destinations and searchable offices',async()=>{
  await guide().click();await ready();assert.equal(new URL(page.url()).pathname,'/ht/hub/welcome/');
  assert.equal(await page.locator('.campus-onboarding-step').count(),7);assert.equal(await page.locator('[data-onboarding-destination]').filter({hasText:'Staff workspace'}).count(),0);
  const search=page.getByRole('searchbox',{name:'Search the Hub'});await search.fill('MESSAGES');
  assert.equal(await page.locator('[data-onboarding-destination]:visible').count(),1);assert.ok((await page.locator('[data-onboarding-destination]:visible').innerText()).includes('Messages'));
  await search.fill('unfindablexyz');assert.equal(await page.locator('[data-onboarding-no-results]').isVisible(),true);
  await search.fill('career');assert.ok(await page.locator('[data-onboarding-destination]:visible').count());
  const previousSearch=await search.elementHandle();await search.press('Tab');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(input=>!input.isConnected,previousSearch);assert.equal(await search.inputValue(),'career','Search survives an app refresh');
  await page.getByRole('link',{name:'Explore on my own',exact:true}).click();await ready();assert.equal(new URL(page.url()).pathname,'/ht/hub/');assert.equal(await page.locator('.campus-onboarding-prompt').count(),0);await guide().click();await ready();
  await search.fill('');await page.screenshot({path:`${output}/student-guide-desktop.png`,fullPage:true});
  const links=await page.locator('[data-onboarding-destination]').evaluateAll(links=>links.map(a=>a.href));
  for(const url of links){assert.equal(new URL(url).origin,base);assert.equal(new URL(url).searchParams.get('demo'),'student');const response=await context.request.get(url);assert.equal(response.status(),200,url);}
 });
 await check('Guided visits record places explored, retain context, and closing removes the guide URL without losing coursework drafts',async()=>{
  await page.locator('.campus-onboarding-hero [data-onboarding-action="start"]').click();await ready();
  assert.deepEqual((await progress('student')).visited,['courses']);assert.equal(await page.locator('.campus-onboarding-context').count(),1);
  await page.getByRole('link',{name:'Open course',exact:true}).click();await ready();await page.getByRole('link',{name:'View assignment',exact:true}).click();await ready();
  const body=page.getByLabel('Your response',{exact:true});await body.fill('My unfinished assignment remains in place when I close the guide.');
  await page.getByRole('button',{name:'Close guide',exact:true}).click();await ready();assert.equal(await body.inputValue(),'My unfinished assignment remains in place when I close the guide.');
  assert.equal(new URL(page.url()).searchParams.has('guide'),false);assert.equal((await progress('student')).status,'dismissed');
  await page.reload();await ready();assert.equal(await page.locator('.campus-onboarding-context').count(),0);
 });
 await check('Student and staff retain separate progress, and staff get teaching, publishing and support directions',async()=>{
  await visit('welcome','staff');assert.equal(await page.locator('.campus-onboarding-step').count(),7);
  assert.equal(await page.locator('.campus-onboarding-step').filter({hasText:'Find your publishing tools'}).count(),1);
  assert.equal(await page.locator('[data-onboarding-destination]').filter({hasText:'Manage sections & enrollment'}).count(),1);
  assert.equal(await page.locator('.campus-onboarding-hero').getByText('0 of 7 places explored',{exact:true}).count(),1);
  await page.locator('.campus-onboarding-hero [data-onboarding-action="start"]').click();await ready();assert.deepEqual((await progress('staff')).visited,['courses']);
  assert.deepEqual((await progress('student')).visited,['courses']);assert.equal((await progress('student')).status,'dismissed');
  await visit('welcome','staff');await page.screenshot({path:`${output}/staff-guide-desktop.png`,fullPage:true});
 });
 await check('A student can resume, explore the full guide and finish without submitting, enrolling, posting, grading or publishing',async()=>{
  await visit('welcome');const before=await actions();
  await page.locator('.campus-onboarding-hero [data-onboarding-action="start"]').click();await ready();
  for(const id of ['live','community','people','events','support','spaces']){
   assert.equal(new URL(page.url()).searchParams.get('guide'),id);assert.ok((await progress('student')).visited.includes(id));
   await page.locator('.campus-onboarding-context .campus-button').click();await ready();
  }
  assert.equal(new URL(page.url()).pathname,'/ht/hub/welcome/');assert.equal((await progress('student')).visited.length,7);assert.equal((await progress('student')).status,'active');
  await page.getByRole('button',{name:'Finish my guide',exact:true}).click();await ready();assert.equal((await progress('student')).status,'complete');assert.deepEqual(await actions(),before);
  await page.reload();await ready();assert.equal(await page.getByRole('heading',{name:'You know your way around.',exact:true}).count(),1);
  await page.getByRole('button',{name:'Restart guide',exact:true}).click();await ready();assert.deepEqual((await progress('student')).visited,[]);assert.deepEqual((await progress('staff')).visited,['courses']);assert.deepEqual(await actions(),before);
 });
 await check('Closing a guided destination stays closed after reload; mismatched guide IDs cannot record visits or unlock tools',async()=>{
  await visit('courses','student',{guide:'courses'});await page.getByRole('button',{name:'Close guide',exact:true}).click();await ready();assert.equal(new URL(page.url()).searchParams.has('guide'),false);await page.reload();await ready();assert.equal(await page.locator('.campus-onboarding-context').count(),0);
  const before=await progress('student');await visit('community','student',{guide:'insights',role:'staff'});assert.deepEqual(await progress('student'),before);
  await visit('insights','student',{guide:'insights'});assert.equal(await page.locator('.campus-onboarding-context').count(),0);
  await visit('welcome','leadership');assert.equal(await page.locator('.campus-onboarding-step').count(),3);assert.equal(await page.locator('[data-onboarding-destination]').filter({hasText:'Teach your courses'}).count(),0);
 });
 await check('Office pages keep the same demo role when returning to Guide',async()=>{
  await visit('career');assert.equal(await guide().getAttribute('href'),'/ht/hub/welcome/?demo=student');await guide().click();await ready();assert.equal(new URL(page.url()).searchParams.get('demo'),'student');
 });
 for(const width of [1440,390,320])await check(`Student/staff onboarding, contextual guidance and ordinary navigation fit ${width}px`,async()=>{
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const [role,route,params] of [['student','welcome',{}],['staff','welcome',{}],['student','courses',{guide:'courses'}],['staff','staff',{guide:'staff'}],['student','community',{}]]){
   await visit(route,role,params);const box=await page.evaluate(()=>({screen:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));assert.ok(box.body<=box.screen+1&&box.html<=box.screen+1,`${role}/${route}: ${JSON.stringify(box)}`);assert.equal(await guide().isVisible(),true);
   if(width===390&&route==='welcome')await page.screenshot({path:`${output}/${role}-guide-phone.png`,fullPage:true});
   if(width===1440&&route==='courses')await page.screenshot({path:`${output}/course-guidance.png`,fullPage:true});
  }
 });
 await check('Guide supports keyboard search and readonly access without an active campus account',async()=>{
  await visit('welcome');await page.getByRole('link',{name:'Find any page',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('searchbox',{name:'Search the Hub'}).focus();await page.keyboard.type('academic');assert.equal(await page.locator('[data-onboarding-destination]:visible').count(),1);await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement instanceof HTMLAnchorElement));
  const before=await records();await visit('welcome',null);assert.equal(await page.locator('[data-onboarding-action]').count(),0);assert.equal(await page.getByRole('link',{name:'Sign in to your campus workspace',exact:true}).count(),1);assert.equal(await page.locator('[data-onboarding-destination]').filter({hasText:'Staff workspace'}).count(),0);assert.deepEqual(await records(),before);
 });
 await check('No uncaught browser errors or external writes',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(outside.filter(request=>request.method!=='GET'),[]);});
 console.log(`${checks} onboarding browser groups passed. Screenshots: ${output}`);
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
