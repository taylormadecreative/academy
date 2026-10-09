// tests/academy/e2e/ai101-stage.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/ai101-stage.e2e.mjs (and again with STAGE_LOOK=v1)
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
  await p.goto(`http://localhost:${PORT}/ai101/class/stage/` + (process.env.STAGE_LOOK ? '?look=' + process.env.STAGE_LOOK : '') + (opts.hash || '')); // STAGE_LOOK=v1: the original look
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
  assert.equal(n, 22, 'twenty-two scenes (10/8: + laptop, nolove, strengths; 10/9: + models, frontier, words2026)');
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
  // 10/9 (Nelson: "real looking chat box interfaces"): the loop runs inside a real-looking Claude window. You type and send (the
  // box drops to the bottom), Claude writes back a note with [blanks], "Reply to make it better", the reply sends, the better note
  // uses every fact from the reply, lit up. 10/8: the answer never appears with nothing typed; the prompt stays on screen.
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('chat')));
  await w.waitForTimeout(3200);
  const chatState = () => w.evaluate(() => { const q = (c) => document.querySelector('.sc-chat ' + c), vis = (el) => +getComputedStyle(el).opacity > 0.99 && getComputedStyle(el).visibility !== 'hidden';
    const shown = (el) => vis(el) && [...el.querySelectorAll('.w')].every((x) => vis(x));
    const comp = q('.ch-comp').getBoundingClientRect(), body = q('.ch-app .aw-body').getBoundingClientRect();
    return { u1: vis(q('.ch-u1')) ? q('.ch-u1').textContent.trim() : '', reply: vis(q('.ch-reply')), v1: shown(q('.ch-ans-text.v1')), v2: shown(q('.ch-ans-text.v2')),
      tag: vis(q('.cw-tag')), skill: vis(q('.cw-skill')), boxDown: Math.abs(body.bottom - comp.bottom) < 60, model: q('.ch-comp .cl-model').textContent.trim(),
      blanks: q('.ch-ans-text.v1').textContent.includes('[Your name]'), lit: [...document.querySelectorAll('.sc-chat .ch-new')].map((m) => getComputedStyle(m).backgroundColor !== 'rgba(253, 201, 33, 0)' && m.textContent.replace(/\s+/g, ' ').trim()) }; });
  let C = await chatState();
  assert.deepEqual([C.u1, C.reply, C.v1, C.boxDown], ['Write a thank-you note to my neighbor.', false, false, true], 'chat, beat 0: typed, sent (the box dropped to the bottom), no answer yet ' + JSON.stringify(C));
  assert.match(C.model, /^Sonnet 5\.5/, 'the box shows the free plan\'s model');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2600);
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2000);
  C = await chatState();
  assert.deepEqual([C.v1, C.blanks, C.tag, C.reply, C.v2], [true, true, true, false, false], 'chat, beat 2: the note with blanks; "Reply to make it better" ' + JSON.stringify(C));
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3600);
  C = await chatState();
  assert.deepEqual([C.reply, C.v2], [true, false], 'chat, beat 3: the reply sends; the answer has not come yet ' + JSON.stringify(C));
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3800);
  C = await chatState();
  assert.deepEqual([C.reply, C.v2, C.skill], [true, true, true], 'chat, beat 4: the better note, and "That loop is the whole skill." ' + JSON.stringify(C));
  assert.deepEqual(C.lit, ['Rosa', 'watering my plants while I was away', 'Nelson'], 'chat, beat 4: every fact from the reply is in the better answer, lit up');
  await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400); await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400);
  C = await chatState();
  assert.deepEqual([C.reply, C.v1, C.v2], [false, true, false], 'chat, back to beat 2: the reply and the better answer step away ' + JSON.stringify(C));
  // 10/9 (Nelson: "we also didn't talk about models … sonnet and fable"): Claude's real menu, each model with its plan
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('models')));
  for (let i = 0; i < 3; i++) { await w.waitForTimeout(1600); await w.keyboard.press('ArrowRight'); }
  await w.waitForTimeout(1800);
  const md = await w.evaluate(() => ({ menu: +getComputedStyle(document.querySelector('.md-menu')).opacity,
    items: [...document.querySelectorAll('.md-it')].map((x) => x.querySelector('b').textContent + ' | ' + x.querySelector('.md-tag').textContent + ' | ' + +getComputedStyle(x.querySelector('.md-tag')).opacity) }));
  assert.equal(md.menu, 1, 'models: the menu is open');
  assert.deepEqual(md.items, ['Fable 5.1 | Paid plans | 1', 'Opus 5.5 | Paid plans | 1', 'Sonnet 5.5 | Free | 1', 'Haiku 5.5 | Free | 1'], 'models: each model and its plan');
  // 10/9 (Nelson: "explain what frontier models are and AGI is … make it creative … cool"): the mountain. b0: the line starts low,
  // the peak is in the clouds; by the end the line has climbed, the three are level at it, last year's best stay behind, "AGI, not built yet" shows.
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('frontier')));
  await w.waitForTimeout(2200);
  const fr = () => w.evaluate(() => { const r = (c) => document.querySelector('.sc-frontier ' + c).getBoundingClientRect();
    const op = (c) => +getComputedStyle(document.querySelector('.sc-frontier ' + c)).opacity;
    return { lineY: Math.round(r('.fr-line-draw').top), year: document.querySelector('.sc-frontier .fr-year').textContent, agi: op('.fr-peak'),
      ghost: op('circle.fr-ghost'), cloud: op('.fr-cloud-l'), ys: [...document.querySelectorAll('.sc-frontier .fr-c-dot')].map((d) => Math.round(d.getBoundingClientRect().top)) }; });
  const f0 = await fr();
  assert.deepEqual([f0.year, f0.agi, f0.ghost], ['2023', 0, 0], 'frontier, beat 0: 2023, no AGI label, nobody left behind yet ' + JSON.stringify(f0));
  assert.ok(f0.cloud > 0.9, 'frontier, beat 0: the peak is in the clouds');
  for (let i = 0; i < 3; i++) { await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800); }
  const f3 = await fr();
  assert.equal(f3.year, '2026', 'frontier, end: the years ticked to 2026');
  assert.ok(f3.lineY < f0.lineY - 100, `frontier, end: the line climbed (${f0.lineY} → ${f3.lineY})`);
  assert.equal(new Set(f3.ys).size, 1, 'frontier, end: Claude, ChatGPT and Gemini level at the line ' + JSON.stringify(f3.ys));
  assert.deepEqual([f3.agi, f3.ghost], [1, 1], 'frontier, end: "AGI, not built yet" shows, and last year\'s best stay behind');
  assert.ok(f3.cloud < 0.6, 'frontier, end: the clouds parted');
  // 10/9 (Nelson: "google says these are terms everyone should know in 2026"): the word storm lands all 16 in three groups;
  // by the end the four to meet first are gold and the rest are dimmed but still there
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('words2026')));
  await w.waitForTimeout(2000); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1600); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1600);
  const w6 = await w.evaluate(() => [...document.querySelectorAll('.sc-words2026 .w6-chip')].map((c) => ({ t: c.textContent, pick: c.classList.contains('pick'),
    op: +getComputedStyle(c).opacity, gold: getComputedStyle(c).backgroundColor === 'rgb(253, 201, 33)' })));
  assert.equal(w6.length, 16, 'words2026: all 16');
  assert.deepEqual(w6.filter((c) => c.gold).map((c) => c.t), ['Multimodal', 'Prompt engineering', 'Vibe coding', 'RAG'], 'words2026: the four to meet first are gold');
  assert.ok(w6.filter((c) => !c.pick).every((c) => c.op > 0.3 && c.op < 0.5), 'words2026: the rest are dimmed, still readable');
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
  assert.ok(wn.first < 0.2 && wn.last > 0.99 && wn.full > 0.99 && wn.n > 40 && wn.costs > 0.99, 'window, beat 3: the start fell out, Full, the costs showing ' + JSON.stringify(wn));
  // 10/9 (Nelson): same subject = same chat. The last click swaps the costs for "which chat?" in the same spot.
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(2200);
  const rules = await w.evaluate(() => ({ costs: +getComputedStyle(document.querySelector('.wn-costs')).opacity, rules: +getComputedStyle(document.querySelector('.wn-rules')).opacity,
    rows: [...document.querySelectorAll('.wn-rules p')].map((p) => +getComputedStyle(p).opacity > 0.99 && p.querySelector('b').textContent) }));
  assert.deepEqual(rules, { costs: 0, rules: 1, rows: ['Same subject?', 'New subject?', 'Too long?'] }, 'window, last beat: which chat to use');
  // 10/8 (Nelson): the next-word scene explains itself, then turns into Never paste
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('check')));
  await w.waitForTimeout(3200); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  const ex = () => w.evaluate(() => ['.ck-how', '.ck-why', '.ck-explain', '.ck-search', '.ck-safe'].map((q) => +(+getComputedStyle(document.querySelector(q)).opacity).toFixed(2)));
  assert.deepEqual(await ex(), [1, 1, 1, 0, 0], 'check, beat 2: how it guesses + why it goes wrong');
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1500); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  // 10/9 (Nelson): most chatbots come with a search or research tool now; trust real sources, not Reddit or opinions
  assert.deepEqual((await ex()).slice(2), [0, 1, 0], 'check, beat 4: the explanation gives way to Use search');
  assert.match(await w.textContent('.ck-src.no'), /Reddit/);
  await w.keyboard.press('ArrowRight'); await w.waitForTimeout(1800);
  assert.deepEqual((await ex()).slice(2), [0, 0, 1], 'check, last beat: then Never paste');
  await w.keyboard.press('ArrowLeft'); await w.waitForTimeout(400);
  assert.deepEqual((await ex()).slice(2), [0, 1, 0], 'check, back one: Use search again');
  // 10/9 (Nelson: the last scene was "not very creative or colorful"): two bright cards, the offer, and the real badge on a
  // phone, drawn by the class page's own code; the last click's confetti is gone again once it lands
  await w.evaluate(() => window.__stage.go(window.__stage.indexOf('bye')));
  await w.waitForFunction(() => document.querySelector('.by-badge').dataset.drawn === '1', null, { timeout: 8000 });
  await w.waitForTimeout(2600); await w.keyboard.press('ArrowRight'); await w.waitForTimeout(3200);
  const bye = await w.evaluate(() => { const c = document.querySelector('.by-badge'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] < 600) ink++;
    return { ink, cards: [...document.querySelectorAll('.by-card, .by-deal-row')].map((x) => +getComputedStyle(x).opacity), bits: document.querySelectorAll('.by-bit').length,
      bitsShown: [...document.querySelectorAll('.by-bit')].filter((b) => +getComputedStyle(b).opacity > 0.01).length, thanks: +getComputedStyle(document.querySelector('.by-thanks')).opacity }; });
  assert.ok(bye.ink > 500, 'bye: the badge is drawn on the phone ' + JSON.stringify(bye));
  assert.deepEqual(bye.cards, [1, 1, 1], 'bye: review, badge and the offer');
  assert.ok(bye.bits > 30 && bye.bitsShown === 0 && bye.thanks === 1, 'bye, last click: thank you, and the confetti has landed and gone ' + JSON.stringify(bye));
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
