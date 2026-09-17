// node --test tests/opil/help.test.mjs — need help outside class: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, TRACK_WORD, trackFor, trackWord, cleanHelpText, ago, helpStatusCopy, queueStatusCopy, homeNoteCopy, sortHelp, queueBuckets, queueCount, teamRoomPath, sendHelp, sendErrorCopy, NOT_REGISTERED_COPY, SEND_FAILED_COPY, pingHelp, sentCopy, formHTML, requestHTML, create, helpKeyFor, MAX_TEXT } from '../../js/rtk-help.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NOW = Date.parse('2026-09-17T15:00:00Z');
const rows = [
  { id: 'a', status: 'open', track: 'payments', text: 'My wallet never verifies.', created_at: '2026-09-17T14:55:00Z', updated_at: '2026-09-17T14:55:00Z', claimed_name: null, answer: null, pinged_at: '2026-09-17T14:55:10Z' },
  { id: 'b', status: 'claimed', track: 'business', text: 'Pricing?', created_at: '2026-09-17T12:00:00Z', updated_at: '2026-09-17T13:00:00Z', claimed_name: 'Jarrell Smith', answer: null, pinged_at: '2026-09-17T12:00:05Z' },
  { id: 'c', status: 'answered', track: 'hpc', text: 'How do I get cluster time?', created_at: '2026-09-16T10:00:00Z', updated_at: '2026-09-16T18:00:00Z', claimed_name: 'Ashley', answer: 'Use the request form in session H1.', answer_sent_at: '2026-09-16T18:00:10Z' },
  { id: 'd', status: 'closed', track: 'hub', text: 'Link broken', created_at: '2026-09-10T10:00:00Z', updated_at: '2026-09-11T10:00:00Z', claimed_name: 'Nelson Taylor', answer: 'Fixed.' },
];

test('the four tracks, in the order students read them, each with a plain-English hint', () => {
  assert.deepEqual(TRACKS.map(t => t.key), ['business', 'payments', 'hpc', 'hub']);
  assert.equal(TRACK_WORD.payments, 'Open payments track');
  TRACKS.forEach(t => { assert.ok(t.hint.length > 10); assert.ok(!/supabase|resend|rpc/i.test(t.label + t.hint)); });
  assert.equal(trackWord('hpc'), 'HPC series');
  assert.equal(trackWord('nope'), 'the program');
});

test('trackFor: a label, a session title or a key → the track; nothing recognisable → null', () => {
  assert.equal(trackFor('Casey Diké · Track 2'), 'payments');
  assert.equal(trackFor('Jarrell — Business'), 'business');
  assert.equal(trackFor('Ashley · HPC'), 'hpc');
  assert.equal(trackFor('Interledger and open payments 101'), 'payments');
  assert.equal(trackFor('High-performance computing: your data'), 'hpc');
  assert.equal(trackFor('Signing in to the hub'), 'hub');
  assert.equal(trackFor('payments'), 'payments');   /* a key is itself */
  assert.equal(trackFor('Kickoff & Orientation'), null);
  assert.equal(trackFor(''), null);
  assert.equal(trackFor(undefined), null);
});

test('cleanHelpText trims, normalises line ends and caps at 2000', () => {
  assert.equal(cleanHelpText('  hi\r\nthere  '), 'hi\nthere');
  assert.equal(cleanHelpText(null), '');
  assert.equal(cleanHelpText('x'.repeat(3000)).length, MAX_TEXT);
});

test('ago reads like a person', () => {
  assert.equal(ago('2026-09-17T14:59:40Z', NOW), 'just now');
  assert.equal(ago('2026-09-17T14:55:00Z', NOW), '5 min ago');
  assert.equal(ago('2026-09-17T14:00:00Z', NOW), '1 hour ago');
  assert.equal(ago('2026-09-17T12:00:00Z', NOW), '3 hours ago');
  assert.equal(ago('2026-09-16T14:00:00Z', NOW), 'yesterday');
  assert.equal(ago('2026-09-14T14:00:00Z', NOW), '3 days ago');
  assert.equal(ago('2026-09-01T14:00:00Z', NOW), 'Sep 1');
  assert.equal(ago(null, NOW), '');
  assert.equal(ago('garbage', NOW), '');
});

