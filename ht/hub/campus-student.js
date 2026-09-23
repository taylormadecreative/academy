/* Student campus experience. Data and authorization belong to campus-store.js. */

const rows = (state, key) => Array.isArray(state?.[key]) ? state[key] : [];
const userId = (state) => state.user?.id || state.member?.user_id || '';
const canAct = (state) => !!state.member && ['live', 'demo'].includes(state.mode);
const time = (value) => new Date(value || '').getTime();
const isFuture = (event) => time(event.ends_at || event.starts_at) >= Date.now();
const dateOrder = (a, b) => (time(a.starts_at) || 0) - (time(b.starts_at) || 0);
const newest = (a, b) => (time(b.created_at || b.submitted_at) || 0) - (time(a.created_at || a.submitted_at) || 0);
const own = (state, key) => rows(state, key).filter((item) => item.user_id === userId(state));
const publishedCourses = (state) => rows(state, 'courses').filter((course) => course.status === 'published');
const publishedEvents = (state) => rows(state, 'events').filter((event) => ['published', 'cancelled'].includes(event.status));
const courseModules = (state, id) => rows(state, 'modules').filter((module) => module.course_id === id).sort((a, b) => a.position - b.position);
const roleLabel = (role) => ({ student: 'Student', staff: 'Staff', admin: 'Campus administrator', leadership: 'University leadership' })[role] || 'Campus member';

/** Allow ordinary web links and local resources, never executable URL schemes. */
export function safeCampusUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return '';
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw;
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function queryValue(key) {
  try { return new URL(globalThis.location.href).searchParams.get(key) || ''; }
  catch { return ''; }
}

function memberName(state, id) {
  return rows(state, 'members').find((member) => member.user_id === id)?.display_name
    || (id === userId(state) ? state.member?.display_name : '') || 'Campus member';
}

// Ephemeral interface state is scoped to the store and current member, never persisted across accounts.
const communicationStates = new WeakMap();
function communicationState(ctx) {
  if (!ctx.api || (typeof ctx.api !== 'object' && typeof ctx.api !== 'function')) return { search: '', readBatches: new Set() };
  const identity = `${ctx.state.mode}:${userId(ctx.state)}`;
  let entry = communicationStates.get(ctx.api);
  if (!entry || entry.identity !== identity) {
    entry = { identity, search: '', readBatches: new Set() };
    communicationStates.set(ctx.api, entry);
  }
  return entry;
}

function conversations(ctx) {
  const { state } = ctx, id = userId(state);
  if (!canAct(state) || !id) return [];
  const grouped = new Map();
  for (const message of rows(state, 'messages')) {
    if (message.sender_id !== id && message.recipient_id !== id) continue;
    const personId = message.sender_id === id ? message.recipient_id : message.sender_id;
    if (personId === id) continue;
    const activeMember = rows(state, 'members').find((person) => person.user_id === personId && person.active !== false);
    // The directory only contains active members. A removed member must not erase
    // the caller's existing private history or strand an incoming unread message.
    const member = activeMember ? { ...activeMember, available: true } : { user_id: personId, display_name: 'Unavailable campus member', available: false };
    if (!grouped.has(personId)) grouped.set(personId, { member, messages: [], unread: 0 });
    const conversation = grouped.get(personId);
    conversation.messages.push(message);
    if (message.recipient_id === id && !message.read_at) conversation.unread++;
  }
  return [...grouped.values()].map((conversation) => {
    conversation.messages.sort((a, b) => -newest(a, b));
    return { ...conversation, last: conversation.messages.at(-1) };
  }).sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || newest(a.last, b.last));
}

function messageExcerpt(message, ctx, limit = 80) {
  const characters = Array.from(String(message?.body || ''));
  return `${message?.sender_id === userId(ctx.state) ? 'You: ' : ''}${ctx.esc(characters.slice(0, limit).join(''))}${characters.length > limit ? '…' : ''}`;
}

function communicationNav(ctx, active) {
  const count = conversations(ctx).reduce((sum, item) => sum + item.unread, 0);
  return `<nav class="campus-communication-nav" aria-label="Community and messages"><a href="${ctx.esc(ctx.href('community'))}"${active === 'community' ? ' aria-current="page"' : ''}>Community feed</a><a href="${ctx.esc(ctx.href('messages'))}"${active === 'messages' ? ' aria-current="page"' : ''}>Messages${count ? ` <span class="campus-message-unread">${count}<span class="campus-sr-only"> unread</span></span>` : ''}</a></nav>`;
}

function conversationRow(conversation, ctx, selected = '', local = false) {
  const { member, unread, last } = conversation, { esc, href } = ctx;
  return `<a class="campus-conversation-row${unread ? ' is-unread' : ''}${selected === member.user_id ? ' is-selected' : ''}" href="${esc(href('messages', { person: member.user_id }))}"${local ? ` data-campus-person="${esc(member.user_id)}"` : ''}${selected === member.user_id ? ' aria-current="true"' : ''} aria-label="${member.available === false ? 'View conversation with' : 'Message'} ${esc(member.display_name)}${unread ? `, ${unread} unread` : ''}"><span class="campus-avatar" aria-hidden="true">${esc(initials(member.display_name))}</span><span class="campus-conversation-copy"><span class="campus-conversation-meta"><strong>${esc(member.display_name)}</strong><time datetime="${esc(last.created_at)}">${esc(ctx.formatDate(last.created_at))}</time></span><span class="campus-message-preview">${messageExcerpt(last, ctx)}</span></span>${unread ? `<span class="campus-message-unread" aria-hidden="true">${unread}</span>` : ''}</a>`;
}

function recentConversations(ctx, limit = 3) {
  const recent = conversations(ctx).slice(0, limit);
  return recent.length ? `<div class="campus-conversation-list">${recent.map((conversation) => conversationRow(conversation, ctx)).join('')}</div>` : `<p class="campus-muted">${canAct(ctx.state) ? 'Your conversations will appear here. Start with a classmate or someone who can help.' : 'Sign in with a campus membership to open your messages.'}</p>`;
}

function connectionPreview(ctx) {
  const { state, esc, href } = ctx;
  const posts = rows(state, 'posts').slice().sort(newest), count = conversations(ctx).reduce((sum, item) => sum + item.unread, 0);
  return `<section class="campus-communication-preview"><div class="campus-section-head"><div><p class="campus-eyebrow">Your campus connections</p><h2>Keep the conversation going.</h2></div><a href="${esc(href('community'))}">Open community <span aria-hidden="true">→</span></a></div><div class="campus-connect-grid"><div><div class="campus-section-head"><h3>Messages${count ? ` <span class="campus-message-unread">${count}<span class="campus-sr-only"> unread</span></span>` : ''}</h3><a href="${esc(href('messages'))}">Open inbox</a></div>${recentConversations(ctx, 2)}</div><div><p class="campus-eyebrow">In the community</p>${posts[0] ? `<strong>${esc(memberName(state, posts[0].author_id))} <span class="campus-muted">· ${esc(posts[0].channel || 'Campus')}</span></strong><p>${esc(Array.from(String(posts[0].body || '')).slice(0, 160).join(''))}${Array.from(String(posts[0].body || '')).length > 160 ? '…' : ''}</p>` : '<p>Ask a question, share a resource, or introduce yourself.</p>'}<a class="campus-button campus-button-secondary campus-button-small" href="${esc(href('community'))}">Join the conversation</a></div></div></section>`;
}

function coursePreview(ctx) {
  const { state, esc, href } = ctx;
  const sections = canAct(state) ? rows(state, 'cohorts').filter(section => section.status === 'active') : [];
  if (!sections.length) return '';
  return `<section class="campus-course-preview"><div class="campus-section-head"><div><p class="campus-eyebrow">Your coursework</p><h2>Keep your next step in sight.</h2></div><a href="${esc(href('courses'))}">All courses <span aria-hidden="true">→</span></a></div><div class="campus-list">${sections.slice(0, 2).map(section => `<a class="campus-next-action" href="${esc(href('courses', { cohort: section.id }))}"><span class="campus-shortcut-icon" aria-hidden="true">${ctx.icon('book')}</span><div><strong>${esc(section.title)}</strong><p>Lessons, assignments, grades, and your classroom.</p></div><span aria-hidden="true">→</span></a>`).join('')}</div></section>`;
}

function initials(name) {
  return String(name || 'HT').trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] || '').join('').toUpperCase();
}

function empty(title, body, ctx) {
  return `<div class="campus-empty"><h3>${ctx.esc(title)}</h3><p>${ctx.esc(body)}</p></div>`;
}

