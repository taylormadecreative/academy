// tests/academy/e2e/ai101-class.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/ai101-class.e2e.mjs
// The real class page with a fake supabase (fake-supabase.js) in place of esm.sh. Covers the sign-in wall,
// the room link (and its fallback), the tool switch, progress, copy, the builder, the token toy, a dead CDN,
// blocked storage, and phone width.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-supabase.js', import.meta.url));
const PORT = 8783, URL0 = `http://localhost:${PORT}/ai101/class/`;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
async function open({ session = { user: { id: 'u1', email: 'a@b.c', user_metadata: { full_name: 'Test Person' } } }, rpc = {}, rows = {}, cdnDown = false, cdnFailFirst = false, cdnDelay = 0, readDelay = 0, rpcDelay = 0, authError = false, noStorage = false, noClipboard = false, hash = '', viewport = { width: 1280, height: 900 }, ua = undefined } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', ...(ua ? { userAgent: ua } : {}) });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` });
  let esmCalls = 0;
  await ctx.route(/esm\.sh\/@supabase\/supabase-js/, async (r) => {
    esmCalls++;
    if (cdnDown || (cdnFailFirst && esmCalls === 1)) return r.abort();
    if (cdnDelay) await new Promise((ok) => setTimeout(ok, cdnDelay));
    return r.fulfill({ path: FAKE, contentType: 'text/javascript' });
  });
  await ctx.addInitScript(({ session, rpc, rows, noStorage, noClipboard, authError, readDelay, rpcDelay }) => {
    window.FAKE_SESSION = session; window.FAKE_RPC = rpc; window.FAKE_ROWS = rows; window.FAKE_AUTH_ERROR = authError;
    window.FAKE_DELAY_MS = readDelay; window.FAKE_RPC_DELAY_MS = rpcDelay;
    if (noStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    if (noClipboard) Object.defineProperty(navigator, 'clipboard', { get() { return undefined; } });
  }, { session, rpc, rows, noStorage, noClipboard, authError, readDelay, rpcDelay });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL0 + hash);
  return { page, ctx, errors };
}
async function check(name, fn) { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } }
// what the person SEES: computed display, not the hidden property (a .btn rule can beat [hidden])
const visible = (p, sel) => p.$eval(sel, (el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0);

await check('signed out → the gate, with links back here', async () => {
  const { page } = await open({ session: null });
  await page.waitForSelector('#gate:not([hidden])', { timeout: 8000 });
  assert.equal(await page.$eval('#app', (el) => el.hidden), true);
  assert.match(await page.$eval('#gate a.btn.gold', (a) => a.getAttribute('href')), /next=%2Fai101%2Fclass%2F/);
});
await check('signed in with a seat → the room button carries the link', async () => {
  const { page } = await open({ rpc: { ea_ai101_room_link: { data: '/room/?k=TEST', error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForSelector('#joinRoom:not([hidden])');
  assert.equal(await page.$eval('#joinRoom', (a) => a.getAttribute('href')), '/room/?k=TEST');
  assert.equal(await page.$eval('#joinNote', (p) => p.hidden), true);
});
await check('signed in, no link (seat under another email) → the fallback note, no dead button', async () => {
  const { page } = await open({ rpc: { ea_ai101_room_link: { data: null, error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(300);
  assert.equal(await visible(page, '#joinRoom'), false, 'no blue button pointing at #');
  assert.equal(await visible(page, '#joinNote'), true);
});
await check('tool switch changes the lines and survives a reload', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pick-tool="chatgpt"]');
  assert.equal(await page.$eval('html', (h) => h.dataset.tool), 'chatgpt');
  assert.equal(await page.$eval('#start [data-for="claude"]', (el) => getComputedStyle(el).display), 'none');
  await page.reload(); await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.$eval('html', (h) => h.dataset.tool), 'chatgpt');
});
const shownInstall = (p) => p.$$eval('.a1c-install', (els) => els.filter((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length)
  .map((el) => `${el.dataset.for}/${el.dataset.osFor}`));
await check('Step 2 starts on Mac on a Mac, and shows exactly one install card: the tool x computer you picked', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.$eval('html', (h) => h.dataset.os), 'mac');
  assert.deepEqual(await shownInstall(page), ['claude/mac']);
  await page.click('[data-pick-tool="chatgpt"]');
  assert.deepEqual(await shownInstall(page), ['chatgpt/mac']);
  await page.click('[data-pick-os="windows"]');
  assert.deepEqual(await shownInstall(page), ['chatgpt/windows']);
  assert.equal(await page.$eval('[data-pick-os="windows"]', (b) => b.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval('[data-pick-os="mac"]', (b) => b.getAttribute('aria-pressed')), 'false');
  assert.equal(await page.textContent('#osSay'), 'Showing the steps for Windows.');
  assert.match(await page.$eval('.a1c-install[data-for="chatgpt"][data-os-for="windows"]', (el) => el.textContent), /Microsoft Store/);
  assert.equal(await page.$eval('.a1c-install[data-for="claude"][data-os-for="mac"] + .a1c-install', (el) => getComputedStyle(el).display), 'none');
  await page.click('[data-pick-tool="gemini"]');
  assert.deepEqual(await shownInstall(page), ['gemini/windows']);
});
await check('a Windows laptop opens on the Windows steps by itself', async () => {
  const { page } = await open({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.$eval('html', (h) => h.dataset.os), 'windows');
  assert.deepEqual(await shownInstall(page), ['claude/windows']);
  assert.equal(await page.textContent('#osSay'), '', 'the guess is silent; only a tap is announced');
});
await check('a tap on the computer switch survives a reload (it beats the guess), and works with storage blocked', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pick-os="windows"]');
  await page.reload(); await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.$eval('html', (h) => h.dataset.os), 'windows');
  const b = await open({ noStorage: true });
  await b.page.waitForSelector('#app:not([hidden])');
  await b.page.click('[data-pick-os="windows"]');
  assert.deepEqual(await shownInstall(b.page), ['claude/windows']);
  assert.deepEqual(b.errors, []);
});
await check('the download button opens the vendor page in a new tab, and fits a phone', async () => {
  const { page } = await open({ viewport: { width: 375, height: 667 } });
  await page.waitForSelector('#app:not([hidden])');
  const a = await page.$eval('.a1c-install[data-for="claude"][data-os-for="mac"] a.btn', (x) => ({ href: x.href, target: x.target, rel: x.rel }));
  assert.deepEqual(a, { href: 'https://claude.ai/download', target: '_blank', rel: 'noopener' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 375), 'no sideways scroll');
});
await check('ticking a step updates progress and survives a reload', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.click('input[data-step="hi"]');
  assert.equal(await page.textContent('#prog'), '1 of 8 steps done');
  await page.reload(); await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.$eval('input[data-step="hi"]', (i) => i.checked), true);
});
await check('copy puts the exact prompt on the clipboard', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  const btn = await page.$('#step-prompt5 [data-copy]');
  const want = await btn.evaluate((b) => b.closest('figure').querySelector('pre').textContent);
  await btn.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), want);
});
await check('builder assembles the prompt, names what is missing, and its copy works', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.fill('[data-b="role"]', 'a friendly helper for my church');
  await page.fill('[data-b="task"]', 'write a potluck reminder');
  assert.equal(await page.textContent('#bOut'), 'You are a friendly helper for my church. Write a potluck reminder.');
  assert.match(await page.textContent('#bMissing'), /Context, Format/);
  await page.click('#bCopy');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'You are a friendly helper for my church. Write a potluck reminder.');
});
await check('token toy counts', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.fill('#toyIn', 'Write a caption.');
  assert.equal(await page.textContent('#toyN'), '4');
});
await check('esm.sh down → the content still shows (fails open), no gate, no dead room button', async () => {
  const { page } = await open({ cdnDown: true });
  await page.waitForSelector('#app:not([hidden])', { timeout: 9000 });
  assert.equal(await visible(page, '#gate'), false);
  assert.equal(await visible(page, '#joinRoom'), false);
  assert.equal(await visible(page, '#loading'), false);
});
await check('storage blocked → page works, switch still switches, no errors', async () => {
  const { page, errors } = await open({ noStorage: true });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pick-tool="gemini"]');
  assert.equal(await page.$eval('html', (h) => h.dataset.tool), 'gemini');
  assert.deepEqual(errors, []);
});
await check('phone width: no sideways scroll', async () => {
  const { page } = await open({ viewport: { width: 390, height: 844 } });
  await page.waitForSelector('#app:not([hidden])');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
});