test('helpStatusCopy: one sentence per state, named after the person who took it', () => {
  assert.equal(helpStatusCopy(rows[0]), 'Sent. A facilitator will email you back — the answer also shows up here.');
  assert.equal(helpStatusCopy(rows[1]), 'Jarrell Smith is on it — you will get an email.');
  assert.equal(helpStatusCopy(rows[2]), 'Ashley answered your question.');
  assert.equal(helpStatusCopy(rows[3]), 'Nelson Taylor answered this, and it is closed.');
  assert.equal(helpStatusCopy({ status: 'closed' }), 'This one is closed.');
  assert.equal(helpStatusCopy({ status: 'claimed' }), 'A facilitator is on it — you will get an email.');
  assert.equal(helpStatusCopy(null), 'Sent. A facilitator will email you back — the answer also shows up here.');
});

test('queueStatusCopy: the coordinator sees who has it, when, and whether the emails went', () => {
  assert.equal(queueStatusCopy(rows[0], NOW), 'Waiting for someone to claim it · asked 5 min ago');
  assert.equal(queueStatusCopy({ ...rows[0], pinged_at: null }, NOW), 'Waiting for someone to claim it · asked 5 min ago · facilitators not emailed yet');
  assert.equal(queueStatusCopy(rows[1], NOW), 'Jarrell Smith claimed this · 2 hours ago');
  assert.equal(queueStatusCopy(rows[2], NOW), 'Ashley answered · 21 hours ago · emailed');
  assert.equal(queueStatusCopy({ ...rows[2], answer_sent_at: null }, NOW), 'Ashley answered · 21 hours ago · email not sent yet');
  assert.equal(queueStatusCopy(rows[3], NOW), 'Closed · 6 days ago');
});

test('homeNoteCopy: the newest answer wins, then a claim, then what is waiting, else nothing', () => {
  assert.equal(homeNoteCopy(rows), 'Ashley answered your question.');
  assert.equal(homeNoteCopy([rows[0], rows[1]]), 'Jarrell Smith is on your question.');
  assert.equal(homeNoteCopy([rows[0]]), 'Your request is in — a facilitator will email you back.');
  assert.equal(homeNoteCopy([rows[0], { ...rows[0], id: 'e' }]), '2 requests are in — a facilitator will email you back.');
  assert.equal(homeNoteCopy([rows[3]]), '');
  assert.equal(homeNoteCopy([]), '');
  const two = [{ ...rows[2], updated_at: '2026-09-16T18:00:00Z', claimed_name: 'Ashley' }, { ...rows[2], id: 'f', updated_at: '2026-09-17T09:00:00Z', claimed_name: 'Casey Diké' }];
  assert.equal(homeNoteCopy(two), 'Casey Diké answered your question.');
  /* an answer the student has already opened is no longer news; the next unseen one (or the claim) speaks */
  assert.equal(homeNoteCopy(two, new Set(['f'])), 'Ashley answered your question.');
  assert.equal(homeNoteCopy(two, ['f', 'c']), '');
  assert.equal(homeNoteCopy(rows, ['c']), 'Jarrell Smith is on your question.');
});

test('sendErrorCopy: a refused insert (42501 / policy) says you are not registered, anything else blames the connection', () => {
  assert.equal(sendErrorCopy({ code: '42501', message: 'new row violates row-level security policy for table "ea_class_help"' }), NOT_REGISTERED_COPY);
  assert.equal(sendErrorCopy({ message: 'violates row-level security' }), NOT_REGISTERED_COPY);
  assert.equal(sendErrorCopy({ code: 'PGRST301', message: 'boom' }), SEND_FAILED_COPY);
  assert.equal(sendErrorCopy(new Error('offline')), SEND_FAILED_COPY);
  assert.equal(sendErrorCopy(null), SEND_FAILED_COPY);
  assert.ok(/taylormademd@gmail.com/.test(NOT_REGISTERED_COPY));
});

