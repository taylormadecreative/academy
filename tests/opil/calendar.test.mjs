// tests/opil/calendar.test.mjs — run: node --test tests/opil/calendar.test.mjs
// Feature 9 (calendar + reminders): the .ics feed, the half-hour reminder, the hub's Add-to-calendar buttons.
// Node strips the types from the same handler.ts the Deno functions run, so the rules are proved once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  icsText, eventsFor, foldLine, escText, summaryFor, sessionLabel, isHiddenSession, timeMinutes, dateValue, nextDay, localStamp, utcStamp, calendarResponse, roomUrl, HUB_URL,
} from '../../supabase/functions/ea-opil-calendar/handler.ts';
import {
  dueSessions, zonedToUtcMs, offsetAt, clockIn, subjectFor, messagesFor, chunk, secretMatches, handleRemind, KIND, recipientsFromRegistration, doorSentence, RETRY_WAIT_MS,
} from '../../supabase/functions/ea-opil-remind/handler.ts';
import { calendarLinks, buttonsHTML, watchHandoff, WEBCAL_WAIT_MS, FEED_URL } from '../../opil/hub/calendar-buttons.js';

const S = (no, kind, extra = {}) => ({ no, kind, title: 'T' + no, session_date: null, start_time: null, end_time: null, ...extra });
const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);   // 2026-09-16 12:00Z
const KICKOFF = S(1, 'thread', { title: 'Kickoff & Orientation', session_date: '2026-09-16', start_time: '18:30:00', end_time: '19:30:00' });

/* ---------- ICS text ---------- */

test('foldLine leaves a short line alone and folds a long one at 75 octets with a leading space', () => {
  assert.equal(foldLine('SUMMARY:short'), 'SUMMARY:short');
  const long = 'DESCRIPTION:' + 'a'.repeat(200);
  const folded = foldLine(long);
  const lines = folded.split('\r\n');
  assert.equal(lines[0].length, 75);
  for (const l of lines.slice(1)) { assert.equal(l[0], ' ', 'continuation starts with a space'); assert.ok(Buffer.byteLength(l, 'utf8') <= 75, 'every physical line ≤ 75 octets'); }
  assert.equal(lines.map((l, i) => i ? l.slice(1) : l).join(''), long, 'unfolding gives the line back');
});

test('foldLine counts octets, not characters, and never cuts a multi-byte character', () => {
  const line = 'SUMMARY:' + 'é'.repeat(60);             // 8 + 120 octets
  const lines = foldLine(line).split('\r\n');
  for (const l of lines) {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `${Buffer.byteLength(l, 'utf8')} octets`);
    assert.ok(!l.includes('�'));
    assert.equal(Buffer.from(l, 'utf8').toString('utf8'), l, 'round-trips as valid UTF-8');
  }
  assert.equal(lines.map((l, i) => i ? l.slice(1) : l).join(''), line);
  const emoji = 'X:' + '🎓'.repeat(30);                   // 4-octet characters
  for (const l of foldLine(emoji).split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75);
});

test('escText escapes backslash, semicolon, comma and newlines the RFC 5545 way', () => {
  assert.equal(escText('a;b,c\\d\ne\r\nf'), 'a\\;b\\,c\\\\d\\ne\\nf');
  assert.equal(escText(null), '');
});

test('labels read as plain English: Kickoff, Session 3, HPC 1; a milestone has no label', () => {
  assert.equal(sessionLabel(S(1, 'thread')), 'Kickoff');
  assert.equal(sessionLabel(S(203, 'curriculum')), 'Session 3');
  assert.equal(sessionLabel(S(301, 'hpc')), 'HPC 1');
  assert.equal(sessionLabel(S(12, 'milestone')), '');
  assert.equal(summaryFor(S(203, 'curriculum', { title: 'Open payments 101' })), 'OPIL · Session 3 · Open payments 101');
  assert.equal(summaryFor(S(12, 'milestone', { title: 'Demo Day' })), 'OPIL · Demo Day');
  assert.equal(summaryFor(S(9, 'curriculum', { title: '' })), 'OPIL · Session 9 · OPIL session');
});

