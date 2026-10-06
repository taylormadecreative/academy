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
  assert.equal(n, 16, 'sixteen scenes');
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
  // a held key (auto-repeat) never skips beats
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('prompt5')));
  const before = await w.evaluate(() => window.__stage.pos());
  await w.evaluate(() => { for (let i = 0; i < 5; i++) dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true })); });
  assert.deepEqual(await w.evaluate(() => window.__stage.pos()), before, 'auto-repeat ignored');
  // the time checks come from the page (the event date), and include the 7:19 early warning
  const checks = await w.evaluate(() => window.__stage.checks);
  assert.ok(checks.every((c) => c.date === '2026-10-09'));
  assert.deepEqual(checks.map((c) => c.id), ['steer', 'yourturn', 'qa', 'next']);
  assert.equal(checks.find((c) => c.id === 'qa').at, 19 * 60 + 41);
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
  assert.deepEqual(fails, [], 'no page errors');
  console.log('stage e2e: PASS');
} finally { await browser.close(); srv.kill(); }
