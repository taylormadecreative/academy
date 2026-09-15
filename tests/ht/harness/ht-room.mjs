// ht-room.mjs — run: node tests/ht/harness/ht-room.mjs   (server on :8790 from the repo root; see README.md)
import { chromium } from 'playwright';
import fs from 'node:fs';
const H = new URL('./', import.meta.url);
const SB = fs.readFileSync(new URL('stub-supabase.js', H), 'utf8'), R2 = fs.readFileSync(new URL('stub-room-v2.js', H), 'utf8');
const KEY = 'AbC123_-xyzXYZ0987ab-_';
const base = { id: 'r-ht', slug: 'ht', title: 'HT Live', is_live: false, host_name: 'Dr. Gray', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
const room = { id: 'r-ht', slug: 'ht', title: 'HT Live', host_name: 'Dr. Gray', host_emails: [], link_key: KEY, is_live: false, live_since: null, max_participants: 50, recording_url: null };
const sess = { user: { id: 'u1', email: 'x@y.z' }, access_token: 't' };
const out = []; const ok = (n, c, d = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' · ' + d));

const b = await chromium.launch({ channel: 'chrome', headless: true });
async function page(db, { width = 1280, url = '/ht/hub/live/?k=' + KEY } = {}) {
  const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const rec = [];
  await p.addInitScript((d) => { window.__db = d; window.__calls = []; }, db);
  await p.route('https://esm.sh/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB }));
  await p.route('**/js/rtk-room-v2.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: R2 }));
  await p.route('**/ea-rtk-record', async r => { rec.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, stopped: true }) }); });
  await p.goto('http://127.0.0.1:8790' + url);
  await p.waitForFunction(() => !document.querySelector('.ht-room-loading') || /could not/.test(document.querySelector('.ht-room-loading').textContent));
  return { p, errs, rec };
}
const text = (p, s) => p.locator(s).first().textContent().then(t => (t || '').trim());

