// ht-room.mjs — run: node tests/ht/harness/ht-room.mjs   (server on :8790 from the repo root; see README.md)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { realModuleScenarios } from './room-v2-real.mjs';   /* the REAL room module against a fake kit client (R1–R3) */
const H = new URL('./', import.meta.url);
const SB = fs.readFileSync(new URL('stub-supabase.js', H), 'utf8'), R2 = fs.readFileSync(new URL('stub-room-v2.js', H), 'utf8');
const KEY = 'AbC123_-xyzXYZ0987ab-_';
const base = { id: 'r-ht', slug: 'ht', title: 'HT Live', is_live: false, host_name: 'Dr. Gray', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
const room = { id: 'r-ht', slug: 'ht', title: 'HT Live', host_name: 'Dr. Gray', host_emails: [], link_key: KEY, is_live: false, live_since: null, max_participants: 50, recording_url: null };
const sess = { user: { id: 'u1', email: 'x@y.z' }, access_token: 't' };
const out = []; const ok = (n, c, d = '') => out.push((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' · ' + d));

const b = await chromium.launch({ channel: 'chrome', headless: true });
/* the page has settled once room.js replaced the "Opening the room…" line (or ht.js gave up) */
const settle = (p) => p.waitForFunction(() => !document.querySelector('.ht-room-loading') || /could not/.test(document.querySelector('.ht-room-loading').textContent));
/* stateFor: a function (stringified into the browser) that answers ea_room_state from its args;
   it reads window.__db, which every navigation of the page rebuilds from `db`.
   seed: an {k, t} planted under localStorage 'ht-room-key' before the page runs — a key this
   device remembered on an earlier visit. */
async function page(db, { width = 1280, url = '/ht/hub/live/?k=' + KEY, stateFor = null, seed = null, pollMs = 0 } = {}) {
  const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const rec = [];
  await p.addInitScript((d) => { window.__db = d; window.__calls = []; }, db);
  if (pollMs) await p.addInitScript((ms) => { window.__htRoomPollMs = ms; }, pollMs);   /* the ended card's poll, in seconds not minutes */
  if (stateFor) await p.addInitScript('window.__db.stateFor = ' + stateFor.toString() + ';');
  if (seed) await p.addInitScript((v) => { try { localStorage.setItem('ht-room-key', JSON.stringify(v)); } catch (e) {} }, seed);
  await p.route('https://esm.sh/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB }));
  await p.route('**/js/rtk-room-v2.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: R2 }));
  await p.route('**/ea-rtk-record', async r => { rec.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, stopped: true }) }); });
  await p.goto('http://127.0.0.1:8790' + url);
  await settle(p);
  return { p, errs, rec };
}
const stateCalls = (p) => p.evaluate(() => window.__calls.filter(c => c[0] === 'rpc' && c[1] === 'ea_room_state').map(c => c[2].p_key));
const stored = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('ht-room-key')); } catch (e) { return 'unreadable'; } });
const text = (p, s) => p.locator(s).first().textContent().then(t => (t || '').trim());

