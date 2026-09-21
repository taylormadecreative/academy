// End-to-end classroom workflow against the real local app; fictional browser-local data only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../tools/ht-campus-tests/package.json',import.meta.url))('playwright');
const base=process.env.HT_CAMPUS_BASE||'http://127.0.0.1:8871';
const output='/tmp/ht-classrooms-review';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const external=[];
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base||['blob:','data:'].includes(u.protocol))return r.continue();external.push(u.href);return r.abort('blockedbyclient');});
const page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let count=0,cohortId,sessionHref;
const title='Integration cohort · Project studio',sessionTitle='Studio 1 · Ideas into practice';
async function settled(){await page.waitForSelector('[data-campus-classrooms]');await page.waitForFunction(()=>!document.querySelector('.campus-loading'));}
async function visit(role='student',params={}){const q=new URLSearchParams({demo:role,...params});await page.goto(`${base}/ht/hub/live/?${q}`,{waitUntil:'domcontentloaded'});await settled();}
async function check(name,fn){await fn();count++;console.log(`PASS ${name}`);}
const localTime=offset=>{const d=new Date(Date.now()+offset*60000);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
try{
 await check('Student sees a classroom directory with no real meeting links in rehearsal mode',async()=>{
  await visit();
  assert.equal(await page.getByRole('heading',{name:'Classrooms & live sessions',exact:true}).count(),1);
  assert.ok(await page.locator('.campus-classroom-card').count()>0);
  assert.equal(await page.getByRole('link',{name:'Manage classrooms',exact:true}).count(),0);
  assert.equal(await page.locator('a[href*="/session/"],a[href*="/replay/"]').count(),0);
  assert.equal(await page.getByRole('heading',{name:'Campus live events',exact:true}).count(),1);
  await page.screenshot({path:`${output}/directory-desktop.png`,fullPage:true});
 });
 await check('Instructor creates a cohort and adds an existing campus member',async()=>{
  await visit('staff',{manage:'1'});
  await page.getByLabel('Classroom name',{exact:true}).fill(title);
  await page.getByLabel('What this cohort will work on',{exact:true}).fill('A focused studio for one cohort, with its own class sessions and materials.');
  await page.getByRole('button',{name:'Save classroom',exact:true}).click();
  const choice=page.locator('[data-classroom-action="select-cohort"]').filter({hasText:title});await choice.waitFor();
  cohortId=await choice.getAttribute('data-id');assert.ok(cohortId);
  await choice.click();await page.getByRole('tab',{name:'Enrollment',exact:true}).click();
  await page.getByRole('combobox',{name:/Add a campus member/}).selectOption({label:'Jordan R. · Student'});
  await page.getByRole('button',{name:'Add to classroom',exact:true}).click();
  await page.locator('.campus-roster .campus-row').filter({hasText:'Jordan R.'}).getByRole('button',{name:'Remove access',exact:true}).waitFor();
 });
 await check('Invalid scheduling preserves the draft; a valid session creates its own entry',async()=>{
  await page.getByRole('tab',{name:'Sessions',exact:true}).click();
  await page.getByLabel('Session title',{exact:true}).fill(sessionTitle);
  await page.getByLabel('Agenda and preparation',{exact:true}).fill('Bring one idea. We will develop it together and review each project.');
  await page.getByLabel('Starts at',{exact:true}).fill(localTime(1440));
  await page.getByLabel('Ends at',{exact:true}).fill(localTime(1400));
  await page.getByRole('button',{name:'Save session',exact:true}).click();
  await page.getByText('The session must end after it starts.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Session title',{exact:true}).inputValue(),sessionTitle);
  await page.getByRole('tab',{name:'Classrooms',exact:true}).click();
  await page.getByRole('tab',{name:'Sessions',exact:true}).click();
  assert.equal(await page.getByLabel('Session title',{exact:true}).inputValue(),sessionTitle);
  await page.locator('[data-classroom-action="select-cohort"]').filter({hasText:'AI Literacy · First-Year Scholars'}).click();
  assert.equal(await page.getByLabel('Session title',{exact:true}).inputValue(),'','A different cohort must not inherit this draft.');
  await page.locator(`[data-classroom-action="select-cohort"][data-id="${cohortId}"]`).click();
  assert.equal(await page.getByLabel('Session title',{exact:true}).inputValue(),sessionTitle,'Returning restores only this cohort’s draft.');
  await page.getByLabel('Ends at',{exact:true}).fill(localTime(1500));
  await page.getByRole('button',{name:'Save session',exact:true}).click();
  const card=page.locator('.campus-session-card').filter({hasText:sessionTitle});await card.waitFor();
  assert.equal(await page.getByLabel('Session title',{exact:true}).inputValue(),'');
  await page.waitForFunction(()=>document.activeElement?.closest('form')?.dataset.classroomForm==='session');
  await page.screenshot({path:`${output}/instructor-scheduling-desktop.png`,fullPage:true});
 });
 await check('Enrolled student sees the new cohort and records session-specific practice attendance',async()=>{
  await visit('student',{cohort:cohortId});
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.locator('.campus-roster').count(),0);
  const card=page.locator('.campus-session-card').filter({hasText:sessionTitle});
  sessionHref=await card.getByRole('link',{name:'Open rehearsal',exact:false}).getAttribute('href');
  await card.getByRole('link',{name:'Open rehearsal',exact:false}).click();await settled();
  await page.getByRole('button',{name:'Record a practice join',exact:true}).click();
  await page.getByRole('button',{name:'Leave rehearsal',exact:true}).waitFor();
  assert.ok((await page.locator('.campus-rehearsal-stage').innerText()).includes('1 practice join'));
  assert.equal(await page.locator('video,iframe').count(),0);
  await page.getByRole('button',{name:'Leave rehearsal',exact:true}).click();
  await page.getByRole('button',{name:'Record a practice join',exact:true}).waitFor();
  await page.reload();await settled();
  assert.ok((await page.locator('.campus-rehearsal-stage').innerText()).includes('1 practice join'));
  await page.screenshot({path:`${output}/student-rehearsal-desktop.png`,fullPage:true});
 });
 await check('Leadership cannot open the private cohort or its roster',async()=>{
  await visit('leadership',{cohort:cohortId});
  await page.getByRole('heading',{name:'This classroom is not available',exact:true}).waitFor();
  assert.equal(await page.getByText(title,{exact:true}).count(),0);
  await visit('leadership',{manage:'1'});
  await page.getByRole('heading',{name:'Instructor access required',exact:true}).waitFor();
  assert.equal(await page.locator('form').count(),0);
 });
 for(const width of [1440,390,320])await check(`Classroom directory, cohort, instructor tools and rehearsal fit ${width}px`,async()=>{
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const [role,params,key] of [['student',{},'directory'],['student',{cohort:cohortId},'cohort'],['staff',{manage:'1',cohort:cohortId},'manage'],['student',Object.fromEntries(new URL(sessionHref,base).searchParams),'rehearsal']]){
   await visit(role,params);
   if(key==='manage')await page.getByRole('tab',{name:'Sessions',exact:true}).click();
   const m=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(m.document<=m.viewport+1&&m.body<=m.viewport+1,`${key}: ${JSON.stringify(m)}`);
   assert.equal(await page.locator('h1').count(),1);
   if(width===390)await page.screenshot({path:`${output}/${key}-phone.png`,fullPage:true});
  }
 });
 await check('Removing classroom access blocks old cohort and session links',async()=>{
  await visit('staff',{manage:'1',cohort:cohortId});
  await page.getByRole('tab',{name:'Enrollment',exact:true}).click();
  await page.locator('.campus-roster .campus-row').filter({hasText:'Jordan R.'}).getByRole('button',{name:'Remove access',exact:true}).click();
  await page.getByRole('button',{name:'Restore access',exact:true}).waitFor();
  await visit('student',{cohort:cohortId});
  await page.getByRole('heading',{name:'This classroom is not available',exact:true}).waitFor();
  await page.goto(new URL(sessionHref,base).href);await settled();
  await page.getByRole('heading',{name:'This session is not available',exact:true}).waitFor();
 });
 await check('Explicit rehearsal URLs cannot accidentally start the real meeting engine',async()=>{
  await page.goto(`${base}/ht/hub/session/?room=htc-${'a'.repeat(24)}&demo=student`);await settled();
  assert.equal(new URL(page.url()).pathname,'/ht/hub/live/');
  assert.equal(await page.locator('video,iframe').count(),0);
 });
 await check('No uncaught browser errors or production classroom calls',async()=>{
  assert.deepEqual(errors,[]);
  assert.deepEqual(external.filter(u=>/supabase|ea-rtk|realtime|cloudflare/.test(u)),[]);
 });
 console.log(`${count} classroom integration groups passed. Screenshots: ${output}`);
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
