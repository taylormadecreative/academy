/* Native, section-scoped coursework. The store rechecks every academic permission. */
const rows = (state, name) => Array.isArray(state?.[name]) ? state[name] : [];
const uid = ctx => ctx.state.user?.id || ctx.state.member?.user_id || '';
const member = ctx => !!ctx.state.user && !!ctx.state.member && ctx.state.member.active !== false && ['live', 'demo'].includes(ctx.state.mode);
const esc = (ctx, value) => ctx.esc(String(value ?? ''));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const points = value => number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const stamp = value => value ? new Date(value).getTime() : NaN;
const find = (state, name, id) => rows(state, name).find(item => item.id === id);
const sectionRoster = (ctx, cohort) => rows(ctx.state, 'cohort_members').filter(item => item.cohort_id === cohort.id);
const activeLearner = (ctx, cohort, id) => sectionRoster(ctx, cohort).some(item => item.user_id === id && item.active) && rows(ctx.state, 'members').some(item => item.user_id === id && item.active !== false && item.role !== 'leadership');
const name = (ctx, id) => rows(ctx.state, 'members').find(item => item.user_id === id && item.active !== false)?.display_name || (id === uid(ctx) ? ctx.state.member?.display_name : '') || 'Campus member';
const sortRevision = (a, b) => number(b.revision) - number(a.revision) || (stamp(b.created_at) || 0) - (stamp(a.created_at) || 0);
const sortAttempt = (a, b) => number(b.attempt_no) - number(a.attempt_no) || (stamp(b.submitted_at) || 0) - (stamp(a.submitted_at) || 0);
const tabs = ['overview', 'modules', 'assignments', 'grades', 'people'];

