// Native course workflow with fictional local data; no production accounts or services.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../tools/ht-campus-tests/package.json',import.meta.url))('playwright');
const base=process.env.HT_CAMPUS_BASE||'http://127.0.0.1:8871',output='/tmp/ht-academics-review';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const external=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();external.push(url.href);return route.abort('blockedbyclient');});
const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
const cohort='a0000000-0000-4000-8000-000000000001',other='a0000000-0000-4000-8000-000000000002',student='10000000-0000-4000-8000-000000000001';
const seeded='d0000000-0000-4000-8000-000000000001';
let checks=0,assignment;
const title='Coursework demonstration · Evaluate a campus resource',body='I compared two campus resources, checked their source dates, and explained which would help a first-year student plan the next step.';
async function ready(){await page.locator('#htMain').waitFor();await page.waitForFunction(()=>!document.querySelector('.campus-loading'));}
async function visit(role='student',params={}){await page.goto(`${base}/ht/hub/courses/?${new URLSearchParams({demo:role,...params})}`,{waitUntil:'domcontentloaded'});await ready();}
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
const formWith=name=>page.locator('form[data-academic-form]').filter({has:page.locator(`[name="${name}"]`)});
const localTime=minutes=>{const d=new Date(Date.now()+minutes*60000),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')));
// A second store represents another writer without replacing application handlers.
const command=(name,payload)=>page.evaluate(async({name,payload})=>{const {createCampusStore}=await import('/ht/hub/campus-store.js');const store=createCampusStore({demoRole:'staff'});try{return await store.command(name,payload);}finally{store.destroy();}},{name,payload});
try{
 await check('Learning opens native courses and preserves the separate pathway experience',async()=>{
  await visit();
  assert.equal(await page.getByRole('heading',{name:'My courses',exact:true}).count(),1);
  assert.ok(await page.getByText('AI Literacy · First-Year Scholars',{exact:true}).count());
  assert.equal(await page.getByText('Digital Storytelling · Creative Lab',{exact:true}).count(),0);
  assert.equal(await page.locator('.campus-nav-inner').getByRole('link',{name:'Learning',exact:true}).getAttribute('href'),'/ht/hub/courses/?demo=student');
  assert.equal(await page.getByRole('navigation',{name:'Learning destinations'}).getByRole('link',{name:'Learning pathways',exact:true}).getAttribute('href'),'/ht/hub/learn/?demo=student');
  await page.screenshot({path:`${output}/courses-desktop.png`,fullPage:true});
 });
 await check('Instructor publishes a section assignment with points and dates',async()=>{
  await visit('staff',{cohort,tab:'assignments',new:'1'});
  const form=formWith('points_possible');await form.waitFor();
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="instructions"]').fill('Compare two campus resources. Explain your sources, your decision, and the next step a student should take.');
  await form.locator('[name="points_possible"]').fill('40');
  await form.locator('[name="opens_at"]').fill(localTime(-60));await form.locator('[name="due_at"]').fill(localTime(1440));await form.locator('[name="closes_at"]').fill(localTime(2880));
  await form.locator('[name="max_attempts"]').fill('2');await form.locator('[name="status"]').selectOption('published');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(t=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignments.some(a=>a.title===t),title);
  assignment=(await data()).assignments.find(a=>a.title===title).id;
  assert.ok(assignment);assert.equal((await data()).assignments.find(a=>a.id===assignment).cohort_id,cohort);
 });
 await check('Student submits work and receives a saved attempt without a fabricated grade',async()=>{
  await visit('student',{cohort,tab:'assignments',assignment});
  const form=formWith('body');await form.locator('[name="body"]').fill(body);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_attempts.some(a=>a.assignment_id===id),assignment);
  const saved=(await data()).assignment_attempts.filter(a=>a.assignment_id===assignment);assert.equal(saved.length,1);assert.equal(saved[0].body,body);assert.equal(saved[0].attempt_no,1);
  await visit('student',{cohort,tab:'grades'});assert.ok(await page.getByText(title,{exact:true}).count());
  assert.equal((await data()).assignment_grades.filter(g=>g.assignment_id===assignment).length,0);
  await page.screenshot({path:`${output}/student-pending-grades.png`,fullPage:true});
 });
 await check('Draft grading remains private until the instructor publishes it',async()=>{
  await visit('staff',{cohort,tab:'assignments',assignment,student});
  const form=formWith('score');await form.locator('[name="score"]').fill('34');await form.locator('[name="feedback"]').fill('Private grading draft: add a clearer explanation of how you checked the dates.');
  await form.locator('[name="status"]').selectOption('draft');await form.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_grades.some(g=>g.assignment_id===id&&g.status==='draft'),assignment);
  await visit('student',{cohort,tab:'grades'});assert.equal(await page.getByText(/Private grading draft/).count(),0);
  await visit('staff',{cohort,tab:'assignments',assignment,student});
  const review=formWith('score');await review.locator('[name="feedback"]').fill('Your comparison is clear and your sources are relevant. Explain how you checked the dates in your next revision.');await review.locator('[name="status"]').selectOption('published');await review.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_grades.some(g=>g.assignment_id===id&&g.status==='published'),assignment);
  await page.screenshot({path:`${output}/instructor-review.png`,fullPage:true});
  await visit('student',{cohort,tab:'grades'});
  assert.ok(await page.getByText(/Your comparison is clear/).count());assert.equal(await page.getByText(/Private grading draft/).count(),0);
  assert.ok((await page.locator('#htMain').innerText()).includes('34'));
  assert.ok((await data()).notifications.some(n=>n.user_id===student&&n.href.includes('/courses/')&&n.href.includes('tab=grades')));
  await page.screenshot({path:`${output}/student-published-grades.png`,fullPage:true});
 });
 await check('Resubmission retains history and requires grading the latest attempt',async()=>{
  await visit('student',{cohort,tab:'assignments',assignment});
  const form=formWith('body');await form.locator('[name="body"]').fill(body+' I also verified both dates against the original office notices.');await form.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_attempts.filter(a=>a.assignment_id===id).length===2,assignment);
  assert.equal((await data()).assignment_grades.filter(g=>g.assignment_id===assignment).length,2,'Draft and published grade history remain intact');
  await visit('staff',{cohort,tab:'assignments',assignment,student});const form2=formWith('score');await form2.locator('[name="score"]').fill('38');await form2.locator('[name="feedback"]').fill('The revised explanation shows how you checked both sources.');await form2.locator('[name="status"]').selectOption('published');await form2.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_grades.filter(g=>g.assignment_id===id).length===3,assignment);
  await visit('student',{cohort,tab:'grades'});assert.ok(await page.getByText(/The revised explanation/).count());
 });
 await check('A submission draft stays attached to its assignment across course tabs',async()=>{
  await visit('student',{cohort,tab:'assignments',assignment:seeded});const draft=formWith('body').locator('[name="body"]');await draft.fill('An unfinished project brief that belongs only to this assignment.');
  await page.locator('.campus-academic-tabs').getByRole('link',{name:'Grades',exact:true}).click();await ready();
  await page.locator('.campus-academic-tabs').getByRole('link',{name:'Assignments',exact:true}).click();await ready();
  await page.getByRole('link',{name:/Responsible AI project brief/}).first().click();await ready();
  assert.equal(await formWith('body').locator('[name="body"]').inputValue(),'An unfinished project brief that belongs only to this assignment.');
 });
 await check('A stale grading draft is rejected, preserved, and explicitly reloaded before a new review',async()=>{
  await visit('staff',{cohort,tab:'assignments',assignment,student});
  let form=formWith('score');await form.locator('[name="score"]').fill('37');await form.locator('[name="feedback"]').fill('An unfinished review based on the earlier grade revision.');
  const before=await data(),latest=before.assignment_attempts.filter(a=>a.assignment_id===assignment).sort((a,b)=>b.attempt_no-a.attempt_no)[0];
  await command('gradeAssignment',{assignment_id:assignment,user_id:student,attempt_id:latest.id,expected_revision:3,score:39,feedback:'A newer review was published from another session.',status:'published',disposition:'graded'});
  await form.locator('button[type="submit"]').click();
  await page.getByText('The grade changed. Reload before saving another revision.',{exact:true}).waitFor();
  assert.equal(await form.locator('[name="feedback"]').inputValue(),'An unfinished review based on the earlier grade revision.');
  assert.equal((await data()).assignment_grades.filter(g=>g.assignment_id===assignment).length,4);
  await page.locator('.campus-academic-tabs').getByRole('link',{name:'Gradebook',exact:true}).click();await ready();
  await page.getByRole('link',{name:'39 / 40',exact:true}).click();await ready();form=formWith('score');
  assert.equal(await form.locator('[name="expected_revision"]').inputValue(),'3','Internal navigation must not silently rebase stale feedback');
  await form.getByRole('button',{name:'Start over',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('form[data-academic-form="grade"] [name="expected_revision"]')?.value==='4');
  form=formWith('score');assert.equal(await form.locator('[name="feedback"]').inputValue(),'A newer review was published from another session.');
  await form.locator('[name="feedback"]').fill('I reviewed the current work and confirmed this result.');await form.locator('[name="status"]').selectOption('published');await form.locator('button[type="submit"]').click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_grades.filter(g=>g.assignment_id===id).length===5,assignment);
 });
 await check('Editing a published grade keeps it published; switching to draft warns first',async()=>{
  await visit('staff',{cohort,tab:'assignments',assignment,student});
  const form=formWith('score'),submit=form.locator('button[data-grade-submit]'),warning=form.locator('[data-grade-unpublish-warning]');
  assert.equal(await form.locator('[name="status"]').inputValue(),'published','the control starts on the published revision');
  assert.match(await submit.innerText(),/^Update .+ grade$/);assert.equal(await warning.isVisible(),false);
  await form.locator('[name="status"]').selectOption('draft');
  assert.equal(await submit.innerText(),'Save draft');assert.equal(await warning.isVisible(),true);assert.match(await warning.innerText(),/will stop seeing this grade until you publish again\./);
  await form.locator('[name="status"]').selectOption('published');assert.equal(await warning.isVisible(),false);
  const before=(await data()).assignment_grades.filter(g=>g.assignment_id===assignment&&g.user_id===student).length;
  await form.locator('[name="feedback"]').fill('Your comparison is clear and your sources are relevant. Updated: cite the date you checked each source.');
  await submit.click();
  await page.waitForFunction(({id,n})=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_grades.filter(g=>g.assignment_id===id).length>n,{id:assignment,n:before});
  const latest=(await data()).assignment_grades.filter(g=>g.assignment_id===assignment&&g.user_id===student).sort((a,b)=>b.revision-a.revision)[0];
  assert.equal(latest.status,'published');assert.match(latest.feedback,/Updated: cite the date/);
  await visit('student',{cohort,tab:'grades'});assert.ok(await page.getByText(/Updated: cite the date/).count(),'the student still sees the edited grade');
 });
 await check('Personal extensions reopen closed work and clearing restores the original deadline',async()=>{
  const original=(await data()).assignments.find(a=>a.id===seeded);
  const past=n=>new Date(Date.now()-n*60000).toISOString();
  await command('saveAssignment',{...original,opens_at:past(180),due_at:past(120),closes_at:past(60)});
  await visit('student',{cohort,tab:'assignments',assignment:seeded});
  await page.getByText('Submissions are closed. Ask your instructor about an extension.',{exact:true}).waitFor();assert.equal(await formWith('body').count(),0);
  await visit('staff',{cohort,tab:'assignments',assignment:seeded,student});await page.locator('.campus-academic-extension summary').click();let form=page.locator('form[data-academic-form="extension"]');
  await form.locator('[name="due_at"]').fill(localTime(1440));await form.locator('[name="closes_at"]').fill(localTime(2880));await form.getByRole('button',{name:'Save extension',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_extensions.some(e=>e.assignment_id===id),seeded);
  await visit('student',{cohort,tab:'assignments',assignment:seeded});assert.equal(await formWith('body').count(),1);assert.ok(await page.getByText(/personal extension/).count());
  await visit('staff',{cohort,tab:'assignments',assignment:seeded,student});await page.getByRole('button',{name:'Clear extension',exact:true}).click();
  await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('ht-campus-demo-v2')).assignment_extensions.some(e=>e.assignment_id===id),seeded);
  await visit('student',{cohort,tab:'assignments',assignment:seeded});assert.equal(await formWith('body').count(),0);
  await command('saveAssignment',original);
 });
 await check('Leadership and foreign-section links reveal no private academic work',async()=>{
  await visit('leadership',{cohort,tab:'assignments',assignment,student});assert.equal(await page.getByText(body,{exact:true}).count(),0);assert.equal(await page.locator('form[data-academic-form]').count(),0);
  await visit('student',{cohort:other,tab:'assignments',assignment});assert.equal(await page.locator('#htMain').getByText(title,{exact:true}).count(),0);assert.equal(await page.locator('form[data-academic-form]').count(),0);
 });
 for(const width of [1440,390,320])await check(`Coursework, submissions, assignment editor and gradebook fit ${width}px`,async()=>{
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const [role,params,label] of [['student',{},'courses'],['student',{cohort},'overview'],['student',{cohort,tab:'modules'},'modules'],['student',{cohort,tab:'assignments',assignment:seeded},'submission'],['student',{cohort,tab:'grades'},'grades'],['staff',{cohort,tab:'assignments',new:'1'},'editor'],['staff',{cohort,tab:'grades'},'gradebook'],['staff',{cohort,tab:'assignments',assignment,student},'review']]){
   await visit(role,params);const box=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(box.html<=box.width+1&&box.body<=box.width+1,`${label}: ${JSON.stringify(box)}`);
   assert.equal(await page.locator('h1').count(),1);if(width===390||width===1440&&['overview','gradebook'].includes(label))await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:true});
  }
 });
 await check('No uncaught browser errors or production service requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external.filter(value=>/supabase|ea-rtk|realtime|cloudflare/.test(value)),[]);});
 console.log(`${checks} academic browser groups passed. Screenshots: ${output}`);
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