test('hidden test rooms (thread 02–14) never reach a calendar; the kickoff does', () => {
  assert.equal(isHiddenSession(S(1, 'thread')), false);
  assert.equal(isHiddenSession(S(2, 'thread')), true);
  assert.equal(isHiddenSession(S(14, 'thread')), true);
  assert.equal(isHiddenSession(S(201, 'curriculum')), false);
  const ev = eventsFor([KICKOFF, S(2, 'thread', { session_date: '2026-09-21', start_time: '18:30' })]);
  assert.deepEqual(ev.map(e => e.no), [1]);
});

test('date helpers', () => {
  assert.equal(dateValue('2026-09-16'), '20260916');
  assert.equal(dateValue('nope'), null);
  assert.equal(timeMinutes('18:30:00'), 1110);
  assert.equal(timeMinutes('6:05'), 365);
  assert.equal(timeMinutes('25:00'), null);
  assert.equal(timeMinutes(null), null);
  assert.equal(nextDay('2026-12-31'), '20270101');
  assert.equal(localStamp('2026-09-16', 1110), '20260916T183000');
  assert.equal(utcStamp(NOW), '20260916T120000Z');
});

test('a timed class is a TZID event; no end time = one hour; end before start = one hour', () => {
  const [a] = eventsFor([KICKOFF]);
  assert.equal(a.allDay, false);
  assert.equal(a.start, '20260916T183000');
  assert.equal(a.end, '20260916T193000');
  assert.equal(a.uid, 'opil-1@taylormadeacademy.com');
  assert.equal(a.location, roomUrl(1));
  assert.equal(a.url, 'https://taylormadeacademy.com/opil/hub/live/?s=1');
  const [b] = eventsFor([S(201, 'curriculum', { session_date: '2026-10-07', start_time: '18:30' })]);
  assert.equal(b.end, '20261007T193000');
  const [c] = eventsFor([S(201, 'curriculum', { session_date: '2026-10-07', start_time: '18:30', end_time: '18:00' })]);
  assert.equal(c.end, '20261007T193000');
});

test('a milestone and a class without a time are all-day events; a session with no date is left out', () => {
  const ev = eventsFor([
    S(12, 'milestone', { title: 'Demo Day', session_date: '2027-04-20' }),
    S(202, 'curriculum', { title: 'TBA', session_date: '2026-10-14' }),
    S(203, 'curriculum', { title: 'No date' }),
  ]);
  assert.equal(ev.length, 2);
  const mile = ev.find(e => e.no === 12), tba = ev.find(e => e.no === 202);
  assert.equal(mile.allDay, true); assert.equal(mile.start, '20270420'); assert.equal(mile.end, '20270421');
  assert.equal(mile.location, null); assert.equal(mile.url, HUB_URL);
  assert.equal(tba.allDay, true); assert.match(tba.description, /Time to be announced/); assert.equal(tba.location, roomUrl(202));
});

test('events come out in date order, ties by number', () => {
  const ev = eventsFor([
    S(301, 'hpc', { session_date: '2026-11-04', start_time: '18:30' }),
    S(12, 'milestone', { session_date: '2026-10-01' }),
    S(202, 'curriculum', { session_date: '2026-10-01', start_time: '18:30' }),
    KICKOFF,
  ]);
  assert.deepEqual(ev.map(e => e.no), [1, 12, 202, 301]);
});

