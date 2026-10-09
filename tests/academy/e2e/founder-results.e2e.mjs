// tests/academy/e2e/founder-results.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/founder-results.e2e.mjs
// The founder's Class results tab against a fake supabase: the empty state, the numbers from fake ea_class_pulse rows
// (Nelson's own taps left out), the read it sends, the Refresh button, and that the 30 s refresh stops off the tab.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-supabase.js', import.meta.url));
const PORT = 8787;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ channel: 'chrome' });
const R = (user_id, kind, score) => ({ user_id, kind, score, updated_at: '2026-10-09T19:10:00Z' });
const ROWS = [
  R('a', 'before', 2), R('a', 'after', 4), R('a', 'useful', 3), R('a', 'chk_safe', 2), R('a', 'chk_verify', 3),
  R('b', 'before', 3), R('b', 'after', 5), R('b', 'steered', 2), R('b', 'chk_safe', 1),
  R('n1', 'before', 5), R('n1', 'chk_safe', 3), // Nelson's own test taps (the fake session is n1)
  { user_id: 'c', kind: '<img src=x onerror="window.__xss=1">', score: 1, updated_at: 'z' },
];
async function open(rows, hash = '#results', clock = false) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  if (clock) await ctx.clock.install(); // time still flows; fastForward jumps the 30 s timer
  await ctx.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ path: FAKE, contentType: 'text/javascript' }));
  await ctx.addInitScript((rows) => {
    window.FAKE_SESSION = { user: { id: 'n1', email: 'nelson@example.com' } };
    window.FAKE_RPC = { ea_is_admin: { data: true, error: null }, ea_founder_stats: { data: {}, error: null } };
    window.FAKE_ROWS = { ea_class_pulse: rows };
  }, rows);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/founder/${hash}`);
  await page.waitForSelector('#app:not([hidden])', { timeout: 10000 });
  return { page, errors };
}
const reads = (page) => page.evaluate(() => window.FAKE_LOG.filter((x) => x.from === 'ea_class_pulse').length);
try {
  // before class: nobody yet
  const empty = await open([]);
  await empty.page.waitForSelector('#p-results.on');
  assert.match(await empty.page.textContent('#resBody'), /No answers yet\.\s*They show up here as people tap on the class page\./);
  assert.equal(await empty.page.textContent('#nRes'), '0');
  assert.deepEqual(empty.errors, []);

  // during class
  const { page, errors } = await open(ROWS);
  await page.waitForSelector('#p-results.on');
  await page.waitForFunction(() => document.getElementById('nRes').textContent === '2');
  const q = await page.evaluate(() => window.FAKE_LOG.find((x) => x.from === 'ea_class_pulse'));
  assert.deepEqual(q.filters, [['workshop_slug', 'ai101']], 'reads only the AI 101 class');
  const body = await page.textContent('#resBody');
  assert.match(body, /\+2\.0\s*Average change in confidence\s*For the 2 who answered before and after/);
  assert.match(body, /2\.5\s*Confidence before, out of 5\s*2 answered/, 'Nelson\'s own 5 is left out');
  assert.match(body, /4\.5\s*Confidence after, out of 5/);
  assert.match(body, /50%\s*got it right · 1 of 2/, 'chk_safe: one of the two real answers is right');
  assert.match(body, /100%\s*got it right · 1 of 1/, 'chk_verify');
  assert.match(body, /Nobody has answered yet/, 'chk_prompt has no answers');
  assert.equal(await page.$$eval('#resBody .cr-row.right .cr-tag', (x) => x.length), 3, 'each question marks its right answer in words');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'a strange row never runs');
  assert.match(await page.textContent('#resAsof'), /^Last updated /);

  // Refresh now reads again and redraws with what is there now
  const n0 = await reads(page);
  await page.evaluate(() => { window.FAKE_ROWS.ea_class_pulse.push({ user_id: 'd', kind: 'before', score: 4, updated_at: '2026-10-09T19:20:00Z' }); });
  await page.click('#resRefresh');
  await page.waitForFunction(() => document.getElementById('nRes').textContent === '3');
  assert.ok((await reads(page)) > n0, 'Refresh now reads the table again');

  assert.deepEqual(errors, []);

  // the 30 s refresh runs while the tab is open and stops when Nelson leaves it
  const t = await open(ROWS, '#results', true);
  await t.page.waitForFunction(() => document.getElementById('nRes').textContent === '2');
  const r0 = await reads(t.page);
  assert.equal(r0, 1, 'opening straight on #results reads once, not twice');
  await t.page.clock.fastForward(30000);
  await t.page.waitForFunction((n) => window.FAKE_LOG.filter((x) => x.from === 'ea_class_pulse').length > n, r0);
  await t.page.click('#tabs a[data-tab="overview"]');
  const r1 = await reads(t.page);
  await t.page.clock.fastForward(90000);
  await t.page.waitForTimeout(200);
  assert.equal(await reads(t.page), r1, 'no reads once the tab is closed');
  await t.page.click('#tabs a[data-tab="results"]');
  await t.page.waitForFunction((n) => window.FAKE_LOG.filter((x) => x.from === 'ea_class_pulse').length > n, r1); // reopening reads fresh
  assert.deepEqual(t.errors, []);
  console.log('founder results e2e: PASS');
} finally { await browser.close(); srv.kill(); }
