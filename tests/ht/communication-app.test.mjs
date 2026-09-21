// Real local UI, browser-local fictional communication only; no production messages.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../tools/ht-campus-tests/package.json',import.meta.url))('playwright');
const base=process.env.HT_CAMPUS_BASE||'http://127.0.0.1:8871';
const output='/tmp/ht-communication-review';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const external=[];await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base||['blob:','data:'].includes(u.protocol))return r.continue();external.push(u.href);return r.abort('blockedbyclient');});
const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const student='10000000-0000-4000-8000-000000000001',staff='10000000-0000-4000-8000-000000000002';
const firstMessage='Can we talk about my campus project this week?',answer='Yes. Bring your project idea to our next cohort session.';
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
async function settled(){await page.waitForSelector('#htMain');await page.waitForFunction(()=>!document.querySelector('.campus-loading'));}
async function visit(route='',role='student',params={}){await page.goto(`${base}/ht/hub/${route?route+'/':''}?${new URLSearchParams({demo:role,...params})}`,{waitUntil:'domcontentloaded'});await settled();}
const unread=()=>page.locator('.campus-mobile-nav [data-campus-messages-link]').getAttribute('aria-label');
async function localReady(selector){await page.locator(selector).waitFor();await settled();}
try{
 await check('Community and Messages are permanent phone navigation destinations with real unread count',async()=>{
  await visit();
  assert.equal(await page.locator('.campus-mobile-nav').getByRole('link',{name:'Community',exact:true}).isVisible(),true);
  assert.equal(await unread(),'Messages, 1 unread');
  assert.equal(await page.locator('.campus-communication-preview').count(),1);
  assert.equal(await page.locator('.campus-nav-end').getByRole('link',{name:'Events',exact:true}).isVisible(),true);
  assert.equal(await page.locator('.campus-nav-end').getByRole('link',{name:'Get help',exact:true}).isVisible(),true);
 });
 await check('A phone inbox does not mark its hidden conversation read',async()=>{
  await visit('messages');
  await page.locator('.campus-messages-layout').waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.campus-conversation').isVisible(),false);
  assert.equal(await unread(),'Messages, 1 unread');
  await page.screenshot({path:`${output}/inbox-phone.png`,fullPage:true});
 });
 await check('Opening a conversation clears only its unread messages and supports phone back navigation',async()=>{
  await page.locator('.campus-inbox-list [data-campus-person]').filter({hasText:'Morgan T.'}).click();
  await localReady('.campus-messages-layout.is-thread');
  await page.waitForFunction(()=>document.querySelector('.campus-mobile-nav [data-campus-messages-link]')?.getAttribute('aria-label')==='Messages');
  assert.equal(await page.locator('.campus-inbox-list').isVisible(),false);
  await page.getByLabel('Your message to Morgan T.',{exact:true}).fill(firstMessage);
  await page.getByRole('link',{name:'Back to messages',exact:false}).click();
  await page.locator('.campus-inbox-list').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).searchParams.has('person'),false);
 });
 await check('Search starts another conversation and drafts stay with the correct recipient',async()=>{
  await page.locator('.campus-inbox-list [data-campus-message-new]').click();
  await page.getByLabel('Find a campus member',{exact:true}).fill('Cameron');
  assert.equal(await page.locator('[data-campus-member]:visible').count(),1);
  await page.getByRole('link',{name:'Message Cameron L.',exact:true}).click();
  await page.getByLabel('Your message to Cameron L.',{exact:true}).fill('An unsent note for Cameron only.');
  await page.getByRole('link',{name:'Back to messages',exact:false}).click();
  await page.locator('.campus-inbox-list [data-campus-person]').filter({hasText:'Morgan T.'}).click();
  assert.equal(await page.getByLabel('Your message to Morgan T.',{exact:true}).inputValue(),firstMessage);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.locator('.campus-message-history').getByText(firstMessage,{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Your message to Morgan T.',{exact:true}).inputValue(),'');
  await page.getByRole('link',{name:'Back to messages',exact:false}).click();
  await page.locator('.campus-inbox-list [data-campus-message-new]').click();
  assert.equal(await page.getByLabel('Find a campus member',{exact:true}).inputValue(),'Cameron');
  await page.getByRole('link',{name:'Message Cameron L.',exact:true}).click();
  assert.equal(await page.getByLabel('Your message to Cameron L.',{exact:true}).inputValue(),'An unsent note for Cameron only.');
 });
 await check('The recipient sees an unread preview and can reply to the same private conversation',async()=>{
  await visit('messages','staff');
  assert.equal(await unread(),'Messages, 1 unread');
  const row=page.locator('.campus-inbox-list [data-campus-person]').filter({hasText:'Jordan R.'});
  assert.ok((await row.innerText()).includes(firstMessage));await row.click();
  await page.getByLabel('Your message to Jordan R.',{exact:true}).fill(answer);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.locator('.campus-message-history').getByText(answer,{exact:true}).waitFor();
  await visit('','student');assert.equal(await unread(),'Messages, 1 unread');
  await page.getByRole('button',{name:/Notifications/}).click();
  const notification=page.locator('.campus-notification').filter({hasText:'A new campus message'});
  const href=await notification.getByRole('link',{name:/Open/}).getAttribute('href');
  assert.equal(new URL(href,base).pathname,'/ht/hub/messages/');
  assert.equal(new URL(href,base).searchParams.get('person'),staff);
  await page.goto(new URL(href,base).href);await settled();
  await page.locator('.campus-message-history').getByText(answer,{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.campus-mobile-nav [data-campus-messages-link]')?.getAttribute('aria-label')==='Messages');
  await page.screenshot({path:`${output}/conversation-phone.png`,fullPage:true});
 });
 await check('Community feed filters preserve composing and connect posts directly to a DM',async()=>{
  await visit('community');
  const draft='A community question I am still writing.';
  await page.getByLabel('Share with your campus',{exact:true}).fill(draft);
  await page.getByRole('button',{name:'Questions',exact:true}).click();
  assert.equal(await page.locator('[data-campus-post]:visible').count(),0);
  assert.equal(await page.getByLabel('Share with your campus',{exact:true}).inputValue(),draft);
  await page.getByRole('button',{name:'All conversations',exact:true}).click();
  const post=page.locator('[data-campus-post]').first();
  await post.locator('[data-campus-action="like"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-campus-action="like"]')?.getAttribute('aria-pressed')==='true');
  assert.equal(await page.getByLabel('Share with your campus',{exact:true}).inputValue(),draft);
  await post.getByRole('link',{name:'Message Cameron L.',exact:true}).click();await settled();
  assert.equal(new URL(page.url()).pathname,'/ht/hub/messages/');
  assert.equal(await page.getByLabel('Your message to Cameron L.',{exact:true}).isVisible(),true);
 });
 for(const width of [1440,390,320])await check(`Community, inbox and threads remain usable at ${width}px`,async()=>{
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const [route,params,label] of [['',{},'today'],['community',{},'community'],['messages',{},'inbox'],['messages',{person:staff},'conversation'],['messages',{new:'1'},'directory']]){
   await visit(route,'student',params);
   const m=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(m.document<=m.width+1&&m.body<=m.width+1,`${label}: ${JSON.stringify(m)}`);
   const navigation=page.locator(width===1440?'.campus-nav-inner':'.campus-mobile-nav');
   assert.equal(await navigation.getByRole('link',{name:'Community',exact:true}).isVisible(),true);
   assert.equal(await navigation.locator('[data-campus-messages-link]').isVisible(),true);
   if(label==='conversation'&&width<761){const boxes=await page.evaluate(()=>({send:document.querySelector('.campus-compose button[type="submit"]').getBoundingClientRect().bottom,nav:document.querySelector('.campus-mobile-nav').getBoundingClientRect().top}));assert.ok(boxes.send<=boxes.nav,`Phone send button must be above fixed navigation: ${JSON.stringify(boxes)}`);}
   if([1440,390].includes(width))await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:true});
  }
 });
 await check('Legacy people links still open the selected conversation and leadership cannot see other members’ private messages',async()=>{
  await visit('people','student',{person:staff});
  await page.getByLabel('Your message to Morgan T.',{exact:true}).waitFor();
  await visit('messages','leadership',{person:staff});
  assert.equal(await page.getByText(firstMessage,{exact:true}).count(),0);
  assert.equal(await page.getByText(answer,{exact:true}).count(),0);
  await visit('career');
  await page.locator('.nav-cta').getByRole('link',{name:'Messages',exact:true}).click();
  await settled();
  assert.equal(new URL(page.url()).pathname,'/ht/hub/messages/');
  assert.equal(new URL(page.url()).searchParams.get('demo'),'student','Office preview returns to the same demo workspace');
 });
 await check('A failed send keeps the draft and re-enables the composer',async()=>{
  const failedPage=await context.newPage();failedPage.setDefaultTimeout(10000);
  await failedPage.route('**/campus-store.js*',route=>{
   if(new URL(route.request().url()).searchParams.has('originalForFailureTest'))return route.continue();
   return route.fulfill({status:200,contentType:'application/javascript',body:`import {createCampusStore as original} from '/ht/hub/campus-store.js?originalForFailureTest=1';export function createCampusStore(options){const store=original(options);return {...store,command(name,payload){if(name==='sendMessage')return Promise.reject(new Error('Message could not be sent. Try again.'));return store.command(name,payload);}}}`});
  });
  try{
   await failedPage.goto(`${base}/ht/hub/messages/?demo=student&person=${staff}`);
   const draft=failedPage.getByLabel('Your message to Morgan T.',{exact:true});
   await draft.fill('Keep this unsent message when the service fails.');
   await failedPage.getByRole('button',{name:'Send message',exact:true}).click();
   await failedPage.getByText('Message could not be sent. Try again.',{exact:true}).waitFor();
   assert.equal(await draft.inputValue(),'Keep this unsent message when the service fails.');
   assert.equal(await failedPage.getByRole('button',{name:'Send message',exact:true}).isEnabled(),true);
  }finally{await failedPage.close();}
 });
 await check('No uncaught browser errors or calls to production messaging services',async()=>{
  assert.deepEqual(errors,[]);assert.deepEqual(external.filter(u=>{const url=new URL(u);return /(^|\.)supabase\.(co|in)$/.test(url.hostname)||/ea-rtk|realtime|cloudflare/.test(u);}),[]);
 });
 console.log(`${checks} communication browser groups passed. Screenshots: ${output}`);
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}
finally{await browser.close();}
