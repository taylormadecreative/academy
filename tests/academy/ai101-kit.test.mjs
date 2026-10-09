// tests/academy/ai101-kit.test.mjs — run: node --test tests/academy/ai101-kit.test.mjs
// The AI 101 class kit's pure logic (js/ai101-kit.js): the prompt builder, the token toy, the stage's
// clock and deck, safe storage, and the review display name (which must match 0059's SQL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART_KEYS, promptPieces, buildPrompt, missingParts, splitTokens, ctMinutes, ctDate, isBehind, countdown,
  readState, writeState, displayName, createDeck, guessOS } from '../../js/ai101-kit.js';

test('PART_KEYS is the 5-part order', () => {
  assert.deepEqual(PART_KEYS, ['role', 'task', 'context', 'format', 'example']);
});

test('buildPrompt: the bakery prompt from five plain boxes', () => {
  const out = buildPrompt({
    role: 'a social media writer for a small family bakery',
    task: 'write an Instagram caption for our new sweet potato pie',
    context: "It's my grandmother's recipe and we only sell it on Fridays",
    format: 'under 60 words, warm and friendly, end with a question',
    example: '"Saturday mornings smell like cinnamon around here."',
  });
  assert.equal(out,
    'You are a social media writer for a small family bakery. Write an Instagram caption for our new sweet potato pie. ' +
    "It's my grandmother's recipe and we only sell it on Fridays. Under 60 words, warm and friendly, end with a question. " +
    'Here is an example I like: "Saturday mornings smell like cinnamon around here."');
});

test('buildPrompt: keeps "You are", keeps end punctuation, squeezes spaces, skips empty parts', () => {
  assert.equal(buildPrompt({ role: '  you are   a  coach!  ', task: 'plan my week?' }), 'You are a coach! Plan my week?');
  assert.equal(buildPrompt({ task: 'summarize this' }), 'Summarize this.');
  assert.equal(buildPrompt({}), '');
  assert.equal(buildPrompt({ role: null, task: undefined }), '');
});

test('promptPieces: one keyed sentence per filled part, in 5-part order whatever order they were typed', () => {
  assert.deepEqual(promptPieces({ task: 'plan my week', role: 'a coach' }), [
    { key: 'role', text: 'You are a coach.' }, { key: 'task', text: 'Plan my week.' }]);
  assert.deepEqual(promptPieces({ example: '“Hi there”' }), [{ key: 'example', text: 'Here is an example I like: "Hi there"' }]);
  assert.deepEqual(promptPieces({}), []);
});

test('missingParts names the empty required parts, never example', () => {
  assert.deepEqual(missingParts({ role: 'x', task: '', context: '  ' }), ['task', 'context', 'format']);
  assert.deepEqual(missingParts({ role: 'a', task: 'b', context: 'c', format: 'd' }), []);
});

test('splitTokens: words keep their leading space, punctuation is its own token, long words split', () => {
  assert.deepEqual(splitTokens('Write a caption.'), ['Write', ' a', ' caption', '.']);
  assert.deepEqual(splitTokens('unbelievably'), ['unbel', 'ievab', 'ly']);
  assert.deepEqual(splitTokens('Pay $1200 now'), ['Pay', ' $', '120', '0', ' now']);
  assert.deepEqual(splitTokens(''), []);
  assert.deepEqual(splitTokens(null), []);
});

test('ctMinutes / ctDate read Central time across DST', () => {
  const sevenThirty = Date.parse('2026-10-10T00:30:00Z'); // Fri Oct 9, 7:30 PM CDT
  assert.equal(ctMinutes(sevenThirty), 19 * 60 + 30);
  assert.equal(ctDate(sevenThirty), '2026-10-09');
  assert.equal(ctMinutes(Date.parse('2026-12-01T01:05:00Z')), 19 * 60 + 5); // CST
});

test('isBehind only fires on class day, past the check, before the scene', () => {
  const checks = [{ date: '2026-10-09', at: 19 * 60 + 30, scene: 12 }];
  const at731 = Date.parse('2026-10-10T00:31:00Z');
  assert.equal(isBehind(at731, 10, checks), true);
  assert.equal(isBehind(at731, 12, checks), false);
  assert.equal(isBehind(Date.parse('2026-10-10T00:29:00Z'), 10, checks), false);
  assert.equal(isBehind(Date.parse('2026-10-08T00:31:00Z'), 10, checks), false); // rehearsal Wed night
});

test('countdown formats m:ss and never goes negative', () => {
  assert.equal(countdown(720000), '12:00');
  assert.equal(countdown(61001), '1:02');
  assert.equal(countdown(999), '0:01');
  assert.equal(countdown(-5000), '0:00');
});

