// tests/opil/captions.test.mjs — run: node --test tests/opil/*.test.mjs
// The captions overlay's one decision: which lines are on screen right now. Pure, so every branch runs here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeCaption, CAPTION_TTL_MS, CAPTION_MAX } from '../../opil/hub/live-rooms.js';

const T0 = 1_700_000_000_000;
const ev = (id, name, text, partial = false, extra = {}) => ({ id, name, transcript: text, isPartialTranscript: partial, peerId: 'peer-' + (name || 'x'), ...extra });

test('a partial then its final with the same id replaces in place — one line, final:true', () => {
  let caps = takeCaption([], ev('a', 'Dr. Gray', 'Welcome every', true), T0);
  assert.deepEqual(caps, [{ id: 'a', name: 'Dr. Gray', text: 'Welcome every', final: false, at: T0 }]);
  caps = takeCaption(caps, ev('a', 'Dr. Gray', 'Welcome everyone.'), T0 + 900);
  assert.deepEqual(caps, [{ id: 'a', name: 'Dr. Gray', text: 'Welcome everyone.', final: true, at: T0 + 900 }]);
});

test('two speakers keep the order they spoke in', () => {
  let caps = takeCaption([], ev('a', 'Dr. Gray', 'Can you hear me?'), T0);
  caps = takeCaption(caps, ev('b', 'Ada', 'Loud and clear.'), T0 + 1000);
  assert.deepEqual(caps.map(c => c.name + ': ' + c.text), ['Dr. Gray: Can you hear me?', 'Ada: Loud and clear.']);
});

test('a final older than the TTL is pruned on the next call; null just prunes', () => {
  let caps = takeCaption([], ev('a', 'Dr. Gray', 'Old line.'), T0);
  caps = takeCaption(caps, null, T0 + CAPTION_TTL_MS);          // exactly at the TTL: still there
  assert.equal(caps.length, 1);
  caps = takeCaption(caps, null, T0 + CAPTION_TTL_MS + 1);      // one ms past: gone
  assert.deepEqual(caps, []);
});

test('a partial is never pruned, however old — it waits for its final', () => {
  let caps = takeCaption([], ev('a', 'Ada', 'Still talk', true), T0);
  caps = takeCaption(caps, null, T0 + 60_000);
  assert.equal(caps.length, 1);
  assert.equal(caps[0].final, false);
});

test('the cap holds: only the last CAPTION_MAX lines stay', () => {
  let caps = [];
  for (let i = 0; i < CAPTION_MAX + 2; i++) caps = takeCaption(caps, ev('l' + i, 'Ada', 'Line ' + i), T0 + i);
  assert.equal(caps.length, CAPTION_MAX);
  assert.deepEqual(caps.map(c => c.id), ['l2', 'l3']);
});

test('the input is never mutated', () => {
  const before = [{ id: 'a', name: 'Ada', text: 'First', final: false, at: T0 }];
  const snapshot = JSON.stringify(before);
  const out = takeCaption(before, ev('a', 'Ada', 'First, then', true), T0 + 100);
  takeCaption(before, ev('b', 'Ada', 'Second'), T0 + 200);
  takeCaption(before, null, T0 + 100_000);
  assert.equal(JSON.stringify(before), snapshot);
  assert.notEqual(out, before);
  assert.notEqual(out[0], before[0]);
});

test('a blank, missing or non-string transcript is ignored; a missing id is minted from the peer', () => {
  const caps = takeCaption([], ev('a', 'Ada', 'Kept.'), T0);
  assert.deepEqual(takeCaption(caps, ev('b', 'Ada', '   '), T0 + 1), caps);
  assert.deepEqual(takeCaption(caps, ev('b', 'Ada', undefined), T0 + 1), caps);
  assert.deepEqual(takeCaption(caps, { id: 'b', name: 'Ada', transcript: 42 }, T0 + 1), caps);
  assert.deepEqual(takeCaption(caps, {}, T0 + 1), caps);
  const minted = takeCaption([], { peerId: 'peer-9', transcript: 'No id here', isPartialTranscript: false }, T0);
  assert.deepEqual(minted, [{ id: 'peer-9:' + T0, name: 'Someone', text: 'No id here', final: true, at: T0 }]);
});
