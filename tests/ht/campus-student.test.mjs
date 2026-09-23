import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../ht/hub/campus-student.js', import.meta.url), 'utf8');
const { renderStudent, bindStudent, safeCampusUrl, calendarForEvent, credentialLabel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const start = new Date(Date.now() + 10 * 60_000).toISOString();
const end = new Date(Date.now() + 60 * 60_000).toISOString();
const base = () => ({
  mode: 'demo', user: { id: 'learner' }, member: { user_id: 'learner', display_name: 'Jordan R.', role: 'student' },
  announcements: [], events: [], rsvps: [], attendance: [], courses: [], modules: [], enrollments: [], progress: [], submissions: [], requests: [], responses: [], posts: [], replies: [], likes: [], members: [], messages: [], notifications: [], settings: {},
});
const context = (state) => ({ state, esc, href: (view, params = {}) => `/ht/hub/${view === 'home' ? '' : `${view}/`}?${new URLSearchParams(params)}`, formatDate: (value) => new Date(value).toLocaleDateString('en-US'), formatTime: (value) => new Date(value).toLocaleTimeString('en-US'), icon: () => '' });

test('credential IDs read as HT-CR-year-number, derived from the UUID', () => {
  assert.equal(credentialLabel('c7000000-0000-4000-8000-000000000001', '2026-09-09T15:00:00Z'), 'HT-CR-2026-0001');
  assert.equal(credentialLabel('c7000000-0000-4000-8000-000000000001', '2026-09-09T15:00:00Z'), credentialLabel('c7000000-0000-4000-8000-000000000001', '2026-09-09T15:00:00Z'));
  assert.match(credentialLabel('9f0e1d2c-3b4a-4596-8877-66554433aa00', '2025-05-01T00:00:00Z'), /^HT-CR-2025-\d{4}$/);
  assert.equal(credentialLabel('', '2026-01-01'), '');
});

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
  state.members = [{ user_id: 'learner', display_name: payload, role: 'student' }, { user_id: 'staff', display_name: payload, role: 'staff' }];
  state.messages = [{ id: 'unsafe-message', sender_id: 'staff', recipient_id: 'learner', body: payload, created_at: start }];
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

test('Today prioritizes one course action, the next cohort class, and direct campus connections', () => {
  const state = base(), courseId = 'course-1', cohortId = 'cohort-1';
  state.courses = [{ id: courseId, title: 'AI Literacy', description: 'Build a thoughtful practice.', status: 'published' }];
  state.enrollments = [{ course_id: courseId, user_id: 'learner' }];
  state.modules = [{ id: 'module-1', course_id: courseId, title: 'First step', position: 1, body: 'Start here.' }];
  state.cohorts = [{ id: cohortId, title: 'First-Year Scholars', course_id: courseId, status: 'active' }];
  state.cohort_members = [{ cohort_id: cohortId, user_id: 'learner', active: true }];
  state.class_sessions = [{ id: 'class-1', cohort_id: cohortId, title: 'Prompt Lab', status: 'scheduled', starts_at: start, ends_at: end }];
  state.events = [{ id: 'event-1', title: 'Campus Studio', location: 'Innovation Lab', status: 'published', starts_at: start, ends_at: end }];
  const html = renderStudent('home', context(state));
  assert.match(html, /AI Literacy/);
  assert.match(html, /Prompt Lab/);
  assert.match(html, /Open classroom/);
  assert.match(html, /href="\/ht\/hub\/courses\/\?cohort=cohort-1&amp;tab=overview"/);
  assert.match(html, /href="\/ht\/hub\/messages\/\?"[^>]*>Open messages/);
  assert.match(html, /href="\/ht\/hub\/community\/\?"/);
  assert.doesNotMatch(html, /campus-stats|campus-classroom-shortcut|Your next steps|Keep your next step in sight/);
});

test('Today labels the next class Today or Tomorrow, and a date after that', () => {
  const at = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 45, 0, 0); return d.toISOString(); };
  const render = (days) => {
    const state = base(), courseId = 'course-1', cohortId = 'cohort-1';
    state.courses = [{ id: courseId, title: 'AI Literacy', status: 'published' }];
    state.enrollments = [{ course_id: courseId, user_id: 'learner' }];
    state.cohorts = [{ id: cohortId, title: 'First-Year Scholars', course_id: courseId, status: 'active' }];
    state.cohort_members = [{ cohort_id: cohortId, user_id: 'learner', active: true }];
    state.class_sessions = [{ id: 'class-1', cohort_id: cohortId, title: 'Prompt Lab', status: 'scheduled', starts_at: at(days, 23), ends_at: at(days, 23).replace(/T23:45/, 'T23:59') }];
    return { html: renderStudent('home', context(state)), when: at(days, 23) };
  };
  const today = render(0), tomorrow = render(1), later = render(4);
  assert.match(today.html, /<p>Today · /);
  assert.match(tomorrow.html, /<p>Tomorrow · /);
  assert.match(later.html, new RegExp(`<p>${new Date(later.when).toLocaleDateString('en-US').replace(/\//g, '\\/')} · `));
  assert.match(today.html, /src="\/ht\/img\/student-laptop\.jpg" alt=""/);
});

