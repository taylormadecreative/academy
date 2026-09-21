// room-v2-real.mjs — the REAL js/rtk-room-v2.js against a fake kit client, driven from ht-room.mjs.
// The page harness stubs the module (stub-room-v2.js) to test the pages; this file tests the module's own
// exits, which no page can see: after a drop that cannot be mended the dead client is told to leave (it
// never walks the person back in behind the card), and Leave pressed while a rejoin is in flight wins
// (the client that lands afterwards leaves at once, and the page never hears 'joined' after 'left').
// Nothing here reaches a real backend: the kit's three CDN files, the effects addon and ea-rtk-join are
// all answered in-browser (the join function on the page's own origin, so no preflight); `sb` is a stub
// object; the page is a one-line HTML shell on the local server.
const TEST_BASE_URL = (process.env.HT_TEST_BASE_URL || 'http://127.0.0.1:8790').replace(/\/+$/, '');
const CORE = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';
const UI_LOADER = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
const UI_MAIN = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';
const VB_ADDON = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui-addons@0.1.0/dist/video-background.js';

/* the fake kit: RealtimeKitClient.init() hands out a meeting whose join() behaves as window.__kit.nextJoin says
   ('ok' | 'reject' | 'hang' — released by m.releaseJoin()); every meeting records its calls and can emit the
   kit's own events (self roomLeft / roomJoined, meta socketConnectionUpdate) for the harness. */
