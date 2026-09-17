// scripts/ht-pages.mjs — run: python3 -m http.server 8790 --bind 127.0.0.1 (repo root) then node scripts/ht-pages.mjs [base]
// Every HT page at 1440 and 390: no page errors, no horizontal overflow, one h1, no dot-pills, no past sample rows.
// Against prod: node scripts/ht-pages.mjs https://taylormadeacademy.com  (reads only; nothing signs in)
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:8790';
const SPACES = ['advancement', 'president', 'events', 'live', 'learn', 'community', 'showcase', 'students', 'career', 'alumni', 'admissions', 'outreach', 'board', 'replay'];
const PAGES = ['/ht/', '/ht/fund/', '/ht/playbook/', '/ht/hub/', ...SPACES.map((k) => '/ht/hub/' + k + '/')];
/* noise that is not a page defect: third-party scripts the sweep does not load, the backend the page cannot reach offline */
const NOISE = /esm\.sh|supabase|cloudflarestream|Failed to load resource|net::ERR|ea_room_state|ERR_NAME_NOT_RESOLVED|the server responded with a status of (401|403|404|5\d\d)/;
const b = await chromium.launch({ channel: 'chrome', headless: true }); let bad = 0;
for (const width of [1440, 390]) for (const u of PAGES) {
  const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + u, { waitUntil: 'load' }).catch((e) => errs.push('goto ' + e.message));
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dots: document.querySelectorAll('.chip.live i, .chip i').length, past: [...document.querySelectorAll('.cal.is-past')].map((n) => n.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)) }));
  const probs = [...errs.map((e) => 'error: ' + e.slice(0, 160)), r.h1 !== 1 ? 'h1 count ' + r.h1 : '', r.wide ? 'horizontal overflow' : '', r.dots ? 'dot pills ' + r.dots : '', ...r.past.map((t) => 'past sample row: ' + t)].filter(Boolean);
  if (probs.length) { bad++; console.log('FAIL ' + width + ' ' + u + '\n  ' + probs.join('\n  ')); } else console.log('OK   ' + width + ' ' + u);
  await p.close();
}
await b.close();
console.log(bad ? bad + ' page(s) failed' : 'every page clean at 1440 and 390');
process.exit(bad ? 1 : 0);