test('Today community fallback goes to Community when no published event is available', () => {
  const html = renderStudent('home', context(base()));
  assert.match(html, /href="\/ht\/hub\/community\/\?"[^>]*>Meet the community/);
  assert.doesNotMatch(html, /href="\/ht\/hub\/messages\/\?"[^>]*>Meet the community/);
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

test('inbox puts unread conversations first, shows real counts, and scopes every preview to the current member', () => {
  const state = base();
  state.members = [{ user_id: 'older', display_name: 'Older unread', role: 'staff' }, { user_id: 'newer', display_name: 'Newest read', role: 'student' }];
  state.messages = [
    { id: 'unread-1', sender_id: 'older', recipient_id: 'learner', body: 'A message for you', created_at: start, read_at: null },
    { id: 'unread-2', sender_id: 'older', recipient_id: 'learner', body: 'Another message for you', created_at: start, read_at: null },
    { id: 'read', sender_id: 'newer', recipient_id: 'learner', body: 'A recent read message', created_at: end, read_at: end },
    { id: 'private', sender_id: 'newer', recipient_id: 'older', body: 'Private unrelated content', created_at: end, read_at: null },
  ];
  const html = renderStudent('messages', context(state));
  assert.ok(html.indexOf('Message Older unread, 2 unread') < html.indexOf('Message Newest read'));
  assert.match(html, /data-recipient-id="older"/);
  assert.match(html, /data-campus-message-id="unread-1" data-campus-message-unread/);
  assert.doesNotMatch(html, /Private unrelated content/);
  assert.doesNotMatch(html, /Online now|Seen by|Read by|Typing/);
  for (const view of ['home', 'community']) {
    const preview = renderStudent(view, context(state));
    assert.match(preview, /Message Older unread, 2 unread/);
    assert.doesNotMatch(preview, /Private unrelated content/);
  }
  state.mode = 'guest'; state.user = null; state.member = null;
  for (const view of ['home', 'community', 'messages']) {
    const preview = renderStudent(view, context(state));
    assert.doesNotMatch(preview, /A message for you|Another message for you|A recent read message|Private unrelated content/);
  }
});

test('inbox deep links select only an active available recipient and directory is explicit', () => {
  const previous = globalThis.location;
  const state = base();
  state.members = [{ user_id: 'staff', display_name: 'Morgan T.', role: 'staff' }];
  try {
    globalThis.location = { href: 'http://localhost/ht/hub/people/?person=staff' };
    let html = renderStudent('people', context(state));
    assert.match(html, /campus-messages-layout is-thread/);
    assert.match(html, /Back to messages/);
    assert.match(html, /Your message to Morgan T\./);
    assert.match(html, /data-recipient-id="staff"/);
    globalThis.location.href = 'http://localhost/ht/hub/messages/?person=not-available';
    html = renderStudent('messages', context(state));
    assert.match(html, /This conversation isn’t available/);
    assert.doesNotMatch(html, /data-campus-command="sendMessage"/);
    globalThis.location.href = 'http://localhost/ht/hub/messages/?new=1';
    html = renderStudent('messages', context(state));
    assert.match(html, /campus-messages-layout is-directory/);
    assert.match(html, /Find a campus member/);
    assert.match(html, /data-campus-person="staff"/);
  } finally { if (previous === undefined) delete globalThis.location; else globalThis.location = previous; }
});

test('community filters keep all posts accessible and add direct author messaging', () => {
  const previous = globalThis.location;
  const state = base();
  state.members = [{ user_id: 'staff', display_name: 'Morgan T.', role: 'staff' }];
  state.posts = [{ id: 'question', author_id: 'staff', body: 'Campus question', channel: 'Questions', created_at: start }, { id: 'win', author_id: 'learner', body: 'Campus win', channel: 'Celebrations', created_at: end }];
  try {
    globalThis.location = { href: 'http://localhost/ht/hub/community/?channel=Questions' };
    const html = renderStudent('community', context(state));
    assert.match(html, /data-campus-channel="Questions" aria-pressed="true"/);
    assert.match(html, /data-campus-post hidden data-channel="Celebrations"/);
    assert.match(html, /data-campus-post data-channel="Questions"/);
    assert.match(html, /href="\/ht\/hub\/messages\/\?person=staff" aria-label="Message Morgan T\."/);
    assert.match(html, /data-campus-feed-count>1 post/);
    assert.match(html, /Community feed/);
    state.members[0].active = false;
    assert.doesNotMatch(renderStudent('community', context(state)), /class="campus-post-message"/, 'inactive authors cannot start a new direct conversation');
  } finally { if (previous === undefined) delete globalThis.location; else globalThis.location = previous; }
});

test('a removed directory member keeps only the caller’s history accessible with sending disabled', () => {
  const previous = globalThis.location, state = base();
  state.members = [{ user_id: 'inactive', display_name: 'A removed private name', active: false, role: 'staff' }];
  state.messages = [
    { id: 'incoming', sender_id: 'inactive', recipient_id: 'learner', body: 'Your earlier campus conversation.', created_at: start, read_at: null },
    { id: 'outgoing', sender_id: 'learner', recipient_id: 'inactive', body: 'My earlier response.', created_at: end, read_at: null },
    { id: 'unrelated', sender_id: 'inactive', recipient_id: 'someone-else', body: 'Unrelated private history.', created_at: end, read_at: null },
  ];
  try {
    globalThis.location = { href: 'http://localhost/ht/hub/messages/?person=inactive' };
    let html = renderStudent('messages', context(state));
    assert.match(html, /campus-messages-layout is-thread/);
    assert.match(html, /View conversation with Unavailable campus member, 1 unread/);
    assert.match(html, /Your earlier campus conversation\./);
    assert.match(html, /My earlier response\./);
    assert.match(html, /data-campus-message-id="incoming" data-campus-message-unread/);
    assert.match(html, /<textarea[^>]+ disabled>/);
    assert.match(html, /<button type="submit" class="campus-button" disabled>Send message/);
    assert.match(html, /Your conversation history stays here/);
    assert.doesNotMatch(html, /A removed private name|Unrelated private history/);
    state.members = [];
    html = renderStudent('messages', context(state));
    assert.match(html, /Your earlier campus conversation\./, 'complete removal from the directory retains the caller’s own history');
    globalThis.location.href = 'http://localhost/ht/hub/messages/?person=unrelated-person';
    html = renderStudent('messages', context(state));
    assert.match(html, /This conversation isn’t available/);
    assert.doesNotMatch(html, /data-recipient-id="unrelated-person"/);
    globalThis.location.href = 'http://localhost/ht/hub/messages/?new=1';
    html = renderStudent('messages', context(state));
    assert.doesNotMatch(html, /data-campus-person="inactive"/);
  } finally { if (previous === undefined) delete globalThis.location; else globalThis.location = previous; }
});

test('read acknowledgement is limited to incoming IDs in the visible conversation and runs once per batch', async () => {
  const original = Object.fromEntries(['window', 'document', 'location', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  const frames = [], calls = [], state = base(), api = {};
  state.messages = [
    { id: 'visible', sender_id: 'staff', recipient_id: 'learner', read_at: null },
    { id: 'new-unrendered', sender_id: 'staff', recipient_id: 'learner', read_at: null },
    { id: 'outgoing', sender_id: 'learner', recipient_id: 'staff', read_at: null },
    { id: 'other-thread', sender_id: 'other', recipient_id: 'learner', read_at: null },
  ];
  let visible = false;
  const conversation = { dataset: { campusOpenPerson: 'staff' }, getClientRects: () => visible ? [{}] : [], querySelectorAll: () => [{ dataset: { campusMessageId: 'visible' } }, { dataset: { campusMessageId: 'outgoing' } }, { dataset: { campusMessageId: 'other-thread' } }] };
  const root = { isConnected: true, addEventListener() {}, removeEventListener() {}, querySelector: (selector) => selector === '[data-campus-open-person]' ? conversation : null };
  const ctx = { ...context(state), api, run: async (...args) => { calls.push(args); return true; } };
  let cleanup;
  try {
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    globalThis.location = { href: 'http://localhost/ht/hub/messages/' };
    globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
    globalThis.cancelAnimationFrame = () => {};
    cleanup = bindStudent('people', root, ctx); frames.shift()(); cleanup();
    assert.equal(calls.length, 0, 'hidden phone preview must stay unread');
    visible = true;
    cleanup = bindStudent('people', root, ctx); frames.shift()(); cleanup();
    assert.equal(calls.length, 0, 'the desktop inbox preview also waits for an explicit conversation open');
    globalThis.location.href = 'http://localhost/ht/hub/messages/?person=staff';
    cleanup = bindStudent('people', root, ctx); frames.shift()(); cleanup();
    assert.deepEqual(calls, [['readMessages', { message_ids: ['visible'] }]], 'capture only rendered incoming IDs from this thread');
    cleanup = bindStudent('people', root, ctx); frames.shift()(); cleanup();
    assert.equal(calls.length, 1, 'a state refresh cannot retry the same batch in a loop');
    globalThis.document.hidden = true;
    state.messages.push({ id: 'newer', sender_id: 'staff', recipient_id: 'learner', read_at: null });
    conversation.querySelectorAll = () => [{ dataset: { campusMessageId: 'newer' } }];
    cleanup = bindStudent('people', root, ctx); frames.shift()(); cleanup();
    assert.equal(calls.length, 1, 'a background tab does not mark messages read');
  } finally {
    cleanup?.();
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test('a failed read acknowledgement retries on a later bind without immediately looping', async () => {
  const original = Object.fromEntries(['window', 'document', 'location', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  let cleanup;
  try {
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    globalThis.location = { href: 'http://localhost/ht/hub/messages/?person=staff' };
    globalThis.cancelAnimationFrame = () => {};
    for (const failure of ['false', 'rejection']) {
      const frames = [], calls = [], state = base();
      state.messages = [{ id: 'unread', sender_id: 'staff', recipient_id: 'learner', read_at: null }];
      const conversation = { dataset: { campusOpenPerson: 'staff' }, getClientRects: () => [{}], querySelectorAll: () => [{ dataset: { campusMessageId: 'unread' } }] };
      const root = { isConnected: true, addEventListener() {}, removeEventListener() {}, querySelector: (selector) => selector === '[data-campus-open-person]' ? conversation : null };
      const ctx = { ...context(state), api: {}, run: async (...args) => {
        calls.push(args);
        if (calls.length > 1) return true;
        if (failure === 'rejection') throw new Error('Temporary connection failure');
        return false;
      } };
      globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
      cleanup = bindStudent('people', root, ctx); frames.shift()();
      await Promise.resolve();
      assert.equal(calls.length, 1, `${failure}: the initial request is attempted once`);
      assert.equal(frames.length, 0, `${failure}: failure does not schedule an immediate retry`);
      cleanup();
      cleanup = bindStudent('people', root, ctx); frames.shift()();
      await Promise.resolve();
      assert.deepEqual(calls, [['readMessages', { message_ids: ['unread'] }], ['readMessages', { message_ids: ['unread'] }]], `${failure}: a later bind can acknowledge the still-unread batch`);
      cleanup();
      cleanup = bindStudent('people', root, ctx); frames.shift()();
      await Promise.resolve();
      assert.equal(calls.length, 2, `${failure}: successful acknowledgement keeps batch deduplication`);
      cleanup();
    }
  } finally {
    cleanup?.();
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
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
    const aiCourse = '20000000-0000-4000-8000-000000000001';
    const aiSection = (html) => html.slice(html.indexOf(`id="course-${aiCourse}"`)).split('<section class="campus-panel campus-course"')[0];
    const modules = state.modules.filter((item) => item.course_id === aiCourse).sort((a, b) => a.position - b.position);
    for (const module of modules.filter((item) => item.question)) await student.command('completeModule', { module_id: module.id, answer_index: module.answer_index });
    state = await student.load();
    assert.match(renderStudent('learn', context(state)), /2 of 3 modules complete/);
    await student.command('submitWork', { module_id: modules[2].id, body: 'My project outlines a useful prompt, checks the result, and explains what I learned.' });
    state = await student.load();
    assert.match(renderStudent('learn', context(state)), /Awaiting instructor review/);
    assert.doesNotMatch(aiSection(renderStudent('learn', context(state))), /Download record/);
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

test('Today lists the published assignment due date and Learn shows the earned Career Ready badge', async () => {
  const storeSource = fs.readFileSync(new URL('../../ht/hub/campus-store.js', import.meta.url), 'utf8');
  const { createCampusStore } = await import(`data:text/javascript;base64,${Buffer.from(storeSource).toString('base64')}`);
  const saved = new Map();
  const student = createCampusStore({ demoRole: 'student', storage: { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) } });
  try {
    const state = await student.load();
    const home = renderStudent('home', context(state));
    assert.match(home, /Responsible AI project brief/);
    assert.match(home, />Due</);
    assert.match(home, /tab=assignments&amp;assignment=d0000000-0000-4000-8000-000000000001/);
    assert.match(home, /AI Literacy · First-Year Scholars/);
    assert.match(home, /Course: AI Literacy: From Curiosity to Practice/);
    assert.match(home, /\/ht\/img\/student-laptop\.jpg/);
    assert.doesNotMatch(home, /commencement\.jpg/);
    const learn = renderStudent('learn', context(state));
    assert.match(learn, /data-state="earned"[\s\S]*?Career Ready/);
    assert.match(learn, /data-credential-uuid="c7000000-0000-4000-8000-000000000001"/);
    assert.match(learn, />HT-CR-\d{4}-0001<\/code>/);
    assert.doesNotMatch(learn, /<code[^>]*>c7000000/);
    assert.doesNotMatch(learn, /campus-page-intro/);
    assert.match(learn, /See career portfolio/);
    assert.match(learn, /<section class="campus-panel badge-shelf" id="badges"/);
    assert.match(learn, /<img class="badge-record-wordmark" src="\/ht\/img\/ht-wordmark-maroon-900\.png" alt="Huston-Tillotson University"/);
    assert.doesNotMatch(learn, /Add to my career portfolio/);
    assert.doesNotMatch(learn, /Available · Sample<\/p><h3>Career Ready/);
  } finally { student.destroy(); }
});