const KIT = `
window.__kit = { meetings: [], nextJoin: 'ok' };
function mk(opts) {
  const h = { self: {}, meta: {}, joined: {}, cm: {}, polls: {}, ai: {} };
  const on = (b) => (ev, fn) => { (h[b][ev] = h[b][ev] || []).push(fn); };
  const emit = (b, ev, payload) => (h[b][ev] || []).slice().forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
  const m = {
    n: window.__kit.meetings.length, authToken: opts.authToken, calls: [], joinBehaviour: window.__kit.nextJoin, releaseJoin: null,
    self: { on: on('self'), name: 'Me', audioEnabled: !!opts.defaults.audio, videoEnabled: !!opts.defaults.video, videoTrack: null, screenShareEnabled: false,
      roomState: 'init', roomJoined: false, permissions: { transcriptionEnabled: true }, customParticipantId: 'u1', isPinned: false,
      enableAudio: async () => {}, disableAudio: async () => {}, enableVideo: async () => {}, disableVideo: async () => {}, unpin: () => {} },
    participants: { joined: { toArray: () => [], on: on('joined') }, kickAll: async () => { m.calls.push('kickAll'); } },
    meta: { on: on('meta'), meetingId: 'meet-1', meetingTitle: 'T', socketState: { state: 'connected' } },
    connectedMeetings: { on: on('cm'), getConnectedMeetings: async () => ({ parentMeeting: null, meetings: [] }) },
    polls: { on: on('polls'), items: [] },
    ai: { transcripts: [], on: on('ai') },
    join: async () => {
      m.calls.push('join');
      if (m.joinBehaviour === 'reject') throw new Error('join refused');
      if (m.joinBehaviour === 'hang') await new Promise((r) => { m.releaseJoin = r; });
      m.self.roomState = 'joined'; m.self.roomJoined = true;
    },
    leave: async () => { m.calls.push('leave'); m.self.roomState = 'left'; m.self.roomJoined = false; emit('self', 'roomLeft', { state: 'left' }); },
    emit,
  };
  window.__kit.meetings.push(m);
  return m;
}
window.RealtimeKitClient = { init: async (opts) => mk(opts) };
`;
const SB = `
export const sb = {
  auth: { getSession: async () => ({ data: { session: { access_token: 't2', user: { id: 'u1' } } } }) },
  from: () => { const c = { select: () => c, eq: () => c, is: () => c, order: () => c, limit: () => c, insert: () => c, delete: () => c, update: () => c, then: (res) => res({ data: [], error: null }) }; return c; },
  channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: () => {},
};
`;
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/rtk-room-v2.css"></head><body>
<div id="rtkMount"></div>
<script type="module">
import { sb } from '/__harness/sb.js';
const { mountRoomV2 } = await import('/js/rtk-room-v2.js?v=harness');
window.__states = [];
window.__mountReal = (mode) => mountRoomV2({
  mountEl: document.getElementById('rtkMount'), cfg: { FUNCTIONS_BASE: '${TEST_BASE_URL}/__fn' }, token: 't', sb, user: { id: 'u1' }, mode,
  target: { kind: 'room', slug: 'ht', id: 'r-ht', title: 'HT Live', key: 'k' }, facilitator: 'Dr. Gray',
  onState: (st, m, reason) => { window.__states.push(st + (reason ? ':' + reason : '')); },
}).then((r) => { window.__real = r; return r; });
</script></body></html>`;

export async function realModuleScenarios(b, ok) {
  const open = async () => {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    const joins = [];
    const cors = { 'Access-Control-Allow-Origin': '*' };
    await p.route(TEST_BASE_URL + '/__harness/room.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
    await p.route(TEST_BASE_URL + '/__harness/sb.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB }));
    await p.route(CORE, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: cors, body: KIT }));
    await p.route(UI_LOADER, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: cors, body: 'export function defineCustomElements() {}' }));
    await p.route(UI_MAIN, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: cors, body: 'export function provideRtkDesignSystem() {}' }));
    await p.route(VB_ADDON, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: cors, body: 'export default { init: async () => { throw new Error("no effects in the harness"); } };' }));
    await p.route(TEST_BASE_URL + '/__fn/ea-rtk-join', (r) => { joins.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'tok-' + joins.length, meeting_id: 'meet-1', preset: 'ht-class-host', host: true, name: 'Me' }) }); });
    await p.goto(TEST_BASE_URL + '/__harness/room.html');
    await p.waitForFunction(() => typeof window.__mountReal === 'function');
    return { p, errs, joins };
  };
  /* mount as host, press Enter, land in the class */
  const enter = async (p) => {
    await p.evaluate(() => { window.__mountReal('host'); });
    await p.waitForSelector('.r2-enter');
    await p.click('.r2-enter');
    await p.waitForSelector('.r2-bar');
    await p.waitForFunction(() => window.__states.includes('joined'));
  };
  const calls = (p, n) => p.evaluate((i) => window.__kit.meetings[i] ? window.__kit.meetings[i].calls.slice() : null, n);
  const states = (p) => p.evaluate(() => window.__states.slice());

  /* R1 a drop that cannot be mended: two rejoin attempts fail → the page hears 'left:dropped' ONCE, and the
     ORIGINAL client is told to leave (its own roomLeft 'left' is swallowed; nothing is heard after) */
  { const { p, errs, joins } = await open();
    await enter(p);
    ok('real module: in the class, one join, host bar', joins.length === 1 && (await p.$$('.r2-bar .r2-leave')).length === 1);
    await p.evaluate(() => { window.__kit.nextJoin = 'reject'; const m = window.__kit.meetings[0]; m.self.roomState = 'disconnected'; m.emit('self', 'roomLeft', { state: 'disconnected' }); });
    await p.waitForFunction(() => { const s = document.querySelector('.r2-reconnect'); return !!s && !s.hidden; });
    ok('real drop: the Reconnecting strip, the page told reconnecting, nothing left yet', /Reconnecting/.test(await p.textContent('.r2-reconnect')) && JSON.stringify(await states(p)) === JSON.stringify(['joined', 'reconnecting:dropped']));
    await p.waitForFunction(() => window.__states.some((s) => s.startsWith('left')), null, { timeout: 15000 }).catch(() => {});
    await p.waitForFunction(() => window.__kit.meetings[0].calls.includes('leave'), null, { timeout: 3000 }).catch(() => {});   /* a regression reads as FAIL below, not a crash */
    await p.waitForTimeout(150);
    const st = await states(p);
    ok('real drop unmended: the page hears left:dropped exactly once, never joined again', JSON.stringify(st) === JSON.stringify(['joined', 'reconnecting:dropped', 'left:dropped']), JSON.stringify(st));
    ok('real drop unmended: two rejoin attempts were made (the second with a fresh token from the server)', (await p.evaluate(() => window.__kit.meetings.length)) === 3 && joins.length === 2, 'meetings ' + (await p.evaluate(() => window.__kit.meetings.length)) + ' joins ' + joins.length);
    ok('real drop unmended: the ORIGINAL client was told to leave — camera, mic and its own reconnecting released', JSON.stringify(await calls(p, 0)) === JSON.stringify(['join', 'leave']), JSON.stringify(await calls(p, 0)));
    ok('real drop unmended: the two clients whose join was refused are not left twice', JSON.stringify(await calls(p, 1)) === JSON.stringify(['join']) && JSON.stringify(await calls(p, 2)) === JSON.stringify(['join']));
    ok('real drop unmended: the room is unmounted', await p.evaluate(() => document.getElementById('rtkMount').innerHTML === '' && !document.body.classList.contains('in-room')));
    ok('real drop: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }

  /* R2 Leave pressed while a rejoin attempt is in flight: the page hears 'left:left' once; when the attempt then
     lands, that client leaves at once and the page is never told 'joined' after 'left' */
  { const { p, errs } = await open();
    await enter(p);
    await p.evaluate(() => { window.__kit.nextJoin = 'hang'; const m = window.__kit.meetings[0]; m.self.roomState = 'disconnected'; m.emit('self', 'roomLeft', { state: 'disconnected' }); });
    await p.waitForFunction(() => window.__kit.meetings.length === 2 && window.__kit.meetings[1].calls.includes('join'), null, { timeout: 10000 });
    ok('real leave-during-rejoin: the first attempt is in flight (its join is hanging)', await p.evaluate(() => typeof window.__kit.meetings[1].releaseJoin === 'function'));
    await p.click('.r2-bar .r2-leave');
    ok('real leave-during-rejoin: Leave is two taps for a host, worded as leave-only', /Leave the room\? The session keeps running/.test(await p.textContent('.r2-bar .r2-leave')));
    await p.waitForTimeout(600);   /* a second tap counts only after 500 ms — a double-click is not a decision */
    await p.click('.r2-bar .r2-leave');
    await p.waitForFunction(() => window.__states.includes('left:left'));
    ok('real leave-during-rejoin: the page hears left:left', JSON.stringify(await states(p)) === JSON.stringify(['joined', 'reconnecting:dropped', 'left:left']), JSON.stringify(await states(p)));
    await p.evaluate(() => window.__kit.meetings[1].releaseJoin());
    await p.waitForFunction(() => window.__kit.meetings[1].calls.includes('leave'), null, { timeout: 5000 }).catch(() => {});   /* a regression reads as FAIL below, not a crash */
    await p.waitForTimeout(150);
    ok('real leave-during-rejoin: the client that landed afterwards left at once — no ghost host', JSON.stringify(await calls(p, 1)) === JSON.stringify(['join', 'leave']), JSON.stringify(await calls(p, 1)));
    ok('real leave-during-rejoin: the page was never told joined after left', JSON.stringify(await states(p)) === JSON.stringify(['joined', 'reconnecting:dropped', 'left:left']), JSON.stringify(await states(p)));
    ok('real leave-during-rejoin: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }

  /* R3 Split students into rooms is two taps now (like Bring everyone back): one tap arms, nothing moves */
  { const { p, errs } = await open();
    await enter(p);
    await p.click('.r2-bar .r2-tools');
    await p.click('.r2-sheet [data-tool="breakout"]');
    await p.waitForSelector('.r2-groups [data-g="split"]');
    await p.evaluate(() => { window.__kit.meetings[0].connectedMeetings.createMeetings = async () => { window.__split = (window.__split || 0) + 1; return []; }; });
    await p.click('.r2-groups [data-g="split"]');
    await p.waitForTimeout(600);
    ok('real split: the first tap arms it, nothing is created', /Split people into rooms\?/.test(await p.textContent('.r2-groups [data-g="split"]')) && (await p.evaluate(() => window.__split || 0)) === 0);
    await p.click('.r2-groups [data-g="split"]');
    await p.waitForFunction(() => (window.__split || 0) >= 1, null, { timeout: 5000 }).catch(() => {});
    await p.waitForFunction(() => /Split people into rooms$/.test(document.querySelector('.r2-groups [data-g="split"]').textContent.trim()), null, { timeout: 5000 }).catch(() => {});
    ok('real split: the second tap splits once, and the button reads its label again', (await p.evaluate(() => window.__split)) === 1 && /Split people into rooms$/.test((await p.textContent('.r2-groups [data-g="split"]')).trim()));
    ok('real split: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }

  /* R4 a room has Files (0054): the tab, the pane and the bar button for a room-kind target — the gates that used to
     say "the Academy/HT rooms have no materials table" are open, and the Files plugin is created with the room's key */
  { const { p, errs } = await open();
    await enter(p);
    const files = await p.evaluate(() => ({ tab: !!document.querySelector('.r2-tab[data-tab="files"]'), pane: !!document.querySelector('.r2-pane[data-pane="files"] .r2-files'), btn: !!document.querySelector('.r2-files-btn') }));
    ok('real room: Files — the tab, the pane, the bar button', files.tab && files.pane && files.btn, JSON.stringify(files));
    await p.click('.r2-files-btn');
    await p.waitForSelector('.r2-files-head', { timeout: 5000 }).catch(() => {});
    ok('real room: a host sees Add a file with the room wording', /everyone in the room/.test(await p.evaluate(() => (document.querySelector('.r2-file-add') || {}).textContent || '')), await p.evaluate(() => (document.querySelector('.r2-files') || {}).innerHTML || '').then((h) => h.slice(0, 200)));
    ok('real room Files: no page errors', errs.length === 0, errs.join(' | ')); await p.close(); }
}
