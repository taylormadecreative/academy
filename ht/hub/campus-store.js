/** HT Hub persistence. Explicit demo only; live failures never become sample success. */
const DEMO_KEY = 'ht-campus-demo-v2';
const COLLECTIONS = ['announcements','events','rsvps','attendance','courses','modules','enrollments','progress','submissions','requests','responses','posts','replies','likes','members','messages','notifications','cohorts','cohort_members','class_sessions','session_attendance'];
const SETTINGS = {ada_video_url:'',ada_video_poster:'',ada_video_transcript:'',support_email:''};
const IDS = {instructor:'10000000-0000-4000-8000-000000000008',cohort:'a0000000-0000-4000-8000-000000000001',otherCohort:'a0000000-0000-4000-8000-000000000002',student:'10000000-0000-4000-8000-000000000001',staff:'10000000-0000-4000-8000-000000000002',leadership:'10000000-0000-4000-8000-000000000003',other:'10000000-0000-4000-8000-000000000004',course:'20000000-0000-4000-8000-000000000001',event:'30000000-0000-4000-8000-000000000001'};
const clone = value => JSON.parse(JSON.stringify(value));
const uuid = () => globalThis.crypto.randomUUID();
const empty = () => ({mode:'unavailable',user:null,member:null,error:null,...Object.fromEntries(COLLECTIONS.map(k=>[k,[]])),settings:{...SETTINGS},metrics:null});
const fail = message => {throw new Error(message);};
const required = (value,label,max=10000) => {const text=String(value??'').trim(); if(!text||text.length>max) fail(`${label} must contain 1–${max} characters.`);return text;};
const choice = (value,values,label) => values.includes(value)?value:fail(`Choose a valid ${label}.`);
const url = value => {const text=String(value??'').trim();if(text&&!/^https:\/\//i.test(text)) fail('Use a secure https:// URL.');return text||null;};
const datetime = (value,label) => {const d=new Date(value);if(!Number.isFinite(d.getTime())) fail(`Enter a valid ${label}.`);return d.toISOString();};
const upsert = (rows,data,keys=['id']) => {const old=rows.find(r=>keys.every(k=>r[k]===data[k]));if(old)Object.assign(old,data);else rows.push(data);return old||data;};
function fixtures(now) {
 const iso=offset=>new Date(now+offset*60000).toISOString();
 const s=empty();s.version=2;s.created_day=new Date(now).toISOString().slice(0,10);s._codes={[IDS.event]:'HT2026'};s._checks=[];
 s.members=[{user_id:IDS.student,display_name:'Jordan R.',role:'student'},{user_id:IDS.staff,display_name:'Morgan T.',role:'staff'},{user_id:IDS.leadership,display_name:'Avery W.',role:'leadership'},{user_id:IDS.other,display_name:'Cameron L.',role:'student'},{user_id:IDS.instructor,display_name:'Riley S.',role:'staff'}].map(m=>({...m,active:true}));
 s.announcements=[{id:'40000000-0000-4000-8000-000000000001',title:'Your next chapter starts here',body:'Explore the AI Literacy pathway, join a campus conversation, and connect with support when you need it. This is an illustrative campus announcement for your demo.',office:'Student Success',audience:'campus',status:'published',publish_at:iso(-180),created_at:iso(-180),author_id:IDS.staff}];
 s.events=[{id:IDS.event,title:'AI Literacy · Open Studio',description:'Bring one question and a project idea. Practice writing a clear prompt, evaluating an AI response, and deciding what to verify. Sample event for demonstration.',office:'Academic Innovation',location:'Innovation Lab · HT campus',starts_at:iso(-15),ends_at:iso(45),capacity:24,status:'published',join_url:null},{id:'30000000-0000-4000-8000-000000000002',title:'Build your next opportunity',description:'A practical career conversation: connect your campus learning with a portfolio story and your next opportunity.',office:'Career Services',location:'Student Center',starts_at:iso(1440),ends_at:iso(1500),capacity:40,status:'published',join_url:null}];
 s.courses=[{id:IDS.course,title:'AI Literacy: From Curiosity to Practice',description:'Build a thoughtful, practical approach to AI. Learn the fundamentals, write a useful prompt, and create a small project with human review.',category:'AI Literacy',status:'published',image_url:null}];
 s.modules=[
  {id:'50000000-0000-4000-8000-000000000001',course_id:IDS.course,title:'Understand what AI can—and cannot—do',position:1,body:'Generative AI predicts useful patterns in language, images, and other information. A fluent answer can still be inaccurate or incomplete. Treat its output as a draft to evaluate, not as evidence.\n\nBefore using a tool for coursework, check your instructor’s policy. Keep private student information, passwords, and confidential documents out of unapproved tools. Verify factual claims using reliable original sources, and acknowledge AI assistance when required.\n\nPractice: ask an AI tool to explain a familiar concept. Identify one claim you would verify and name a source you could check.',resource_url:null,question:'An AI answer sounds confident. What should you do before using a factual claim?',options:['Use it immediately because confidence means accuracy','Verify the claim against a reliable original source','Ask it to use a more academic tone'],answer_index:1,assignment_prompt:null},
  {id:'50000000-0000-4000-8000-000000000002',course_id:IDS.course,title:'Write a clear prompt and evaluate the result',position:2,body:'A useful prompt explains the task, audience, context, and desired output. State what a good result must include and what information is missing.\n\nExample: “Help me draft a study plan for two biology chapters over five days. I have 45 minutes each day. Include retrieval practice and a way to check my understanding. Ask me about any missing requirements before planning.”\n\nReview the result for accuracy, bias, usefulness, and fit. Improve one instruction at a time. You remain responsible for deciding whether the final output meets the assignment requirements.',resource_url:null,question:'Which prompt provides the clearest task and constraints?',options:['Make something impressive','Write a lot about studying','Draft a five-day study plan with 45 minutes per day and retrieval practice'],answer_index:2,assignment_prompt:null},
  {id:'50000000-0000-4000-8000-000000000003',course_id:IDS.course,title:'Create, reflect, and share your work',position:3,body:'Choose a small, practical task: a study plan, a campus event brief, or a portfolio summary. Use an approved AI tool if available; you may also write the prompt and expected output yourself.\n\nYour submission will be reviewed for a clear purpose, specific instructions, evidence of evaluation, and your own reflection. A staff reviewer will return feedback or approve the work. Completion is recorded only after all knowledge checks and this review are complete.',resource_url:null,question:null,options:[],answer_index:null,assignment_prompt:'Submit: (1) your task and intended audience; (2) the prompt you wrote; (3) a short excerpt of the result or your expected result; (4) what you verified or changed; and (5) one limitation and how you addressed it. Do not include confidential information.'}
 ];
 s.enrollments=[{course_id:IDS.course,user_id:IDS.student,enrolled_at:iso(-120),completed_at:null,credential_id:null},{course_id:IDS.course,user_id:IDS.other,enrolled_at:iso(-2880),completed_at:null,credential_id:null}];
 s.progress=s.modules.slice(0,2).map(m=>({module_id:m.id,user_id:IDS.other,completed_at:iso(-100)}));s._checks=s.progress.map(p=>({module_id:p.module_id,user_id:p.user_id}));
 s.submissions=[{id:'60000000-0000-4000-8000-000000000001',module_id:s.modules[2].id,user_id:IDS.other,body:'Task: create a five-day biology study plan for a first-year student. My prompt specified 45 minutes each day and retrieval practice. I checked the plan against the course syllabus, added breaks, and replaced a suggested topic that was not part of our class. Limitation: the tool did not know our exam format, so I confirmed it with my instructor.',link_url:null,status:'submitted',feedback:null,submitted_at:iso(-80),reviewed_at:null}];
 s.requests=[{id:'70000000-0000-4000-8000-000000000001',user_id:IDS.student,category:'Career',subject:'Help connecting my project to my portfolio',body:'I would like guidance on describing my AI Literacy project for an internship portfolio.',status:'in_progress',assigned_to:IDS.staff,created_at:iso(-60)}];
 s.responses=[{id:'71000000-0000-4000-8000-000000000001',request_id:s.requests[0].id,author_id:IDS.staff,body:'Happy to help. Share a short description of your project and the type of internship you are interested in.',created_at:iso(-30)}];
 s.posts=[{id:'80000000-0000-4000-8000-000000000001',author_id:IDS.other,channel:'Campus',body:'What is one thing you would like to build with what you learn this semester? I am working on a better study plan.',created_at:iso(-50)}];
 s.messages=[{id:'90000000-0000-4000-8000-000000000001',sender_id:IDS.staff,recipient_id:IDS.student,body:'Welcome, Jordan. The open studio is a good place to bring your first project idea.',created_at:iso(-25),read_at:null}];
 s.notifications=[{id:'91000000-0000-4000-8000-000000000001',user_id:IDS.student,title:'Morgan replied to your request',body:'Open Student support to continue the conversation.',href:'/ht/hub/support/',created_at:iso(-30),read_at:null}];
 s.cohorts=[{id:IDS.cohort,title:'AI Literacy · First-Year Scholars',description:'A small cohort turning responsible AI practice into useful work, with Morgan as your instructor.',course_id:IDS.course,instructor_id:IDS.staff,status:'active',created_at:iso(-10080)},{id:IDS.otherCohort,title:'Digital Storytelling · Creative Lab',description:'A separate classroom with its own instructor, roster, and session records.',course_id:null,instructor_id:IDS.instructor,status:'active',created_at:iso(-10080)}];
 s.cohort_members=[{cohort_id:IDS.cohort,user_id:IDS.student,active:true,joined_at:iso(-10080)},{cohort_id:IDS.otherCohort,user_id:IDS.other,active:true,joined_at:iso(-10080)}];
 const session=(n,cohort,title,start,end,extra={})=>({id:`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`,cohort_id:cohort?.id||null,event_id:null,title,description:'Bring one question and a small project idea. We will review a prompt, compare sources, and share our next step.',starts_at:iso(start),ends_at:iso(end),status:'scheduled',audience:cohort?'cohort':'campus',instructor_id:cohort?.instructor_id||IDS.staff,room_id:`c0000000-0000-4000-8000-${String(n).padStart(12,'0')}`,room_slug:`htc-${String(n).padStart(24,'0')}`,is_live:false,recording_url:null,replay_published:false,...extra});
 s.class_sessions=[session(1,s.cohorts[0],'Prompt Lab: From question to useful draft',30,90),session(2,s.cohorts[1],'Story Studio: Shape your opening',30,90),session(3,s.cohorts[0],'Project Clinic: Evaluate and improve',1470,1530),session(4,null,'Campus conversation: Learning with AI',120,180,{event_id:IDS.event}),session(5,s.cohorts[0],'Getting started with responsible AI',-1440,-1380,{replay_published:true})];
 s._session_joins=[];
 return s;
}
const demoActive=(s,id)=>s.members.some(m=>m.user_id===id&&m.active!==false);
const demoManager=(s,u,r,c)=>!!c&&demoActive(s,u)&&(r==='admin'||r==='staff'&&c.instructor_id===u);
const demoCohortVisible=(s,u,r,c)=>demoManager(s,u,r,c)||!!c&&demoActive(s,u)&&['student','staff'].includes(r)&&c.status==='active'&&s.cohort_members.some(m=>m.cohort_id===c.id&&m.user_id===u&&m.active);
const demoSessionVisible=(s,u,r,x)=>demoActive(s,u)&&(x.audience==='campus'||demoCohortVisible(s,u,r,s.cohorts.find(c=>c.id===x.cohort_id)));
const demoSessionAllowed=(s,u,r,x)=>demoSessionVisible(s,u,r,x)&&x.status==='scheduled'&&(x.audience==='campus'||s.cohorts.some(c=>c.id===x.cohort_id&&c.status==='active'));
function metrics(s){return {members:s.members.length,active_learners:new Set(s.enrollments.map(e=>e.user_id)).size,enrollments:s.enrollments.length,completions:s.enrollments.filter(e=>e.completed_at).length,rsvps:s.rsvps.filter(e=>e.status==='going').length,checkins:s.attendance.length,open_requests:s.requests.filter(r=>r.status!=='resolved').length,unanswered_requests:s.requests.filter(r=>r.status!=='resolved'&&!s.responses.some(a=>a.request_id===r.id&&s.members.some(m=>m.user_id===a.author_id&&['staff','admin'].includes(m.role)))).length,announcements:s.announcements.filter(a=>a.status==='published'&&new Date(a.publish_at)<=new Date()).length};}
function filterDemo(source,role,now){
 const s=clone(source),u=IDS[role],staff=['staff','admin'].includes(role);s.mode=role?'demo':'guest';s.error=null;s.user=role?{id:u,email:`${role}@example.test`}:null;s.member=s.members.find(m=>m.user_id===u)||null;s.metrics=staff||role==='leadership'?metrics(s):null;
 s.announcements=s.announcements.filter(a=>staff||(a.status==='published'&&new Date(a.publish_at).getTime()<=now&&(a.audience==='campus'||a.audience==='students'&&role==='student'||a.audience==='staff'&&role==='leadership')));
 s.events=s.events.filter(e=>staff||e.status!=='draft');s.courses=s.courses.filter(c=>staff||c.status==='published');s.modules=s.modules.filter(m=>s.courses.some(c=>c.id===m.course_id));
 for(const key of ['rsvps','attendance','enrollments','progress','submissions','requests'])s[key]=s[key].filter(x=>staff||x.user_id===u);
 s.responses=s.responses.filter(a=>s.requests.some(r=>r.id===a.request_id));s.messages=s.messages.filter(m=>m.sender_id===u||m.recipient_id===u);s.notifications=s.notifications.filter(n=>n.user_id===u);
 const sourceCohorts=s.cohorts;
 s.class_sessions=s.class_sessions.filter(x=>!role?x.audience==='campus'||x.cohort_id===IDS.cohort:demoSessionVisible(source,u,role,x)).map(x=>({...x,recording_url:role&&demoSessionAllowed(source,u,role,x)&&x.replay_published?x.recording_url:null,replay_published:!!role&&demoSessionAllowed(source,u,role,x)&&x.replay_published}));
 s.cohorts=s.cohorts.filter(c=>!role?c.id===IDS.cohort:demoCohortVisible(source,u,role,c));
 s.cohort_members=s.cohort_members.filter(m=>!!role&&(demoManager(source,u,role,sourceCohorts.find(c=>c.id===m.cohort_id))||m.user_id===u&&m.active&&s.cohorts.some(c=>c.id===m.cohort_id)));
 s.session_attendance=s.session_attendance.filter(a=>!!role&&s.class_sessions.some(x=>x.id===a.session_id&&(role==='admin'||role==='staff'&&x.instructor_id===u||a.user_id===u)));
 delete s._session_joins;
 if(!role){s.posts=[];s.replies=[];s.likes=[];s.members=[];}
 delete s._codes;delete s._checks;delete s.version;delete s.created_day;return s;
}
function demoCommand(s,role,name,p,now){
 const u=IDS[role],staff=['staff','admin'].includes(role),iso=new Date(now).toISOString();if(!u||!demoActive(s,u))fail('Sign in with an active HT membership to make changes.');
 if(['saveAnnouncement','saveEvent','saveCourse','saveModule','saveSettings','reviewWork','updateRequest','saveCohort','setCohortMember','saveClassSession'].includes(name)&&!staff)fail('Staff access is required.');
 const find=(key,id)=>s[key].find(x=>x.id===id)||fail('This item is no longer available.');
 const notify=(user_id,title,body,href)=>s.notifications.push({id:uuid(),user_id,title,body,href,read_at:null,created_at:iso});
 const learning=(mid,uid=u)=>{const m=find('modules',mid);if(!s.enrollments.some(e=>e.course_id===m.course_id&&e.user_id===uid))fail('Enroll in this pathway first.');if(s.modules.some(x=>x.course_id===m.course_id&&x.position<m.position&&!s.progress.some(a=>a.module_id===x.id&&a.user_id===uid)))fail('Complete the earlier activities first.');return m;};
 const finish=(cid,uid)=>{const e=s.enrollments.find(e=>e.course_id===cid&&e.user_id===uid),mods=s.modules.filter(m=>m.course_id===cid);if(e){if(mods.length&&mods.every(m=>s.progress.some(p=>p.module_id===m.id&&p.user_id===uid))){e.completed_at||=iso;e.credential_id||=uuid();}else{e.completed_at=null;e.credential_id=null;}}};
 let item,id;
 switch(name){
 case 'saveCohort':{
  id=p.id||uuid();const old=s.cohorts.find(c=>c.id===id);if(old&&!demoManager(s,u,role,old))fail('You do not manage this cohort.');
  const instructor=p.instructor_id||old?.instructor_id||u;if(role!=='admin'&&instructor!==u)fail('Only a campus administrator can assign another instructor.');
  if(!s.members.some(m=>m.user_id===instructor&&m.active!==false&&['staff','admin'].includes(m.role)))fail('Choose an active staff instructor.');
  if(p.course_id)find('courses',p.course_id);const status=choice(p.status||'active',['active','archived'],'cohort status');
  if(old&&old.instructor_id!==instructor&&s.class_sessions.some(x=>x.cohort_id===id))fail('The instructor is locked after sessions are scheduled.');
  if(status==='archived'&&s.class_sessions.some(x=>x.cohort_id===id&&x.is_live))fail('End the live classroom before archiving this cohort.');
  upsert(s.cohorts,{id,title:required(p.title,'Title',160),description:String(p.description||''),course_id:p.course_id||null,instructor_id:instructor,status,created_at:old?.created_at||iso});break;}
 case 'setCohortMember':{
  const cohort=find('cohorts',p.cohort_id);if(!demoManager(s,u,role,cohort))fail('You do not manage this cohort.');
  if(!s.members.some(m=>m.user_id===p.user_id&&m.active!==false&&['student','staff'].includes(m.role)))fail('Choose an active campus student or staff member.');
  const old=s.cohort_members.find(m=>m.cohort_id===cohort.id&&m.user_id===p.user_id);upsert(s.cohort_members,{cohort_id:cohort.id,user_id:p.user_id,active:p.active!==false,joined_at:old?.joined_at||iso},['cohort_id','user_id']);id=cohort.id;break;}
 case 'saveClassSession':{
  id=p.id||uuid();const old=s.class_sessions.find(x=>x.id===id);if(old&&!(role==='admin'||old.instructor_id===u))fail('You do not manage this session.');
  const audience=choice(p.audience,['cohort','campus'],'audience'),cohort_id=p.cohort_id||null,event_id=p.event_id||null;let instructor;
  if(audience==='cohort'){const cohort=find('cohorts',cohort_id);if(cohort.status!=='active'||!demoManager(s,u,role,cohort))fail('Choose an active cohort you manage.');instructor=cohort.instructor_id;}
  else {if(cohort_id)fail('A campus session cannot also belong to a cohort.');instructor=p.instructor_id||old?.instructor_id||u;if(role!=='admin'&&instructor!==u)fail('Only an administrator can assign another instructor.');}
  if(!s.members.some(m=>m.user_id===instructor&&m.active!==false&&['staff','admin'].includes(m.role)))fail('Choose an active staff instructor.');if(event_id)find('events',event_id);
  if(old&&(old.cohort_id!==cohort_id||old.event_id!==event_id||old.instructor_id!==instructor||old.audience!==audience))fail('A scheduled session cannot change its cohort, event, instructor or audience. Create a separate session.');
  const starts_at=datetime(p.starts_at,'start time'),ends_at=datetime(p.ends_at,'end time'),status=choice(p.status||'scheduled',['scheduled','cancelled'],'session status');if(ends_at<=starts_at)fail('The end time must be after the start time.');
  if(old&&status==='cancelled'&&old.is_live)fail('End the live classroom before cancelling the session.');
  if(old&&(starts_at!==old.starts_at||ends_at!==old.ends_at)&&s.session_attendance.some(a=>a.session_id===id))fail('Session dates are locked after meeting activity begins. Create a new session.');
  upsert(s.class_sessions,{...old,id,cohort_id,event_id,title:required(p.title,'Title',120),description:String(p.description||''),starts_at,ends_at,status,audience,instructor_id:instructor,room_id:old?.room_id||uuid(),room_slug:old?.room_slug||'htc-'+uuid().replace(/-/g,'').slice(0,24),is_live:old?.is_live||false,recording_url:old?.recording_url||null,replay_published:old?.replay_published||false});break;}
 case 'demoJoinSession':case 'demoLeaveSession':{
  const session=find('class_sessions',p.session_id);if(!demoSessionAllowed(s,u,role,session))fail('This session is not available for your current classroom access.');
  s._session_joins||=[];const joined=s._session_joins.some(a=>a.session_id===session.id&&a.user_id===u);
  if(name==='demoJoinSession'&&!joined){const old=s.session_attendance.find(a=>a.session_id===session.id&&a.user_id===u);upsert(s.session_attendance,{session_id:session.id,user_id:u,first_joined_at:old?.first_joined_at||iso,last_joined_at:iso,joins:(old?.joins||0)+1},['session_id','user_id']);s._session_joins.push({session_id:session.id,user_id:u});}
  if(name==='demoLeaveSession')s._session_joins=s._session_joins.filter(a=>a.session_id!==session.id||a.user_id!==u);id=session.id;break;}
 case 'rsvp':{
  const e=find('events',p.event_id),status=choice(p.status||'going',['going','cancelled'],'RSVP status');if(e.status!=='published')fail('This event is not available.');if(status==='going'&&new Date(e.ends_at).getTime()<now)fail('This event has ended.');
  if(status==='going'&&e.capacity&&!s.rsvps.some(r=>r.event_id===e.id&&r.user_id===u&&r.status==='going')&&s.rsvps.filter(r=>r.event_id===e.id&&r.status==='going').length>=e.capacity)fail('This event is full.');upsert(s.rsvps,{event_id:e.id,user_id:u,status,created_at:iso},['event_id','user_id']);break;}
 case 'checkin':{
  const e=find('events',p.event_id);if(e.status!=='published')fail('This event is not available.');if(now<new Date(e.starts_at).getTime()-1800000||now>new Date(e.ends_at).getTime()+7200000)fail('Check-in opens 30 minutes before the event and closes two hours after it ends.');if(String(p.code||'').trim().toUpperCase()!==s._codes[e.id])fail('That check-in code is not correct. Ask your host for the code.');if(!s.rsvps.some(r=>r.event_id===e.id&&r.user_id===u&&r.status==='going'))fail('RSVP before checking in.');if(!s.attendance.some(a=>a.event_id===e.id&&a.user_id===u))s.attendance.push({event_id:e.id,user_id:u,checked_in_at:iso});break;}
 case 'undoCheckin':s.attendance=s.attendance.filter(a=>a.event_id!==p.event_id||a.user_id!==u);break;
 case 'enroll':{
  const c=find('courses',p.course_id);if(c.status!=='published'||!s.modules.some(m=>m.course_id===c.id))fail('This pathway is not available for enrollment.');if(!s.enrollments.some(e=>e.course_id===c.id&&e.user_id===u))s.enrollments.push({course_id:c.id,user_id:u,enrolled_at:iso,completed_at:null,credential_id:null});break;}
 case 'completeModule':{
  const m=learning(p.module_id);if(m.question){if(p.answer_index===undefined||p.answer_index===null||Number(p.answer_index)!==m.answer_index)fail('Review the lesson and try the knowledge check again.');upsert(s._checks,{module_id:m.id,user_id:u},['module_id','user_id']);}if(!m.assignment_prompt){upsert(s.progress,{module_id:m.id,user_id:u,completed_at:iso},['module_id','user_id']);finish(m.course_id,u);}break;}
 case 'submitWork':{
  const m=learning(p.module_id),old=s.submissions.find(x=>x.module_id===m.id&&x.user_id===u);if(!m.assignment_prompt)fail('This activity does not have an assignment.');if(m.question&&!s._checks.some(c=>c.module_id===m.id&&c.user_id===u))fail('Pass the knowledge check before submitting work.');if(old?.status==='approved')fail('This work is already approved.');upsert(s.submissions,{id:old?.id||uuid(),module_id:m.id,user_id:u,body:required(p.body,'Your work',20000),link_url:url(p.link_url),status:'submitted',feedback:old?.feedback||null,submitted_at:iso,reviewed_at:null});break;}
 case 'reviewWork':{
  const a=find('submissions',p.id),m=learning(a.module_id,a.user_id),status=choice(p.status,['approved','revision'],'review status'),feedback=required(p.feedback,'Feedback');if(status==='approved'){if(m.question&&!s._checks.some(c=>c.module_id===m.id&&c.user_id===a.user_id))fail('The knowledge check must be completed first.');upsert(s.progress,{module_id:m.id,user_id:a.user_id,completed_at:iso},['module_id','user_id']);}else{s.progress=s.progress.filter(x=>x.user_id!==a.user_id||!s.modules.some(k=>k.id===x.module_id&&k.course_id===m.course_id&&k.position>=m.position));s._checks=s._checks.filter(x=>x.user_id!==a.user_id||!s.modules.some(k=>k.id===x.module_id&&k.course_id===m.course_id&&k.position>=m.position));for(const later of s.submissions.filter(x=>x.user_id===a.user_id&&s.modules.some(k=>k.id===x.module_id&&k.course_id===m.course_id&&k.position>m.position)))Object.assign(later,{status:'revision',feedback:'An earlier activity needs revision. Complete it, then review and resubmit this work.',reviewed_at:iso});}Object.assign(a,{status,feedback,reviewed_at:iso});finish(m.course_id,a.user_id);notify(a.user_id,'Feedback on your work',feedback,'/ht/hub/learn/');break;}
 case 'createRequest':id=uuid();s.requests.push({id,user_id:u,category:choice(p.category,['Learning','Career','Technology','Campus life'],'support category'),subject:required(p.subject,'Subject',160),body:required(p.body,'Request'),status:'open',assigned_to:null,created_at:iso});notify(u,'Your request was received','You can follow the response in Student support.','/ht/hub/support/');break;
 case 'updateRequest':item=find('requests',p.id);item.status=choice(p.status,['open','in_progress','resolved'],'request status');if(Object.hasOwn(p,'assigned_to')){if(p.assigned_to&&!s.members.some(m=>m.user_id===p.assigned_to&&['staff','admin'].includes(m.role)))fail('Choose an active staff member.');item.assigned_to=p.assigned_to||null;}notify(item.user_id,'Your support request was updated',item.subject,'/ht/hub/support/');break;
 case 'replyRequest':item=find('requests',p.request_id);if(!staff&&item.user_id!==u)fail('This support request is not available to you.');s.responses.push({id:uuid(),request_id:item.id,author_id:u,body:required(p.body,'Reply'),created_at:iso});if(item.user_id!==u)notify(item.user_id,'A reply to your support request',item.subject,'/ht/hub/support/');else if(item.assigned_to)notify(item.assigned_to,'A student replied',item.subject,'/ht/hub/support/');break;
 case 'post':id=uuid();s.posts.unshift({id,author_id:u,channel:required(p.channel,'Channel',60),body:required(p.body,'Post',5000),created_at:iso});break;
 case 'reply':find('posts',p.post_id);s.replies.push({id:uuid(),post_id:p.post_id,author_id:u,body:required(p.body,'Reply',5000),created_at:iso});break;
 case 'like':find('posts',p.post_id);s.likes=s.likes.filter(x=>x.post_id!==p.post_id||x.user_id!==u);if(p.liked)s.likes.push({post_id:p.post_id,user_id:u});break;
 case 'sendMessage':if(p.recipient_id===u||!demoActive(s,p.recipient_id))fail('Choose another active campus member.');s.messages.push({id:uuid(),sender_id:u,recipient_id:p.recipient_id,body:required(p.body,'Message',5000),created_at:iso,read_at:null});notify(p.recipient_id,'A new campus message','Open your campus messages to read it.',`/ht/hub/messages/?person=${u}`);break;
 case 'readMessages':{
  if(!Array.isArray(p.message_ids)||p.message_ids.length>200||p.message_ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))fail('Choose up to 200 valid message IDs.');
  const ids=new Set(p.message_ids.map(id=>id.toLowerCase())),incoming=s.messages.filter(m=>ids.has(m.id.toLowerCase())&&m.recipient_id===u);
  if(incoming.length!==ids.size)fail('Only messages addressed to you can be marked as read.');
  for(const message of incoming)message.read_at||=iso;
  break;}
 case 'readNotification':item=s.notifications.find(n=>n.id===p.id&&n.user_id===u);if(item)item.read_at||=iso;break;
 case 'saveAnnouncement':id=p.id||uuid();upsert(s.announcements,{id,title:required(p.title,'Title',160),body:required(p.body,'Announcement'),office:String(p.office||'Campus'),audience:choice(p.audience||'campus',['campus','students','staff'],'audience'),status:choice(p.status||'draft',['draft','published'],'publication status'),publish_at:p.publish_at?datetime(p.publish_at,'publication time'):iso,created_at:s.announcements.find(a=>a.id===id)?.created_at||iso,author_id:s.announcements.find(a=>a.id===id)?.author_id||u});break;
 case 'saveEvent':{
  id=p.id||uuid();const starts_at=datetime(p.starts_at,'start time'),ends_at=datetime(p.ends_at,'end time'),capacity=p.capacity==null||p.capacity===''?null:Number(p.capacity);if(ends_at<=starts_at)fail('The end time must be after the start time.');if(capacity!==null&&(!Number.isInteger(capacity)||capacity<1))fail('Capacity must be a positive whole number.');if(capacity!==null&&capacity<s.rsvps.filter(a=>a.event_id===id&&a.status==='going').length)fail('Capacity cannot be below the current RSVP count.');const code=String(p.checkin_code||'').trim().toUpperCase();if(code&&(code.length<4||code.length>40))fail('Use a check-in code of 4–40 characters.');upsert(s.events,{id,title:required(p.title,'Title',160),description:String(p.description||''),office:String(p.office||'Campus'),location:String(p.location||''),starts_at,ends_at,capacity,status:choice(p.status||'draft',['draft','published','cancelled'],'event status'),join_url:url(p.join_url)});if(code)s._codes[id]=code;break;}
 case 'saveCourse':id=p.id||uuid();if(p.status==='published'&&!s.modules.some(m=>m.course_id===id))fail('Save a draft, add an activity, then publish the pathway.');upsert(s.courses,{id,title:required(p.title,'Title',160),description:String(p.description||''),category:String(p.category||'Learning'),status:choice(p.status||'draft',['draft','published'],'pathway status'),image_url:url(p.image_url)});break;
 case 'saveModule':{
  find('courses',p.course_id);id=p.id||uuid();if(s.modules.some(m=>m.id===id&&m.course_id!==p.course_id))fail('An activity cannot be moved between pathways.');if(s.enrollments.some(e=>e.course_id===p.course_id))fail('Learning requirements are locked after enrollment. Create a new pathway version to change them.');const position=Number(p.position),question=String(p.question||'').trim()||null,options=question?p.options:[],answer_index=question?Number(p.answer_index):null;if(!Number.isInteger(position)||position<1)fail('Position must be a positive whole number.');if(s.modules.some(m=>m.course_id===p.course_id&&m.position===position&&m.id!==id))fail('Another activity already uses that position.');if(question&&(!Array.isArray(options)||options.length<2||options.length>8||options.some(o=>typeof o!=='string'||!o.trim())||!Number.isInteger(answer_index)||answer_index<0||answer_index>=options.length))fail('Add 2–8 answers and select the correct answer.');upsert(s.modules,{id,course_id:p.course_id,title:required(p.title,'Title',160),body:required(p.body,'Lesson',20000),position,resource_url:url(p.resource_url),question,options,answer_index,assignment_prompt:String(p.assignment_prompt||'').trim()||null});break;}
 case 'saveSettings':s.settings={ada_video_url:url(p.ada_video_url)||'',ada_video_poster:url(p.ada_video_poster)||'',ada_video_transcript:String(p.ada_video_transcript||''),support_email:String(p.support_email||'').trim()};break;
 default:fail('Unknown campus action.');
 }
 return {ok:true,id:id||null};
}

/** Optional dependency injection is for automated tests; browser use needs no args. */
export function createCampusStore(options={}) {
 const win=options.window||globalThis.window,now=options.now||(()=>Date.now());
 const requested=options.demoRole??new URLSearchParams(win?.location?.search||'').get('demo');
 const role=['student','staff','leadership'].includes(requested)?requested:null;
 let storage=options.storage;try{storage??=win?.localStorage;}catch{/* memory demo remains usable */}
 let data=null,client=options.client||null,clientPromise=null,destroyed=false,timer=null,authSubscription=null,current=empty(),authEpoch=0,observedUserId,watchingAuth=false;
 const listeners=new Set();const emit=(event={reason:'refresh'})=>{if(!destroyed)listeners.forEach(fn=>fn(event));};
 const readDemo=()=>{let saved=null;try{saved=JSON.parse(storage?.getItem(DEMO_KEY)||'null');}catch{/* invalid sample state resets only sample data */}data=saved?.version===2&&COLLECTIONS.every(k=>Array.isArray(saved[k]))&&saved._codes&&Array.isArray(saved._checks)?saved:data||fixtures(now());return data;};
 const watchAuth=sb=>{if(watchingAuth)return;watchingAuth=true;authSubscription=sb.auth.onAuthStateChange?.((event,session)=>{
  const user_id=session?.user?.id||null;
  const identityChanged=event==='SIGNED_OUT'||(observedUserId!==undefined&&user_id!==observedUserId);
  observedUserId=user_id;
  if(identityChanged){authEpoch++;current=empty();}
  if(['SIGNED_OUT','SIGNED_IN','USER_UPDATED','PASSWORD_RECOVERY'].includes(event))queueMicrotask(()=>emit({reason:'auth',event,user_id}));
 })?.data?.subscription;};
 const getClient=async()=>{if(client){watchAuth(client);return client;}if(!clientPromise)clientPromise=(async()=>{const config=win?.BM_CONFIG;if(!config?.SUPABASE_URL||!config?.SUPABASE_KEY)throw new Error('The HT Hub service is not configured.');const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');client=createClient(config.SUPABASE_URL,config.SUPABASE_KEY);watchAuth(client);return client;})();return clientPromise;};
 const humanError=e=>{const message=String(e?.message||'The campus service could not be reached.');if(/ht_campus|schema cache|does not exist/i.test(message))return 'The campus database upgrade has not been activated yet. Your existing Academy account is unchanged.';if(/fetch|network/i.test(message))return 'The campus service could not be reached. Check your connection and try again.';if(/violates|invalid input|not-null|check constraint/i.test(message))return 'Please check the required fields, dates, and secure links, then try again.';return message;};
 async function load(){
  if(role){current=filterDemo(readDemo(),role,now());return current;}
  let user=null;const epoch=authEpoch;
  try{const sb=await getClient();const {data:sessionData,error:sessionError}=await sb.auth.getSession();if(epoch!==authEpoch||destroyed)return current;if(sessionError)throw sessionError;user=sessionData?.session?.user||null;observedUserId=user?.id||null;
   if(!user){current=filterDemo(fixtures(now()),null,now());return current;}
   const result=await sb.rpc('ht_campus_state');if(epoch!==authEpoch||destroyed)return current;if(result.error)throw result.error;
   current={...empty(),...result.data,mode:'live',user:{id:user.id,email:user.email||''},error:null};return current;
  }catch(e){if(epoch!==authEpoch||destroyed)return current;current={...empty(),user:user?{id:user.id,email:user.email||''}:null,error:humanError(e)};return current;}
 }
 async function command(name,payload={}){
  if(destroyed)throw new Error('The campus session has ended. Reload this page.');
  if(role){const next=clone(readDemo());const result=demoCommand(next,role,name,payload,now());data=next;try{storage?.setItem(DEMO_KEY,JSON.stringify(data));}catch{/* in-memory demonstration */}emit();return result;}
  if(current.mode!=='live')throw new Error(current.error||'Sign in with an active HT Hub membership to make changes.');
  const epoch=authEpoch;try{const sb=await getClient();if(epoch!==authEpoch)throw new Error('Your campus account changed. Reload before continuing.');const result=await sb.rpc('ht_campus_command',{p_name:name,p_payload:payload});if(result.error)throw result.error;if(epoch===authEpoch)emit();return result.data;}catch(e){throw new Error(humanError(e));}
 }
 const onStorage=e=>{if(role&&e.key===DEMO_KEY){data=null;emit();}};
 const onFocus=()=>emit();win?.addEventListener?.('storage',onStorage);win?.addEventListener?.('focus',onFocus);
 if(win?.setInterval)timer=win.setInterval(()=>{if(win.document?.visibilityState!=='hidden')emit();},15000);
 return {load,command,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){destroyed=true;listeners.clear();if(timer)win.clearInterval(timer);win?.removeEventListener?.('storage',onStorage);win?.removeEventListener?.('focus',onFocus);authSubscription?.unsubscribe();}};
}
