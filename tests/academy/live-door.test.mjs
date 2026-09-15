// tests/academy/live-door.test.mjs — run: node --test tests/academy/*.test.mjs
// The static half of Task 9: /live/ is the door, the broadcast is gone, the plumbing points at
// js/room-page.js. The page's behaviour is exercised by the scratchpad Playwright harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const live = readFileSync(new URL('../../live/index.html', import.meta.url), 'utf8');
const room = readFileSync(new URL('../../room/index.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../../build_site.py', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../supabase/functions/README.md', import.meta.url), 'utf8');

test('live/: the broadcast, the demo clip, hls and the ea_live chat are gone', () => {
  for (const dead of ['broadcast.js', 'broadcast.css', 'ea-live-publish', 'DEMO_URL', 'hls.js', 'mountStream', 'ea_live', 'wireChat', 'End broadcast'])
    assert.equal(live.includes(dead), false, dead + ' still in live/index.html');
});

test('live/: reads the room state and imports the pure helpers and the room words on a ?v= stamp', () => {
  assert.match(live, /sb\.rpc\("ea_room_state"\)/);
  assert.match(live, /import \{ statusLine, replayLabel, iframeUrl, joinErrorText \} from "\/js\/room-page\.js\?v=[a-z0-9]+"/);
  assert.match(live, /import \{ ROOM_WORDS \} from "\/opil\/hub\/live-rooms\.js\?v=[a-z0-9]+"/);
  assert.match(live, /sb\.rpc\("ea_is_member"\), sb\.rpc\("ea_is_admin"\)/);
  // one source of truth for the server's wording: no inline error map on the card
  assert.ok(live.includes('joinErrorText(d.error, r.status, ROOM_WORDS)'));
  assert.equal(live.includes('"that replay row is gone"'), false);
});

test('live/: a failed state RPC degrades to the off-air door, never the error card; the admin card says what to run', () => {
  assert.match(live, /stateError = true; state = Object\.assign\(\{ signed_in: !!me \}, OFF_AIR\)/);
  assert.ok(live.includes('const OFF_AIR = { title: "Taylormade Academy Live", is_live: false, recording_url: null, people: null, is_host: false, can_join: false, bad_link: false };'));
  assert.ok(live.includes('run bash scripts/apply-0036.sh, then reload.'));
  assert.ok(live.includes('if (stateError) $("admin").innerHTML'));
});

test('live/: every signed-in visitor polls ea_room_state (the light poll); the heavy refresh stays behind busy()', () => {
  assert.ok(live.includes('if (me && !bootError) setInterval(async () => {'));
  assert.ok(live.includes('const POLL_MS = window.__ROOM_POLL_MS || 20000;'));
  assert.ok(live.includes('setInterval(() => { if (busy()) refresh(); }, POLL_MS);'));
  assert.ok(live.includes('if (refreshing) return;'));
  assert.equal(live.includes('}, 20000);'), false);
});

test('live/: every id the spine names is rendered', () => {
  for (const id of ['hTitle', 'hChip', 'admin', 'stage', 'joinRoom', 'replayFrame', 'replayOpen', 'yrLink', 'yrCopy', 'yrNew', 'yrTitle', 'yrMax', 'yrOpen', 'yrStatus', 'yrEnd', 'yrReplays', 'yrPeople', 'yrNote'])
    assert.ok(live.includes('id="' + id + '"'), 'id="' + id + '" missing');
});

test('live/: the replay iframe allow list, the explicit replay columns, the door copy', () => {
  assert.ok(live.includes('allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"'));
  assert.ok(live.includes('"id, room_id, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at"'));
  assert.equal(live.includes('download_url'), false);
  assert.ok(live.includes('Nelson is live: '));
  assert.ok(live.includes('Nothing is live right now'));
  assert.ok(live.includes('<h3>The replay stays here</h3><p>Every published session, on this page, for members.</p>'));
  assert.ok(live.includes('The room chat sits next to the video.'));   // 02 keeps the room chat
  assert.ok(live.includes('<span>Every replay, kept on this page</span>'));   // the gate card says where replays live (spec §2.3)
  assert.equal(live.includes('kept in your library'), false);
});

test('live/ and room/: page writes never touch link_key, meeting_id or live_since (the server stamps live_since with its own clock)', () => {
  assert.match(live, /sb\.rpc\("ea_room_rotate_link"\)/);
  assert.match(live, /sb\.rpc\("ea_room_publish_replay", \{ p_replay: id, p_publish: on \}\)/);
  assert.ok(live.includes('action:"retry_replay", replay_id: id'));
  for (const [name, html] of [['live', live], ['room', room]]) {
    assert.equal(/update\(\{[^}]*(link_key|meeting_id|live_since)/.test(html), false, name + '/index.html writes a server-only column');
    assert.ok(html.includes('.update({'), name + '/index.html has no update at all — the invariant would be vacuous');
  }
});

test('build_site.py: hash list + _ASSET_RX carry js/room-page.js and no broadcast entries; HUB_PAGES has room', () => {
  assert.equal(build.includes('broadcast'), false);
  assert.ok(build.includes('"js/room-page.js",'));
  assert.ok(build.includes('js/room-page\\.js'));
  assert.match(build, /HUB_PAGES = \([^)]*"room"[^)]*\)/);
});

test('sw.js VERSION is at or past the room bump (v21); later fixes keep counting up', () => {
  const m = sw.match(/const VERSION = 'tma-v(\d+)-[a-z0-9-]+';/);
  assert.ok(m, 'VERSION line missing');
  assert.ok(Number(m[1]) >= 21, 'VERSION went backwards: ' + m[0]);
});

test('the retired files are gone and the README says so', () => {
  for (const f of ['../../js/broadcast.js', '../../css/broadcast.css', '../../supabase/functions/ea-live-publish/index.ts'])
    assert.equal(existsSync(new URL(f, import.meta.url)), false, f + ' still exists');
  assert.ok(readme.includes('## RealtimeKit rooms'));
  assert.ok(readme.includes('supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr'));
  assert.ok(readme.includes('Retired 2026-09-14: `ea-live-publish`'));
});