test('icsText is a complete VCALENDAR: CRLF, the calendar name, a VTIMEZONE for New York, one VEVENT per session', () => {
  const ics = icsText([KICKOFF, S(12, 'milestone', { title: 'Demo Day', session_date: '2027-04-20' })], NOW);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/(^|[^\r])\n/.test(ics), 'every line break is CRLF');
  assert.ok(ics.includes('X-WR-CALNAME:OPIL 2026–27\r\n'));
  assert.ok(ics.includes('BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU'));
  assert.ok(ics.includes('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART;TZID=America/New_York:20260916T183000\r\n'));
  assert.ok(ics.includes('DTEND;TZID=America/New_York:20260916T193000\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270420\r\nDTEND;VALUE=DATE:20270421\r\n'));
  assert.ok(ics.includes('DTSTAMP:20260916T120000Z\r\n'));
  assert.ok(ics.includes('SUMMARY:OPIL · Kickoff · Kickoff & Orientation\r\n'));
  assert.ok(ics.includes('LOCATION:https://taylormadeacademy.com/opil/hub/live/?s=1\r\n'));
  assert.ok(ics.includes('URL:https://taylormadeacademy.com/opil/hub/live/?s=1\r\n'));
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `line over 75 octets: ${l}`);
});

test('a title with commas and semicolons is escaped in the feed, and a long description folds', () => {
  const ics = icsText([S(201, 'curriculum', { title: 'Money, movement; and you', session_date: '2026-10-07', start_time: '18:30', outcome: 'x'.repeat(120) })], NOW);
  assert.ok(ics.includes('SUMMARY:OPIL · Session 1 · Money\\, movement\\; and you\r\n'));
  const desc = ics.split('\r\n').filter(l => l.startsWith('DESCRIPTION:') || l.startsWith(' '));
  assert.ok(desc.length >= 3, 'the description folds over several physical lines');
  assert.equal(desc[0], 'DESCRIPTION:Join the class room: https://taylormadeacademy.com/opil/hub/liv');
  assert.ok(desc.map((l, i) => i ? l.slice(1) : l).join('').includes('https://taylormadeacademy.com/opil/hub/live/?s=201\\nNo code needed'), 'unfolds back to the link');
  assert.ok(desc.map((l, i) => i ? l.slice(1) : l).join('').includes('\\n' + 'x'.repeat(120)), 'the outcome is on its own line inside the description');
});

test('the same input gives the same feed (stable UIDs — a subscribed calendar updates in place)', () => {
  const a = icsText([KICKOFF], NOW), b = icsText([KICKOFF], NOW);
  assert.equal(a, b);
  assert.ok(a.includes('UID:opil-1@taylormadeacademy.com\r\n'));
});

test('calendarResponse: text/calendar, cached ten minutes, a filename only for the download button', () => {
  const r = calendarResponse([KICKOFF], NOW, false);
  assert.equal(r.status, 200);
  assert.equal(r.headers['Content-Type'], 'text/calendar; charset=utf-8');
  assert.equal(r.headers['Cache-Control'], 'public, max-age=600');
  assert.equal(r.headers['Content-Disposition'], undefined);
  const d = calendarResponse([KICKOFF], NOW, true);
  assert.equal(d.headers['Content-Disposition'], 'attachment; filename="opil-2026-27.ics"');
  assert.equal(d.body, r.body);
});

/* ---------- reminders ---------- */

test('zonedToUtcMs: 6:30 PM in Atlanta is 22:30Z in September (EDT) and 23:30Z in December (EST)', () => {
  assert.equal(zonedToUtcMs('2026-09-16', '18:30:00'), Date.UTC(2026, 8, 16, 22, 30));
  assert.equal(zonedToUtcMs('2026-12-02', '18:30'), Date.UTC(2026, 11, 2, 23, 30));
  assert.equal(zonedToUtcMs('2026-09-16', null), null);
  assert.equal(zonedToUtcMs(null, '18:30'), null);
  assert.equal(offsetAt(Date.UTC(2026, 6, 1), 'America/New_York'), -4 * 3600 * 1000);
  assert.equal(offsetAt(Date.UTC(2026, 0, 1), 'America/New_York'), -5 * 3600 * 1000);
});

test('clockIn and subjectFor say the hour the way the spec does', () => {
  const t = zonedToUtcMs('2026-09-16', '18:30');
  assert.equal(clockIn(t, 'America/New_York'), '6:30 PM');
  assert.equal(clockIn(t, 'America/Chicago'), '5:30 PM');
  assert.equal(subjectFor(t), 'Class starts at 6:30 PM ET — here’s your link');
});

