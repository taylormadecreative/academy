// node --test tests/opil/presence.test.mjs — attendance that takes itself: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceRows, attendanceSummary, attendanceCSV, csvCell, minutesWord, deviceWord, AUTO_MARK_SECONDS, beat, create } from '../../js/rtk-presence.js';

const rows = [
  { user_id: 'a', name: 'Kiara Pee', school: 'FAMU', team: 'The Rattlers', state: 'in', first_seen: '2026-09-16T22:31:00Z', last_seen: '2026-09-16T23:29:00Z', seconds: 3480, waited_s: 120 },
  { user_id: 'b', name: 'Amos Abdulai', school: 'Livingstone', team: 'Tech Mongers', state: 'out', first_seen: '2026-09-16T22:40:00Z', last_seen: '2026-09-16T22:46:00Z', seconds: 300, waited_s: 0 },
  { user_id: 'c', name: 'Holy', school: 'Grambling', team: '', state: 'waiting', first_seen: '2026-09-16T22:20:00Z', last_seen: '2026-09-16T22:33:00Z', seconds: 0, waited_s: 780 },
];

test('attendanceRows: minutes, present at ten minutes, sorted by name, times in the given zone', () => {
  const r = attendanceRows(rows, { zone: 'America/New_York' });
  assert.deepEqual(r.map(x => x.name), ['Amos Abdulai', 'Holy', 'Kiara Pee']);
  const k = r.find(x => x.user_id === 'a');
  assert.equal(k.minutes, 58); assert.equal(k.waited, 2); assert.equal(k.present, true); assert.equal(k.stillIn, true); assert.equal(k.inAt, '6:31 PM');
  assert.equal(r.find(x => x.user_id === 'b').present, false);
  assert.equal(r.find(x => x.user_id === 'c').minutes, 0);
});

test('attendanceSummary reads like Jamal would say it', () => {
  assert.equal(attendanceSummary(rows), '1 present · 1 dropped in under 10 min · 1 waited but never entered');
  assert.equal(attendanceSummary([]), 'No one yet');
  assert.equal(attendanceSummary([rows[0]]), '1 present');
});

test('csvCell: quotes commas, doubles quotes, defuses formulas, leaves signed numbers alone', () => {
  assert.equal(csvCell('Pee, Kiara'), '"Pee, Kiara"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('@cmd'), "'@cmd");
  assert.equal(csvCell('-5'), '-5');
  assert.equal(csvCell(-5), '-5');
  assert.equal(csvCell('+12.5'), '+12.5');
  assert.equal(csvCell(null), '');
});

test('attendanceCSV: a header, one line per person, a title line when given', () => {
  const csv = attendanceCSV(rows, { title: '01 · Kickoff', zone: 'America/New_York' });
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], '01 · Kickoff');
  assert.equal(lines[1], 'Name,School,Team,In at,Last seen,Minutes in class,Minutes waited,Present (10+ min)');
  assert.equal(lines.length, 5);
  assert.match(lines[4], /^Kiara Pee,FAMU,The Rattlers,6:31 PM,7:29 PM,58,2,yes$/);
});

test('minutesWord, deviceWord, the ten-minute mark', () => {
  assert.equal(minutesWord(60), '1 minute'); assert.equal(minutesWord(3480), '58 minutes');
  assert.equal(deviceWord('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)'), 'iPhone');
  assert.equal(deviceWord('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)'), 'Mac');
  assert.equal(AUTO_MARK_SECONDS, 600);
});

test('beat never throws — a broken connection is a console line, not a broken class', async () => {
  const sb = { rpc: async () => { throw new Error('offline'); } };
  assert.equal(await beat(sb, 'opil:1', 'in'), null);
  const sb2 = { rpc: async (name, args) => ({ data: { ok: true, seconds: 30, state: args.p_state }, error: null }) };
  assert.deepEqual(await beat(sb2, 'opil:1', 'waiting'), { ok: true, seconds: 30, state: 'waiting' });
});

test('create(ctx): starts on start(), beats out on left/ended, never throws without a document', async () => {
  const calls = []; const handlers = {};
  const ctx = { sb: { rpc: async (n, a) => { calls.push(a.p_state); return { data: {}, error: null }; } }, roomKey: 'opil:2', on: (ev, cb) => { handlers[ev] = cb; } };
  const p = create(ctx); p.start();
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls, ['in']);
  handlers.left(); await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls, ['in', 'out']);
  p.stop(); await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls, ['in', 'out']);   /* stopping twice does not beat twice */
});
