// Renders partners/deck/ to partners/taylormade-academy-deck.pdf (16:9) and partners/sheet/ to
// partners/taylormade-academy-programs.pdf (letter), plus PNGs for review with --shots DIR.
// Usage: node scripts/partners-pdf.mjs [--shots DIR]   (serves the repo on a free port while it runs)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(process.env.HOME + '/academy-shots/node_modules/playwright'); }
const shotsAt = process.argv.indexOf('--shots'); const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;

// A free port, so a server left running elsewhere (another worktree) can never answer for this repo.
const port = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = `http://127.0.0.1:${port}`;
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
let srvDied = false; srv.on('exit', () => { srvDied = true; });
for (let i = 0; ; i++) {
  if (srvDied) throw new Error('the local server exited before it answered');
  try { if ((await fetch(base + '/partners/deck/')).ok) break; } catch {}
  if (i > 50) throw new Error('the local server never answered with 200');
  await new Promise(r => setTimeout(r, 100));
}

// Load a print source and refuse to render it if the page or any image failed.
async function open(page, url) {
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  const res = await page.goto(base + url, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) throw new Error(`${url} answered ${res && res.status()}`);
  await page.evaluate(() => document.fonts.ready);
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')));
  if (bad.length || broken.length) throw new Error(`${url}: failed requests ${JSON.stringify(bad)} broken images ${JSON.stringify(broken)}`);
}

let b;
try {
  b = await pw.chromium.launch({ channel: 'chrome' });

  const deck = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await open(deck, '/partners/deck/');
  await deck.pdf({ path: path.join(root, 'partners/taylormade-academy-deck.pdf'), width: '13.333in', height: '7.5in', printBackground: true, preferCSSPageSize: true });
  if (shots) {
    await deck.emulateMedia({ media: 'print' });
    const slides = await deck.$$('.slide');
    for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: `${shots}/slide-${String(i + 1).padStart(2, '0')}.png` });
    const over = await deck.evaluate(() => [...document.querySelectorAll('.slide')].map((s, i) => {
      const r = s.getBoundingClientRect(); const foot = s.querySelector('.foot');
      const limit = foot ? foot.getBoundingClientRect().top - 8 : r.bottom;
      const bad = [...s.querySelectorAll('h1,h2,h3,p,li,img,.stat,.of,.card,.st,.way,.chip,.feat')].filter(e => e.getBoundingClientRect().bottom > limit + 1 && !e.closest('.foot') && !e.closest('.ph')).map(e => e.tagName + '.' + (e.className || '') + ' ' + Math.round(e.getBoundingClientRect().bottom - r.top));
      return bad.length ? { slide: i + 1, bad } : null;
    }).filter(Boolean));
    console.log('deck overflow:', JSON.stringify(over));
  }

  const sheet = await b.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
  await open(sheet, '/partners/sheet/');
  await sheet.pdf({ path: path.join(root, 'partners/taylormade-academy-programs.pdf'), width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
  if (shots) {
    await sheet.emulateMedia({ media: 'print' });
    const pages = await sheet.$$('.page');
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `${shots}/page-${i + 1}.png` });
  }
} finally {
  if (b) await b.close();
  srv.kill();
}
