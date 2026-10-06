// tests/academy/e2e/founder-reviews.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/founder-reviews.e2e.mjs
// The founder's Reviews tab against a fake supabase: the pending count, text-only rendering (no review HTML ever runs),
// approve writes status + approved_at and drops the count, and a refused write (RLS: 0 rows) says so.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-supabase.js', import.meta.url));
const PORT = 8786;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ channel: 'chrome' });
const now = new Date().toISOString();
const REVIEWS = [
  { id: 'r1', workshop_slug: 'ai101', stars: 5, body: '<img src=x onerror="window.__xss=1">Great class, truly', display_name: 'Ann L.', who_line: 'Office manager', verified: true, status: 'pending', created_at: now, updated_at: 't1' },
  { id: 'r2', workshop_slug: 'ai101', stars: 4, body: 'Clear and simple, thank you.', display_name: 'Bo K.', who_line: null, verified: false, status: 'pending', created_at: now, updated_at: 't2' },
];
async function open(extra = {}, rows = REVIEWS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/esm\.sh\/@supabase\/supabase-js/, (r) => r.fulfill({ path: FAKE, contentType: 'text/javascript' }));
  await ctx.addInitScript(({ rows, extra }) => {
    window.FAKE_SESSION = { user: { id: 'n1', email: 'nelson@example.com' } };
    window.FAKE_RPC = { ea_is_admin: { data: true, error: null }, ea_founder_stats: { data: {}, error: null } };
    window.FAKE_ROWS = { ea_reviews: rows };
    Object.assign(window, extra);
  }, { rows, extra });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/founder/#reviews`);
  await page.waitForSelector('#p-reviews.on', { timeout: 10000 });
  await page.waitForFunction((n) => document.getElementById('nRev').textContent === String(n), rows.filter((r) => r.status === 'pending').length);
  return { page, errors };
}
try {
  const { page, errors } = await open();
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'review text never runs');
  assert.equal(await page.$$eval('#rvList img', (x) => x.length), 0, 'no img element from a review');
  assert.match(await page.textContent('#rvList'), /<img src=x/, 'shown as text');
  await page.click('#rvList [data-rv-act="approve"][data-rv="r1"]');
  await page.waitForFunction(() => document.getElementById('nRev').textContent === '1');
  const up = await page.evaluate(() => window.FAKE_LOG.find((x) => x.update === 'ea_reviews'));
  assert.equal(up.values.status, 'approved'); assert.ok(up.values.approved_at);
  assert.deepEqual(up.filters, [['id', 'r1'], ['updated_at', 't1']], 'approves only the version Nelson read');
  assert.notEqual(await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'BODY', 'focus lands somewhere real after the list redraws');
  assert.match(await page.textContent('#rvCount'), /1 review shown/);
  assert.equal(await page.$eval('#rvList [role="img"]', (x) => x.getAttribute('aria-label')), '4 out of 5 stars');
  assert.ok(await page.$eval('#rvList [data-rv-act]', (b) => !!document.getElementById(b.getAttribute('aria-describedby'))), 'each button says which review');
  assert.deepEqual(errors, []);
  // edited after Nelson read it: nothing goes public, he is told, and the list reloads
  const stale = await open({ FAKE_UPDATED_AT: { r1: 't1-edited' } });
  await stale.page.click('#rvList [data-rv-act="approve"][data-rv="r1"]');
  await stale.page.waitForFunction(() => /just edited/.test(document.getElementById('toast').textContent));
  assert.ok(await stale.page.evaluate(() => window.FAKE_LOG.filter((x) => x.from === 'ea_reviews').length >= 2), 'it reloads the reviews');
  // waiting first, then the rest; the three states look different
  const mixed = await open({}, [{ ...REVIEWS[1], id: 'r3', status: 'approved', created_at: new Date(Date.now() + 5e3).toISOString() }, REVIEWS[0]]);
  await mixed.page.selectOption('#rvStatus', '');
  assert.equal(await mixed.page.$eval('#rvList [data-rv]', (b) => b.dataset.rv), 'r1', 'pending sorts first');
  const bg = (st) => mixed.page.$eval(`#rvList .st.${st}`, (x) => getComputedStyle(x).backgroundColor);
  assert.notEqual(await bg('pending'), await bg('approved'));
  // opening the tab reads the reviews fresh
  const reads = () => mixed.page.evaluate(() => window.FAKE_LOG.filter((x) => x.from === 'ea_reviews').length);
  const n0 = await reads();
  await mixed.page.click('#tabs a[data-tab="overview"]'); await mixed.page.click('#tabs a[data-tab="reviews"]');
  await mixed.page.waitForFunction((n) => window.FAKE_LOG.filter((x) => x.from === 'ea_reviews').length > n, n0);
  const refused = await open({ FAKE_UPDATE_EMPTY: true });
  await refused.page.click('#rvList [data-rv-act="approve"][data-rv="r2"]');
  await refused.page.waitForFunction(() => /Not saved/.test(document.getElementById('toast').textContent));
  assert.equal(await refused.page.textContent('#nRev'), '2', 'nothing changed when the write was refused');
  console.log('founder reviews e2e: PASS');
} finally { await browser.close(); srv.kill(); }
