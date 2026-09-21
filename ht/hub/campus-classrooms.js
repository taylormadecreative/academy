/* Scheduled cohort classrooms. The store and managed-room bridge enforce access. */
const arrays = (state, key) => Array.isArray(state?.[key]) ? state[key] : [];
const uid = ctx => ctx.state.user?.id || ctx.state.member?.user_id || '';
const role = ctx => ctx.state.member?.role;
const member = ctx => !!ctx.state.user && !!ctx.state.member && ['live', 'demo'].includes(ctx.state.mode);
const staff = ctx => member(ctx) && ['staff', 'admin'].includes(role(ctx));
const admin = ctx => member(ctx) && role(ctx) === 'admin';
const e = (ctx, value) => ctx.esc(String(value ?? ''));
const millis = value => new Date(value || '').getTime();
const byStart = (a, b) => (millis(a.starts_at) || 0) - (millis(b.starts_at) || 0);
const find = (state, key, id) => arrays(state, key).find(item => item.id === id);
const memories = new Map();
const roomSlug = value => /^htc-[0-9a-f]{24}$/.test(String(value || ''));
const manageCohort = (ctx, cohort) => !!cohort && staff(ctx) && (admin(ctx) || cohort.instructor_id === uid(ctx));
const manageSession = (ctx, session) => !!session && staff(ctx) && (admin(ctx) || session.instructor_id === uid(ctx));

function query(key) {
  try { return new URL(globalThis.location.href).searchParams.get(key) || ''; } catch { return ''; }
}

function memory(ctx) {
  const key = `${ctx.state.mode}:${uid(ctx)}:${role(ctx) || 'guest'}`;
  if (!memories.has(key)) memories.set(key, { tab: 'cohorts', cohort: null, session: null, audience: null, rehearsalJoins: new Set() });
  return memories.get(key);
}

