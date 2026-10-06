// tests/academy/ai101-build.test.mjs — run: python3 build_site.py && node --test tests/academy/ai101-build.test.mjs
// The built class page: the DOM contract the scripts rely on, the sign-in wall's links, noindex, and the
// public-copy guard (no list-only price, no Eventbrite code, no room key — ever).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const page = fs.readFileSync(ROOT + 'ai101/class/index.html', 'utf8');

test('noindex, own stylesheet, starts on Claude', () => {
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.match(page, /\/css\/ai101-class\.css\?v=/);
  assert.match(page, /<html lang="en" data-tool="claude">/);
});
test('gate and app both ship hidden; the gate signs in and comes back here', () => {
  assert.match(page, /<div id="gate" class="a1c-gate" hidden>/);
  assert.match(page, /<div id="app" hidden>/);
  assert.match(page, /\/login\/\?next=%2Fai101%2Fclass%2F/);
  assert.match(page, /\/login\/\?mode=join&amp;next=%2Fai101%2Fclass%2F/);
});
test('the DOM contract', () => {
  for (const id of ['joinRoom', 'joinNote', 'prog', 'progBar', 'bOut', 'bMissing', 'bCopy', 'bClear', 'toyIn', 'toyOut', 'toyN', 'reviewForm', 'review'])
    assert.match(page, new RegExp(`id="${id}"`), id);
  assert.equal((page.match(/data-step="/g) || []).length, 7);
  assert.equal((page.match(/data-pick-tool="/g) || []).length, 3);
  for (const k of ['role', 'task', 'context', 'format', 'example']) assert.match(page, new RegExp(`data-b="${k}"`));
  assert.match(page, /data-pulse="before"/); assert.match(page, /data-pulse="after"/);
  assert.equal((page.match(/name="stars"/g) || []).length, 5);
});
test('every library prompt is on the page with a copy button', () => {
  assert.ok((page.match(/data-copy/g) || []).length >= 30 + 10);
});
// The private list (the Eventbrite code, anything else that must never be public) lives in public-copy-guard.local,
// which git ignores, so the repo never names it. These tests use a throwaway list with a made-up code.
const guardRun = (s, guard) => { try { execFileSync('python3', ['-c', `from build_ai101_class import check_public_copy; check_public_copy(${JSON.stringify(s)})`], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, ...(guard ? { PUBLIC_COPY_GUARD: guard } : {}) } }); return 'ok'; } catch (e) { return 'refused'; } };
const tmpGuard = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')); const f = path.join(d, 'guard.local'); fs.writeFileSync(f, '# a test list\n\\bZZTEST42\\b\ta made-up code\n'); return f; };
test('the built pages pass the guard (with the private list, when this machine has it)', () => {
  for (const f of ['ai101/class/index.html', 'ai101/class/stage/index.html']) assert.equal(guardRun(fs.readFileSync(ROOT + f, 'utf8')), 'ok', f);
});
test('check_public_copy refuses a bad page, and reads the private list from PUBLIC_COPY_GUARD', () => {
  const g = tmpGuard();
  assert.equal(guardRun('only $65 tonight', g), 'refused');
  assert.equal(guardRun('code ZZTEST42 at checkout', g), 'refused');
  assert.equal(guardRun('/room/?k=abc123', g), 'refused');
  assert.equal(guardRun('<a href="/room/?x=1&amp;k=abc123">', g), 'refused', 'an escaped & still counts');
  assert.equal(guardRun('a fine page about /ai101/', g), 'ok');
});
test('no course, build or test file names a code from the private list', () => {
  const g = ROOT + 'public-copy-guard.local';
  if (!fs.existsSync(g)) return; // the list lives only on Nelson's machine
  const pats = fs.readFileSync(g, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => new RegExp(l.split('\t')[0]));
  const files = ['ai101_course.py', 'build_ai101_class.py', 'build_prompt_kit.py', 'build_reviews.py',
    ...fs.readdirSync(ROOT + 'tests/academy').filter((f) => f.endsWith('.mjs')).map((f) => 'tests/academy/' + f),
    ...fs.readdirSync(ROOT + 'tests/academy/e2e').filter((f) => /\.m?js$/.test(f)).map((f) => 'tests/academy/e2e/' + f)];
  // a regex literal like /\\bCODE\\b/ has no word boundary before CODE, so read every \\b as a space first
  for (const f of files) for (const p of pats) assert.doesNotMatch(fs.readFileSync(ROOT + f, 'utf8').replace(/\\b/g, ' '), p, f);
});
test('the replay page points to the class page', () => {
  const replay = fs.readFileSync(ROOT + 'ai101/replay/index.html', 'utf8');
  assert.match(replay, /href="\/ai101\/class\/"/);
});

// ---- final-review fixes (10/6) ----
const stage = fs.readFileSync(ROOT + 'ai101/class/stage/index.html', 'utf8');
const between = (html, a, b) => { const i = html.indexOf(a); return i < 0 ? '' : html.slice(i, html.indexOf(b, i + a.length)); };
const group = (kind) => between(page, `data-pulse="${kind}"`, 'data-pulse='); // one tap group, up to the next one
test('every Copy button has its own name, starting with the word Copy', () => {
  const names = [...page.matchAll(/<button[^>]*data-copy[^>]*>/g)].map((m) => (m[0].match(/aria-label="([^"]*)"/) || [])[1]);
  assert.ok(names.length >= 40);
  assert.ok(names.every((n) => n && n.startsWith('Copy: ')), 'every Copy button is named');
  assert.equal(new Set(names).size, names.length, 'no two Copy buttons share a name');
});
test('[BRACKETS] are marked so people see what to swap; copy still reads the plain text', () => {
  assert.match(page, /<mark class="ph">\[YOUR FIRST NAME\]<\/mark>/);
});
test('the 1-5 scale: names say where each number sits, the ends are words, the note says how it is used', () => {
  const g = group('before');
  assert.match(g, /aria-label="1 of 5, not at all confident"/); assert.match(g, /aria-label="5 of 5, very confident"/); assert.match(g, /aria-label="3 of 5"/);
  assert.match(page, /Your answer stays private\. I only share totals\./);
});
test('practice taps and the 3 questions sit with the after tap, before the review', () => {
  const r = between(page, 'id="review"', '</section>');
  for (const k of ['after', 'useful', 'steered', 'chk_safe', 'chk_verify', 'chk_prompt']) assert.match(r, new RegExp(`data-pulse="${k}"`), k);
  assert.ok(r.indexOf('data-pulse="after"') < r.indexOf('id="reviewForm"'));
  assert.match(r, /7:41/);
  assert.equal((group('useful').match(/data-score=/g) || []).length, 3);
  assert.equal((group('steered').match(/data-score=/g) || []).length, 2);
  assert.equal((group('chk_verify').match(/data-score=/g) || []).length, 3);
  assert.match(page, /data-pulse="chk_safe"[^>]*data-right="2"/);
});
test('each instruction sits right above its copy box', () => {
  assert.match(page, /Now send your first message\.[^<]*<\/p><figure class="a1c-pr">/);
  assert.match(page, /Then ask what to check/);
  assert.match(page, /Not a business owner\? Same five parts, a different life\./);
});
test('safe use: the slip line; the token toy label reads whole', () => {
  assert.match(page, /Pasted something by mistake\? Delete that chat\./);
  assert.match(page, /tokens <span>\(an estimate\. Every AI splits words a little differently\.\)<\/span>/);
  assert.doesNotMatch(page, /id="toyOut"[^>]*aria-live/);
  assert.match(page, /id="toySay"[^>]*role="status"/);
});
test('review form: stars read as numbers, the rating is spoken, the consent sentence stays whole, errors have a target', () => {
  const f = between(page, 'id="reviewForm"', '</form>');
  assert.match(f, /<span aria-hidden="true">★<\/span>/);
  assert.match(f, /class="a1c-stars-val" aria-live="polite"/);
  assert.match(f, /<label class="a1c-consent"><input[^>]*><span>Show my review on taylormadeacademy\.com as <b data-shows-as>/);
  assert.match(f, /id="rvMsg"/);
});
test('a status line shows while the sign-in check runs', () => {
  assert.match(page, /<main class="a1c">\s*<p id="loading" class="a1c-loading" role="status">/);
});
test('one gold bar, one word', () => {
  const bars = [...page.matchAll(/<span class="u-gold">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.ok(bars.length >= 4);
  for (const b of bars) assert.doesNotMatch(b.trim(), /\s/, `"${b}" is more than one word`);
});
test('a company can raise a hand; access is stated plainly', () => {
  assert.match(between(page, 'id="next"', '</section>'), /with the word TEAM/);
  assert.match(page, /doesn&#x27;t have live captions yet/);
});
test('links that open a new tab say so; the room opens in its own tab', () => {
  assert.match(page, /id="joinRoom"[^>]*target="_blank"/);
  const main = between(page, '<main class="a1c">', '</main>'); // the class page's own links (the site footer is site-wide)
  const ext = [...main.matchAll(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.ok(ext.length >= 4 && ext.every((a) => /opens in a new tab/.test(a)), 'each new-tab link carries a hidden note');
});
test('start here points at the first tap; landmarks and lists are labelled', () => {
  assert.match(page, /<a href="#step-hi"[^>]*>Go to Step 1<\/a>/);
  assert.match(page, /aria-label="Follow Nelson \(top\)"/); assert.match(page, /aria-label="Follow Nelson \(bottom\)"/);
  for (const c of ['a1c-start', 'a1c-steps', 'a1c-parts', 'a1c-chips', 'a1c-ups']) assert.match(page, new RegExp(`class="${c}" role="list"`), c);
  assert.match(page, /class="a1c-ups"[\s\S]*?<h4>/, 'level-up items are h4 under their h3');
});
test('the phone diagram has a name', () => {
  assert.match(page, /<svg class="dg-v"[^>]*role="img" aria-labelledby="a1dt"/);
  assert.doesNotMatch(page, /<svg class="dg-v"[^>]*aria-hidden/);
});
test('stage: the chat loop line and its arrowhead are their own shapes (no marker)', () => {
  const chat = between(stage, 'data-id="chat"', '</section>');
  assert.match(chat, /class="ch-line"/); assert.match(chat, /class="ch-head"/); assert.doesNotMatch(chat, /<marker/);
});
test('stage: QR codes for the class page, Instagram AND the Facebook group; the next workshop gets one too', () => {
  const qrs = (id) => (between(stage, `data-id="${id}"`, '</section>').match(/class="qr-card/g) || []).length;
  assert.equal(qrs('soon'), 3); assert.equal(qrs('follow'), 2); assert.equal(qrs('bye'), 3); assert.equal(qrs('next'), 1);
  assert.match(between(stage, 'data-id="bye"', '</section>'), /QR code for the Taylormade Academy Facebook group/);
  assert.doesNotMatch(stage, /and join the Facebook group<\/figcaption>/, 'an Instagram QR never promises the Facebook group');
});
test('stage: the time checks come from the event date; practice is 11:00; the guesses are labelled', () => {
  assert.match(stage, /<div class="stg" id="stg" data-date="2026-10-09">/);
  assert.match(stage, /data-timer="660">11:00</);
  assert.match(stage, /Example guesses, not real numbers\./);
});
test('/ai101/ promises the cheat sheet in class, not in the sign-up email', () => {
  const signup = fs.readFileSync(ROOT + 'ai101/index.html', 'utf8');
  assert.doesNotMatch(signup, /It comes in your sign-up email/);
  assert.match(signup, /You get it in class/);
});
