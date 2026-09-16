// opil-live.mjs — the OPIL live page (/opil/hub/live/) against the stubbed module and a stubbed Supabase, driven
// from ht-room.mjs (O1–O2). Nothing here reaches a real backend. It pins the 9/15 findings on that page:
//   O1 the host's control — Start flips the row live and the button reads Entering… DISABLED until the host is in
//      (never a second mount from the camera-check screen); Leave keeps the class running; Rejoin asks the recording
//      to start again; the card's End pressed OUT of the room sends 'end' (everyone out, server-side) before the row
//      is closed.
//   O2 a student in the room whose class is ended from outside the room: the 20 s row poll (shortened here) leaves
//      the room and shows "Class ended." — nobody is left in a headless meeting.
import fs from 'node:fs';
const H = new URL('./', import.meta.url);
const SB = fs.readFileSync(new URL('stub-supabase-opil.js', H), 'utf8'), R2 = fs.readFileSync(new URL('stub-room-v2.js', H), 'utf8');
const sess = { user: { id: 'u1', email: 'x@y.z' }, access_token: 't' };
const S7 = { no: 7, kind: 'curriculum', title: 'Agents 101', session_date: null, is_live: false, stream_url: null, outcome: null };
const seen = { 'opil-tour:live:coordinator': 'done', 'opil-tour:live:facilitator': 'done', 'opil-tour:live:student': 'done' };