function dateText(value, ctx, withTime = false) {
  if (!Number.isFinite(time(value))) return 'Date to be announced';
  return `${ctx.formatDate(value)}${withTime ? ` · ${ctx.formatTime(value)}` : ''}`;
}

function textBlock(value, ctx) {
  return String(value || '').split(/\n\s*\n/).filter(Boolean).map((paragraph) => `<p class="campus-body-text">${ctx.esc(paragraph)}</p>`).join('');
}

function guestNotice(state) {
  if (canAct(state)) return '';
  if (state.mode === 'unavailable') return '<p class="campus-empty">Campus records are unavailable. Try again when your connection is restored.</p>';
  return '<p class="campus-member-notice">Sign in with an approved campus membership to enroll, save your place, and connect with the community.</p>';
}

function progressFor(state, courseId) {
  const modules = courseModules(state, courseId);
  const completeIds = new Set(own(state, 'progress').filter((item) => item.completed_at).map((item) => item.module_id));
  const complete = modules.filter((module) => completeIds.has(module.id)).length;
  return { modules, completeIds, complete, total: modules.length, percent: modules.length ? Math.round(complete / modules.length * 100) : 0 };
}

function courseProgress(course, ctx, compact = false) {
  const { state, esc } = ctx;
  const { complete, total, percent } = progressFor(state, course.id);
  return `<div class="campus-progress${compact ? ' campus-progress-compact' : ''}"><div class="campus-meta"><span>${complete} of ${total} modules complete</span><span>${percent}%</span></div><progress value="${complete}" max="${total || 1}" aria-label="${esc(course.title)}: ${complete} of ${total} modules complete">${percent}%</progress></div>`;
}

function announcementList(ctx) {
  const { state, esc } = ctx;
  const items = rows(state, 'announcements').filter((item) => item.status === 'published' && (!item.publish_at || time(item.publish_at) <= Date.now()) && (item.audience !== 'staff' || ['staff', 'admin', 'leadership'].includes(state.member?.role))).sort(newest).slice(0, 4);
  return `<section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">From around campus</p><h2>Campus announcements</h2></div></div>${items.length ? `<div class="campus-list">${items.map((item) => `<article class="campus-announcement"><p class="campus-meta"><span>${esc(item.office || 'Campus office')}</span><time datetime="${esc(item.publish_at || item.created_at)}">${esc(dateText(item.publish_at || item.created_at, ctx))}</time></p><h3>${esc(item.title)}</h3>${textBlock(item.body, ctx)}</article>`).join('')}</div>` : empty('You’re caught up', 'Published announcements from campus offices will appear here.', ctx)}</section>`;
}

function adaCard(ctx) {
  const { state, esc } = ctx;
  const url = safeCampusUrl(state.settings?.ada_video_url);
  if (!url) return '';
  const poster = safeCampusUrl(state.settings?.ada_video_poster);
  const transcript = state.settings?.ada_video_transcript;
  return `<section class="campus-panel campus-ada"><div class="campus-section-head"><div><p class="campus-eyebrow">Your campus welcome</p><h2>A message from Ada</h2></div><span class="campus-label">Recorded welcome</span></div><video class="campus-video" controls playsinline preload="metadata" src="${esc(url)}"${poster ? ` poster="${esc(poster)}"` : ''} aria-label="Ada campus welcome"${transcript ? ' aria-describedby="campus-ada-transcript"' : ''}>Your browser does not support this video. <a href="${esc(url)}">Open the welcome video</a>.</video>${transcript ? `<details id="campus-ada-transcript" class="campus-transcript"><summary>Read the transcript</summary>${textBlock(transcript, ctx)}</details>` : ''}</section>`;
}

function dueAssignments(state, cohorts) {
  const submitted = new Set(own(state, 'assignment_attempts').map((attempt) => attempt.assignment_id));
  return rows(state, 'assignments').filter((item) => item.status === 'published' && time(item.due_at) > Date.now() && cohorts.some((cohort) => cohort.id === item.cohort_id) && !submitted.has(item.id)).sort((a, b) => time(a.due_at) - time(b.due_at));
}

function homeView(ctx) {
  const { state, esc, href } = ctx;
  const enrollments = own(state, 'enrollments');
  const courses = publishedCourses(state);
  const current = courses.find((course) => enrollments.some((enrollment) => enrollment.course_id === course.id && !enrollment.completed_at));
  const recommended = current || courses[0];
  const upcoming = publishedEvents(state).filter((event) => event.status === 'published' && isFuture(event)).sort(dateOrder);
  const reservations = own(state, 'rsvps').filter((rsvp) => rsvp.status === 'going');
  const reservedEvents = upcoming.filter((event) => reservations.some((reservation) => reservation.event_id === event.id));
  const myCohorts = rows(state, 'cohorts').filter((cohort) => cohort.status === 'active' && rows(state, 'cohort_members').some((membership) => membership.cohort_id === cohort.id && membership.user_id === userId(state) && membership.active));
  const visibleSessions = rows(state, 'class_sessions').filter((session) => ['scheduled', 'live'].includes(session.status) && (!session.cohort_id || myCohorts.some((cohort) => cohort.id === session.cohort_id)) && (session.status === 'live' || time(session.ends_at) >= Date.now())).sort(dateOrder);
  const nextSession = visibleSessions[0];
  const nextEvent = reservedEvents[0] || upcoming[0];
  const section = recommended && myCohorts.find((cohort) => cohort.course_id === recommended.id);
  const courseLink = section ? href('courses', { cohort: section.id, tab: 'overview' }) : recommended ? `${href('learn')}#course-${encodeURIComponent(recommended.id)}` : href('learn');
  const nextLink = nextSession ? href('live') : href('events');
  const nextLabel = nextSession ? (nextSession.status === 'live' ? 'Class in progress' : 'Next class') : nextEvent ? (time(nextEvent.starts_at) <= Date.now() && time(nextEvent.ends_at) >= Date.now() ? 'Happening now' : 'Coming up') : 'Find your people';
  const nextTitle = nextSession?.title || nextEvent?.title;
  const nextTime = nextSession?.starts_at || nextEvent?.starts_at;
  const due = canAct(state) ? dueAssignments(state, myCohorts) : [];
  const sectionName = (id) => myCohorts.find((cohort) => cohort.id === id)?.title || 'Your course';
  const dueLink = (item) => href('courses', { cohort: item.cohort_id, tab: 'assignments', assignment: item.id });
  const currentSection = current && myCohorts.find((cohort) => cohort.course_id === current.id);
  const progress = current ? progressFor(state, current.id) : null;
  const firstDue = due[0];
  const glance = current ? `<div class="today-glance"><p class="campus-eyebrow">At a glance</p><div class="today-glance-row"><span class="today-glance-label">Your progress</span><p class="today-figure"><span>${progress.complete}</span> of ${progress.total} ${progress.total === 1 ? 'module' : 'modules'} done</p><progress class="today-glance-bar" value="${progress.complete}" max="${progress.total || 1}" aria-label="${esc(current.title)}: ${progress.complete} of ${progress.total} modules complete">${progress.percent}%</progress></div><div class="today-glance-row"><span class="today-glance-label">Due soon</span>${firstDue ? `<a class="today-due-link" href="${esc(dueLink(firstDue))}"><strong>${esc(firstDue.title)}</strong><span>Due ${esc(dateText(firstDue.due_at, ctx, true))}${due.length > 1 ? ` · ${due.length - 1} more` : ''}</span></a>` : '<p class="today-glance-quiet">Nothing due right now. Nice work.</p>'}</div></div>` : '';
  const agenda = [
    ...due.map((item) => ({ kind: 'due', at: item.due_at, item })),
    ...upcoming.map((item) => ({ kind: 'event', at: item.starts_at, item }))
  ].sort((a, b) => (time(a.at) || 0) - (time(b.at) || 0)).slice(0, 4);
  const agendaRow = ({ kind, item }) => kind === 'due'
    ? `<a class="campus-row campus-calendar-row today-agenda-due" href="${esc(dueLink(item))}"><span class="campus-event-date">${esc(ctx.formatDate(item.due_at))}</span><span><strong>${esc(item.title)}</strong><span class="campus-muted"><b class="today-due-word">Due</b> ${esc(ctx.formatTime(item.due_at))} · ${esc(sectionName(item.cohort_id))}</span></span></a>`
    : `<a class="campus-row campus-calendar-row" href="${esc(href('events'))}#event-${esc(item.id)}"><span class="campus-event-date">${esc(ctx.formatDate(item.starts_at))}</span><span><strong>${esc(item.title)}</strong><span class="campus-muted">${esc(ctx.formatTime(item.starts_at))} · ${esc(item.location || item.office || 'Campus')}${reservations.some((rsvp) => rsvp.event_id === item.id) ? ' · Going' : ''}</span></span></a>`;
  return `${guestNotice(state)}
    <section class="campus-hero campus-today-hero${glance ? ' has-glance' : ''}"><div class="campus-hero-copy"><p class="campus-eyebrow">${current ? 'Your learning, ready when you are' : 'Your day on the Hill'}</p><h2>${esc(currentSection?.title || current?.title || 'Find your next opportunity.')}</h2>${currentSection ? `<p class="today-course-name">Course: ${esc(current.title)}</p>` : ''}<p>${current ? 'Continue your course, check feedback, or see what is happening across campus.' : 'Learning, campus life, and the people who can help, together in one place.'}</p><div class="campus-card-actions"><a class="campus-button" href="${esc(courseLink)}">${current ? 'Open your course' : 'Explore learning'}</a><a class="campus-button campus-button-secondary" href="${esc(href('messages'))}">Open messages</a></div></div>${glance}<div class="campus-hero-aside"><img class="campus-hero-aside-photo" src="/ht/img/commencement.jpg" alt="" loading="eager" decoding="async"><p class="campus-eyebrow">${nextLabel}</p>${nextTitle ? `<h3>${esc(nextTitle)}</h3><p>${esc(dateText(nextTime, ctx, true))}</p><p>${esc(nextSession ? (nextSession.status === 'live' ? 'Your cohort classroom' : 'Cohort classroom · join when it begins') : nextEvent.location || nextEvent.office || 'Campus event')}</p><a href="${esc(nextLink)}">${nextSession ? 'Open classroom' : 'View event'} <span aria-hidden="true">→</span></a>` : `<h3>Good things happen together.</h3><p>Find your people, ask a question, or join a campus conversation.</p><a href="${esc(href('community'))}">Meet the community <span aria-hidden="true">→</span></a>`}</div></section>
    <div class="campus-grid campus-grid-main campus-today-grid"><div class="campus-stack">${connectionPreview(ctx)}${announcementList(ctx)}</div><aside class="campus-stack"><section class="campus-panel campus-today-agenda"><div class="campus-section-head"><div><p class="campus-eyebrow">Your week</p><h2>Coming up</h2></div><a href="${esc(href('events'))}">All events</a></div>${agenda.length ? `<div class="campus-list">${agenda.map(agendaRow).join('')}</div>` : empty('Nothing scheduled yet', 'Assignment due dates and published campus events will show up here.', ctx)}</section>${adaCard(ctx)}<section class="campus-panel campus-support-card campus-today-help"><p class="campus-eyebrow">Need a hand?</p><h2>We can point you in the right direction.</h2><a class="campus-button campus-button-secondary" href="${esc(href('support'))}">Get campus help</a></section></aside></div>`;
}