export function parseAcademicLocation(value = globalThis.location?.href || 'https://ht.invalid/ht/hub/courses/') {
  const empty = { cohort: '', tab: 'overview', assignment: '', student: '', isNew: false };
  try {
    const url = new URL(value, 'https://ht.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return empty;
    const id = key => /^[A-Za-z0-9_-]{1,100}$/.test(url.searchParams.get(key) || '') ? url.searchParams.get(key) : '';
    return { cohort: id('cohort'), tab: tabs.includes(url.searchParams.get('tab')) ? url.searchParams.get('tab') : 'overview', assignment: id('assignment'), student: id('student'), isNew: url.searchParams.get('new') === '1' };
  } catch { return empty; }
}

export function canManageAcademicSection(ctx, cohort) {
  return !!cohort && member(ctx) && (ctx.state.member.role === 'admin' || ctx.state.member.role === 'staff' && cohort.instructor_id === uid(ctx));
}

export function canViewAcademicSection(ctx, cohort) {
  if (!cohort || !member(ctx)) return false;
  if (canManageAcademicSection(ctx, cohort)) return true;
  return cohort.status === 'active' && ctx.state.member.role !== 'leadership' && sectionRoster(ctx, cohort).some(item => item.user_id === uid(ctx) && item.active);
}

function attemptsFor(state, assignmentId, studentId) {
  return rows(state, 'assignment_attempts').filter(item => item.assignment_id === assignmentId && item.user_id === studentId).slice().sort(sortAttempt);
}
function gradesFor(state, assignmentId, studentId, publishedOnly = false) {
  return rows(state, 'assignment_grades').filter(item => item.assignment_id === assignmentId && item.user_id === studentId && (!publishedOnly || item.status === 'published')).slice().sort(sortRevision);
}
function extensionFor(state, assignment, studentId) {
  const extension = rows(state, 'assignment_extensions').find(item => item.assignment_id === assignment.id && item.user_id === studentId);
  return { extension, due_at: extension?.due_at || assignment.due_at || null, closes_at: extension?.closes_at || assignment.closes_at || null };
}

/** Totals use the latest published revision, and only when it grades the latest attempt. */
export function academicGradeSummary(state, cohortId, studentId) {
  const assignments = rows(state, 'assignments').filter(item => item.cohort_id === cohortId && item.status === 'published');
  let earned = 0, possible = 0, pending = 0, excused = 0, graded = 0;
  const items = assignments.map(assignment => {
    const latestAttempt = attemptsFor(state, assignment.id, studentId)[0] || null;
    const publishedGrade = gradesFor(state, assignment.id, studentId, true)[0] || null;
    const matchesAttempt = publishedGrade && (publishedGrade.attempt_id || null) === (latestAttempt?.id || null);
    const validScore = publishedGrade?.disposition === 'graded' && publishedGrade.score !== null && Number.isFinite(Number(publishedGrade.score)) && number(publishedGrade.score) >= 0 && number(publishedGrade.score) <= number(assignment.points_possible) && (!!latestAttempt || number(publishedGrade.score) === 0);
    const currentGrade = matchesAttempt && (publishedGrade.disposition === 'excused' || validScore) ? publishedGrade : null;
    let stateLabel;
    if (currentGrade?.disposition === 'excused') { excused++; stateLabel = 'Excused'; }
    else if (currentGrade) { earned += number(currentGrade.score); possible += number(assignment.points_possible); graded++; stateLabel = `${number(currentGrade.score)} / ${number(assignment.points_possible)}`; }
    else { pending++; stateLabel = latestAttempt ? publishedGrade ? 'Resubmitted · awaiting grade' : 'Submitted · awaiting grade' : 'Not submitted'; }
    return { assignment, latestAttempt, publishedGrade, currentGrade, stateLabel, ...extensionFor(state, assignment, studentId) };
  });
  return { earned, possible, pending, excused, graded, total: assignments.length, currentPercent: possible > 0 ? earned / possible * 100 : null, final: assignments.length > 0 && pending === 0 && possible > 0, items };
}

function href(ctx, cohort, tab = 'overview', extra = {}) { return ctx.href('courses', { cohort: cohort?.id || null, tab: cohort ? tab : null, ...extra }); }
function link(ctx, url, label, classes = '') { return `<a${classes ? ` class="${classes}"` : ''} href="${esc(ctx, url)}" data-academic-nav>${esc(ctx, label)}</a>`; }
function paragraphs(ctx, value) { return String(value || '').split(/\n\s*\n/).filter(Boolean).map(text => `<p class="campus-body-text">${esc(ctx, text)}</p>`).join(''); }
function empty(ctx, title, text) { return `<div class="campus-empty"><h3>${esc(ctx, title)}</h3><p>${esc(ctx, text)}</p></div>`; }
function date(ctx, value, fallback = 'Not set') { return Number.isFinite(stamp(value)) ? `${esc(ctx, ctx.formatDate(value))} · ${esc(ctx, ctx.formatTime(value))}` : fallback; }
function timeField(value) {
  if (!Number.isFinite(stamp(value))) return '';
  const d = new Date(value), pad = value => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function field(ctx, label, key, value = '', type = 'text', attributes = '') { return `<label class="campus-field"><span>${esc(ctx, label)}</span><input name="${key}" type="${type}" value="${esc(ctx, value)}" ${attributes}></label>`; }
function textarea(ctx, label, key, value = '', attributes = '') { return `<label class="campus-field"><span>${esc(ctx, label)}</span><textarea name="${key}" rows="5" ${attributes}>${esc(ctx, value)}</textarea></label>`; }
function select(ctx, label, key, values, current, attributes = '') { return `<label class="campus-field"><span>${esc(ctx, label)}</span><select name="${key}" ${attributes}>${values.map(([value, label]) => `<option value="${esc(ctx, value)}"${value === current ? ' selected' : ''}>${esc(ctx, label)}</option>`).join('')}</select></label>`; }
function formStatus() { return '<p class="campus-form-status" role="status"></p>'; }
function sectionAssignments(ctx, cohort, manage = canManageAcademicSection(ctx, cohort)) { return rows(ctx.state, 'assignments').filter(item => item.cohort_id === cohort.id && (manage || item.status === 'published')).slice().sort((a, b) => (stamp(a.due_at) || Infinity) - (stamp(b.due_at) || Infinity) || String(a.title).localeCompare(String(b.title))); }
function secureLink(value) {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password && !/[\u0000-\u001f\u007f]/.test(value) ? url.href : ''; } catch { return ''; }
}

function summaryCard(ctx, summary) {
  const label = summary.final ? 'Final points total' : 'Current grade';
  return `<section class="campus-panel campus-academic-grade-summary"><p class="campus-eyebrow">${label}</p><h3>${summary.currentPercent === null ? 'No numeric grade yet' : `${summary.currentPercent.toFixed(1)}%`}</h3>${summary.possible > 0 ? `<p><strong>${points(summary.earned)} / ${points(summary.possible)} points</strong> from ${summary.graded} published ${summary.graded === 1 ? 'grade' : 'grades'}.</p>` : '<p>Published scores will appear here when work has been graded.</p>'}<p class="campus-muted">${summary.pending} pending · ${summary.excused} excused · ${summary.total} published ${summary.total === 1 ? 'assignment' : 'assignments'}.</p>${summary.pending ? '<p class="campus-muted">Pending work is excluded from this total. It is not counted as zero.</p>' : ''}<p class="campus-muted">Coursework grades are separate from learning-pathway completion records.</p></section>`;
}

function landing(ctx) {
  const cohorts = rows(ctx.state, 'cohorts').filter(cohort => cohort.status === 'active' && canViewAcademicSection(ctx, cohort));
  const canCreate = member(ctx) && ['staff', 'admin'].includes(ctx.state.member.role);
  return `<div class="campus-section-head"><div><h2 data-academic-focus tabindex="-1">Your courses</h2><p class="campus-muted">Lessons, assignments, feedback, and grades for your enrolled sections.</p></div>${canCreate ? `<a class="campus-button campus-button-secondary" href="${esc(ctx, ctx.href('live', { manage: '1' }))}">Manage sections & enrollment</a>` : ''}</div>${cohorts.length ? `<div class="campus-academic-grid">${cohorts.map(cohort => {
    const course = find(ctx.state, 'courses', cohort.course_id), manage = canManageAcademicSection(ctx, cohort), assignments = sectionAssignments(ctx, cohort), published = assignments.filter(item => item.status === 'published');
    return `<article class="campus-panel campus-academic-card"><p class="campus-eyebrow">${manage ? 'Teaching' : 'Enrolled section'}</p><h3>${link(ctx, href(ctx, cohort), cohort.title)}</h3><p>${esc(ctx, cohort.description)}</p>${course?.status === 'published' ? `<p class="campus-muted">Curriculum · ${esc(ctx, course.title)}</p>` : ''}<p class="campus-muted">Instructor · ${esc(ctx, name(ctx, cohort.instructor_id))}</p><p>${published.length} published ${published.length === 1 ? 'assignment' : 'assignments'}${manage ? ` · ${assignments.length - published.length} drafts` : ''}</p>${link(ctx, href(ctx, cohort), 'Open course', 'campus-button campus-button-secondary')}</article>`;
  }).join('')}</div>` : empty(ctx, member(ctx) ? 'Your course will appear here' : 'Sign in to open your courses', member(ctx) ? ctx.state.member.role === 'leadership' ? 'Leadership access does not reveal private course records. A course instructor manages student enrollment.' : 'Your instructor adds you to a course section. An open learning pathway does not automatically enroll you in a section.' : 'Coursework and grades require an active campus membership and section enrollment.')}<section class="campus-panel"><h3>Explore learning pathways</h3><p>Browse open learning activities and keep building skills between classes.</p><a href="${esc(ctx, ctx.href('learn'))}">Open learning pathways <span aria-hidden="true">→</span></a></section>`;
}

function overview(ctx, cohort, manage) {
  const assignments = sectionAssignments(ctx, cohort), published = assignments.filter(item => item.status === 'published');
  const dueFor = assignment => manage ? assignment.due_at : extensionFor(ctx.state, assignment, uid(ctx)).due_at;
  const next = published.filter(item => Number.isFinite(stamp(dueFor(item))) && stamp(dueFor(item)) >= Date.now()).sort((a, b) => stamp(dueFor(a)) - stamp(dueFor(b)))[0];
  return `<div class="campus-academic-layout"><div class="campus-stack"><section class="campus-panel"><h3>About this course</h3>${paragraphs(ctx, cohort.description || 'Find your assignments, learning materials, and instructor feedback in this workspace.')}<p>Your section connects coursework with its own instructor, roster, and classroom schedule.</p><div class="campus-card-actions">${link(ctx, href(ctx, cohort, 'assignments'), 'Open assignments', 'campus-button')}<a class="campus-button campus-button-secondary" href="${esc(ctx, ctx.href('live', { cohort: cohort.id }))}">Open classroom</a></div></section><section class="campus-panel"><h3>How learning and grades work</h3><p>Learning pathways contain readings, practice, and completion activities. Course assignments collect your submitted work and published numeric grades.</p><p>A submitted assignment awaits review. An instructor must explicitly publish a zero; ungraded work is never silently counted as zero. Excused assignments do not count toward the points total.</p>${link(ctx, href(ctx, cohort, 'grades'), manage ? 'Open gradebook' : 'View your grades')}</section></div><aside class="campus-stack">${manage ? `<section class="campus-panel"><p class="campus-eyebrow">Your section</p><h3>${sectionRoster(ctx, cohort).filter(item => item.active).length} enrolled members</h3><p>${published.length} published assignments · ${assignments.length - published.length} drafts</p>${cohort.status === 'active' ? link(ctx, href(ctx, cohort, 'assignments', { new: '1' }), 'Create assignment', 'campus-button campus-button-secondary') : '<p class="campus-muted">Archived section · history only.</p>'}</section>` : summaryCard(ctx, academicGradeSummary(ctx.state, cohort.id, uid(ctx)))}<section class="campus-panel"><p class="campus-eyebrow">Coming up</p>${next ? `<h3>${esc(ctx, next.title)}</h3><p>Due ${date(ctx, dueFor(next))}</p>${link(ctx, href(ctx, cohort, 'assignments', { assignment: next.id }), 'View assignment')}` : '<h3>No upcoming due date</h3><p>Assignments without a due date are still available in the Assignments tab.</p>'}</section></aside></div>`;
}

function modules(ctx, cohort) {
  const course = find(ctx.state, 'courses', cohort.course_id);
  if (!course || course.status !== 'published') return empty(ctx, 'Course materials are being prepared', 'Your instructor can connect a published learning pathway to this section. Assignments remain available in their own tab.');
  const modules = rows(ctx.state, 'modules').filter(item => item.course_id === course.id).slice().sort((a, b) => number(a.position) - number(b.position));
  return `<section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Connected learning pathway</p><h3>${esc(ctx, course.title)}</h3></div><a class="campus-button campus-button-secondary" href="${esc(ctx, ctx.href('learn'))}#course-${esc(ctx, course.id)}">Open pathway activities</a></div><p>${esc(ctx, course.description)}</p><p class="campus-muted">Pathway enrollment, progress, and completion are separate from your section’s numeric coursework grades.</p>${modules.length ? `<div class="campus-list">${modules.map((item, index) => `<details class="campus-academic-module"><summary><span class="campus-eyebrow">Module ${index + 1}</span> <strong>${esc(ctx, item.title)}</strong></summary>${paragraphs(ctx, item.body)}<a href="${esc(ctx, ctx.href('learn'))}#module-${esc(ctx, item.id)}">Open this learning activity</a></details>`).join('')}</div>` : empty(ctx, 'No modules published yet', 'Your instructor is preparing this pathway.')}</section>`;
}

function assignmentCard(ctx, cohort, assignment, manage) {
  const item = !manage ? academicGradeSummary(ctx.state, cohort.id, uid(ctx)).items.find(item => item.assignment.id === assignment.id) : null;
  const due = item?.due_at || assignment.due_at;
  return `<article class="campus-panel campus-academic-assignment"><div class="campus-section-head"><p class="campus-eyebrow">${assignment.status === 'draft' ? 'Draft · visible to instructors' : 'Published assignment'}</p><span class="campus-label">${number(assignment.points_possible)} points</span></div><h3>${link(ctx, href(ctx, cohort, 'assignments', { assignment: assignment.id }), assignment.title)}</h3><p class="campus-muted">Due ${date(ctx, due, 'No due date')} · ${number(assignment.max_attempts)} ${number(assignment.max_attempts) === 1 ? 'attempt' : 'attempts'} allowed</p>${item ? `<p><strong>${esc(ctx, item.stateLabel)}</strong>${item.extension ? ' · Personal extension' : ''}</p>` : ''}${link(ctx, href(ctx, cohort, 'assignments', { assignment: assignment.id }), manage ? 'Manage assignment & submissions' : 'Open assignment', 'campus-button campus-button-secondary campus-button-small')}</article>`;
}

function assignmentEditor(ctx, cohort, assignment) {
  if (cohort.status !== 'active') return '';
  const activity = assignment && (rows(ctx.state, 'assignment_attempts').some(item => item.assignment_id === assignment.id) || rows(ctx.state, 'assignment_grades').some(item => item.assignment_id === assignment.id));
  return `${assignment ? '<details class="campus-academic-edit-details"><summary>Edit assignment details</summary>' : ''}<section class="campus-panel campus-academic-editor">${assignment ? '' : '<h3>New assignment</h3>'}<form data-academic-form="assignment" data-cohort-id="${esc(ctx, cohort.id)}" data-assignment-id="${esc(ctx, assignment?.id || 'new')}">${field(ctx, 'Assignment title', 'title', assignment?.title || '', 'text', 'required maxlength="160"')}${textarea(ctx, 'Instructions', 'instructions', assignment?.instructions || '', 'maxlength="12000"')}<div class="campus-academic-fields">${field(ctx, 'Points possible', 'points_possible', assignment?.points_possible ?? 100, 'number', `required min="0.01" max="10000" step="0.01"${activity ? ' disabled' : ''}`)}${field(ctx, 'Maximum attempts', 'max_attempts', assignment?.max_attempts || 1, 'number', 'required min="1" max="10" step="1"')}${select(ctx, 'Assignment visibility', 'status', [['draft', 'Draft — instructors only'], ['published', 'Published — enrolled students']], assignment?.status || 'draft', activity ? 'disabled' : '')}</div>${activity ? '<p class="campus-muted">Points and publication are fixed because this assignment already has submissions or grades.</p>' : ''}<div class="campus-academic-fields">${field(ctx, 'Opens at (optional)', 'opens_at', timeField(assignment?.opens_at), 'datetime-local')}${field(ctx, 'Due at (optional)', 'due_at', timeField(assignment?.due_at), 'datetime-local')}${field(ctx, 'Closes at (optional)', 'closes_at', timeField(assignment?.closes_at), 'datetime-local')}</div><p class="campus-muted">Times use your device’s local time zone. Work after the due date is late; the closing time prevents additional submissions.</p><button class="campus-button" type="submit">${assignment ? 'Save assignment' : 'Create assignment'}</button>${formStatus()}</form></section>${assignment ? '</details>' : ''}`;
}

function attemptHistory(ctx, attempts, grades, currentAttemptId) {
  return `<section class="campus-panel campus-academic-history"><h3>Submission & grade history</h3>${attempts.length ? attempts.map(attempt => `<details><summary>Attempt ${number(attempt.attempt_no)} · ${date(ctx, attempt.submitted_at)}${attempt.id === currentAttemptId ? ' · latest' : ''}</summary>${paragraphs(ctx, attempt.body)}${secureLink(attempt.link_url) ? `<p><a href="${esc(ctx, secureLink(attempt.link_url))}" target="_blank" rel="noopener noreferrer">Open submitted project link <span class="campus-sr-only">(opens in a new tab)</span></a></p>` : ''}</details>`).join('') : '<p class="campus-muted">No work has been submitted.</p>'}${grades.length ? `<div class="campus-list">${grades.map(grade => `<details><summary>${grade.status === 'draft' ? 'Draft grade · instructor only' : 'Published grade'} · revision ${number(grade.revision)} · ${grade.disposition === 'excused' ? 'Excused' : `${number(grade.score)} points`}${(grade.attempt_id || null) !== (currentAttemptId || null) ? ' · earlier attempt' : ''}</summary><p class="campus-muted">${date(ctx, grade.published_at || grade.created_at)}</p>${paragraphs(ctx, grade.feedback || 'No written feedback.')}</details>`).join('')}</div>` : ''}</section>`;
}

function studentAssignment(ctx, cohort, assignment) {
  const id = uid(ctx), attempts = attemptsFor(ctx.state, assignment.id, id), grades = gradesFor(ctx.state, assignment.id, id, true), effective = extensionFor(ctx.state, assignment, id), now = Date.now();
  const reason = assignment.status !== 'published' ? 'This assignment is not published.' : cohort.status !== 'active' ? 'This section is archived.' : cohort.instructor_id === id ? 'Instructors cannot submit their own coursework.' : Number.isFinite(stamp(assignment.opens_at)) && now < stamp(assignment.opens_at) ? 'Submissions have not opened yet.' : Number.isFinite(stamp(effective.closes_at)) && now > stamp(effective.closes_at) ? 'Submissions are closed. Ask your instructor about an extension.' : attempts.length >= number(assignment.max_attempts) ? 'You have used all available attempts.' : '';
  const late = Number.isFinite(stamp(effective.due_at)) && now > stamp(effective.due_at);
  const item = academicGradeSummary(ctx.state, cohort.id, id).items.find(item => item.assignment.id === assignment.id);
  return `<div class="campus-academic-layout"><div class="campus-stack"><section class="campus-panel"><p class="campus-eyebrow">Assignment instructions</p><h3>${esc(ctx, assignment.title)}</h3>${paragraphs(ctx, assignment.instructions || 'Follow your instructor’s directions and submit your work below.')}<div class="campus-academic-facts"><p><strong>${number(assignment.points_possible)} points</strong></p><p>Opens ${date(ctx, assignment.opens_at, 'Any time')}</p><p>Due ${date(ctx, effective.due_at, 'No due date')}${effective.extension ? ' · personal extension' : ''}</p><p>Closes ${date(ctx, effective.closes_at, 'No closing date')}</p></div></section><section class="campus-panel campus-academic-submit"><h3>${attempts.length ? 'Submit another attempt' : 'Submit your work'}</h3><p class="campus-muted">${attempts.length} of ${number(assignment.max_attempts)} attempts used. Earlier submissions stay in your history.</p>${reason ? `<p class="campus-member-notice">${esc(ctx, reason)}</p>` : `<form data-academic-form="submission" data-cohort-id="${esc(ctx, cohort.id)}" data-assignment-id="${esc(ctx, assignment.id)}" data-student-id="${esc(ctx, id)}">${textarea(ctx, 'Your response', 'body', '', 'maxlength="12000"')}${field(ctx, 'Project link (HTTPS, optional)', 'link_url', '', 'url', 'maxlength="2000" placeholder="https://"')}<p class="campus-muted">Include a written response or a secure project link.${late ? ' This attempt will be submitted after your due date.' : ''}</p><button class="campus-button" type="submit">${attempts.length ? 'Submit new attempt' : 'Submit assignment'}</button>${formStatus()}</form>`}</section>${attemptHistory(ctx, attempts, grades, attempts[0]?.id)}</div><aside class="campus-stack"><section class="campus-panel"><p class="campus-eyebrow">Your result</p><h3>${esc(ctx, item?.stateLabel || 'Awaiting review')}</h3>${item?.currentGrade ? paragraphs(ctx, item.currentGrade.feedback || 'No written feedback.') : '<p>Your instructor’s published grade for your latest attempt will appear here.</p>'}${item?.latestAttempt ? `<p class="campus-muted">Latest submission ${date(ctx, item.latestAttempt.submitted_at)}${Number.isFinite(stamp(effective.due_at)) && stamp(item.latestAttempt.submitted_at) > stamp(effective.due_at) ? ' · after due date' : ''}</p>` : ''}</section><section class="campus-panel"><h3>Need help?</h3><p>Contact your instructor about the assignment or a personal deadline.</p><a href="${esc(ctx, ctx.href('messages', { person: cohort.instructor_id }))}">Message your instructor</a></section></aside></div>`;
}

function reviewStudents(ctx, cohort, assignment) {
  const ids = new Set(sectionRoster(ctx, cohort).map(item => item.user_id));
  for (const item of [...rows(ctx.state, 'assignment_attempts'), ...rows(ctx.state, 'assignment_grades')]) if (item.assignment_id === assignment.id) ids.add(item.user_id);
  return [...ids].filter(id => id !== cohort.instructor_id).sort((a, b) => name(ctx, a).localeCompare(name(ctx, b)));
}

function gradingForm(ctx, cohort, assignment, studentId) {
  const attempts = attemptsFor(ctx.state, assignment.id, studentId), grades = gradesFor(ctx.state, assignment.id, studentId), latest = attempts[0], latestGrade = grades[0];
  const applicable = latestGrade && (latestGrade.attempt_id || null) === (latest?.id || null) ? latestGrade : null;
  const allowed = cohort.status === 'active' && assignment.status === 'published' && activeLearner(ctx, cohort, studentId) && studentId !== uid(ctx);
  if (!allowed) return '<p class="campus-member-notice">This record is available as history. Grading requires a published assignment, an active enrolled student, and an active section. You cannot grade your own work.</p>';
  // Read-only text inputs are hidden visually but stay part of ordinary draft data. Their
  // captured revision/attempt survives a refresh, so stale work cannot overwrite a new grade.
  return `<form data-academic-form="grade" data-cohort-id="${esc(ctx, cohort.id)}" data-assignment-id="${esc(ctx, assignment.id)}" data-student-id="${esc(ctx, studentId)}"><input type="text" name="expected_revision" value="${number(latestGrade?.revision)}" hidden readonly><input type="text" name="attempt_id" value="${esc(ctx, latest?.id || '')}" hidden readonly>${select(ctx, 'Result', 'disposition', [['graded', 'Score this assignment'], ['excused', 'Excused — exclude from total']], applicable?.disposition || 'graded')}${field(ctx, `Score (out of ${number(assignment.points_possible)})`, 'score', applicable?.disposition === 'graded' ? applicable.score : '', 'number', `min="0" max="${number(assignment.points_possible)}" step="0.01" required`)}${!latest ? '<p class="campus-muted">No attempt has been submitted. You may excuse this assignment or publish an explicit zero with explanatory feedback.</p>' : `<p class="campus-muted">Grading latest attempt ${number(latest.attempt_no)} from ${date(ctx, latest.submitted_at)}.</p>`}${textarea(ctx, 'Instructor feedback', 'feedback', applicable?.feedback || '', 'maxlength="12000"')}${select(ctx, 'Grade visibility', 'status', [['draft', 'Draft — instructors only'], ['published', 'Publish to student']], 'draft')}<p class="campus-muted">Draft feedback stays private. Publishing a grade notifies the student. A newer submission requires a new review.</p><div class="campus-card-actions"><button class="campus-button" type="submit">Save grade</button><button class="campus-button campus-button-secondary" type="button" data-academic-discard-review>Discard draft &amp; load latest review</button></div><p class="campus-muted">Loading the latest review discards your unsaved score and feedback, then opens the current submission and grade.</p>${formStatus()}</form>`;
}

function extensionForm(ctx, cohort, assignment, studentId) {
  if (cohort.status !== 'active' || assignment.status !== 'published' || !activeLearner(ctx, cohort, studentId)) return '';
  const { extension } = extensionFor(ctx.state, assignment, studentId);
  return `<section class="campus-panel campus-academic-extension"><h3>Personal deadline extension</h3><p class="campus-muted">Original due date: ${date(ctx, assignment.due_at, 'None')}. Original close: ${date(ctx, assignment.closes_at, 'None')}. Extensions can lengthen a deadline; clearing returns to the original dates.</p><form data-academic-form="extension" data-cohort-id="${esc(ctx, cohort.id)}" data-assignment-id="${esc(ctx, assignment.id)}" data-student-id="${esc(ctx, studentId)}">${field(ctx, 'Extended due date (optional)', 'due_at', timeField(extension?.due_at), 'datetime-local')}${field(ctx, 'Extended closing date (optional)', 'closes_at', timeField(extension?.closes_at), 'datetime-local')}<div class="campus-card-actions"><button type="submit" class="campus-button campus-button-secondary">Save extension</button>${extension ? '<button type="submit" class="campus-button campus-button-secondary" name="operation" value="clear">Clear extension</button>' : ''}</div>${formStatus()}</form></section>`;
}

function latestSubmission(ctx, assignment, studentId) {
  const attempt = attemptsFor(ctx.state, assignment.id, studentId)[0];
  const due = extensionFor(ctx.state, assignment, studentId).due_at;
  const late = attempt && Number.isFinite(stamp(due)) && stamp(attempt.submitted_at) > stamp(due);
  return `<section class="campus-panel campus-academic-submission-review campus-academic-latest-work"><div class="campus-section-head"><div><p class="campus-eyebrow">Work to review · ${esc(ctx, name(ctx, studentId))}</p><h3>Latest submission</h3></div>${attempt ? `<span class="campus-label">Attempt ${number(attempt.attempt_no)}</span>` : ''}</div>${attempt ? `<p class="campus-muted">Submitted ${date(ctx, attempt.submitted_at)}${late ? ' · after the student’s due date' : ''}</p>${paragraphs(ctx, attempt.body)}${secureLink(attempt.link_url) ? `<p><a class="campus-button campus-button-secondary" href="${esc(ctx, secureLink(attempt.link_url))}" target="_blank" rel="noopener noreferrer">Open submitted project link <span class="campus-sr-only">(opens in a new tab)</span></a></p>` : ''}` : '<p>This student has not submitted an attempt. Any earlier grade or excusal is recorded in the history below.</p>'}</section>`;
}

function teacherAssignment(ctx, cohort, assignment, route) {
  const students = reviewStudents(ctx, cohort, assignment), selected = route.student ? students.find(id => id === route.student) : students[0];
  return `<div class="campus-stack"><div class="campus-section-head"><div><p class="campus-eyebrow">${assignment.status === 'draft' ? 'Draft assignment · instructors only' : 'Published assignment'} · ${points(assignment.points_possible)} points</p><h3>${esc(ctx, assignment.title)}</h3><p class="campus-muted">Due ${date(ctx, assignment.due_at, 'No due date')}</p></div></div>${assignmentEditor(ctx, cohort, assignment)}<section class="campus-panel campus-academic-review"><div class="campus-section-head"><div><p class="campus-eyebrow">Instructor review</p><h3>Submissions & grading</h3></div>${link(ctx, href(ctx, cohort, 'grades'), 'Open gradebook')}</div>${students.length ? `<nav class="campus-academic-review-list" aria-label="Choose a student to review">${students.map(id => `<a href="${esc(ctx, href(ctx, cohort, 'assignments', { assignment: assignment.id, student: id }))}" data-academic-nav${id === selected ? ' aria-current="true"' : ''}>${esc(ctx, name(ctx, id))}${activeLearner(ctx, cohort, id) ? '' : ' · inactive enrollment'}</a>`).join('')}</nav>` : '<p class="campus-muted">Add students through Manage sections & enrollment to start reviewing coursework.</p>'}${route.student && !selected ? '<p class="campus-member-notice">That student’s record is not available in this section.</p>' : ''}</section>${selected ? `<div class="campus-academic-layout"><div class="campus-stack">${latestSubmission(ctx, assignment, selected)}<section class="campus-panel"><h3>Review ${esc(ctx, name(ctx, selected))}</h3>${gradingForm(ctx, cohort, assignment, selected)}</section>${attemptHistory(ctx, attemptsFor(ctx.state, assignment.id, selected), gradesFor(ctx.state, assignment.id, selected), attemptsFor(ctx.state, assignment.id, selected)[0]?.id)}</div><aside>${extensionForm(ctx, cohort, assignment, selected)}</aside></div>` : ''}</div>`;
}

function assignments(ctx, cohort, manage, route) {
  if (route.isNew) return manage ? assignmentEditor(ctx, cohort, null) || empty(ctx, 'This section is archived', 'New assignments cannot be created in an archived section.') : empty(ctx, 'Instructor access required', 'Only the assigned instructor or a campus administrator can create assignments.');
  if (route.assignment) {
    const assignment = sectionAssignments(ctx, cohort, manage).find(item => item.id === route.assignment);
    if (!assignment) return empty(ctx, 'This assignment is not available', 'The assignment must be published in your enrolled section. Contact your instructor if you need help finding it.');
    return `<p>${link(ctx, href(ctx, cohort, 'assignments'), '← All assignments')}</p>${manage ? teacherAssignment(ctx, cohort, assignment, route) : studentAssignment(ctx, cohort, assignment)}`;
  }
  const items = sectionAssignments(ctx, cohort, manage);
  return `<div class="campus-section-head"><div><h3>Assignments</h3><p class="campus-muted">${manage ? 'Prepare coursework, review attempts, and publish individual grades.' : 'Read instructions, submit work, and follow your instructor’s feedback.'}</p></div>${manage && cohort.status === 'active' ? link(ctx, href(ctx, cohort, 'assignments', { new: '1' }), 'Create assignment', 'campus-button') : ''}</div>${items.length ? `<div class="campus-academic-grid">${items.map(item => assignmentCard(ctx, cohort, item, manage)).join('')}</div>` : empty(ctx, 'No assignments yet', manage ? 'Create a draft assignment, then publish it when it is ready for students.' : 'Published assignments from your instructor will appear here.')}`;
}

function studentGrades(ctx, cohort) {
  const summary = academicGradeSummary(ctx.state, cohort.id, uid(ctx));
  return `<div class="campus-academic-layout"><div class="campus-stack"><section class="campus-panel"><h3>Your published grades</h3>${summary.items.length ? `<div class="campus-list">${summary.items.map(item => `<article class="campus-academic-grade-row"><div class="campus-section-head"><h4>${link(ctx, href(ctx, cohort, 'assignments', { assignment: item.assignment.id }), item.assignment.title)}</h4><strong>${esc(ctx, item.stateLabel)}</strong></div>${item.currentGrade ? paragraphs(ctx, item.currentGrade.feedback || 'No written feedback.') : '<p class="campus-muted">This item is pending and excluded from the current points total.</p>'}</article>`).join('')}</div>` : empty(ctx, 'No grades yet', 'Your published assignments and instructor feedback will appear here.')}</section></div><aside>${summaryCard(ctx, summary)}</aside></div>`;
}

function gradebook(ctx, cohort) {
  const assignments = sectionAssignments(ctx, cohort).filter(item => item.status === 'published');
  const students = new Set(sectionRoster(ctx, cohort).map(item => item.user_id));
  for (const assignment of assignments) for (const id of reviewStudents(ctx, cohort, assignment)) students.add(id);
  students.delete(cohort.instructor_id);
  const sorted = [...students].sort((a, b) => name(ctx, a).localeCompare(name(ctx, b)));
  return `<section class="campus-panel"><div class="campus-section-head"><h3>Section gradebook</h3>${link(ctx, href(ctx, cohort, 'assignments'), 'Manage assignments')}</div><p class="campus-muted">Totals use published grades for each student’s latest attempt. Drafts stay private, excused work is excluded, and pending work is not counted as zero.</p>${assignments.length && sorted.length ? `<div class="campus-academic-table-wrap" role="region" aria-label="Section grades" tabindex="0"><table class="campus-academic-gradebook"><caption>Published coursework results · ${esc(ctx, cohort.title)}</caption><thead><tr><th scope="col">Student</th>${assignments.map(assignment => `<th scope="col">${esc(ctx, assignment.title)}<br><span class="campus-muted">${number(assignment.points_possible)} points</span></th>`).join('')}<th scope="col">Points total</th></tr></thead><tbody>${sorted.map(id => {
    const summary = academicGradeSummary(ctx.state, cohort.id, id);
    return `<tr><th scope="row">${esc(ctx, name(ctx, id))}${activeLearner(ctx, cohort, id) ? '' : '<br><span class="campus-muted">Inactive · history only</span>'}</th>${assignments.map(assignment => { const item = summary.items.find(item => item.assignment.id === assignment.id), draft = gradesFor(ctx.state, assignment.id, id).find(grade => grade.status === 'draft' && grade.revision > number(item?.publishedGrade?.revision)); return `<td>${link(ctx, href(ctx, cohort, 'assignments', { assignment: assignment.id, student: id }), item?.stateLabel || 'Not submitted')}${draft ? '<span class="campus-academic-draft-label">Unpublished draft</span>' : ''}</td>`; }).join('')}<td><strong>${summary.currentPercent === null ? 'No numeric grade' : `${points(summary.earned)} / ${points(summary.possible)} · ${summary.currentPercent.toFixed(1)}%`}</strong><span class="campus-muted">${summary.final ? 'Final points total' : `${summary.pending} pending`} · ${summary.excused} excused</span></td></tr>`;
  }).join('')}</tbody></table></div>` : empty(ctx, 'The gradebook is ready for your course', 'Publish an assignment and enroll students to see section results here.')}</section>`;
}

function people(ctx, cohort, manage) {
  return `<div class="campus-academic-layout"><section class="campus-panel"><p class="campus-eyebrow">Your instructor</p><h3>${esc(ctx, name(ctx, cohort.instructor_id))}</h3>${cohort.instructor_id !== uid(ctx) ? `<a class="campus-button campus-button-secondary" href="${esc(ctx, ctx.href('messages', { person: cohort.instructor_id }))}">Message your instructor</a>` : '<p>You are the assigned instructor for this section.</p>'}</section><section class="campus-panel"><h3>${manage ? 'Section enrollment' : 'Your enrollment'}</h3>${manage ? `<p class="campus-muted">Only this section’s instructor and campus administrators can manage its roster.</p><div class="campus-list">${sectionRoster(ctx, cohort).map(item => `<div class="campus-row"><strong>${esc(ctx, name(ctx, item.user_id))}</strong><span class="campus-label">${item.active ? 'Active' : 'Inactive'}</span></div>`).join('')}</div><a href="${esc(ctx, ctx.href('live', { manage: '1', cohort: cohort.id }))}">Manage sections & enrollment</a>` : `<p><strong>${esc(ctx, name(ctx, uid(ctx)))}</strong></p><p>Active enrollment in ${esc(ctx, cohort.title)}.</p><p class="campus-muted">Your submissions, personal deadlines, and grades are private to you and the instructors authorized to manage this section.</p>`}</section></div>`;
}

export function renderAcademics(view, ctx) {
  if (view !== 'courses') return '';
  const route = parseAcademicLocation(), cohort = find(ctx.state, 'cohorts', route.cohort);
  if (!route.cohort) return `<div data-campus-academics>${landing(ctx)}</div>`;
  if (!canViewAcademicSection(ctx, cohort)) return `<div data-campus-academics>${empty(ctx, 'This course is not available', 'Your account needs active enrollment in this section or permission to teach it. Contact the instructor or campus support to check your access.')}${link(ctx, href(ctx), 'Back to your courses', 'campus-button campus-button-secondary')}</div>`;
  const manage = canManageAcademicSection(ctx, cohort);
  const content = { overview: () => overview(ctx, cohort, manage), modules: () => modules(ctx, cohort), assignments: () => assignments(ctx, cohort, manage, route), grades: () => manage ? gradebook(ctx, cohort) : studentGrades(ctx, cohort), people: () => people(ctx, cohort, manage) }[route.tab]();
  return `<div data-campus-academics><p>${link(ctx, href(ctx), '← All courses')}</p><section class="campus-academic-hero"><div><p class="campus-eyebrow">${manage ? 'Teaching workspace' : 'Your course section'}</p><h2 data-academic-focus tabindex="-1">${esc(ctx, cohort.title)}</h2><p class="campus-muted">Instructor · ${esc(ctx, name(ctx, cohort.instructor_id))}</p></div><a class="campus-button campus-button-secondary" href="${esc(ctx, ctx.href('live', { cohort: cohort.id }))}">Classroom & recordings</a></section>${cohort.status !== 'active' ? '<p class="campus-member-notice">This section is archived. Coursework is available as history; editing and submissions are closed.</p>' : ''}<nav class="campus-academic-tabs" aria-label="Course navigation">${tabs.map(tab => `<a href="${esc(ctx, href(ctx, cohort, tab))}" data-academic-nav${route.tab === tab ? ' aria-current="page"' : ''}>${tab === 'grades' && manage ? 'Gradebook' : tab[0].toUpperCase() + tab.slice(1)}</a>`).join('')}</nav>${content}</div>`;
}

function parseDateInput(value, label) { if (!value) return null; const date = new Date(value); if (!Number.isFinite(date.getTime())) throw new Error(`Enter a valid ${label.toLowerCase()}.`); return date.toISOString(); }
function validateDates(opens, due, closes) { if (opens && due && stamp(opens) > stamp(due) || due && closes && stamp(due) > stamp(closes) || opens && closes && stamp(opens) > stamp(closes)) throw new Error('Dates must follow this order: opens, due, then closes.'); }

export function bindAcademics(view, root, ctx) {
  if (view !== 'courses') return () => {};
  const syncGrade = form => { if (form?.dataset.academicForm !== 'grade') return; const excused = form.elements.disposition.value === 'excused'; form.elements.score.disabled = excused; form.elements.score.required = !excused; };
  const click = async event => {
    const discard = event.target.closest?.('[data-academic-discard-review]');
    if (discard && root.contains(discard)) {
      const form = discard.closest('form[data-academic-form="grade"]');
      if (!form || !root.contains(form) || discard.disabled || form.querySelector('button[aria-busy="true"]')) return;
      event.preventDefault();
      const status = form.querySelector('.campus-form-status');
      discard.disabled = true; discard.setAttribute('aria-busy', 'true');
      try {
        // Explicitly discard this review only. Ordinary refresh/navigation keeps the
        // captured attempt and revision, and never silently rebases unsaved feedback.
        ctx.discardDraft(form);
        if (status) status.textContent = 'Loading the latest review…';
        await ctx.refresh();
        const latest = Array.from(root.querySelectorAll('form[data-academic-form="grade"]')).find(item => item.dataset.assignmentId === form.dataset.assignmentId && item.dataset.studentId === form.dataset.studentId);
        latest?.querySelector('textarea[name="feedback"]')?.focus({ preventScroll: true });
      } catch (error) {
        if (form.isConnected && status) status.textContent = error.message || 'The latest review could not load. Try again.';
        ctx.notify(error.message || 'The latest review could not load. Try again.', 'error');
      } finally { if (discard.isConnected) { discard.disabled = false; discard.removeAttribute('aria-busy'); } }
      return;
    }
    const anchor = event.target.closest?.('[data-academic-nav]');
    if (!anchor || !root.contains(anchor) || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const url = new URL(anchor.href, globalThis.location.href);
    globalThis.history.pushState({}, '', url.pathname + url.search + url.hash);
    await ctx.refresh();
    root.querySelector('[data-academic-focus]')?.focus({ preventScroll: true });
  };
  const submit = async event => {
    const form = event.target.closest?.('form[data-academic-form]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const cohort = find(ctx.state, 'cohorts', form.dataset.cohortId), assignment = find(ctx.state, 'assignments', form.dataset.assignmentId), kind = form.dataset.academicForm;
    const data = new FormData(form), value = key => String(data.get(key) || '').trim();
    const button = event.submitter || form.querySelector('button[type="submit"]'), status = form.querySelector('.campus-form-status');
    if (!button || button.disabled) return;
    try {
      if (!canViewAcademicSection(ctx, cohort) || cohort.status !== 'active') throw new Error('This section is not available for changes. Refresh and check your enrollment.');
      let command, payload, message;
      if (kind !== 'submission' && !canManageAcademicSection(ctx, cohort)) throw new Error('Only the assigned instructor or campus administrator can change this coursework.');
      if (kind !== 'assignment' && (!assignment || assignment.cohort_id !== cohort.id)) throw new Error('This assignment is not available in the selected section.');
      if (kind === 'assignment') {
        const locked = assignment && (rows(ctx.state, 'assignment_attempts').some(item => item.assignment_id === assignment.id) || rows(ctx.state, 'assignment_grades').some(item => item.assignment_id === assignment.id));
        command = 'saveAssignment'; payload = { ...(assignment ? { id: assignment.id } : {}), cohort_id: cohort.id, title: value('title'), instructions: value('instructions'), points_possible: locked ? assignment.points_possible : Number(value('points_possible')), max_attempts: Number(value('max_attempts')), status: locked ? assignment.status : value('status'), opens_at: parseDateInput(value('opens_at'), 'opening time'), due_at: parseDateInput(value('due_at'), 'due date'), closes_at: parseDateInput(value('closes_at'), 'closing time') };
        if (!payload.title) throw new Error('Add an assignment title.');
        validateDates(payload.opens_at, payload.due_at, payload.closes_at); message = 'Assignment saved.';
      } else if (kind === 'submission') {
        command = 'submitAssignment'; payload = { assignment_id: assignment.id, body: value('body'), link_url: value('link_url') || null };
        if (!payload.body && !payload.link_url) throw new Error('Add your response or a secure project link before submitting.');
        if (payload.link_url && !secureLink(payload.link_url)) throw new Error('Use an HTTPS project link without a username or password.');
        message = 'Your assignment attempt is saved. Your instructor can review it now.';
      } else if (kind === 'grade') {
        command = 'gradeAssignment'; payload = { assignment_id: assignment.id, user_id: form.dataset.studentId, attempt_id: value('attempt_id') || null, disposition: value('disposition'), score: value('disposition') === 'excused' ? null : Number(value('score')), feedback: value('feedback'), status: value('status'), expected_revision: Number(value('expected_revision')) };
        if (payload.disposition === 'graded' && (!value('score') || !Number.isFinite(payload.score))) throw new Error('Enter a numeric score, including an explicit zero when appropriate.');
        if (!payload.attempt_id && payload.disposition === 'graded' && (payload.score !== 0 || !payload.feedback)) throw new Error('Without a submission, only an explicit zero with explanatory feedback or an excused result is allowed.');
        message = payload.status === 'published' ? 'Grade published to the student.' : 'Draft grade saved. Students cannot see it.';
      } else if (kind === 'extension') {
        const clear = event.submitter?.value === 'clear';
        command = 'setAssignmentExtension'; payload = { assignment_id: assignment.id, user_id: form.dataset.studentId, due_at: clear ? null : parseDateInput(value('due_at'), 'extended due date'), closes_at: clear ? null : parseDateInput(value('closes_at'), 'extended closing time'), ...(clear ? { clear: true } : {}) };
        if (!clear) {
          if (!payload.due_at && !payload.closes_at) throw new Error('Choose a deadline to extend, or clear the existing extension.');
          if (payload.due_at && assignment.due_at && stamp(payload.due_at) < stamp(assignment.due_at) || payload.closes_at && assignment.closes_at && stamp(payload.closes_at) < stamp(assignment.closes_at)) throw new Error('An extension cannot shorten the original assignment deadline.');
          validateDates(assignment.opens_at, payload.due_at || assignment.due_at, payload.closes_at || assignment.closes_at);
        }
        message = clear ? 'Extension cleared. Original deadlines apply.' : 'Personal deadline extension saved.';
      } else return;
      button.disabled = true; button.setAttribute('aria-busy', 'true'); if (status) status.textContent = 'Saving…';
      const succeeded = await ctx.run(command, payload, message, form);
      if (form.isConnected && status) status.textContent = succeeded ? message : 'Your changes were not saved. Your draft is still here.';
      if (succeeded && form.isConnected && kind === 'submission') form.reset();
    } catch (error) { if (status) status.textContent = error.message || 'This change could not be saved.'; ctx.notify(error.message || 'This change could not be saved.', 'error'); }
    finally { if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); } }
  };
  const change = event => { const form = event.target.closest?.('form[data-academic-form="grade"]'); if (form) syncGrade(form); };
  const pop = () => { void ctx.refresh(); };
  root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change); window.addEventListener('popstate', pop);
  queueMicrotask(() => { root.querySelectorAll('form[data-academic-form="grade"]').forEach(syncGrade); });
  return () => { root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.removeEventListener('change', change); window.removeEventListener('popstate', pop); };
}
