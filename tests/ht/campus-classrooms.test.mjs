import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../ht/hub/campus-classrooms.js', import.meta.url), 'utf8');
const { renderClassrooms, bindClassrooms, canViewClassroom, canViewClassSession, classSessionHref } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let sequence = 0;
function state(role = 'student', mode = 'live') {
  const id = `person-${++sequence}`;
  return { mode, user: mode === 'guest' ? null : { id }, member: mode === 'guest' ? null : { user_id: id, role, display_name: 'Jordan R.' }, members: [{ user_id: id, role, display_name: 'Jordan R.' }, { user_id: 'instructor', role: 'staff', display_name: 'Morgan T.' }, { user_id: 'other-student', role: 'student', display_name: 'Cameron L.' }], cohorts: [], cohort_members: [], class_sessions: [], session_attendance: [], courses: [], events: [] };
}
function context(s) {
  return { state: s, esc: escape, href: (view, params = {}) => { const route = view.startsWith('/') ? view : `/ht/hub/${view}/`; const query = new URLSearchParams(params); if (s.mode === 'demo') query.set('demo', s.member.role); return route + (query.size ? `?${query}` : ''); }, formatDate: value => new Date(value).toLocaleDateString('en-US'), formatTime: value => new Date(value).toLocaleTimeString('en-US'), notify: () => {}, run: async () => true };
}
function addClass(s, id = 'cohort-one', instructor = 'instructor') {
  const cohort = { id, title: `Class ${id}`, description: 'A cohort learning together.', instructor_id: instructor, status: 'active', course_id: null };
  s.cohorts.push(cohort);
  const session = { id: `session-${id}`, cohort_id: id, event_id: null, title: `Session ${id}`, description: 'Read, discuss, and practice.', starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 3_600_000).toISOString(), status: 'scheduled', audience: 'cohort', instructor_id: instructor, room_slug: id === 'cohort-one' ? 'htc-111111111111111111111111' : 'htc-222222222222222222222222', room_id: `room-${id}`, is_live: false, replay_published: false, recording_url: null };
  s.class_sessions.push(session);
  return { cohort, session };
}
async function withRoute(search, work) {
  const original = globalThis.location;
  globalThis.location = { href: `https://example.test/ht/hub/live/${search}` };
  try { return await work(); } finally { if (original === undefined) delete globalThis.location; else globalThis.location = original; }
}
function binderHarness(ctx) {
  const listeners = new Map();
  const mount = { innerHTML: '', matches: () => true, contains: () => true, querySelectorAll: () => [], querySelector: () => null, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const cleanup = bindClassrooms('live', mount, ctx);
  return { mount, listeners, cleanup };
}
function form(kind, values) {
  const controls = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }]));
  const button = { disabled: false };
  const status = { textContent: '' };
  return { dataset: { classroomForm: kind }, isConnected: true, elements: { namedItem: name => controls[name] || null }, reportValidity: () => true, setAttribute: () => {}, removeAttribute: () => {}, querySelectorAll: () => [button], querySelector: () => status, closest() { return this; }, button, status };
}

test('students see their cohort, not another simultaneous classroom', () => {
  const s = state(); const first = addClass(s); const second = addClass(s, 'cohort-two');
  s.cohort_members = [{ cohort_id: first.cohort.id, user_id: s.user.id, active: true }];
  const ctx = context(s);
  assert.equal(canViewClassroom(ctx, first.cohort), true);
  assert.equal(canViewClassSession(ctx, first.session), true);
  assert.equal(canViewClassSession(ctx, second.session), false);
  const html = renderClassrooms('live', ctx);
  assert.ok(html.includes(first.cohort.title));
  assert.ok(!html.includes(second.cohort.title));
  assert.ok(!html.includes(second.session.title));
  assert.equal(classSessionHref(ctx, second.session), '');
});

test('pathway enrollment, leadership role and unrelated staff do not grant classroom membership', () => {
  for (const role of ['student', 'leadership', 'staff']) {
    const s = state(role); const { cohort, session } = addClass(s);
    s.enrollments = [{ user_id: s.user.id, course_id: 'course' }]; cohort.course_id = 'course';
    assert.equal(canViewClassroom(context(s), cohort), false, role);
    assert.equal(classSessionHref(context(s), session), '', role);
  }
});

