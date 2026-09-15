// tests/academy/room-door.test.mjs — run: node --test tests/academy/*.test.mjs
// The static half of Task 8: /room/ is the room page for everyone. The spine ids exist, the page
// imports the pure helpers and the room words on a ?v= stamp, it never writes a server-only column,
// and nothing from the OPIL hub (hub.js / hub.css / the v1 room css) leaks in. The page's behaviour
// is exercised by the scratchpad Playwright harness (harness/room-page.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const room = readFileSync(new URL('../../room/index.html', import.meta.url), 'utf8');
const live = readFileSync(new URL('../../live/index.html', import.meta.url), 'utf8');

test('room/: every id the spine names is rendered (static or from the control template)', () => {
  for (const id of ['card', 'roomCtl', 'rtkMount'])
    assert.ok(room.includes('id="' + id + '"'), 'id="' + id + '" missing');
  for (const id of ['rTitle', 'rLink', 'rCopy', 'rStart', 'rEnd', 'rNote', 'rRec'])
    assert.ok(room.includes('id="' + id + '"'), 'control id="' + id + '" missing');
});

test('room/: imports room-page.js, the room words and rtk-room-v2.js on a ?v= stamp; the kit is loaded in room mode', () => {
  assert.match(room, /import \{ roomKey, roomBranch, loginHref, joinErrorText \} from '\/js\/room-page\.js\?v=[a-z0-9]+'/);
  assert.match(room, /import \{ ROOM_WORDS \} from '\/opil\/hub\/live-rooms\.js\?v=[a-z0-9]+'/);
  assert.match(room, /import\('\/js\/rtk-room-v2\.js\?v=[a-z0-9]+'\)/);
  assert.match(room, /<link rel="stylesheet" href="\/css\/rtk-room-v2\.css\?v=[a-z0-9]+">/);
  assert.match(room, /<link rel="stylesheet" href="\/css\/build-mode\.css\?v=[a-z0-9]+">/);
  assert.ok(room.includes("target: { kind: 'room', id: state.id, title: state.title, key: k }"));
  assert.ok(room.includes("sb.rpc('ea_room_state', { p_key: k })"));
});

test('room/: nothing from the OPIL hub — no hub.js, hub.css or the v1 room css', () => {
  for (const dead of ['hub.js', 'hub.css', 'css/rtk-room.css', 'js/rtk-room.js?', 'ea_opil', 'session_no'])
    assert.equal(room.includes(dead), false, dead + ' in room/index.html');
});

test('room/: the page never writes link_key, meeting_id or live_since; Start writes nothing, only the way out is written', () => {
  assert.equal(/update\(\{[^}]*(link_key|meeting_id|live_since)/.test(room), false);
  assert.ok(room.includes(".update({ is_live: false, ended_at: new Date().toISOString() }).eq('id', state.id)"));
  assert.equal((room.match(/\.update\(/g) || []).length, 1, 'exactly one ea_rooms write on /room/: the way out');
  assert.ok(room.includes('So Start class writes nothing'));
});

test('room/: the link is built on the real origin, the same constant /live/ uses', () => {
  assert.ok(room.includes("const ROOM_ORIGIN = 'https://taylormadeacademy.com';"));
  assert.ok(room.includes("linkEl.value = ROOM_ORIGIN + '/room/?k=' + row.link_key"));
  assert.ok(live.includes('const ROOM_ORIGIN = "https://taylormadeacademy.com";'));
  assert.equal(room.includes('location.origin'), false);
});

test('room/: a waiting guest whose link died gets the dead-link card, an in-room guest is never pulled out by a new link', () => {
  assert.ok(room.includes('function deadLinkCard()'));
  assert.ok(room.includes('if (st.bad_link) { if (room) { try { room.leave(); } catch (e) {} } room = null; deadLinkCard(); return; }'));
  assert.ok(room.includes('if (!st || st.is_live !== false) return;'));   // guestPoll: {bad_link:true} has no is_live
  // the guest bindings are declared before the dispatch that starts the flows (no TDZ)
  const decl = room.indexOf('let room = null, closing = false, inRoom = false;');
  const dispatch = room.indexOf("if (branch === 'error')");
  assert.ok(decl > 0 && dispatch > 0 && decl < dispatch, 'room/closing/inRoom must be declared above the dispatch');
});

test('room/: the room module gets one retry before the fail card, with a plain-English connection message', () => {
  assert.ok(room.includes('async function loadRoom()'));
  const hits = room.match(/import\('\/js\/rtk-room-v2\.js\?v=[a-z0-9]+'\)/g) || [];
  assert.equal(hits.length, 2, 'expected the try and the retry, found ' + hits.length);
  assert.ok(room.includes('const { mountRoomV2 } = await loadRoom();'), 'enter() must call loadRoom()');
  assert.ok(room.includes('The room didn’t load. Check your connection, then try again.'));
});

test('room/: the cards say what the spec says', () => {
  assert.ok(room.includes('The room could not load.'));
  assert.ok(room.includes('Sign in and you walk straight in.'));
  assert.ok(room.includes('You need Nelson’s link or an Academy membership to join.'));
  assert.ok(room.includes('This session has ended.'));
  assert.ok(room.includes('Members can rewatch it on the Live page.'));
  assert.ok(room.includes('You left the room.'));
  assert.ok(room.includes('body.in-room .room-ctl, body.in-room .site-header, body.in-room #card { display:none }'));
});
