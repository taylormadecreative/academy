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

function homeView(ctx) {
  const { state, esc, href } = ctx;
  const enrollments = own(state, 'enrollments');
  const courses = publishedCourses(state);
  const current = courses.find((course) => enrollments.some((enrollment) => enrollment.course_id === course.id && !enrollment.completed_at));
  const recommended = current || courses[0];
  const upcoming = publishedEvents(state).filter((event) => event.status === 'published' && isFuture(event)).sort(dateOrder);
  const reservations = own(state, 'rsvps').filter((rsvp) => rsvp.status === 'going');
  const reservedEvents = upcoming.filter((event) => reservations.some((reservation) => reservation.event_id === event.id));
  const next = reservedEvents[0] || upcoming[0];
  const pending = own(state, 'submissions').filter((submission) => submission.status === 'revision');
  const requests = own(state, 'requests').filter((request) => request.status !== 'resolved');
  const completed = enrollments.filter((enrollment) => enrollment.completed_at).length;
  const courseLink = recommended ? `${href('learn')}#course-${encodeURIComponent(recommended.id)}` : href('learn');
  return `${guestNotice(state)}
    <section class="campus-hero"><div class="campus-hero-copy"><p class="campus-eyebrow">${current ? 'Continue your learning' : 'Your day on the Hill'}</p><h2>${esc(current?.title || 'Find your next opportunity.')}</h2><p>${current ? 'Pick up where you left off. Your progress and instructor feedback are saved here.' : 'Explore campus learning, find an event, or connect with someone who can help.'}</p><div class="campus-card-actions"><a class="campus-button" href="${esc(courseLink)}">${current ? 'Continue learning' : 'Explore learning'}</a><a class="campus-button campus-button-secondary" href="${esc(href('support'))}">Get help</a></div></div><div class="campus-hero-aside"><p class="campus-eyebrow">${next ? (time(next.starts_at) <= Date.now() && time(next.ends_at) >= Date.now() ? 'Happening now' : 'Coming up') : 'Make the most of campus'}</p>${next ? `<h3>${esc(next.title)}</h3><p>${esc(dateText(next.starts_at, ctx, true))}</p><p>${esc(next.location || next.office || 'Campus')}</p><a href="${esc(href('events'))}#event-${esc(next.id)}">View event <span aria-hidden="true">→</span></a>` : `<h3>Find your next opportunity.</h3><p>Explore campus events and connect with the people who can help.</p><a href="${esc(href('people'))}">Meet the community <span aria-hidden="true">→</span></a>`}</div></section>
    <div class="campus-grid campus-stats"><div class="campus-stat"><span class="campus-stat-value">${enrollments.length}</span><span>Learning pathways</span></div><div class="campus-stat"><span class="campus-stat-value">${reservedEvents.length}</span><span>Upcoming RSVPs</span></div><div class="campus-stat"><span class="campus-stat-value">${completed}</span><span>Pathways completed</span></div></div>
    <div class="campus-grid campus-grid-main"><div class="campus-stack"><section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Keep your momentum</p><h2>Your next steps</h2></div></div><div class="campus-list">
      ${pending.length ? `<a class="campus-next-action" href="${esc(href('learn'))}"><span class="campus-action-number">01</span><span><strong>Review your instructor’s feedback</strong><span class="campus-muted">${pending.length} ${pending.length === 1 ? 'project is' : 'projects are'} ready for revision.</span></span><span aria-hidden="true">→</span></a>` : ''}
      <a class="campus-next-action" href="${esc(courseLink)}"><span class="campus-action-number">${pending.length ? '02' : '01'}</span><span><strong>${current ? 'Pick up where you left off' : 'Start a learning pathway'}</strong><span class="campus-muted">${esc(recommended?.title || 'Explore guided learning from your campus.')}</span></span><span aria-hidden="true">→</span></a>
      <a class="campus-next-action" href="${esc(href('events'))}"><span class="campus-action-number">${pending.length ? '03' : '02'}</span><span><strong>${reservedEvents.length ? 'You have a place on campus' : 'Find something worth showing up for'}</strong><span class="campus-muted">${reservedEvents.length ? esc(`${reservedEvents[0].title} · ${dateText(reservedEvents[0].starts_at, ctx)}`) : 'Workshops, conversations, and campus events.'}</span></span><span aria-hidden="true">→</span></a>
      <a class="campus-next-action" href="${esc(href('support'))}"><span class="campus-action-number">${pending.length ? '04' : '03'}</span><span><strong>${requests.length ? 'Follow your support request' : 'A little support goes a long way'}</strong><span class="campus-muted">${requests.length ? `${requests.length} ${requests.length === 1 ? 'request' : 'requests'} in progress.` : 'Learning, career, technology, and campus life.'}</span></span><span aria-hidden="true">→</span></a>
    </div></section>${current ? `<section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Your learning</p><h2>${esc(current.title)}</h2></div></div>${courseProgress(current, ctx)}<p>${esc(current.description)}</p><a class="campus-button campus-button-secondary" href="${esc(courseLink)}">Continue pathway</a></section>` : ''}${announcementList(ctx)}</div><aside class="campus-stack"><section class="campus-panel"><div class="campus-section-head"><h2>On your calendar</h2><a href="${esc(href('events'))}">All events</a></div>${upcoming.length ? `<div class="campus-list">${upcoming.slice(0, 3).map((event) => `<a class="campus-row campus-calendar-row" href="${esc(href('events'))}#event-${esc(event.id)}"><span class="campus-event-date">${esc(ctx.formatDate(event.starts_at))}</span><span><strong>${esc(event.title)}</strong><span class="campus-muted">${esc(ctx.formatTime(event.starts_at))} · ${esc(event.location || event.office || 'Campus')}${reservations.some((item) => item.event_id === event.id) ? ' · Going' : ''}</span></span></a>`).join('')}</div>` : empty('Your calendar has room', 'New campus events will appear here when they are published.', ctx)}</section>${adaCard(ctx)}<section class="campus-panel campus-support-card"><p class="campus-eyebrow">You belong here</p><h2>People make a campus.</h2><p>Ask a question, share a win, or introduce yourself to the community.</p><a class="campus-button campus-button-secondary" href="${esc(href('community'))}">Join the conversation</a></section></aside></div>`;
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

function learnView(ctx) {
  const { state, esc, href } = ctx;
  const courses = publishedCourses(state);
  const enrollments = own(state, 'enrollments');
  return `${guestNotice(state)}<div class="campus-page-intro"><p>Build skills one clear step at a time. Complete activities, get instructor feedback, and keep a record of what you’ve learned.</p><a href="${esc(href('/ht/hub/replay/'))}">Browse session replays <span aria-hidden="true">→</span></a></div>${courses.length ? `<div class="campus-stack">${courses.map((course) => {
    const enrollment = enrollments.find((item) => item.course_id === course.id);
    const progress = progressFor(state, course.id);
    const image = safeCampusUrl(course.image_url);
    return `<section class="campus-panel campus-course" id="course-${esc(course.id)}"><div class="campus-course-heading">${image ? `<img class="campus-course-image" src="${esc(image)}" alt="" loading="lazy">` : ''}<div><p class="campus-eyebrow">${esc(course.category || 'Campus learning')} · ${progress.total} ${progress.total === 1 ? 'module' : 'modules'}</p><h2>${esc(course.title)}</h2><p>${esc(course.description)}</p></div>${!enrollment ? `<button type="button" class="campus-button" data-campus-action="enroll" data-course-id="${esc(course.id)}"${canAct(state) && progress.total ? '' : ' disabled'}>Enroll in pathway</button>` : `<span class="campus-label">${enrollment.completed_at ? 'Pathway complete' : 'You’re enrolled'}</span>`}</div>${enrollment ? courseProgress(course, ctx) : ''}${enrollment?.completed_at && enrollment.credential_id ? `<div class="campus-credential"><div><p class="campus-eyebrow">Learning accomplished</p><h3>Your completion record</h3><p>${esc(state.member?.display_name || 'Campus learner')} completed this pathway on ${esc(dateText(enrollment.completed_at, ctx))}.</p><p class="campus-muted">Credential ID: <code>${esc(enrollment.credential_id)}</code></p><p class="campus-muted">Issued by this Hub. Campus staff can confirm this record using the credential ID.</p></div><button type="button" class="campus-button campus-button-secondary campus-button-small" data-campus-action="downloadCredential" data-course-id="${esc(course.id)}">Download record</button></div>` : ''}<div class="campus-modules">${progress.modules.length ? progress.modules.map((module, index) => moduleCard(module, index, progress, !!enrollment, ctx)).join('') : empty('A new pathway is taking shape', 'Modules will be available when the instructor publishes them.', ctx)}</div></section>`;
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
  const { state, esc } = ctx;
  const author = memberName(state, post.author_id);
  const replies = rows(state, 'replies').filter((reply) => reply.post_id === post.id).sort((a, b) => -newest(a, b));
  const likes = rows(state, 'likes').filter((like) => like.post_id === post.id);
  const liked = likes.some((like) => like.user_id === userId(state));
  return `<article class="campus-panel campus-post" data-campus-post data-channel="${esc(post.channel || 'Campus')}"><div class="campus-row"><span class="campus-avatar" aria-hidden="true">${esc(initials(author))}</span><div><h3>${esc(author)}</h3><p class="campus-muted"><time datetime="${esc(post.created_at)}">${esc(dateText(post.created_at, ctx, true))}</time> · ${esc(post.channel || 'Campus')}</p></div></div>${textBlock(post.body, ctx)}<div class="campus-card-actions"><button type="button" class="campus-button campus-button-secondary campus-button-small" data-campus-action="like" data-post-id="${esc(post.id)}" data-liked="${liked ? 'true' : 'false'}" aria-pressed="${liked}"${canAct(state) ? '' : ' disabled'}>${liked ? 'Liked' : 'Like'}${likes.length ? ` · ${likes.length}` : ''}</button><span class="campus-muted">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span></div><details class="campus-replies"><summary>${replies.length ? 'Read replies & respond' : 'Start a conversation'}</summary><div class="campus-thread">${replies.map((reply) => `<div class="campus-reply"><p class="campus-meta"><strong>${esc(memberName(state, reply.author_id))}</strong><time datetime="${esc(reply.created_at)}">${esc(dateText(reply.created_at, ctx, true))}</time></p>${textBlock(reply.body, ctx)}</div>`).join('')}</div>${canAct(state) ? `<form data-campus-command="reply" data-post-id="${esc(post.id)}"><label class="campus-field"><span>Your reply</span><textarea name="body" rows="2" maxlength="5000" required placeholder="Add something to the conversation."></textarea></label><button type="submit" class="campus-button campus-button-small">Post reply</button><p class="campus-form-status" role="status"></p></form>` : '<p class="campus-muted">Sign in with a campus membership to reply.</p>'}</details></article>`;
}

function communityView(ctx) {
  const { state, esc, href } = ctx;
  const posts = rows(state, 'posts').slice().sort(newest);
  const channels = [...new Set(['Campus', 'Questions', 'Resources', 'Celebrations', ...posts.map((post) => post.channel).filter(Boolean)])];
  return `${guestNotice(state)}<div class="campus-grid campus-grid-main"><div class="campus-stack"><section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">A place for your voice</p><h2>What’s happening on the Hill?</h2></div></div><form data-campus-command="post"><label class="campus-field"><span>Share with your campus</span><textarea name="body" rows="3" maxlength="5000" required placeholder="Ask a question, share a resource, or celebrate a win."${canAct(state) ? '' : ' disabled'}></textarea></label><div class="campus-form-actions"><label class="campus-field"><span>Conversation</span><select name="channel"${canAct(state) ? '' : ' disabled'}>${channels.map((channel) => `<option value="${esc(channel)}">${esc(channel)}</option>`).join('')}</select></label><button type="submit" class="campus-button"${canAct(state) ? '' : ' disabled'}>Share post</button></div><p class="campus-form-status" role="status"></p></form></section><div class="campus-section-head"><h2>Campus conversations</h2><label class="campus-field campus-field-inline"><span class="campus-sr-only">Filter conversation</span><select data-campus-filter="channel"><option value="">All conversations</option>${channels.map((channel) => `<option value="${esc(channel)}">${esc(channel)}</option>`).join('')}</select></label></div><p class="campus-sr-only" data-campus-filter-status role="status"></p><div class="campus-feed">${posts.length ? posts.map((post) => postCard(post, ctx)).join('') : empty('Start something good', 'The first conversation can be a simple introduction. Share what you’re learning or ask a question.', ctx)}<p class="campus-empty" data-campus-filter-empty hidden>No posts in this conversation yet.</p></div></div><aside class="campus-stack"><section class="campus-panel"><p class="campus-eyebrow">Our shared space</p><h2>Make room for each other.</h2><p>Be thoughtful. Give credit. Ask with curiosity. Share only information you have permission to share.</p><p class="campus-muted">Posts and replies are visible to campus members. Use support requests for personal student concerns.</p><a href="${esc(href('support'))}">Get private support <span aria-hidden="true">→</span></a></section><section class="campus-panel"><h2>Find your people</h2><p>Connect directly with active members of your campus community.</p><a class="campus-button campus-button-secondary" href="${esc(href('people'))}">Open the directory</a></section></aside></div>`;
}

function peopleView(ctx) {
  const { state, esc, href } = ctx;
  const id = userId(state);
  const recentMessages = new Map();
  for (const message of rows(state, 'messages').filter((item) => item.sender_id === id || item.recipient_id === id).slice().sort(newest)) {
    const person = message.sender_id === id ? message.recipient_id : message.sender_id;
    if (!recentMessages.has(person)) recentMessages.set(person, message);
  }
  const members = rows(state, 'members').slice().sort((a, b) => {
    const aMessage = recentMessages.get(a.user_id), bMessage = recentMessages.get(b.user_id);
    if (aMessage || bMessage) return (time(bMessage?.created_at) || 0) - (time(aMessage?.created_at) || 0);
    return String(a.display_name).localeCompare(String(b.display_name));
  });
  const preview = (member) => {
    const message = recentMessages.get(member.user_id);
    if (!message || !canAct(state)) return '';
    const excerpt = Array.from(String(message.body || ''));
    return `<p class="campus-message-preview"><span class="campus-sr-only">Last message: </span>${message.sender_id === id ? 'You: ' : ''}${esc(excerpt.slice(0, 70).join(''))}${excerpt.length > 70 ? '…' : ''}</p>`;
  };
  const requested = queryValue('person');
  const selected = requested ? members.find((member) => member.user_id === requested && member.user_id !== id) : members.find((member) => member.user_id !== id && recentMessages.has(member.user_id));
  const messages = selected ? rows(state, 'messages').filter((message) => (message.sender_id === id && message.recipient_id === selected.user_id) || (message.sender_id === selected.user_id && message.recipient_id === id)).sort((a, b) => -newest(a, b)) : [];
  return `${guestNotice(state)}<div class="campus-page-intro"><p>A campus is a community of people. Find a familiar face or start a new conversation.</p></div><div class="campus-grid campus-people-grid"><section class="campus-panel campus-directory"><div class="campus-section-head"><h2>Campus directory</h2><span class="campus-label">${members.length} ${members.length === 1 ? 'member' : 'members'}</span></div><label class="campus-field"><span>Find a campus member</span><input type="search" data-campus-filter="people" placeholder="Search by name or role" autocomplete="off"></label><p class="campus-sr-only" data-campus-filter-status role="status"></p><div class="campus-list">${members.length ? members.map((member) => `<div class="campus-row campus-member-row" data-campus-member data-search="${esc(`${member.display_name} ${roleLabel(member.role)}`.toLowerCase())}"><span class="campus-avatar" aria-hidden="true">${esc(initials(member.display_name))}</span><div><h3>${esc(member.display_name)}${member.user_id === id ? ' <span class="campus-muted">(you)</span>' : ''}</h3><p class="campus-muted">${esc(roleLabel(member.role))}</p>${preview(member)}</div>${member.user_id !== id && canAct(state) ? `<a class="campus-button campus-button-secondary campus-button-small" href="${esc(href('people', { person: member.user_id }))}"${selected?.user_id === member.user_id ? ' aria-current="true"' : ''} aria-label="Message ${esc(member.display_name)}">Message</a>` : ''}</div>`).join('') : empty('Your community is taking shape', 'Approved campus members will appear in this directory.', ctx)}<p class="campus-empty" data-campus-filter-empty hidden>No members match your search.</p></div></section><section class="campus-panel campus-conversation" aria-label="Direct messages">${selected && canAct(state) ? `<div class="campus-section-head"><div><p class="campus-eyebrow">Direct conversation</p><h2>${esc(selected.display_name)}</h2><p class="campus-muted">${esc(roleLabel(selected.role))}</p></div></div><div class="campus-message-history" role="log" aria-label="Conversation with ${esc(selected.display_name)}">${messages.length ? messages.map((message) => `<div class="campus-message${message.sender_id === id ? ' campus-message-own' : ''}"><p class="campus-message-author">${message.sender_id === id ? 'You' : esc(selected.display_name)}</p>${textBlock(message.body, ctx)}<time class="campus-muted" datetime="${esc(message.created_at)}">${esc(dateText(message.created_at, ctx, true))}</time></div>`).join('') : empty('Say hello', `Start your conversation with ${selected.display_name}. Messages are visible to the two of you.`, ctx)}</div><form data-campus-command="sendMessage" data-recipient-id="${esc(selected.user_id)}"><label class="campus-field"><span>Your message</span><textarea name="body" required rows="3" maxlength="5000" placeholder="Write a thoughtful message."></textarea></label><button type="submit" class="campus-button">Send message</button><p class="campus-form-status" role="status"></p></form>` : `<div class="campus-conversation-empty"><p class="campus-eyebrow">Start a connection</p><h2>A conversation can open a door.</h2><p>${requested ? 'That member is unavailable. Choose someone from the directory to start a conversation.' : 'Choose a campus member from the directory to open your conversation.'}</p><a href="${esc(href('support'))}">Need help with something? Contact support <span aria-hidden="true">→</span></a></div>`}</section></div>`;
}

export function renderStudent(view, ctx) {
  const render = { home: homeView, learn: learnView, events: eventsView, community: communityView, people: peopleView }[view];
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
  const onClick = async (event) => {
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
        const content = `${demoLabel}HT CAMPUS HUB · LEARNING COMPLETION RECORD\n\nLearner: ${ctx.state.member.display_name}\nPathway: ${course.title}\nCompleted: ${new Date(enrollment.completed_at).toISOString()}\nCredential ID: ${enrollment.credential_id}\n\nIssued by the HT Campus Hub. Campus staff can confirm the saved completion using this credential ID.\n`;
        download(content, 'text/plain;charset=utf-8', 'ht-learning-completion.txt');
        ctx.notify('Your completion record has been downloaded.');
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
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('input', onFilter);
    root.removeEventListener('change', onFilter);
  };
}
