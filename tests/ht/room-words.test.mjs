// tests/ht/room-words.test.mjs — run: node --test tests/ht/*.test.mjs
// The words and colors that make the Academy room HT's. Pure module, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htWords, HT_TOKENS, htErrorText, htLoginHref, rememberKey, recallKey, forgetKey, ROOM_KEY_STORE, ROOM_KEY_MAX_AGE_MS } from '../../ht/hub/room-words.js';
import { KEY_RX } from '../../js/room-page.js';
import { OPIL_WORDS, nowCopy, joinCopy } from '../../opil/hub/live-rooms.js';

test('htWords carries exactly the OPIL_WORDS keys, frozen, with the host name threaded in', () => {
  const w = htWords('Dr. Gray');
  assert.equal(Object.isFrozen(w), true);
  assert.deepEqual(Object.keys(w).sort(), Object.keys(OPIL_WORDS).sort());
  assert.deepEqual(w, {
    one: 'person', many: 'people', host: 'Dr. Gray', teaching: 'is live', thing: 'session',
    waiting: 'Dr. Gray hasn’t started yet — we’ll bring you in the moment they do.',
    replayFor: 'the HT Hub',
    notAllowed: 'You need your host’s link to join this room.',
    notOpen: 'Dr. Gray hasn’t started yet.',
    notConfigured: 'The room is not set up yet.',
  });
});

test('htWords falls back to "Your host" for a blank name', () => {
  for (const bad of [undefined, null, '', '   ']) {
    const w = htWords(bad);
    assert.equal(w.host, 'Your host');
    assert.equal(w.waiting, 'Your host hasn’t started yet — we’ll bring you in the moment they do.');
    assert.equal(w.notOpen, 'Your host hasn’t started yet.');
  }
  assert.equal(htWords('  Nelson Taylor ').host, 'Nelson Taylor');
});

test('the shared helpers read HT words: the now strip and the waiting line', () => {
  const w = htWords('Dr. Gray');
  assert.equal(nowCopy({ facilitator: 'Dr. Gray', title: 'Fall town hall', recording: true }, w),
    'Dr. Gray is live: Fall town hall · This session is being recorded');
  assert.equal(nowCopy({ facilitator: null, title: 'Fall town hall', recording: false }, w), 'Session in progress: Fall town hall');
  assert.equal(joinCopy({ live: false, host: false }, w), w.waiting);
});

test('HT_TOKENS has the exact key shape provideRtkDesignSystem gets for the Academy, in HT colors', () => {
  assert.equal(Object.isFrozen(HT_TOKENS), true);
  assert.deepEqual(Object.keys(HT_TOKENS).sort(), ['borderRadius', 'colors', 'spacingBase', 'theme']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors).sort(),
    ['background', 'brand', 'danger', 'success', 'text', 'text-on-brand', 'video-bg', 'warning']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors.brand), ['300', '400', '500', '600', '700']);
  assert.deepEqual(Object.keys(HT_TOKENS.colors.background), ['600', '700', '800', '900', '1000']);
  assert.equal(HT_TOKENS.colors.brand[500], '#FFCC00');           // HT Gold is the accent
  assert.equal(HT_TOKENS.colors.background[1000], '#291C14');     // Terra canvas
  assert.equal(HT_TOKENS.colors.background[700], '#660100');      // HT Maroon panels
  assert.equal(HT_TOKENS.colors['text-on-brand'], '#3B0000');     // Mahogany on gold
  assert.equal(HT_TOKENS.theme, 'dark');
  for (const v of Object.values(HT_TOKENS.colors.brand).concat(Object.values(HT_TOKENS.colors.background)))
    assert.match(v, /^#[0-9A-F]{6}$/);
});

test('htErrorText never says Nelson; every code has a sentence', () => {
  const w = htWords('Dr. Gray');
  const codes = ['sign_in', 'not_allowed', 'bad_link', 'not_open', 'room_full', 'slow_down', 'no_room', 'not_host', 'no_replay', 'nothing_to_retry', 'no_upload', 'bad_replay', 'rtk_not_configured', 'cloudflare_502', 'server_500'];
  for (const c of codes) {
    const t = htErrorText(c, 500, w);
    assert.equal(typeof t, 'string'); assert.ok(t.length > 8, c);
    assert.doesNotMatch(t, /Nelson/, c);
  }
  assert.equal(htErrorText('not_allowed', 403, w), w.notAllowed);
  assert.equal(htErrorText('not_open', 409, w), w.notOpen);
  assert.equal(htErrorText('rtk_not_configured', 500, w), w.notConfigured);
  assert.equal(htErrorText('bad_link', 404, w), 'This link isn’t active anymore — ask your host for the new one.');
  assert.equal(htErrorText('not_host', 403, w), 'Only a host can do that.');
  assert.equal(htErrorText('room_full', 429, w), 'The room is full right now.');
  assert.equal(htErrorText('no_upload', 400, w), 'That recording never finished uploading, so there is nothing to retry.');
  assert.equal(htErrorText('zzz', 418, w), 'The server said 418.');
});

test('htLoginHref carries the key back through the email code', () => {
  assert.equal(htLoginHref(null), '/login/?next=' + encodeURIComponent('/ht/hub/live/'));
  assert.equal(htLoginHref('AbC123_-xyzXYZ0987ab-_'), '/login/?next=' + encodeURIComponent('/ht/hub/live/?k=AbC123_-xyzXYZ0987ab-_'));
  assert.doesNotMatch(htLoginHref('AbC123_-xyzXYZ0987ab-_'), /[?&]k=/);   // the key is inside 'next', not a top-level param
});

