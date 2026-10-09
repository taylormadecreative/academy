// tests/academy/ai101-badge.test.mjs — run: node --test tests/academy/ai101-badge.test.mjs
// The end-of-class badge's pure logic (js/ai101-badge.js): when it unlocks, the name on it, and the line fitting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeUnlocked, badgeName, nameFrom, wrapLines, fitSize } from '../../js/ai101-badge.js';

const START = '2026-10-10T00:00:00Z'; // 7:00 PM CT, Fri Oct 9

test('badgeUnlocked: locked before 7:56 PM CT, open from 7:56 on (and every day after); preview opens it any time', () => {
  const at = (iso) => Date.parse(iso);
  assert.equal(badgeUnlocked(at('2026-10-10T00:55:59Z'), START, 56, false), false);
  assert.equal(badgeUnlocked(at('2026-10-10T00:56:00Z'), START, 56, false), true);
  assert.equal(badgeUnlocked(at('2026-10-14T12:00:00Z'), START, 56, false), true);
  assert.equal(badgeUnlocked(at('2026-10-09T05:00:00Z'), START, 56, true), true);
  assert.equal(badgeUnlocked(at('2026-10-10T02:00:00Z'), 'not a date', 56, false), false);
});

test('badgeName: invisible and control characters out, spaces collapsed, 40 characters at most', () => {
  assert.equal(badgeName('  Sha’Kiyla   Johnson '), 'Sha’Kiyla Johnson');
  assert.equal(badgeName('Ana​‮ Lee\n'), 'Ana Lee');
  assert.equal(Array.from(badgeName('😀'.repeat(50))).length, 40);
  assert.equal(badgeName(null), '');
});

test('nameFrom: the profile name, unless it is only the email front; then the sign-up name; else empty', () => {
  assert.equal(nameFrom({ profileName: 'Sha’Kiyla', meta: { full_name: 'X' }, email: 'sk@x.com' }), 'Sha’Kiyla');
  assert.equal(nameFrom({ profileName: 'jwashington24', meta: { full_name: 'Jamal Washington' }, email: 'JWashington24@x.com' }), 'Jamal Washington');
  assert.equal(nameFrom({ profileName: '', meta: { name: 'Pat' }, email: 'p@x.com' }), 'Pat');
  assert.equal(nameFrom({ profileName: '', meta: {}, email: 'p@x.com' }), '');
});

test('wrapLines + fitSize: words wrap at the width; the size steps down until the lines fit', () => {
  const measure = (s) => s.length * 10; // 10 px a character
  assert.deepEqual(wrapLines(measure, 'Learn to talk to AI.', 130), ['Learn to talk', 'to AI.']);
  assert.deepEqual(wrapLines(measure, 'Supercalifragilistic', 50), ['Supercalifragilistic']);
  const at = (s, size) => s.length * size * 0.5;
  const big = fitSize(at, 'Ann Lee', 900, 2, 124, 72);
  assert.equal(big.size, 124); assert.deepEqual(big.lines, ['Ann Lee']);
  const long = fitSize(at, 'Bartholomew Montgomery-Washington', 900, 2, 124, 72);
  assert.ok(long.lines.length <= 2 && long.lines.every((l) => at(l, long.size) <= 900), JSON.stringify(long));
});