test('protected links use unique managed room slugs and fail closed on malformed or legacy room keys', () => {
  const s = state('staff'); const { session } = addClass(s, 'cohort-one', s.user.id); const second = addClass(s, 'cohort-two', s.user.id);
  const ctx = context(s);
  assert.equal(classSessionHref(ctx, session), '/ht/hub/session/?room=htc-111111111111111111111111');
  assert.equal(classSessionHref(ctx, second.session), '/ht/hub/session/?room=htc-222222222222222222222222');
  for (const slug of ['ht-hub', 'javascript:alert(1)', 'htc-123', '', 'htc-111111111111111111111111&k=secret']) {
    assert.equal(classSessionHref(ctx, { ...session, room_slug: slug }), '');
  }
});

test('deactivation, archive, cancellation and unpublished replay suppress entry links', () => {
  const s = state(); const { cohort, session } = addClass(s); const enrollment = { cohort_id: cohort.id, user_id: s.user.id, active: true }; s.cohort_members.push(enrollment);
  const ctx = context(s);
  assert.equal(classSessionHref(ctx, session, true), '');
  session.replay_published = true;
  assert.equal(classSessionHref(ctx, session, true), '/ht/hub/replay/?room=htc-111111111111111111111111');
  session.status = 'cancelled'; assert.equal(classSessionHref(ctx, session), ''); assert.equal(classSessionHref(ctx, session, true), '');
  session.status = 'scheduled'; enrollment.active = false; assert.equal(classSessionHref(ctx, session), '');
  enrollment.active = true; cohort.status = 'archived'; assert.equal(classSessionHref(ctx, session, true), '');
});

test('campus event sessions stay separate and leadership can open only campus sessions', () => {
  const s = state('leadership'); const { session } = addClass(s);
  s.class_sessions.push({ ...session, id: 'campus-session', title: 'Campus town hall', audience: 'campus', cohort_id: null, room_slug: 'htc-333333333333333333333333' });
  const html = renderClassrooms('live', context(s));
  assert.match(html, /Campus live events/);
  assert.match(html, /Campus town hall/);
  assert.ok(!html.includes(session.title));
  assert.doesNotMatch(html, /Manage classrooms/);
});