function submissionFeedback(module, ctx) {
  const { state, esc } = ctx;
  const submission = own(state, 'submissions').filter((item) => item.module_id === module.id).sort(newest)[0];
  if (!submission) return { submission: null, html: '' };
  const label = { submitted: 'Awaiting instructor review', revision: 'Revision requested', approved: 'Approved by your instructor' }[submission.status] || 'Submitted';
  return { submission, html: `<div class="campus-feedback"><span class="campus-label">${label}</span><p class="campus-muted">Submitted ${esc(dateText(submission.submitted_at, ctx, true))}</p>${submission.feedback ? `<h4>Instructor feedback</h4>${textBlock(submission.feedback, ctx)}` : '<p>Your instructor will review your project and leave feedback here.</p>'}${submission.status === 'approved' ? '' : `<details><summary>Your submitted work</summary>${textBlock(submission.body, ctx)}${safeCampusUrl(submission.link_url) ? `<p><a href="${esc(safeCampusUrl(submission.link_url))}" target="_blank" rel="noopener noreferrer">Open your project link <span class="campus-sr-only">(opens in a new tab)</span></a></p>` : ''}</details>`}</div>` };
}

function moduleCard(module, index, progress, enrolled, ctx) {
  const { state, esc } = ctx;
  const complete = progress.completeIds.has(module.id);
  const unlocked = enrolled && progress.modules.slice(0, index).every((item) => progress.completeIds.has(item.id));
  const actionable = canAct(state) && unlocked && !complete;
  const { submission, html: feedback } = submissionFeedback(module, ctx);
  const resource = safeCampusUrl(module.resource_url);
  const question = String(module.question || '').trim();
  const options = Array.isArray(module.options) ? module.options : [];
  const label = complete ? 'Complete' : !enrolled ? 'Enroll to begin' : !unlocked ? 'Complete the previous module' : submission?.status === 'submitted' ? 'In review' : 'Ready to start';
  const firstIncomplete = progress.modules.find((item) => !progress.completeIds.has(item.id))?.id === module.id;
  const checkForm = question && options.length >= 2 ? `<form data-campus-command="completeModule" data-module-id="${esc(module.id)}" class="campus-module-form"><fieldset${actionable ? '' : ' disabled'}><legend>${esc(question)}</legend>${options.map((option, optionIndex) => `<label class="campus-radio"><input type="radio" name="answer_index" value="${optionIndex}" required><span>${esc(option)}</span></label>`).join('')}</fieldset>${!complete ? `<button class="campus-button campus-button-small" type="submit"${actionable ? '' : ' disabled'}>${module.assignment_prompt ? 'Check my answer' : 'Check answer & complete'}</button>` : ''}<p class="campus-form-status" role="status"></p></form>` : '';
  const assignment = module.assignment_prompt ? `<div class="campus-assignment"><h4>Your project</h4>${textBlock(module.assignment_prompt, ctx)}${feedback}${!complete && submission?.status !== 'submitted' ? `<form data-campus-command="submitWork" data-module-id="${esc(module.id)}" class="campus-module-form"><label class="campus-field"><span>Your response</span><textarea name="body" rows="5" minlength="20" maxlength="12000" required${actionable ? '' : ' disabled'} placeholder="Share your work and explain the choices you made.">${esc(submission?.body || '')}</textarea></label><label class="campus-field"><span>Project link <span class="campus-muted">(optional)</span></span><input name="link_url" type="url" maxlength="2000" placeholder="https://" value="${esc(submission?.link_url || '')}"${actionable ? '' : ' disabled'}></label><p class="campus-muted">An instructor reviews this project before the module is complete. Share only work you have permission to share.</p><button class="campus-button campus-button-small" type="submit"${actionable ? '' : ' disabled'}>${submission ? 'Submit revision' : 'Submit for review'}</button><p class="campus-form-status" role="status"></p></form>` : ''}</div>` : '';
  const simpleComplete = !question && !module.assignment_prompt && !complete ? `<form data-campus-command="completeModule" data-module-id="${esc(module.id)}"><button type="submit" class="campus-button campus-button-small"${actionable ? '' : ' disabled'}>Mark module complete</button><p class="campus-form-status" role="status"></p></form>` : '';
  return `<details class="campus-module${complete ? ' campus-module-complete' : !unlocked ? ' campus-module-locked' : ''}" id="module-${esc(module.id)}"${firstIncomplete && unlocked ? ' open' : ''}><summary><span class="campus-module-number">${complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong>${esc(module.title)}</strong><span class="campus-muted">${label}</span></span><span aria-hidden="true">+</span></summary><div class="campus-module-content">${textBlock(module.body, ctx)}${resource ? `<p><a href="${esc(resource)}" target="_blank" rel="noopener noreferrer">Open learning resource <span aria-hidden="true">↗</span><span class="campus-sr-only"> (opens in a new tab)</span></a></p>` : ''}${!unlocked && !complete ? `<p class="campus-member-notice">${enrolled ? 'Finish the earlier modules to unlock this activity.' : 'Enroll in the pathway to save your progress and complete activities.'}</p>` : ''}${checkForm}${assignment}${simpleComplete}</div></details>`;
}

