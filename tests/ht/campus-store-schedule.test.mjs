import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../../ht/hub/campus-store.js', import.meta.url), 'utf8');
const { repairDemoSchedule } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const sessionId = n => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const eventId = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fixture = () => ({
  events: [1, 2].map(n => ({ id: eventId(n), status: 'published', starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2020-01-01T01:00:00.000Z' })),
  class_sessions: [1, 2, 3, 4].map(n => ({ id: sessionId(n), status: 'scheduled', is_live: false, starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2020-01-01T01:00:00.000Z' }))
});

test('an aged demo schedule refreshes only built-in published events and scheduled classes', () => {
  const now = Date.parse('2026-09-22T18:00:00.000Z'), data = fixture();
  data.events.push({ id: 'my-event', status: 'published', starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2020-01-01T01:00:00.000Z' });
  data.class_sessions.push({ id: 'my-class', status: 'scheduled', starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2020-01-01T01:00:00.000Z' });
  assert.equal(repairDemoSchedule(data, now), true);
  assert.equal(Date.parse(data.events[0].starts_at), now + 120 * 60_000);
  assert.equal(Date.parse(data.class_sessions[0].starts_at), now + 30 * 60_000);
  assert.equal(data.events[2].starts_at, '2020-01-01T00:00:00.000Z', 'user-created event remains intact');
  assert.equal(data.class_sessions[4].starts_at, '2020-01-01T00:00:00.000Z', 'user-created session remains intact');
  assert.equal(repairDemoSchedule(data, now), false, 'a usable schedule is not slid forward on each load');
});

test('future demo activity is stable and a live session is never rewritten', () => {
  const now = Date.parse('2026-09-22T18:00:00.000Z'), data = fixture();
  data.events[0].starts_at = new Date(now + 120 * 60_000).toISOString();
  data.events[0].ends_at = new Date(now + 180 * 60_000).toISOString();
  data.class_sessions[0].starts_at = new Date(now + 30 * 60_000).toISOString();
  data.class_sessions[0].ends_at = new Date(now + 90 * 60_000).toISOString();
  data.class_sessions[1].status = 'live';
  data.class_sessions[1].is_live = true;
  const liveStarts = data.class_sessions[1].starts_at;
  assert.equal(repairDemoSchedule(data, now), false);
  assert.equal(data.class_sessions[1].starts_at, liveStarts);
});
