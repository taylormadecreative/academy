// HT Hub staff, student support, and aggregate leadership surfaces.
// Authorization is repeated on the server; these guards keep the UI role-appropriate.
const uiByMember = new Map();
const staffRoles = new Set(['staff', 'admin']);
const sections = [['announcements', 'Announcements'], ['events', 'Events'], ['learning', 'Learning'], ['reviews', 'Review work'], ['settings', 'Settings']];
const requestCategories = ['Learning', 'Career', 'Technology', 'Campus life'];
const requestStatuses = [['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved']];
const metricLabels = [['members', 'Campus members'], ['active_learners', 'Learners enrolled'], ['enrollments', 'Course enrollments'], ['completions', 'Course completions'], ['rsvps', 'Event RSVPs'], ['checkins', 'Event check-ins'], ['open_requests', 'Open support requests'], ['unanswered_requests', 'Unanswered support requests'], ['announcements', 'Published announcements']];
const list = value => Array.isArray(value) ? value : [];
const role = ctx => ctx.state.member?.role;
const staff = ctx => staffRoles.has(role(ctx));
const canUse = ctx => !!ctx.state.user && !!ctx.state.member && ['live', 'demo'].includes(ctx.state.mode);
const uid = ctx => ctx.state.user?.id || ctx.state.member?.user_id;
const e = (ctx, value) => ctx.esc(String(value ?? ''));
const selected = (a, b) => String(a ?? '') === String(b ?? '') ? ' selected' : '';
const option = (ctx, value, text, current) => `<option value="${e(ctx, value)}"${selected(value, current)}>${e(ctx, text)}</option>`;
const find = (items, id) => list(items).find(item => item.id === id);
const formId = form => form.elements.namedItem('id')?.value || undefined;
const textValue = (form, name) => String(form.elements.namedItem(name)?.value || '').trim();
const displayName = (ctx, id) => list(ctx.state.members).find(person => person.user_id === id)?.display_name || (id === uid(ctx) ? ctx.state.member?.display_name || 'You' : 'Campus member');
const prettyStatus = value => ({open:'Open', in_progress:'In progress', resolved:'Resolved', submitted:'Awaiting review', revision:'Revision requested', approved:'Approved', draft:'Draft', published:'Published', cancelled:'Cancelled'}[value] || value);
function memory(ctx) {
  const key = `${ctx.state.mode}:${uid(ctx) || 'guest'}:${role(ctx) || 'guest'}`;
  if (!uiByMember.has(key)) uiByMember.set(key, {tab:'announcements', announcement:null, event:null, course:null, module:null, request:null, requestFilter:'active', reviewFilter:'submitted'});
  return uiByMember.get(key);
}
function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function time(ctx, value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not scheduled';
  return `${e(ctx, ctx.formatDate(value))} · ${e(ctx, ctx.formatTime(value))}`;
}
function field(ctx, label, name, value='', extra='', type='text') {
  return `<label class="campus-field"><span>${e(ctx,label)}</span><input type="${type}" name="${name}" value="${e(ctx,value)}" ${extra}></label>`;
}
function textarea(ctx, label, name, value='', extra='') {
  return `<label class="campus-field"><span>${e(ctx,label)}</span><textarea name="${name}" rows="4" ${extra}>${e(ctx,value)}</textarea></label>`;
}
function select(ctx, label, name, values, current) {
  return `<label class="campus-field"><span>${e(ctx,label)}</span><select name="${name}" aria-label="${e(ctx,label)}">${values.map(item => option(ctx, item[0], item[1], current)).join('')}</select></label>`;
}
const empty = (ctx, message) => `<p class="campus-empty">${e(ctx,message)}</p>`;
function safeLink(ctx, value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return `<a class="campus-text-link" href="${e(ctx,url.href)}" target="_blank" rel="noopener noreferrer">${e(ctx,label)} ${ctx.icon('arrow-up-right')}</a>`;
  } catch { return ''; }
}
function heading(ctx, title, body, action='') {
  return `<header class="campus-section-head"><div><h2>${e(ctx,title)}</h2>${body ? `<p class="campus-muted">${e(ctx,body)}</p>`:''}</div>${action}</header>`;
}
function actions(label, cancel='') {
  return `<div class="campus-form-actions"><button type="submit" class="campus-button">${label}</button>${cancel ? `<button type="button" class="campus-button campus-button-secondary" data-action="${cancel}">Cancel editing</button>`:''}</div>`;
}
function announcementPanel(ctx, ui) {
  const current = find(ctx.state.announcements, ui.announcement);
  const notices = [...list(ctx.state.announcements)].sort((a,b) => new Date(b.created_at || 0)-new Date(a.created_at || 0));
  return `<section class="campus-panel">${heading(ctx,current?'Edit announcement':'Write an announcement','Draft, schedule, or publish a message to the right audience.')}
    <form data-form="announcement" class="campus-form">
      ${current ? `<input type="hidden" name="id" value="${e(ctx,current.id)}">`:''}
      ${field(ctx,'Title','title',current?.title,'required maxlength="160"')}
      ${textarea(ctx,'Message','body',current?.body,'required maxlength="10000"')}
      <div class="campus-grid">${field(ctx,'Office','office',current?.office || 'Office of the President','required maxlength="120"')}${select(ctx,'Audience','audience',[['campus','Everyone on campus'],['students','Students'],['staff','Staff']],current?.audience || 'campus')}</div>
      <div class="campus-grid">${select(ctx,'Publication','status',[['draft','Save as draft'],['published','Publish or schedule']],current?.status || 'draft')}${field(ctx,'Publish at (optional, your local time)','publish_at',localDateTime(current?.publish_at),'','datetime-local')}</div>
      <p class="campus-muted">A published message with a future date becomes visible at that time. Leave the date empty to publish now. A draft stays private to staff.</p>
      ${actions(current?'Save announcement':'Save announcement',current?'new-announcement':'')}
    </form>
  </section><section class="campus-panel">${heading(ctx,'Announcements','Published messages, scheduled messages, and drafts.')}
    <div class="campus-list">${notices.map(item => {
      const scheduled = item.status === 'published' && new Date(item.publish_at).getTime() > Date.now();
      return `<article class="campus-row"><div><span class="campus-label">${e(ctx,scheduled?'Scheduled':prettyStatus(item.status))} · ${e(ctx,item.audience)}</span><h3>${e(ctx,item.title)}</h3><p class="campus-muted">${e(ctx,item.office)}${item.publish_at ? ` · ${time(ctx,item.publish_at)}`:''}</p></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-action="edit-announcement" data-id="${e(ctx,item.id)}" aria-label="Edit ${e(ctx,item.title)}">Edit</button></article>`;
    }).join('') || empty(ctx,'No announcements yet. Save a draft to get started.')}</div>
  </section>`;
}
function eventPanel(ctx, ui) {
  const current = find(ctx.state.events, ui.event);
  const events = [...list(ctx.state.events)].sort((a,b) => new Date(a.starts_at)-new Date(b.starts_at));
  return `<section class="campus-panel">${heading(ctx,current?'Edit event':'Create an event','Keep event details, registration, and attendance together.')}
    <form data-form="event" class="campus-form">
      ${current ? `<input type="hidden" name="id" value="${e(ctx,current.id)}">`:''}
      ${field(ctx,'Event title','title',current?.title,'required maxlength="160"')}
      ${textarea(ctx,'Description','description',current?.description,'required maxlength="10000"')}
      <div class="campus-grid">${field(ctx,'Office','office',current?.office || 'Student Affairs','required maxlength="120"')}${field(ctx,'Location','location',current?.location,'required maxlength="300"')}</div>
      <div class="campus-grid">${field(ctx,'Starts (your local time)','starts_at',localDateTime(current?.starts_at),'required','datetime-local')}${field(ctx,'Ends (your local time)','ends_at',localDateTime(current?.ends_at),'required','datetime-local')}</div>
      <div class="campus-grid">${field(ctx,'Capacity (leave empty for no limit)','capacity',current?.capacity,'min="1" max="100000" step="1"','number')}${select(ctx,'Status','status',[['draft','Draft'],['published','Published'],['cancelled','Cancelled']],current?.status || 'draft')}</div>
      ${field(ctx,'Online join link (optional)','join_url',current?.join_url,'placeholder="https://…"','url')}
      <details class="campus-details"><summary>Check-in code</summary><p class="campus-muted">Share the code with attendees at the event. Codes are never included in public event details. ${current ? 'Leave this field empty to keep the existing code. Enter a new code to replace it.':'Set a code before inviting attendees to check in.'}</p>${field(ctx,current?'New check-in code (optional)':'Check-in code (optional)','checkin_code','','minlength="4" maxlength="40" autocomplete="off"')}</details>
      ${actions(current?'Save event':'Create event',current?'new-event':'')}
    </form>
  </section><section class="campus-panel">${heading(ctx,'Events','Choose an event to update its details or check-in code.')}
    <div class="campus-list">${events.map(item => `<article class="campus-row"><div><span class="campus-label">${e(ctx,prettyStatus(item.status))}</span><h3>${e(ctx,item.title)}</h3><p class="campus-muted">${time(ctx,item.starts_at)} · ${e(ctx,item.location)}</p></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-action="edit-event" data-id="${e(ctx,item.id)}" aria-label="Edit ${e(ctx,item.title)}">Edit</button></article>`).join('') || empty(ctx,'No events yet. Create a draft with the form above.')}</div>
  </section>`;
}
function learningPanel(ctx, ui) {
  const courses = list(ctx.state.courses);
  const current = find(courses, ui.course);
  const modules = list(ctx.state.modules).filter(item => item.course_id === current?.id).sort((a,b) => a.position-b.position);
  const module = modules.find(item => item.id === ui.module);
  const locked = !!current && list(ctx.state.enrollments).some(item => item.course_id === current.id);
  const nextPosition = modules.length ? Math.max(...modules.map(item => Number(item.position) || 0))+1 : 1;
  return `<section class="campus-panel">${heading(ctx,'Learning pathways','Build the pathway, add its learning steps, and publish when it is ready.')}
    <div class="campus-list">${courses.map(item => `<article class="campus-row"><div><span class="campus-label">${e(ctx,prettyStatus(item.status))} · ${e(ctx,item.category)}</span><h3>${e(ctx,item.title)}</h3><p class="campus-muted">${list(ctx.state.modules).filter(step => step.course_id===item.id).length} learning steps</p></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-action="edit-course" data-id="${e(ctx,item.id)}" aria-label="Edit ${e(ctx,item.title)}">${item.id===current?.id?'Editing':'Edit pathway'}</button></article>`).join('') || empty(ctx,'No pathways yet. Create the first pathway below.')}</div>
    ${current ? '<button type="button" class="campus-button campus-button-secondary" data-action="new-course">Create another pathway</button>':''}
  </section>
  <section class="campus-panel">${heading(ctx,current?'Pathway details':'Create a pathway','Students see published pathways only.')}
    <form data-form="course" class="campus-form">
      ${current ? `<input type="hidden" name="id" value="${e(ctx,current.id)}">`:''}
      ${field(ctx,'Pathway title','title',current?.title,'required maxlength="160"')}
      ${textarea(ctx,'Description and learning goals','description',current?.description,'required maxlength="10000"')}
      <div class="campus-grid">${field(ctx,'Category','category',current?.category || 'AI Literacy','required maxlength="100"')}${select(ctx,'Status','status',[['draft','Draft'],['published','Published']],current?.status || 'draft')}</div>
      ${field(ctx,'Cover image URL (optional)','image_url',current?.image_url,'placeholder="https://…"','url')}
      ${actions(current?'Save pathway':'Create pathway')}
      ${!current ? '<p class="campus-muted">Create the pathway, then choose Edit pathway above to add learning steps.</p>':''}
    </form>
  </section>
  ${current ? `<section class="campus-panel">${heading(ctx,`Learning steps · ${current.title}`,'Steps are completed in order. Projects require staff approval before completion.')}
    <ol class="campus-list campus-step-list">${modules.map(item => `<li class="campus-row"><div><span class="campus-label">Step ${e(ctx,item.position)}${item.question?' · Knowledge check':''}${item.assignment_prompt?' · Project':''}</span><h3>${e(ctx,item.title)}</h3></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-action="edit-module" data-id="${e(ctx,item.id)}" aria-label="Edit ${e(ctx,item.title)}">Edit</button></li>`).join('') || empty(ctx,'Add the first learning step below.')}</ol>
    ${locked ? '<p class="campus-muted">Learning requirements are locked because students have enrolled. You can inspect the steps here. Create a new pathway version to change its requirements; enrolled students keep their existing pathway.</p>' : ''}
    <h3>${module?'Learning step details':'Add learning step'}</h3>
    <form data-form="module" class="campus-form"><fieldset class="campus-form-fields"${locked?' disabled':''}><legend class="campus-sr-only">Learning step editor</legend>
      ${module ? `<input type="hidden" name="id" value="${e(ctx,module.id)}">`:''}<input type="hidden" name="course_id" value="${e(ctx,current.id)}">
      <div class="campus-grid">${field(ctx,'Step title','title',module?.title,'required maxlength="160"')}${field(ctx,'Position','position',module?.position ?? nextPosition,'required min="1" max="10000" step="1"','number')}</div>
      ${textarea(ctx,'Lesson content','body',module?.body,'required maxlength="20000"')}
      ${field(ctx,'Learning resource URL (optional)','resource_url',module?.resource_url,'placeholder="https://…"','url')}
      <details class="campus-details"${module?.question?' open':''}><summary>Knowledge check (optional)</summary>
        ${textarea(ctx,'Question','question',module?.question,'maxlength="2000"')}
        ${textarea(ctx,'Answer options — one per line, two to eight options','options',list(module?.options).join('\n'),'maxlength="4000"')}
        ${field(ctx,'Correct answer number (1 is the first option)','answer_number',Number.isInteger(module?.answer_index)?module.answer_index+1:1,'min="1" max="8" step="1"','number')}
        <p class="campus-muted">The correct answer is checked on the server and is not included in student lesson data.</p>
      </details>
      <details class="campus-details"${module?.assignment_prompt?' open':''}><summary>Project and review criteria (optional)</summary>
        ${textarea(ctx,'Project instructions and approval criteria','assignment_prompt',module?.assignment_prompt,'maxlength="10000"')}
        <p class="campus-muted">Describe what to submit and the criteria staff will use to approve the work. Adding a project makes staff approval a requirement for this step.</p>
      </details>
      ${actions(module?'Save learning step':'Add learning step',module?'new-module':'')}
    </fieldset></form>
  </section>`:''}`;
}
function reviewPanel(ctx, ui) {
  const work = list(ctx.state.submissions).filter(item => ui.reviewFilter==='all' || item.status===ui.reviewFilter).sort((a,b) => new Date(a.submitted_at)-new Date(b.submitted_at));
  return `<section class="campus-panel">${heading(ctx,'Review student work','Use the project criteria to approve work or request a revision.')}
    <label class="campus-field campus-filter"><span>Show submissions</span><select data-review-filter>${[['submitted','Awaiting review'],['revision','Revision requested'],['approved','Approved'],['all','All submissions']].map(item => option(ctx,item[0],item[1],ui.reviewFilter)).join('')}</select></label>
    <div class="campus-review-list">${work.map(item => {
      const module=find(ctx.state.modules,item.module_id); const course=find(ctx.state.courses,module?.course_id);
      return `<article class="campus-review-card"><header><span class="campus-label">${e(ctx,prettyStatus(item.status))}</span><h3>${e(ctx,displayName(ctx,item.user_id))} · ${e(ctx,module?.title || 'Learning step')}</h3><p class="campus-muted">${e(ctx,course?.title || 'Pathway')} · Submitted ${time(ctx,item.submitted_at)}</p></header>
        ${module?.assignment_prompt ? `<details class="campus-details"><summary>Project instructions and approval criteria</summary><p class="campus-preserve-lines">${e(ctx,module.assignment_prompt)}</p></details>`:''}
        <p class="campus-preserve-lines">${e(ctx,item.body)}</p>${item.link_url ? safeLink(ctx,item.link_url,'Open submitted work'):''}
        <form data-form="review" class="campus-form"><input type="hidden" name="id" value="${e(ctx,item.id)}">
          ${textarea(ctx,'Feedback for the student','feedback',item.feedback,'required maxlength="10000"')}
          ${select(ctx,'Review decision','status',[['approved','Approve work'],['revision','Request a revision']],item.status==='revision'?'revision':'approved')}
          ${actions('Send review')}
        </form>
      </article>`;
    }).join('') || empty(ctx,'No submissions match this view.')}</div>
  </section>`;
}
function settingsPanel(ctx) {
  const settings=ctx.state.settings || {};
  return `<section class="campus-panel">${heading(ctx,'Welcome media and support','Use approved Ada video and transcript files supplied by your team.')}
    <form data-form="settings" class="campus-form">
      ${field(ctx,'Ada video URL','ada_video_url',settings.ada_video_url,'placeholder="https://…"','url')}
      ${field(ctx,'Video poster image URL (optional)','ada_video_poster',settings.ada_video_poster,'placeholder="https://…"','url')}
      ${textarea(ctx,'Video transcript','ada_video_transcript',settings.ada_video_transcript,'maxlength="30000"')}
      <p class="campus-muted">Use a direct browser-playable video URL. The transcript is displayed as text alongside the video.</p>
      ${field(ctx,'Support email','support_email',settings.support_email,'maxlength="254"','email')}
      ${actions('Save settings')}
    </form>
  </section>`;
}
function staffContent(ctx) {
  const ui=memory(ctx);
  const panel={announcements:announcementPanel,events:eventPanel,learning:learningPanel,reviews:reviewPanel,settings:settingsPanel}[ui.tab] || announcementPanel;
  return `<div class="campus-staff-tabs" role="tablist" aria-label="Staff workspace">${sections.map(([key,label]) => `<button type="button" id="campus-tab-${key}" role="tab" aria-selected="${ui.tab===key}" aria-controls="campus-staff-panel" tabindex="${ui.tab===key?'0':'-1'}" class="campus-tab" data-action="staff-tab" data-tab="${key}">${label}</button>`).join('')}</div><div id="campus-staff-panel" role="tabpanel" aria-labelledby="campus-tab-${ui.tab}" class="campus-staff-panel">${panel(ctx,ui)}</div>`;
}
function supportContent(ctx) {
  const ui=memory(ctx); const isStaff=staff(ctx);
  const requests=list(ctx.state.requests).filter(item => isStaff || item.user_id===uid(ctx));
  const filtered=requests.filter(item => ui.requestFilter==='all' || (ui.requestFilter==='active' ? item.status!=='resolved' : item.status===ui.requestFilter)).sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
  const current=requests.find(item => item.id===ui.request);
  const responses=current ? list(ctx.state.responses).filter(item => item.request_id===current.id).sort((a,b) => new Date(a.created_at)-new Date(b.created_at)) : [];
  const owners=list(ctx.state.members).filter(member => staffRoles.has(member.role));
  return `<div class="campus-support-layout"><section class="campus-panel">${heading(ctx,isStaff?'Support queue':'Your support requests',isStaff?'Respond, assign a staff owner, and keep each request moving.':'See replies from the campus team and follow your request.')}
    <label class="campus-field campus-filter"><span>Show requests</span><select data-request-filter>${[['active','Open and in progress'],['open','Open'],['in_progress','In progress'],['resolved','Resolved'],['all','All requests']].map(item => option(ctx,item[0],item[1],ui.requestFilter)).join('')}</select></label>
    <div class="campus-list">${filtered.map(item => `<button type="button" class="campus-request-item${current?.id===item.id?' campus-request-selected':''}" data-action="open-request" data-id="${e(ctx,item.id)}" aria-pressed="${current?.id===item.id}"><span class="campus-label">${e(ctx,item.category)} · ${e(ctx,prettyStatus(item.status))}</span><strong>${e(ctx,item.subject)}</strong><span class="campus-muted">${isStaff?`${e(ctx,displayName(ctx,item.user_id))} · `:''}${time(ctx,item.created_at)}</span></button>`).join('') || empty(ctx,'No requests match this view.')}</div>
  </section>
  <section class="campus-panel">${current ? `${heading(ctx,current.subject,`${current.category} · ${prettyStatus(current.status)}`, '<button type="button" class="campus-button campus-button-secondary campus-button-small" data-action="new-request">New request</button>')}
    <article class="campus-support-message"><h3>${e(ctx,displayName(ctx,current.user_id))}</h3><p class="campus-muted">${time(ctx,current.created_at)}</p><p class="campus-preserve-lines">${e(ctx,current.body)}</p></article>
    <div class="campus-support-thread" aria-label="Request replies">${responses.map(item => `<article class="campus-support-message"><h3>${e(ctx,displayName(ctx,item.author_id))}</h3><p class="campus-muted">${time(ctx,item.created_at)}</p><p class="campus-preserve-lines">${e(ctx,item.body)}</p></article>`).join('') || '<p class="campus-muted">No replies yet.</p>'}</div>
    ${isStaff ? `<form data-form="request-status" class="campus-form"><input type="hidden" name="id" value="${e(ctx,current.id)}"><div class="campus-grid">${select(ctx,'Status','status',requestStatuses,current.status)}${select(ctx,'Staff owner','assigned_to',[['','Unassigned'],...owners.map(person => [person.user_id,person.display_name])],current.assigned_to || '')}</div>${actions('Update request')}</form>`:''}
    ${current.status!=='resolved' || isStaff ? `<form data-form="request-reply" class="campus-form"><input type="hidden" name="request_id" value="${e(ctx,current.id)}">${textarea(ctx,'Reply','body','','required maxlength="10000"')}${actions('Send reply')}</form>`:'<p class="campus-muted">This request is resolved. Start a new request if you need more help.</p>'}` : `${heading(ctx,'How can we help?','Choose a topic and the campus support team can follow up here.')}
    <form data-form="request-new" class="campus-form">${select(ctx,'Topic','category',requestCategories.map(category => [category,category]),'Learning')}${field(ctx,'Subject','subject','','required maxlength="160"')}${textarea(ctx,'What do you need help with?','body','','required maxlength="10000"')}${actions('Send request')}</form>`}
  </section></div>`;
}
function insightsContent(ctx) {
  const metrics=ctx.state.metrics;
  if (!metrics || typeof metrics!=='object') return `<section class="campus-panel">${heading(ctx,'Campus overview','Aggregate reporting becomes available after your campus data connection is ready.')}${empty(ctx,'No verified totals are available yet.')}</section>`;
  return `<section class="campus-panel">${heading(ctx,ctx.state.mode==='demo'?'Sample campus overview':'Campus overview',ctx.state.mode==='demo'?'Illustrative demo totals, not actual university results. Individual student records are kept out of this report.':'Current totals from the campus data service. Individual student records are kept out of this report.','<button type="button" class="campus-button campus-button-secondary" data-action="export-metrics">Export CSV</button>')}
    <div class="campus-metric-grid">${metricLabels.map(([key,label]) => `<article class="campus-metric"><span class="campus-muted">${label}</span><strong>${typeof metrics[key]==='number' && Number.isFinite(metrics[key]) ? e(ctx,metrics[key].toLocaleString()) : 'Not available'}</strong></article>`).join('')}</div>
    <p class="campus-muted">Learners enrolled counts distinct people with a course enrollment, not recent activity. Enrollments and completions count course records; RSVPs and check-ins count event records. They may include the same person more than once.</p>
  </section>`;
}
function content(view,ctx) {
  if (!canUse(ctx)) return `<section class="campus-panel">${heading(ctx,ctx.state.mode==='unavailable'?'Campus service unavailable':'Sign in to your campus hub',ctx.state.mode==='unavailable'?'Please try again when the connection is restored.':'Use your approved campus membership to access support and your workspace.')}${ctx.state.mode==='unavailable'?'<button type="button" class="campus-button" data-action="retry">Try again</button>':`<a class="campus-button" href="/login/?next=${e(ctx,encodeURIComponent(ctx.href(view)))}">Sign in</a>`}</section>`;
  if (view==='staff') return staff(ctx) ? staffContent(ctx) : empty(ctx,'This workspace is available to campus staff.');
  if (view==='insights') return ['staff','admin','leadership'].includes(role(ctx)) ? insightsContent(ctx) : empty(ctx,'Campus reporting is available to authorized university staff and leadership.');
  if (view==='support') return supportContent(ctx);
  return empty(ctx,'This workspace is not available.');
}
export function renderStaff(view,ctx) { return `<div data-campus-staff-view="${e(ctx,view)}" class="campus-workspace">${content(view,ctx)}</div>`; }
function validateUrl(value,label) {
  if (!value) return null;
  let url;
  try { url=new URL(value); } catch { throw new Error(`${label} must be a complete https:// URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must use https:// and cannot contain sign-in credentials.`);
  return url.href;
}
function iso(value,label) {
  const date=new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error(`Choose a valid ${label}.`);
  return date.toISOString();
}
function requireText(form,name,label) {
  const value=textValue(form,name); if (!value) throw new Error(`${label} is required.`); return value;
}
function payloadFor(form,ctx) {
  const name=form.dataset.form; const id=formId(form);
  if (name==='announcement') return ['saveAnnouncement',{...(id?{id}:{}),title:requireText(form,'title','Title'),body:requireText(form,'body','Message'),office:requireText(form,'office','Office'),audience:textValue(form,'audience'),status:textValue(form,'status'),publish_at:textValue(form,'publish_at')?iso(textValue(form,'publish_at'),'publication date'):null},'Announcement saved.'];
  if (name==='event') {
    const starts_at=iso(textValue(form,'starts_at'),'start date'); const ends_at=iso(textValue(form,'ends_at'),'end date');
    if (new Date(ends_at)<=new Date(starts_at)) throw new Error('The end time must be after the start time.');
    const capacity=textValue(form,'capacity')?Number(textValue(form,'capacity')):null;
    if (capacity!==null && (!Number.isInteger(capacity) || capacity<1 || capacity>100000)) throw new Error('Capacity must be a whole number between 1 and 100,000.');
    const code=textValue(form,'checkin_code');
    if (code && (code.length<4 || code.length>40)) throw new Error('Use a check-in code between 4 and 40 characters.');
    return ['saveEvent',{...(id?{id}:{}),title:requireText(form,'title','Title'),description:requireText(form,'description','Description'),office:requireText(form,'office','Office'),location:requireText(form,'location','Location'),starts_at,ends_at,capacity,status:textValue(form,'status'),join_url:validateUrl(textValue(form,'join_url'),'Join link'),...(code?{checkin_code:code}:{})},'Event saved.'];
  }
  if (name==='course') {
    if (textValue(form,'status')==='published' && !list(ctx.state.modules).some(item => item.course_id===id)) throw new Error('Save the pathway as a draft, add a learning step, then publish it.');
    return ['saveCourse',{...(id?{id}:{}),title:requireText(form,'title','Title'),description:requireText(form,'description','Description'),category:requireText(form,'category','Category'),status:textValue(form,'status'),image_url:validateUrl(textValue(form,'image_url'),'Cover image URL')},'Pathway saved.'];
  }
  if (name==='module') {
    const course_id=textValue(form,'course_id'); const position=Number(textValue(form,'position'));
    if (!find(ctx.state.courses,course_id)) throw new Error('Select a valid pathway before saving a step.');
    if (list(ctx.state.enrollments).some(item => item.course_id===course_id)) throw new Error('Learning requirements are locked after enrollment. Create a new pathway version to change them.');
    if (!Number.isInteger(position) || position<1) throw new Error('Position must be a positive whole number.');
    if (list(ctx.state.modules).some(item => item.course_id===course_id && item.id!==id && Number(item.position)===position)) throw new Error('Another step already uses this position. Choose an unused position.');
    const question=textValue(form,'question'); const options=textValue(form,'options').split('\n').map(item => item.trim()).filter(Boolean); const answer=Number(textValue(form,'answer_number'))-1;
    if (question && (options.length<2 || options.length>8)) throw new Error('A knowledge check needs two to eight answer options, one per line.');
    if (question && (!Number.isInteger(answer) || answer<0 || answer>=options.length)) throw new Error('The correct answer number must match one of the answer options.');
    if (!question && options.length) throw new Error('Add a question for these answer options, or clear the options to remove the knowledge check.');
    if (question && new Set(options).size!==options.length) throw new Error('Each answer option must be different.');
    return ['saveModule',{...(id?{id}:{}),course_id,title:requireText(form,'title','Step title'),body:requireText(form,'body','Lesson content'),position,resource_url:validateUrl(textValue(form,'resource_url'),'Learning resource URL'),question:question || null,options:question?options:[],answer_index:question?answer:null,assignment_prompt:textValue(form,'assignment_prompt') || null},'Learning step saved.'];
  }
  if (name==='review') return ['reviewWork',{id,status:textValue(form,'status'),feedback:requireText(form,'feedback','Feedback')},'Review sent to the student.'];
  if (name==='settings') return ['saveSettings',{ada_video_url:validateUrl(textValue(form,'ada_video_url'),'Video URL') || '',ada_video_poster:validateUrl(textValue(form,'ada_video_poster'),'Poster image URL') || '',ada_video_transcript:textValue(form,'ada_video_transcript'),support_email:textValue(form,'support_email')},'Settings saved.'];
  if (name==='request-new') return ['createRequest',{category:textValue(form,'category'),subject:requireText(form,'subject','Subject'),body:requireText(form,'body','Request details')},'Your request has been sent.'];
  if (name==='request-status') return ['updateRequest',{id,status:textValue(form,'status'),assigned_to:textValue(form,'assigned_to') || null},'Request updated.'];
  if (name==='request-reply') return ['replyRequest',{request_id:textValue(form,'request_id'),body:requireText(form,'body','Reply')},'Reply sent.'];
  throw new Error('This action is not available.');
}
function exportMetrics(ctx) {
  const rows=[['Report',ctx.state.mode==='demo'?'SAMPLE DATA — illustrative HT campus overview':'HT campus overview'],['Generated at',new Date().toISOString()],['Scope','Current cumulative totals; no date filter'],['Learners enrolled definition','Distinct people with a course enrollment, not recent activity'],['Metric','Value'],...metricLabels.filter(([key]) => typeof ctx.state.metrics?.[key]==='number' && Number.isFinite(ctx.state.metrics[key])).map(([key,label]) => [label,ctx.state.metrics[key]])];
  const csv='\uFEFF'+rows.map(row => row.map(value => '"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const link=document.createElement('a');
  link.href=url; link.download=`ht-campus-${ctx.state.mode==='demo'?'SAMPLE-':''}overview-${new Date().toISOString().slice(0,10)}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  ctx.notify('Campus overview exported.');
}
export function bindStaff(view,root,ctx) {
  const mount=root.matches?.('[data-campus-staff-view]')?root:root.querySelector('[data-campus-staff-view]');
  if (!mount) return () => {};
  const ui=memory(ctx); let pending=false;
  const paint=() => { mount.innerHTML=content(view,ctx); ctx.restoreDrafts?.(); };
  const focusForm=(name='') => { const form=name?mount.querySelector(`form[data-form="${name}"]`):mount.querySelector('form'); form?.querySelector('input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)')?.focus(); };
  const click=event => {
    const button=event.target.closest?.('[data-action]'); if (!button || !mount.contains(button)) return;
    const action=button.dataset.action;
    if (action==='retry') { ctx.refresh(); return; }
    if (!canUse(ctx)) return;
    if (pending) { ctx.notify('Please wait for the current save to finish.','info'); return; }
    if (action==='export-metrics') { if (view==='insights' && ['staff','admin','leadership'].includes(role(ctx)) && ctx.state.metrics) exportMetrics(ctx); return; }
    if (action==='open-request') { if (view==='support' && list(ctx.state.requests).some(item => item.id===button.dataset.id && (staff(ctx)||item.user_id===uid(ctx)))) { ui.request=button.dataset.id; paint(); mount.querySelector('.campus-support-thread')?.scrollIntoView?.({block:'nearest'}); } return; }
    if (action==='new-request') { ui.request=null; paint(); focusForm(); return; }
    if (view!=='staff' || !staff(ctx)) return;
    if (action==='staff-tab') { if (sections.some(([key]) => key===button.dataset.tab)) { ui.tab=button.dataset.tab; paint(); mount.querySelector(`[data-tab="${ui.tab}"]`)?.focus(); } return; }
    const mapping={'edit-announcement':['announcement','announcements'],'edit-event':['event','events'],'edit-course':['course','courses'],'edit-module':['module','modules']};
    if (mapping[action]) { const [key,collection]=mapping[action]; if (find(ctx.state[collection],button.dataset.id)) { ui[key]=button.dataset.id; if (key==='course') ui.module=null; paint(); focusForm(key); } return; }
    const resets={'new-announcement':'announcement','new-event':'event','new-course':'course','new-module':'module'};
    if (resets[action]) { const form=button.closest('form') || mount.querySelector(`form[data-form="${resets[action]}"]`); ctx.discardDraft?.(form); ui[resets[action]]=null; if (action==='new-course') ui.module=null; paint(); focusForm(resets[action]); }
  };
  const submit=async event => {
    const form=event.target.closest?.('form[data-form]'); if (!form || !mount.contains(form)) return;
    event.preventDefault(); if (pending || !canUse(ctx)) return;
    const isPersonal=['request-new','request-reply'].includes(form.dataset.form);
    if (!isPersonal && !staff(ctx)) { ctx.notify('This action requires a campus staff account.','error'); return; }
    if (!form.reportValidity()) return;
    let task;
    try { task=payloadFor(form,ctx); } catch (error) { ctx.notify(error.message,'error'); return; }
    if (form.dataset.form==='request-reply' && !list(ctx.state.requests).some(item => item.id===task[1].request_id && (staff(ctx)||item.user_id===uid(ctx)))) { ctx.notify('You do not have access to this request.','error'); return; }
    const buttons=[...form.querySelectorAll('button[type="submit"]')]; pending=true; form.setAttribute('aria-busy','true'); buttons.forEach(button => { button.disabled=true; });
    try {
      const success=await ctx.run(...task,form);
      if (success) {
        // ctx.run refreshes from the service; clear only the successfully submitted form.
        if (!form.querySelector('input[name="id"]') && ['announcement','event','course','module','request-new'].includes(form.dataset.form)) form.reset();
        if (form.dataset.form==='request-reply') form.reset();
      }
    } catch (error) { ctx.notify(error.message || 'Your changes could not be saved. Please try again.','error'); }
    finally { pending=false; form.removeAttribute('aria-busy'); buttons.forEach(button => { button.disabled=false; }); }
  };
  const change=event => {
    if (pending) return;
    if (event.target.matches('[data-request-filter]')) { ui.requestFilter=event.target.value; paint(); mount.querySelector('[data-request-filter]')?.focus(); }
    if (event.target.matches('[data-review-filter]') && staff(ctx)) { ui.reviewFilter=event.target.value; paint(); mount.querySelector('[data-review-filter]')?.focus(); }
  };
  const keydown=event => {
    const tab=event.target.closest?.('[role="tab"]'); if (!tab || !mount.contains(tab)) return;
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); if (pending) return;
    const index=sections.findIndex(([key]) => key===tab.dataset.tab); let next=index;
    if (event.key==='Home') next=0; else if (event.key==='End') next=sections.length-1; else next=(index+(event.key==='ArrowRight'?1:-1)+sections.length)%sections.length;
    ui.tab=sections[next][0]; paint(); mount.querySelector(`[data-tab="${ui.tab}"]`)?.focus();
  };
  mount.addEventListener('click',click); mount.addEventListener('submit',submit); mount.addEventListener('change',change); mount.addEventListener('keydown',keydown);
  return () => { mount.removeEventListener('click',click); mount.removeEventListener('submit',submit); mount.removeEventListener('change',change); mount.removeEventListener('keydown',keydown); };
}
