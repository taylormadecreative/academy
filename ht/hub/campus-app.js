const assetStamp = new URL(import.meta.url).search;
const [{createCampusStore},{renderStudent,bindStudent},{renderStaff,bindStaff},{renderClassrooms,bindClassrooms}] = await Promise.all([
 import('./campus-store.js'+assetStamp),import('./campus-student.js'+assetStamp),import('./campus-staff.js'+assetStamp),import('./campus-classrooms.js'+assetStamp)
]);

const TITLES = {home:'Today',learn:'My learning',events:'Events',community:'Community',people:'Messages',spaces:'Around campus',support:'Get help',staff:'Staff workspace',insights:'Campus insights',live:'Classrooms & live sessions'};
const PATHS = {home:'',learn:'learn/',events:'events/',community:'community/',people:'messages/',messages:'messages/',spaces:'spaces/',support:'support/',staff:'staff/',insights:'insights/',live:'live/'};
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
 star:'<path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z"/>'
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
 const ctx=()=>({state,api,esc,icon,href,notify,refresh,run,restoreDrafts,discardDraft:form=>{if(form)drafts.delete(formKey(form));},formatDate:iso=>humanDate(iso,{month:'short',day:'numeric'}),formatTime:iso=>humanDate(iso,{hour:'numeric',minute:'2-digit'})});
 function unreadMessages(){return state.user?.id&&state.member?(state.messages||[]).filter(m=>m.recipient_id===state.user.id&&!m.read_at).length:0;}
 function messageBadge(){const count=unreadMessages();return count?`<span class="campus-message-count" aria-hidden="true">${count>99?'99+':count}</span>`:'';}
 function navLink(v,i,label){const unread=v==='people'?unreadMessages():0;return `<a href="${href(v)}" ${view===v?'aria-current="page"':''}${v==='people'?` data-campus-messages-link aria-label="Messages${unread?`, ${unread} unread`:''}"`:''}>${icon(i)}<span>${label}</span>${v==='people'?messageBadge():''}</a>`;}
 function navigation() {
  const links=[['home','home','Today'],['learn','book','Learning'],['community','users','Community'],['people','chat','Messages'],['spaces','grid','Campus']];
  return `<nav class="campus-nav campus-nav-communication" aria-label="Main navigation"><div class="campus-nav-inner">${links.map(args=>navLink(...args)).join('')}<div class="campus-nav-end">${[['events','calendar','Events'],['live','play','Classrooms'],['support','help','Get help']].map(args=>navLink(...args)).join('')}</div></div></nav>`;
 }
 function modeLine() {
  if(state.mode==='demo')return `<div class="campus-demo"><div><strong>Interactive demo</strong><span>Sample people and records. Changes stay in this browser.</span></div><label for="campusDemoRole">View as</label><select id="campusDemoRole">${['student','staff','leadership'].map(r=>`<option value="${r}" ${demo===r?'selected':''}>${r==='leadership'?'Leadership':r[0].toUpperCase()+r.slice(1)}</option>`).join('')}</select></div>`;
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
  return `<div class="campus-directory-top"><p class="campus-lede">Find your people, your next opportunity, and the right office.</p><div class="campus-search-field">${icon('search')}<label class="campus-sr-only" for="campusSearch">Search campus spaces</label><input id="campusSearch" type="search" placeholder="Find an office or campus resource"></div></div><div class="campus-shortcuts"><a href="${href('people')}">${icon('users')}<div><strong>Messages</strong><span>Open your inbox or find someone to talk to.</span></div>${icon('arrow')}</a><a href="${href('support')}">${icon('help')}<div><strong>Help from a real person</strong><span>Ask a question and follow its progress.</span></div>${icon('arrow')}</a></div><section class="campus-panel"><div class="campus-section-head"><h2>Campus spaces</h2><span class="campus-muted">Office previews</span></div><p class="campus-muted">These office pages contain labeled examples. Your personal learning, events, messages, and help requests live in the workspace above.</p><div class="campus-office-list">${(HT.order||[]).map(k=>{const s=HT.spaces[k];return `<a class="campus-office" data-office="${esc((s.title+' '+s.office+' '+s.blurb).toLowerCase())}" href="${href('/ht/hub/'+k+'/')}"><span class="campus-office-icon">${icon(s.icon)}</span><span><strong>${esc(s.title)}</strong><span>${esc(s.blurb)}</span></span>${icon('arrow')}</a>`;}).join('')}</div><p id="campusNoOffice" class="campus-empty" hidden>No spaces match. Try an office name, or ask for help.</p></section><section class="campus-install"><img src="/ht/img/icon-192.png" width="48" height="48" alt="HT Hub app icon"><div><h2>The Hill, in your pocket.</h2><p>On iPhone, open in Safari, tap Share, then Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen option.</p></div></section>`;
 }
 function render() {
  const focused=document.activeElement,focusedForm=focused?.closest('form');
  const savedFocus=focusedForm&&root.contains(focusedForm)?{key:focusKey(focusedForm),index:Array.from(focusedForm.elements).indexOf(focused)}:null;
  cleanup?.();cleanup=null;
  const role=state.member?.role;
  const isStaff=['staff','admin'].includes(role),isLeader=['staff','admin','leadership'].includes(role);
  const header=document.querySelector('.site-header .nav-cta');
  const brand=document.querySelector('.site-header .brand');if(brand)brand.href=href('home');
  const accountHref=state.mode==='demo'?href('home'):state.user?'/dashboard/':'/login/?next='+encodeURIComponent(location.pathname+location.search);
  if(header)header.innerHTML=`<a class="campus-header-help" href="${href('support')}">Get help</a>${notificationPanel()}<a class="campus-account ${state.user?'':'btn primary sm'}" href="${accountHref}" aria-label="${esc(state.member?state.member.display_name+(state.mode==='demo'?', sample account':', Academy account'):'Sign in')}">${state.member?`<span class="campus-avatar">${esc(state.member.display_name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join(''))}</span><span>${esc(state.member.display_name)}</span>`:'Sign in'}</a>`;
  const title=view==='home'?(state.member?`Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, ${state.member.display_name.split(' ')[0]}.`:'Your day on the Hill.'):TITLES[view]||'The HT Hub';
  const desc={home:'A little direction. A world of possibility.',learn:'Build your skills. Make something that matters.',events:'Find your next connection on the Hill.',community:'The conversations that keep us connected.',people:'Stay connected to your people on campus.',spaces:'One campus. The right door for every question.',support:'You don’t have to figure it out alone.',staff:'Keep your campus informed and your students moving.',insights:'See participation, learning, and the work ahead.',live:'Your classroom. Your cohort. Everything you need to keep learning.'}[view]||'';
  const badge=state.mode==='demo'?'Demo workspace':role==='leadership'?'Leadership workspace':isStaff?'Staff workspace':'Huston-Tillotson University';
  let content='';
  if(state.mode==='unavailable')content=`<section class="campus-panel campus-empty"><h2>We’ll keep your place.</h2><p>Your campus records will appear here when access is available. Nothing you enter will be saved to a demonstration.</p><a class="campus-button" href="/login/?next=${encodeURIComponent(location.pathname)}">Check your sign-in</a></section>`;
  else if(view==='spaces')content=officeDirectory();
  else if(view==='live')content=renderClassrooms(view,ctx());
  else if(['staff','support','insights'].includes(view))content=renderStaff(view,ctx());
  else content=renderStudent(view,ctx());
  root.innerHTML=`${navigation()}<div class="campus-container">${modeLine()}<div class="campus-page-head"><div><p class="campus-eyebrow">${esc(badge)}</p><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="campus-head-actions"><time datetime="${new Date().toISOString()}">${humanDate(new Date(),{weekday:'long',month:'long',day:'numeric'})}</time>${isLeader?`<div class="campus-workspace-links">${isStaff?`<a href="${href('staff')}" ${view==='staff'?'aria-current="page"':''}>${icon('briefcase')} Staff</a>`:''}<a href="${href('insights')}" ${view==='insights'?'aria-current="page"':''}>${icon('chart')} Insights</a></div>`:''}</div></div><main id="htMain" class="campus-main" tabindex="-1">${content}</main><div class="campus-bottom-note"><span>Where every soul finds its strength.</span><a href="/ht/playbook/">Hub guide ${icon('arrow')}</a></div></div><nav class="campus-mobile-nav" aria-label="Mobile navigation">${[['home','home','Today'],['learn','book','Learn'],['community','users','Community'],['people','chat','Messages'],['spaces','grid','Campus']].map(args=>navLink(...args)).join('')}</nav>`;
  document.title=`${TITLES[view]||'Campus'} · HT Hub`;
  const roleSelect=document.getElementById('campusDemoRole');
  roleSelect?.addEventListener('change',()=>{const u=new URL(location.href);u.searchParams.set('demo',roleSelect.value);location.assign(u.pathname+u.search);});
  root.querySelector('[data-reload]')?.addEventListener('click',refresh);
  const inbox=document.getElementById('campusInbox');
  const showNotifications=open=>{notificationOpen=open;const box=document.getElementById('campusNotifications');if(box)box.hidden=!open;inbox?.setAttribute('aria-expanded',String(open));};
  inbox?.addEventListener('click',()=>showNotifications(!notificationOpen));
  document.querySelector('[data-close-notifications]')?.addEventListener('click',()=>{showNotifications(false);inbox?.focus();});
  document.querySelectorAll('[data-read-notification]').forEach(b=>b.addEventListener('click',()=>run('readNotification',{id:b.dataset.readNotification},'Marked as read.')));
  if(view==='spaces')document.getElementById('campusSearch')?.addEventListener('input',e=>{let count=0;root.querySelectorAll('[data-office]').forEach(a=>{a.hidden=!a.dataset.office.includes(e.target.value.trim().toLowerCase());if(!a.hidden)count++;});document.getElementById('campusNoOffice').hidden=count>0;});
  else if(state.mode!=='unavailable')cleanup=(view==='live'?bindClassrooms:['staff','support','insights'].includes(view)?bindStaff:bindStudent)(view,root,ctx());
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
 window.addEventListener('pagehide',()=>{disposed=true;cleanup?.();unsubscribe?.();api.destroy?.();root.removeEventListener('input',onInput);document.removeEventListener('visibilitychange',onVisible);document.removeEventListener('keydown',onEscape);},{once:true});
}
