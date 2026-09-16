// node --test tests/opil/small-groups.test.mjs — the Small Groups board's pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { helpRows, queueOrder, roomsEvenly, roomsByTeam, timerCopy, roomStatus, noteIsForMe, helpCopy, nowCopy } from '../../opil/hub/live-rooms.js';

const people = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, uid: 'u-' + id }));

test('help hands never enter the question line; helpRows lists the open ones', () => {
  const rows = [
    { id: 1, user_id: 'x', kind: 'question', created_at: '2026-09-16T23:00:00Z' },
    { id: 2, user_id: 'y', kind: 'help', note: 'm-1', created_at: '2026-09-16T23:01:00Z' },
    { id: 3, user_id: 'z', kind: 'help', note: 'm-2', created_at: '2026-09-16T23:02:00Z', done_at: '2026-09-16T23:03:00Z' },
  ];
  assert.deepEqual(queueOrder(rows).map(r => r.id), [1]);
  assert.deepEqual(helpRows(rows).map(r => r.id), [2]);
});

test('roomsEvenly deals round-robin into n rooms, clamps n, and keeps empty rooms', () => {
  assert.deepEqual(roomsEvenly(people, 2), [{ title: 'Room 1', ids: ['a', 'c', 'e'] }, { title: 'Room 2', ids: ['b', 'd'] }]);
  assert.equal(roomsEvenly(people, 99).length, 8);
  assert.equal(roomsEvenly([], 3).length, 3);
  assert.equal(roomsEvenly(people, 'nope').length, 2);
});

test('roomsByTeam names rooms after the teams (A–Z) and puts the teamless in one Open room at the end', () => {
  const team = { 'u-a': 'Data Divas', 'u-b': 'Aeero', 'u-c': 'Data Divas', 'u-d': null, 'u-e': 'Aeero' };
  const rooms = roomsByTeam(people, p => team[p.uid]);
  assert.deepEqual(rooms, [{ title: 'Aeero', ids: ['b', 'e'] }, { title: 'Data Divas', ids: ['a', 'c'] }, { title: 'Open room', ids: ['d'] }]);
  assert.deepEqual(roomsByTeam([], () => null), []);
});

test('timerCopy: mm:ss left, progress, when it ends; zero is Time’s up; no timer is null', () => {
  const start = Date.parse('2026-09-16T23:00:00Z'), endsAt = start + 15 * 60000;
  const t = timerCopy({ endsAt, minutes: 15, now: start + 5 * 60000 + 28000, zone: 'America/New_York' });
  assert.equal(t.clock, '09:32'); assert.equal(t.left, '09:32'); assert.equal(t.over, false);
  assert.ok(Math.abs(t.pct - 0.364) < 0.01);
  assert.equal(t.session, '15 minutes on the clock'); assert.equal(t.ends, 'Ends at 7:15 PM');
  const done = timerCopy({ endsAt, minutes: 15, now: endsAt + 5000 });
  assert.equal(done.clock, '00:00'); assert.equal(done.over, true); assert.equal(done.left, 'Time’s up'); assert.equal(done.pct, 1);
  assert.equal(timerCopy({ endsAt: null, minutes: 15 }), null);
});

test('the strip in a small group reads the room, the time left, and Time’s up', () => {
  assert.equal(nowCopy({ breakout: { name: 'Data Divas', left: '09:32' } }), 'Small groups · Data Divas · 09:32 left');
  assert.equal(nowCopy({ breakout: { name: 'Data Divas', over: true, facilitator: 'Casey Dike' } }), 'Small groups · Data Divas · Time’s up — wrap up. Casey Dike will bring everyone back.');
  assert.equal(nowCopy({ breakout: { name: 'Room 2', over: true } }), 'Small groups · Room 2 · Time’s up — wrap up. Your facilitator will bring everyone back.');
  assert.equal(nowCopy({ breakout: { name: 'Room 2' } }), 'Small groups · Room 2');
});

test('roomStatus: Needs help beats Working beats Empty', () => {
  assert.deepEqual(roomStatus({ count: 3, help: true }), { word: 'Needs help', tone: 'help' });
  assert.deepEqual(roomStatus({ count: 3, help: false }), { word: 'Working', tone: 'ok' });
  assert.deepEqual(roomStatus({ count: 0, help: false }), { word: 'Empty', tone: 'empty' });
});

test('noteIsForMe: my room or all rooms, with words in it; never a timer or a blank', () => {
  assert.equal(noteIsForMe({ type: 'note', room: 'm-1', text: 'Two minutes left' }, 'm-1'), true);
  assert.equal(noteIsForMe({ type: 'note', room: 'all', text: 'Wrap up' }, 'm-1'), true);
  assert.equal(noteIsForMe({ type: 'note', room: 'm-2', text: 'Hi' }, 'm-1'), false);
  assert.equal(noteIsForMe({ type: 'note', room: 'm-1', text: '   ' }, 'm-1'), false);
  assert.equal(noteIsForMe({ type: 'timer', endsAt: null }, 'm-1'), false);
  assert.equal(noteIsForMe({ type: 'note', room: 'all', text: 'x' }, null), true);
});

test('helpCopy: Ask for help, then Help is on the way with the way to cancel', () => {
  assert.deepEqual(helpCopy(false, 'Casey Dike'), { b: 'Ask for help', s: 'Casey Dike will pop in' });
  assert.deepEqual(helpCopy(true, null), { b: 'Help is on the way', s: 'Your facilitator will pop in · tap to cancel' });
});