export async function opilScenarios(b, ok) {
  async function page(db, { pollMs = 0 } = {}) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    const rec = [];
    await p.addInitScript((d) => { window.__db = JSON.parse(JSON.stringify(d)); window.__calls = []; }, db);
    await p.addInitScript((k) => { try { Object.entries(k).forEach(([n, v]) => localStorage.setItem(n, v)); } catch (e) {} }, seen);
    if (pollMs) await p.addInitScript((ms) => { window.__opilRoomPollMs = ms; }, pollMs);
    await p.route('https://esm.sh/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB }));
    await p.route('**/js/rtk-room-v2.js*', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: R2 }));
    await p.route('**/ea-rtk-record', async (r) => { rec.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, stopped: true, recording_id: 'rec-1', status: 'invoked' }) }); });
    await p.route(/^https:\/\/fonts\./, (r) => r.abort());
    await p.goto('http://127.0.0.1:8790/opil/hub/live/?s=7');
    return { p, errs, rec };
  }
  const text = (p, s) => p.locator(s).first().textContent().then((t) => (t || '').trim());
  const updates = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('__updates') || '[]'); } catch (e) { return []; } });
  const liveFlips = (u) => u.filter(([t, f, patch]) => t === 'ea_opil_sessions' && 'is_live' in patch).map(([t, f, patch]) => patch.is_live);

  /* O1 the host's control */
  { const { p, errs, rec } = await page({ session: sess, role: { admin: true, judge: false, facilitator_sessions: [] }, ea_opil_sessions: [S7], ea_opil_live_chat: [], ea_opil_replays: [] });
    await p.waitForSelector('#bcClass');
    ok('opil host: off air — Start class', (await text(p, '#bcClass')) === 'Start class — everyone on camera' && await p.isHidden('#bcGo'));
    await p.click('#bcClass');
    await p.waitForFunction(() => window.__db.ea_opil_sessions[0].is_live === true);
    ok('opil start: the row flipped live with the meeting', await p.evaluate(() => window.__db.ea_opil_sessions[0].stream_url === 'rtk:m-new'));
    await p.waitForFunction(() => document.getElementById('bcClass').textContent.trim() === 'Entering…', null, { timeout: 4000 }).catch(() => {});   /* a regression reads as FAIL, not a crash */
    ok('opil start: on the camera-check screen the button reads Entering… and is DISABLED — no second mount possible', (await text(p, '#bcClass')) === 'Entering…' && await p.isDisabled('#bcClass'));
    ok('opil start: End is offered, recording not started before joined', !(await p.isHidden('#bcGo')) && rec.length === 0);
    const mounts1 = await p.evaluate(() => window.__mount && window.__mount.mode);
    await p.click('#bcClass', { force: true }).catch(() => {});   /* a click on the disabled button must do nothing */
    await p.waitForTimeout(200);
    ok('opil start: a forced click while entering mounts nothing new', mounts1 === 'host' && await p.evaluate(() => window.__mount.mode === 'host') && rec.length === 0);
    await p.evaluate(() => window.__room.state('joined'));
    await p.waitForFunction(() => window.__rec === true);
    ok('opil joined: recording started for session 7', rec.length === 1 && rec[0].session_no === 7 && rec[0].action === 'start');
    await p.waitForFunction(() => document.getElementById('bcClass').textContent.trim() === 'Class is running');
    ok('opil joined: the button reads Class is running, disabled; the chip is lit', await p.isDisabled('#bcClass') && !(await p.isHidden('#bcRec')));
    /* Leave: the class keeps running */
    await p.evaluate(() => window.__room.leave());
    await p.waitForFunction(() => !document.getElementById('bcStill').hidden);
    ok('opil leave: is_live stays true, no stop, no off-air write', await p.evaluate(() => window.__db.ea_opil_sessions[0].is_live === true) && rec.length === 1 && JSON.stringify(liveFlips(await updates(p))) === JSON.stringify([true]));
    ok('opil leave: the still-running card; the button reads Rejoin', /You left — the class is still running/.test(await text(p, '#bcStill')) && /^Rejoin the running class/.test(await text(p, '#bcClass')) && !(await p.isDisabled('#bcClass')));
    ok('opil leave: no ended card in the player', !/Class ended/.test(await text(p, '#idle')));
    /* Rejoin: the same session, Entering… until in, and the recording is asked to start AGAIN */
    await p.evaluate(() => { window.__mount = null; });
    await p.click('#bcClass');
    await p.waitForFunction(() => document.getElementById('bcClass').textContent.trim() === 'Entering…', null, { timeout: 4000 }).catch(() => {});
    ok('opil rejoin: Entering…, disabled', await p.isDisabled('#bcClass'));
    await p.waitForFunction(() => window.__mount && window.__mount.mode === 'host', null, { timeout: 8000 }).catch(() => {});   /* the new mount (the row is re-read first) */
    ok('opil rejoin: a host mount, still Entering… until in', await p.isDisabled('#bcClass') && (await text(p, '#bcClass')) === 'Entering…');
    await p.evaluate(() => window.__room.state('joined'));
    await p.waitForFunction(() => document.getElementById('bcClass').textContent.trim() === 'Class is running', null, { timeout: 8000 }).catch(() => {});
    ok('opil rejoin: record start asked again (idempotent server-side) — never a class the host walks back into unrecorded', rec.length === 2 && rec[1].action === 'start' && rec[1].session_no === 7);
    ok('opil rejoin: the still-running card is down', await p.evaluate(() => document.getElementById('bcStill').hidden));
    /* Leave again, then the card's End OUT of the room: everyone out server-side ('end'), then off air */
    await p.evaluate(() => window.__room.leave());
    await p.waitForFunction(() => !document.getElementById('bcStill').hidden);
    await p.click('#bcGo');
    ok('opil end: the first tap arms it', (await text(p, '#bcGo')) === 'End the class for everyone? Tap again to end it.' && rec.length === 2);
    await p.click('#bcGo');
    await p.waitForFunction(() => (JSON.parse(localStorage.getItem('__updates') || '[]')).some(([t, f, patch]) => t === 'ea_opil_sessions' && patch.is_live === false), null, { timeout: 8000 }).catch(() => {});
    ok('opil end out of the room: the server is told to END (everyone out + recording stopped), never a bare stop', rec.length === 3 && rec[2].action === 'end' && rec[2].session_no === 7);
    await p.waitForSelector('#bcClass');   /* the page reloads itself */
    await p.waitForFunction(() => document.getElementById('bcClass').textContent.trim() === 'Start class — everyone on camera', null, { timeout: 8000 }).catch(() => {});
    ok('opil end: the row is off air and Start is back', JSON.stringify(liveFlips(await updates(p))) === JSON.stringify([true, false]));
    ok('opil host: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }

  /* O2 a student in the room; the class is ended from outside the room */
  { const live = { ...S7, is_live: true, stream_url: 'rtk:m-1' };
    const { p, errs, rec } = await page({ session: sess, role: { admin: false, judge: false, facilitator_sessions: [] }, ea_opil_sessions: [live], ea_opil_live_chat: [], ea_opil_replays: [] }, { pollMs: 500 });
    await p.waitForSelector('.r2-join');
    ok('opil student: straight in on a live link', await p.evaluate(() => window.__mount.mode === 'student'));
    await p.evaluate(() => window.__room.state('joined'));
    await p.waitForSelector('.r2-bar');
    await p.waitForTimeout(1200);
    ok('opil student: the row poll while in the room leaves a live class alone', await p.evaluate(() => !!document.querySelector('#rtkMount .r2') && document.body.classList.contains('in-room')));
    await p.evaluate(() => { window.__db.ea_opil_sessions[0].is_live = false; });   /* the host's End, pressed out of the room */
    await p.waitForFunction(() => /Class ended\./.test(document.getElementById('idle').textContent), null, { timeout: 5000 }).catch(() => {});
    ok('opil student, class ended from outside the room: the room is left and the ended card shows — nobody stays in a headless meeting', /Class ended\./.test(await text(p, '#idle')) && await p.evaluate(() => document.getElementById('rtkMount').innerHTML === '' && !document.body.classList.contains('in-room')));
    ok('opil student: never the "You left" card, nothing recorded', !/You left the class/.test(await text(p, '#idle')) && rec.length === 0);
    ok('opil student: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
}
