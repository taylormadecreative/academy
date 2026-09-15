// tests/opil/room-v2.test.mjs — run: node --test tests/opil/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useV2, stateCopy, nowCopy, queueOrder, queuePosition, nextInLine, joinCopy } from '../../opil/hub/live-rooms.js';

test('useV2: the flag picks v2, ?classic=1 always wins', () => {
  assert.equal(useV2('', true), true);
  assert.equal(useV2('?s=7', true), true);
  assert.equal(useV2('?s=7&classic=1', true), false);
  assert.equal(useV2('?classic=1', true), false);
  assert.equal(useV2('?s=7', false), false);
  assert.equal(useV2('?s=7&v2=1', false), true);
  assert.equal(useV2('?s=7&v2=1&classic=1', true), false);
});

test('stateCopy says the state in words, and what a tap does', () => {
  assert.deepEqual(stateCopy({ audio: false, video: false }), { mic: ['You’re muted', 'Tap to unmute'], cam: ['Camera is off', 'Tap to turn on'] });
  assert.deepEqual(stateCopy({ audio: true, video: true }), { mic: ['Mic is on', 'People can hear you'], cam: ['Camera is on', 'You’ll be seen'] });
});

test('nowCopy: who is teaching, what, and whether it is recorded', () => {
  assert.equal(nowCopy({ facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true }), 'Casey Dike is teaching: Your AI Toolkit · This class is being recorded');
  assert.equal(nowCopy({ facilitator: null, title: 'Your AI Toolkit', recording: false }), 'Class in progress: Your AI Toolkit');
  assert.equal(nowCopy({ facilitator: 'Casey Dike', title: 'Your AI Toolkit', recording: true, breakout: { name: 'Data Divas', left: '11:42' } }), 'Small groups · Data Divas · 11:42 left');
});

const H = (id, uid, created, extra = {}) => ({ id, user_id: uid, kind: 'question', created_at: created, staged_at: null, done_at: null, ...extra });

test('queueOrder: open hands in the order they were raised; done ones drop out', () => {
  const rows = [H('b', 'u2', '2026-09-16T23:02:00Z'), H('a', 'u1', '2026-09-16T23:01:00Z'), H('c', 'u3', '2026-09-16T23:03:00Z', { done_at: '2026-09-16T23:04:00Z' })];
  assert.deepEqual(queueOrder(rows).map(r => r.id), ['a', 'b']);
});

test('queuePosition: 1-based place in line, or null when not in line', () => {
  const rows = [H('a', 'u1', '2026-09-16T23:01:00Z'), H('b', 'u2', '2026-09-16T23:02:00Z'), H('c', 'u3', '2026-09-16T23:03:00Z')];
  assert.equal(queuePosition(rows, 'u2'), 2);
  assert.equal(queuePosition(rows, 'u9'), null);
  assert.equal(queuePosition([], 'u1'), null);
});

test('nextInLine: the first open hand, staged ones first', () => {
  const rows = [H('a', 'u1', '2026-09-16T23:01:00Z'), H('b', 'u2', '2026-09-16T23:02:00Z', { staged_at: '2026-09-16T23:05:00Z' })];
  assert.equal(nextInLine(rows).id, 'b');
  assert.equal(nextInLine([]), null);
});

test('joinCopy: the sentence under the title for each situation', () => {
  assert.equal(joinCopy({ live: true, host: false, facilitator: 'Casey Dike', joined: 26 }), 'Casey Dike is in the room · 26 students joined');
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 1 }), 'The class is running · 1 student joined');
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Casey Dike', startsAt: '7:00 PM' }), 'Class hasn’t started yet. You’re all set — it starts at 7:00 PM — press Enter when it does.');
  assert.equal(joinCopy({ live: false, host: false, facilitator: 'Casey Dike', startsAt: null }), 'Class hasn’t started yet. You’re all set — press Enter when Casey Dike starts it.');
  assert.equal(joinCopy({ live: false, host: true, facilitator: 'Casey Dike' }), 'This room is yours. Start the class when you’re ready — students who have the link are waiting here.');
  assert.equal(joinCopy({ live: true, host: true, facilitator: 'Casey Dike', joined: 3 }), 'Your class is running · 3 students joined');
});
