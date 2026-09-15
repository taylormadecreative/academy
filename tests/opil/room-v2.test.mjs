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

/* ---- anyone in the room can ask (9/15): one copy for the button, wherever it sits ---- */
import { askLineCopy, queueEmptyCopy, addTranscript, transcriptText } from '../../opil/hub/live-rooms.js';

test('askLineCopy: not in line → Ask; in line → your place and how to leave', () => {
  assert.deepEqual(askLineCopy(null), { b: 'Ask a question', s: 'Add yourself to the line' });
  assert.deepEqual(askLineCopy(1), { b: 'You’re #1 in line', s: 'Tap to leave the line' });
  assert.deepEqual(askLineCopy(3), { b: 'You’re #3 in line', s: 'Tap to leave the line' });
});

test('queueEmptyCopy no longer says only a student can ask', () => {
  assert.equal(queueEmptyCopy(), 'When anyone presses Ask a question, they appear here in order.');
});

/* ---- the transcript: one list, no partials, no duplicates ---- */
const T = (id, name, text, extra = {}) => ({ id, name, transcript: text, timestamp: '2026-09-16T23:01:00Z', isPartialTranscript: false, ...extra });

test('addTranscript keeps final lines once, drops partials and junk', () => {
  const lines = [];
  assert.equal(addTranscript(lines, T('a', 'Nelson', 'Welcome in.')), true);
  assert.equal(addTranscript(lines, T('a', 'Nelson', 'Welcome in.')), false);            // same id twice (replay + event)
  assert.equal(addTranscript(lines, T('b', 'Jamal', 'Can you hear', { isPartialTranscript: true })), false);
  assert.equal(addTranscript(lines, null), false);
  assert.equal(addTranscript(lines, T('c', 'Jamal', 'Can you hear me?')), true);
  assert.deepEqual(lines.map(x => x.id), ['a', 'c']);
});

test('transcriptText: time, speaker, words — or an honest empty line', () => {
  const when = () => '6:01 PM';
  assert.equal(transcriptText([T('a', 'Nelson', 'Welcome in.'), T('c', null, 'Hi.')], when), '6:01 PM  Nelson: Welcome in.\n6:01 PM  Someone: Hi.');
  assert.match(transcriptText([], when), /^No transcript lines were captured on this device/);
});

/* ---- the Recording chip is DERIVED, never stranded (9/15: "it says its still recording even
       though i'm off" — session not live, zero replay rows, chip still lit) ---- */
import { recChipHidden } from '../../opil/hub/live-rooms.js';

test('recChipHidden: lit only while THIS session is running and this page started its recording', () => {
  assert.equal(recChipHidden({ running: true, recFor: 1, sessionNo: 1 }), false);   // the one real case
  assert.equal(recChipHidden({ running: false, recFor: 1, sessionNo: 1 }), true);   // he left / ended → off
  assert.equal(recChipHidden({ running: true, recFor: null, sessionNo: 1 }), true); // live class, nothing recording
  assert.equal(recChipHidden({ running: true, recFor: 2, sessionNo: 1 }), true);    // dropdown moved to another session
  assert.equal(recChipHidden({ running: false, recFor: null, sessionNo: 1 }), true);
});
