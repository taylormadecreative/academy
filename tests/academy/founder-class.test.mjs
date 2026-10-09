// tests/academy/founder-class.test.mjs — run: node --test tests/academy/founder-class.test.mjs
// The founder's Class results math (js/founder-class.js), and its copy of the class questions: it must say exactly
// what ai101_course.py asks, with the same right answers, or the percentages Nelson reads are wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLASS_Q, summarizePulse, oneDp, signed } from '../../js/founder-class.js';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const C = JSON.parse(execFileSync('python3', ['-c', 'import json, ai101_course as c; print(json.dumps({"PULSE_Q": c.PULSE_Q, "PULSE_ENDS": c.PULSE_ENDS, "PRACTICE_TAPS": c.PRACTICE_TAPS, "CHECK_ITEMS": c.CHECK_ITEMS}))'], { cwd: ROOT }).toString());

test('the founder copy of the questions matches the course module, right answers included', () => {
  assert.equal(CLASS_Q.before, C.PULSE_Q.before);
  assert.equal(CLASS_Q.after, C.PULSE_Q.after);
  assert.deepEqual(CLASS_Q.ends, C.PULSE_ENDS);
  assert.deepEqual(CLASS_Q.taps, C.PRACTICE_TAPS.map(({ kind, q, labels }) => ({ kind, q, labels })));
  assert.deepEqual(CLASS_Q.checks, C.CHECK_ITEMS.map(({ kind, q, options, right }) => ({ kind, q, options, right })));
});

test('nobody yet: zeros and dashes, no NaN', () => {
  const s = summarizePulse([]);
  assert.equal(s.people, 0);
  assert.deepEqual(s.before, { n: 0, avg: null, dist: [0, 0, 0, 0, 0] });
  assert.deepEqual(s.paired, { n: 0, avgChange: null });
  assert.ok(s.checks.every((c) => c.n === 0 && c.pct === null));
  assert.equal(s.last, null);
  assert.equal(oneDp(null), '–'); assert.equal(signed(null), '–');
});

const R = (user_id, kind, score, updated_at = '2026-10-09T19:05:00Z') => ({ user_id, kind, score, updated_at });
const ROWS = [
  R('a', 'before', 2), R('a', 'after', 4), R('a', 'useful', 3), R('a', 'steered', 2), R('a', 'chk_safe', 2), R('a', 'chk_verify', 3), R('a', 'chk_prompt', 1),
  R('b', 'before', 3), R('b', 'after', 5, '2026-10-09T19:42:00Z'), R('b', 'useful', 2), R('b', 'chk_safe', 1), R('b', 'chk_verify', 3),
  R('c', 'before', 1), // answered before only: counts in before, not in the change
  R('d', 'after', 3), R('d', 'chk_prompt', 2), // after only
];

test('averages, the 1-5 spread, and the change for people who answered both', () => {
  const s = summarizePulse(ROWS);
  assert.equal(s.people, 4);
  assert.equal(s.before.n, 3); assert.equal(s.before.avg, 2); assert.deepEqual(s.before.dist, [1, 1, 1, 0, 0]);
  assert.equal(s.after.n, 3); assert.equal(s.after.avg, 4); assert.deepEqual(s.after.dist, [0, 0, 1, 1, 1]);
  assert.equal(s.paired.n, 2); assert.equal(s.paired.avgChange, 2); // a: +2, b: +2
  assert.equal(s.last, '2026-10-09T19:42:00Z');
});

test('practice taps count per button', () => {
  const s = summarizePulse(ROWS);
  assert.deepEqual(s.taps.find((t) => t.kind === 'useful').counts, [0, 1, 1]);
  assert.deepEqual(s.taps.find((t) => t.kind === 'steered').counts, [0, 1]);
  assert.equal(s.taps.find((t) => t.kind === 'steered').n, 1);
});

test('quick questions: % right uses each question\'s own right answer', () => {
  const s = summarizePulse(ROWS);
  const q = Object.fromEntries(s.checks.map((c) => [c.kind, c]));
  assert.deepEqual([q.chk_safe.n, q.chk_safe.rightN, q.chk_safe.pct], [2, 1, 50]);
  assert.deepEqual([q.chk_verify.n, q.chk_verify.rightN, q.chk_verify.pct], [2, 2, 100]);
  assert.deepEqual([q.chk_prompt.n, q.chk_prompt.rightN, q.chk_prompt.pct], [2, 1, 50]);
  assert.deepEqual(q.chk_safe.counts, [1, 1, 0]);
});

test('leaves out Nelson\'s own test taps, unknown questions, and scores no button has', () => {
  const s = summarizePulse([...ROWS, R('nelson', 'before', 5), R('nelson', 'chk_safe', 3), R('e', 'mystery', 2), R('e', 'useful', 4), R('e', 'before', 0), R('e', 'steered', 1.5), { kind: 'before', score: 3 }], { exclude: 'nelson' });
  assert.equal(s.people, 4, 'nelson and the bad rows add nobody');
  assert.equal(s.before.n, 3); assert.equal(s.checks[0].n, 2);
});

test('one decimal, and a change keeps its sign', () => {
  assert.equal(oneDp(3.44), '3.4'); assert.equal(oneDp(4), '4.0');
  assert.equal(signed(1.25), '+1.3'); assert.equal(signed(-0.5), '−0.5'); assert.equal(signed(-0.04), '0.0'); assert.equal(signed(0), '0.0');
});
