// Renders partners/deck/ to partners/taylormade-academy-deck.pdf (16:9) and partners/sheet/ to
// partners/taylormade-academy-programs.pdf (letter), plus PNGs for review with --shots DIR.
// Usage: node scripts/partners-pdf.mjs [--shots DIR]   (serves the repo on :8899 while it runs)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(process.env.HOME + '/academy-shots/node_modules/playwright'); }
const shotsAt = process.argv.indexOf('--shots'); const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const srv = spawn('python3', ['-m', 'http.server', '8899', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
try {
  const b = await pw.chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
  // The 16:9 deck first, then the letter-size sheet (the sheet's page is reused below for --shots).
  const deck = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await deck.goto('http://127.0.0.1:8899/partners/deck/', { waitUntil: 'networkidle' });
  await deck.evaluate(() => document.fonts.ready);
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
  await p.goto('http://127.0.0.1:8899/partners/sheet/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(root, 'partners/taylormade-academy-programs.pdf'), width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
  if (shots) {
    await p.emulateMedia({ media: 'print' });
    const pages = await p.$$('.page');
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `${shots}/page-${i + 1}.png` });
    const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
      const r = pg.getBoundingClientRect(); const runner = pg.querySelector('.runner').getBoundingClientRect();
      const kids = [...pg.querySelectorAll('.pad > *, .pad')].map(e => e.getBoundingClientRect().bottom);
      return { page: i + 1, contentBottom: Math.round(Math.max(...kids) - r.top), runnerTop: Math.round(runner.top - r.top) };
    }));
    console.log(JSON.stringify(over));
  }
  await b.close();
} finally { srv.kill(); }
