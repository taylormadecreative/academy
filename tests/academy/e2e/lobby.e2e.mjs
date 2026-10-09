// tests/academy/e2e/lobby.e2e.mjs — run: node tests/academy/e2e/lobby.e2e.mjs   (LOBBY_SHOTS=<dir> saves screenshots)
// The room's lobby end to end, with a fake supabase whose presence channel is a BroadcastChannel and a stub room
// module: guests wait before the class, keep waiting after Nelson starts, walk in together on Bring everyone in,
// late arrivals walk straight in, the lobby fails open with no word from Nelson's page, ?lobby=off is the old screen.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-supabase-lobby.js', import.meta.url));
const STUB = fileURLToPath(new URL('./stub-room-lobby.js', import.meta.url));
const PORT = Number(process.env.LOBBY_PORT || 8795);
const SHOTS = process.env.LOBBY_SHOTS || '';
const KEY = 'AbC123_-xyzXYZ0987ab-_';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ channel: 'chrome' });
const fails = [];
const URL0 = `http://127.0.0.1:${PORT}/room/?k=${KEY}`;
async function context(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ path: FAKE, contentType: 'text/javascript' }));
  await ctx.route(/\/js\/rtk-room-v2\.js/, (r) => r.fulfill({ path: STUB, contentType: 'text/javascript' }));
  await ctx.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"started":true,"stopped":true}' }));
  return ctx;
}
async function person(ctx, { id, name, role = 'guest', url = URL0, grace, live, rtFail } = {}) {
  const p = await ctx.newPage();
  await p.addInitScript(({ id, name, role, grace, live, rtFail }) => {
    window.FAKE_SESSION = { access_token: 't-' + id, user: { id, email: id + '@x.test', user_metadata: { full_name: name } } };
    window.FAKE_NAME = name; window.FAKE_ROLE = role;
    if (grace) { window.__lobbyGraceMs = grace; window.__lobbyNoChannelMs = grace; }
    if (live !== undefined) localStorage.setItem('fake-live', live ? '1' : '0');
    if (rtFail) window.FAKE_RT_FAIL = true;
    const names = JSON.parse(localStorage.getItem('fake-names') || '{}'); names[id] = name; localStorage.setItem('fake-names', JSON.stringify(names));
  }, { id, name, role, grace, live, rtFail });
  p.on('pageerror', (e) => fails.push(name + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fails.push(name + ' console: ' + m.text()); });
  await p.goto(url);
  return p;
}
const shot = async (p, file) => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + file }); };
const text = (p, s) => p.$eval(s, (e) => e.textContent.trim());
let step = '';
try {
  /* L1 — a guest before the class: the lobby, not the old waiting screen */
  step = 'L1';
  const ctx = await context();
  const meme = await person(ctx, { id: 'g-meme', name: 'Meme Johnson', live: false });
  await meme.waitForSelector('.lb .lb-h');
  assert.match(await text(meme, '.lb-h'), /You’re in the lobby\./);
  assert.match(await text(meme, '.lb-kicker'), /AI 101/);
  assert.match(await text(meme, '.lb-warm-q'), /I'd love help with/);
  await meme.waitForFunction(() => document.querySelector('.lb-vig.on') && getComputedStyle(document.querySelector('.lb-vig.on')).visibility === 'visible');
  assert.equal(await text(meme, '.lb-count'), '1');
  assert.equal(await meme.evaluate(() => (window.__stubMounts || []).length), 0, 'no room mounted before the class');
  await meme.waitForTimeout(3600);
  const fit = await meme.evaluate(() => { const lb = document.querySelector('.lb'); const f = document.querySelector('.lb-field').getBoundingClientRect(); return { over: lb.scrollHeight - lb.clientHeight, fieldBottom: f.bottom, vh: innerHeight }; });
  assert.ok(fit.over <= 2 && fit.fieldBottom <= fit.vh + 1, 'a 1440x900 laptop fits the whole lobby: ' + JSON.stringify(fit));
  await shot(meme, 'L1-guest-wait-1440.png');

  /* L2 — a second guest: both see each other */
  step = 'L2';
  const jamal = await person(ctx, { id: 'g-jamal', name: 'Jamal Ware' });
  await jamal.waitForSelector('.lb .lb-h');
  await meme.waitForFunction(() => document.querySelector('.lb-count').textContent === '2', null, { timeout: 4000 });
  await jamal.waitForFunction(() => document.querySelector('.lb-count').textContent === '2', null, { timeout: 4000 });
  assert.match(await text(meme, '.lb-crowd-t'), /You and 1 other person/);
  await meme.waitForFunction(() => /Jamal just arrived/.test(document.querySelector('.lb-arrive').textContent), null, { timeout: 3000 });

  /* L2a — fast taps on the arrows never leave two slides on screen */
  step = 'L2a';
  for (let i = 0; i < 9; i++) { await jamal.click('.lb-navb[data-d="1"]'); await jamal.waitForTimeout(90); }
  await jamal.waitForTimeout(1200);
  const showing = await jamal.$$eval('.lb-vig', (vs) => vs.filter((v) => { const c = getComputedStyle(v); return c.visibility !== 'hidden' && Number(c.opacity) > 0.02; }).map((v) => v.dataset.v));
  assert.equal(showing.length, 1, 'one slide on screen after fast taps: ' + showing.join(','));

  /* L2b — the wall: Meme answers, Jamal sees it on the card */
  step = 'L2b';
  await meme.fill('.lb-warm-a', 'my emails'); await meme.fill('.lb-warm-c', 'Atlanta, GA'); await meme.click('.lb-warm-go');
  await meme.waitForFunction(() => /on the wall/.test(document.querySelector('.lb-warm-said').textContent));
  await jamal.waitForFunction(() => /my emails/.test(document.querySelector('.lb-wall').textContent), null, { timeout: 5000 });
  assert.match(await text(jamal, '.lb-wall'), /Meme/);
  assert.match(await text(meme, '.lb-wall li:first-child b'), /^You$/);

  /* L2c — Play: be the AI. Both pick a word; the lobby's bars move live */
  step = 'L2c';
  for (const pg of [meme, jamal]) {
    for (let i = 0; i < 6 && !/Play/.test(await text(pg, '.lb-screen-k')); i++) { await pg.click('.lb-navb[data-d="1"]'); await pg.waitForTimeout(250); }
    assert.equal(await text(pg, '.lb-screen-k'), 'Play: be the AI');
  }
  await meme.click('.gm-opt[data-w="time"]');
  await meme.waitForSelector('.gm-res');
  assert.match(await text(meme, '.gm-meta'), /Just you so far/);
  await jamal.click('.gm-opt[data-w="time"]');
  await meme.waitForFunction(() => /2 people in the lobby picked/.test(document.querySelector('.gm-meta').textContent), null, { timeout: 5000 });
  assert.match(await meme.$eval('.gm-res li.top', (l) => l.textContent), /time.*100%/);
  await shot(meme, 'L2c-game.png');

  /* L2d — a wave: Jamal taps Meme's node; Meme hears about it */
  step = 'L2d';
  const at = await jamal.evaluate(() => document.querySelector('.lb').__net.pos('g-meme'));
  assert.ok(at, 'Meme is on Jamal\'s canvas');
  await jamal.mouse.click(at.x, at.y);
  await meme.waitForFunction(() => /Jamal waved at you/.test(document.querySelector('.lb-arrive').textContent), null, { timeout: 4000 });
  await meme.waitForTimeout(400);
  await shot(meme, 'L2d-wave.png');

  /* L3 — Nelson's page: the panel counts them, holding is on */
  step = 'L3';
  const nelson = await person(ctx, { id: 'h-nelson', name: 'Nelson Taylor', role: 'host' });
  await nelson.waitForSelector('.lbh');
  await nelson.waitForFunction(() => /2 people in the lobby/.test(document.querySelector('.lbh-n').textContent), null, { timeout: 4000 });
  assert.match(await text(nelson, '.lbh-names'), /Meme and Jamal|Jamal and Meme/);
  assert.equal(await nelson.$eval('.lbh-hold input', (i) => i.checked), true);
  assert.equal(await nelson.$eval('.lbh-go', (b) => b.hidden), true, 'before the class, Start class is the one button');
  await shot(nelson, 'L3-host-card.png');

  /* L4 — Nelson starts: the guests stay in the lobby ("Nelson is here."), his dock shows over the room */
  step = 'L4';
  await nelson.click('#rStart');
  await nelson.waitForSelector('.stub-room[data-mode="host"]');
  await nelson.waitForSelector('.lbd:not([hidden])', { timeout: 4000 });
  assert.equal(await nelson.$eval('.lbd', (d) => getComputedStyle(d).display !== 'none'), true, 'the dock shows over the room');
  await nelson.waitForTimeout(1200);
  const clash = await nelson.evaluate(() => { const d = document.querySelector('.lbd').getBoundingClientRect(), b = document.querySelector('.stub-bar').getBoundingClientRect(); return d.top < b.bottom && d.bottom > b.top; });
  assert.equal(clash, false, 'the dock never covers the room bar');
  await meme.waitForFunction(() => document.querySelector('.lb') && document.querySelector('.lb').dataset.phase === 'hold', null, { timeout: 12000 });
  assert.match(await text(meme, '.lb-h'), /Nelson is here\./);
  assert.match(await text(meme, '.lb-state-t'), /Nelson is in the room/);
  await meme.waitForTimeout(1500);
  assert.equal(await meme.evaluate(() => (window.__stubMounts || []).length), 0, 'held: no room yet');
  await shot(meme, 'L4-guest-hold.png');
  await shot(nelson, 'L4-host-in-room-dock.png');

  /* L4b — Nelson reloads while holding: his page blinks off the channel, nobody is let in early */
  step = 'L4b';
  await nelson.reload();
  await nelson.waitForSelector('.stub-room[data-mode="host"]');
  await nelson.waitForSelector('.lbd:not([hidden])', { timeout: 4000 });
  await meme.waitForTimeout(2500);
  assert.equal(await meme.evaluate(() => (window.__stubMounts || []).length), 0, 'still held after his reload');
  assert.equal(await meme.$eval('.lb', (l) => l.dataset.phase), 'hold');

  /* L5 — Bring everyone in: both walk into the class */
  step = 'L5';
  await nelson.click('.lbd-go');
  await meme.waitForSelector('.stub-room[data-mode="student"]', { timeout: 6000 });
  await jamal.waitForSelector('.stub-room[data-mode="student"]', { timeout: 6000 });
  assert.equal(await meme.$('.lb'), null, 'the lobby is gone');
  assert.equal(await meme.evaluate(() => document.body.classList.contains('in-lobby')), false);
  await nelson.waitForFunction(() => /Doors open/.test(document.querySelector('.lbd-n').textContent));

  /* L6 — a late arrival walks straight in */
  step = 'L6';
  const tiana = await person(ctx, { id: 'g-tiana', name: 'Tiana Brooks' });
  await tiana.waitForSelector('.stub-room[data-mode="student"]', { timeout: 6000 });

  /* L6b — Nelson reloads mid-class: the doors stay open (a late arrival still walks in) */
  step = 'L6b';
  await nelson.reload();
  await nelson.waitForSelector('.stub-room[data-mode="host"]');
  const billy = await person(ctx, { id: 'g-billy', name: 'Billy Taylor' });
  await billy.waitForSelector('.stub-room[data-mode="student"]', { timeout: 6000 });

  /* L6c — End: the doors close again for the next session */
  step = 'L6c';
  assert.equal(await nelson.evaluate(() => localStorage.getItem('tma-lobby-open:room-1')), '1', 'open doors survive his reload');
  await nelson.evaluate(() => window.__stubEnd());   /* End the session for everyone, from Tools in the room */
  await nelson.waitForFunction(() => localStorage.getItem('tma-lobby-open:room-1') === null, null, { timeout: 4000 });
  assert.equal(await nelson.evaluate(() => localStorage.getItem('fake-live')), '0');
  await ctx.close();

  /* L7 — fail open: live, and Nelson's page never speaks → in after the grace */
  step = 'L7';
  const ctx2 = await context();
  const solo = await person(ctx2, { id: 'g-solo', name: 'Solo Person', live: true, grace: 1500 });
  await solo.waitForSelector('.stub-room[data-mode="student"]', { timeout: 8000 });
  const broken = await person(ctx2, { id: 'g-broken', name: 'Rt Broken', live: true, grace: 1500, rtFail: true });
  await broken.waitForSelector('.stub-room[data-mode="student"]', { timeout: 8000 });
  await ctx2.close();

  /* L8 — ?lobby=off: the old waiting screen */
  step = 'L8';
  const ctx3 = await context();
  const old = await person(ctx3, { id: 'g-old', name: 'Old Way', live: false, url: URL0 + '&lobby=off' });
  await old.waitForSelector('.stub-wait');
  assert.equal(await old.$('.lb'), null);

  /* L9 — Nelson's preview: sample people arrive */
  step = 'L9';
  const prev = await person(ctx3, { id: 'h-prev', name: 'Nelson Taylor', role: 'host', url: URL0 + '&lobby=preview' });
  await prev.waitForSelector('.lb');
  await prev.waitForFunction(() => Number(document.querySelector('.lb-count').textContent) >= 4, null, { timeout: 9000 });
  await prev.waitForFunction(() => document.querySelectorAll('.lb-wall li:not(.empty)').length >= 3, null, { timeout: 12000 });
  await prev.waitForTimeout(1500);
  const fit9 = await prev.evaluate(() => { const lb = document.querySelector('.lb'); const f = document.querySelector('.lb-field').getBoundingClientRect(); return { over: lb.scrollHeight - lb.clientHeight, fieldBottom: f.bottom, vh: innerHeight }; });
  assert.ok(fit9.over <= 2 && fit9.fieldBottom <= fit9.vh + 1, 'a full wall still fits a 1440x900 laptop: ' + JSON.stringify(fit9));
  await shot(prev, 'L9-preview-1440.png');
  const prevHold = await person(ctx3, { id: 'h-prev2', name: 'Nelson Taylor', role: 'host', url: URL0 + '&lobby=preview&phase=hold' });
  await prevHold.waitForSelector('.lb[data-phase="hold"]');
  await ctx3.close();

  /* L10 — a phone: one column, no sideways scroll */
  step = 'L10';
  const ctx4 = await context({ viewport: { width: 390, height: 844 } });
  const phone = await person(ctx4, { id: 'g-phone', name: 'Dr. Gray', live: false, url: URL0 + '&lobby=preview' });
  await phone.waitForSelector('.lb');
  await phone.waitForTimeout(4500);
  const over = await phone.evaluate(() => { const lb = document.querySelector('.lb'); return lb.scrollWidth - lb.clientWidth; });
  assert.ok(over <= 1, 'no sideways scroll on a phone: ' + over);
  await shot(phone, 'L10-phone-top.png');
  await phone.evaluate(() => document.querySelector('.lb').scrollTo(0, 99999));
  await phone.waitForTimeout(600);
  await shot(phone, 'L10-phone-bottom.png');
  await ctx4.close();

  /* L11 — reduced motion still draws everything */
  step = 'L11';
  const ctx5 = await context({ reduced: true });
  const calm = await person(ctx5, { id: 'g-calm', name: 'Calm Person', live: false });
  await calm.waitForSelector('.lb-vig.on');
  await ctx5.close();

  /* L12 — the lobby file never loads (a 404, a bad deploy): the room behaves exactly as it did before the lobby */
  step = 'L12';
  const ctx6 = await context();
  await ctx6.route(/\/js\/lobby\.js/, (r) => r.fulfill({ status: 404, body: 'nope' }));
  const noLobby = await person(ctx6, { id: 'g-nolobby', name: 'No Lobby', live: false });
  await noLobby.waitForSelector('.stub-wait');
  const noLobbyLive = await person(ctx6, { id: 'g-nolobby2', name: 'No Lobby Live', live: true });
  await noLobbyLive.waitForSelector('.stub-room[data-mode="student"]', { timeout: 6000 });
  await ctx6.close();
  fails.splice(0, fails.length, ...fails.filter((f) => !/lobby did not load|404|Failed to fetch dynamically imported module|Importing a module script failed/.test(f)));

  assert.deepEqual(fails, [], 'no page errors');
  console.log('lobby e2e: all scenarios passed');
} catch (e) {
  console.error('FAILED at', step, e && e.message);
  if (fails.length) console.error(fails.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  srv.kill();
}
