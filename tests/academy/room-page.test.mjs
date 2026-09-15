// tests/academy/room-page.test.mjs — run: node --test tests/opil/*.test.mjs tests/academy/*.test.mjs
// The pure decisions /room/ makes from the URL and from ea_room_state(). No DOM, no supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_RX, roomKey, roomBranch, loginHref, joinErrorText, statusLine, replayLabel, iframeUrl } from '../../js/room-page.js';
import { OPIL_WORDS, ROOM_WORDS } from '../../opil/hub/live-rooms.js';

const KEY = 'AbC123_-xyzXYZ0987ab-_';   // 22 chars, the shape ea_room_new_key() mints

test('KEY_RX: exactly 22 url-safe base64 characters', () => {
  assert.equal(KEY.length, 22);
  assert.equal(KEY_RX.test(KEY), true);
  assert.equal(KEY_RX.test(KEY.slice(0, 21)), false);
  assert.equal(KEY_RX.test(KEY + 'A'), false);
  assert.equal(KEY_RX.test('AbC123+-xyzXYZ0987ab-_'), false);   // + is not url-safe
  assert.equal(KEY_RX.test('AbC123/-xyzXYZ0987ab-_'), false);   // / is not url-safe
  assert.equal(KEY_RX.test('AbC123_-xyzXYZ0987ab-='), false);   // padding never appears
  assert.equal(KEY_RX.test(''), false);
});

test('roomKey reads a 22-char url-safe ?k=, nothing else', () => {
  assert.equal(roomKey('?k=' + KEY), KEY);
  assert.equal(roomKey('?x=1&k=' + KEY), KEY);
  assert.equal(roomKey('?k=' + KEY + '&tour=1'), KEY);
  for (const bad of ['', '?', '?k=', '?x=1', '?k=' + KEY.slice(0, 21), '?k=' + KEY + 'A', '?k=AbC123+-xyzXYZ0987ab-_', '?k=' + KEY.replace('_', ' ')]) {
    assert.equal(roomKey(bad), null, JSON.stringify(bad));
  }
  assert.equal(roomKey(undefined), null);
  assert.equal(roomKey(null), null);
});

test('roomKey survives a search it cannot parse', () => {
  const explodes = { [Symbol.iterator]() { throw new Error('boom'); } };
  assert.equal(roomKey(explodes), null);
});

/* every combination of the five flags ea_room_state() returns, in the order the page decides:
   bad_link → signed_in → is_host → can_join → is_live */
const F = (bad_link, signed_in, is_host, can_join, is_live) => ({ bad_link, signed_in, is_host, can_join, is_live });
test('roomBranch: all 32 combinations of bad_link / signed_in / is_host / can_join / is_live', () => {
  const table = [
    // bad_link wins over everything (the server sends {bad_link:true} alone, but the order must hold for any shape)
    [F(true, false, false, false, false), 'dead_link'], [F(true, false, false, false, true), 'dead_link'],
    [F(true, false, false, true, false), 'dead_link'], [F(true, false, false, true, true), 'dead_link'],
    [F(true, false, true, false, false), 'dead_link'], [F(true, false, true, false, true), 'dead_link'],
    [F(true, false, true, true, false), 'dead_link'], [F(true, false, true, true, true), 'dead_link'],
    [F(true, true, false, false, false), 'dead_link'], [F(true, true, false, false, true), 'dead_link'],
    [F(true, true, false, true, false), 'dead_link'], [F(true, true, false, true, true), 'dead_link'],
    [F(true, true, true, false, false), 'dead_link'], [F(true, true, true, false, true), 'dead_link'],
    [F(true, true, true, true, false), 'dead_link'], [F(true, true, true, true, true), 'dead_link'],
    // signed out → the sign-in card, whatever the rest says
    [F(false, false, false, false, false), 'landing'], [F(false, false, false, false, true), 'landing'],
    [F(false, false, false, true, false), 'landing'], [F(false, false, false, true, true), 'landing'],
    [F(false, false, true, false, false), 'landing'], [F(false, false, true, false, true), 'landing'],
    [F(false, false, true, true, false), 'landing'], [F(false, false, true, true, true), 'landing'],
    // Nelson: live or idle, can_join is irrelevant for him
    [F(false, true, true, false, false), 'host_idle'], [F(false, true, true, false, true), 'host_live'],
    [F(false, true, true, true, false), 'host_idle'], [F(false, true, true, true, true), 'host_live'],
    // a signed-in person who cannot join
    [F(false, true, false, false, false), 'not_allowed'], [F(false, true, false, false, true), 'not_allowed'],
    // a signed-in person who can join: in when live, waiting when not
    [F(false, true, false, true, false), 'waiting'], [F(false, true, false, true, true), 'student'],
  ];
  assert.equal(table.length, 32);
  for (const [state, want] of table) assert.equal(roomBranch(state), want, JSON.stringify(state));
});