await check('confidence tap saves through ea_pulse_save', async () => {
  const { page } = await open({ rpc: { ea_pulse_save: { data: null, error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pulse="before"] [data-score="2"]');
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-pulse="before"] .a1c-pulse-msg').textContent));
  const call = await page.evaluate(() => window.FAKE_LOG.find((x) => x.rpc === 'ea_pulse_save'));
  assert.deepEqual(call.args, { p_slug: 'ai101', p_kind: 'before', p_score: 2 });
  assert.equal(await page.$eval('[data-pulse="before"] [data-score="2"]', (b) => b.getAttribute('aria-pressed')), 'true');
});
await check('a failed save says so and keeps the choice', async () => {
  const { page } = await open({ rpc: { ea_pulse_save: { data: null, error: { message: 'boom' } } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pulse="after"] [data-score="5"]');
  await page.waitForFunction(() => /didn't save/.test(document.querySelector('[data-pulse="after"] .a1c-pulse-msg').textContent));
  assert.equal(await page.$eval('[data-pulse="after"] [data-score="5"]', (b) => b.getAttribute('aria-pressed')), 'true');
});
await check('earlier answers come back pressed', async () => {
  const { page } = await open({ rows: { ea_class_pulse: [{ kind: 'before', score: 3 }] } });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.querySelector('[data-pulse="before"] [data-score="3"]').getAttribute('aria-pressed') === 'true');
});
await check('review: name preview, validation, then it posts the right fields', async () => {
  const { page } = await open({ rpc: { ea_review_save: { data: { verified: true, status: 'pending' }, error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  assert.equal(await page.textContent('[data-shows-as]'), 'Test P.', 'prefilled from the account name');
  await page.click('#reviewForm button[type="submit"]');
  assert.match(await page.textContent('.a1c-review-msg'), /star/);
  await page.click('label[for="st5"]');
  await page.fill('#reviewForm textarea[name="body"]', 'I finally understand how to ask it for what I want.');
  await page.click('#reviewForm button[type="submit"]');
  assert.match(await page.textContent('.a1c-review-msg'), /Tick the box/);
  await page.check('#reviewForm input[name="ok"]');
  await page.fill('#reviewForm input[name="who"]', 'Office manager');
  await page.click('#reviewForm button[type="submit"]');
  await page.waitForFunction(() => /Thank you/.test(document.querySelector('.a1c-review-msg').textContent));
  const call = await page.evaluate(() => window.FAKE_LOG.find((x) => x.rpc === 'ea_review_save'));
  assert.deepEqual(call.args, { p_slug: 'ai101', p_stars: 5, p_body: 'I finally understand how to ask it for what I want.', p_who: 'Office manager', p_name: 'Test Person' });
});
await check('an existing review is loaded back for editing', async () => {
  const { page } = await open({ rows: { ea_reviews: [{ stars: 4, body: 'Good class, thank you!', who_line: 'Parent', status: 'approved' }] } });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#reviewForm textarea[name="body"]').value === 'Good class, thank you!');
  assert.equal(await page.$eval('#st4', (i) => i.checked), true);
  assert.match(await page.textContent('.a1c-review-msg'), /up on the site/);
});
await check('no connection: forms say plainly nothing was saved', async () => {
  const { page } = await open({ cdnDown: true });
  await page.waitForSelector('#app:not([hidden])', { timeout: 9000 });
  await page.click('[data-pulse="before"] [data-score="4"]'); // it tries to reconnect first, then says so
  await page.waitForFunction(() => /Couldn't connect/.test(document.querySelector('[data-pulse="before"] .a1c-pulse-msg').textContent), null, { timeout: 9000 });
});

// ---- final-review fixes (10/6) ----
await check('while the sign-in check runs, a status line shows (not a blank page), then goes', async () => {
  const { page } = await open({ cdnDelay: 1500 });
  await page.waitForTimeout(400);
  assert.equal(await visible(page, '#loading'), true, 'shows while waiting');
  assert.match(await page.textContent('#loading'), /Opening your class page/);
  await page.waitForSelector('#app:not([hidden])', { timeout: 9000 });
  assert.equal(await visible(page, '#loading'), false);
});
await check('getSession fails → the class shows anyway (fails open), not the gate', async () => {
  const { page } = await open({ authError: true });
  await page.waitForSelector('#app:not([hidden])', { timeout: 9000 });
  assert.equal(await visible(page, '#gate'), false);
});
await check('the gate brings you back to the same spot (hash kept in next=)', async () => {
  const { page } = await open({ session: null, hash: '#review' });
  await page.waitForSelector('#gate:not([hidden])', { timeout: 8000 });
  assert.match(await page.$eval('#gate a.btn.gold', (a) => a.getAttribute('href')), /next=%2Fai101%2Fclass%2F%23review/);
});
await check('a broken link hash does not stop the page from wiring up (room link still arrives)', async () => {
  const { page, errors } = await open({ hash: '#%E0%A4%A', rpc: { ea_ai101_room_link: { data: '/room/?k=TEST', error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.getElementById('joinRoom').getAttribute('href') === '/room/?k=TEST', null, { timeout: 5000 });
  assert.deepEqual(errors, []);
});
await check('copy: a quick double tap still comes back to "Copy", and the toast says what to do', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  const btn = '#step-prompt5 [data-copy]';
  await page.click(btn); await page.waitForTimeout(250); await page.click(btn);
  await page.waitForFunction(() => /Copied/.test(document.getElementById('toast').textContent));
  await page.waitForTimeout(2600);
  assert.equal(await page.textContent(btn), 'Copy');
});
await check('copy with no clipboard: the words are selected and the how-to stays up', async () => {
  const { page } = await open({ noClipboard: true });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('#step-prompt5 [data-copy]');
  await page.waitForTimeout(2500);
  assert.match(await page.textContent('#step-prompt5 [data-copy]'), /press and hold/i);
  assert.ok((await page.evaluate(() => String(getSelection()))).length > 10, 'the prompt is selected');
});
await check('the builder only re-announces when its message changes; the token count is spoken once you pause', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.fill('[data-b="role"]', 'a helper');
  await page.evaluate(() => { window.__mut = 0; new MutationObserver(() => window.__mut++).observe(document.getElementById('bMissing'), { childList: true, characterData: true, subtree: true }); });
  await page.type('[data-b="role"]', ' for my club');
  assert.equal(await page.evaluate(() => window.__mut), 0, 'same message, no re-announcement');
  await page.fill('#toyIn', 'Write a caption.');
  await page.waitForFunction(() => document.getElementById('toySay').textContent === '4 tokens', null, { timeout: 3000 });
});
await check('the tool switch says what changed', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pick-tool="chatgpt"]');
  assert.match(await page.textContent('#toolSay'), /ChatGPT/);
});
await check('practice taps and a check question save; a check answer locks and says right or not quite', async () => {
  const { page } = await open({ rpc: { ea_pulse_save: { data: null, error: null } } });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pulse="useful"] [data-score="3"]');
  await page.waitForFunction(() => window.FAKE_LOG.some((x) => x.rpc === 'ea_pulse_save' && x.args && x.args.p_kind === 'useful'));
  await page.click('[data-pulse="chk_safe"] [data-score="1"]');
  await page.waitForFunction(() => /Not quite/.test(document.querySelector('[data-pulse="chk_safe"] .a1c-pulse-msg').textContent));
  const call = await page.evaluate(() => window.FAKE_LOG.find((x) => x.rpc === 'ea_pulse_save' && x.args && x.args.p_kind === 'chk_safe'));
  assert.deepEqual(call.args, { p_slug: 'ai101', p_kind: 'chk_safe', p_score: 1 });
  assert.equal(await page.$eval('[data-pulse="chk_safe"] [data-score="2"]', (b) => b.disabled), true, 'the first answer counts');
  await page.click('[data-pulse="chk_verify"] [data-score="3"]');
  await page.waitForFunction(() => /^Right/.test(document.querySelector('[data-pulse="chk_verify"] .a1c-pulse-msg').textContent));
});
await check('saves carry a time limit; earlier answers are read for THIS person only', async () => {
  const { page } = await open({ rpc: { ea_pulse_save: { data: null, error: null } }, rows: { ea_class_pulse: [{ kind: 'before', score: 3 }] } });
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pulse="before"] [data-score="4"]');
  await page.waitForFunction(() => window.FAKE_LOG.some((x) => x.rpc === 'ea_pulse_save' && 'signal' in x));
  const reads = await page.evaluate(() => window.FAKE_LOG.filter((x) => x.from === 'ea_class_pulse' || x.from === 'ea_reviews'));
  assert.ok(reads.length >= 2);
  for (const r of reads) assert.ok(r.filters.some((f) => f[0] === 'user_id' && f[1] === 'u1'), r.from + ' is filtered to the signed-in person');
});
await check('a tap made before the earlier answers arrive is not overwritten', async () => {
  const { page } = await open({ readDelay: 1200, rpc: { ea_pulse_save: { data: null, error: null } }, rows: { ea_class_pulse: [{ kind: 'after', score: 2 }] } }); // the read lands after the tap
  await page.waitForSelector('#app:not([hidden])');
  await page.click('[data-pulse="after"] [data-score="5"]');
  await page.waitForTimeout(1800);
  assert.equal(await page.$eval('[data-pulse="after"] [data-score="5"]', (b) => b.getAttribute('aria-pressed')), 'true');
});
await check('no connection at load, back later → the next tap reconnects and saves', async () => {
  const { page } = await open({ cdnFailFirst: true, rpc: { ea_pulse_save: { data: null, error: null } } });
  await page.waitForSelector('#app:not([hidden])', { timeout: 9000 });
  await page.click('[data-pulse="before"] [data-score="2"]');
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-pulse="before"] .a1c-pulse-msg').textContent), null, { timeout: 9000 });
});
await check('review: the rating is read out; an error points at its field; the button keeps focus while posting', async () => {
  const { page } = await open({ rpcDelay: 800, rpc: { ea_review_save: { data: { verified: true, status: 'pending' }, error: null } } }); // a slow save
  await page.waitForSelector('#app:not([hidden])');
  await page.focus('#reviewForm button[type="submit"]'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.name), 'stars', 'focus goes to the stars');
  assert.equal(await page.$eval('input[name="stars"]', (i) => i.getAttribute('aria-invalid')), 'true');
  assert.equal(await page.$eval('#rvMsg', (m) => m.classList.contains('err')), true);
  await page.click('label[for="st4"]');
  assert.equal(await page.textContent('.a1c-stars-val'), '4 of 5 stars');
  await page.fill('#reviewForm textarea[name="body"]', 'Clear, kind and useful. Thank you.');
  await page.check('#reviewForm input[name="ok"]');
  await page.focus('#reviewForm button[type="submit"]'); await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  assert.equal(await page.$eval('#reviewForm button[type="submit"]', (b) => b.getAttribute('aria-disabled')), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.type), 'submit', 'focus stays on the button');
  await page.waitForFunction(() => /Thank you/.test(document.getElementById('rvMsg').textContent));
  assert.equal(await page.$eval('#reviewForm button[type="submit"]', (b) => b.getAttribute('aria-disabled')), null);
});
await check('a review in progress survives a reload', async () => {
  const { page } = await open();
  await page.waitForSelector('#app:not([hidden])');
  await page.fill('#reviewForm textarea[name="body"]', 'Half written, then my phone died');
  await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#reviewForm textarea[name="body"]').value === 'Half written, then my phone died');
});
await check('phone: the 1-5 stays on one row; step numbers show; the jump bar clears the header', async () => {
  const { page } = await open({ viewport: { width: 375, height: 667 } });
  await page.waitForSelector('#app:not([hidden])');
  const tops = await page.$$eval('[data-pulse="before"] .a1c-pulse-b', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
  assert.equal(new Set(tops).size, 1, 'all five on one row');
  assert.notEqual(await page.$eval('#step-hi h3', (h) => getComputedStyle(h, '::before').content), 'none');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop), '132px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 375));
});

await check('every button on the class page is at least 44px tall (an older crowd, on phones)', async () => {
  const { page } = await open({ viewport: { width: 375, height: 667 } });
  await page.waitForSelector('#app:not([hidden])');
  const small = await page.$$eval('.a1c .btn, .a1c button', (els) => els.filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 43.5)
    .map((b) => `${(b.id || b.className || b.tagName)} ${Math.round(b.getBoundingClientRect().height)}px`));
  assert.deepEqual(small, []);
});

await browser.close(); srv.kill();
for (const r of results) console.log(r.join('  '));
if (results.some((r) => r[0] === 'FAIL')) process.exit(1);