test('dueSessions: only classes 25–35 minutes out, not yet reminded, with a time; never milestones or hidden rooms', () => {
  const start = zonedToUtcMs('2026-09-16', '18:30');
  const sessions = [
    KICKOFF,
    S(12, 'milestone', { session_date: '2026-09-16', start_time: '18:30' }),
    S(2, 'thread', { session_date: '2026-09-16', start_time: '18:30' }),
    S(201, 'curriculum', { session_date: '2026-09-16' }),
    S(202, 'curriculum', { session_date: '2026-09-16', start_time: '18:35' }),
  ];
  const at = (min) => start - min * 60000;
  assert.deepEqual(dueSessions(sessions, [], at(30)).map(d => d.roomKey), ['opil:1', 'opil:202']);
  assert.deepEqual(dueSessions(sessions, [], at(25)).map(d => d.roomKey), ['opil:1', 'opil:202']);
  assert.deepEqual(dueSessions(sessions, [], at(35)).map(d => d.roomKey), ['opil:1']);
  assert.deepEqual(dueSessions(sessions, [], at(24)).map(d => d.roomKey), ['opil:202']);
  assert.deepEqual(dueSessions(sessions, [], at(36)).map(d => d.roomKey), []);
  assert.deepEqual(dueSessions(sessions, [], at(-5)).map(d => d.roomKey), []);
  assert.deepEqual(dueSessions(sessions, ['opil:1'], at(30)).map(d => d.roomKey), ['opil:202']);
  assert.equal(dueSessions(sessions, [], at(30))[0].minutesAway, 30);
});

const mailDeps = { layout: (o) => `<h1>${o.heading}</h1>${o.body}<foot>${o.foot || ''}</foot>`, button: (h, l) => `<a href="${h}">${l}</a>`, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };

test('messagesFor: one email per address, deduped case-insensitively, with the link and the no-code sentence', () => {
  const [due] = dueSessions([KICKOFF], [], zonedToUtcMs('2026-09-16', '18:30') - 30 * 60000);
  const msgs = messagesFor(due, [
    { email: 'Kiara1.Pee@FAMU.edu', name: 'Kiara Pee' },
    { email: 'kiara1.pee@famu.edu', name: 'Kiara Pee' },
    { email: 'casey@blazegroupllc.com', name: 'Casey' },
    { email: 'not an email', name: 'x' },
    { email: '', name: 'y' },
  ], mailDeps);
  assert.deepEqual(msgs.map(m => m.to), ['kiara1.pee@famu.edu', 'casey@blazegroupllc.com']);
  assert.equal(msgs[0].subject, 'Class starts at 6:30 PM ET — here’s your link');
  assert.ok(msgs[0].html.includes('https://taylormadeacademy.com/opil/hub/live/?s=1'));
  assert.ok(msgs[0].html.includes('No code needed — type the email you applied with'));
  assert.ok(msgs[0].html.includes('Hi Kiara,'));
  assert.ok(msgs[0].html.includes('6:30 PM ET'));
  assert.ok(msgs[0].html.includes('5:30 PM CT'));
  assert.ok(msgs[0].html.includes('<h1>Kickoff & Orientation starts at 6:30 PM ET</h1>'), 'the heading is the title + the ET hour (the real layout escapes it)');
  assert.ok(msgs[0].html.includes('<b>Kickoff &amp; Orientation</b>'), 'the title is escaped inside the body');
});