test('roomBranch: the exact shapes ea_room_state() returns', () => {
  // a dead or rotated key for a non-member: the function returns only this
  assert.equal(roomBranch({ bad_link: true }), 'dead_link');
  // a member (or Nelson) holding a stale key: privileged, so bad_link is false and can_join is true → never dead_link
  const memberStaleKey = { id: 'r1', title: 'Taylormade Academy Live', is_live: false, host_name: 'Nelson Taylor', signed_in: true, is_host: false, can_join: true, bad_link: false, recording_url: null, people: null };
  assert.equal(roomBranch(memberStaleKey), 'waiting');
  assert.equal(roomBranch({ ...memberStaleKey, is_live: true }), 'student');
  // Nelson with a stale key
  assert.equal(roomBranch({ ...memberStaleKey, is_host: true, people: 0 }), 'host_idle');
  assert.equal(roomBranch({ ...memberStaleKey, is_host: true, is_live: true, people: 12 }), 'host_live');
  // signed out, no key
  assert.equal(roomBranch({ id: 'r1', title: 'Taylormade Academy Live', is_live: true, host_name: 'Nelson Taylor', signed_in: false, is_host: false, can_join: false, bad_link: false, recording_url: null, people: null }), 'landing');
  // signed in, no key, not a member
  assert.equal(roomBranch({ id: 'r1', title: 'Taylormade Academy Live', is_live: true, host_name: 'Nelson Taylor', signed_in: true, is_host: false, can_join: false, bad_link: false, recording_url: null, people: null }), 'not_allowed');
});

test('roomBranch: anything that is not an object is an error', () => {
  for (const bad of [null, undefined, '', 'x', 0, 42, true]) assert.equal(roomBranch(bad), 'error', String(bad));
});

test('loginHref keeps the key through sign-in', () => {
  assert.equal(loginHref(KEY), '/login/?next=%2Froom%2F%3Fk%3D' + KEY);
  assert.equal(loginHref(null), '/login/?next=%2Froom%2F');
  assert.equal(loginHref(undefined), '/login/?next=%2Froom%2F');
  assert.equal(loginHref(''), '/login/?next=%2Froom%2F');
  assert.equal(decodeURIComponent(loginHref(KEY).slice('/login/?next='.length)), '/room/?k=' + KEY);
});

test('joinErrorText: every code ea-rtk-join / ea-rtk-record send, in the room\'s words', () => {
  assert.equal(joinErrorText('sign_in', 401, ROOM_WORDS), 'Sign in again and retry.');
  assert.equal(joinErrorText('not_allowed', 403, ROOM_WORDS), 'You need Nelson’s link or an Academy membership.');
  assert.equal(joinErrorText('bad_link', 404, ROOM_WORDS), 'This link isn’t active anymore — ask Nelson for the new one.');
  assert.equal(joinErrorText('not_open', 409, ROOM_WORDS), 'Nelson hasn’t started yet.');
  assert.equal(joinErrorText('room_full', 429, ROOM_WORDS), 'The room is full right now.');
  assert.equal(joinErrorText('slow_down', 429, ROOM_WORDS), 'Too many tries — wait a minute and try again.');
  assert.equal(joinErrorText('no_room', 409, ROOM_WORDS), 'The room isn’t open yet.');
  assert.equal(joinErrorText('not_host', 403, ROOM_WORDS), 'Only Nelson can do that.');
  assert.equal(joinErrorText('rtk_not_configured', 503, ROOM_WORDS), 'The room is not set up yet.');
  assert.equal(joinErrorText('cloudflare_502', 502, ROOM_WORDS), 'The server said 502.');
  assert.equal(joinErrorText(undefined, 500, ROOM_WORDS), 'The server said 500.');
  assert.equal(joinErrorText('nothing_to_retry', 409, ROOM_WORDS), 'The server said 409.');
  // the two words-driven lines read the OPIL words when given OPIL_WORDS
  assert.equal(joinErrorText('not_allowed', 403, OPIL_WORDS), 'Your account is not in this cohort.');
  assert.equal(joinErrorText('not_open', 409, OPIL_WORDS), 'The room opens when your facilitator starts the class.');
});

test('statusLine: Off air, or Live now with the head count', () => {
  assert.equal(statusLine({ is_live: false, people: 5 }), 'Off air');
  assert.equal(statusLine({ is_live: false, people: null }), 'Off air');
  assert.equal(statusLine({ is_live: true, people: 0 }), 'Live now · 0 people');
  assert.equal(statusLine({ is_live: true, people: 1 }), 'Live now · 1 person');
  assert.equal(statusLine({ is_live: true, people: 12 }), 'Live now · 12 people');
  assert.equal(statusLine({ is_live: true, people: null }), 'Live now · 0 people');
  assert.equal(statusLine({ is_live: true }), 'Live now · 0 people');
});

test('replayLabel: one label per replay status', () => {
  for (const status of ['invoked', 'recording', 'uploading', 'uploaded']) {
    assert.equal(replayLabel({ status, published: false }), 'Replay preparing', status);
  }
  assert.equal(replayLabel({ status: 'ready', published: false }), 'Replay ready — review, then publish');
  assert.equal(replayLabel({ status: 'ready', published: null }), 'Replay ready — review, then publish');
  assert.equal(replayLabel({ status: 'ready', published: true }), 'Published ✓');
  assert.equal(replayLabel({ status: 'error', published: false }), 'Replay failed');
  assert.equal(replayLabel({ status: 'error', published: true }), 'Replay failed');
});

test('iframeUrl turns the Stream /watch page into the embeddable /iframe URL', () => {
  assert.equal(iframeUrl('https://customer-abc123.cloudflarestream.com/0123456789abcdef/watch'), 'https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe');
  assert.equal(iframeUrl('https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe'), 'https://customer-abc123.cloudflarestream.com/0123456789abcdef/iframe');
  assert.equal(iframeUrl('https://example.com/watch/'), 'https://example.com/watch/');
  assert.equal(iframeUrl(null), null);
  assert.equal(iframeUrl(undefined), null);
  assert.equal(iframeUrl(''), null);
});
