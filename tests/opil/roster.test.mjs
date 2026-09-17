// node --test tests/opil/roster.test.mjs — profile cards in People: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { blurb, BLURB_MAX, rosterOrder, cardFor, rowLine, countCopy, ROLE_WORD, LOAD_FAILED_NOTE, selfFinePrint, isUuid, create } from '../../js/rtk-roster.js';
import { switchCopy, SAVE_OK, SAVE_FAIL } from '../../opil/hub/hide-card.js';

test('blurb is the first line, tidied, never past 140 characters', () => {
  assert.equal(blurb('  A wallet for   campus\nvendors\nline three'), 'A wallet for campus');
  assert.equal(blurb(''), '');
  assert.equal(blurb(null), '');
  const long = 'x'.repeat(300);
  const b = blurb(long);
  assert.equal(b.length, BLURB_MAX);
  assert.ok(b.endsWith('…'));
  assert.equal(blurb('a'.repeat(140)).length, 140);   /* exactly 140 is left alone */
  assert.equal(blurb('\r\nsecond line first?\r\n'), '');   /* an empty first line is empty */
});

test('rosterOrder: you first, then hosts, then everyone by name — never mutates the input', () => {
  const list = [
    { id: 'c', name: 'Zed', host: false },
    { id: 'h', name: 'Jamal', host: true },
    { id: 'me', name: 'Nelson', host: false },
    { id: 'a', name: 'amy', host: false },
    { id: 'b', name: 'Bo', host: false },
  ];
  const copy = list.slice();
  const out = rosterOrder(list, 'me');
  assert.deepEqual(out.map(p => p.id), ['me', 'h', 'a', 'b', 'c']);
  assert.deepEqual(list, copy);
  assert.deepEqual(rosterOrder([], 'me'), []);
  assert.deepEqual(rosterOrder(null, 'me'), []);
  /* a self who is also a host still comes first */
  assert.equal(rosterOrder([{ id: 'h', name: 'Jamal', host: true }, { id: 'me', name: 'Nelson', host: true }], 'me')[0].id, 'me');
});

test('cardFor (OPIL): name, school · team, Building: blurb', () => {
  const c = cardFor({ user_id: 'u1', name: 'Amy Chen', school: 'Spelman', team: 'The Rattlers', blurb: 'A wallet for campus vendors', role: 'student' }, { name: 'Amy C.' });
  assert.equal(c.title, 'Amy Chen');
  assert.equal(c.sub, 'Spelman · The Rattlers');
  assert.equal(c.body, 'Building: A wallet for campus vendors');
  assert.equal(c.note, '');
});

test('cardFor (OPIL): a program-team row shows the role word, no project note', () => {
  const c = cardFor({ user_id: 'j', name: 'Jamal Ware', school: '', team: '', blurb: '', role: 'facilitator' }, { name: 'Jamal' });
  assert.equal(c.sub, 'Facilitator');
  assert.equal(c.body, '');
  assert.equal(c.note, '');
  assert.equal(ROLE_WORD.coordinator, 'Coordinator');
  assert.equal(ROLE_WORD.student, '');
});

test('cardFor (OPIL): a student with no write-up gets a sentence, not a blank', () => {
  const c = cardFor({ user_id: 'u2', name: 'Bo', school: 'Morehouse', team: 'Team A', blurb: '', role: 'student' }, { name: 'Bo' });
  assert.equal(c.note, 'No project write-up yet.');
  const mine = cardFor({ user_id: 'me', name: 'Me', school: 'Morehouse', team: 'Team A', blurb: '', role: 'student' }, { name: 'Me', self: true });
  assert.match(mine.note, /You haven’t said/);
});

test('cardFor (OPIL): a hidden or unknown person keeps their card private — the meeting name still shows', () => {
  const c = cardFor(null, { name: 'Casey' });
  assert.equal(c.title, 'Casey');
  assert.equal(c.note, 'Casey keeps their card private.');
  assert.equal(c.body, '');
  /* your own missing card names no switch: a hidden facilitator or coordinator has none to flip */
  const me = cardFor(null, { name: 'Me', self: true });
  assert.equal(me.note, 'Your card isn’t showing right now.');
  assert.doesNotMatch(me.note, /My team/);
  assert.equal(cardFor(null, {}).title, 'Someone');
});

