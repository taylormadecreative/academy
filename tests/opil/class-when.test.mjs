// node --test tests/opil/class-when.test.mjs — the date and time on the join screen, in the viewer's clock
import test from 'node:test';
import assert from 'node:assert/strict';
import { classWhen, programInstant } from '../../opil/hub/live-rooms.js';

const NOW = new Date('2026-09-16T15:00:00Z');   /* kickoff day, 11 AM in Atlanta */

test('a stored Atlanta time reads as ET in Atlanta and CT in Dallas, zone named', () => {
  const atl = classWhen({ date: '2026-09-16', start: '18:30', end: '19:30', zone: 'America/New_York', now: NOW });
  assert.deepEqual(atl, { day: 'Wed, Sep 16', time: '6:30 – 7:30 PM ET', startsAt: '6:30 PM ET', today: true });
  const dal = classWhen({ date: '2026-09-16', start: '18:30:00', end: '19:30:00', zone: 'America/Chicago', now: NOW });
  assert.equal(dal.time, '5:30 – 6:30 PM CT');
  assert.equal(dal.startsAt, '5:30 PM CT');
});

test('a class that crosses noon keeps both AM and PM; no end time shows the start alone', () => {
  assert.equal(classWhen({ date: '2026-10-05', start: '11:30', end: '12:30', zone: 'America/New_York', now: NOW }).time, '11:30 AM – 12:30 PM ET');
  assert.equal(classWhen({ date: '2026-10-05', start: '19:00', zone: 'America/New_York', now: NOW }).time, '7:00 PM ET');
});

test('no time on the row → the day only, never a made-up hour; no date → nothing', () => {
  const r = classWhen({ date: '2026-09-21', start: null, end: null, zone: 'America/New_York', now: NOW });
  assert.deepEqual(r, { day: 'Mon, Sep 21', time: null, startsAt: null, today: false });
  assert.deepEqual(classWhen({}), { day: null, time: null, startsAt: null, today: false });
});

test('"today" is judged on the Atlanta calendar, not the viewer’s', () => {
  /* 11 PM Sep 15 in Los Angeles is already Sep 16 in Atlanta */
  const late = new Date('2026-09-16T06:00:00Z');
  assert.equal(classWhen({ date: '2026-09-16', zone: 'America/Los_Angeles', now: late }).today, true);
});

test('programInstant handles daylight time: 18:30 ET in September is 22:30 UTC, in December 23:30 UTC', () => {
  assert.equal(programInstant('2026-09-16', '18:30').toISOString(), '2026-09-16T22:30:00.000Z');
  assert.equal(programInstant('2026-12-09', '18:30').toISOString(), '2026-12-09T23:30:00.000Z');
});
