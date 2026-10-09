// tests/academy/e2e/ai101-stage.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/ai101-stage.e2e.mjs
// Serves the worktree, opens /ai101/class/stage/ signed in (fake supabase), and checks the engine:
// scaling, keys, rapid presses never leave a half-drawn scene, reduced motion shows the end state.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-supabase.js', import.meta.url));
const PORT = 8781;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1920, height: 1080 }, serviceWorkers: 'block', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ path: FAKE, contentType: 'text/javascript' }));
  await ctx.addInitScript(({ session, authError }) => { window.FAKE_SESSION = session; window.FAKE_AUTH_ERROR = authError; },
    { session: 'session' in opts ? opts.session : { user: { id: 'u1', email: 'a@b.c', user_metadata: { full_name: 'Test Person' } } }, authError: !!opts.authError });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  await p.goto(`http://localhost:${PORT}/ai101/class/stage/` + (opts.hash || ''));
  await p.waitForFunction(() => window.__stage && window.__stage.ready);
  return p;
}
try {
  const p = await page();
  await p.waitForTimeout(300); // the sign-in check is async
  assert.equal(await p.$eval('#stgGate', (g) => getComputedStyle(g).display), 'none', 'signed in: the stage is not covered');
  const out = await page({ session: null });
  await out.waitForFunction(() => getComputedStyle(document.getElementById('stgGate')).display !== 'none');
  // a part's underline never shows before its beat (a zero-length reveal on a beat boundary fires a beat early)
  await p.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  await p.waitForTimeout(2200);
  const segVis = () => p.$$eval('.sc-prompt5 .p5-seg', (els) => els.map((e) => +getComputedStyle(e).opacity > 0.5));
  assert.deepEqual(await segVis(), [false, false, false, false, false], 'end of beat 0: no part shown yet');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1400);
  assert.deepEqual(await segVis(), [true, false, false, false, false], 'end of beat 1: only Role');
  // jump to the sample scene and step through its beats
  await p.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(900); }
  assert.equal(await p.evaluate(() => window.__stage.pos().beat), 6, 'six presses reach the last beat of prompt5');
  const seg = await p.$$eval('.sc-prompt5 .p5-seg', (els) => els.map((e) => getComputedStyle(e).opacity));
  assert.ok(seg.every((o) => +o > 0.99), 'all five parts drawn');
  // mash the key: 20 presses with no wait, then everything visible must be fully drawn
  await p.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  for (let i = 0; i < 20; i++) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(1500);
  const half = await p.$$eval('.scene.on [data-anim]', (els) => els.filter((e) => +getComputedStyle(e).opacity < 0.99).length);
  assert.equal(half, 0, 'no half-drawn element after mashing');
  // back key returns to the previous beat's END state instantly
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(100);
  // scaling: 1280x720 still shows the whole 1920x1080 canvas
  const small = await page({ viewport: { width: 1280, height: 720 } });
  const box = await small.$eval('.stg-canvas', (e) => e.getBoundingClientRect().toJSON());
  assert.ok(Math.abs(box.width - 1280) < 2 && Math.abs(box.height - 720) < 2, 'canvas scales to the window');
  // reduced motion: entering prompt5 at its last beat shows the final state with no tween
  const rm = await page({ reduced: true });
  await rm.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  for (let i = 0; i < 6; i++) await rm.keyboard.press('ArrowRight');
  const foot = await rm.$eval('.sc-prompt5 .p5-foot', (e) => +getComputedStyle(e).opacity);
  assert.ok(foot > 0.99, 'reduced motion lands on the drawn state');
  // walk the whole deck: every scene, every beat, then check each scene's [data-beat] elements are fully drawn
  const w = await page();
  const n = await w.evaluate(() => document.querySelectorAll('.scene').length);
  assert.equal(n, 19, 'nineteen scenes (10/8: + laptop, nolove, strengths)');
  for (let s = 0; s < n; s++) {
    await w.evaluate((i) => window.__stage.go(i), s);
    const beats = await w.evaluate((i) => +document.querySelectorAll('.scene')[i].dataset.beats, s);
    for (let b = 1; b < beats; b++) { await w.waitForTimeout(1300); await w.keyboard.press('ArrowRight'); }
    await w.waitForTimeout(2600);
    const id = await w.evaluate(() => document.querySelector('.scene.on').dataset.id);
    const faint = await w.$$eval('.scene.on [data-beat]', (els) => els.filter((e) => +getComputedStyle(e).opacity < 0.99).map((e) => e.className));
    assert.deepEqual(faint, [], `scene ${id}: every beat element drawn`);
  }
  // the timer counts down on its scene, keeps counting if you step away and come back, and R restarts it
  // (the walk above already started this scene's clock, and it kept running: that is the point)
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('yourturn')));
  await w.waitForTimeout(300);
  assert.match(await w.textContent('[data-timer="660"]'), /^10:[0-4]\d$/, 'the practice clock kept counting since the walk');
  await w.keyboard.press('r'); await w.waitForTimeout(1200);
  assert.match(await w.textContent('[data-timer="660"]'), /^10:5\d$|^11:00$/, 'R restarts it');
  await w.waitForTimeout(1500);
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('qa')));
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('yourturn')));
  await w.waitForTimeout(300);
  assert.match(await w.textContent('[data-timer="660"]'), /^10:5[0-8]$/, 'coming back does not restart the practice clock (a restart would read 11:00 or 10:59)');

  // ---- final-review fixes (10/6) ----
  // nothing from a later beat is on screen at the end of beat 0 (the chat loop drew itself before the answer existed)
  for (let s = 0; s < n; s++) {
    await w.evaluate((i) => window.__stage.go(i), s);
    await w.waitForTimeout(2600);
    const id = await w.evaluate(() => document.querySelector('.scene.on').dataset.id);
    const early = await w.$$eval('.scene.on [data-beat]', (els) => els.filter((e) => +e.dataset.beat > 0 && +getComputedStyle(e).opacity > 0.01).map((e) => e.className));
    assert.deepEqual(early, [], `scene ${id}: a later beat is already showing at the end of beat 0`);
  }
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('chat')));
  await w.waitForTimeout(2600);
  const loop = () => w.evaluate(() => { const l = document.querySelector('.ch-line'), h = document.querySelector('.ch-head');
    return { off: parseFloat(getComputedStyle(l).strokeDashoffset) || 0, len: l.getTotalLength(), head: +getComputedStyle(h).opacity }; });
  let L = await loop();
  assert.ok(L.off > L.len * 0.9 && L.head < 0.01, 'chat, beat 0: the loop is not drawn yet');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2600);
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2000);
  L = await loop();
  assert.ok(L.off < 1 && L.head > 0.99, 'chat, beat 2: the loop draws back to You, arrowhead last');
  // 10/8 (Nelson): the answer can't appear with nothing typed. The prompt stays in the You card after it flies to the AI.
  const typed = await w.evaluate(() => { const t = document.querySelector('.sc-chat .ch-you .ch-typed');
    return t ? { text: t.textContent.replace(/\s+/g, ' ').trim(), op: +getComputedStyle(t).opacity, words: [...t.querySelectorAll('.w')].every((x) => +getComputedStyle(x).opacity > 0.99) } : null; });
  assert.deepEqual(typed, { text: 'Write a thank-you note to my neighbor.', op: 1, words: true }, 'chat, beat 2: the prompt is still in the You card');
  // 10/9 (Nelson): "actually show the reply that makes it better". The first answer has blanks it can't fill; the reply types in
  // under the prompt; the better answer uses every fact from the reply, lit up. Back steps it all away again.
  const chatState = () => w.evaluate(() => { const q = (c) => document.querySelector('.sc-chat ' + c), vis = (el) => +getComputedStyle(el).opacity > 0.99 && getComputedStyle(el).visibility !== 'hidden';
    const shown = (el) => vis(el) && [...el.querySelectorAll('.w')].every((x) => vis(x));
    return { reply: shown(q('.ch-reply')), v1: shown(q('.ch-ans-text.v1')), v2: shown(q('.ch-ans-text.v2')), h1: vis(q('.ch-h1')), h2: vis(q('.ch-h2')),
      blanks: q('.ch-ans-text.v1').textContent.includes('[Your name]'), lit: [...document.querySelectorAll('.sc-chat .ch-new')].map((m) => getComputedStyle(m).backgroundColor !== 'rgba(253, 201, 33, 0)' && m.textContent.replace(/\s+/g, ' ').trim()) }; });
  let C = await chatState();
  assert.deepEqual([C.reply, C.v1, C.v2, C.h1, C.h2, C.blanks], [false, true, false, true, false, true], 'chat, beat 2: the bland note with blanks, no reply yet ' + JSON.stringify(C));
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3600);
  C = await chatState();
  assert.deepEqual([C.reply, C.v1, C.v2], [true, true, false], 'chat, beat 3: the reply types in under the prompt; the answer has not changed yet ' + JSON.stringify(C));
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3200);
  C = await chatState();
  assert.deepEqual([C.reply, C.v1, C.v2, C.h1, C.h2], [true, false, true, false, true], 'chat, beat 4: the better answer replaces the bland one ' + JSON.stringify(C));
  assert.deepEqual(C.lit, ['Rosa', 'watering my plants while I was away', 'Nelson'], 'chat, beat 4: every fact from the reply is in the better answer, lit up');
  await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400); await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400);
  C = await chatState();
  assert.deepEqual([C.reply, C.v1, C.v2, C.h1, C.h2], [false, true, false, true, false], 'chat, back to beat 2: the reply and the better answer step away ' + JSON.stringify(C));
  // 10/8 (Nelson): "when it said write it as if my grandmother is talking nothing changed". The grandmother answer must SOUND like
  // a grandmother talking (not "my grandmother's recipe", which is the grandchild), and stay short after "Make it shorter".
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('steer')));
  await w.waitForTimeout(1500); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1500); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  const gm = await w.evaluate(() => { const v = document.querySelector('.st-v.v2'); const t = v.textContent.trim();
    return { op: +getComputedStyle(v).opacity, honey: /\b(honey|sugar|baby)\b/i.test(t), grandchild: /my grandmother's/i.test(t), words: t.split(/\s+/).length,
      shown: +document.querySelector('.st-n').textContent, short: document.querySelector('.st-v.v1').textContent.trim().split(/\s+/).length }; });
  assert.ok(gm.op > 0.99 && gm.honey && !gm.grandchild, 'steer, beat 2: the answer is in a grandmother\'s voice ' + JSON.stringify(gm));
  assert.equal(gm.shown, gm.words, 'the word count matches the answer on screen');
  assert.ok(gm.words <= gm.short + 10, 'still short after "Make it shorter" ' + JSON.stringify(gm));
  // 10/8 (Nelson): hallucination up front. The words scene's last click brings up "Never trust it blindly."
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('words')));
  for (let i = 0; i < 4; i++) { await w.waitForTimeout(1100); await w.keyboard.press('ArrowRight'); }
  await w.waitForTimeout(1400);
  assert.equal(await w.evaluate(() => +getComputedStyle(document.querySelector('.wd-warn')).opacity), 1, 'words, last click: the hallucination warning');
  assert.match(await w.textContent('.wd-warn'), /Never trust it blindly/);
  // 10/8 (Nelson): the context window, rebuilt. End: the first message (Ann's name) has fallen out, the window says Full.
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('window')));
  for (let i = 0; i < 2; i++) { await w.waitForTimeout(2600); await w.keyboard.press('ArrowRight'); }
  await w.waitForTimeout(3000);
  const wn = await w.evaluate(() => { const m = [...document.querySelectorAll('.wn-msg')].map((x) => +getComputedStyle(x).opacity);
    return { first: m[0], last: m.at(-1), full: +getComputedStyle(document.querySelector('.wn-full')).opacity, n: +document.querySelector('.wn-n').textContent,
      costs: +getComputedStyle(document.querySelector('.wn-costs')).opacity }; });
  assert.ok(wn.first < 0.2 && wn.last > 0.99 && wn.full > 0.99 && wn.n > 40 && wn.costs > 0.99, 'window, end: the start fell out, Full, the costs showing ' + JSON.stringify(wn));
  // 10/8 (Nelson): the next-word scene explains itself, then turns into Never paste
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('check')));
  await w.waitForTimeout(3200); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  const ex = () => w.evaluate(() => ['.ck-how', '.ck-why', '.ck-explain', '.ck-safe'].map((q) => +(+getComputedStyle(document.querySelector(q)).opacity).toFixed(2)));
  assert.deepEqual(await ex(), [1, 1, 1, 0], 'check, beat 2: how it guesses + why it goes wrong');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1500); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  assert.deepEqual((await ex()).slice(2), [0, 1], 'check, last beat: the explanation gives way to Never paste');
  // a held key (auto-repeat) never skips beats
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  const before = await w.evaluate(() => window.__stage.pos());
  await w.evaluate(() => { for (let i = 0; i < 5; i++) dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true })); });
  assert.deepEqual(await w.evaluate(() => window.__stage.pos()), before, 'auto-repeat ignored');
  // the time checks come from the page (the event date), and include the 7:23 early warning (10/8: +4 min for the laptop step)
  const checks = await w.evaluate(() => window.__stage.checks);
  assert.ok(checks.every((c) => c.date === '2026-10-09'));
  assert.deepEqual(checks.map((c) => c.id), ['steer', 'yourturn', 'qa', 'next']);
  assert.deepEqual(checks.map((c) => c.at), [19 * 60 + 23, 19 * 60 + 34, 19 * 60 + 45, 19 * 60 + 56]);
  // ---- laptop + nolove (10/8) ----
  const order = await w.evaluate(() => [...document.querySelectorAll('.scene')].map((e) => e.dataset.id).slice(0, 7));
  assert.deepEqual(order, ['soon', 'title', 'follow', 'laptop', 'nolove', 'strengths', 'chat'], 'the laptop step comes right after Follow me, then each AI\'s strong suit');
  const lp = () => w.evaluate(() => {
    const op = (sel) => +getComputedStyle(document.querySelector(sel)).opacity;
    return { knob: new DOMMatrix(getComputedStyle(document.querySelector('.lp-knob')).transform).m41, mac: op('.lp-steps.mac'), win: op('.lp-steps.win'),
      winRows: [...document.querySelectorAll('.lp-steps.win li')].map((li) => +getComputedStyle(li).opacity), web: op('.lp-web'),
      macLabel: getComputedStyle(document.querySelector('.lp-opt.mac')).color };
  });
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('laptop'))); await w.waitForTimeout(2200);
  let st = await lp();
  assert.ok(st.knob === 0 && st.mac > 0.99 && st.win < 0.01 && st.web < 0.01, 'laptop, beat 0: Mac steps only, switch on Mac ' + JSON.stringify(st));
  assert.equal(st.macLabel, 'rgb(255, 255, 255)');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2400);
  st = await lp();
  assert.ok(Math.abs(st.knob - 300) < 0.5 && st.mac < 0.01 && st.win > 0.99 && st.winRows.every((o) => o > 0.99) && st.web < 0.01, 'laptop, beat 1: the switch slid, Windows steps drawn ' + JSON.stringify(st));
  await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(300);
  st = await lp();
  assert.ok(st.knob === 0 && st.mac > 0.99 && st.win < 0.01, 'back from Windows lands on Mac again ' + JSON.stringify(st));
  await w.keyboard.press('ArrowRight'); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1500); // quick double press: beat 1 finishes, beat 2 plays
  assert.equal(await w.evaluate(() => document.querySelector('.scene.on').dataset.id), 'laptop');
  st = await lp();
  assert.ok(st.web > 0.99 && st.win > 0.99, 'laptop, beat 2: the website card');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1200);
  assert.equal(await w.evaluate(() => document.querySelector('.scene.on').dataset.id), 'nolove');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3200);
  const nl = await w.evaluate(() => ({ foot: +getComputedStyle(document.querySelector('.nl-foot')).opacity,
    xs: [...document.querySelectorAll('.nl-pill')].map((p) => Math.round(new DOMMatrix(getComputedStyle(p).transform).m41)),
    ys: [...document.querySelectorAll('.nl-pill')].map((p) => Math.round(new DOMMatrix(getComputedStyle(p).transform).m42)) }));
  assert.deepEqual(nl.xs, [760, -380, -380], 'the three traded places twice'); assert.deepEqual(nl.ys, [0, 0, 0], 'and landed back on the line');
  assert.ok(nl.foot > 0.99, 'Learn the skill, not the app.');
  const rmLp = await page({ reduced: true, hash: '#' + (await w.evaluate(() => window.__stage.indexOf('laptop'))) + '.2' });
  await rmLp.waitForTimeout(300);
  assert.ok(await rmLp.evaluate(() => +getComputedStyle(document.querySelector('.lp-steps.win')).opacity > 0.99 && +getComputedStyle(document.querySelector('.lp-web')).opacity > 0.99),
    'a reload on beat 2 (reduced motion) shows Windows and the website card');
  // a reload lands where you were
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('steer')));
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(300);
  assert.match(await w.evaluate(() => location.hash), /^#\d+\.1$/);
  await w.reload(); await w.waitForFunction(() => window.__stage && window.__stage.ready);
  assert.deepEqual(await w.evaluate(() => window.__stage.pos()), { scene: await w.evaluate(() => window.__stage.indexOf('steer')), beat: 1 });
  // sign-in trouble never covers the stage (fails open); signed out, the gate's link comes back to this spot
  const err = await page({ authError: true });
  await err.waitForTimeout(400);
  assert.equal(await err.$eval('#stgGate', (g) => getComputedStyle(g).display), 'none', 'getSession error: no gate');
  const out2 = await page({ session: null, hash: '#5.0' });
  await out2.waitForFunction(() => getComputedStyle(document.getElementById('stgGate')).display !== 'none');
  assert.match(await out2.$eval('#stgGate a', (a) => a.getAttribute('href')), /next=%2Fai101%2Fclass%2Fstage%2F%235\.0/);
  // ---- click controls (10/8): back / next / restart timer / full screen in the corner ----
  const c = await page();
  await c.evaluate(() => window.__stage.go(window.__stage.indexOf('steer')));
  await c.waitForTimeout(300);
  const at = () => c.evaluate(() => window.__stage.pos());
  const steerAt = await c.evaluate(() => window.__stage.indexOf('steer'));
  await c.click('#hudNext'); await c.waitForTimeout(300);
  assert.deepEqual(await at(), { scene: steerAt, beat: 1 }, 'the next button moves exactly one beat (not two: it is not also a slide click)');
  await c.keyboard.press(' '); await c.waitForTimeout(300);
  assert.deepEqual(await at(), { scene: steerAt, beat: 2 }, 'Space after clicking a button moves one beat (the button never took focus)');
  await c.click('#hudBack'); await c.click('#hudBack'); await c.waitForTimeout(300);
  assert.deepEqual(await at(), { scene: steerAt, beat: 0 }, 'the back button goes back one beat per click');
  assert.equal(await c.$eval('#hudTimer', (b) => b.hidden), true, 'no timer on this scene: no Restart timer button');
  await c.evaluate(() => window.__stage.go(window.__stage.indexOf('yourturn')));
  await c.waitForTimeout(300);
  assert.equal(await c.$eval('#hudTimer', (b) => b.hidden), false, 'practice has a timer: the Restart timer button shows');
  await c.waitForTimeout(1300);
  const tBefore = await c.$eval('.sc-yourturn [data-timer]', (t) => t.textContent);
  await c.click('#hudTimer'); await c.waitForTimeout(400);
  assert.equal(await c.$eval('.sc-yourturn [data-timer]', (t) => t.textContent), '11:00', `Restart timer starts it over (was ${tBefore})`);
  assert.equal(await at().then((p) => p.scene), await c.evaluate(() => window.__stage.indexOf('yourturn')), 'Restart timer does not move the slide');
  await c.keyboard.press('h');
  assert.equal(await c.$eval('#hudClock', (e) => getComputedStyle(e).display), 'none', 'H hides the clock');
  assert.notEqual(await c.$eval('#hudNext', (e) => getComputedStyle(e).display), 'none', 'H leaves the click controls');
  assert.equal(await c.$eval('#hudFull', (b) => b.getAttribute('aria-label')), 'Full screen');
  // the controls sit inside the 1920x1080 window, clear of each other, on a small window too
  const sm = await page({ viewport: { width: 1280, height: 720 } });
  const boxes = await sm.$$eval('#hud > *:not([hidden])', (els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right, r.bottom]));
  for (const [l, r, b] of boxes) assert.ok(l >= 0 && r <= 1280 && b <= 720, 'control on screen');
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][0] >= boxes[i - 1][1], 'controls do not overlap');
  // ---- the corner tag (10/9): class page step on every teaching scene; "Try it" only once a do-scene is fully on screen ----
  const g = await page();
  const tagState = () => g.evaluate(() => ({ shown: !document.getElementById('stgTag').hidden, n: document.getElementById('stgTagN').textContent,
    t: document.getElementById('stgTagT').textContent, tryShown: !document.getElementById('stgTry').hidden && getComputedStyle(document.getElementById('stgTry')).display !== 'none',
    tryText: document.getElementById('stgTryText').textContent }));
  assert.equal((await tagState()).shown, false, 'Starting soon: no tag');
  await g.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5'))); await g.waitForTimeout(300);
  let ts = await tagState();
  assert.deepEqual([ts.shown, ts.n, ts.t, ts.tryShown], [true, 'Step 4', 'The 5-part prompt', false], 'prompt5 beat 0: the step tag, no Try it yet (watch first)');
  const p5beats = await g.$eval('.sc-prompt5', (s) => +s.dataset.beats);
  for (let i = 1; i < p5beats; i++) { await g.keyboard.press('ArrowRight'); await g.waitForTimeout(120); }
  await g.waitForTimeout(700);
  ts = await tagState();
  assert.equal(ts.tryShown, true, 'prompt5 last beat: Try it shows');
  assert.match(ts.tryText, /bland prompt, then the 5-part one/);
  await g.keyboard.press('ArrowLeft'); await g.waitForTimeout(200);
  assert.equal((await tagState()).tryShown, false, 'back off the last beat: Try it hides again');
  await g.evaluate(() => window.__stage.go(window.__stage.indexOf('words'))); await g.waitForTimeout(300);
  ts = await tagState();
  assert.deepEqual([ts.n, ts.t, ts.tryShown], ['Step 3', 'What AI actually is', false], 'a watch-only scene: tag, never Try it');
  await g.evaluate(() => window.__stage.go(window.__stage.indexOf('qa'))); await g.waitForTimeout(300);
  ts = await tagState();
  assert.deepEqual([ts.n, ts.t], ['Under Step 8', ''], 'Questions: the after-tap pointer');
  assert.equal(await g.$eval('#stgTag', (t) => t.closest('[data-beat]') === null && !t.querySelector('[data-beat]')), true, 'the tag is never a beat');
  // every teaching scene has a tag; only soon has none
  const untagged = await g.$$eval('.scene', (els) => els.filter((s) => !s.dataset.tagN).map((s) => s.dataset.id));
  assert.deepEqual(untagged, ['soon']);
  assert.deepEqual(fails, [], 'no page errors');
  console.log('stage e2e: PASS');
} finally { await browser.close(); srv.kill(); }