test('recipientsFromRegistration: the lead (both addresses) plus every teammate in members; odd shapes are skipped', () => {
  const row = { email: 'lead@famu.edu', personal_email: 'lead@gmail.com', full_name: 'Lead Person', members: [
    { name: 'Mate Two', email: 'two@famu.edu', classification: 'Junior' },
    { name: 'Mate Three', email: 'three@famu.edu' },
    { name: 'No address' },
    'garbage', null, { email: 42 },
  ] };
  const r = recipientsFromRegistration(row);
  assert.deepEqual(r.map(x => [x.email, x.kind, x.name]), [
    ['lead@famu.edu', 'student', 'Lead Person'], ['lead@gmail.com', 'student', 'Lead Person'],
    ['two@famu.edu', 'teammate', 'Mate Two'], ['three@famu.edu', 'teammate', 'Mate Three'],
  ]);
  assert.deepEqual(recipientsFromRegistration({ email: 'x@y.edu', members: null }).map(x => x.email), ['x@y.edu']);
  assert.deepEqual(recipientsFromRegistration({ email: 'x@y.edu', members: 'nope' }).length, 1);
  assert.deepEqual(recipientsFromRegistration(null), []);
});

test('the door sentence fits the reader: students walk in with their email, facilitators sign in with a code', () => {
  const [due] = dueSessions([KICKOFF], [], zonedToUtcMs('2026-09-16', '18:30') - 30 * 60000);
  const msgs = messagesFor(due, [
    { email: 'student@famu.edu', name: 'Kiara Pee', kind: 'student' },
    { email: 'mate@famu.edu', name: 'Mate Two', kind: 'teammate' },
    { email: 'jamal@auc.edu', name: 'Jamal', kind: 'facilitator' },
    { email: 'legacy@famu.edu', name: 'No kind' },
  ], mailDeps);
  assert.ok(msgs[0].html.includes('No code needed — type the email you applied with and you are in.'));
  assert.ok(msgs[1].html.includes('No code needed — type the email your team listed for you and you are in.'));
  assert.ok(msgs[2].html.includes('You run this class — sign in with the code the page emails you, then press Start class.'));
  assert.ok(!msgs[2].html.includes('No code needed'), 'a facilitator is never promised the no-code door');
  assert.ok(msgs[3].html.includes('No code needed — type the email you applied with'), 'no kind = a student');
  assert.equal(doorSentence(undefined), doorSentence('student'));
});

test('chunk splits at Resend’s batch ceiling', () => {
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assert.equal(chunk(Array.from({ length: 250 }, (_, i) => i)).length, 3);
  assert.deepEqual(chunk([]), []);
});

test('secretMatches: exact match only; an empty expected secret never matches', () => {
  assert.equal(secretMatches('abc', 'abc'), true);
  assert.equal(secretMatches('abd', 'abc'), false);
  assert.equal(secretMatches('ab', 'abc'), false);
  assert.equal(secretMatches('', ''), false);
  assert.equal(secretMatches(null, 'abc'), false);
  assert.equal(secretMatches('abc', undefined), false);
});

function remindDeps(over = {}) {
  const log = { claims: [], unclaims: [], batches: [], waits: [] };
  const start = zonedToUtcMs('2026-09-16', '18:30');
  const d = {
    log,
    now: () => start - 30 * 60000,
    listSessions: async () => [KICKOFF, S(12, 'milestone', { session_date: '2026-09-16' })],
    listReminded: async () => [],
    listRecipients: async () => [{ email: 'a@x.edu', name: 'A' }, { email: 'b@x.edu', name: 'B' }, { email: 'A@x.edu' }],
    claim: async (k, kind) => { log.claims.push([k, kind]); return true; },
    unclaim: async (k, kind) => { log.unclaims.push([k, kind]); },
    sendBatch: async (msgs) => { log.batches.push(msgs.map(m => m.to)); return { ok: true, ids: msgs.map(() => 'id') }; },
    wait: async (ms) => { log.waits.push(ms); },
    ...mailDeps,
    ...over,
  };
  return d;
}
const H = (secret) => ({ get: (k) => (k === 'x-remind-secret' ? secret : null) });

test('handleRemind: the right secret sends one batch, claims the room first, and reports what went out', async () => {
  const d = remindDeps();
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.sent, 2);
  assert.deepEqual(d.log.claims, [['opil:1', KIND]]);
  assert.deepEqual(d.log.batches, [['a@x.edu', 'b@x.edu']]);
  assert.equal(r.body.due[0].room_key, 'opil:1');
  assert.equal(r.body.due[0].recipients, 2);
  assert.deepEqual(d.log.unclaims, []);
});

