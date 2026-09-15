// tests/ht/room-words.test.mjs — run: node --test tests/ht/*.test.mjs
// The words and colors that make the Academy room HT's. Pure module, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htWords, HT_TOKENS, htErrorText, htLoginHref } from '../../ht/hub/room-words.js';
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
