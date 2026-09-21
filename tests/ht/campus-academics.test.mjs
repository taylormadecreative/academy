import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../../ht/hub/campus-academics.js', import.meta.url), 'utf8');
const { renderAcademics, bindAcademics, parseAcademicLocation, canViewAcademicSection, canManageAcademicSection, academicGradeSummary } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const iso = offset => new Date(Date.now() + offset).toISOString();
const day = 86_400_000;
const section = { id: 'section', title: 'Responsible AI · Fall cohort', description: 'Learn together.', status: 'active', instructor_id: 'teacher', course_id: 'course' };
function stateFor(id = 'learner', role = 'student') {
  return { mode: 'demo', user: { id }, member: { user_id: id, display_name: id === 'teacher' ? 'Morgan T.' : 'Jordan R.', role, active: true },
    members: [{ user_id: 'learner', display_name: 'Jordan R.', role: 'student', active: true }, { user_id: 'teacher', display_name: 'Morgan T.', role: 'staff', active: true }, { user_id: 'other', display_name: 'Avery W.', role: 'student', active: true }],
    cohorts: [{ ...section }, { id: 'foreign', title: 'Private other section', status: 'active', instructor_id: 'other-teacher' }],
    cohort_members: [{ cohort_id: 'section', user_id: 'learner', active: true }, { cohort_id: 'section', user_id: 'other', active: true }],
    courses: [{ id: 'course', title: 'AI Literacy', description: 'Build a careful practice.', status: 'published' }], modules: [{ id: 'module', course_id: 'course', position: 1, title: 'Start here', body: 'Read and reflect.' }],
    assignments: [{ id: 'work', cohort_id: 'section', title: 'Responsible AI brief', instructions: 'Explain your choices.', points_possible: 100, max_attempts: 3, status: 'published', opens_at: iso(-day), due_at: iso(day), closes_at: iso(2 * day) }, { id: 'draft', cohort_id: 'section', title: 'SECRET draft assignment', instructions: 'SECRET instructions', points_possible: 50, max_attempts: 1, status: 'draft' }, { id: 'foreign-work', cohort_id: 'foreign', title: 'SECRET foreign assignment', points_possible: 100, max_attempts: 1, status: 'published' }],
    assignment_attempts: [], assignment_grades: [], assignment_extensions: [], enrollments: [],
  };
}
function ctx(state) { return { state, esc: escape, href: (view, query = {}) => `/ht/hub/${view === 'home' ? '' : view + '/'}?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== null && value !== undefined))}`, formatDate: value => new Date(value).toLocaleDateString('en-US'), formatTime: value => new Date(value).toLocaleTimeString('en-US') }; }
function render(state, query = '') {
  const previous = globalThis.location;
  globalThis.location = { href: `http://localhost/ht/hub/courses/?${query}` };
  try { return renderAcademics('courses', ctx(state)); }
  finally { if (previous === undefined) delete globalThis.location; else globalThis.location = previous; }
}

 test('academic URL parsing keeps supported selections and discards invalid identifiers or schemes', () => {
  assert.deepEqual(parseAcademicLocation('/ht/hub/courses/?cohort=section&tab=assignments&assignment=work&student=learner&new=1'), { cohort: 'section', tab: 'assignments', assignment: 'work', student: 'learner', isNew: true });
  assert.deepEqual(parseAcademicLocation('javascript:alert(1)?cohort=section'), { cohort: '', tab: 'overview', assignment: '', student: '', isNew: false });
  const route = parseAcademicLocation('/ht/hub/courses/?cohort=%3Cscript%3E&tab=private&assignment=../../secret&student=other&new=yes');
  assert.equal(route.cohort, ''); assert.equal(route.tab, 'overview'); assert.equal(route.assignment, ''); assert.equal(route.student, 'other'); assert.equal(route.isNew, false);
});

 test('academic access follows section enrollment or assigned teaching, never pathway enrollment or unrelated roles', () => {
  let state = stateFor();
  assert.equal(canViewAcademicSection(ctx(state), section), true);
  assert.equal(canManageAcademicSection(ctx(state), section), false);
  state.cohort_members = []; state.enrollments = [{ user_id: 'learner', course_id: 'course' }];
  assert.equal(canViewAcademicSection(ctx(state), section), false);
  state = stateFor('teacher', 'staff'); assert.equal(canManageAcademicSection(ctx(state), section), true);
  state = stateFor('unrelated', 'staff'); assert.equal(canViewAcademicSection(ctx(state), section), false);
  state.cohort_members.push({ cohort_id: 'section', user_id: 'unrelated', active: true });
  assert.equal(canViewAcademicSection(ctx(state), section), true); assert.equal(canManageAcademicSection(ctx(state), section), false);
  state.member.role = 'leadership'; assert.equal(canViewAcademicSection(ctx(state), section), false);
  state = stateFor('admin', 'admin'); assert.equal(canManageAcademicSection(ctx(state), section), true);
  state.member.active = false; assert.equal(canViewAcademicSection(ctx(state), section), false);
});

 test('guest, unavailable, removed, foreign-section, and archived learner views expose no coursework', () => {
  for (const variation of ['guest', 'unavailable', 'removed', 'foreign', 'archived']) {
    const state = stateFor();
    if (['guest', 'unavailable'].includes(variation)) state.mode = variation;
    if (variation === 'removed') state.cohort_members[0].active = false;
    if (variation === 'archived') state.cohorts[0].status = 'archived';
    const html = render(state, `cohort=${variation === 'foreign' ? 'foreign' : 'section'}&tab=assignments&assignment=work`);
    assert.match(html, /This course is not available/);
    assert.doesNotMatch(html, /Responsible AI brief|SECRET|data-academic-form/);
  }
});

 test('learner rendering excludes draft assignments, draft feedback, foreign work, and classmates’ private attempts', () => {
  const state = stateFor();
  state.assignment_attempts = [{ id: 'my-attempt', assignment_id: 'work', user_id: 'learner', attempt_no: 1, body: 'My saved work', submitted_at: iso(-1000) }, { id: 'other-attempt', assignment_id: 'work', user_id: 'other', attempt_no: 1, body: 'SECRET classmate response', submitted_at: iso(-1000) }];
  state.assignment_grades = [{ id: 'draft-grade', assignment_id: 'work', user_id: 'learner', attempt_id: 'my-attempt', score: 95, status: 'draft', disposition: 'graded', revision: 1, feedback: 'SECRET draft feedback' }, { id: 'other-grade', assignment_id: 'work', user_id: 'other', attempt_id: 'other-attempt', score: 80, status: 'published', disposition: 'graded', revision: 1, feedback: 'SECRET classmate feedback' }];
  for (const tab of ['overview', 'modules', 'assignments', 'grades', 'people']) {
    const html = render(state, `cohort=section&tab=${tab}&assignment=work&student=other`);
    assert.doesNotMatch(html, /SECRET|data-student-id="other"/);
  }
  const detail = render(state, 'cohort=section&tab=assignments&assignment=work');
  assert.match(detail, /My saved work/);
  assert.match(detail, /<textarea name="body"[^>]*><\/textarea>/, 'a submission editor never copies a stored response into a new attempt');
  assert.match(render(state, 'cohort=section&tab=assignments&assignment=draft'), /This assignment is not available/);
  assert.doesNotMatch(render(state, 'cohort=section&tab=people'), /Avery W\./, 'students do not receive a fabricated public classmates roster');
});

 test('grade totals distinguish published zero, excused, draft, unsubmitted, and resubmitted work', () => {
  const state = stateFor();
  state.assignments = ['scored', 'zero', 'excused', 'resubmitted', 'unsubmitted'].map((id, index) => ({ id, cohort_id: 'section', status: 'published', points_possible: [100, 50, 25, 10, 15][index] }));
  state.assignment_attempts = [{ id: 'scored-1', assignment_id: 'scored', user_id: 'learner', attempt_no: 1 }, { id: 'resubmitted-1', assignment_id: 'resubmitted', user_id: 'learner', attempt_no: 1 }, { id: 'resubmitted-2', assignment_id: 'resubmitted', user_id: 'learner', attempt_no: 2 }];
  const grade = (assignment_id, score, revision = 1, attempt_id = null, disposition = 'graded', status = 'published') => ({ assignment_id, user_id: 'learner', score, revision, attempt_id, disposition, status });
  state.assignment_grades = [grade('scored', 80, 1, 'scored-1'), grade('scored', 95, 2, 'scored-1', 'graded', 'draft'), grade('zero', 0), grade('excused', null, 1, null, 'excused'), grade('resubmitted', 8, 1, 'resubmitted-1')];
  let summary = academicGradeSummary(state, 'section', 'learner');
  assert.equal(summary.earned, 80); assert.equal(summary.possible, 150); assert.equal(summary.pending, 2); assert.equal(summary.excused, 1); assert.equal(summary.graded, 2); assert.equal(summary.final, false);
  assert.equal(summary.items.find(item => item.assignment.id === 'scored').currentGrade.score, 80, 'an unpublished revision does not erase a published score on the same attempt');
  assert.equal(summary.items.find(item => item.assignment.id === 'resubmitted').stateLabel, 'Resubmitted · awaiting grade');
  state.assignment_grades.push(grade('resubmitted', 9, 2, 'resubmitted-2'), grade('unsubmitted', null, 1, null, 'excused'));
  summary = academicGradeSummary(state, 'section', 'learner');
  assert.equal(summary.earned, 89); assert.equal(summary.possible, 160); assert.equal(summary.pending, 0); assert.equal(summary.final, true);
});

 test('empty and all-excused sections have no numeric grade; a new attempt makes a prior excusal pending', () => {
  const state = stateFor(); state.assignments = [];
  let summary = academicGradeSummary(state, 'section', 'learner');
  assert.equal(summary.currentPercent, null); assert.equal(summary.final, false);
  state.assignments = [{ id: 'work', cohort_id: 'section', status: 'published', points_possible: 100 }];
  state.assignment_grades = [{ assignment_id: 'work', user_id: 'learner', attempt_id: null, score: null, disposition: 'excused', status: 'published', revision: 1 }];
  summary = academicGradeSummary(state, 'section', 'learner');
  assert.equal(summary.excused, 1); assert.equal(summary.currentPercent, null); assert.equal(summary.final, false);
  state.assignment_attempts.push({ id: 'new', assignment_id: 'work', user_id: 'learner', attempt_no: 1 });
  summary = academicGradeSummary(state, 'section', 'learner');
  assert.equal(summary.excused, 0); assert.equal(summary.pending, 1); assert.equal(summary.currentPercent, null);
});

 test('student deadlines apply personal extensions, distinguish late from closed, and respect attempt limits', () => {
  const state = stateFor(); state.assignments[0].due_at = iso(-day); state.assignments[0].closes_at = iso(-1000);
  let html = render(state, 'cohort=section&tab=assignments&assignment=work');
  assert.match(html, /Submissions are closed/); assert.doesNotMatch(html, /data-academic-form="submission"/);
  state.assignment_extensions = [{ assignment_id: 'work', user_id: 'learner', due_at: iso(-500), closes_at: iso(day) }];
  html = render(state, 'cohort=section&tab=assignments&assignment=work');
  assert.match(html, /data-academic-form="submission"/); assert.match(html, /after your due date/); assert.match(html, /personal extension/);
  state.assignment_attempts = [1, 2, 3].map(attempt_no => ({ id: `try-${attempt_no}`, assignment_id: 'work', user_id: 'learner', attempt_no, submitted_at: iso(-100) }));
  html = render(state, 'cohort=section&tab=assignments&assignment=work');
  assert.match(html, /used all available attempts/); assert.doesNotMatch(html, /data-academic-form="submission"/);
});

 test('overview sorts student work by personal extended due dates and displays decimal points cleanly', () => {
  const state = stateFor(); state.assignments = [state.assignments[0]]; state.assignments[0].due_at = iso(-day);
  assert.match(render(state, 'cohort=section&tab=overview'), /No upcoming due date/);
  state.assignment_extensions = [{ assignment_id: 'work', user_id: 'learner', due_at: iso(day), closes_at: iso(2 * day) }];
  assert.match(render(state, 'cohort=section&tab=overview'), /<h3>Responsible AI brief<\/h3>/);
  state.assignments = [{ id: 'a', cohort_id: 'section', title: 'A', status: 'published', points_possible: 0.1 }, { id: 'b', cohort_id: 'section', title: 'B', status: 'published', points_possible: 0.2 }];
  state.assignment_attempts = ['a', 'b'].map(id => ({ id: `attempt-${id}`, assignment_id: id, user_id: 'learner', attempt_no: 1 }));
  state.assignment_grades = ['a', 'b'].map((id, index) => ({ assignment_id: id, user_id: 'learner', attempt_id: `attempt-${id}`, score: [0.1, 0.2][index], disposition: 'graded', status: 'published', revision: 1 }));
  const html = render(state, 'cohort=section&tab=grades');
  assert.match(html, /0\.3 \/ 0\.3 points/); assert.doesNotMatch(html, /0\.30000000000000004/);
});

 test('teacher editor locks points after activity and grading retains version and attempt conflict tokens in drafts', () => {
  const state = stateFor('teacher', 'staff');
  state.assignment_attempts = [{ id: 'attempt', assignment_id: 'work', user_id: 'learner', attempt_no: 1, body: 'Submission text stays in history.', submitted_at: iso(-1000) }];
  state.assignment_grades = [{ id: 'grade', assignment_id: 'work', user_id: 'learner', attempt_id: 'attempt', score: 0, disposition: 'graded', status: 'draft', feedback: 'Private working feedback', revision: 3 }];
  const html = render(state, 'cohort=section&tab=assignments&assignment=work&student=learner');
  assert.match(html, /name="points_possible"[^>]* disabled/);
  assert.match(html, /<select name="status" disabled>/);
  assert.match(html, /name="expected_revision" value="3" hidden readonly/);
  assert.match(html, /name="attempt_id" value="attempt" hidden readonly/);
  assert.match(html, /name="score"[^>]*value="0"/);
  assert.match(html, /Private working feedback/);
  assert.doesNotMatch(html, /<textarea[^>]*>Submission text stays in history\./);
  assert.match(html, /data-academic-form="extension"/);
  assert.match(html, /data-academic-discard-review>Discard draft &amp; load latest review/);
  assert.match(html, /discards your unsaved score and feedback/);
  assert.match(html, /<details class="campus-academic-edit-details"><summary>Edit assignment details<\/summary>/);
  const preview = html.indexOf('campus-academic-submission-review');
  const gradeForm = html.indexOf('data-academic-form="grade"');
  assert.ok(preview >= 0 && preview < gradeForm, 'the latest submitted work appears visibly before grading');
  const previewHtml = html.slice(preview, gradeForm);
  assert.match(previewHtml, /Submission text stays in history\./);
  assert.doesNotMatch(previewHtml, /<details/, 'reviewing the latest work does not require opening history');
  assert.match(render(state, 'cohort=section&tab=assignments&new=1'), /<section class="campus-panel campus-academic-editor"><h3>New assignment<\/h3>/);
  const foreign = render(state, 'cohort=section&tab=assignments&assignment=work&student=unrelated');
  assert.match(foreign, /That student’s record is not available/); assert.doesNotMatch(foreign, /data-academic-form="grade"/);
});

 test('teacher can read archived history but archived sections and inactive students expose no grading forms', () => {
  const state = stateFor('teacher', 'staff');
  state.cohorts[0].status = 'archived';
  let html = render(state, 'cohort=section&tab=assignments&assignment=work&student=learner');
  assert.match(html, /This section is archived/);
  assert.doesNotMatch(html, /data-academic-form="assignment"|data-academic-form="grade"|data-academic-form="extension"/);
  state.cohorts[0].status = 'active'; state.cohort_members[0].active = false;
  html = render(state, 'cohort=section&tab=assignments&assignment=work&student=learner');
  assert.match(html, /inactive enrollment/); assert.doesNotMatch(html, /data-academic-form="grade"|data-academic-form="extension"/);
});

 test('course content remains text and submitted resource links reject executable or credential URLs', () => {
  const state = stateFor(), unsafe = '<img src=x onerror=alert(1)>';
  state.cohorts[0].title = unsafe; state.assignments[0].title = unsafe; state.assignments[0].instructions = unsafe;
  state.assignment_attempts = [{ id: 'unsafe', assignment_id: 'work', user_id: 'learner', attempt_no: 1, body: unsafe, link_url: 'javascript:alert(1)', submitted_at: iso(-1000) }];
  const html = render(state, 'cohort=section&tab=assignments&assignment=work');
  assert.doesNotMatch(html, /<img|href="javascript:/); assert.match(html, /&lt;img/);
  state.assignment_attempts[0].link_url = 'https://person:password@example.edu/project';
  assert.doesNotMatch(render(state, 'cohort=section&tab=assignments&assignment=work'), /person:password/);
});

 test('modules point to existing learning activities without claiming numeric grade completion', () => {
  const state = stateFor();
  let html = render(state, 'cohort=section&tab=modules');
  assert.match(html, /Open pathway activities/); assert.match(html, /#module-module/); assert.match(html, /separate from your section’s numeric coursework grades/);
  state.courses[0].status = 'draft';
  html = render(state, 'cohort=section&tab=modules');
  assert.match(html, /Course materials are being prepared/); assert.doesNotMatch(html, /Read and reflect/);
});

function formHarness(state, kind, values, options = {}) {
  const callbacks = {}, calls = [], notices = [], status = { textContent: '' };
  const button = { disabled: false, isConnected: true, setAttribute() {}, removeAttribute() {}, value: options.clear ? 'clear' : '' };
  const form = { dataset: { academicForm: kind, cohortId: 'section', assignmentId: options.assignmentId || 'work', studentId: 'learner' }, isConnected: true, values, reportValidity: () => true, reset: () => { form.wasReset = true; }, querySelector: selector => selector === '.campus-form-status' ? status : button };
  const root = { contains: item => item === form, addEventListener: (name, fn) => { callbacks[name] = fn; }, removeEventListener() {}, querySelectorAll: () => [] };
  const context = { ...ctx(state), notify: (...args) => notices.push(args), run: async (...args) => { calls.push(args); return options.succeeded !== false; } };
  const cleanup = bindAcademics('courses', root, context);
  return { async submit() { await callbacks.submit({ target: { closest: () => form }, preventDefault() {}, submitter: button }); }, calls, notices, status, form, cleanup };
}

 test('submission command sends only work and assignment identity and preserves a failed draft', async () => {
  const oldWindow = globalThis.window, oldFormData = globalThis.FormData;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.FormData = class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } };
  try {
    const state = stateFor();
    let harness = formHarness(state, 'submission', { body: 'My own project', link_url: '', user_id: 'forged-student', submitted_at: 'forged-time' }, { succeeded: false });
    await harness.submit(); harness.cleanup();
    assert.deepEqual(harness.calls[0].slice(0, 2), ['submitAssignment', { assignment_id: 'work', body: 'My own project', link_url: null }]);
    assert.equal(harness.calls[0][3], harness.form); assert.equal(harness.form.wasReset, undefined); assert.match(harness.status.textContent, /draft is still here/);
    harness = formHarness(state, 'submission', { body: '', link_url: 'https://person:password@example.edu/file' });
    await harness.submit(); harness.cleanup();
    assert.equal(harness.calls.length, 0); assert.match(harness.notices[0][0], /HTTPS project link/);
  } finally { globalThis.window = oldWindow; globalThis.FormData = oldFormData; }
});

 test('grading command distinguishes zero and excused, keeps captured revision, and rejects unsupported no-attempt scores', async () => {
  const oldWindow = globalThis.window, oldFormData = globalThis.FormData;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.FormData = class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } };
  try {
    const state = stateFor('teacher', 'staff');
    let harness = formHarness(state, 'grade', { score: '0', disposition: 'graded', status: 'published', feedback: 'No work received after the deadline.', expected_revision: '4', attempt_id: '' });
    await harness.submit(); harness.cleanup();
    assert.equal(harness.calls[0][0], 'gradeAssignment'); assert.equal(harness.calls[0][1].score, 0); assert.equal(harness.calls[0][1].attempt_id, null); assert.equal(harness.calls[0][1].expected_revision, 4);
    harness = formHarness(state, 'grade', { score: '85', disposition: 'graded', status: 'published', feedback: '', expected_revision: '4', attempt_id: '' });
    await harness.submit(); harness.cleanup(); assert.equal(harness.calls.length, 0); assert.match(harness.notices[0][0], /only an explicit zero/);
    harness = formHarness(state, 'grade', { score: '', disposition: 'excused', status: 'draft', feedback: 'Excused', expected_revision: '4', attempt_id: '' });
    await harness.submit(); harness.cleanup(); assert.equal(harness.calls[0][1].score, null); assert.equal(harness.calls[0][1].status, 'draft');
  } finally { globalThis.window = oldWindow; globalThis.FormData = oldFormData; }
});

 test('extension form rejects shortened deadlines and clearing explicitly returns to original dates', async () => {
  const oldWindow = globalThis.window, oldFormData = globalThis.FormData;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.FormData = class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } };
  try {
    const state = stateFor('teacher', 'staff');
    let harness = formHarness(state, 'extension', { due_at: iso(-day), closes_at: '' });
    await harness.submit(); harness.cleanup(); assert.equal(harness.calls.length, 0); assert.match(harness.notices[0][0], /cannot shorten/);
    harness = formHarness(state, 'extension', { due_at: '', closes_at: '' }, { clear: true });
    await harness.submit(); harness.cleanup(); assert.deepEqual(harness.calls[0].slice(0, 2), ['setAssignmentExtension', { assignment_id: 'work', user_id: 'learner', due_at: null, closes_at: null, clear: true }]);
  } finally { globalThis.window = oldWindow; globalThis.FormData = oldFormData; }
});

 test('loading the latest review explicitly discards only the selected grade draft before refreshing', async () => {
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const callbacks = {}, order = [], status = { textContent: '' }, state = stateFor('teacher', 'staff');
  let busy = false, latestVisible = false, focused = false;
  const gradeForm = { dataset: { academicForm: 'grade', assignmentId: 'work', studentId: 'learner' }, isConnected: true, querySelector: selector => selector === 'button[aria-busy="true"]' ? busy ? {} : null : selector === '.campus-form-status' ? status : null };
  const discard = { disabled: false, isConnected: true, closest: () => gradeForm, setAttribute() {}, removeAttribute() {} };
  const latestForm = { dataset: { academicForm: 'grade', assignmentId: 'work', studentId: 'learner' }, querySelector: () => ({ focus: () => { focused = true; } }) };
  const root = { contains: item => item === gradeForm || item === discard, addEventListener: (event, callback) => { callbacks[event] = callback; }, removeEventListener() {}, querySelectorAll: () => latestVisible ? [latestForm] : [] };
  const context = { ...ctx(state), discardDraft: form => { order.push(['discard', form]); }, refresh: async () => { order.push(['refresh']); latestVisible = true; }, notify() {} };
  let cleanup;
  try {
    cleanup = bindAcademics('courses', root, context);
    await Promise.resolve();
    assert.equal(order.length, 0, 'binding does not silently discard or rebase feedback');
    busy = true;
    await callbacks.click({ target: { closest: () => discard }, preventDefault() {} });
    assert.equal(order.length, 0, 'a pending save cannot be interrupted by discarding the review');
    busy = false;
    await callbacks.click({ target: { closest: () => discard }, preventDefault() {} });
    assert.deepEqual(order, [['discard', gradeForm], ['refresh']]);
    assert.equal(focused, true); assert.equal(discard.disabled, false);
  } finally { cleanup?.(); globalThis.window = oldWindow; }
});
