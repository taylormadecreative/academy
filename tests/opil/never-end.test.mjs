// tests/opil/never-end.test.mjs — run: node --test tests/opil/*.test.mjs
// Nobody ends a class by accident (Nelson, 9/15): the kit's roomLeft state sorted into four words,
// the reconnect plan for a drop, the Leave/End words, and the ended card's "live again" rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftKind, rejoinPlan, REJOIN_DELAYS_MS, reconnectCopy, endCopy, backOn, OPIL_WORDS, ROOM_WORDS } from '../../opil/hub/live-rooms.js';

test('leftKind: left / kicked / ended keep their word; a move to a small group or off a stage is a switch; everything else is a drop', () => {
  assert.equal(leftKind('left'), 'left');
  assert.equal(leftKind('kicked'), 'kicked');
  assert.equal(leftKind('ended'), 'ended');
  /* the kit's LeaveRoomState (realtimekit 2.0.2 index.d.ts): kicked | ended | left | rejected | connected-meeting | disconnected | failed | stageLeft */
  assert.equal(leftKind('connected-meeting'), 'switch');
  assert.equal(leftKind('stageLeft'), 'switch');
  for (const s of ['disconnected', 'failed', 'rejected', 'unauthorized', '', undefined, null, 0, {}]) assert.equal(leftKind(s), 'dropped', String(s));
});

test('rejoinPlan: a drop gets two attempts (2 s, then 4 s more); Leave, a kick and an ended meeting get none', () => {
  assert.deepEqual([...REJOIN_DELAYS_MS], [2000, 4000]);
  assert.equal(Object.isFrozen(REJOIN_DELAYS_MS), true);
  assert.equal(rejoinPlan('dropped', 0), 2000);
  assert.equal(rejoinPlan('dropped', 1), 4000);
  assert.equal(rejoinPlan('dropped', 2), null);
  assert.equal(rejoinPlan('dropped', -1), null);
  assert.equal(rejoinPlan('dropped', 'x'), null);
  for (const k of ['left', 'kicked', 'ended', 'switch', undefined]) { assert.equal(rejoinPlan(k, 0), null, String(k)); assert.equal(rejoinPlan(k, 1), null, String(k)); }
});

test('reconnectCopy: one line, no vendor, no name', () => {
  assert.equal(reconnectCopy(0), 'Reconnecting…');
  assert.equal(reconnectCopy(1), 'Still reconnecting — one more try…');
  for (const t of [reconnectCopy(0), reconnectCopy(1)]) { assert.doesNotMatch(t, /Nelson|Cloudflare|RealtimeKit|Dyte/); }
});

test('endCopy reads the room noun: class for OPIL, session for the rooms; frozen; no name, no vendor', () => {
  const c = endCopy();
  assert.equal(Object.isFrozen(c), true);
  assert.equal(c.leave, 'Leave class?');
  assert.equal(c.leaveHost, 'Leave the room? The class keeps running — you can come back.');
  assert.equal(c.endButton, 'End the class for everyone');
  assert.equal(c.endAsk, 'End the class for everyone?');
  assert.equal(c.endAgain, 'Tap again to end it.');
  assert.equal(c.endAsk + ' ' + c.endAgain, 'End the class for everyone? Tap again to end it.');
  assert.equal(c.stillRunning, 'You left — the class is still running.');
  assert.equal(c.backOn, 'The class is back on — rejoin when you’re ready.');
  assert.deepEqual(endCopy(OPIL_WORDS), c);
  const r = endCopy(ROOM_WORDS);
  assert.equal(r.leaveHost, 'Leave the room? The session keeps running — you can come back.');
  assert.equal(r.endButton, 'End the session for everyone');
  assert.equal(r.stillRunning, 'You left — the session is still running.');
  for (const v of Object.values(c).concat(Object.values(r))) { assert.equal(typeof v, 'string'); assert.doesNotMatch(v, /Nelson|Cloudflare|RealtimeKit|Dyte|Only if/); }
  assert.deepEqual(Object.keys(c).sort(), ['backOn', 'endAgain', 'endAsk', 'endButton', 'endHint', 'leave', 'leaveHost', 'rejoin', 'stillRunning', 'stillRunningHint']);
});

test('backOn: the ended card offers the door back only after the room was seen off air and is live now', () => {
  /* a removed person in a class that never stopped: live every poll → never "again" */
  let s = backOn({ seenOff: false }, true); assert.deepEqual(s, { seenOff: false, again: false });
  s = backOn(s, true); assert.deepEqual(s, { seenOff: false, again: false });
  /* the class ended (the row flipped a moment after the kick), then a new one started */
  s = backOn(s, false); assert.deepEqual(s, { seenOff: true, again: false });
  s = backOn(s, false); assert.deepEqual(s, { seenOff: true, again: false });
  s = backOn(s, true); assert.deepEqual(s, { seenOff: true, again: true });
  /* the card appeared with the room already off air → the first live poll is "again" */
  assert.deepEqual(backOn({ seenOff: true }, true), { seenOff: true, again: true });
  /* a poll that could not answer (null/undefined) changes nothing */
  assert.deepEqual(backOn({ seenOff: false }, null), { seenOff: false, again: false });
  assert.deepEqual(backOn({ seenOff: true }, undefined), { seenOff: true, again: false });
  assert.deepEqual(backOn(null, false), { seenOff: true, again: false });
});