test('readState / writeState survive a throwing or missing storage', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readState(boom, 'k', { a: 1 }), { a: 1 });
  assert.equal(writeState(boom, 'k', 1), false);
  assert.equal(readState(null, 'k', 'f'), 'f');
  const mem = new Map();
  const ok = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.equal(writeState(ok, 'k', { b: 2 }), true);
  assert.deepEqual(readState(ok, 'k', null), { b: 2 });
  mem.set('bad', '{not json');
  assert.equal(readState(ok, 'bad', 'f'), 'f');
});

test('displayName: First L., keeps inner capitals, empty falls back', () => {
  assert.equal(displayName('nelson elliott taylor'), 'Nelson T.');
  assert.equal(displayName('  DeShawn   mcKay '), 'DeShawn M.');
  assert.equal(displayName('Cher'), 'Cher');
  assert.equal(displayName('   '), 'Academy member');
  assert.equal(displayName(null), 'Academy member');
  assert.equal(displayName('A'.repeat(70) + ' Smith'), 'A'.repeat(40) + ' S.');
});

test('createDeck walks beats then scenes, both ways, and clamps', () => {
  const d = createDeck([1, 3, 2]);
  assert.deepEqual(d.pos(), { scene: 0, beat: 0 });
  assert.deepEqual(d.next(), { scene: 1, beat: 0 });
  assert.deepEqual(d.next(), { scene: 1, beat: 1 });
  assert.deepEqual(d.next(), { scene: 1, beat: 2 });
  assert.deepEqual(d.next(), { scene: 2, beat: 0 });
  assert.deepEqual(d.next(), { scene: 2, beat: 1 });
  assert.deepEqual(d.next(), { scene: 2, beat: 1 }); // end stays put
  assert.deepEqual(d.prev(), { scene: 2, beat: 0 });
  assert.deepEqual(d.prev(), { scene: 1, beat: 2 }); // back lands on the last beat of the scene before
  assert.deepEqual(d.go(99), { scene: 2, beat: 0 });
  assert.deepEqual(d.go(-3), { scene: 0, beat: 0 });
  assert.deepEqual(d.prev(), { scene: 0, beat: 0 });
});

test('untilLabel: days+hours far off, hours+minutes within a day, m:ss within the hour', async () => {
  const { untilLabel } = await import('../../js/ai101-kit.js');
  assert.equal(untilLabel(83 * 3600e3 + 20 * 60e3), '3d 11h');
  assert.equal(untilLabel(2 * 3600e3 + 5 * 60e3 + 30e3), '2h 05m');
  assert.equal(untilLabel(30 * 60e3), '30:00');
  assert.equal(untilLabel(59 * 60e3 + 59e3), '59:59');
  assert.equal(untilLabel(0), '0:00');
});

// ---- final-review fixes (10/6) ----
test('displayName: odd spaces, invisible characters and control characters never make an odd name', () => {
  assert.equal(displayName('  ann​  lee\n'), 'Ann L.');
  assert.equal(displayName('​⁠\u0007 '), 'Academy member');
  assert.equal(displayName('ann\tmarie　lee'), 'Ann L.');
  assert.equal(displayName('😀bob smith'), '😀bob S.', 'a first character outside the basic plane stays whole');
  assert.equal(displayName('ann 😀lee'), 'Ann 😀.');
});
test('createDeck.go(scene, beat) lands on a beat, clamped (a reload comes back to the same spot)', () => {
  const d = createDeck([1, 3, 2]);
  assert.deepEqual(d.go(1, 2), { scene: 1, beat: 2 });
  assert.deepEqual(d.go(1, 9), { scene: 1, beat: 2 });
  assert.deepEqual(d.go(2, -1), { scene: 2, beat: 0 });
  assert.deepEqual(d.next(), { scene: 2, beat: 1 });
});

test('guessOS: Windows when any signal says Windows, else Mac (phones, tablets, Chromebooks land on Mac)', () => {
  assert.equal(guessOS({ uaPlatform: 'Windows' }), 'windows');
  assert.equal(guessOS({ platform: 'Win32' }), 'windows');
  assert.equal(guessOS({ uaPlatform: 'macOS', platform: 'MacIntel', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'windows');
  assert.equal(guessOS({ uaPlatform: 'macOS', platform: 'MacIntel', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140 Safari/537.36' }), 'mac');
  assert.equal(guessOS({ ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile' }), 'mac');
  assert.equal(guessOS({ uaPlatform: 'Chrome OS', ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)' }), 'mac');
  assert.equal(guessOS(), 'mac');
});
