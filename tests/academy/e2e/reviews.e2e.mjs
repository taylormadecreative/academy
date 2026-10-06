// tests/academy/e2e/reviews.e2e.mjs — run: python3 build_site.py && node tests/academy/e2e/reviews.e2e.mjs
// The public review strips: hidden when there are none, text-only rendering (no HTML from a review ever runs),
// the label on home and /agent/, the average only when the server sends one.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const srv = spawn('python3', ['-m', 'http.server', '8785'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch({ channel: 'chrome' });
const FIX = { count: 3, avg: 4.7, items: [
  { display_name: 'Ann L.', who_line: 'Retired teacher, Dallas', stars: 5, body: '<img src=x onerror="window.__xss=1">I can finally ask it for what I want.', verified: true, created_at: '2026-10-10T02:00:00Z' },
  { display_name: 'Bo K.', who_line: null, stars: 4, body: 'Clear and simple.', verified: false, created_at: '2026-10-10T02:05:00Z' } ] };
async function open(path, body) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.route(/\/rest\/v1\/rpc\/ea_reviews_public/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }));
  const p = await ctx.newPage(); await p.goto('http://localhost:8785' + path); await p.waitForTimeout(800); return p;
}
try {
  for (const path of ['/', '/ai101/', '/agent/']) {
    const p = await open(path, FIX);
    assert.equal(await p.$eval('section[data-reviews]', (s) => s.hidden), false, path + ' shows');
    assert.equal(await p.evaluate(() => window.__xss), undefined, path + ' no script ran');
    assert.equal(await p.$$eval('.rv-list img', (x) => x.length), 0, path + ' no img element');
    assert.match(await p.textContent('.rv-list'), /<img src=x/, path + ' shown as text');
    assert.match(await p.textContent('.rv-avg'), /4\.7/);
    assert.equal(await p.$$eval('.rv-from', (x) => x.length), 0, path + ' no extra label repeating the heading');
    assert.match(await p.textContent('.rv-list'), /Verified attendee · Oct 9/, path + ' verified tag from the course module');
    assert.equal(await p.$eval('.rv-who span', (x) => x.textContent), 'Retired teacher, Dallas', path + ' no stray dot to wrap onto its own line');
    assert.equal(await p.$eval('.rv-ver', (x) => getComputedStyle(x).color), 'rgb(6, 122, 86)', path + ' readable green');
  }
  const one = await open('/', { count: 1, avg: null, items: [FIX.items[0]] }); // the likely first state: one review
  await one.setViewportSize({ width: 1440, height: 900 });
  assert.ok(await one.$eval('.rv-card', (c) => c.getBoundingClientRect().width) <= 720, 'one review does not stretch across the page');
  const empty = await open('/', { count: 0, avg: null, items: [] });
  assert.equal(await empty.$eval('section[data-reviews]', (s) => s.hidden), true, 'hidden when empty');
  const noavg = await open('/ai101/', { ...FIX, count: 2, avg: null });
  assert.equal(await noavg.$eval('.rv-avg', (x) => x.hidden), true, 'no average under 3');
  console.log('reviews e2e: PASS');
} finally { await browser.close(); srv.kill(); }