test('handleRemind: wrong secret is 401 and touches nothing; no secret on the function is 503', async () => {
  const d = remindDeps();
  assert.deepEqual(await handleRemind(H('nope'), 's3cret', d), { status: 401, body: { error: 'forbidden' } });
  assert.deepEqual(await handleRemind(H(null), 's3cret', d), { status: 401, body: { error: 'forbidden' } });
  assert.deepEqual(await handleRemind(H('s3cret'), undefined, d), { status: 503, body: { error: 'not_configured' } });
  assert.deepEqual(d.log.claims, []); assert.deepEqual(d.log.batches, []);
});

test('handleRemind: a room another tick already claimed is skipped, not emailed twice', async () => {
  const d = remindDeps({ claim: async () => false });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 0);
  assert.deepEqual(r.body.skipped, [{ room_key: 'opil:1', why: 'already_sent' }]);
  assert.deepEqual(d.log.batches, []);
});

test('handleRemind: when Resend refuses everything (twice) the claim is given back so the next tick retries', async () => {
  const d = remindDeps({ sendBatch: async () => ({ ok: false, ids: [], error: 'resend_500' }) });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 0);
  assert.deepEqual(d.log.unclaims, [['opil:1', KIND]]);
  assert.deepEqual(d.log.waits, [RETRY_WAIT_MS], 'one breath, one retry');
  assert.deepEqual(r.body.skipped, [{ room_key: 'opil:1', why: 'resend_500' }]);
});

test('handleRemind: a chunk that fails once goes out on the retry — nobody is missed', async () => {
  let calls = 0;
  const d = remindDeps({ sendBatch: async (msgs) => { calls++; if (calls === 1) return { ok: false, ids: [], error: 'blip' }; return { ok: true, ids: msgs.map(() => 'id') }; } });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 2);
  assert.equal(r.body.due[0].missed, 0);
  assert.equal(r.body.due[0].partial, undefined);
  assert.deepEqual(d.log.unclaims, []);
});

test('handleRemind: nothing due at the wrong minute', async () => {
  const quiet = remindDeps({ now: () => zonedToUtcMs('2026-09-16', '18:30') - 90 * 60000 });
  const r1 = await handleRemind(H('s3cret'), 's3cret', quiet);
  assert.deepEqual(r1.body, { ok: true, due: [], sent: 0, skipped: [] });
});

test('handleRemind: nobody to email gives the claim back (the list may fill in before the next tick)', async () => {
  const empty = remindDeps({ listRecipients: async () => [] });
  const r = await handleRemind(H('s3cret'), 's3cret', empty);
  assert.deepEqual(r.body.skipped, [{ room_key: 'opil:1', why: 'no_recipients' }]);
  assert.deepEqual(empty.log.unclaims, [['opil:1', KIND]]);
  assert.deepEqual(empty.log.batches, []);
});

test('handleRemind: a recipients lookup that throws gives the claim back — a database blip never burns the reminder', async () => {
  const broken = remindDeps({ listRecipients: async () => { throw new Error('registrations: timeout'); } });
  const r = await handleRemind(H('s3cret'), 's3cret', broken);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.skipped, [{ room_key: 'opil:1', why: 'lookup_failed' }]);
  assert.deepEqual(broken.log.claims, [['opil:1', KIND]]);
  assert.deepEqual(broken.log.unclaims, [['opil:1', KIND]]);
  assert.deepEqual(broken.log.batches, []);
});

test('handleRemind: a four-person team means four reminders — the lead and every teammate', async () => {
  const row = { email: 'lead@famu.edu', personal_email: null, full_name: 'Lead', members: [{ name: 'B', email: 'b@famu.edu' }, { name: 'C', email: 'c@famu.edu' }, { name: 'D', email: 'd@famu.edu' }] };
  const d = remindDeps({ listRecipients: async () => recipientsFromRegistration(row) });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 4);
  assert.deepEqual(d.log.batches, [['lead@famu.edu', 'b@famu.edu', 'c@famu.edu', 'd@famu.edu']]);
});

