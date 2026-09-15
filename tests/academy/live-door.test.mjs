// tests/academy/live-door.test.mjs — run: node --test tests/academy/*.test.mjs
// The static half of Task 9: /live/ is the door, the broadcast is gone, the plumbing points at
// js/room-page.js. The page's behaviour is exercised by the scratchpad Playwright harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const live = readFileSync(new URL('../../live/index.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../../build_site.py', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../supabase/functions/README.md', import.meta.url), 'utf8');

test('live/: the broadcast, the demo clip, hls and the ea_live chat are gone', () => {
  for (const dead of ['broadcast.js', 'broadcast.css', 'ea-live-publish', 'DEMO_URL', 'hls.js', 'mountStream', 'ea_live', 'wireChat', 'End broadcast'])
    assert.equal(live.includes(dead), false, dead + ' still in live/index.html');
});

test('live/: reads the room state and imports the pure helpers', () => {
  assert.match(live, /sb\.rpc\("ea_room_state"\)/);
  assert.match(live, /import \{ statusLine, replayLabel, iframeUrl \} from "\/js\/room-page\.js\?v=[a-z0-9]+"/);
  assert.match(live, /sb\.rpc\("ea_is_member"\), sb\.rpc\("ea_is_admin"\)/);
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
});

test('live/: the admin writes go through the RPCs and the room row, never the link or meeting columns', () => {
  assert.match(live, /sb\.rpc\("ea_room_rotate_link"\)/);
  assert.match(live, /sb\.rpc\("ea_room_publish_replay", \{ p_replay: id, p_publish: on \}\)/);
  assert.ok(live.includes('action:"retry_replay", replay_id: id'));
  assert.equal(/update\(\{[^}]*(link_key|meeting_id)/.test(live), false);
});

test('build_site.py: hash list + _ASSET_RX carry js/room-page.js and no broadcast entries; HUB_PAGES has room', () => {
  assert.equal(build.includes('broadcast'), false);
  assert.ok(build.includes('"js/room-page.js",'));
  assert.ok(build.includes('js/room-page\\.js'));
  assert.match(build, /HUB_PAGES = \([^)]*"room"[^)]*\)/);
});

test('sw.js VERSION is bumped for the room', () => {
  assert.ok(sw.includes("const VERSION = 'tma-v21-academy-room';"));
});

test('the retired files are gone and the README says so', () => {
  for (const f of ['../../js/broadcast.js', '../../css/broadcast.css', '../../supabase/functions/ea-live-publish/index.ts'])
    assert.equal(existsSync(new URL(f, import.meta.url)), false, f + ' still exists');
  assert.ok(readme.includes('## RealtimeKit rooms'));
  assert.ok(readme.includes('supabase functions deploy ea-rtk-webhook --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr'));
  assert.ok(readme.includes('Retired 2026-09-14: `ea-live-publish`'));
});
