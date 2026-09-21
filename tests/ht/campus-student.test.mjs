import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../ht/hub/campus-student.js', import.meta.url), 'utf8');
const { renderStudent, safeCampusUrl, calendarForEvent } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const start = new Date(Date.now() + 10 * 60_000).toISOString();
const end = new Date(Date.now() + 60 * 60_000).toISOString();
const base = () => ({
  mode: 'demo', user: { id: 'learner' }, member: { user_id: 'learner', display_name: 'Jordan R.', role: 'student' },
  announcements: [], events: [], rsvps: [], attendance: [], courses: [], modules: [], enrollments: [], progress: [], submissions: [], requests: [], responses: [], posts: [], replies: [], likes: [], members: [], messages: [], notifications: [], settings: {},
});
const context = (state) => ({ state, esc, href: (view, params = {}) => `/ht/hub/${view === 'home' ? '' : `${view}/`}?${new URLSearchParams(params)}`, formatDate: (value) => new Date(value).toLocaleDateString('en-US'), formatTime: (value) => new Date(value).toLocaleTimeString('en-US'), icon: () => '' });

test('web links reject script schemes, credentials, protocol-relative paths and controls', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', '//host.example/a', '/\\host.example/a', 'https://person:password@example.com', 'https://example.com/\nBAD']) assert.equal(safeCampusUrl(url), '', url);
  assert.equal(safeCampusUrl('/ht/hub/replay/'), '/ht/hub/replay/');
  assert.equal(safeCampusUrl('https://example.edu/resource?q=1'), 'https://example.edu/resource?q=1');
});

test('calendar output preserves UTC instants and contains injected content only as escaped text', () => {
  const calendar = calendarForEvent({ id: 'event-id', title: 'A, B; C\nBEGIN:VEVENT', description: 'One\\Two\nThree', location: 'Campus', starts_at: '2026-10-01T12:00:00-05:00', ends_at: '2026-10-01T13:00:00-05:00', status: 'published' }, new Date('2026-09-21T12:00:00Z'));
  assert.match(calendar, /DTSTART:20261001T170000Z\r\n/);
  assert.match(calendar, /DTEND:20261001T180000Z\r\n/);
  assert.match(calendar, /SUMMARY:A\\, B\\; C\\nBEGIN:VEVENT/);
  assert.equal(calendar.split('\r\n').filter((line) => line === 'BEGIN:VEVENT').length, 1);
  assert.throws(() => calendarForEvent({ starts_at: 'invalid' }), /valid date/);
});

test('calendar folds Unicode by UTF-8 bytes, preserving the original text on unfold', () => {
  const title = 'A campus conversation 👩🏽‍🎓 '.repeat(12);
  const calendar = calendarForEvent({ id: 'event-id', title, description: '', location: '', starts_at: start, ends_at: end });
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  assert.ok(calendar.replace(/\r\n /g, '').includes(`SUMMARY:${title}\r\n`));
});

test('all student views render empty, guest and unavailable states without fabricated activity', () => {
  for (const mode of ['demo', 'live', 'guest', 'unavailable']) {
    const state = base();
    state.mode = mode;
    if (['guest', 'unavailable'].includes(mode)) { state.user = null; state.member = null; }
    for (const view of ['home', 'learn', 'events', 'community', 'people']) {
      const html = renderStudent(view, context(state));
      assert.equal(typeof html, 'string');
      assert.ok(!html.includes('undefined'), `${mode}/${view}`);
      assert.ok(!html.includes('<h1'), `${mode}/${view}`);
      assert.ok(!html.includes('NaN'), `${mode}/${view}`);
    }
  }
});

test('learning locks later modules and excludes another learner’s completion from the current record', () => {
  const state = base();
  state.courses = [{ id: 'course', title: 'AI literacy', description: 'A course', status: 'published' }];
  state.modules = [{ id: 'first', course_id: 'course', title: 'First', position: 1, body: 'Learn', question: 'Choose', options: ['A', 'B'] }, { id: 'second', course_id: 'course', title: 'Second', position: 2, body: 'Practice', assignment_prompt: 'Build something' }];
  state.enrollments = [{ course_id: 'course', user_id: 'learner' }];
  state.progress = [{ module_id: 'first', user_id: 'someone-else', completed_at: start }];
  let html = renderStudent('learn', context(state));
  assert.match(html, /0 of 2 modules complete/);
  assert.match(html, /class="campus-module campus-module-locked" id="module-second"/);
  assert.match(html, /name="body"[^>]* disabled/);
  state.progress.push({ module_id: 'first', user_id: 'learner', completed_at: start });
  html = renderStudent('learn', context(state));
  assert.match(html, /1 of 2 modules complete/);
  assert.match(html, /class="campus-module" id="module-second" open/);
  assert.doesNotMatch(html, /name="body"[^>]* disabled/);
});