test('sortHelp newest first; queueBuckets splits the lists and counts the closed; queueCount = open + claimed', () => {
  assert.deepEqual(sortHelp(rows.slice().reverse()).map(r => r.id), ['a', 'b', 'c', 'd']);
  const b = queueBuckets(rows);
  assert.deepEqual(b.open.map(r => r.id), ['a']); assert.deepEqual(b.claimed.map(r => r.id), ['b']); assert.deepEqual(b.answered.map(r => r.id), ['c']); assert.equal(b.closed, 1);
  assert.equal(queueCount(rows), 2);
  assert.equal(queueCount([]), 0);
});

test('helpKeyFor: an OPIL session keeps its key; a team room or a bare room files under the hub', () => {
  assert.equal(helpKeyFor('opil:12'), 'opil:12');
  assert.equal(helpKeyFor('opil:hub'), 'opil:hub');
  assert.equal(helpKeyFor('team:9b1d'), 'opil:hub');
  assert.equal(helpKeyFor('room:abc'), 'opil:hub');
  assert.equal(helpKeyFor(undefined), 'opil:hub');
});

test('teamRoomPath links the quick room, or nothing without a team', () => {
  assert.equal(teamRoomPath('9b1d-team'), '/opil/hub/team/room/?t=9b1d-team');
  assert.equal(teamRoomPath(null), null);
});

test('sendHelp refuses an empty text or a bad track with a sentence, inserts otherwise, never throws', async () => {
  const inserted = [];
  const sb = { from: (t) => ({ insert: (row) => ({ select: () => ({ single: async () => { inserted.push([t, row]); return { data: { id: 'new', ...row }, error: null }; } }) }) }) };
  assert.deepEqual(await sendHelp(sb, { track: 'payments', text: '   ' }), { error: 'Write a sentence or two about what you need.' });
  assert.deepEqual(await sendHelp(sb, { track: 'nope', text: 'hi' }), { error: 'Pick which track this is about first.' });
  const ok = await sendHelp(sb, { track: 'payments', text: ' help \r\n' });
  assert.equal(ok.row.id, 'new');
  assert.deepEqual(inserted, [['ea_class_help', { track: 'payments', text: 'help', room_key: 'opil:hub' }]]);
  const bad = { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal((await sendHelp(bad, { track: 'hub', text: 'x' })).error, SEND_FAILED_COPY);
    const refused = { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }) }) }) }) };
    assert.equal((await sendHelp(refused, { track: 'hub', text: 'x' })).error, NOT_REGISTERED_COPY);
  } finally { console.warn = warn; }
});

test('pingHelp posts the session token to the function and reads the reply; no session or no network is said softly', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { calls.push([url, opts]); return { ok: true, json: async () => ({ emailed: true, to: 3 }) }; };
  try {
    const sb = { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } };
    const r = await pingHelp(sb, { FUNCTIONS_BASE: 'https://f.example' }, { id: 'x' });
    assert.deepEqual(r, { ok: true, emailed: true, to: 3 });
    assert.equal(calls[0][0], 'https://f.example/ea-class-help-ping');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer tok');
    assert.equal(calls[0][1].body, '{"id":"x"}');
    const none = { auth: { getSession: async () => ({ data: { session: null } }) } };
    assert.deepEqual(await pingHelp(none, {}, { id: 'x' }), { ok: false, why: 'sign_in' });
    globalThis.fetch = async () => { throw new Error('offline'); };
    const warn = console.warn; console.warn = () => {};
    try { assert.deepEqual(await pingHelp(sb, {}, { id: 'x' }), { ok: false, why: 'unreachable' }); } finally { console.warn = warn; }
  } finally { globalThis.fetch = realFetch; }
});