test('cardFor / rowLine: a failed read is our problem, never "keeps their card private"', () => {
  for (const isRoom of [false, true]) {
    const c = cardFor(null, { name: 'Casey', isRoom, failed: true });
    assert.equal(c.note, LOAD_FAILED_NOTE);
    assert.match(c.note, /try again/);
    assert.equal(c.title, 'Casey');
    const me = cardFor(null, { name: 'Me', self: true, isRoom, failed: true });
    assert.equal(me.note, LOAD_FAILED_NOTE);
    assert.doesNotMatch(me.note, /hidden/);
  }
  /* a row that did load still wins over the flag (a stale-but-real card beats a shrug) */
  assert.equal(cardFor({ name: 'Amy', school: 'Spelman', team: '', blurb: '', role: 'student' }, { name: 'Amy', failed: true }).sub, 'Spelman');
  assert.equal(rowLine(null, { failed: true }), 'In the class');
  assert.equal(rowLine(null, { failed: true, isRoom: true }), 'In the room');
  assert.equal(rowLine(null, { failed: true, host: true }), 'Running this class');
  assert.equal(rowLine(null, { failed: true, host: true, isRoom: true }), 'Running this session');
  assert.equal(rowLine(null, { failed: true, self: true }), 'You');
});

test('selfFinePrint: only a student is told about the Hide my card switch', () => {
  assert.match(selfFinePrint({ role: 'student' }), /My team/);
  assert.equal(selfFinePrint({ role: 'facilitator' }), '');
  assert.equal(selfFinePrint({ role: 'judge' }), '');
  assert.equal(selfFinePrint({ role: 'coordinator' }), '');
  assert.equal(selfFinePrint(null), '');
  assert.equal(selfFinePrint({ role: 'student' }, { isRoom: true }), '');
});

test('isUuid: only a real user id reaches the database', () => {
  assert.ok(isUuid('6f1c2a3e-9b4d-4c7e-8a1f-0b2c3d4e5f60'));
  assert.ok(isUuid('6F1C2A3E-9B4D-4C7E-8A1F-0B2C3D4E5F60'));
  assert.ok(!isUuid('peer_abc123'));
  assert.ok(!isUuid(''));
  assert.ok(!isUuid(null));
  assert.ok(!isUuid('6f1c2a3e9b4d4c7e8a1f0b2c3d4e5f60'));
});

test('cardFor (rooms): name + bio from ea_profiles; hide_card honoured; no bio is a sentence', () => {
  const c = cardFor({ user_id: 'u', display_name: 'Dr. Gray', bio: 'Provost at HT.', hide_card: false }, { name: 'Gray', isRoom: true });
  assert.equal(c.title, 'Dr. Gray');
  assert.equal(c.body, 'Provost at HT.');
  assert.equal(c.note, '');
  const hid = cardFor({ user_id: 'u', display_name: 'Dr. Gray', bio: 'secret', hide_card: true }, { name: 'Gray', isRoom: true });
  assert.equal(hid.body, '');
  assert.equal(hid.note, 'Dr. Gray keeps their card private.');
  const none = cardFor({ user_id: 'u', display_name: 'Pat', bio: '  ' }, { name: 'Pat', isRoom: true });
  assert.equal(none.note, 'Pat hasn’t written a bio yet.');
  const meNone = cardFor(null, { name: 'Me', isRoom: true, self: true });
  assert.match(meNone.note, /add one on your profile/);
});

test('rowLine: the short line under a name in the list', () => {
  assert.equal(rowLine(null, { self: true }), 'You');
  assert.equal(rowLine({ school: 'Spelman', team: 'Rattlers', role: 'student' }), 'Spelman · Rattlers');
  assert.equal(rowLine({ school: '', team: '', role: 'judge' }), 'Judge');
  assert.equal(rowLine({ school: '', team: '', role: 'student' }, { host: true }), 'Running this class');
  assert.equal(rowLine({ school: '', team: '', role: 'student' }), 'In the class');
  assert.equal(rowLine(null, { host: true }), 'Running this class');
  assert.equal(rowLine(null, {}), 'Card kept private');
  assert.equal(rowLine({ bio: 'hi' }, { isRoom: true }), 'Tap for their bio');
  assert.equal(rowLine({ bio: 'hi', hide_card: true }, { isRoom: true }), 'Card kept private');
  assert.equal(rowLine({ bio: '' }, { isRoom: true }), 'In the room');
  assert.equal(rowLine(null, { isRoom: true, host: true }), 'Running this session');
});

test('countCopy reads like a person says it, in the room’s own noun', () => {
  assert.equal(countCopy(1, { thing: 'class' }), '1 in class now');
  assert.equal(countCopy(4, { thing: 'class' }), '4 in class now');
  assert.equal(countCopy(2, { thing: 'session' }), '2 in the room now');
  assert.equal(countCopy(0, null), '0 in the room now');
});