test('rehearsal never opens a real room, requests media, or describes scheduled time as live conferencing', async () => {
  const s = state('student', 'demo'); const { cohort, session } = addClass(s); s.cohort_members.push({ cohort_id: cohort.id, user_id: s.user.id, active: true });
  const ctx = context(s);
  assert.equal(classSessionHref(ctx, session), '/ht/hub/live/?session=session-cohort-one&demo=student');
  await withRoute('?session=session-cohort-one&demo=student', () => {
    const html = renderClassrooms('live', ctx);
    assert.match(html, /No camera, microphone, live audio, or video meeting is running/);
    assert.match(html, /Record a practice join/);
    assert.doesNotMatch(html, /<video|<iframe|src="|getUserMedia|\/ht\/hub\/session\//);
  });
  assert.doesNotMatch(renderClassrooms('live', ctx), /Live now/);
});

test('manually requested replay rehearsal does not reveal an unpublished recording', async () => {
  const s = state('student', 'demo'); const { cohort, session } = addClass(s); s.cohort_members.push({ cohort_id: cohort.id, user_id: s.user.id, active: true });
  session.recording_url = 'https://private.example.test/unpublished.mp4';
  await withRoute('?session=session-cohort-one&demo=student&replay=1', () => {
    let html = renderClassrooms('live', context(s));
    assert.match(html, /Recording unavailable/);
    assert.doesNotMatch(html, /unpublished\.mp4|Record a practice join|preview shows where/);
    session.replay_published = true;
    html = renderClassrooms('live', context(s));
    assert.match(html, /does not play a sample video/);
    assert.doesNotMatch(html, /unpublished\.mp4|<video/);
  });
});

test('missing authenticated identity suppresses protected classroom access even if membership is stale', () => {
  const s = state(); const { cohort, session } = addClass(s); s.cohort_members.push({ cohort_id: cohort.id, user_id: s.user.id, active: true });
  s.user = null;
  assert.equal(canViewClassroom(context(s), cohort), false);
  assert.equal(classSessionHref(context(s), session), '');
});

test('rosters and classroom management stay restricted to assigned instructors and admins', async () => {
  const s = state('student'); const { cohort } = addClass(s); s.cohort_members.push({ cohort_id: cohort.id, user_id: s.user.id, active: true });
  await withRoute('?cohort=cohort-one', () => {
    const html = renderClassrooms('live', context(s));
    assert.doesNotMatch(html, /data-classroom-form="roster"/);
    assert.doesNotMatch(html, /Manage this classroom/);
  });
  await withRoute('?manage=1', () => assert.match(renderClassrooms('live', context(s)), /Instructor access required/));
  const instructor = state('staff'); const assigned = addClass(instructor, 'cohort-one', instructor.user.id); instructor.cohort_members.push({ cohort_id: assigned.cohort.id, user_id: 'other-student', active: true });
  await withRoute('?cohort=cohort-one', () => {
    const html = renderClassrooms('live', context(instructor));
    assert.match(html, /data-classroom-form="roster"/);
    assert.match(html, /Cameron L\./);
  });
});

test('untrusted titles, descriptions and names render as text and recordings never embed untrusted URLs', async () => {
  const s = state('staff'); const { cohort, session } = addClass(s, 'cohort-one', s.user.id);
  const payload = '<img src=x onerror="alert(1)">';
  cohort.title = payload; cohort.description = payload; session.title = payload; session.description = payload; session.recording_url = 'javascript:alert(1)'; session.replay_published = true; s.members[0].display_name = payload;
  for (const route of ['', '?cohort=cohort-one', '?manage=1', '?session=session-cohort-one']) {
    await withRoute(route, () => {
      const html = renderClassrooms('live', context(s));
      assert.ok(!html.includes(payload));
      assert.ok(!html.includes('javascript:'));
      assert.ok(html.includes('&lt;img'));
      assert.doesNotMatch(html, /<h1/);
    });
  }
});

test('missing state additions render safe empty or unavailable views during upgrade', () => {
  for (const mode of ['live', 'guest', 'unavailable']) {
    const s = state('student', mode); delete s.cohorts; delete s.class_sessions; delete s.cohort_members; delete s.session_attendance;
    const html = renderClassrooms('live', context(s));
    assert.equal(typeof html, 'string');
    assert.ok(!html.includes('undefined'));
    assert.ok(!html.includes('NaN'));
  }
});

test('directory styling marker never applies to cohort, rehearsal or management routes', async () => {
  const s = state('staff'); addClass(s, 'cohort-one', s.user.id);
  await withRoute('', () => {
    const html = renderClassrooms('live', context(s));
    assert.match(html, /data-campus-classrooms data-classroom-directory/);
    assert.match(html, /campus-classroom-section campus-classroom-happening/);
  });
  for (const route of ['?manage=1', '?manage=', '?cohort=cohort-one', '?session=session-cohort-one']) {
    await withRoute(route, () => assert.doesNotMatch(renderClassrooms('live', context(s)), /data-classroom-directory/));
  }
});

test('management submissions pass the specific form to ctx.run and keep form values on rejection', async () => {
  const s = state('staff'); const ctx = context(s); const calls = []; ctx.run = async (...args) => { calls.push(args); return false; };
  const f = form('cohort', { title: 'My new classroom', description: 'A new cohort.', instructor_id: s.user.id, course_id: '', status: 'active' });
  const harness = binderHarness(ctx);
  await harness.listeners.get('submit')({ target: f, preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'saveCohort');
  assert.equal(calls[0][1].instructor_id, s.user.id);
  assert.equal(calls[0][3], f);
  assert.equal(f.elements.namedItem('title').value, 'My new classroom');
  assert.equal(f.button.disabled, false);
  harness.cleanup();
});

test('management rejects another instructor’s roster even with a forged form', async () => {
  const s = state('staff'); const { cohort } = addClass(s); const ctx = context(s); const calls = [], errors = []; ctx.run = async (...args) => calls.push(args); ctx.notify = message => errors.push(message);
  const f = form('roster', { cohort_id: cohort.id, user_id: 'other-student', active: 'true' });
  const harness = binderHarness(ctx);
  await harness.listeners.get('submit')({ target: f, preventDefault() {} });
  assert.equal(calls.length, 0);
  assert.match(errors[0], /assigned instructor/);
  harness.cleanup();
});

test('session editor sends cohort instructor and validates end after start', async () => {
  const s = state('staff'); const { cohort } = addClass(s, 'cohort-one', s.user.id); const ctx = context(s); const calls = [], errors = []; ctx.run = async (...args) => { calls.push(args); return true; }; ctx.notify = message => errors.push(message);
  const f = form('session', { title: 'Scheduled class', description: 'Prepare a project.', audience: 'cohort', cohort_id: cohort.id, starts_at: '2026-10-01T12:00', ends_at: '2026-10-01T13:00', status: 'scheduled' });
  const harness = binderHarness(ctx);
  await harness.listeners.get('submit')({ target: f, preventDefault() {} });
  assert.equal(calls[0][0], 'saveClassSession');
  assert.equal(calls[0][1].instructor_id, s.user.id);
  assert.equal(calls[0][1].cohort_id, cohort.id);
  assert.equal(calls[0][3], f);
  f.elements.namedItem('ends_at').value = '2026-10-01T11:00';
  await harness.listeners.get('submit')({ target: f, preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.match(errors[0], /end after it starts/);
  f.elements.namedItem('ends_at').value = '2026-10-01T13:00';
  f.elements.namedItem('title').value = 'A'.repeat(121);
  await harness.listeners.get('submit')({ target: f, preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.match(errors[1], /120 characters/);
  harness.cleanup();
});

test('management deep links still allow a new classroom and a separate campus session', async () => {
  const s = state('staff'); addClass(s, 'cohort-one', s.user.id); const ctx = context(s);
  await withRoute('?manage=1&cohort=cohort-one', async () => {
    const harness = binderHarness(ctx);
    const click = async action => {
      const button = { dataset: { classroomAction: action }, closest() { return this; } };
      await harness.listeners.get('click')({ target: button });
    };
    await click('new-cohort');
    assert.match(harness.mount.innerHTML, /Create a classroom/);
    assert.doesNotMatch(harness.mount.innerHTML, /name="id" value="cohort-one"/);
    await click('campus-sessions');
    assert.match(harness.mount.innerHTML, /Schedule a session/);
    assert.match(harness.mount.innerHTML, /value="campus" selected/);
    assert.match(harness.mount.innerHTML, /data-session-cohort-fields hidden/);
    harness.cleanup();
  });
});

test('unsaved scheduling forms have separate draft identities for different classrooms', async () => {
  const s = state('staff'); addClass(s, 'cohort-one', s.user.id); addClass(s, 'cohort-two', s.user.id); const ctx = context(s);
  await withRoute('?manage=1&cohort=cohort-one', async () => {
    const harness = binderHarness(ctx);
    const click = async (action, data = {}) => {
      const button = { dataset: { classroomAction: action, ...data }, closest() { return this; } };
      await harness.listeners.get('click')({ target: button });
    };
    await click('manage-tab', { tab: 'sessions' });
    assert.match(harness.mount.innerHTML, /data-classroom-scope="cohort:cohort-one"/);
    assert.match(harness.mount.innerHTML, /campus-grid campus-session-times/);
    assert.match(harness.mount.innerHTML, /aria-describedby="classroom-session-time-hint"/);
    await click('select-cohort', { id: 'cohort-two' });
    assert.match(harness.mount.innerHTML, /data-classroom-scope="cohort:cohort-two"/);
    assert.doesNotMatch(harness.mount.innerHTML, /data-classroom-scope="cohort:cohort-one"/);
    harness.cleanup();
  });
});
