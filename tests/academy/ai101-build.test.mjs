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

test('noindex, own stylesheet, starts on Claude and on Mac (the script switches to Windows when the browser says so)', () => {
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.match(page, /\/css\/ai101-class\.css\?v=/);
  assert.match(page, /<html lang="en" data-tool="claude" data-os="mac">/);
});
test('Step 2: a Mac | Windows switch and one install card per tool x computer, each with its download button', () => {
  assert.equal((page.match(/data-pick-os="/g) || []).length, 2);
  assert.match(page, /role="group" aria-label="Which computer are you using\?"/);
  assert.match(page, /id="osSay" role="status"/);
  assert.equal((page.match(/class="a1c-install" data-for="/g) || []).length, 6);
  for (const t of ['claude', 'chatgpt', 'gemini']) for (const o of ['mac', 'windows']) assert.match(page, new RegExp(`class="a1c-install" data-for="${t}" data-os-for="${o}"`), `${t}/${o}`);
  assert.match(page, /href="https:\/\/claude\.ai\/download" target="_blank" rel="noopener">Open claude\.ai\/download/);
  assert.match(page, /class="a1c-love"/);
  assert.match(page, /<a href="#step-laptop" class="textlink">Go to Step 2<\/a>/);
});
test('Step 3 opens with the trust warning, and hallucination is in its word list', () => {
  const step3 = between(page, 'id="step-words"', '</li>\n<li class="a1c-step"');
  const body = step3.slice(step3.indexOf('class="a1c-step-b"'));
  assert.match(body, /^class="a1c-step-b"><div class="a1c-trust" role="note"><p class="a1c-trust-h">Never trust AI blindly\.<\/p>/);
  assert.match(step3, /<dt>Hallucination<\/dt>/);
  assert.match(page, /<h3>One rule before you start<\/h3>/);
});
test("Step 2 shows each AI's strong suit, all three at once, after Don't fall in love", () => {
  const step2 = between(page, 'id="step-laptop"', '</li>\n<li class="a1c-step"');
  assert.match(step2, /class="a1c-suits"/);
  for (const t of ['claude', 'chatgpt', 'gemini']) assert.match(step2, new RegExp(`class="a1c-suit" data-suit="${t}"`), t);
  assert.ok(!/class="a1c-suit" data-for=/.test(page), 'not tied to the AI switch: everyone sees all three');
  assert.equal((step2.match(/Nelson&#x27;s pick for/g) || []).length, 3);
  assert.ok(step2.indexOf('class="a1c-love"') < step2.indexOf('class="a1c-suits"'));
});
test('Step 2 also sets up the account: one card per AI, with the AI switch right there', () => {
  const step2 = between(page, 'id="step-laptop"', '</li>\n<li class="a1c-step"');
  assert.match(step2, /class="a1c-picks"/);
  assert.equal((step2.match(/data-pick-tool="/g) || []).length, 3, 'the AI switch sits in Step 2');
  for (const t of ['claude', 'chatgpt', 'gemini']) assert.match(step2, new RegExp(`class="a1c-setup" data-for="${t}"`), t);
  assert.match(step2, /Set up your free Claude account/); assert.match(step2, /Set up your free ChatGPT account/);
  assert.ok(step2.indexOf('class="a1c-install"') < step2.indexOf('class="a1c-setup"'), 'install first, then setup');
  assert.match(page, /<a href="#step-laptop" class="textlink">Every setup step is in Step 2<\/a>/);
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
  assert.equal((page.match(/data-step="/g) || []).length, 8);
  assert.match(page, /0 of 8 steps done/);
  assert.equal((page.match(/data-pick-tool="/g) || []).length, 6, 'the AI switch in Start here, and again in Step 2');
  for (const k of ['role', 'task', 'context', 'format', 'example']) assert.match(page, new RegExp(`data-b="${k}"`));
  assert.match(page, /data-pulse="before"/); assert.match(page, /data-pulse="after"/);
  assert.equal((page.match(/name="stars"/g) || []).length, 5);
});
test('every library prompt is on the page with a copy button', () => {
  assert.ok((page.match(/data-copy/g) || []).length >= 30 + 10);
});
// The private list (the Eventbrite code, anything else that must never be public) lives in public-copy-guard.local,
// which git ignores, so the repo never names it. These tests use a throwaway list with a made-up code.
const guardRun = (s, guard, stage = false) => { try { execFileSync('python3', ['-c', `from build_ai101_class import check_public_copy; check_public_copy(${JSON.stringify(s)}, allow_list_price=${stage ? 'True' : 'False'})`], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, ...(guard ? { PUBLIC_COPY_GUARD: guard } : {}) } }); return 'ok'; } catch (e) { return 'refused'; } };
const tmpGuard = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')); const f = path.join(d, 'guard.local'); fs.writeFileSync(f, '# a test list\n\\bZZTEST42\\b\ta made-up code\n'); return f; };
test('the built pages pass the guard (with the private list, when this machine has it)', () => {
  assert.equal(guardRun(fs.readFileSync(ROOT + 'ai101/class/index.html', 'utf8')), 'ok', 'the class page: no list-only price, no code');
  assert.equal(guardRun(fs.readFileSync(ROOT + 'ai101/class/stage/index.html', 'utf8'), null, true), 'ok', 'the stage: the price is allowed (Nelson 10/8), nothing else');
});
test("the 48-hour deal (Nelson 10/8): the stage names $65 vs $75; the class page says 48 hours without the number; the code is refused everywhere", () => {
  const stage = fs.readFileSync(ROOT + 'ai101/class/stage/index.html', 'utf8');
  assert.match(stage, /class="nx-deal"><b>Because you came tonight<\/b>\$65 instead of \$75, for 48 hours only\./);
  assert.match(stage, /class="by-deal"[^>]*>Watch your email at 9 PM tonight: your \$65 price/);
  assert.match(page, /class="a1c-lead a1c-deal"><b>Because you came tonight:<\/b> you get a lower price on it, for 48 hours only\./);
  assert.doesNotMatch(page, /\$\s?65\b/);
  assert.equal(guardRun(stage, null, false), 'refused', 'the strict guard still sees the price on the stage');
  const g = tmpGuard();
  assert.equal(guardRun('$65 tonight, code ZZTEST42', g, true), 'refused', 'the stage allowance never lets the code through');
  assert.equal(guardRun('/room/?k=abc123', g, true), 'refused', 'or a room key');
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
  assert.match(r, /7:45/);
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
test('stage (10/9): the chats happen in real-looking apps: Claude for How a chat works, ChatGPT for Steer it', () => {
  const chat = between(stage, 'data-id="chat"', '</section>'), steer = between(stage, 'data-id="steer"', '</section>');
  assert.match(chat, /class="aw cl ch-app"/); assert.match(chat, /class="cl-send"/); assert.match(chat, /class="cl-model">Sonnet 5\.5/);
  assert.match(steer, /class="aw gp st-app"/); assert.match(steer, /class="gp-ph">Ask ChatGPT/);
  const models = between(stage, 'data-id="models"', '</section>');
  for (const n of ['Fable 5.1', 'Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5']) assert.match(models, new RegExp(n.replace('.', '\\.')));
  assert.doesNotMatch(stage, /\b(Astra|Luna)\b/, 'no ChatGPT model names on the stage until Nelson confirms them on his screen');
});
test('stage: QR codes for the class page, Instagram AND the Facebook group; the next workshop gets one too', () => {
  const qrs = (id) => (between(stage, `data-id="${id}"`, '</section>').match(/class="qr-card/g) || []).length;
  assert.equal(qrs('soon'), 3); assert.equal(qrs('follow'), 2); assert.equal(qrs('bye'), 2); assert.match(between(stage, 'data-id="bye"', '</section>'), /class="by-qr"><svg role="img" aria-label="QR code to leave a review"/); // 10/9: the review QR sits in its gold card assert.equal(qrs('next'), 1);
  assert.match(between(stage, 'data-id="bye"', '</section>'), /QR code for the Taylormade Academy Facebook group/);
  assert.doesNotMatch(stage, /and join the Facebook group<\/figcaption>/, 'an Instagram QR never promises the Facebook group');
});
test('stage: the time checks come from the event date; practice is 11:00; the guesses are labelled', () => {
  assert.match(stage, /<div class="stg" id="stg" data-date="2026-10-09">/);
  assert.match(stage, /data-timer="660">11:00</);
  assert.match(stage, /How likely each next word is\. Example numbers, not real ones\./);
});
test('/ai101/ promises the cheat sheet in class, not in the sign-up email', () => {
  const signup = fs.readFileSync(ROOT + 'ai101/index.html', 'utf8');
  assert.doesNotMatch(signup, /It comes in your sign-up email/);
  assert.match(signup, /You get it in class/);
});
test("real app screens (Nelson 10/9): one figure per tool that has a file, switched by the AI switch, hashed for the cache-first service worker", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a1c-shots-'));
  const py = `
import pathlib, build_ai101_class as b
from PIL import Image
d = pathlib.Path(${JSON.stringify(dir)})
for t in ("claude", "chatgpt"): Image.new("RGB", (1400, 800), "white").save(d / f"{t}-chat.webp")
b.SHOT_DIR = d
print(b.shot("chat")); print("---"); print(b.shot("facts"))`;
  const [chat, facts] = execFileSync('python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' }).split('---');
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal((chat.match(/<figure class="a1c-shot" data-for="/g) || []).length, 2, 'Gemini has no file, so no figure');
  assert.match(chat, /data-for="claude"><a href="\/ai101\/class\/shots\/claude-chat\.webp\?v=[0-9a-f]{10}" target="_blank" rel="noopener"><img src="\/ai101\/class\/shots\/claude-chat\.webp\?v=[0-9a-f]{10}" width="1400" height="800" alt="Claude with a new chat open\./);
  assert.match(chat, /loading="lazy"/);
  assert.match(chat, /the full-size screen, opens in a new tab/);
  assert.match(chat, /A real screen from October 9, 2026\. Yours may look a little different\./);
  assert.equal(facts.trim(), '', 'no files, no markup');
});
test('every screen on the class page is a real file, sits in its step, and only the picked AI shows', () => {
  const shots = [...page.matchAll(/<figure class="a1c-shot" data-for="(\w+)"><a href="\/ai101\/class\/shots\/([\w-]+\.webp)\?v=/g)];
  for (const [, t, f] of shots) { assert.ok(fs.existsSync(ROOT + 'ai101/class/shots/' + f), f); assert.ok(f.startsWith(t + '-'), f); }
  const where = { chat: 'words', prompt5: 'prompt5', steer: 'steer', facts: 'check', save: 'save', models: 'words' };
  for (const [, , f] of shots) {
    const key = f.replace(/^\w+-|\.webp$/g, '');
    assert.ok(between(page, `id="step-${where[key]}"`, '<li class="a1c-step"').includes(f), `${f} sits in step ${where[key]}`);
  }
});
test("Step 3 ends with Pick a model (MODELS, the stage's words): Claude's four models with their plan, bigger vs smaller, the rule, and Claude's real menu", () => {
  const step3 = between(page, 'id="step-words"', '<li class="a1c-step"');
  const m = between(step3, '<section class="a1c-models"', '</section>');
  assert.ok(m, 'the block is in Step 3');
  assert.ok(step3.indexOf('class="a1c-models"') > step3.indexOf('<dl'), 'after the word list (Model is one of the words)');
  for (const [n, plan] of [['Fable 5.1', 'Paid plans'], ['Opus 5.5', 'Paid plans'], ['Sonnet 5.5', 'Free'], ['Haiku 5.5', 'Free']]) assert.match(m, new RegExp(`<b>${n.replace('.', '\\.')}</b> <span>[^<]+</span> <em class="(free|paid)">${plan}</em>`), n);
  assert.match(m, /<b>Bigger<\/b> thinks harder/);
  assert.match(m, /Not sure\? Use the one it picks for you\./);
  assert.match(m, /<figure class="a1c-shot" data-for="claude"><a href="\/ai101\/class\/shots\/claude-models\.webp\?v=/);
  assert.doesNotMatch(m, /Astra|Luna|\bSol\b/, 'no ChatGPT model names: his ChatGPT shows a Thinking effort slider');
});
test("Step 3 ends with Frontier models and AGI: the stage's mountain at its end state, both words in full, the rule", () => {
  const step3 = between(page, 'id="step-words"', '<li class="a1c-step"');
  const f = between(step3, '<section class="a1c-frontier"', '</section>');
  assert.ok(f, 'the card is in Step 3');
  assert.ok(step3.indexOf('class="a1c-frontier"') > step3.indexOf('class="a1c-models"'), 'after Pick a model');
  assert.match(f, /<svg class="fr-art" viewBox="0 0 1080 720"[^>]* role="img" aria-label="A mountain at night\./);
  assert.match(f, /<g class="fr-line" data-y0="470" transform="translate\(0 300\)">/, 'the line at its end height');
  assert.match(f, /<dt>Frontier model<\/dt><dd>One of the most capable AI models right now/);
  assert.match(f, /<dt>AGI<\/dt><dd>Artificial general intelligence: a future AI that could learn and do any thinking task a person can\. It doesn&#x27;t exist yet\./);
  assert.match(f, /Use the newest one\. Ignore the hype\. Check its work\./);
  assert.match(step3, /<dt>Frontier model<\/dt>[\s\S]*<dt>AGI<\/dt>/, 'both words are in the word list too');
});
test('the 2026 words fold closed after the frontier card: 16 terms in three groups, and the ask-your-AI tip', () => {
  const step3 = between(page, 'id="step-words"', '<li class="a1c-step"');
  const g = between(step3, '<details class="a1c-gloss">', '</details>');
  assert.ok(g, 'in Step 3, closed by default (no open attribute)');
  assert.ok(step3.indexOf('class="a1c-gloss"') > step3.indexOf('class="a1c-frontier"'), 'after the frontier card');
  assert.match(g, /<summary>More AI words for 2026 <span>16 words<\/span><\/summary>/);
  assert.equal((g.match(/<dt>/g) || []).length, 16);
  assert.deepEqual([...g.matchAll(/<h4>([^<]+)<\/h4>/g)].map((m) => m[1]), ['The big ideas', 'Working with AI', 'Under the hood']);
  assert.match(g, /<dt>MCP \(Model Context Protocol\)<\/dt><dd>An open standard that lets AI apps plug into other tools and data\./);
  assert.match(g, /Explain <mark class="ph">\[the word\]<\/mark> like I&#x27;m brand new to it/);
});
