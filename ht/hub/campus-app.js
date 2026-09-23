const assetStamp = new URL(import.meta.url).search;
const [{createCampusStore},{renderStudent,bindStudent},{renderStaff,bindStaff},{renderClassrooms,bindClassrooms},{renderAcademics,bindAcademics},{renderOnboarding,renderOnboardingPrompt,renderPageOrientation,bindOnboarding},{createOnboardingProgress,onboardingSteps},{renderLeadership,bindLeadership,leadershipViews},{renderSuccess,bindSuccess},{renderTrust,bindTrust},{renderFaculty,bindFaculty}] = await Promise.all([
 import('./campus-store.js'+assetStamp),import('./campus-student.js'+assetStamp),import('./campus-staff.js'+assetStamp),import('./campus-classrooms.js'+assetStamp),import('./campus-academics.js'+assetStamp),import('./campus-onboarding.js'+assetStamp),import('./campus-onboarding-progress.js'+assetStamp),import('./campus-leadership.js'+assetStamp),import('./campus-success.js'+assetStamp),import('./campus-trust.js'+assetStamp),import('./campus-faculty.js'+assetStamp)
]);

const TITLES = {home:'Today',welcome:'Your Hub guide',courses:'My courses',learn:'Learning pathways',events:'Events',community:'Community',people:'Messages',spaces:'Around campus',support:'Get help',staff:'Staff workspace',insights:'Campus insights',live:'Classrooms & live sessions',success:'Student success',trust:'Security & integrations'};
const PATHS = {home:'',welcome:'welcome/',courses:'courses/',learn:'learn/',events:'events/',community:'community/',people:'messages/',messages:'messages/',spaces:'spaces/',support:'support/',staff:'staff/',insights:'insights/',live:'live/',success:'success/',trust:'trust/'};
const SHAPES = {
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 book:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M12 5v15"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
 chat:'<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3h.01"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-12 9a3 3 0 0 0 6 0"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 4v2"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 chart:'<path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-9-2v4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
 star:'<path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z"/>',
 gift:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9H7.5a2.5 2.5 0 1 1 2.4-3.2L12 9Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 9Z"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/>',
 door:'<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M6 7h12m-4 7h.01"/>',
 shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>'
};
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SHAPES[name] || SHAPES.grid}</svg>`;
function safeInternal(url){try{const u=new URL(url,location.origin); return u.origin===location.origin && u.pathname.startsWith('/ht/') ? u.pathname+u.search+u.hash : '/ht/hub/';}catch{return '/ht/hub/';}}
const humanDate=(iso,options)=> {if(!iso)return 'Not scheduled';const d=new Date(iso);return Number.isNaN(d.getTime())?'Not scheduled':new Intl.DateTimeFormat('en-US',options).format(d);};

export async function mountCampus(view='home') {
 const root=document.getElementById('htRoot');
 if(!root) return;
 document.body.classList.add('campus-app');
 const bar=document.getElementById('htBar');
 if(bar)bar.hidden=true;
 let state,cleanup,disposed=false,refreshing=null,pendingRefresh=false,identityEpoch=0;
 const drafts=new Map();
 let notificationOpen=false;
 const api=createCampusStore();
 const onboarding=createOnboardingProgress(),guidedVisits=new Set();
 const demo=new URLSearchParams(location.search).get('demo');
 function formKey(form){return JSON.stringify([Object.entries(form.dataset).filter(([k])=>k!=='busy').sort(),Array.from(form.querySelectorAll('input[type="hidden"]')).map(i=>[i.name,i.value]),form.id]);}
 function focusKey(form){return JSON.stringify([Object.entries(form.dataset).filter(([k])=>k!=='busy').sort(),form.id]);}
 function restoreFormFocus(key,index){const form=Array.from(root.querySelectorAll('form')).find(f=>focusKey(f)===key);const target=form?.elements[index]||form?.querySelector('button[type="submit"],input:not([type="hidden"]),select,textarea');if(target&&!target.disabled)target.focus({preventScroll:true});}
 function captureDraft(form){const values=Array.from(form.elements).filter(i=>i.name&&!['hidden','password','file','submit','button'].includes(i.type)).map(i=>({name:i.name,type:i.type,value:i.value,checked:i.checked}));drafts.set(formKey(form),values);}
 function restoreDrafts(){root.querySelectorAll('form').forEach(form=>{const values=drafts.get(formKey(form));if(!values)return;const controls=Array.from(form.elements);for(const v of values){const input=controls.find(i=>i.name===v.name&&i.type===v.type&&(!['radio','checkbox'].includes(i.type)||i.value===v.value));if(input){if(['radio','checkbox'].includes(input.type))input.checked=v.checked;else input.value=v.value;}}});}
 function href(target,query={}) {
  const path=Object.hasOwn(PATHS,target)?`/ht/hub/${PATHS[target]}`:safeInternal(target);
  const u=new URL(path,location.origin);
  if(['student','staff','leadership'].includes(demo))u.searchParams.set('demo',demo);
  for(const [k,v] of Object.entries(query || {}))if(v!==null&&v!==undefined)u.searchParams.set(k,String(v));
  return u.pathname+u.search+u.hash;
 }
 function notify(message,type='success') {
  let box=document.getElementById('campusNotice');
  if(!box){box=document.createElement('div');box.id='campusNotice';box.className='campus-toast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.append(box);}
  box.dataset.type=type;box.textContent=message;box.hidden=false;
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>{box.hidden=true;},type==='error'?12000:6500);
 }
 async function run(name,payload,message,form=null) {
  const submitted=form?formKey(form):null,epoch=identityEpoch;
  const savedFocus=form?focusKey(form):null,focusIndex=form?Array.from(form.elements).indexOf(document.activeElement):-1;
  try{await api.command(name,payload);if(epoch!==identityEpoch)return false;if(submitted)drafts.delete(submitted);await refresh();if(epoch!==identityEpoch)return false;if(message)notify(message);if(savedFocus&&(document.activeElement===document.body||form.contains(document.activeElement)))restoreFormFocus(savedFocus,focusIndex);return true;}
  catch(e){notify(e?.message || 'We could not save that. Please try again.','error');return false;}
 }
 const ctx=()=>({state,api,onboarding,esc,icon,href,notify,refresh,run,restoreDrafts,discardDraft:form=>{if(form)drafts.delete(formKey(form));},formatDate:iso=>humanDate(iso,{month:'short',day:'numeric'}),formatTime:iso=>humanDate(iso,{hour:'numeric',minute:'2-digit'})});
 function unreadMessages(){return state.user?.id&&state.member?(state.messages||[]).filter(m=>m.recipient_id===state.user.id&&!m.read_at).length:0;}
 function messageBadge(){const count=unreadMessages();return count?`<span class="campus-message-count" aria-hidden="true">${count>99?'99+':count}</span>`:'';}
 function navLink(v,i,label){const unread=v==='people'?unreadMessages():0;return `<a href="${href(v)}" aria-label="${v==='people'?`Messages${unread?`, ${unread} unread`:''}`:label}" ${(view===v||v==='courses'&&view==='learn')?'aria-current="page"':''}${v==='people'?' data-campus-messages-link':''}>${icon(i)}<span>${label}</span>${v==='people'?messageBadge():''}</a>`;}
 function navigation() {
  const links=[['home','home','Today'],['courses','book','Learning'],['community','users','Community'],['people','chat','Messages'],['spaces','grid','Campus']];
  const moreCurrent=['events','live','success','trust'].includes(view);
  const role=state.member?.role,staffLike=['staff','admin','leadership'].includes(role);
  const moreLinks=[['events','calendar','Events'],['live','play','Classrooms'],...(staffLike?[['success','shield','Student success']]:[]),['trust','door','Security & integrations']];
  const more=`<details class="campus-nav-more"><summary${moreCurrent?' aria-current="page"':''}>${icon('grid')}<span>More</span><span class="campus-nav-more-chevron" aria-hidden="true">⌄</span></summary><div class="campus-nav-more-panel" aria-label="More campus destinations">${moreLinks.map(args=>navLink(...args)).join('')}<a href="${href('/ht/hub/calendar/')}">${icon('calendar')}<span>Academic calendar</span></a><a class="campus-more-phone" href="${href('support')}">${icon('help')}<span>Get help</span></a><a class="campus-more-phone" href="${href('welcome')}">${icon('book')}<span>Hub guide</span></a></div></details>`;
  const strip=`<nav class="campus-phone-strip" aria-label="More destinations">${[...moreLinks,['/ht/hub/calendar/','calendar','Calendar'],['support','help','Get help'],['welcome','book','Guide']].map(([v,i,l])=>`<a href="${href(v)}"${view===v?' aria-current="page"':''}>${icon(i)}<span>${l}</span></a>`).join('')}</nav>`;
  return `<nav class="campus-nav campus-nav-communication" aria-label="Main navigation"><div class="campus-nav-inner">${links.map(args=>navLink(...args)).join('')}<div class="campus-nav-end">${more}</div></div></nav>${strip}`;
 }
 function courseRoute() {
  const params=new URLSearchParams(location.search),id=params.get('cohort');
  return id?{params,cohort:(state.cohorts||[]).find(item=>item.id===id)||null}:null;
 }
 function currentPageName() {
  if(view==='courses'){
   const route=courseRoute();
   if(route?.cohort){if(route.params.has('assignment'))return 'Assignment';return ({overview:'Overview',modules:'Modules',assignments:'Assignments',grades:'Grades',people:'People'})[route.params.get('tab')||'overview']||'Course overview';}
  }
  if(view==='people'){const params=new URLSearchParams(location.search);if(params.has('person'))return 'Conversation';if(params.get('new')==='1')return 'New message';}
  if(view==='live'&&new URLSearchParams(location.search).has('manage'))return 'Classroom management';
  if(view==='live'&&new URLSearchParams(location.search).has('cohort'))return 'Cohort classroom';
  if(view==='support'&&new URLSearchParams(location.search).has('request'))return 'Support request';
  return TITLES[view]||'Campus';
 }
 function breadcrumb() {
  if(view==='home')return '';
  const crumbs=[{label:'Today',url:href('home')}],page=currentPageName();
  if(view==='courses'){
   const route=courseRoute();
   if(route?.cohort){crumbs.push({label:'My courses',url:href('courses')});if(route.cohort.title)crumbs.push({label:route.cohort.title,url:href('courses',{cohort:route.cohort.id,tab:'overview'})});}
  } else if(view==='people'&&page!=='Messages')crumbs.push({label:'Messages',url:href('people')});
  else if(view==='live'&&page!=='Classrooms & live sessions')crumbs.push({label:'Classrooms',url:href('live')});
  else if(view==='support'&&page!=='Get help')crumbs.push({label:'Get help',url:href('support')});
  crumbs.push({label:page});
  return `<nav class="campus-breadcrumb" aria-label="Breadcrumb"><ol>${crumbs.map((item,index)=>`<li${index===crumbs.length-1?' aria-current="page"':''}>${index===crumbs.length-1?esc(item.label):`<a href="${item.url}">${esc(item.label)}</a>`}</li>`).join('')}</ol></nav>`;
 }
 function modeLine() {
  if(state.mode==='demo')return `<div class="campus-demo"><div><strong>Interactive demo</strong><span>Sample people and records, not university data. Changes stay in this browser.</span></div><label for="campusDemoRole">View as</label><select id="campusDemoRole">${[['student','Student'],['staff','Faculty & staff'],['leadership','Leadership']].map(([r,label])=>`<option value="${r}" ${demo===r?'selected':''}>${label}</option>`).join('')}</select></div>`;
  if(state.mode==='guest')return `<div class="campus-demo campus-demo-guest"><div><strong>Explore the HT Hub</strong><span>You’re viewing sample content. Sign in to open your campus workspace.</span></div><a href="${location.pathname}?demo=student">Try the interactive demo ${icon('arrow')}</a></div>`;
  if(state.mode==='unavailable')return `<div class="campus-access-message" role="status"><strong>Your workspace isn’t available yet.</strong><p>${esc(state.error || 'Contact your campus administrator to confirm your access.')}</p><button class="campus-button campus-button-secondary" data-reload>Try again</button> <a href="/ht/playbook/">Read the Hub guide</a></div>`;
  return '';
 }
 function notificationPanel() {
  const unread=(state.notifications||[]).filter(n=>!n.read_at).length;
  return `<div class="campus-inbox-wrap"><button class="campus-icon-button" id="campusInbox" aria-label="Notifications${unread?`, ${unread} unread`:''}" aria-expanded="${notificationOpen}" aria-controls="campusNotifications">${icon('bell')}${unread?`<span class="campus-unread">${unread}</span>`:''}</button><section id="campusNotifications" class="campus-notifications" ${notificationOpen?'':'hidden'} aria-label="Notifications"><div class="campus-section-head"><h2>Your updates</h2><button class="campus-icon-button" data-close-notifications aria-label="Close notifications">${icon('close')}</button></div>${(state.notifications||[]).length?(state.notifications||[]).slice(0,15).map(n=>`<article class="campus-notification ${n.read_at?'':'is-unread'}"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><div><a href="${href(safeInternal(n.href || '/ht/hub/'))}">Open ${icon('arrow')}</a>${!n.read_at?`<button type="button" data-read-notification="${esc(n.id)}">Mark read</button>`:''}</div></article>`).join(''):'<p class="campus-empty">You’re all caught up. Replies and program updates will appear here.</p>'}</section></div>`;
 }
 function officeDirectory() {
  const HT=window.HT||{};
  const spaces=(HT.order||[]).map(k=>{
   const s=HT.spaces?.[k];if(!s)return '';
   const intro=s.blocks?.find(block=>block.type==='intro');
   const headline=s.headline||intro?.title||s.blurb;
   const haystack=(s.title+' '+s.office+' '+s.blurb+' '+headline).toLowerCase();
   const art=HT.spaceArtwork?.[k];
   return `<a class="campus-office-card${['president','advancement'].includes(k)?' is-featured':''}" data-office="${esc(haystack)}" href="${href('/ht/hub/'+k+'/')}">${art?`<span class="campus-office-photo"><img src="${esc(art.image)}" alt="" decoding="async">${art.image.includes('/img/r-')?'<span class="campus-rendering-tag">Campus plan rendering</span>':''}</span>`:''}<span class="campus-office-icon">${icon(s.icon)}</span><span class="campus-office-card-copy"><strong>${esc(s.title)}</strong><span class="campus-office-headline">${esc(headline)}</span><span class="campus-office-description">${esc(s.blurb)}</span><span class="campus-office-open">Explore space <span aria-hidden="true">→</span></span></span></a>`;
  }).join('');
  return `<section class="campus-hero campus-space-feature campus-directory-hero"><div><p class="campus-eyebrow">Around the Hill</p><h2>Every office, program, and community on campus, in one place.</h2><p>Thirteen spaces, from the President’s town hall to the board packet. Each one opens with its own people, dates, and next step.</p></div><figure class="campus-hero-figure"><img src="/ht/img/r-land-aerial.jpg" alt="Aerial campus plan of the Huston-Tillotson main campus and west campus" loading="eager" decoding="async"><figcaption class="campus-rendering-tag">Campus plan</figcaption></figure></section><div class="campus-directory-top"><p class="campus-lede">Find your people, your next opportunity, and the right office.</p><div class="campus-search-field">${icon('search')}<label class="campus-sr-only" for="campusSearch">Search campus spaces</label><input id="campusSearch" type="search" placeholder="Find a space, service, or office"></div></div><div class="campus-shortcuts"><a href="${href('people')}">${icon('users')}<div><strong>Messages</strong><span>Open your inbox or find someone to talk to.</span></div>${icon('arrow')}</a><a href="${href('support')}">${icon('help')}<div><strong>Help from a real person</strong><span>Ask a question and follow its progress.</span></div>${icon('arrow')}</a></div><section class="campus-panel campus-spaces-directory"><div class="campus-section-head"><div><h2>Explore every campus space</h2><p class="campus-muted">One place for every office, program, and campus community.</p></div><span class="campus-space-count">${(HT.order||[]).length} spaces</span></div><div class="campus-office-list">${spaces}</div><p id="campusNoOffice" class="campus-empty" hidden>No spaces match. Try another search, or ask for help.</p></section><section class="campus-install"><img src="/ht/img/icon-192.png" width="48" height="48" alt="HT Hub app icon"><div><h2>The Hill, in your pocket.</h2><p>On iPhone, open in Safari, tap Share, then Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen option.</p></div></section>`;
 }
 function campusSpaceFeature() {
  const HT=window.HT||{},space=HT.spaces?.[view],visual=HT.spaceArtwork?.[view];
  if(!space||!visual)return '';
  const intro=space.blocks?.find(block=>block.type==='intro');
  const headline=space.headline||intro?.title||space.title;
  return `<section class="campus-hero campus-space-feature"><div><p class="campus-eyebrow">${esc(space.office||space.title)}</p><h2>${esc(headline)}</h2><p>${esc(space.blurb||'A dedicated space for your campus community.')}</p></div><img src="${esc(visual.image)}" alt="${esc(visual.alt)}" loading="eager" decoding="async"></section>`;
 }
 function render() {
  const focused=document.activeElement,focusedForm=focused?.closest('form');
  const savedFocus=focusedForm&&root.contains(focusedForm)?{key:focusKey(focusedForm),index:Array.from(focusedForm.elements).indexOf(focused)}:null;
  cleanup?.();cleanup=null;
  const role=state.member?.role;
  const guideId=new URLSearchParams(location.search).get('guide'),guideState=onboarding.read(state);
  const guideStep=onboardingSteps(guideState.role).find(step=>step.id===guideId&&step.view===view);
  const visitKey=JSON.stringify([state.mode,state.user?.id,role,view,guideId]);
  if(guideStep&&!guidedVisits.has(visitKey)){guidedVisits.add(visitKey);onboarding.visit(state,guideStep.id);}
  const isStaff=['staff','admin'].includes(role),isLeader=['staff','admin','leadership'].includes(role);
  const header=document.querySelector('.site-header .nav-cta');
  const brand=document.querySelector('.site-header .brand');if(brand)brand.href=href('home');
  const accountHref=state.mode==='demo'?href('home'):state.user?'/dashboard/':'/login/?next='+encodeURIComponent(location.pathname+location.search);
  const accountName=state.member?.display_name;
  if(header)header.innerHTML=`<a class="campus-header-guide" href="${href('welcome')}"${view==='welcome'?' aria-current="page"':''}>Guide</a><a class="campus-header-help" href="${href('support')}">Get help</a>${notificationPanel()}<a class="campus-account ${state.user?'':'btn primary sm'}" href="${accountHref}" aria-label="${esc(state.member?accountName+(state.mode==='demo'?', sample account':', Academy account'):'Sign in')}">${state.member?`<span class="campus-avatar">${esc(state.member.display_name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join(''))}</span><span>${esc(accountName)}</span>`:'Sign in'}</a>`;
  const courseRouteNow=view==='courses'?courseRoute():null;
  const assignmentNow=courseRouteNow?.cohort&&courseRouteNow.params.get('assignment')?(state.assignments||[]).find(a=>a.id===courseRouteNow.params.get('assignment')):null;
  const title=assignmentNow?assignmentNow.title:courseRouteNow?.cohort?courseRouteNow.cohort.title:view==='home'?(state.member?`Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, ${state.member.display_name.split(' ')[0]}.`:'Your day on the Hill.'):currentPageName();
  const route=courseRoute();
  const desc={home:'Start with your next course, message, or campus update.',welcome:'Use the guide to find a task or jump to any campus space.',courses:'Open a course to find its lessons, assignments, feedback, and grades.',learn:'Choose a pathway to build skills through readings and practice.',events:'Browse campus gatherings, review details, and RSVP when available.',community:'Choose a channel to read, reply, and share with campus.',people:'Find a campus member or continue a private conversation.',spaces:'Search campus offices and services, then open the right space.',support:'Ask a question and follow your request through to a reply.',staff:'Choose a staff tool, or open a course section you teach.',insights:'Enrollment, persistence, learning, and engagement across campus.',live:'Choose your cohort classroom or find a campus-wide live event.',success:'Students who may need a hand this week, and the next step for each.',trust:'How the Hub signs people in, protects student records, and connects to campus systems.'}[view]||'';
  const pageParams=new URLSearchParams(location.search);
  const contextualDesc=view==='courses'&&route?.cohort?(route.params.has('assignment')?'Read the assignment instructions, due dates, submission history, and instructor feedback.':({overview:'Course details and the next task for this section.',modules:'Open course learning materials and follow modules in order.',assignments:'Read assignment instructions, submit work, and follow published feedback.',grades:'Review published grades and feedback, or manage the section gradebook.',people:'Find your instructor and class roster.'}[route.params.get('tab')||'overview']||desc))
   :view==='live'&&pageParams.has('manage')?'Manage classrooms, enrollment, and scheduled sessions available to your role.'
   :view==='live'&&pageParams.has('cohort')?'Find your cohort’s scheduled sessions, shared materials, and recordings.'
   :view==='people'&&pageParams.has('person')?'A private conversation between you and another campus member.'
   :view==='people'&&pageParams.get('new')==='1'?'Find a campus member to start a direct conversation.'
   :view==='support'&&pageParams.has('request')?'A private help request, its status, and replies from the campus team.'
   :view==='success'&&role==='student'?'Your advisor and the campus offices ready to help, in one place.'
   :view==='home'&&role==='leadership'?'How learning, student support, and campus life are moving this week.'
   :desc;
  const badge=role==='leadership'?'Leadership workspace':isStaff?'Faculty & staff workspace':role==='student'?'Student workspace':'Huston-Tillotson University';
  let content='';
  if(view==='welcome')content=renderOnboarding(view,ctx());
  else if(state.mode==='unavailable')content=`<section class="campus-panel campus-empty"><h2>We’ll keep your place.</h2><p>Your campus records will appear here when access is available. Nothing you enter will be saved to a demonstration.</p><a class="campus-button" href="/login/?next=${encodeURIComponent(location.pathname)}">Check your sign-in</a></section>`;
  else if(view==='spaces')content=officeDirectory();
  else if(view==='success')content=renderSuccess(view,ctx());
  else if(view==='trust')content=renderTrust(view,ctx());
  else if(leadershipViews(view,ctx()))content=renderLeadership(view,ctx());
  else if(view==='home'&&isStaff)content=renderFaculty(view,ctx());
  else if(view==='live')content=renderClassrooms(view,ctx());
  else if(view==='courses')content=renderAcademics(view,ctx());
  else if(['staff','support','insights'].includes(view))content=renderStaff(view,ctx());
  else content=renderStudent(view,ctx());
  if(state.mode!=='unavailable'&&['courses','learn'].includes(view)&&!courseRoute()?.cohort)content=`<nav class="campus-academic-learning-switch" aria-label="Learning destinations"><a href="${href('courses')}"${view==='courses'?' aria-current="page"':''}>My courses</a><a href="${href('learn')}"${view==='learn'?' aria-current="page"':''}>Learning pathways</a></nav>${content}`;
  if(state.mode!=='unavailable'&&['events','live','learn','community'].includes(view))content=`${campusSpaceFeature()}${content}`;
  if(state.mode!=='unavailable'&&view==='courses'&&!courseRoute()&&role!=='leadership')content=`<section class="campus-hero campus-space-feature"><div><p class="campus-eyebrow">Your classes</p><h2>Lessons, assignments, and feedback in one place.</h2><p>Open a section to see what is due, turn in work, and read your instructor’s notes. Ada, your course tutor, answers from the class materials.</p></div><img src="/ht/img/student-laptop.jpg" alt="A Huston-Tillotson student working at a laptop in the library" loading="eager" decoding="async"></section>${content}`;
  if(state.mode!=='unavailable'&&view==='staff')content=`<div class="campus-academic-home-link"><div><strong>Teach your sections</strong><p>Create assignments, review submissions, and publish grades for your sections.</p></div><a class="campus-button campus-button-secondary" href="${href('courses')}">Open instructor courses</a></div>${content}`;
  const pageOrientation=renderPageOrientation(view,ctx());
  root.innerHTML=`${navigation()}<div class="campus-container">${modeLine()}${window.HTHub?.leadershipDemoRail?.(view)||''}${breadcrumb()}<div class="campus-page-head"><div><p class="campus-eyebrow">${esc(badge)}</p><h1>${esc(title)}</h1>${contextualDesc?`<p>${esc(contextualDesc)}</p>`:''}</div><div class="campus-head-actions"><time datetime="${new Date().toISOString()}">${humanDate(new Date(),{weekday:'long',month:'long',day:'numeric'})}</time>${isLeader?`<div class="campus-workspace-links">${isStaff?`<a href="${href('staff')}" ${view==='staff'?'aria-current="page"':''}>${icon('briefcase')} Staff</a>`:''}<a href="${href('success')}" ${view==='success'?'aria-current="page"':''}>${icon('shield')} Student success</a><a href="${href('insights')}" ${view==='insights'?'aria-current="page"':''}>${icon('chart')} Insights</a></div>`:''}</div></div><main id="htMain" class="campus-main" tabindex="-1">${renderOnboardingPrompt(view,ctx())}${pageOrientation}${content}</main><div class="campus-bottom-note"><span>Where every soul finds its strength.</span><a href="${href('welcome')}">Find your way ${icon('arrow')}</a></div></div><nav class="campus-mobile-nav" aria-label="Mobile navigation">${[['home','home','Today'],['courses','book','Learning'],['community','users','Community'],['people','chat','Messages'],['spaces','grid','Campus']].map(args=>navLink(...args)).join('')}</nav>`;
  document.title=`${title} · HT Hub`;
  const roleSelect=document.getElementById('campusDemoRole');
  roleSelect?.addEventListener('change',()=>{const u=new URL(location.href);u.searchParams.set('demo',roleSelect.value);location.assign(u.pathname+u.search);});
  root.querySelector('[data-reload]')?.addEventListener('click',refresh);
  const inbox=document.getElementById('campusInbox');
  const showNotifications=open=>{notificationOpen=open;const box=document.getElementById('campusNotifications');if(box)box.hidden=!open;inbox?.setAttribute('aria-expanded',String(open));};
  inbox?.addEventListener('click',()=>showNotifications(!notificationOpen));
  document.querySelector('[data-close-notifications]')?.addEventListener('click',()=>{showNotifications(false);inbox?.focus();});
  document.querySelectorAll('[data-read-notification]').forEach(b=>b.addEventListener('click',()=>run('readNotification',{id:b.dataset.readNotification},'Marked as read.')));
  if(view==='spaces')document.getElementById('campusSearch')?.addEventListener('input',e=>{let count=0;root.querySelectorAll('[data-office]').forEach(a=>{a.hidden=!a.dataset.office.includes(e.target.value.trim().toLowerCase());if(!a.hidden)count++;});document.getElementById('campusNoOffice').hidden=count>0;});
  else if(state.mode!=='unavailable'&&view!=='welcome')cleanup=(view==='success'?bindSuccess:view==='trust'?bindTrust:leadershipViews(view,ctx())?bindLeadership:view==='home'&&['staff','admin'].includes(state.member?.role)?bindFaculty:view==='courses'?bindAcademics:view==='live'?bindClassrooms:['staff','support','insights'].includes(view)?bindStaff:bindStudent)(view,root,ctx());
  const viewCleanup=cleanup,onboardingCleanup=bindOnboarding(view,root,ctx());
  cleanup=()=>{viewCleanup?.();onboardingCleanup?.();};
  restoreDrafts();
  if(savedFocus)restoreFormFocus(savedFocus.key,savedFocus.index);
 }
 async function refresh() {
  if(disposed)return;
  if(refreshing){pendingRefresh=true;return refreshing;}
  const epoch=identityEpoch;
  refreshing=(async()=>{
   try{const nextState=await api.load();if(!disposed&&epoch===identityEpoch){if(state?.user?.id!==nextState.user?.id)drafts.clear();state=nextState;render();}}
   catch(e){if(disposed||epoch!==identityEpoch)return;root.innerHTML=`<main id="htMain" class="campus-container campus-load-error"><h1>The Hub couldn’t load.</h1><p>${esc(e?.message||'Check your connection and try again.')}</p><button class="campus-button" id="campusRetry">Try again</button></main>`;document.getElementById('campusRetry')?.addEventListener('click',refresh);}
   finally{refreshing=null;if(pendingRefresh){pendingRefresh=false;queueMicrotask(refresh);}}
  })();
  return refreshing;
 }
 root.innerHTML=`<div class="campus-container campus-loading" role="status" aria-live="polite"><span class="campus-skeleton campus-skeleton-title"></span><span class="campus-skeleton"></span><span class="campus-skeleton campus-skeleton-panel"></span><p>Opening your campus…</p></div>`;
 const unsubscribe=api.subscribe?.(event=>{
  if(event?.reason==='auth'&&(event.event==='SIGNED_OUT'||event.user_id!==state?.user?.id)){
   identityEpoch++;drafts.clear();cleanup?.();cleanup=null;notificationOpen=false;
   const header=document.querySelector('.site-header .nav-cta');if(header)header.replaceChildren();
   root.innerHTML='<main id="htMain" class="campus-container campus-loading" role="status"><p>Updating your campus session…</p></main>';
   refresh();return;
  }
  // Preserve a member's in-progress form. Their next action or a return to this tab refreshes it.
  if(drafts.size||document.activeElement?.matches('input,textarea,select'))return;
  refresh();
 });
 await refresh();
 const onVisible=()=>{if(!document.hidden&&!drafts.size&&!document.activeElement?.matches('input,textarea,select'))refresh();};
 const onInput=e=>{const form=e.target.closest('form');if(form&&e.target.matches('input,textarea,select'))captureDraft(form);};
  root.addEventListener('input',onInput);
 document.addEventListener('visibilitychange',onVisible);
 const onEscape=e=>{if(e.key==='Escape'&&notificationOpen){notificationOpen=false;const box=document.getElementById('campusNotifications');if(box)box.hidden=true;document.getElementById('campusInbox')?.setAttribute('aria-expanded','false');document.getElementById('campusInbox')?.focus();}};
 document.addEventListener('keydown',onEscape);
 // A restored back/forward snapshot has a disposed store. Recheck identity and bind fresh controls.
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 window.addEventListener('pagehide',()=>{disposed=true;cleanup?.();unsubscribe?.();api.destroy?.();onboarding.destroy?.();root.removeEventListener('input',onInput);document.removeEventListener('visibilitychange',onVisible);document.removeEventListener('keydown',onEscape);},{once:true});
}