test('untrusted content stays text across course, event, community, directory and Ada transcript', () => {
  const state = base();
  const payload = '<img src=x onerror="alert(1)">';
  state.member.display_name = payload;
  state.courses = [{ id: 'course', title: payload, description: payload, image_url: 'javascript:alert(1)', status: 'published' }];
  state.modules = [{ id: 'module', course_id: 'course', title: payload, body: payload, position: 1, resource_url: 'javascript:alert(1)' }];
  state.events = [{ id: 'event', title: payload, description: payload, location: payload, starts_at: start, ends_at: end, status: 'published', join_url: 'javascript:alert(1)' }];
  state.posts = [{ id: 'post', author_id: 'learner', channel: payload, body: payload, created_at: start }];
  state.replies = [{ id: 'reply', post_id: 'post', author_id: 'learner', body: payload, created_at: start }];
  state.members = [{ user_id: 'learner', display_name: payload, role: 'student' }];
  state.announcements = [{ id: 'notice', title: payload, body: payload, status: 'published', created_at: start }];
  state.settings = { ada_video_url: 'https://example.com/ada.mp4', ada_video_transcript: payload };
  for (const view of ['home', 'learn', 'events', 'community', 'people']) {
    const html = renderStudent(view, context(state));
    assert.ok(!html.includes(payload), view);
    assert.ok(!html.includes('href="javascript:'), view);
    assert.ok(!html.includes('src="javascript:'), view);
    assert.ok(html.includes('&lt;img'), view);
  }
});

test('events respect the check-in window and never display a secret attendance code', () => {
  const state = base();
  state.events = [{ id: 'event', title: 'Workshop', starts_at: start, ends_at: end, status: 'published', checkin_code: 'SECRET' }];
  state.rsvps = [{ event_id: 'event', user_id: 'learner', status: 'going' }];
  let html = renderStudent('events', context(state));
  assert.match(html, /data-campus-command="checkin"/);
  assert.ok(!html.includes('SECRET'));
  state.events[0].starts_at = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  state.events[0].ends_at = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
  html = renderStudent('events', context(state));
  assert.doesNotMatch(html, /data-campus-command="checkin"/);
  state.mode = 'guest'; state.member = null; state.user = null;
  state.events[0].starts_at = start; state.events[0].ends_at = end;
  html = renderStudent('events', context(state));
  assert.doesNotMatch(html, /data-campus-command="checkin"/);
  assert.match(html, /data-status="going" disabled/);
});

test('future and draft announcements stay out of Today', () => {
  const state = base();
  state.announcements = [{ title: 'Future notice', status: 'published', publish_at: new Date(Date.now() + 86_400_000).toISOString() }, { title: 'Draft notice', status: 'draft' }, { title: 'Staff notice', status: 'published', audience: 'staff' }];
  const html = renderStudent('home', context(state));
  assert.ok(!html.includes('Future notice'));
  assert.ok(!html.includes('Draft notice'));
  assert.ok(!html.includes('Staff notice'));
});

test('messages open the latest valid conversation and never expose unrelated conversations', () => {
  const state = base();
  state.members = [{ user_id: 'staff', display_name: 'Morgan T.', role: 'staff' }, { user_id: 'other', display_name: 'Cameron L.', role: 'student' }];
  state.messages = [{ id: 'own-message', sender_id: 'staff', recipient_id: 'learner', body: 'Your project looks interesting.', created_at: start }, { id: 'private-message', sender_id: 'other', recipient_id: 'staff', body: 'This conversation is unrelated.', created_at: end }];
  const html = renderStudent('people', context(state));
  assert.match(html, /aria-label="Conversation with Morgan T\."/);
  assert.match(html, /data-recipient-id="staff"/);
  assert.match(html, /Your project looks interesting\./);
  assert.doesNotMatch(html, /This conversation is unrelated/);
});

test('student rendering follows the actual store through knowledge checks, review and completion', async () => {
  const storeSource = fs.readFileSync(new URL('../../ht/hub/campus-store.js', import.meta.url), 'utf8');
  const { createCampusStore } = await import(`data:text/javascript;base64,${Buffer.from(storeSource).toString('base64')}`);
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  const student = createCampusStore({ demoRole: 'student', storage });
  const staff = createCampusStore({ demoRole: 'staff', storage });
  try {
    let state = await student.load();
    const modules = state.modules.slice().sort((a, b) => a.position - b.position);
    for (const module of modules.filter((item) => item.question)) await student.command('completeModule', { module_id: module.id, answer_index: module.answer_index });
    state = await student.load();
    assert.match(renderStudent('learn', context(state)), /2 of 3 modules complete/);
    await student.command('submitWork', { module_id: modules[2].id, body: 'My project outlines a useful prompt, checks the result, and explains what I learned.' });
    state = await student.load();
    assert.match(renderStudent('learn', context(state)), /Awaiting instructor review/);
    assert.doesNotMatch(renderStudent('learn', context(state)), /Download record/);
    const staffState = await staff.load();
    const submission = staffState.submissions.find((item) => item.user_id === state.user.id);
    await staff.command('reviewWork', { id: submission.id, status: 'approved', feedback: 'Your reflection explains how you checked and improved the result.' });
    state = await student.load();
    const html = renderStudent('learn', context(state));
    assert.match(html, /3 of 3 modules complete/);
    assert.match(html, /Your completion record/);
    assert.match(html, /Your reflection explains how you checked and improved the result/);
    assert.match(html, /Download record/);
  } finally { student.destroy(); staff.destroy(); }
});
