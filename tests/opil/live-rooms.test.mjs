// tests/opil/live-rooms.test.mjs — run: node --test tests/opil/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessLabel, roomFromQuery, pickRoom, roomPath, liveListHTML } from '../../opil/hub/live-rooms.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (no, kind, extra = {}) => ({ no, kind, title: 'T' + no, is_live: false, stream_url: null, ...extra });

test('sessLabel matches the labels the pages used', () => {
  assert.equal(sessLabel(S(7, 'thread')), '07');
  assert.equal(sessLabel(S(103, 'curriculum')), 'S3');
  assert.equal(sessLabel(S(201, 'hpc')), 'H1');
  assert.equal(sessLabel(S(12, 'milestone')), '12');
});

test('roomFromQuery reads a positive integer s, nothing else', () => {
  assert.equal(roomFromQuery('?s=7'), 7);
  assert.equal(roomFromQuery('?s=07'), 7);
  assert.equal(roomFromQuery('?tour=1&s=103'), 103);
  for (const bad of ['', '?x=1', '?s=', '?s=abc', '?s=0', '?s=-1', '?s=1.5', '?s=7abc']) assert.equal(roomFromQuery(bad), null, bad);
});

test('pickRoom: a named session wins even when it is not live', () => {
  const r = pickRoom([S(7, 'thread'), S(8, 'thread', { is_live: true })], 7);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 7);
});

test('pickRoom: an unknown s falls back to the no-s rules', () => {
  const r = pickRoom([S(8, 'thread', { is_live: true })], 999);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 8);
});

test('pickRoom: exactly one live and no s enters it (old links keep working)', () => {
  const r = pickRoom([S(7, 'thread'), S(8, 'thread', { is_live: true })], null);
  assert.equal(r.mode, 'room'); assert.equal(r.session.no, 8);
});

test('pickRoom: two or more live and no s lists them by number', () => {
  const r = pickRoom([S(201, 'hpc', { is_live: true }), S(7, 'thread'), S(103, 'curriculum', { is_live: true })], null);
  assert.equal(r.mode, 'list'); assert.deepEqual(r.live.map(s => s.no), [103, 201]);
});

test('pickRoom: nothing live and no s is idle', () => {
  assert.deepEqual(pickRoom([S(7, 'thread')], null), { mode: 'idle' });
  assert.deepEqual(pickRoom([], null), { mode: 'idle' });
});

test('roomPath builds the link the instructor sends', () => {
  assert.equal(roomPath(7), '/opil/hub/live/?s=7');
  assert.equal(roomPath(103), '/opil/hub/live/?s=103');
});

test('liveListHTML renders one Join row per live session, escaped', () => {
  const html = liveListHTML([S(103, 'curriculum', { is_live: true, title: 'Data <b>101</b>' }), S(7, 'thread', { is_live: true })], esc);
  assert.match(html, /href="\/opil\/hub\/live\/\?s=103"/);
  assert.match(html, /href="\/opil\/hub\/live\/\?s=7"/);
  assert.match(html, /<span class="no2">S3<\/span>/);
  assert.match(html, /Data &lt;b&gt;101&lt;\/b&gt;/);
  assert.equal((html.match(/class="live-row"/g) || []).length, 2);
  assert.equal(liveListHTML([], esc), '');
});