function localDateTime(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function person(ctx, id) {
  return arrays(ctx.state, 'members').find(item => item.user_id === id)?.display_name || (id === uid(ctx) ? ctx.state.member?.display_name : '') || 'Assigned instructor';
}

function liveLink(ctx, params = {}) { return ctx.href('live', params); }
function cohortLink(ctx, id) { return liveLink(ctx, { cohort: id }); }

export function canViewClassroom(ctx, cohort) {
  if (!cohort) return false;
  if (ctx.state.mode === 'guest') return true; // The guest store supplies illustrative records only.
  if (!member(ctx)) return false;
  if (manageCohort(ctx, cohort)) return true;
  return role(ctx) !== 'leadership' && cohort.status === 'active' && arrays(ctx.state, 'cohort_members').some(item => item.cohort_id === cohort.id && item.user_id === uid(ctx) && item.active);
}

export function canViewClassSession(ctx, session) {
  if (!session || !['cohort', 'campus'].includes(session.audience)) return false;
  if (session.audience === 'campus') return member(ctx) || ctx.state.mode === 'guest';
  const cohort = find(ctx.state, 'cohorts', session.cohort_id);
  return canViewClassroom(ctx, cohort);
}

export function classSessionHref(ctx, session, replay = false) {
  if (!canViewClassSession(ctx, session)) return '';
  if (session.audience === 'cohort' && find(ctx.state, 'cohorts', session.cohort_id)?.status !== 'active') return '';
  if (replay && !session.replay_published) return '';
  if (session.status === 'cancelled') return '';
  if (ctx.state.mode === 'demo') return liveLink(ctx, { session: session.id, ...(replay ? { replay: '1' } : {}) });
  if (!member(ctx) || !roomSlug(session.room_slug)) return '';
  return ctx.href(replay ? '/ht/hub/replay/' : '/ht/hub/session/', { room: session.room_slug });
}

function date(ctx, value) {
  return Number.isFinite(millis(value)) ? `${e(ctx, ctx.formatDate(value))} · ${e(ctx, ctx.formatTime(value))}` : 'Time to be announced';
}

function paragraphs(ctx, value) {
  return String(value || '').split(/\n\s*\n/).filter(Boolean).map(text => `<p class="campus-body-text">${e(ctx, text)}</p>`).join('');
}

function empty(ctx, title, detail) { return `<div class="campus-empty"><h3>${e(ctx, title)}</h3><p>${e(ctx, detail)}</p></div>`; }
function option(ctx, value, label, current) { return `<option value="${e(ctx, value)}"${String(value) === String(current ?? '') ? ' selected' : ''}>${e(ctx, label)}</option>`; }
function field(ctx, name, label, value = '', type = 'text', attrs = '') { return `<label class="campus-field"><span>${e(ctx, label)}</span><input name="${name}" type="${type}" value="${e(ctx, value)}" ${attrs}></label>`; }
function textarea(ctx, name, label, value = '', attrs = '') { return `<label class="campus-field"><span>${e(ctx, label)}</span><textarea name="${name}" rows="4" ${attrs}>${e(ctx, value)}</textarea></label>`; }
function select(ctx, name, label, values, current, attrs = '') { return `<label class="campus-field"><span>${e(ctx, label)}</span><select name="${name}" ${attrs}>${values.map(([value, text]) => option(ctx, value, text, current)).join('')}</select></label>`; }
function hidden(ctx, name, value) { return `<input type="hidden" name="${name}" value="${e(ctx, value)}">`; }
function formActions(label, cancel = false) { return `<div class="campus-form-actions"><button class="campus-button" type="submit">${label}</button>${cancel ? '<button class="campus-button campus-button-secondary" type="button" data-classroom-action="cancel-editor">Cancel editing</button>' : ''}</div><p class="campus-form-status" role="status"></p>`; }

function notice(ctx) {
  if (ctx.state.mode === 'guest') return '<p class="campus-member-notice">You’re viewing sample classrooms. Sign in with an approved campus membership to open your own classroom.</p>';
  if (ctx.state.mode === 'demo') return '<p class="campus-member-notice">Classroom previews use sample people and schedules. Rehearsal actions do not start a live audio or video meeting.</p>';
  return '';
}

function sessionStatus(ctx, session) {
  if (session.status === 'cancelled') return ['Cancelled', ''];
  if (ctx.state.mode === 'demo') {
    if (session.is_live) return ['Sample live session', 'campus-label-success'];
    return millis(session.ends_at) < Date.now() ? ['Sample past session', ''] : ['Sample schedule', ''];
  }
  if (session.is_live) return ['Live now', 'campus-label-success'];
  if (millis(session.ends_at) < Date.now()) return ['Ended', ''];
  if (millis(session.starts_at) <= Date.now()) return ['Scheduled now', ''];
  return ['Scheduled', ''];
}

function joinAction(ctx, session, compact = false) {
  const href = classSessionHref(ctx, session);
  const cohort = session.cohort_id ? find(ctx.state, 'cohorts', session.cohort_id) : null;
  if (session.status === 'cancelled') return '<span class="campus-muted">This session has been cancelled.</span>';
  if (cohort?.status === 'archived') return '<span class="campus-muted">This classroom is archived.</span>';
  if (!member(ctx)) return '<span class="campus-muted">Campus sign-in required</span>';
  if (!href) return '<span class="campus-muted">The classroom link is unavailable.</span>';
  if (millis(session.ends_at) < Date.now() && !session.is_live && ctx.state.mode !== 'demo') return '<span class="campus-muted">This scheduled session has ended.</span>';
  const label = ctx.state.mode === 'demo' ? 'Open rehearsal' : session.is_live ? 'Join session' : manageSession(ctx, session) ? 'Open classroom' : 'Open session';
  return `<a class="campus-button${compact ? ' campus-button-small' : ''}" href="${e(ctx, href)}">${label} <span aria-hidden="true">→</span></a>`;
}

function sessionCard(ctx, session, options = {}) {
  const cohort = find(ctx.state, 'cohorts', session.cohort_id);
  const [label, color] = sessionStatus(ctx, session);
  const replay = classSessionHref(ctx, session, true);
  return `<article class="campus-panel campus-session-card"><div class="campus-section-head"><p class="campus-eyebrow">${e(ctx, session.audience === 'campus' ? 'Campus live event' : cohort?.title || 'Classroom session')}</p><span class="campus-label ${color}">${label}</span></div><h3>${e(ctx, session.title)}</h3><p class="campus-session-time"><time datetime="${e(ctx, session.starts_at)}">${date(ctx, session.starts_at)}</time>${Number.isFinite(millis(session.ends_at)) ? ` – ${e(ctx, ctx.formatTime(session.ends_at))}` : ''}</p><p class="campus-muted">With ${e(ctx, person(ctx, session.instructor_id))}</p>${session.description ? `<details class="campus-session-agenda"><summary>Session agenda</summary>${paragraphs(ctx, session.description)}</details>` : ''}<div class="campus-card-actions">${options.recording ? (replay ? `<a class="campus-button campus-button-secondary" href="${e(ctx, replay)}">${ctx.state.mode === 'demo' ? 'Preview recording details' : 'Watch recording'} <span aria-hidden="true">→</span></a>` : '<span class="campus-muted">Recording unavailable</span>') : joinAction(ctx, session, true)}${!options.recording && replay ? `<a href="${e(ctx, replay)}">${ctx.state.mode === 'demo' ? 'Recording preview' : 'View recording'}</a>` : ''}${options.manage && manageSession(ctx, session) ? `<button type="button" class="campus-button campus-button-secondary campus-button-small" data-classroom-action="edit-session" data-id="${e(ctx, session.id)}">Edit session</button>` : ''}</div></article>`;
}

function classroomCard(ctx, cohort) {
  const sessions = arrays(ctx.state, 'class_sessions').filter(session => session.cohort_id === cohort.id && session.status !== 'cancelled' && millis(session.ends_at) >= Date.now()).sort(byStart);
  const instructor = person(ctx, cohort.instructor_id);
  return `<article class="campus-panel campus-classroom-card"><div class="campus-section-head"><p class="campus-eyebrow">${manageCohort(ctx, cohort) ? 'Your classroom' : 'Your cohort'}</p><span class="campus-label">${cohort.status === 'archived' ? 'Archived' : 'Active'}</span></div><h3><a href="${e(ctx, cohortLink(ctx, cohort.id))}">${e(ctx, cohort.title)}</a></h3><p>${e(ctx, cohort.description)}</p><p class="campus-muted">Instructor · ${e(ctx, instructor)}</p><div class="campus-classroom-next"><span class="campus-eyebrow">Next session</span>${sessions[0] ? `<strong>${e(ctx, sessions[0].title)}</strong><span>${date(ctx, sessions[0].starts_at)}</span>` : '<span>No upcoming sessions scheduled.</span>'}</div><a class="campus-button campus-button-secondary" href="${e(ctx, cohortLink(ctx, cohort.id))}">Open classroom <span aria-hidden="true">→</span></a></article>`;
}

function directory(ctx) {
  const cohorts = arrays(ctx.state, 'cohorts').filter(cohort => canViewClassroom(ctx, cohort) && cohort.status === 'active');
  const sessions = arrays(ctx.state, 'class_sessions').filter(session => canViewClassSession(ctx, session));
  const classSessions = sessions.filter(session => session.audience === 'cohort' && session.status !== 'cancelled');
  const upcoming = classSessions.filter(session => millis(session.ends_at) >= Date.now()).sort(byStart);
  const happening = sessions.filter(session => session.is_live && session.status !== 'cancelled').sort(byStart);
  const next = upcoming[0];
  const recordings = sessions.filter(session => session.replay_published && classSessionHref(ctx, session, true)).sort((a, b) => -byStart(a, b)).slice(0, 4);
  const campus = sessions.filter(session => session.audience === 'campus' && session.status !== 'cancelled' && (session.is_live || millis(session.ends_at) >= Date.now())).sort(byStart);
  return `${notice(ctx)}<div class="campus-section-head"><p class="campus-muted">Your classrooms, scheduled sessions, and recordings.</p>${staff(ctx) ? `<a class="campus-button campus-button-secondary" href="${e(ctx, liveLink(ctx, { manage: '1' }))}">Manage classrooms</a>` : ''}</div>
    ${next ? `<section class="campus-panel campus-classroom-hero"><div><p class="campus-eyebrow">Your next class</p><h2>${e(ctx, next.title)}</h2><p>${e(ctx, find(ctx.state, 'cohorts', next.cohort_id)?.title || 'Your classroom')} · ${date(ctx, next.starts_at)}</p><p class="campus-muted">With ${e(ctx, person(ctx, next.instructor_id))}</p></div><div class="campus-card-actions">${joinAction(ctx, next)}<a href="${e(ctx, cohortLink(ctx, next.cohort_id))}">View classroom schedule</a></div></section>` : ''}
    <section class="campus-classroom-section campus-classroom-happening"><div class="campus-section-head"><h2>Happening now</h2><span class="campus-muted">${ctx.state.mode === 'demo' ? 'Rehearsal overview' : 'Join your active sessions'}</span></div>${happening.length ? `<div class="campus-grid campus-session-grid">${happening.map(session => sessionCard(ctx, session)).join('')}</div>` : empty(ctx, 'No sessions are live right now', upcoming.length ? 'Your next scheduled class is listed above. You can open its agenda before joining.' : 'Your scheduled sessions will appear here when an instructor starts them.')}</section>
    <section class="campus-classroom-section"><div class="campus-section-head"><h2>${staff(ctx) ? 'My classrooms' : 'My cohorts'}</h2><span class="campus-muted">${cohorts.length} ${cohorts.length === 1 ? 'classroom' : 'classrooms'}</span></div>${cohorts.length ? `<div class="campus-grid campus-classroom-grid">${cohorts.map(cohort => classroomCard(ctx, cohort)).join('')}</div>` : empty(ctx, role(ctx) === 'leadership' ? 'Classroom access follows enrollment' : 'Your classroom will appear here', role(ctx) === 'leadership' ? 'University leadership access does not expose private cohort classrooms or rosters. Campus live events are listed below.' : staff(ctx) ? 'Create a classroom, add campus members to its roster, and schedule your first session.' : 'Your instructor adds you to a cohort. Joining an open learning pathway does not automatically enroll you in a classroom.')}</section>
    ${upcoming.length > 1 ? `<section class="campus-classroom-section"><div class="campus-section-head"><h2>Coming up in class</h2><p class="campus-muted">Times use your device’s local time zone.</p></div><div class="campus-grid campus-session-grid">${upcoming.slice(1, 5).map(session => sessionCard(ctx, session)).join('')}</div></section>` : ''}
    <section class="campus-classroom-section"><div class="campus-section-head"><div><p class="campus-eyebrow">Open to campus members</p><h2>Campus live events</h2></div><a href="${e(ctx, ctx.href('events'))}">All campus events <span aria-hidden="true">→</span></a></div>${campus.length ? `<div class="campus-grid campus-session-grid">${campus.map(session => sessionCard(ctx, session)).join('')}</div>` : empty(ctx, 'No upcoming campus live sessions', 'Campus gatherings and university-wide sessions appear separately from your cohort classes.')}</section>
    <section class="campus-classroom-section"><div class="campus-section-head"><h2>Recent recordings</h2><span class="campus-muted">Published for your current access</span></div>${recordings.length ? `<div class="campus-grid campus-session-grid">${recordings.map(session => sessionCard(ctx, session, { recording: true })).join('')}</div>` : empty(ctx, 'No published recordings yet', 'When your instructor publishes a session recording, you can return to it here.')}</section>`;
}

function roster(ctx, cohort) {
  if (!manageCohort(ctx, cohort)) return '';
  const memberships = arrays(ctx.state, 'cohort_members').filter(item => item.cohort_id === cohort.id).sort((a, b) => Number(b.active) - Number(a.active) || person(ctx, a.user_id).localeCompare(person(ctx, b.user_id)));
  const eligible = arrays(ctx.state, 'members').filter(item => ['student', 'staff'].includes(item.role) && !memberships.some(enrollment => enrollment.user_id === item.user_id && enrollment.active));
  return `<section class="campus-panel campus-roster"><div class="campus-section-head"><h2>Classroom roster</h2><span class="campus-label">${memberships.filter(item => item.active).length} active</span></div><p class="campus-muted">Only this classroom’s instructor and campus administrators can manage enrollment.</p>${memberships.length ? `<div class="campus-list">${memberships.map(item => `<div class="campus-row"><div><strong>${e(ctx, person(ctx, item.user_id))}</strong><span class="campus-muted">${item.active ? 'Active member' : 'Access removed'}</span></div><form data-classroom-form="roster" data-cohort-id="${e(ctx, cohort.id)}" data-member-id="${e(ctx, item.user_id)}">${hidden(ctx, 'cohort_id', cohort.id)}${hidden(ctx, 'user_id', item.user_id)}${hidden(ctx, 'active', item.active ? 'false' : 'true')}<button type="submit" class="campus-button campus-button-secondary campus-button-small">${item.active ? 'Remove access' : 'Restore access'}</button><p class="campus-form-status" role="status"></p></form></div>`).join('')}</div>` : empty(ctx, 'No one is enrolled yet', 'Add an existing campus member to give them access to this classroom and its scheduled sessions.')}${eligible.length ? `<form data-classroom-form="roster" data-cohort-id="${e(ctx, cohort.id)}" data-member-id="new">${hidden(ctx, 'cohort_id', cohort.id)}${hidden(ctx, 'active', 'true')}${select(ctx, 'user_id', 'Add a campus member', [['', 'Choose a campus member'], ...eligible.map(item => [item.user_id, `${item.display_name} · ${item.role === 'staff' ? 'Staff' : 'Student'}`])], '', 'required')}${formActions('Add to classroom')}</form>` : '<p class="campus-muted">All eligible members in your campus directory are already enrolled.</p>'}</section>`;
}

function cohortDetail(ctx, id) {
  const cohort = find(ctx.state, 'cohorts', id);
  if (!canViewClassroom(ctx, cohort)) return denied(ctx, 'This classroom is not available', 'Your account needs an active enrollment in this classroom. Ask your instructor or the campus support team to check your access.');
  const sessions = arrays(ctx.state, 'class_sessions').filter(session => session.cohort_id === cohort.id && canViewClassSession(ctx, session)).sort(byStart);
  const upcoming = sessions.filter(session => millis(session.ends_at) >= Date.now() || session.is_live);
  const past = sessions.filter(session => millis(session.ends_at) < Date.now() && !session.is_live).sort((a, b) => -byStart(a, b));
  const course = find(ctx.state, 'courses', cohort.course_id);
  const canManage = manageCohort(ctx, cohort);
  return `${notice(ctx)}<p><a href="${e(ctx, liveLink(ctx))}">← All classrooms & live sessions</a></p><section class="campus-panel campus-classroom-hero"><div><p class="campus-eyebrow">${cohort.status === 'archived' ? 'Archived classroom' : 'Cohort classroom'}</p><h2>${e(ctx, cohort.title)}</h2>${paragraphs(ctx, cohort.description)}<p class="campus-muted">Instructor · ${e(ctx, person(ctx, cohort.instructor_id))}</p></div>${canManage ? `<a class="campus-button campus-button-secondary" href="${e(ctx, liveLink(ctx, { manage: '1', cohort: cohort.id }))}">Manage this classroom</a>` : ''}</section><div class="campus-grid campus-classroom-layout"><div class="campus-stack"><section><div class="campus-section-head"><h2>Class schedule</h2><span class="campus-muted">Times shown in your local time zone</span></div>${upcoming.length ? `<div class="campus-stack">${upcoming.map(session => sessionCard(ctx, session)).join('')}</div>` : empty(ctx, 'Your next session is being planned', 'Your instructor will publish the date and agenda here.')}</section>${past.length ? `<section><div class="campus-section-head"><h2>Past sessions & recordings</h2></div><div class="campus-stack">${past.map(session => sessionCard(ctx, session, { recording: session.replay_published })).join('')}</div></section>` : ''}${canManage ? roster(ctx, cohort) : ''}</div><aside class="campus-stack campus-classroom-sidebar"><section class="campus-panel"><p class="campus-eyebrow">Your coursework</p><h2>Assignments & grades</h2><p>Open your course workspace for lessons, submissions, and instructor feedback.</p><a class="campus-button campus-button-secondary" href="${e(ctx, ctx.href('courses', { cohort: cohort.id }))}">Open course workspace</a></section><section class="campus-panel"><p class="campus-eyebrow">Between classes</p><h2>Learning pathway</h2>${course && (course.status === 'published' || canManage) ? `<h3>${e(ctx, course.title)}</h3><p>${e(ctx, course.description)}</p><a class="campus-button campus-button-secondary" href="${e(ctx, ctx.href('learn'))}#course-${e(ctx, course.id)}">Open learning activities</a>` : '<p>Your instructor can connect a learning pathway with readings, activities, and project feedback.</p>'}<p class="campus-muted">Classroom enrollment and learning-pathway enrollment are separate.</p></section><section class="campus-panel"><h2>Your instructor</h2><p>${e(ctx, person(ctx, cohort.instructor_id))}</p>${member(ctx) ? `<a href="${e(ctx, ctx.href('people', { person: cohort.instructor_id }))}">Send a message <span aria-hidden="true">→</span></a>` : ''}</section></aside></div>`;
}

function denied(ctx, title, detail) { return `${empty(ctx, title, detail)}<div class="campus-card-actions"><a class="campus-button campus-button-secondary" href="${e(ctx, liveLink(ctx))}">Back to classrooms</a><a href="${e(ctx, ctx.href('support'))}">Get help</a></div>`; }

function rehearsal(ctx, id) {
  const session = find(ctx.state, 'class_sessions', id);
  if (!canViewClassSession(ctx, session)) return denied(ctx, 'This session is not available', 'Your account does not have access to this scheduled session. A classroom link does not grant enrollment.');
  if (query('replay') === '1' && !classSessionHref(ctx, session, true)) return denied(ctx, 'Recording unavailable', 'This session has no published recording available to your current access. Your instructor controls when a recording is shared.');
  const cohort = find(ctx.state, 'cohorts', session.cohort_id);
  const ownAttendance = arrays(ctx.state, 'session_attendance').find(item => item.session_id === id && item.user_id === uid(ctx));
  const joined = memory(ctx).rehearsalJoins.has(id);
  const isDemo = ctx.state.mode === 'demo';
  const allowed = member(ctx) && session.status !== 'cancelled' && cohort?.status !== 'archived';
  const attendance = manageSession(ctx, session) ? arrays(ctx.state, 'session_attendance').filter(item => item.session_id === id) : ownAttendance ? [ownAttendance] : [];
  return `<p><a href="${e(ctx, cohort ? cohortLink(ctx, cohort.id) : liveLink(ctx))}">← ${cohort ? 'Back to classroom' : 'All live sessions'}</a></p><section class="campus-panel campus-rehearsal-stage"><p class="campus-eyebrow">${isDemo ? 'Classroom rehearsal · sample session' : 'Scheduled classroom'}</p><h2>${e(ctx, session.title)}</h2><p>${date(ctx, session.starts_at)} · ${e(ctx, person(ctx, session.instructor_id))}</p>${isDemo ? '<p class="campus-rehearsal-status">This is a rehearsal of the classroom workflow. No camera, microphone, live audio, or video meeting is running here.</p>' : ''}${query('replay') === '1' && isDemo ? '<p class="campus-member-notice">This preview shows where a published recording belongs. It does not play a sample video or claim a class was recorded.</p>' : ''}${session.status === 'cancelled' ? '<p class="campus-member-notice">This scheduled session is cancelled.</p>' : cohort?.status === 'archived' ? '<p class="campus-member-notice">This classroom is archived. New joins are unavailable.</p>' : isDemo && allowed ? `<div class="campus-card-actions"><button class="campus-button" type="button" data-classroom-action="${joined ? 'leave-rehearsal' : 'join-rehearsal'}" data-session-id="${e(ctx, session.id)}">${joined ? 'Leave rehearsal' : 'Record a practice join'}</button>${joined ? '<span class="campus-label">Practice join recorded in this tab</span>' : ''}</div>` : joinAction(ctx, session)}${ownAttendance && isDemo ? `<p class="campus-muted">Sample attendance: ${Number(ownAttendance.joins) || 1} practice ${Number(ownAttendance.joins) === 1 ? 'join' : 'joins'}. Last practice join ${date(ctx, ownAttendance.last_joined_at)}.</p>` : ''}</section><div class="campus-grid campus-classroom-layout"><section class="campus-panel"><h2>Session agenda</h2>${session.description ? paragraphs(ctx, session.description) : '<p>Your instructor has not added an agenda yet.</p>'}<p class="campus-muted">Session resources, conversation, and classroom tools belong to this scheduled room when the live classroom opens.</p></section><section class="campus-panel"><h2>${isDemo ? 'Rehearsal attendance' : 'Your session attendance'}</h2>${attendance.length ? `<div class="campus-list">${attendance.map(item => `<div class="campus-row"><div><strong>${e(ctx, person(ctx, item.user_id))}</strong><span class="campus-muted">${isDemo ? 'Practice join' : 'Joined'} · ${date(ctx, item.first_joined_at)}</span></div></div>`).join('')}</div>` : empty(ctx, isDemo ? 'No practice joins recorded' : 'No attendance recorded', isDemo ? 'The practice join records sample attendance only.' : 'Attendance is recorded when you actually join this session.')}</section></div>`;
}

function cohortEditor(ctx, cohort) {
  const instructors = arrays(ctx.state, 'members').filter(item => ['staff', 'admin'].includes(item.role));
  const hasSessions = cohort && arrays(ctx.state, 'class_sessions').some(session => session.cohort_id === cohort.id);
  const courses = arrays(ctx.state, 'courses');
  const lockedInstructor = !admin(ctx) || hasSessions;
  const assigned = cohort?.instructor_id || uid(ctx);
  return `<section class="campus-panel campus-classroom-editor"><div class="campus-section-head"><h2>${cohort ? 'Edit classroom' : 'Create a classroom'}</h2></div><form data-classroom-form="cohort" data-id="${e(ctx, cohort?.id || 'new')}">${cohort ? hidden(ctx, 'id', cohort.id) : ''}${field(ctx, 'title', 'Classroom name', cohort?.title, 'text', 'required maxlength="160" placeholder="For example, AI Literacy · Fall Cohort"')}${textarea(ctx, 'description', 'What this cohort will work on', cohort?.description, 'maxlength="10000"')}${select(ctx, 'course_id', 'Connected learning pathway (optional)', [['', 'No pathway connected'], ...courses.map(item => [item.id, `${item.title}${item.status === 'draft' ? ' · Draft' : ''}`])], cohort?.course_id)}${lockedInstructor ? `${hidden(ctx, 'instructor_id', assigned)}<p class="campus-muted campus-classroom-form-hint">Instructor: ${e(ctx, person(ctx, assigned))}${hasSessions ? '. The assigned instructor is fixed once sessions are scheduled.' : '.'}</p>` : select(ctx, 'instructor_id', 'Assigned instructor', instructors.map(item => [item.user_id, item.display_name]), assigned, 'required')}${select(ctx, 'status', 'Classroom status', [['active', 'Active'], ['archived', 'Archived']], cohort?.status || 'active', 'aria-describedby="classroom-cohort-status-hint"')}<p class="campus-muted campus-classroom-form-hint" id="classroom-cohort-status-hint">Archiving removes access to scheduled cohort classrooms until the classroom is active again.</p>${formActions('Save classroom', !!cohort)}</form></section>`;
}

function sessionEditor(ctx, session, defaultCohort, audienceOverride) {
  const owned = arrays(ctx.state, 'cohorts').filter(cohort => manageCohort(ctx, cohort) && cohort.status === 'active');
  const eligibleEvents = arrays(ctx.state, 'events');
  const initialAudience = session?.audience || audienceOverride || (defaultCohort || owned.length ? 'cohort' : 'campus');
  const inherited = session?.cohort_id || defaultCohort || owned[0]?.id || '';
  const instructor = session?.instructor_id || find(ctx.state, 'cohorts', inherited)?.instructor_id || uid(ctx);
  const locked = !!session;
  return `<section class="campus-panel campus-classroom-editor"><div class="campus-section-head"><h2>${session ? 'Edit scheduled session' : 'Schedule a session'}</h2></div><form data-classroom-form="session" data-id="${e(ctx, session?.id || 'new')}" data-classroom-scope="${e(ctx, session?.id || `${initialAudience}:${initialAudience === 'cohort' ? inherited : 'campus'}`)}">${session ? hidden(ctx, 'id', session.id) : ''}${field(ctx, 'title', 'Session title', session?.title, 'text', 'required maxlength="120"')}${textarea(ctx, 'description', 'Agenda and preparation', session?.description, 'maxlength="10000" placeholder="What should participants prepare, and what will you cover?"')}${locked ? `${hidden(ctx, 'audience', session.audience)}${hidden(ctx, 'cohort_id', session.cohort_id || '')}${hidden(ctx, 'event_id', session.event_id || '')}${hidden(ctx, 'instructor_id', session.instructor_id)}<p class="campus-member-notice">${e(ctx, session.audience === 'cohort' ? find(ctx.state, 'cohorts', session.cohort_id)?.title || 'Cohort classroom' : 'Campus live event')} · ${e(ctx, person(ctx, session.instructor_id))}. Audience, classroom, and instructor stay attached to this session.</p>` : `${select(ctx, 'audience', 'Session audience', [['cohort', 'An enrolled cohort'], ['campus', 'Campus members']], initialAudience, 'data-classroom-audience')}<div data-session-cohort-fields${initialAudience === 'cohort' ? '' : ' hidden'}>${select(ctx, 'cohort_id', 'Classroom', [['', 'Choose a classroom'], ...owned.map(item => [item.id, item.title])], inherited, 'data-classroom-cohort aria-describedby="classroom-instructor-hint"')}<p class="campus-muted campus-classroom-form-hint" id="classroom-instructor-hint" data-classroom-inherited>Instructor: ${e(ctx, person(ctx, instructor))}. Inherited from the classroom.</p>${!owned.length ? '<p class="campus-muted campus-classroom-form-hint">Create an active classroom before scheduling a cohort session.</p>' : ''}</div><div data-session-campus-fields${initialAudience === 'campus' ? '' : ' hidden'}>${select(ctx, 'event_id', 'Associated campus event (optional)', [['', 'No associated event'], ...eligibleEvents.map(item => [item.id, item.title])], '')}${admin(ctx) ? select(ctx, 'instructor_id', 'Session host', arrays(ctx.state, 'members').filter(item => ['staff', 'admin'].includes(item.role)).map(item => [item.user_id, item.display_name]), uid(ctx), 'required') : `${hidden(ctx, 'instructor_id', uid(ctx))}<p class="campus-muted campus-classroom-form-hint">You will host this campus session.</p>`}</div>`}<div class="campus-grid campus-session-times">${field(ctx, 'starts_at', 'Starts at', localDateTime(session?.starts_at), 'datetime-local', 'required aria-describedby="classroom-session-time-hint"')}${field(ctx, 'ends_at', 'Ends at', localDateTime(session?.ends_at), 'datetime-local', 'required aria-describedby="classroom-session-time-hint"')}</div><p class="campus-muted campus-classroom-form-hint" id="classroom-session-time-hint">Enter times in your current local time zone. Each session receives its own protected classroom.</p>${select(ctx, 'status', 'Session status', [['scheduled', 'Scheduled'], ['cancelled', 'Cancelled']], session?.status || 'scheduled')}${session?.is_live ? '<p class="campus-member-notice">End the live classroom before cancelling its scheduled session.</p>' : ''}${formActions('Save session', !!session)}</form></section>`;
}

function management(ctx) {
  if (!staff(ctx)) return denied(ctx, 'Instructor access required', 'Only assigned instructors and campus administrators can manage classrooms.');
  const ui = memory(ctx);
  const owned = arrays(ctx.state, 'cohorts').filter(cohort => manageCohort(ctx, cohort));
  const requested = query('cohort');
  const chosenId = ui.cohort === null ? requested : ui.cohort;
  const cohort = owned.find(item => item.id === chosenId) || null;
  const session = arrays(ctx.state, 'class_sessions').find(item => item.id === ui.session && manageSession(ctx, item));
  const sessions = arrays(ctx.state, 'class_sessions').filter(item => manageSession(ctx, item) && (!cohort || item.cohort_id === cohort.id)).sort(byStart);
  const tabs = [['cohorts', 'Classrooms'], ['roster', 'Enrollment'], ['sessions', 'Sessions']];
  return `${notice(ctx)}<div class="campus-section-head"><a href="${e(ctx, liveLink(ctx))}">← Back to classrooms</a><p class="campus-muted">${admin(ctx) ? 'Manage campus classrooms and assigned instructors.' : 'Manage the classrooms and sessions you teach.'}</p></div><div class="campus-classroom-tabs" role="tablist" aria-label="Classroom management">${tabs.map(([key, label]) => `<button type="button" class="campus-button campus-button-secondary" role="tab" aria-selected="${ui.tab === key}" tabindex="${ui.tab === key ? '0' : '-1'}" aria-controls="classroom-management-panel" data-classroom-action="manage-tab" data-tab="${key}">${label}</button>`).join('')}</div><div class="campus-grid campus-classroom-layout" id="classroom-management-panel" role="tabpanel" aria-label="Classroom management workspace"><aside class="campus-panel campus-classroom-sidebar"><div class="campus-section-head"><h2>Your classrooms</h2><button type="button" class="campus-button campus-button-secondary campus-button-small" data-classroom-action="new-cohort">New</button></div>${owned.length ? `<div class="campus-list">${owned.map(item => `<button type="button" class="campus-classroom-choice" data-classroom-action="select-cohort" data-id="${e(ctx, item.id)}" aria-pressed="${cohort?.id === item.id}"><strong>${e(ctx, item.title)}</strong><span class="campus-muted">${item.status === 'archived' ? 'Archived' : 'Active'} · ${e(ctx, person(ctx, item.instructor_id))}</span></button>`).join('')}</div>` : '<p class="campus-muted">Start by creating your first classroom.</p>'}<button type="button" class="campus-button campus-button-secondary" data-classroom-action="campus-sessions">Campus event sessions</button></aside><div class="campus-stack">${ui.tab === 'cohorts' ? cohortEditor(ctx, cohort) : ui.tab === 'roster' ? cohort ? roster(ctx, cohort) : empty(ctx, 'Choose a classroom', 'Select one of your classrooms to add members or manage their access.') : `${sessionEditor(ctx, session, cohort?.id, ui.audience)}<section><div class="campus-section-head"><h2>${cohort ? 'Classroom sessions' : 'Your scheduled sessions'}</h2>${session ? '<button class="campus-button campus-button-secondary campus-button-small" type="button" data-classroom-action="new-session">New session</button>' : ''}</div>${sessions.length ? `<div class="campus-stack">${sessions.map(item => sessionCard(ctx, item, { manage: true })).join('')}</div>` : empty(ctx, 'No sessions scheduled', 'Set a time and agenda above. Each session will have its own room.')}</section>`}</div></div>`;
}

function content(ctx) {
  if (ctx.state.mode === 'unavailable') return denied(ctx, 'Classrooms are unavailable', ctx.state.error || 'Check your connection and try again.');
  if (query('manage') === '1') return management(ctx);
  if (query('session')) return rehearsal(ctx, query('session'));
  if (query('cohort')) return cohortDetail(ctx, query('cohort'));
  return directory(ctx);
}

export function renderClassrooms(view, ctx) {
  let directoryView = true;
  try { const params = new URL(globalThis.location.href).searchParams; directoryView = !['manage', 'session', 'cohort'].some(key => params.has(key)); } catch { /* A normal directory can render before browser routing is available. */ }
  return view === 'live' ? `<div data-campus-classrooms${directoryView ? ' data-classroom-directory' : ''}>${content(ctx)}</div>` : '';
}

const value = (form, name) => String(form.elements.namedItem(name)?.value || '').trim();
function required(form, name, label) { const text = value(form, name); if (!text) throw new Error(`Enter ${label.toLowerCase()}.`); return text; }

function commandFor(form, ctx) {
  const kind = form.dataset.classroomForm;
  const id = value(form, 'id');
  if (kind === 'cohort') {
    const existing = id ? find(ctx.state, 'cohorts', id) : null;
    if (id && !manageCohort(ctx, existing)) throw new Error('You can only edit a classroom you teach.');
    const instructor_id = value(form, 'instructor_id') || existing?.instructor_id || uid(ctx);
    if (!admin(ctx) && instructor_id !== uid(ctx)) throw new Error('Only a campus administrator can assign another instructor.');
    if (!arrays(ctx.state, 'members').some(item => item.user_id === instructor_id && ['staff', 'admin'].includes(item.role))) throw new Error('Choose an active campus instructor.');
    const course_id = value(form, 'course_id') || null;
    if (course_id && !find(ctx.state, 'courses', course_id)) throw new Error('Choose an available learning pathway.');
    return ['saveCohort', { ...(id ? { id } : {}), title: required(form, 'title', 'Classroom name'), description: value(form, 'description'), course_id, instructor_id, status: value(form, 'status') }, 'Classroom saved. Add members and schedule its sessions.'];
  }
  if (kind === 'roster') {
    const cohort_id = value(form, 'cohort_id'), user_id = value(form, 'user_id');
    if (!manageCohort(ctx, find(ctx.state, 'cohorts', cohort_id))) throw new Error('Only the assigned instructor or an administrator can change this roster.');
    if (!arrays(ctx.state, 'members').some(item => item.user_id === user_id && ['student', 'staff'].includes(item.role))) throw new Error('Choose an active student or staff member.');
    const active = value(form, 'active') === 'true';
    return ['setCohortMember', { cohort_id, user_id, active }, active ? 'Classroom access is active for this member.' : 'Classroom access removed for this member.'];
  }
  if (kind === 'session') {
    const existing = id ? find(ctx.state, 'class_sessions', id) : null;
    if (id && !manageSession(ctx, existing)) throw new Error('You can only edit sessions assigned to you.');
    const audience = existing?.audience || value(form, 'audience');
    if (!['cohort', 'campus'].includes(audience)) throw new Error('Choose the session audience.');
    const cohort_id = audience === 'cohort' ? existing?.cohort_id || value(form, 'cohort_id') : null;
    const cohort = cohort_id ? find(ctx.state, 'cohorts', cohort_id) : null;
    if (audience === 'cohort' && (!manageCohort(ctx, cohort) || cohort.status !== 'active')) throw new Error('Choose an active classroom you teach.');
    const instructor_id = existing?.instructor_id || cohort?.instructor_id || value(form, 'instructor_id') || uid(ctx);
    if (!admin(ctx) && instructor_id !== uid(ctx)) throw new Error('Only an administrator can assign another session host.');
    const event_id = existing ? existing.event_id || null : audience === 'campus' ? value(form, 'event_id') || null : null;
    if (event_id && !find(ctx.state, 'events', event_id)) throw new Error('Choose an available campus event.');
    const starts = new Date(value(form, 'starts_at')), ends = new Date(value(form, 'ends_at'));
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime())) throw new Error('Enter a valid session start and end time.');
    if (ends <= starts) throw new Error('The session must end after it starts.');
    const status = value(form, 'status');
    if (existing?.is_live && status === 'cancelled') throw new Error('End the live classroom before cancelling its session.');
    const title = required(form, 'title', 'Session title');
    if (title.length > 120) throw new Error('Keep the session title to 120 characters or fewer.');
    return ['saveClassSession', { ...(id ? { id } : {}), cohort_id, event_id, title, description: value(form, 'description'), starts_at: starts.toISOString(), ends_at: ends.toISOString(), status, audience, instructor_id }, 'Scheduled session saved. Its protected classroom is ready.'];
  }
  throw new Error('This classroom action is unavailable.');
}