/* 1 signed out → landing card in HT colors, sign-in carries the key */
{ const { p, errs } = await page({ state: { ...base, signed_in: false }, session: null, room, replays: [], members: [], profiles: [] });
  ok('landing: host’s room', (await text(p, '.ht-room-card h3')) === 'Dr. Gray’s room');
  ok('landing: sign-in keeps the key', (await p.getAttribute('.ht-room-card a.btn', 'href')).includes(encodeURIComponent('?k=' + KEY)));
  ok('landing: says the code brings you straight back', /Type the code and you’ll be brought straight back here/.test(await text(p, '.ht-room-card p.fine')));
  ok('landing: the key is remembered on the device', (await stored(p))?.k === KEY);
  ok('landing: header Sign in carries the key too', (await p.getAttribute('.site-header a[href^="/login/"]', 'href')).includes(encodeURIComponent('?k=' + KEY)));
  ok('landing: Mahogany card', (await p.evaluate(() => getComputedStyle(document.querySelector('.ht-room-card')).backgroundColor)) === 'rgb(59, 0, 0)');
  ok('landing: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 2 dead link in the URL itself → the dead-link card, one state call, no retry without the key */
{ const { p } = await page({ state: { bad_link: true }, session: sess, room, replays: [], members: [], profiles: [] });
  ok('dead link card', /isn’t active anymore/.test(await text(p, '.ht-room-card h3')));
  ok('dead link in the URL: asked once, with the key', JSON.stringify(await stateCalls(p)) === JSON.stringify([KEY])); await p.close(); }
/* 3 (b) signed in, no key, never joined → "Almost in." with the invitation-link line; the live line only when live */
{ const { p, errs } = await page({ state: { ...base, can_join: false }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  const t = await text(p, '.ht-room-card');
  ok('not allowed: Almost in.', (await text(p, '.ht-room-card h3')) === 'Almost in.');
  ok('not allowed: the invitation link line', /invitation link/.test(t) && /\?k=/.test(t) && /signed in/.test(t));
  ok('not allowed: phone/laptop line is the fine print', /On a phone, tap the link/.test(await text(p, '.ht-room-card p.fine')));
  ok('not allowed: off air → no "running now" line', !/running now/.test(t));
  ok('not allowed: no button that goes nowhere', (await p.$$('.ht-room-card a.btn, .ht-room-card button')).length === 0);
  ok('not allowed: no host name, no page errors', !/Dr\. Gray/.test(t) && errs.length === 0, errs.join(' | ')); await p.close(); }
{ const { p } = await page({ state: { ...base, can_join: false, is_live: true }, session: sess, room, replays: [], members: [], profiles: [] }, { url: '/ht/hub/live/' });
  ok('not allowed, live: the session-is-running line', /The session is running now/.test(await text(p, '.ht-room-card'))); await p.close(); }
/* 3 (a) open with ?k=, then the same page again WITHOUT ?k= (localStorage kept) → the key still reaches ea_room_state and the join target */
{ const { p, errs } = await page({ state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] });
  await p.waitForSelector('.r2-join');
  ok('remembered key: first load asked with the URL key', JSON.stringify(await stateCalls(p)) === JSON.stringify([KEY]));
  await p.goto('http://127.0.0.1:8790/ht/hub/live/'); await settle(p); await p.waitForSelector('.r2-join');
  ok('remembered key: reload without ?k= still asks with the key', JSON.stringify(await stateCalls(p)) === JSON.stringify([KEY]));
  ok('remembered key: the join target carries it', await p.evaluate(() => window.__mount.target.key === 'AbC123_-xyzXYZ0987ab-_' && window.__mount.mode === 'waiting'));
  ok('remembered key: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 3 (c) a remembered key the host has since rotated → forget it, ask again with no key, show Almost in. — never the dead-link card */
{ const rotated = (a) => (a.p_key ? { bad_link: true } : Object.assign({}, window.__db.state, { can_join: false }));
  const { p, errs } = await page({ state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] });
  await p.waitForSelector('.r2-join');
  await p.addInitScript('window.__db.stateFor = ' + rotated.toString() + ';');   /* the next navigation: the server no longer knows the key */
  await p.goto('http://127.0.0.1:8790/ht/hub/live/'); await settle(p);
  ok('rotated key: asked with the stored key, then again with null', JSON.stringify(await stateCalls(p)) === JSON.stringify([KEY, null]));
  ok('rotated key: forgotten on the device', (await stored(p)) === null);
  ok('rotated key: Almost in., not the dead-link card', (await text(p, '.ht-room-card h3')) === 'Almost in.' && !/isn’t active anymore/.test(await text(p, '.ht-room-card')));
  ok('rotated key: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 3 (c″) the same, signed out → the landing card, and neither Sign in carries the dead key */
{ const { p } = await page({ state: { ...base, signed_in: false }, session: null, room, replays: [], members: [], profiles: [] },
    { url: '/ht/hub/live/', seed: { k: KEY, t: Date.now() - 3600e3 }, stateFor: (a) => (a.p_key ? { bad_link: true } : window.__db.state) });
  ok('rotated key, signed out: asked with the stored key, then again with null', JSON.stringify(await stateCalls(p)) === JSON.stringify([KEY, null]));
  ok('rotated key, signed out: landing card, key forgotten', (await text(p, '.ht-room-card h3')) === 'Dr. Gray’s room' && (await stored(p)) === null);
  ok('rotated key, signed out: neither Sign in carries it', !(await p.getAttribute('.ht-room-card a.btn', 'href')).includes('k%3D') && !(await p.getAttribute('.site-header a[href^="/login/"]', 'href')).includes('k%3D'));
  await p.close(); }
/* 3 (c′) a remembered key older than 7 days is ignored: the page asks once, with no key */
{ const { p } = await page({ state: { ...base, can_join: false }, session: sess, room, replays: [], members: [], profiles: [] },
    { url: '/ht/hub/live/', seed: { k: KEY, t: Date.now() - 8 * 24 * 3600e3 }, stateFor: (a) => (a.p_key ? { bad_link: true } : window.__db.state) });
  ok('stale key: ignored, asked once with null', JSON.stringify(await stateCalls(p)) === JSON.stringify([null]));
  ok('stale key: Almost in.', (await text(p, '.ht-room-card h3')) === 'Almost in.'); await p.close(); }
/* 4 waiting → Ada + the host’s name; flips live → reload */
{ const { p } = await page({ state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] });
  await p.waitForSelector('.r2-join');
  ok('waiting: mode', await p.evaluate(() => window.__mount.mode === 'waiting'));
  ok('waiting: HT words + tokens + key + slug reached the room', await p.evaluate(() => window.__mount.target.words.host === 'Dr. Gray' && window.__mount.target.tokens.colors.brand[500] === '#FFCC00' && window.__mount.target.slug === 'ht' && window.__mount.target.key === 'AbC123_-xyzXYZ0987ab-_'));
  ok('waiting: the line names the host', /Dr\. Gray hasn’t started yet/.test(await text(p, '.r2-line')));
  ok('waiting: Ada beside the line', /ada-face\.jpg/.test(await p.evaluate(() => getComputedStyle(document.querySelector('.r2-line'), '::before').backgroundImage)));
  /* the HT wordmark inside the room (Nelson, 9/15): the target carries it, the join screen draws it above the kicker, the file really loads, and room.css sizes it */
  ok('waiting: the wordmark reached the room target', await p.evaluate(() => window.__mount.target.logo.src === '/ht/img/ht-wordmark-gold.png'));
  ok('waiting: the strip gets the monogram, not the wordmark', await p.evaluate(() => (window.__mount.target.mark || {}).src === '/ht/img/ht-monogram-gold.png'));
  ok('waiting: the wordmark is the first thing on the join screen', await p.evaluate(() => { const i = document.querySelector('.r2-join .r2-brand'); return !!i && i.tagName === 'IMG' && i === document.querySelector('.r2-join-left').firstElementChild && i.nextElementSibling.classList.contains('r2-kicker'); }));
  await p.waitForFunction(() => { const i = document.querySelector('.r2-join .r2-brand'); return !!i && i.complete; }, null, { timeout: 5000 }).catch(() => {});
  ok('waiting: the wordmark file loads', await p.evaluate(() => { const i = document.querySelector('.r2-join .r2-brand'); return !!i && i.naturalWidth > 0; }));
  { const h = await p.evaluate(() => document.querySelector('.r2-join .r2-brand').getBoundingClientRect().height);
    ok('waiting: the wordmark is 20–28px tall', h >= 20 && h <= 28, 'height ' + h); }
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
  ok('start: Start is gone — the button reads Entering / Enter the running session', /^(Entering…|Enter the running session)$/.test(await text(p, '#rmStart')));
  ok('start: recording NOT started before joined', rec.length === 0);
  await p.evaluate(() => window.__room.state('joined'));
  await p.waitForFunction(() => window.__rec === true);
  ok('joined: recording started with room:ht', rec.length === 1 && rec[0].room === 'ht' && rec[0].action === 'start');
  ok('joined: chrome hidden in room', await p.evaluate(() => getComputedStyle(document.querySelector('.ht-tabs')).display === 'none'));
  /* the strip mark: the academic monogram (HT minimum 0.43in ≈ 41px wide) at 24px tall — the wordmark at strip height fell under its own minimum */
  await p.waitForFunction(() => { const i = document.querySelector('.r2-now .r2-brand-strip'); return !!i && i.complete; }, null, { timeout: 5000 }).catch(() => {});
  { const m = await p.evaluate(() => { const i = document.querySelector('.r2-now .r2-brand-strip'); if (!i) return null; const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), nat: i.naturalWidth, w: r.width, h: r.height, first: i === i.parentElement.firstElementChild }; });
    ok('joined: the strip opens with the monogram, 24px tall and ≥41px wide', !!m && m.src === '/ht/img/ht-monogram-gold.png' && m.nat > 0 && m.first && Math.abs(m.h - 24) < 1 && m.w >= 41, JSON.stringify(m)); }
  /* ---- nobody ends a class by accident (Nelson, 9/15) ---- */
  /* the bar for everyone: Share my screen, Effects, Captions, Tools, Leave — no "Need help?" */
  ok('host bar: Share my screen + Effects + Captions + Tools + Leave', await p.evaluate(() => ['.r2-share', '.r2-fx-btn', '.r2-cc-btn', '.r2-tools', '.r2-leave'].every(s => !!document.querySelector('.r2-bar ' + s)) && !document.querySelector('.r2-help')));
  /* Leave: the host is out, the session keeps running — no record stop, no row flip, the still-running card with Rejoin + End */
  await p.evaluate(() => window.__room.leave());
  await p.waitForFunction(() => !document.getElementById('rmStill').hidden);
  ok('host leave: is_live stays true', await p.evaluate(() => window.__db.room.is_live === true && window.__db.state.is_live === true));
  ok('host leave: no record stop, no row update', rec.length === 1 && await p.evaluate(() => !window.__calls.some(c => c[0] === 'from' && c[1] === 'ea_rooms' && c[2] === 'update' && c[4] && 'is_live' in c[4])));
  ok('host leave: the still-running card', /You left — the session is still running\./.test(await text(p, '#rmStill')));
  ok('host leave: the room is unmounted, the control is back', await p.evaluate(() => document.getElementById('rtkMount').innerHTML === '' && !document.body.classList.contains('in-room') && getComputedStyle(document.querySelector('.ht-room-ctl')).display !== 'none'));
  ok('host leave: Start is not reachable — the button reads Rejoin', /^Rejoin the running session/.test(await text(p, '#rmStart')) && !(await p.isDisabled('#rmStart')));
  ok('host leave: End the session for everyone is offered', !(await p.isHidden('#rmEnd')) && (await text(p, '#rmEnd')) === 'End the session for everyone');
  ok('host leave: no ended / left card', (await p.$$('.ht-room-card')).length === 0);
  /* the card's End: two taps → stop + off air */
  await p.click('#rmEnd');
  ok('end: first tap arms it', (await text(p, '#rmEnd')) === 'End the session for everyone? Tap again to end it.' && rec.length === 1 && await p.evaluate(() => window.__db.room.is_live === true));
  await p.click('#rmEnd');
  await p.waitForFunction(() => window.__db.room.is_live === false);
  ok('end: second tap — stop sent, room off air', rec.length === 2 && rec[1].action === 'stop');
  ok('end: note says the replay is being prepared', /replay is being prepared/.test(await text(p, '#rmNote')));
  ok('end: the still-running card is gone; Start is back', await p.evaluate(() => document.getElementById('rmStill').hidden) && (await text(p, '#rmStart')) === 'Start class — everyone on camera');
  ok('host: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 5b the ROOT CAUSE of 9/15: the host page's socket drops (a 'disconnected'-style roomLeft) → NO record stop, NO is_live
   flip, the Reconnecting strip shows, and after the rejoin lands the host is back in the same meeting with no card */
{ const { p, errs, rec } = await page({ state: { ...base, is_host: true, people: 0 }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] });
  await p.waitForSelector('#rmStart'); await p.click('#rmStart');
  await p.waitForFunction(() => window.__db.room.is_live === true);
  await p.evaluate(() => window.__room.state('joined')); await p.waitForFunction(() => window.__rec === true);
  await p.evaluate(() => window.__room.state('disconnected'));
  await p.waitForFunction(() => { const s = document.querySelector('.r2-reconnect'); return !!s && !s.hidden; });
  ok('drop: the Reconnecting strip shows', /Reconnecting/.test(await text(p, '.r2-reconnect')));
  ok('drop: the room stays mounted, no card', await p.evaluate(() => !!document.querySelector('#rtkMount .r2') && document.body.classList.contains('in-room') && !document.querySelector('.ht-room-card')));
  ok('drop: no record stop', rec.length === 1 && rec[0].action === 'start');
  ok('drop: is_live stays true, no row update', await p.evaluate(() => window.__db.room.is_live === true && !window.__calls.some(c => c[0] === 'from' && c[1] === 'ea_rooms' && c[2] === 'update' && c[4] && 'is_live' in c[4])));
  ok('drop: the still-running card is NOT shown (nothing left yet)', await p.evaluate(() => document.getElementById('rmStill').hidden));
  await p.evaluate(() => window.__room.rejoinOk());
  await p.waitForFunction(() => { const s = document.querySelector('.r2-reconnect'); return !!s && s.hidden; });
  ok('rejoin: strip gone, same meeting, still in the room, no card', await p.evaluate(() => window.__room.meetingId === 'm-new' && !!document.querySelector('#rtkMount .r2') && document.body.classList.contains('in-room') && !document.querySelector('.ht-room-card') && document.getElementById('rmStill').hidden));
  ok('rejoin: still one record start, no stop', rec.length === 1);
  ok('rejoin: is_live still true', await p.evaluate(() => window.__db.room.is_live === true));
  /* a second drop that cannot be mended → the still-running card with Rejoin, still no end */
  await p.evaluate(() => window.__room.state('failed'));
  await p.waitForFunction(() => { const s = document.querySelector('.r2-reconnect'); return !!s && !s.hidden; });
  await p.evaluate(() => window.__room.rejoinFail());
  await p.waitForFunction(() => !document.getElementById('rmStill').hidden);
  ok('drop unmended: the still-running card, Rejoin offered, no stop, row live', rec.length === 1 && /Rejoin/.test(await text(p, '#rmStart')) && /connection dropped/.test(await text(p, '#rmNote')) && await p.evaluate(() => window.__db.room.is_live === true));
  ok('drop: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 5c End from Tools inside the room (the module says 'ended') → stop + off air; and a second screen taking the seat ('kicked') never ends it */
{ const { p, errs, rec } = await page({ state: { ...base, is_host: true, people: 0 }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] });
  await p.waitForSelector('#rmStart'); await p.click('#rmStart');
  await p.waitForFunction(() => window.__db.room.is_live === true);
  await p.evaluate(() => window.__room.state('joined')); await p.waitForFunction(() => window.__rec === true);
  await p.evaluate(() => window.__room.state('kicked'));
  await p.waitForFunction(() => !document.getElementById('rmStill').hidden);
  ok('host kicked (second screen): still running, no stop, row live', rec.length === 1 && await p.evaluate(() => window.__db.room.is_live === true) && /Another screen took your seat/.test(await text(p, '#rmNote')));
  await p.click('#rmStart');   /* Rejoin */
  await p.waitForFunction(() => window.__mount && window.__mount.mode === 'host' && document.body.classList.contains('in-room'));
  ok('rejoin from the card: back in as host, same meeting, no new row write', await p.evaluate(() => window.__mount.mode === 'host' && !window.__calls.some(c => c[0] === 'from' && c[1] === 'ea_rooms' && c[2] === 'update')));
  await p.evaluate(() => window.__room.state('joined'));
  await p.waitForFunction(() => window.__rec === true);
  ok('rejoin: record start asked again (idempotent server-side), still no stop', rec.length === 2 && rec[1].action === 'start');
  await p.evaluate(() => window.__room.end());   /* Tools → End the session for everyone, confirmed */
  await p.waitForFunction(() => window.__db.room.is_live === false);
  ok('end from Tools: stop sent, room off air', rec.length === 3 && rec[2].action === 'stop');
  ok('end from Tools: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 5e the host left, and another host ended the session meanwhile: Rejoin re-reads the row and never walks into a
   fresh meeting — the still-running line comes down, the note says it ended, Start is back; nothing mounted */
{ const { p, errs, rec } = await page({ state: { ...base, is_host: true, people: 0 }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] });
  await p.waitForSelector('#rmStart'); await p.click('#rmStart');
  await p.waitForFunction(() => window.__db.room.is_live === true);
  await p.evaluate(() => window.__room.state('joined')); await p.waitForFunction(() => window.__rec === true);
  await p.evaluate(() => window.__room.leave());
  await p.waitForFunction(() => !document.getElementById('rmStill').hidden);
  await p.evaluate(() => { window.__db.state.is_live = false; window.__db.room.is_live = false; window.__mount = null; });   /* ended from another screen */
  await p.click('#rmStart');   /* still reads Rejoin — the page must ask the server first */
  await p.waitForFunction(() => /has ended since you left/.test(document.getElementById('rmNote').textContent));
  ok('rejoin after an end elsewhere: nothing mounted, no host join', await p.evaluate(() => window.__mount === null && document.getElementById('rtkMount').innerHTML === '' && !document.body.classList.contains('in-room')));
  ok('rejoin after an end elsewhere: Start is back, the still-running line is down', (await text(p, '#rmStart')) === 'Start class — everyone on camera' && await p.evaluate(() => document.getElementById('rmStill').hidden && document.getElementById('rmEnd').hidden));
  ok('rejoin after an end elsewhere: no stop sent from here, no row write', rec.length === 1 && await p.evaluate(() => !window.__calls.some(c => c[0] === 'from' && c[1] === 'ea_rooms' && c[2] === 'update' && c[4] && 'is_live' in c[4])));
  ok('rejoin after an end elsewhere: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
/* 5d a guest: Leave → left card with Rejoin; kicked → the ended card that keeps listening and offers Rejoin once the room is live AGAIN */
{ const { p, errs, rec } = await page({ state: { ...base, is_live: true }, session: sess, room: { ...room, is_live: true }, replays: [], members: [], profiles: [] }, { pollMs: 600 });
  await p.waitForSelector('.r2-join');
  await p.evaluate(() => window.__room.state('joined'));
  await p.waitForSelector('.r2-bar');
  ok('guest bar: Share my screen + Effects + Captions + Tools + Leave, no "Need help?"', await p.evaluate(() => ['.r2-share', '.r2-fx-btn', '.r2-cc-btn', '.r2-tools', '.r2-leave'].every(s => !!document.querySelector('.r2-bar ' + s)) && !document.querySelector('.r2-help') && !/Need help/.test(document.querySelector('.r2-bar').textContent)));
  await p.evaluate(() => window.__room.state('left'));
  await p.waitForSelector('.ht-room-card');
  ok('guest leave: the left card with Rejoin', /You left the room/.test(await text(p, '.ht-room-card h3')) && /Rejoin/.test(await text(p, '.ht-room-card a.btn')));
  ok('guest leave: nothing recorded or written', rec.length === 0 && await p.evaluate(() => !window.__calls.some(c => c[0] === 'from' && c[2] === 'update')));
  /* back in, then removed: the ended card; the room stays live (a kick mid-class) → no Rejoin yet; it goes off air, then live → Rejoin */
  await p.click('.ht-room-card a.btn'); await settle(p); await p.waitForSelector('.r2-join');
  await p.evaluate(() => window.__room.state('joined')); await p.waitForSelector('.r2-bar');
  await p.evaluate(() => window.__room.state('kicked'));
  await p.waitForSelector('.ht-room-card');
  ok('guest kicked: the ended card', /This session has ended/.test(await text(p, '.ht-room-card h3')));
  await p.waitForTimeout(1500);
  ok('guest kicked, room still live: no Rejoin offered yet', await p.evaluate(() => document.querySelector('.ht-room-back').hidden));
  await p.evaluate(() => { window.__db.state.is_live = false; }); await p.waitForTimeout(1300);
  await p.evaluate(() => { window.__db.state.is_live = true; });
  await p.waitForFunction(() => !document.querySelector('.ht-room-back').hidden, null, { timeout: 5000 });
  ok('guest kicked, live again: "The session is back on — rejoin" with a Rejoin link that carries the key', /back on/.test(await text(p, '.ht-room-back')) && (await p.getAttribute('.ht-room-back a.btn', 'href')).includes('?k=' + KEY));
  ok('guest: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
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
/* 8 phone (390): no horizontal overflow; while waiting the wordmark is ON SCREEN once the scroll settles (it is measured
   after the mount, when body.in-room has already hidden the chrome above the room); in class the strip mark is the
   monogram and the guest's "This session is being recorded" line is fully visible — it wraps, never ellipsizes */
for (const [name, db] of [['host', { state: { ...base, is_host: true }, session: sess, admin: false, room: { ...room }, replays: [], members: [], profiles: [] }], ['waiting', { state: { ...base }, session: sess, room, replays: [], members: [], profiles: [] }], ['student', { state: { ...base, is_live: true }, session: sess, room: { ...room, is_live: true }, replays: [], members: [], profiles: [] }]]) {
  const { p, errs } = await page(db, { width: 390 });
  await p.waitForTimeout(400);
  ok('phone ' + name + ': no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= 390 + 1));
  if (name === 'waiting') {
    await p.waitForSelector('.r2-join .r2-brand');
    await p.waitForTimeout(1500);   /* the smooth scroll, and #room's .rv reveal transition, settle */
    const m = await p.evaluate(() => { const b = document.querySelector('.r2-join .r2-brand').getBoundingClientRect(); const k = document.querySelector('.r2-kicker').getBoundingClientRect(); return { inRoom: document.body.classList.contains('in-room'), scrollY: window.scrollY, top: b.top, bottom: b.bottom, kickerTop: k.top }; });
    ok('phone waiting: the room chrome is gone (body.in-room)', m.inRoom);
    ok('phone waiting: the wordmark is on screen after the scroll settles', m.top >= 0 && m.bottom <= 844 && m.top <= 60, JSON.stringify(m));
    ok('phone waiting: the kicker sits under the wordmark', m.kickerTop > m.bottom, JSON.stringify(m));
  }
  if (name === 'student') {
    await p.waitForSelector('.r2-join');
    ok('phone student: entered the live room', await p.evaluate(() => window.__mount.mode === 'student'));
    await p.evaluate(() => window.__room.state('joined'));
    await p.waitForSelector('.r2-now .r2-nowtxt');
    await p.waitForFunction(() => { const i = document.querySelector('.r2-now .r2-brand-strip'); return !!i && i.complete; }, null, { timeout: 5000 }).catch(() => {});
    const m = await p.evaluate(() => {
      const i = document.querySelector('.r2-now .r2-brand-strip'), t = document.querySelector('.r2-nowtxt'), n = document.querySelector('.r2-now');
      const ir = i.getBoundingClientRect(), tr = t.getBoundingClientRect(), nr = n.getBoundingClientRect();
      /* the last word of the notice must land inside the strip: a Range over it, measured */
      const node = t.firstChild, txt = t.textContent, rg = document.createRange(); rg.setStart(node, txt.length - 'recorded'.length); rg.setEnd(node, txt.length);
      const lr = rg.getBoundingClientRect();
      return { src: i.getAttribute('src'), nat: i.naturalWidth, w: ir.width, h: ir.height, text: txt, clippedX: t.scrollWidth > t.clientWidth + 1, clippedY: t.scrollHeight > t.clientHeight + 1,
        lastWordIn: lr.width > 0 && lr.right <= tr.right + 1 && lr.bottom <= nr.bottom + 1, lines: Math.round(tr.height / (parseFloat(getComputedStyle(t).lineHeight) || 18)), stripH: nr.height };
    });
    ok('phone student: the strip mark is the monogram, 24px tall and ≥41px wide', m.src === '/ht/img/ht-monogram-gold.png' && m.nat > 0 && Math.abs(m.h - 24) < 1 && m.w >= 41, JSON.stringify(m));
    ok('phone student: the recording notice is the whole line', /This session is being recorded$/.test(m.text), m.text);
    ok('phone student: the recording notice is fully visible — wrapped, not cut', !m.clippedX && !m.clippedY && m.lastWordIn, JSON.stringify(m));
    ok('phone student: the strip grows to two lines, no more', m.lines >= 1 && m.lines <= 2 && m.stripH < 70, JSON.stringify(m));
  }
  ok('phone ' + name + ': no page errors', errs.length === 0, errs.join(' | '));
  await p.close(); }
/* R1–R3 the real js/rtk-room-v2.js: a drop that cannot be mended tells the dead client to leave; Leave during a
   rejoin in flight wins; Split students into rooms is two taps (room-v2-real.mjs) */
await realModuleScenarios(b, ok);
await b.close();
console.log(out.join('\n')); console.log(out.filter(l => l.startsWith('OK')).length + ' OK · ' + out.filter(l => l.startsWith('FAIL')).length + ' FAIL');
process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