test('create(ctx) is import-safe and builds a plugin with the contract’s shape without touching the DOM', () => {
  const ctx = { sb: {}, el: () => null, esc: (s) => s, uid: 'me', host: false, isRoom: false, toast() {}, on() {}, getMeeting: () => null, now: () => 0, words: { thing: 'class' } };
  const p = create(ctx);
  assert.equal(typeof p.start, 'function');
  assert.equal(typeof p.stop, 'function');
  assert.equal(typeof p.onBind, 'function');
  assert.equal(typeof p.mount, 'function');
  assert.equal(p.mount(null), null);   /* no pane, nothing to draw, no throw */
  p.stop();
});

/* a tiny meeting double: enough of the RealtimeKit shape for follow() / people() / doLoad() */
function fakeMeeting(peers) {
  const handlers = {};
  return {
    self: { customParticipantId: 'me', name: 'Nelson' },
    participants: { joined: {
      toArray: () => peers,
      on(ev, h) { (handlers[ev] = handlers[ev] || []).push(h); },
      off(ev, h) { handlers[ev] = (handlers[ev] || []).filter(x => x !== h); },
    } },
    handlers,
  };
}

test('follow(): a meeting is followed once across small-group round trips, and let go on stop()', () => {
  const main = fakeMeeting([]), group = fakeMeeting([]);
  let bound = null;
  const ctx = { sb: {}, el: () => null, esc: (s) => s, uid: 'me', host: false, isRoom: false, toast() {}, on(ev, h) { if (ev === 'bind') bound = h; }, getMeeting: () => main, now: () => 0, words: { thing: 'class' } };
  const p = create(ctx);
  p.onBind(main); p.onBind(group); p.onBind(main); p.onBind(group); p.onBind(main);
  assert.equal(p.followedCount, 2);
  assert.equal(main.handlers.participantJoined.length, 1);
  assert.equal(main.handlers.participantLeft.length, 1);
  assert.equal(group.handlers.participantJoined.length, 1);
  p.stop();
  assert.equal(p.followedCount, 0);
  assert.equal(main.handlers.participantJoined.length, 0);
  assert.equal(main.handlers.participantLeft.length, 0);
  assert.equal(group.handlers.participantJoined.length, 0);
  p.onBind(main);   /* after stop nothing is followed again */
  assert.equal(p.followedCount, 0);
  assert.equal(bound, null);   /* start() was never called, so no bind handler was registered */
});

test('load(): a failed RPC is remembered as failed, a good one clears it; a room read sends only real user ids', async () => {
  let fail = true, calls = 0;
  const sb = { rpc: async () => { calls++; return fail ? { data: null, error: new Error('function does not exist') } : { data: [{ user_id: 'me', name: 'Nelson', school: '', team: '', blurb: '', role: 'facilitator' }], error: null }; } };
  const warn = console.warn; console.warn = () => {};
  try {
    const ctx = { sb, el: () => null, esc: (s) => s, uid: 'me', host: true, isRoom: false, toast() {}, on() {}, getMeeting: () => fakeMeeting([]), now: () => 0, words: { thing: 'class' } };
    const p = create(ctx);
    await p.load();
    assert.equal(p.failed, true);
    assert.equal(p.cards.size, 0);
    fail = false;
    await p.load();
    assert.equal(p.failed, false);
    assert.equal(p.cards.get('me').role, 'facilitator');
    assert.equal(calls, 2);

    /* rooms: a peer with no user id is listed but never sent to ea_profiles */
    let sent = null;
    const sbRoom = { from: () => ({ select: () => ({ in: async (col, ids) => { sent = ids; return { data: [], error: null }; } }) }) };
    const m = fakeMeeting([{ customParticipantId: '6f1c2a3e-9b4d-4c7e-8a1f-0b2c3d4e5f60', name: 'Gray' }, { id: 'peer_zz', name: 'Guest' }]);
    m.self.customParticipantId = '0b2c3d4e-5f60-4c7e-8a1f-6f1c2a3e9b4d';
    const r = create({ sb: sbRoom, el: () => null, esc: (s) => s, uid: '0b2c3d4e-5f60-4c7e-8a1f-6f1c2a3e9b4d', host: false, isRoom: true, toast() {}, on() {}, getMeeting: () => m, now: () => 0, words: { thing: 'session' } });
    await r.load();
    assert.deepEqual(sent.slice().sort(), ['0b2c3d4e-5f60-4c7e-8a1f-6f1c2a3e9b4d', '6f1c2a3e-9b4d-4c7e-8a1f-0b2c3d4e5f60']);
    assert.equal(r.failed, false);
  } finally { console.warn = warn; }
});

test('hide-card copy: the switch always says what happens next', () => {
  assert.match(switchCopy(true), /keep it private/);
  assert.match(switchCopy(false), /school, team/);
  assert.equal(SAVE_OK(true), 'Your card is hidden now.');
  assert.equal(SAVE_OK(false), 'Your card is showing again.');
  assert.match(SAVE_FAIL, /try again/);
});