test('handleRemind: 250 addresses go out as three batches', async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ email: `s${i}@x.edu` }));
  const d = remindDeps({ listRecipients: async () => many });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 250);
  assert.equal(r.body.due[0].missed, 0);
  assert.deepEqual(d.log.batches.map(b => b.length), [100, 100, 50]);
});

test('handleRemind: a chunk that fails twice is counted as missed, the other chunks still go out, the claim is kept', async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ email: `s${i}@x.edu` }));
  const d = remindDeps({ listRecipients: async () => many, sendBatch: async (msgs) => { d.log.batches.push(msgs.map(m => m.to)); return msgs[0].to === 's100@x.edu' ? { ok: false, ids: [], error: 'resend_429' } : { ok: true, ids: msgs.map(() => 'id') }; } });
  const r = await handleRemind(H('s3cret'), 's3cret', d);
  assert.equal(r.body.sent, 150);
  assert.equal(r.body.due[0].missed, 100);
  assert.equal(r.body.due[0].partial, true);
  assert.equal(r.body.due[0].error, 'resend_429');
  assert.deepEqual(d.log.batches.map(b => b.length), [100, 100, 100, 50], 'the middle chunk was tried twice; the last one still went');
  assert.deepEqual(d.log.unclaims, [], 'some went out, so the class is not emailed again');
});

/* ---------- hub buttons ---------- */

test('calendarLinks: Google subscribes by the webcal URL, Apple/Outlook get webcal, the download is the https feed', () => {
  const l = calendarLinks();
  assert.equal(FEED_URL, 'https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-opil-calendar');
  assert.equal(l.webcal, 'webcal://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-opil-calendar');
  assert.equal(l.google, 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(l.webcal));
  assert.equal(l.ics, FEED_URL + '?download=1');
  const custom = calendarLinks('https://example.test/feed');
  assert.equal(custom.webcal, 'webcal://example.test/feed');
});

test('watchHandoff: something opened = the page lost focus; nothing opened = the timer runs out', async () => {
  assert.equal(WEBCAL_WAIT_MS, 1500);
  const fakes = () => {
    const h = { win: {}, doc: {} };
    for (const o of [h.win, h.doc]) { o.l = {}; o.addEventListener = (t, f) => { o.l[t] = f; }; o.removeEventListener = (t) => { delete o.l[t]; }; }
    h.win.setTimeout = (f, ms) => { h.timer = f; h.ms = ms; return 1; };
    h.doc.visibilityState = 'visible';
    return h;
  };
  const a = fakes(); const pa = watchHandoff(300, a.win, a.doc); assert.equal(a.ms, 300); a.win.l.blur(); assert.equal(await pa, true);
  assert.deepEqual(Object.keys(a.win.l), [], 'listeners are removed');
  const b = fakes(); const pb = watchHandoff(300, b.win, b.doc); b.doc.visibilityState = 'hidden'; b.doc.l.visibilitychange(); assert.equal(await pb, true);
  const c = fakes(); const pc = watchHandoff(300, c.win, c.doc); c.timer(); assert.equal(await pc, false);
  assert.equal(await watchHandoff(300, null, null), true, 'with no window there is nothing to watch');
});

test('buttonsHTML: three choices, words not icons, every link opens safely', () => {
  const html = buttonsHTML(calendarLinks());
  assert.match(html, /Add to calendar/);
  assert.match(html, /Google Calendar/);
  assert.match(html, /Apple or Outlook/);
  assert.match(html, /Download \.ics/);
  assert.equal((html.match(/rel="noopener"/g) || []).length, 2, 'Google + download open in a new tab; webcal stays in place');
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /keep the calendar up to date/);
  assert.match(html, /If nothing opens, use Download \.ics below\./, 'the webcal choice says what to do when no app answers');
  assert.match(html, /data-calb-note hidden/, 'the "nothing opened" sentence is there, hidden until needed');
  assert.match(html, /data-webcal href="webcal:\/\//);
});