/* ---- the key remembered on the device: a Map-backed store, no localStorage ---- */
const KEY = 'AbC123_-xyzXYZ0987ab-_';
const DAY = 24 * 3600e3;
const fakeStore = () => { const m = new Map(); return { m, getItem: (n) => (m.has(n) ? m.get(n) : null), setItem: (n, v) => { m.set(n, String(v)); }, removeItem: (n) => { m.delete(n); } }; };

test('rememberKey writes {k, t} under ht-room-key and recallKey reads it back while it is young', () => {
  const st = fakeStore();
  assert.equal(rememberKey(st, KEY, 1000), true);
  assert.deepEqual(JSON.parse(st.getItem(ROOM_KEY_STORE)), { k: KEY, t: 1000 });
  assert.equal(ROOM_KEY_STORE, 'ht-room-key');
  assert.equal(recallKey(st, 1000), KEY);
  assert.equal(recallKey(st, 1000 + 6 * DAY), KEY);
  assert.equal(recallKey(st, 1000 + 7 * DAY - 1), KEY);          // younger than 7 days
  assert.equal(recallKey(st, 1000 + 7 * DAY), null);              // exactly 7 days = stale
  assert.equal(recallKey(st, 1000 + 30 * DAY), null);
  assert.equal(ROOM_KEY_MAX_AGE_MS, 7 * DAY);
  assert.equal(recallKey(st, 1000 + 2 * DAY, DAY), null);         // a shorter maxAgeMs is honoured
  assert.equal(recallKey(st, 1000 + DAY - 1, DAY), KEY);
  assert.equal(recallKey(st, 500), KEY);                          // a clock that went backwards is not "stale"
});

test('rememberKey refuses anything that is not a key and never throws', () => {
  const st = fakeStore();
  for (const bad of [null, undefined, '', 'short', KEY + 'x', KEY.replace('_', '+'), 123, {}]) {
    assert.equal(rememberKey(st, bad, 1000), false, String(bad));
    assert.equal(st.m.size, 0);
  }
  assert.ok(KEY_RX.test(KEY));
  assert.equal(rememberKey(null, KEY, 1000), false);
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  assert.equal(rememberKey(broken, KEY, 1000), false);
  /* no `now` → Date.now() */
  const before = Date.now(); assert.equal(rememberKey(st, KEY), true);
  const t = JSON.parse(st.getItem(ROOM_KEY_STORE)).t; assert.ok(t >= before && t <= Date.now());
});

test('recallKey is null for a missing, malformed, wrong-shaped or stale entry, and for a store that throws', () => {
  const st = fakeStore();
  assert.equal(recallKey(st, 1000), null);                                                 // missing
  for (const raw of ['', 'not json', '{', 'null', '"' + KEY + '"', '[]', '{}', '{"k":1,"t":1000}',
                     JSON.stringify({ k: 'short', t: 1000 }), JSON.stringify({ k: KEY + 'x', t: 1000 }),
                     JSON.stringify({ k: KEY.replace('-', '/'), t: 1000 }),
                     JSON.stringify({ k: KEY }), JSON.stringify({ k: KEY, t: 'yesterday' }), JSON.stringify({ k: KEY, t: null })]) {
    st.setItem(ROOM_KEY_STORE, raw);
    assert.equal(recallKey(st, 1000), null, raw);
  }
  st.setItem(ROOM_KEY_STORE, JSON.stringify({ k: KEY, t: 1000 - 8 * DAY }));
  assert.equal(recallKey(st, 1000), null);                                                 // stale
  assert.equal(recallKey(null, 1000), null);
  assert.equal(recallKey({ getItem: () => { throw new Error('blocked'); } }, 1000), null);
  assert.equal(recallKey({ getItem: () => 42 }, 1000), null);
  /* no `now` → Date.now() */
  st.setItem(ROOM_KEY_STORE, JSON.stringify({ k: KEY, t: Date.now() - DAY }));
  assert.equal(recallKey(st), KEY);
});

test('forgetKey removes the entry, tolerates an empty or throwing store, and recallKey is null after', () => {
  const st = fakeStore();
  rememberKey(st, KEY, 1000);
  forgetKey(st);
  assert.equal(st.getItem(ROOM_KEY_STORE), null);
  assert.equal(recallKey(st, 1000), null);
  forgetKey(st);                                                                           // nothing there: fine
  forgetKey(null);
  forgetKey({ removeItem: () => { throw new Error('blocked'); } });
  /* remembering again after forgetting works */
  assert.equal(rememberKey(st, KEY, 2000), true);
  assert.equal(recallKey(st, 2000), KEY);
});

test('the round trip: URL key → remembered → the same page without ?k= recalls it; a bad key never lands', () => {
  const st = fakeStore();
  const now = 1_700_000_000_000;
  const fromUrl = KEY;                       /* roomKey(location.search) on the first load */
  if (fromUrl) rememberKey(st, fromUrl, now);
  const k2 = null || recallKey(st, now + 3600e3);   /* the next load, ?k= gone */
  assert.equal(k2, KEY);
  const st2 = fakeStore();
  rememberKey(st2, 'not-a-key', now);
  assert.equal(null || recallKey(st2, now), null);
});