export function bindClassrooms(view, root, ctx) {
  if (view !== 'live') return () => {};
  const mount = root.matches?.('[data-campus-classrooms]') ? root : root.querySelector('[data-campus-classrooms]');
  if (!mount) return () => {};
  const ui = memory(ctx);
  let pending = false;
  const syncSessionForm = () => {
    for (const form of mount.querySelectorAll('form[data-classroom-form="session"]')) {
      const audience = value(form, 'audience');
      const cohortFields = form.querySelector('[data-session-cohort-fields]');
      const campusFields = form.querySelector('[data-session-campus-fields]');
      if (cohortFields) { cohortFields.hidden = audience !== 'cohort'; cohortFields.querySelectorAll('select,input').forEach(input => { input.disabled = audience !== 'cohort'; }); const choose = cohortFields.querySelector('select'); if (choose) choose.required = audience === 'cohort'; }
      if (campusFields) { campusFields.hidden = audience !== 'campus'; campusFields.querySelectorAll('select,input').forEach(input => { input.disabled = audience !== 'campus'; }); }
      const inherited = form.querySelector('[data-classroom-inherited]');
      if (inherited) { const cohort = find(ctx.state, 'cohorts', value(form, 'cohort_id')); inherited.textContent = cohort ? `Instructor: ${person(ctx, cohort.instructor_id)}. Inherited from the classroom.` : 'Choose a classroom to use its assigned instructor.'; }
    }
  };
  const paint = () => { mount.innerHTML = content(ctx); ctx.restoreDrafts?.(); syncSessionForm(); };
  const click = async event => {
    const button = event.target.closest?.('[data-classroom-action]');
    if (!button || !mount.contains(button) || button.disabled || pending) return;
    const action = button.dataset.classroomAction;
    if (['join-rehearsal', 'leave-rehearsal'].includes(action)) {
      const session = find(ctx.state, 'class_sessions', button.dataset.sessionId);
      if (ctx.state.mode !== 'demo' || !member(ctx) || !canViewClassSession(ctx, session) || session.status === 'cancelled') { ctx.notify('This rehearsal is not available to your account.', 'error'); return; }
      const joined = action === 'join-rehearsal';
      const before = ui.rehearsalJoins.has(session.id);
      if (joined) ui.rehearsalJoins.add(session.id); else ui.rehearsalJoins.delete(session.id);
      pending = true; button.disabled = true;
      try {
        const success = await ctx.run(joined ? 'demoJoinSession' : 'demoLeaveSession', { session_id: session.id }, joined ? 'Practice join recorded. No live meeting was started.' : 'You left the rehearsal. No live meeting was running.');
        if (!success) { if (before) ui.rehearsalJoins.add(session.id); else ui.rehearsalJoins.delete(session.id); }
      } catch (error) { if (before) ui.rehearsalJoins.add(session.id); else ui.rehearsalJoins.delete(session.id); ctx.notify(error.message || 'The rehearsal could not be updated.', 'error'); }
      finally { pending = false; if (button.isConnected) button.disabled = false; }
      return;
    }
    if (!staff(ctx) || query('manage') !== '1') return;
    if (action === 'manage-tab' && ['cohorts', 'roster', 'sessions'].includes(button.dataset.tab)) ui.tab = button.dataset.tab;
    else if (action === 'select-cohort' && manageCohort(ctx, find(ctx.state, 'cohorts', button.dataset.id))) { ui.cohort = button.dataset.id; ui.session = null; ui.audience = null; }
    else if (action === 'new-cohort') { ui.cohort = ''; ui.session = null; ui.audience = null; ui.tab = 'cohorts'; }
    else if (action === 'campus-sessions') { ui.cohort = ''; ui.session = null; ui.audience = 'campus'; ui.tab = 'sessions'; }
    else if (action === 'new-session') { ui.session = null; ui.tab = 'sessions'; }
    else if (action === 'edit-session' && manageSession(ctx, find(ctx.state, 'class_sessions', button.dataset.id))) { ui.session = button.dataset.id; ui.tab = 'sessions'; }
    else if (action === 'cancel-editor') { const form = button.closest('form'); ctx.discardDraft?.(form); if (form?.dataset.classroomForm === 'cohort') ui.cohort = ''; else ui.session = null; }
    else return;
    paint();
    if (action === 'manage-tab') mount.querySelector(`[data-tab="${ui.tab}"]`)?.focus();
    else mount.querySelector('form input:not([type="hidden"]),form select,form textarea')?.focus();
  };
  const submit = async event => {
    const form = event.target.closest?.('form[data-classroom-form]');
    if (!form || !mount.contains(form)) return;
    event.preventDefault();
    if (pending || !staff(ctx)) return;
    if (!form.reportValidity()) return;
    let task;
    try { task = commandFor(form, ctx); } catch (error) { ctx.notify(error.message, 'error'); return; }
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    const status = form.querySelector('.campus-form-status');
    pending = true; form.setAttribute('aria-busy', 'true'); buttons.forEach(button => { button.disabled = true; });
    try {
      if (status) status.textContent = 'Saving…';
      const success = await ctx.run(...task, form);
      if (form.isConnected && status) status.textContent = success ? task[2] : 'Your changes were not saved. Review the message and try again.';
    } catch (error) { if (status) status.textContent = error.message || 'Your changes were not saved.'; ctx.notify(error.message || 'Your changes were not saved.', 'error'); }
    finally { pending = false; if (form.isConnected) { form.removeAttribute('aria-busy'); buttons.forEach(button => { button.disabled = false; }); } }
  };
  const change = event => { if (event.target.matches('[data-classroom-audience],[data-classroom-cohort]')) syncSessionForm(); };
  const keydown = event => {
    const tab = event.target.closest?.('[role="tab"][data-classroom-action="manage-tab"]');
    if (!tab || !mount.contains(tab) || pending || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['cohorts', 'roster', 'sessions'];
    const index = tabs.indexOf(ui.tab);
    ui.tab = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    paint(); mount.querySelector(`[data-tab="${ui.tab}"]`)?.focus();
  };
  mount.addEventListener('click', click); mount.addEventListener('submit', submit); mount.addEventListener('change', change); mount.addEventListener('keydown', keydown);
  queueMicrotask(syncSessionForm);
  return () => { mount.removeEventListener('click', click); mount.removeEventListener('submit', submit); mount.removeEventListener('change', change); mount.removeEventListener('keydown', keydown); };
}