/* ---------- Badges: credentials that travel (learn view only) ---------- */
const BADGE_ISSUER = 'Huston-Tillotson University · HT Hub';
const BADGE_GLYPHS = {
  book: 'M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z M12 5v15',
  briefcase: 'M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M12 10v4',
  coin: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M15 9c-1-1.5-6-1.5-6 1s6 1.5 6 4-5 2.5-6 1 M12 6v2 M12 16v2',
  star: 'm12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z'
};
/* Sample pathways, clearly labeled as samples. They are never shown as earned. */
const SAMPLE_BADGES = [
  { name: 'Financial Wellness', glyph: 'coin', need: 'Complete the budgeting workshop and one meeting with a financial aid counselor.' },
  { name: 'Digital Storytelling', glyph: 'star', need: 'Plan a short story about campus life, record it, and share it with your class.' }
];
const ROSETTE = (() => {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = (Math.PI * 2 * i) / 48 - Math.PI / 2, r = i % 2 ? 44 : 48; pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`); }
  return pts.join(' ');
})();

/** A readable credential ID, derived deterministically from the stored UUID:
 *  HT-CR-<completion year>-<4 digits>. The UUID stays the record of truth (title/data attribute). */
export function credentialLabel(uuid, completedAt) {
  const raw = String(uuid || '');
  if (!raw) return '';
  const hex = raw.replace(/[^0-9a-f]/gi, '');
  const tail = parseInt(hex.slice(-8) || '0', 16);
  let n = tail % 10000;
  if (!n) { let h = 0; for (const ch of raw) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (h % 9999) + 1; }
  const year = new Date(completedAt || '').getUTCFullYear();
  return `HT-CR-${Number.isFinite(year) ? year : 'REC'}-${String(n).padStart(4, '0')}`;
}
const credentialCode = (enrollment, esc) => `<code title="Record reference ${esc(enrollment.credential_id)}" data-credential-uuid="${esc(enrollment.credential_id)}">${esc(credentialLabel(enrollment.credential_id, enrollment.completed_at))}</code>`;

function badgeSeal(state, glyph, share = 0) {
  const path = BADGE_GLYPHS[glyph] || BADGE_GLYPHS.star;
  const ring = 2 * Math.PI * 38, done = Math.max(0, Math.min(1, share));
  const tails = state === 'earned' ? '<path class="badge-tail" d="M34 80 26 104l12-6 7 10 6-24Z"/><path class="badge-tail" d="M66 80l8 24-12-6-7 10-6-24Z"/>' : '';
  const progress = state === 'progress' ? `<circle class="badge-seal-track" cx="50" cy="50" r="38"/>${done > 0 ? `<circle class="badge-seal-arc" cx="50" cy="50" r="38" stroke-dasharray="${(ring * done).toFixed(1)} ${ring.toFixed(1)}" transform="rotate(-90 50 50)"/>` : ''}` : `<circle class="badge-seal-ring" cx="50" cy="50" r="38"/>`;
  return `<svg class="badge-seal" data-state="${state}" viewBox="0 0 100 110" aria-hidden="true" focusable="false">${tails}<polygon class="badge-seal-edge" points="${ROSETTE}"/><circle class="badge-seal-face" cx="50" cy="50" r="33"/>${progress}<g class="badge-seal-glyph" transform="translate(35 35) scale(1.25)"><path d="${path}"/></g></svg>`;
}

function badgeName(course) {
  const short = String(course.title || '').split(':')[0].trim();
  return String(course.badge_name || short || course.category || 'Pathway');
}

const badgeGlyph = (course) => /career/i.test(`${course.category || ''} ${course.title || ''}`) ? 'briefcase' : 'book';

function learnerBadges(state) {
  const enrollments = own(state, 'enrollments');
  const submissions = own(state, 'submissions');
  return publishedCourses(state).map((course) => {
    const enrollment = enrollments.find((item) => item.course_id === course.id);
    const progress = progressFor(state, course.id);
    const inReview = progress.modules.some((module) => !progress.completeIds.has(module.id) && submissions.some((item) => item.module_id === module.id && item.status === 'submitted'));
    const earned = !!enrollment?.completed_at && Number.isFinite(time(enrollment.completed_at));
    return { course, enrollment, progress, inReview, earned, state: earned ? 'earned' : enrollment ? 'progress' : 'available' };
  });
}

function badgeCard(badge, ctx) {
  const { esc, href } = ctx;
  const { course, progress, earned, inReview } = badge;
  const name = badgeName(course);
  let status, meta;
  if (earned) {
    status = 'Earned';
    meta = `<p class="badge-meta">Earned <time datetime="${esc(badge.enrollment.completed_at)}">${esc(dateText(badge.enrollment.completed_at, ctx))}</time></p>`;
  } else if (badge.state === 'progress') {
    status = 'In progress';
    meta = `<p class="badge-meta">${progress.complete} of ${progress.total} ${progress.total === 1 ? 'module' : 'modules'}${inReview ? ' · project in review' : ''}</p><progress class="badge-progress" value="${progress.complete}" max="${progress.total || 1}" aria-label="${esc(name)} badge: ${progress.complete} of ${progress.total} modules">${progress.percent}%</progress>`;
  } else {
    status = 'Available';
    meta = `<p class="badge-meta">Finish all ${progress.total} ${progress.total === 1 ? 'module' : 'modules'} of this pathway.</p><a class="badge-link" href="${esc(href('learn'))}#course-${esc(course.id)}">See the pathway <span aria-hidden="true">→</span></a>`;
  }
  return `<li class="badge-card" data-state="${badge.state}">${badgeSeal(badge.state, badgeGlyph(course), progress.total ? progress.complete / progress.total : 0)}<div class="badge-card-copy"><p class="badge-status" data-state="${badge.state}">${status}</p><h3>${esc(name)}</h3><p class="badge-issuer">${esc(BADGE_ISSUER)}</p>${meta}</div></li>`;
}

function sampleBadgeCard(sample, ctx) {
  const { esc } = ctx;
  return `<li class="badge-card" data-state="available" data-sample="true">${badgeSeal('available', sample.glyph)}<div class="badge-card-copy"><p class="badge-status" data-state="available">Available · Sample</p><h3>${esc(sample.name)}</h3><p class="badge-issuer">${esc(BADGE_ISSUER)}</p><p class="badge-meta">${esc(sample.need)}</p></div></li>`;
}

function badgeShelf(ctx) {
  const { state, icon, esc, href } = ctx;
  const badges = learnerBadges(state);
  const earned = badges.filter((badge) => badge.earned).length;
  return `<section class="campus-panel badge-shelf" aria-labelledby="badge-shelf-title"><div class="campus-section-head"><div><p class="campus-eyebrow">Credentials that travel</p><h2 id="badge-shelf-title">Your badges</h2></div><span class="campus-label">${earned} earned</span></div><p class="campus-muted badge-lead">Finish every module in a pathway to earn its badge. Each badge names the skill, who issued it, and when you earned it.</p><a class="badge-link badge-live-link" href="${esc(href('live'))}">Find your classroom and recordings <span aria-hidden="true">→</span></a><ul class="badge-grid">${badges.map((badge) => badgeCard(badge, ctx)).join('')}${SAMPLE_BADGES.map((sample) => sampleBadgeCard(sample, ctx)).join('')}</ul><p class="lead-sample-note">${icon('star')}<span><strong>Sample badges.</strong> Financial Wellness and Digital Storytelling show what HT could offer next. They are not live pathways yet.</span></p></section>`;
}

function coCurricularRecord(ctx) {
  const { state, esc, href } = ctx;
  const earned = learnerBadges(state).filter((badge) => badge.earned);
  const name = state.member?.display_name || 'Campus learner';
  const next = learnerBadges(state).find((badge) => badge.state === 'progress') || learnerBadges(state).find((badge) => badge.state === 'available');
  const demo = state.mode === 'demo' ? '<p class="badge-record-demo">Illustrative demo record. Not an official university credential.</p>' : '';
  const list = earned.length ? `<ol class="badge-record-list">${earned.map(({ course, enrollment }) => `<li><div><strong>${esc(badgeName(course))} badge</strong><span>Pathway completed: ${esc(course.title)}</span>${enrollment.credential_id ? `<span>Credential ID ${credentialCode(enrollment, esc)}</span>` : ''}</div><time datetime="${esc(enrollment.completed_at)}">${esc(dateText(enrollment.completed_at, ctx))}</time></li>`).join('')}</ol>` : `<div class="badge-record-empty"><h3>Your record starts with your first badge.</h3><p>${next ? `Finish the modules in ${esc(badgeName(next.course))} to earn it. It will show up here, ready to print or show in your career portfolio.` : 'When a pathway opens, finish its modules to earn a badge. It will show up here.'}</p>${next ? `<a class="campus-button campus-button-small" href="${esc(href('learn'))}#course-${esc(next.course.id)}">${next.state === 'progress' ? `Continue ${esc(badgeName(next.course))}` : 'Start a pathway'}</a>` : ''}</div>`;
  return `<section class="campus-panel badge-record" aria-labelledby="badge-record-title"><div class="campus-section-head"><div><p class="campus-eyebrow">Co-curricular record</p><h2 id="badge-record-title">${esc(name)}’s learning record</h2></div></div><p class="badge-record-issuer">Issued by ${esc(BADGE_ISSUER)}</p>${demo}${list}<div class="campus-card-actions badge-record-actions"><a class="campus-button campus-button-secondary campus-button-small" href="${esc(href('/ht/hub/career/'))}">See career portfolio</a><button type="button" class="campus-button campus-button-secondary campus-button-small" data-campus-action="printRecord"${earned.length ? '' : ' disabled'}>Print record</button></div></section>`;
}

function learnView(ctx) {
  const { state, esc, href } = ctx;
  const courses = publishedCourses(state);
  const enrollments = own(state, 'enrollments');
  return `${guestNotice(state)}<div class="badge-layout">${badgeShelf(ctx)}${coCurricularRecord(ctx)}</div>${courses.length ? `<div class="campus-stack">${courses.map((course) => {
    const enrollment = enrollments.find((item) => item.course_id === course.id);
    const progress = progressFor(state, course.id);
    const image = safeCampusUrl(course.image_url);
    return `<section class="campus-panel campus-course" id="course-${esc(course.id)}"><div class="campus-course-heading">${image ? `<img class="campus-course-image" src="${esc(image)}" alt="" loading="lazy">` : ''}<div><p class="campus-eyebrow">${esc(course.category || 'Campus learning')} · ${progress.total} ${progress.total === 1 ? 'module' : 'modules'}</p><h2>${esc(course.title)}</h2><p>${esc(course.description)}</p></div>${!enrollment ? `<button type="button" class="campus-button" data-campus-action="enroll" data-course-id="${esc(course.id)}"${canAct(state) && progress.total ? '' : ' disabled'}>Enroll in pathway</button>` : `<span class="campus-label">${enrollment.completed_at ? 'Pathway complete' : 'You’re enrolled'}</span>`}</div>${enrollment ? courseProgress(course, ctx) : ''}${enrollment?.completed_at && enrollment.credential_id ? `<div class="campus-credential"><div><p class="campus-eyebrow">Learning accomplished</p><h3>Your completion record</h3><p>${esc(state.member?.display_name || 'Campus learner')} completed this pathway on ${esc(dateText(enrollment.completed_at, ctx))}.</p><p class="campus-muted">Credential ID: ${credentialCode(enrollment, esc)}</p><p class="campus-muted">Issued by this Hub. Campus staff can confirm this record using the credential ID.</p></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-campus-action="downloadCredential" data-course-id="${esc(course.id)}">Download record</button></div>` : ''}<div class="campus-modules">${progress.modules.length ? progress.modules.map((module, index) => moduleCard(module, index, progress, !!enrollment, ctx)).join('') : empty('A new pathway is taking shape', 'Modules will be available when the instructor publishes them.', ctx)}</div></section>`;
  }).join('')}</div>` : empty('Your next learning opportunity is on its way', 'Published campus pathways will appear here. In the meantime, explore events or ask the learning support team for help.', ctx)}`;
}

function eventCard(event, ctx, past = false) {
  const { state, esc } = ctx;
  const going = own(state, 'rsvps').some((item) => item.event_id === event.id && item.status === 'going');
  const attended = own(state, 'attendance').find((item) => item.event_id === event.id);
  const cancelled = event.status === 'cancelled';
  const start = time(event.starts_at);
  const end = time(event.ends_at || event.starts_at);
  const checkinOpen = Date.now() >= start - 30 * 60_000 && Date.now() <= end + 2 * 60 * 60_000;
  const joinUrl = safeCampusUrl(event.join_url);
  const liveWindow = Date.now() >= start - 15 * 60_000 && Date.now() <= end;
  return `<article class="campus-panel campus-event" id="event-${esc(event.id)}"><div class="campus-section-head"><p class="campus-eyebrow">${esc(event.office || 'Campus event')}</p><div class="campus-card-actions">${cancelled ? '<span class="campus-label">Cancelled</span>' : attended ? '<span class="campus-label campus-label-success">Checked in</span>' : going ? '<span class="campus-label">You’re going</span>' : ''}</div></div><h2>${esc(event.title)}</h2><div class="campus-event-meta"><p><time datetime="${esc(event.starts_at)}">${esc(dateText(event.starts_at, ctx, true))}</time>${event.ends_at && Number.isFinite(end) ? ` – ${esc(ctx.formatTime(event.ends_at))}` : ''}</p><p>${esc(event.location || 'Location to be announced')}${event.capacity ? ` · ${esc(event.capacity)} places` : ''}</p></div>${textBlock(event.description, ctx)}<div class="campus-card-actions">${!cancelled && !past ? `<button class="campus-button${going ? ' campus-button-secondary' : ''}" type="button" data-campus-action="rsvp" data-event-id="${esc(event.id)}" data-status="${going ? 'cancelled' : 'going'}"${canAct(state) ? '' : ' disabled'}>${going ? 'Cancel RSVP' : 'Save my place'}</button>` : ''}${!cancelled ? `<button type="button" class="campus-button campus-button-secondary" data-campus-action="downloadCalendar" data-event-id="${esc(event.id)}">Add to calendar</button>` : ''}${!cancelled && !past && joinUrl && liveWindow ? `<a class="campus-button" href="${esc(joinUrl)}" target="_blank" rel="noopener noreferrer">Join session <span class="campus-sr-only">(opens in a new tab)</span></a>` : ''}</div>${!cancelled && checkinOpen && going && canAct(state) && !attended ? `<details class="campus-checkin"><summary>Check in with your event code</summary><form data-campus-command="checkin" data-event-id="${esc(event.id)}"><label class="campus-field"><span>Attendance code from your host</span><input type="text" name="code" required maxlength="64" autocomplete="off" autocapitalize="characters" placeholder="Enter event code"></label><button type="submit" class="campus-button campus-button-small">Check in</button><p class="campus-form-status" role="status"></p></form></details>` : ''}${attended ? `<p class="campus-muted">Your attendance was recorded ${esc(dateText(attended.checked_in_at, ctx, true))}.</p>` : going && !checkinOpen && !past ? '<p class="campus-muted">Check-in opens 30 minutes before the event. Your host will share the attendance code.</p>' : ''}</article>`;
}

function eventsView(ctx) {
  const events = publishedEvents(ctx.state);
  const future = events.filter(isFuture).sort(dateOrder);
  const past = events.filter((event) => !isFuture(event)).sort((a, b) => dateOrder(b, a));
  return `${guestNotice(ctx.state)}<div class="campus-page-intro"><p>Make time for learning, connection, and life on the Hill. Save your place and keep your calendar close.</p><p class="campus-muted">Event times are shown in your device’s local time zone.</p><a class="campus-button campus-button-secondary" href="${ctx.esc(ctx.href('/ht/hub/calendar/'))}">Open the academic calendar <span aria-hidden="true">→</span></a></div><div class="campus-grid campus-event-grid">${future.length ? future.map((event) => eventCard(event, ctx)).join('') : empty('No upcoming events yet', 'New events appear here as campus offices publish them.', ctx)}</div>${past.length ? `<section class="campus-past-events"><div class="campus-section-head"><h2>Past events</h2></div><div class="campus-grid campus-event-grid">${past.slice(0, 12).map((event) => eventCard(event, ctx, true)).join('')}</div></section>` : ''}`;
}

function postCard(post, ctx) {
  const { state, esc, href } = ctx;
  const author = memberName(state, post.author_id);
  const replies = rows(state, 'replies').filter((reply) => reply.post_id === post.id).sort((a, b) => -newest(a, b));
  const likes = rows(state, 'likes').filter((like) => like.post_id === post.id);
  const liked = likes.some((like) => like.user_id === userId(state));
  return `<article class="campus-panel campus-post" data-campus-post data-channel="${esc(post.channel || 'Campus')}"><div class="campus-row"><span class="campus-avatar" aria-hidden="true">${esc(initials(author))}</span><div><h3>${esc(author)}</h3><p class="campus-muted"><time datetime="${esc(post.created_at)}">${esc(dateText(post.created_at, ctx, true))}</time> · ${esc(post.channel || 'Campus')}</p></div></div>${textBlock(post.body, ctx)}<div class="campus-card-actions"><button type="button" class="campus-button campus-button-secondary campus-button-small" data-campus-action="like" data-post-id="${esc(post.id)}" data-liked="${liked ? 'true' : 'false'}" aria-pressed="${liked}"${canAct(state) ? '' : ' disabled'}>${liked ? 'Liked' : 'Like'}${likes.length ? ` · ${likes.length}` : ''}</button><span class="campus-muted">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>${canAct(state) && post.author_id !== userId(state) && rows(state, 'members').some((member) => member.user_id === post.author_id && member.active !== false) ? `<a class="campus-post-message" href="${esc(href('messages', { person: post.author_id }))}" aria-label="Message ${esc(author)}">Message author</a>` : ''}</div><details class="campus-replies"><summary>${replies.length ? 'Read replies & respond' : 'Start a conversation'}</summary><div class="campus-thread">${replies.map((reply) => `<div class="campus-reply"><p class="campus-meta"><strong>${esc(memberName(state, reply.author_id))}</strong><time datetime="${esc(reply.created_at)}">${esc(dateText(reply.created_at, ctx, true))}</time></p>${textBlock(reply.body, ctx)}</div>`).join('')}</div>${canAct(state) ? `<form data-campus-command="reply" data-post-id="${esc(post.id)}"><label class="campus-field"><span>Your reply</span><textarea name="body" rows="2" maxlength="5000" required placeholder="Add something to the conversation."></textarea></label><button type="submit" class="campus-button campus-button-small">Post reply</button><p class="campus-form-status" role="status"></p></form>` : '<p class="campus-muted">Sign in with a campus membership to reply.</p>'}</details></article>`;
}

function communityView(ctx) {
  const { state, esc, href } = ctx;
  const posts = rows(state, 'posts').slice().sort(newest);
  const channels = [...new Set(['Campus', 'Questions', 'Resources', 'Celebrations', ...posts.map((post) => post.channel).filter(Boolean)])];
  const selected = channels.includes(queryValue('channel')) ? queryValue('channel') : '';
  const filtered = posts.filter((post) => !selected || (post.channel || 'Campus') === selected);
  return `${guestNotice(state)}${communicationNav(ctx, 'community')}<div class="campus-grid campus-grid-main"><div class="campus-stack"><section class="campus-panel campus-community-compose"><div class="campus-section-head"><div><p class="campus-eyebrow">A place for your voice</p><h2>What’s happening on the Hill?</h2></div></div><form data-campus-command="post"><label class="campus-field"><span>Share with your campus</span><textarea name="body" rows="3" maxlength="5000" required placeholder="Ask a question, share a resource, or celebrate a win."${canAct(state) ? '' : ' disabled'}></textarea></label><div class="campus-form-actions"><label class="campus-field"><span>Conversation</span><select name="channel"${canAct(state) ? '' : ' disabled'}>${channels.map((channel) => `<option value="${esc(channel)}"${channel === selected ? ' selected' : ''}>${esc(channel)}</option>`).join('')}</select></label><button type="submit" class="campus-button"${canAct(state) ? '' : ' disabled'}>Share post</button></div><p class="campus-form-status" role="status"></p></form></section><div class="campus-section-head"><h2>Campus conversations</h2><span class="campus-muted" data-campus-feed-count>${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}</span></div><div class="campus-channel-filters" role="group" aria-label="Filter community feed">${['', ...channels].map((channel) => `<button type="button" class="campus-channel-filter" data-campus-channel="${esc(channel)}" aria-pressed="${channel === selected}">${esc(channel || 'All conversations')}</button>`).join('')}</div><p class="campus-sr-only" data-campus-filter-status role="status"></p><div class="campus-feed">${posts.length ? posts.map((post) => postCard(post, ctx).replace('data-campus-post ', `data-campus-post ${selected && (post.channel || 'Campus') !== selected ? 'hidden ' : ''}`)).join('') : empty('Start something good', 'The first conversation can be a simple introduction. Share what you’re learning or ask a question.', ctx)}<p class="campus-empty" data-campus-filter-empty${filtered.length || !posts.length ? ' hidden' : ''}>No posts in this conversation yet. You can start one above.</p></div></div><aside class="campus-stack"><section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Keep in touch</p><h2>Your messages</h2></div><a href="${esc(href('messages'))}">Open inbox</a></div>${recentConversations(ctx)}<a class="campus-button campus-button-secondary campus-button-small" href="${esc(href('messages', { new: '1' }))}">New message</a></section><section class="campus-panel"><p class="campus-eyebrow">Find your people</p><h2>Connection starts here.</h2><div class="campus-list campus-community-links"><a href="${esc(href('live'))}">Your cohort classrooms <span aria-hidden="true">→</span></a><a href="${esc(href('events'))}">Meet at a campus event <span aria-hidden="true">→</span></a><a href="${esc(href('messages', { new: '1' }))}">Find a campus member <span aria-hidden="true">→</span></a></div></section><section class="campus-panel"><p class="campus-eyebrow">Our shared space</p><h2>Make room for each other.</h2><p>Be thoughtful. Give credit. Ask with curiosity.</p><p class="campus-muted">Posts and replies are visible to campus members. Use support requests for personal student concerns.</p><a href="${esc(href('support'))}">Get private support <span aria-hidden="true">→</span></a></section></aside></div>`;
}

function peopleView(ctx) {
  const { state, esc, href } = ctx;
  const id = userId(state), inbox = conversations(ctx), ui = communicationState(ctx);
  const members = rows(state, 'members').filter((member) => member.user_id !== id && member.active !== false).slice().sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
  const requested = queryValue('person'), directory = queryValue('new') === '1';
  const selected = canAct(state) && !directory ? requested ? members.find((member) => member.user_id === requested) || inbox.find((conversation) => conversation.member.user_id === requested)?.member : inbox[0]?.member : null;
  const messages = selected ? inbox.find((conversation) => conversation.member.user_id === selected.user_id)?.messages || [] : [];
  const unread = inbox.reduce((sum, conversation) => sum + conversation.unread, 0);
  const search = String(ui.search || '');
  const matches = members.filter((member) => `${member.display_name} ${roleLabel(member.role)}`.toLowerCase().includes(search.toLowerCase().trim()));
  const list = directory ? `<div class="campus-section-head"><div><p class="campus-eyebrow">Start a conversation</p><h2>New message</h2></div><a href="${esc(href('messages'))}" data-campus-message-list>Inbox</a></div><label class="campus-field"><span>Find a campus member</span><input type="search" data-campus-filter="people" placeholder="Search by name or role" autocomplete="off" value="${esc(search)}"></label><p class="campus-sr-only" data-campus-filter-status role="status"></p><div class="campus-list">${members.length ? members.map((member) => `<div class="campus-row campus-member-row" data-campus-member data-search="${esc(`${member.display_name} ${roleLabel(member.role)}`.toLowerCase())}"${matches.includes(member) ? '' : ' hidden'}><span class="campus-avatar" aria-hidden="true">${esc(initials(member.display_name))}</span><div><h3>${esc(member.display_name)}</h3><p class="campus-muted">${esc(roleLabel(member.role))}</p></div>${canAct(state) ? `<a class="campus-button campus-button-secondary campus-button-small" href="${esc(href('messages', { person: member.user_id }))}" data-campus-person="${esc(member.user_id)}" aria-label="Message ${esc(member.display_name)}">Message</a>` : ''}</div>`).join('') : empty('Your community is taking shape', 'Approved campus members will appear here.', ctx)}<p class="campus-empty" data-campus-filter-empty${matches.length || !members.length ? ' hidden' : ''}>No members match your search.</p></div>` : `<div class="campus-section-head"><div><p class="campus-eyebrow">Your conversations</p><h2>Inbox${unread ? ` <span class="campus-message-unread">${unread}<span class="campus-sr-only"> unread</span></span>` : ''}</h2></div><a class="campus-button campus-button-small" href="${esc(href('messages', { new: '1' }))}" data-campus-message-new>New message</a></div>${inbox.length ? `<div class="campus-conversation-list">${inbox.map((conversation) => conversationRow(conversation, ctx, selected?.user_id, true)).join('')}</div>` : empty('A conversation starts with hello.', canAct(state) ? 'Message a classmate, reconnect with your cohort, or reach out to a campus staff member.' : 'Sign in with a campus membership to open your inbox.', ctx)}`;
  return `${guestNotice(state)}${communicationNav(ctx, 'messages')}<div class="campus-messages-layout${requested && selected ? ' is-thread' : ''}${directory ? ' is-directory' : ''}"><section class="campus-panel campus-inbox-list" aria-label="${directory ? 'Campus directory' : 'Recent conversations'}">${list}</section><section class="campus-panel campus-conversation" aria-label="Direct messages"${selected ? ` data-campus-open-person="${esc(selected.user_id)}"` : ''}>${selected ? `<div class="campus-message-heading"><a class="campus-message-back" href="${esc(href('messages'))}" data-campus-message-list><span aria-hidden="true">←</span> Back to messages</a><div class="campus-row"><span class="campus-avatar" aria-hidden="true">${esc(initials(selected.display_name))}</span><div><h2 tabindex="-1" data-campus-thread-heading>${esc(selected.display_name)}</h2><p class="campus-muted">${selected.available === false ? 'No longer in the campus directory' : esc(roleLabel(selected.role))} · Direct conversation</p></div></div></div><div class="campus-message-history" role="log" aria-label="Conversation with ${esc(selected.display_name)}">${messages.length ? messages.map((message) => `<div class="campus-message${message.sender_id === id ? ' campus-message-own' : ''}" data-campus-message-id="${esc(message.id)}"${message.recipient_id === id && !message.read_at ? ' data-campus-message-unread' : ''}><p class="campus-message-author">${message.sender_id === id ? 'You' : esc(selected.display_name)}</p>${textBlock(message.body, ctx)}<time class="campus-muted" datetime="${esc(message.created_at)}">${esc(dateText(message.created_at, ctx, true))}</time></div>`).join('') : empty('Say hello', `Start your conversation with ${selected.display_name}. Messages are visible to the two of you.`, ctx)}</div><form data-campus-command="sendMessage" data-recipient-id="${esc(selected.user_id)}" class="campus-compose"><label class="campus-field"><span>Your message to ${esc(selected.display_name)}</span><textarea name="body" required rows="3" maxlength="5000" placeholder="${selected.available === false ? 'Messaging is unavailable for this member.' : 'Write a message…'}"${selected.available === false ? ' disabled' : ''}></textarea></label><div class="campus-form-actions"><p class="campus-muted">${selected.available === false ? 'This member is no longer available for messages. Your conversation history stays here.' : state.mode === 'demo' ? 'Sample conversation · saved in this browser.' : 'Visible to you and this campus member.'}</p><button type="submit" class="campus-button"${selected.available === false ? ' disabled' : ''}>Send message</button></div><p class="campus-form-status" role="status"></p></form>` : `<div class="campus-conversation-empty"><p class="campus-eyebrow">${directory ? 'Find your people' : 'Keep in touch'}</p><h2>${requested ? 'This conversation isn’t available.' : 'A conversation can open a door.'}</h2><p>${requested ? 'Choose an active campus member to start a conversation.' : directory ? 'Search for a classmate or campus staff member, then select Message.' : 'Choose a conversation from your inbox or send someone a new message.'}</p>${!directory ? `<a class="campus-button campus-button-secondary" href="${esc(href('messages', { new: '1' }))}" data-campus-message-new>Find someone to message</a>` : ''}<p><a href="${esc(href('support'))}">Need help? Contact support <span aria-hidden="true">→</span></a></p></div>`}</section></div>`;
}

export function renderStudent(view, ctx) {
  const render = { home: homeView, learn: learnView, events: eventsView, community: communityView, people: peopleView, messages: peopleView }[view];
  return render ? render(ctx) : '';
}

function calendarEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function calendarDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('This event needs a valid date before it can be added to your calendar.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let result = '', current = '', bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += `${current}\r\n`; current = ' '; bytes = 1; }
    current += character;
    bytes += size;
  }
  return result + current;
}

/** A real downloadable calendar event using UTC instants and escaped RFC 5545 text. */
export function calendarForEvent(event, stamp = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Taylormade Academy//HT Campus Hub//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${calendarEscape(event.id)}@ht-hub.taylormadeacademy.com`, `DTSTAMP:${calendarDate(stamp)}`, `DTSTART:${calendarDate(event.starts_at)}`, `DTEND:${calendarDate(event.ends_at || new Date(time(event.starts_at) + 60 * 60_000))}`, `SUMMARY:${calendarEscape(event.title)}`, `DESCRIPTION:${calendarEscape(event.description)}`, `LOCATION:${calendarEscape(event.location)}`, `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR'];
  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}

function download(content, mime, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function runWithButton(button, callback) {
  const disabled = button.disabled;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { return await callback(); }
  finally {
    if (button.isConnected) { button.disabled = disabled; button.removeAttribute('aria-busy'); }
  }
}

export function bindStudent(view, root, ctx) {
  const messageView = ['people', 'messages'].includes(view);
  let disposed = false, readFrame = null;
  const ui = communicationState(ctx);
  const navigateMessages = async (anchor) => {
    const next = new URL(anchor.href, globalThis.location.href);
    globalThis.history.pushState({}, '', next.pathname + next.search + next.hash);
    await ctx.refresh();
    const target = root.querySelector(anchor.hasAttribute('data-campus-person') ? '[data-campus-thread-heading]' : anchor.hasAttribute('data-campus-message-new') ? '[data-campus-filter="people"]' : '.campus-inbox-list h2');
    if (target) { if (!target.matches('input')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  };
  const onClick = async (event) => {
    const messageLink = event.target.closest?.('[data-campus-person],[data-campus-message-list],[data-campus-message-new]');
    if (messageView && messageLink && root.contains(messageLink) && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      try { await navigateMessages(messageLink); }
      catch (error) { ctx.notify(error.message || 'This conversation could not open. Please try again.', 'error'); }
      return;
    }
    const channel = event.target.closest?.('[data-campus-channel]');
    if (channel && root.contains(channel)) {
      const value = channel.dataset.campusChannel;
      let count = 0;
      root.querySelectorAll('[data-campus-channel]').forEach((button) => button.setAttribute('aria-pressed', String(button === channel)));
      root.querySelectorAll('[data-campus-post]').forEach((post) => { post.hidden = !!value && post.dataset.channel !== value; if (!post.hidden) count++; });
      const url = new URL(globalThis.location.href);
      if (value) url.searchParams.set('channel', value); else url.searchParams.delete('channel');
      globalThis.history.replaceState({}, '', url.pathname + url.search + url.hash);
      const status = root.querySelector('[data-campus-filter-status]'), placeholder = root.querySelector('[data-campus-filter-empty]'), label = root.querySelector('[data-campus-feed-count]');
      if (status) status.textContent = `${count} ${count === 1 ? 'post' : 'posts'} shown.`;
      if (placeholder) placeholder.hidden = count > 0 || !rows(ctx.state, 'posts').length;
      if (label) label.textContent = `${count} ${count === 1 ? 'post' : 'posts'}`;
      return;
    }
    const button = event.target.closest?.('[data-campus-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.campusAction;
    try {
      if (action === 'downloadCalendar') {
        const campusEvent = rows(ctx.state, 'events').find((item) => item.id === button.dataset.eventId);
        if (!campusEvent) throw new Error('This event is no longer available. Refresh the page and try again.');
        const illustrative = ['demo', 'guest'].includes(ctx.state.mode);
        const exportedEvent = illustrative ? { ...campusEvent, title: `[Sample] ${campusEvent.title}`, description: `Illustrative HT Hub demo event. This is not an official campus event.\n\n${campusEvent.description || ''}` } : campusEvent;
        download(calendarForEvent(exportedEvent), 'text/calendar;charset=utf-8', 'ht-campus-event.ics');
        ctx.notify(illustrative ? 'Sample calendar file downloaded. It is labeled as an illustrative event.' : 'Calendar file downloaded. Open it to add the event to your calendar.');
        return;
      }
      if (action === 'downloadCredential') {
        const course = publishedCourses(ctx.state).find((item) => item.id === button.dataset.courseId);
        const enrollment = own(ctx.state, 'enrollments').find((item) => item.course_id === course?.id && item.completed_at && item.credential_id);
        if (!course || !enrollment) throw new Error('A completion record is available after all pathway requirements are complete.');
        const demoLabel = ctx.state.mode === 'demo' ? 'ILLUSTRATIVE DEMO RECORD — NOT AN INSTITUTIONAL CREDENTIAL\n\n' : '';
        const content = `${demoLabel}HT CAMPUS HUB · LEARNING COMPLETION RECORD\n\nLearner: ${ctx.state.member.display_name}\nPathway: ${course.title}\nCompleted: ${new Date(enrollment.completed_at).toISOString()}\nCredential ID: ${credentialLabel(enrollment.credential_id, enrollment.completed_at)}\nRecord reference: ${enrollment.credential_id}\n\nIssued by the HT Campus Hub. Campus staff can confirm the saved completion using this credential ID.\n`;
        download(content, 'text/plain;charset=utf-8', 'ht-learning-completion.txt');
        ctx.notify('Your completion record has been downloaded.');
        return;
      }
      if (action === 'printRecord') {
        const body = globalThis.document?.body;
        if (!body || typeof globalThis.print !== 'function') return;
        body.classList.add('badge-print-mode');
        const done = () => { body.classList.remove('badge-print-mode'); globalThis.removeEventListener('afterprint', done); };
        globalThis.addEventListener('afterprint', done);
        globalThis.print();
        setTimeout(done, 1000);
        return;
      }
      if (!canAct(ctx.state)) { ctx.notify('Sign in with a campus membership to continue.', 'error'); return; }
      if (action === 'enroll') await runWithButton(button, () => ctx.run('enroll', { course_id: button.dataset.courseId }, 'You’re enrolled. Your first module is ready.'));
      if (action === 'rsvp') await runWithButton(button, () => ctx.run('rsvp', { event_id: button.dataset.eventId, status: button.dataset.status }, button.dataset.status === 'going' ? 'Your place is saved.' : 'Your RSVP has been cancelled.'));
      if (action === 'like') await runWithButton(button, () => ctx.run('like', { post_id: button.dataset.postId, liked: button.dataset.liked !== 'true' }, button.dataset.liked === 'true' ? 'Like removed.' : 'Post liked.'));
    } catch (error) { ctx.notify(error.message || 'Something went wrong. Please try again.', 'error'); }
  };

  const onSubmit = async (event) => {
    const form = event.target.closest?.('form[data-campus-command]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    if (!canAct(ctx.state)) { ctx.notify('Sign in with a campus membership to continue.', 'error'); return; }
    if (!form.reportValidity()) return;
    const command = form.dataset.campusCommand;
    const data = new FormData(form);
    const field = (name) => String(data.get(name) || '').trim();
    let payload, message;
    if (command === 'completeModule') {
      payload = { module_id: form.dataset.moduleId };
      if (data.has('answer_index')) payload.answer_index = Number(data.get('answer_index'));
      const module = rows(ctx.state, 'modules').find((item) => item.id === payload.module_id);
      message = module?.assignment_prompt ? 'Your answer is correct. Submit your project for instructor review.' : 'Module complete. Your progress is saved.';
    } else if (command === 'submitWork') {
      payload = { module_id: form.dataset.moduleId, body: field('body'), link_url: field('link_url') || null };
      if (payload.body.length < 20) { ctx.notify('Add at least 20 characters to explain your work.', 'error'); return; }
      if (payload.link_url && (!safeCampusUrl(payload.link_url) || !/^https:\/\//i.test(payload.link_url))) { ctx.notify('Use a secure https:// project link.', 'error'); return; }
      message = 'Your project is saved and ready for instructor review.';
    } else if (command === 'checkin') {
      payload = { event_id: form.dataset.eventId, code: field('code') };
      message = 'You’re checked in. Your attendance is saved.';
    } else if (command === 'post') {
      payload = { channel: field('channel'), body: field('body') };
      message = 'Your post is shared with the campus community.';
    } else if (command === 'reply') {
      payload = { post_id: form.dataset.postId, body: field('body') };
      message = 'Your reply is posted.';
    } else if (command === 'sendMessage') {
      payload = { recipient_id: form.dataset.recipientId, body: field('body') };
      if (!rows(ctx.state, 'members').some((member) => member.user_id === payload.recipient_id && member.active !== false)) {
        ctx.notify('This member is no longer available for messages. Your conversation history is still here.', 'error');
        return;
      }
      message = 'Message sent.';
    } else { return; }
    if ('body' in payload && !payload.body) { ctx.notify('Write a message before sending.', 'error'); return; }
    if ('code' in payload && !payload.code) { ctx.notify('Enter the attendance code from your host.', 'error'); return; }
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.campus-form-status');
    if (!button || button.disabled) return;
    try {
      if (status) status.textContent = 'Saving…';
      const succeeded = await runWithButton(button, () => ctx.run(command, payload, message, form));
      if (form.isConnected && status) status.textContent = succeeded ? message : 'Your changes weren’t saved. Review the message above and try again.';
      if (succeeded && form.isConnected && ['post', 'reply', 'sendMessage', 'checkin'].includes(command)) form.reset();
    } catch (error) {
      if (status && form.isConnected) status.textContent = error.message || 'Your changes weren’t saved. Please try again.';
      ctx.notify(error.message || 'Something went wrong. Please try again.', 'error');
    }
  };

  const onFilter = (event) => {
    const control = event.target.closest?.('[data-campus-filter]');
    if (!control || !root.contains(control)) return;
    const type = control.dataset.campusFilter;
    const value = control.value.trim().toLowerCase();
    if (type === 'people') ui.search = control.value;
    const items = root.querySelectorAll(type === 'people' ? '[data-campus-member]' : '[data-campus-post]');
    let count = 0;
    for (const item of items) {
      const match = type === 'people' ? (item.dataset.search || '').includes(value) : !value || (item.dataset.channel || '').toLowerCase() === value;
      item.hidden = !match;
      if (match) count += 1;
    }
    const placeholder = root.querySelector('[data-campus-filter-empty]');
    if (placeholder) placeholder.hidden = count !== 0 || !items.length;
    const status = root.querySelector('[data-campus-filter-status]');
    if (status) status.textContent = `${count} ${type === 'people' ? (count === 1 ? 'member' : 'members') : (count === 1 ? 'conversation' : 'conversations')} shown.`;
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onFilter);
  root.addEventListener('change', onFilter);
  const history = root.querySelector('.campus-message-history');
  if (history) history.scrollTop = history.scrollHeight;
  // Only acknowledge the IDs rendered in the open, visible conversation. A hidden phone
  // preview, another conversation, or a newer message arriving after render stays unread.
  const readVisibleConversation = () => {
    if (disposed || !messageView || !canAct(ctx.state) || document.hidden || !root.isConnected) return;
    const conversation = root.querySelector('[data-campus-open-person]');
    if (!conversation || !conversation.getClientRects().length || queryValue('new') === '1') return;
    const selected = conversation.dataset.campusOpenPerson, requested = queryValue('person');
    if (!requested || requested !== selected) return;
    const renderedIds = new Set(Array.from(conversation.querySelectorAll('[data-campus-message-unread]')).map((element) => element.dataset.campusMessageId));
    const messageIds = rows(ctx.state, 'messages').filter((message) => renderedIds.has(message.id) && message.sender_id === selected && message.recipient_id === userId(ctx.state) && !message.read_at).map((message) => message.id).slice(0, 200);
    if (!messageIds.length) return;
    const key = JSON.stringify(messageIds.slice().sort());
    if (ui.readBatches.has(key)) return;
    ui.readBatches.add(key);
    const focusedHeading = conversation.querySelector?.('[data-campus-thread-heading]');
    const keepHeadingFocus = !!focusedHeading && focusedHeading === document.activeElement;
    void ctx.run('readMessages', { message_ids: messageIds }).then((succeeded) => {
      // A failed attempt can retry on the next ordinary bind/visibility event;
      // do not immediately reschedule it and turn a connection failure into a loop.
      if (succeeded === false) ui.readBatches.delete(key);
      if (keepHeadingFocus && !document.hidden && document.activeElement === document.body && queryValue('person') === selected) {
        root.querySelector('[data-campus-thread-heading]')?.focus({ preventScroll: true });
      }
    }, () => { ui.readBatches.delete(key); });
  };
  const scheduleRead = () => {
    if (readFrame !== null) cancelAnimationFrame(readFrame);
    readFrame = requestAnimationFrame(() => { readFrame = null; readVisibleConversation(); });
  };
  const onPopState = () => { if (messageView) void ctx.refresh(); };
  if (messageView) {
    scheduleRead();
    window.addEventListener('resize', scheduleRead);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('visibilitychange', scheduleRead);
  }
  return () => {
    disposed = true;
    if (readFrame !== null) cancelAnimationFrame(readFrame);
    window.removeEventListener('resize', scheduleRead);
    window.removeEventListener('popstate', onPopState);
    document.removeEventListener('visibilitychange', scheduleRead);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('input', onFilter);
    root.removeEventListener('change', onFilter);
  };
}