/* 1 signed out → landing card in HT colors, sign-in carries the key */
{ const { p, errs } = await page({ state: { ...base, signed_in: false }, session: null, room, replays: [], members: [], profiles: [] });
  ok('landing: host’s room', (await text(p, '.ht-room-card h3')) === 'Dr. Gray’s room');
  ok('landing: sign-in keeps the key', (await p.getAttribute('.ht-room-card a.btn', 'href')).includes(encodeURIComponent('?k=' + KEY)));
  ok('landing: Mahogany card', (await p.evaluate(() => getComputedStyle(document.querySelector('.ht-room-card')).backgroundColor)) === 'rgb(59, 0, 0)');
  ok('landing: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 2 dead link */
{ const { p } = await page({ state: { bad_link: true }, session: sess, room, replays: [], members: [], profiles: [] });
  ok('dead link card', /isn’t active anymore/.test(await text(p, '.ht-room-card h3'))); await p.close(); }
/* 3 signed in, no key, never joined */
{ const { p } = await page({ state: { ...base, can_join: false }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  ok('not allowed: host’s link line', /host’s link/.test(await text(p, '.ht-room-card p:not(.s)'))); await p.close(); }
/* 4 waiting → Ada + the host’s name; flips live → reload */
{ const { p } = await page({ state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] });
  await p.waitForSelector('.r2-join');
  ok('waiting: mode', await p.evaluate(() => window.__mount.mode === 'waiting'));
  ok('waiting: HT words + tokens + key + slug reached the room', await p.evaluate(() => window.__mount.target.words.host === 'Dr. Gray' && window.__mount.target.tokens.colors.brand[500] === '#FFCC00' && window.__mount.target.slug === 'ht' && window.__mount.target.key === 'AbC123_-xyzXYZ0987ab-_'));
  ok('waiting: the line names the host', /Dr\. Gray hasn’t started yet/.test(await text(p, '.r2-line')));
  ok('waiting: Ada beside the line', /ada-face\.jpg/.test(await p.evaluate(() => getComputedStyle(document.querySelector('.r2-line'), '::before').backgroundImage)));
  await p.close(); }
/* 5 the host: idle → Start → opened → live → joined → recording → Leave → stop → off air */
{ const { p, errs, rec } = await page({ state: { ...base, is_host: true, people: 0 }, session: sess, admin: true, room: { ...room }, replays: [], members: [], profiles: [] });
  await p.waitForSelector('#rmStart');
  ok('host: link field', (await p.inputValue('#rmLink')).endsWith('?k=' + KEY));
  ok('host: hosts textarea for the admin', !!(await p.$('#rmHosts')));
  ok('host: off air', (await text(p, '#rmStatus')) === 'Off air');
  await p.click('#rmNew'); ok('new link: armed', /Tap again/.test(await text(p, '#rmNew')));
  await p.click('#rmNew'); await p.waitForFunction(() => document.getElementById('rmLink').value.includes('NEWKEY'));
  ok('new link: rotated', true);
  await p.fill('#rmTitle', 'Fall town hall'); await p.press('#rmTitle', 'Tab');
  await p.waitForFunction(() => document.getElementById('rmTitleSaved').textContent === 'Saved');
  ok('title saves on blur', await p.evaluate(() => window.__db.room.title === 'Fall town hall'));
  await p.click('#rmStart');
  await p.waitForFunction(() => window.__db.room.is_live === true);
  ok('start: room flipped live via onOpened', true);
  ok('start: page never writes live_since', await p.evaluate(() => !window.__calls.some(c => c[0]==='from' && c[1]==='ea_rooms' && c[2]==='update' && c[4] && 'live_since' in c[4])));
  ok('start: button reads running', (await text(p, '#rmStart')) === 'Class is running');
  ok('start: recording NOT started before joined', rec.length === 0);
  await p.evaluate(() => window.__room.state('joined'));
  await p.waitForFunction(() => window.__rec === true);
  ok('joined: recording started with room:ht', rec.length === 1 && rec[0].room === 'ht' && rec[0].action === 'start');
  ok('joined: chrome hidden in room', await p.evaluate(() => getComputedStyle(document.querySelector('.ht-tabs')).display === 'none'));
  await p.evaluate(() => window.__room.leave());
  await p.waitForFunction(() => window.__db.room.is_live === false);
  ok('leave: stop sent, room off air', rec.length === 2 && rec[1].action === 'stop');
  ok('leave: note says the replay is being prepared', /replay is being prepared/.test(await text(p, '#rmNote')));
  ok('host: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 6 replays: publish → Last session iframe */
{ const reps = [{ id: 'rep1', status: 'ready', watch_url: 'https://customer-x.cloudflarestream.com/abc/watch', duration_s: 1830, published: false, error: null, created_at: '2026-09-17T18:00:00Z' }];
  const { p } = await page({ state: { ...base, is_host: true }, session: sess, admin: true, room: { ...room }, replays: reps, members: [], profiles: [] });
  await p.waitForSelector('[data-pub]');
  ok('replay row: label + minutes', /ready — review, then publish · 31 min/.test(await text(p, '.ht-room-rep')));
  await p.click('[data-pub]'); await p.waitForSelector('#rmLast iframe');
  ok('publish: iframe uses /iframe', (await p.getAttribute('#rmLast iframe', 'src')).endsWith('/abc/iframe'));
  ok('publish: button flips', (await text(p, '[data-pub]')) === 'Unpublish'); await p.close(); }
/* 7 a guest who joined before sees Last session on the landing card */
{ const { p } = await page({ state: { ...base, can_join: false, recording_url: 'https://customer-x.cloudflarestream.com/abc/watch' }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  ok('past joiner: Last session', !!(await p.$('.ht-room-last iframe'))); await p.close(); }
/* 8 phone: no horizontal overflow on the host card and the waiting screen */
for (const [name, db] of [['host', { state: { ...base, is_host: true }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] }], ['waiting', { state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] }]]) {
  const { p } = await page(db, { width: 390 });
  await p.waitForTimeout(400);
  ok('phone ' + name + ': no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= 390 + 1)); await p.close(); }
await b.close();
console.log(out.join('\n')); console.log(out.filter(l => l.startsWith('OK')).length + ' OK · ' + out.filter(l => l.startsWith('FAIL')).length + ' FAIL');
process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