test('sentCopy: the row is in either way; the sentence says whether the email went', () => {
  assert.equal(sentCopy({ ok: true, emailed: true }), 'Sent. The facilitators have your message — you will get an email back.');
  assert.equal(sentCopy({ ok: true, already: true }), 'Already sent — the facilitators have it.');
  assert.equal(sentCopy({ ok: true, emailed: false, why: 'email_not_set_up' }), 'Saved. The program team sees it on their page; the email did not go out, so it may take a little longer.');
  assert.equal(sentCopy({ ok: false }), 'Saved. The program team sees it on their page; the email did not go out, so it may take a little longer.');
});

test('formHTML / requestHTML: four tracks, a textarea, a Send, and no raw HTML from a student', () => {
  const f = formHTML(esc);
  assert.equal((f.match(/type="radio"/g) || []).length, 4);
  assert.ok(f.includes('class="hh-send"') && f.includes('maxlength="2000"'));
  const dark = formHTML(esc, { dark: true });
  assert.ok(dark.includes('class="r2-help-send"') && !dark.includes('hh-'));
  const r = requestHTML(esc, { id: 'x', track: 'hpc', text: '<b>hi</b>', created_at: new Date().toISOString(), status: 'answered', claimed_name: 'Ashley', answer: '<i>go</i>' });
  assert.ok(!r.includes('<b>hi</b>') && r.includes('&lt;b&gt;hi&lt;/b&gt;'));
  assert.ok(r.includes('&lt;i&gt;go&lt;/i&gt;') && r.includes('Ashley answered your question.') && r.includes('HPC series'));
});

test('create(ctx): no bar button for a host or a room; a student gets "Help later"; stop() removes it — never throws', () => {
  let removed = 0;
  const base = { sb: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }, uid: 'u', esc, el: (h) => ({ html: h, addEventListener() {}, remove() { removed++; } }), bar: { addButton: (h) => base.el(h) }, openSheet() {}, toast() {} };
  const host = create({ ...base, host: true, isRoom: false }); host.start(); host.stop();
  const room = create({ ...base, host: false, isRoom: true }); room.start(); room.stop();
  assert.equal(removed, 0);
  const student = create({ ...base, host: false, isRoom: false }); student.start(); student.stop();
  assert.equal(removed, 1);
  const broken = create({ ...base, host: false, isRoom: false, bar: { addButton: () => { throw new Error('no bar'); } } });
  const warn = console.warn; console.warn = () => {};
  try { assert.doesNotThrow(() => broken.start()); } finally { console.warn = warn; }
});

test('create(ctx): one answer = one toast, even when the page save and the "emailed" mark arrive as two events before any load', async () => {
  const toasts = []; let handler = null;
  const sb = {
    channel: () => ({ on(_ev, _f, cb) { handler = cb; return this; }, subscribe() { return this; } }),
    removeChannel() {},
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }),
  };
  const ctx = { sb, uid: 'u', esc, el: (h) => ({ html: h, addEventListener() {}, remove() {} }), bar: { addButton: (h) => ctx.el(h) }, openSheet() {}, toast: (t) => toasts.push(t), host: false, isRoom: false };
  const plugin = create(ctx); plugin.start();
  assert.equal(typeof handler, 'function');
  handler({ new: { id: 'x', status: 'answered', claimed_name: 'Casey Diké' } });
  handler({ new: { id: 'x', status: 'answered', claimed_name: 'Casey Diké', answer_sent_at: '2026-09-17T15:00:00Z' } });
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(toasts, ['Casey Diké answered your question — it is on your hub home.']);
  handler({ new: { id: 'y', status: 'claimed', claimed_name: 'Casey Diké' } });
  handler({ new: { id: 'y', status: 'answered', claimed_name: 'Casey Diké' } });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(toasts.length, 2);
  plugin.stop();
});
