// node --test tests/opil/teamroom.test.mjs — team rooms that persist: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_WORDS, TEAM_WHEN, UUID_RX, roomKeyFor, teamTitle, teamFromQuery, FRESH_MS, inRoomNow, teammatesLine, teamNowLine, teamLeftCopy, teamRoomBranch, shouldWelcome, WELCOME_KEY } from '../../js/rtk-teamroom-words.js';
import { create, isTeamKey, welcomeCopy, TEAM_PAGE } from '../../js/rtk-teamroom.js';
import { mount, placeBlock, roomHref, ROOM_PATH, REFRESH_MS } from '../../opil/hub/team/room-block.js';
import { OPIL_WORDS, ROOM_WORDS, endCopy, nowCopy, joinCopy } from '../../opil/hub/live-rooms.js';

const T = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';

test('TEAM_WORDS has every key the room reads, plus the two a team room needs (no waiting, not recorded)', () => {
  for (const k of Object.keys(OPIL_WORDS)) assert.ok(k in TEAM_WORDS, 'missing ' + k);
  for (const k of Object.keys(ROOM_WORDS)) assert.ok(k in TEAM_WORDS, 'missing ' + k);
  assert.equal(TEAM_WORDS.one, 'teammate'); assert.equal(TEAM_WORDS.many, 'teammates');
  assert.equal(TEAM_WORDS.host, 'your team'); assert.equal(TEAM_WORDS.thing, 'team room');
  assert.equal(TEAM_WORDS.waiting, null); assert.equal(TEAM_WORDS.replayFor, 'your team');
  assert.equal(TEAM_WORDS.notAllowed, 'This room is for the team.'); assert.equal(TEAM_WORDS.notOpen, '');
  assert.equal(TEAM_WORDS.notConfigured, 'The team room is not set up yet.');
  assert.equal(TEAM_WORDS.recorded, false);
  assert.ok(Object.isFrozen(TEAM_WORDS));
  /* the join screen's cells: "Date — Open all year", "Team room time — Whenever your team wants" — one
     sentence with "The room is open — come on in." above them; no start time to count down to */
  assert.equal(TEAM_WHEN.day, 'Open all year'); assert.equal(TEAM_WHEN.time, 'Whenever your team wants');
  assert.equal(TEAM_WHEN.startsAt, null); assert.equal(TEAM_WHEN.today, false);
  assert.ok(Object.isFrozen(TEAM_WHEN));
});

test('the room’s own copy reads right with the team words', () => {
  const ec = endCopy(TEAM_WORDS);
  assert.equal(ec.leave, 'Leave team room?');
  assert.equal(ec.endButton, 'End the team room for everyone');
  assert.equal(nowCopy({ facilitator: null, title: 'Team The Rattlers' }, TEAM_WORDS), 'Team room in progress: Team The Rattlers');
  /* the join screen: no facilitator, and nobody waits — the line is an invitation */
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 0 }, TEAM_WORDS), 'The room is open — come on in.');
  assert.equal(joinCopy({ live: true, host: false, facilitator: null, joined: 3 }, TEAM_WORDS), '3 in the room so far.');
});

test('roomKeyFor: team:<id>, room:<id>, opil:<no>, and null for nothing', () => {
  assert.equal(roomKeyFor({ kind: 'team', id: T }), 'team:' + T);
  assert.equal(roomKeyFor({ kind: 'room', id: 'r-1' }), 'room:r-1');
  assert.equal(roomKeyFor({ kind: 'opil', session: { no: 2 } }), 'opil:2');
  assert.equal(roomKeyFor({ session: { no: 7 } }), 'opil:7');   /* the default kind, as rtk-room-v2 treats it */
  assert.equal(roomKeyFor({ kind: 'team' }), null);
  assert.equal(roomKeyFor({ kind: 'opil', session: null }), null);
  assert.equal(roomKeyFor(null), null);
});

test('teamTitle: Team <name>, never Team Team', () => {
  assert.equal(teamTitle('The Rattlers'), 'Team The Rattlers');
  assert.equal(teamTitle('Team Aeero'), 'Team Aeero');
  assert.equal(teamTitle(' team kimt '), 'team kimt');
  assert.equal(teamTitle('Teamwork Inc'), 'Team Teamwork Inc');
  assert.equal(teamTitle(''), 'Team room');
  assert.equal(teamTitle(undefined), 'Team room');
});

test('teamFromQuery reads ?t=<uuid> only', () => {
  assert.equal(teamFromQuery('?t=' + T), T);
  assert.equal(teamFromQuery('?t=' + T.toUpperCase()), T);
  assert.equal(teamFromQuery('?t=nope'), null);
  assert.equal(teamFromQuery(''), null);
  assert.equal(teamFromQuery(undefined), null);
  assert.ok(UUID_RX.test(T));
});

test('inRoomNow: state in and a beat within 90 s; waiting, out, stale and broken rows are not in the room', () => {
  const now = Date.parse('2026-09-16T23:00:00Z');
  const rows = [
    { user_id: 'a', state: 'in', last_seen: new Date(now - 10000).toISOString() },
    { user_id: 'b', state: 'in', last_seen: new Date(now - FRESH_MS).toISOString() },        /* exactly on the line: in */
    { user_id: 'c', state: 'in', last_seen: new Date(now - FRESH_MS - 1000).toISOString() }, /* a second past: out */
    { user_id: 'd', state: 'waiting', last_seen: new Date(now - 1000).toISOString() },
    { user_id: 'e', state: 'out', last_seen: new Date(now - 1000).toISOString() },
    { user_id: 'f', state: 'in', last_seen: null },
    null,
  ];
  assert.deepEqual(inRoomNow(rows, now).map(r => r.user_id), ['a', 'b']);
  assert.deepEqual(inRoomNow([], now), []);
  assert.deepEqual(inRoomNow(null, now), []);
});

test('teammatesLine and teamNowLine count in plain words', () => {
  assert.equal(teammatesLine(0), 'No one is in the room right now — you’d be first.');
  assert.equal(teammatesLine(1), '1 teammate in the room now.');
  assert.equal(teammatesLine(4), '4 teammates in the room now.');
  assert.equal(teammatesLine(-2), teammatesLine(0));
  assert.equal(teammatesLine('x'), teammatesLine(0));
  assert.equal(teamNowLine(0), 'Your team room: just you so far — teammates join here anytime.');
  assert.equal(teamNowLine(1), 'Your team room: you and 1 teammate.');
  assert.equal(teamNowLine(3), 'Your team room: you and 3 teammates.');
});

test('teamLeftCopy: every way out is a sentence with the way back', () => {
  for (const why of ['left', 'kicked', 'ended', 'dropped', undefined, 'whatever']) {
    const c = teamLeftCopy(why);
    assert.ok(c.kicker && c.title && c.lede, why);
    assert.ok(/\.$/.test(c.title), why);
  }
  assert.equal(teamLeftCopy('left').title, 'You left the team room.');
  assert.equal(teamLeftCopy('kicked').title, 'You were removed from the team room.');
  /* nobody in a team room can "let you back in" — there is no such action; the way back is the page */
  assert.equal(teamLeftCopy('kicked').lede, 'Open it again from your team page and you are back in.');
  assert.doesNotMatch(teamLeftCopy('kicked').lede, /let you back in/);
  assert.equal(teamLeftCopy('dropped').kicker, 'Connection lost');
  assert.equal(teamLeftCopy('ended').title, 'The team room closed.');
});

test('teamRoomBranch: my team, a coordinator’s pick, a student on someone else’s link, nobody’s team', () => {
  const other = '2c5f39cb-3fb2-22e3-994f-1127e4ddb538';
  assert.deepEqual(teamRoomBranch({ teamId: T }), { branch: 'room', teamId: T, staff: false });
  assert.deepEqual(teamRoomBranch({ teamId: T.toUpperCase(), query: '?t=' + T }), { branch: 'room', teamId: T, staff: false });
  assert.deepEqual(teamRoomBranch({ teamId: T, query: '?t=' + other }), { branch: 'not_yours', teamId: other, staff: false });
  assert.deepEqual(teamRoomBranch({ teamId: null, query: '?t=' + other }), { branch: 'not_yours', teamId: other, staff: false });
  assert.deepEqual(teamRoomBranch({ teamId: null }), { branch: 'no_team', teamId: null, staff: false });
  /* the program team: any team by link; with none named, their own REAL team if they have one, else the picker */
  assert.deepEqual(teamRoomBranch({ isAdmin: true, teamId: null, query: '?t=' + other }), { branch: 'room', teamId: other, staff: true });
  assert.deepEqual(teamRoomBranch({ isJudge: true, teamId: null }), { branch: 'pick', teamId: null, staff: true });
  assert.deepEqual(teamRoomBranch({ facSessions: [3], teamId: T }), { branch: 'room', teamId: T, staff: true });
  assert.deepEqual(teamRoomBranch({ facSessions: [], teamId: null }), { branch: 'no_team', teamId: null, staff: false });
  assert.deepEqual(teamRoomBranch(undefined), { branch: 'no_team', teamId: null, staff: false });
  /* a coordinator is seated on the staff team by the hub (0030): that is nobody's room → the picker, not "Team Program Team" */
  assert.deepEqual(teamRoomBranch({ isAdmin: true, teamId: T, isStaffTeam: true }), { branch: 'pick', teamId: null, staff: true });
  assert.deepEqual(teamRoomBranch({ isAdmin: true, teamId: T, isStaffTeam: true, query: '?t=' + other }), { branch: 'room', teamId: other, staff: true });
  /* the flag never opens a door for a student: a non-staff person on the staff team (cannot happen) still gets no room */
  assert.deepEqual(teamRoomBranch({ teamId: T, isStaffTeam: true }), { branch: 'no_team', teamId: null, staff: false });
  assert.deepEqual(teamRoomBranch({ teamId: T, isStaffTeam: true, query: '?t=' + T }), { branch: 'not_yours', teamId: T, staff: false });
});

test('shouldWelcome: once per team per store; no store or a broken store still welcomes; no key never welcomes', () => {
  const mem = new Map();
  const store = { getItem: (k) => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(shouldWelcome(store, 'team:' + T), true);
  assert.equal(shouldWelcome(store, 'team:' + T), false);
  assert.equal(mem.has(WELCOME_KEY('team:' + T)), true);
  assert.equal(shouldWelcome(store, 'team:other'), true);   /* another team: its own welcome */
  assert.equal(shouldWelcome(null, 'team:' + T), true);
  assert.equal(shouldWelcome(undefined, 'team:' + T), true);
  const broken = { getItem() { throw new Error('private mode'); }, setItem() { throw new Error('private mode'); } };
  assert.equal(shouldWelcome(broken, 'team:' + T), true);
  assert.equal(shouldWelcome(store, null), false);
  assert.equal(shouldWelcome(store, ''), false);
});

/* ---- the plugin ---- */
test('the plugin is import-safe and only lights up for a team key', () => {
  assert.equal(isTeamKey('team:' + T), true);
  assert.equal(isTeamKey('opil:1'), false);
  assert.equal(isTeamKey('room:x'), false);
  assert.equal(isTeamKey(null), false);
  assert.equal(TEAM_PAGE, '/opil/hub/team/');
  assert.equal(welcomeCopy(), 'This is your team’s own room. It stays open all year and is not recorded. Leave whenever you like — you can come back anytime.');
});

function memStore() {
  const mem = new Map();
  return { mem, getItem: (k) => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, v) };
}
function fakeCtx(roomKey, store = memStore()) {
  const calls = { buttons: [], toasts: [], on: {} };
  return { calls, store, ctx: {
    roomKey, words: TEAM_WORDS, store,
    bar: { addButton(html) { calls.buttons.push(html); return { remove() { calls.removed = true; } }; } },
    toast(msg, ms) { calls.toasts.push([msg, ms]); },
    on(ev, cb) { calls.on[ev] = cb; },
  } };
}

test('in a team room: one Team page button, one welcome (never twice), gone on stop', () => {
  const { calls, ctx } = fakeCtx('team:' + T);
  const p = create(ctx);
  p.start();
  assert.equal(calls.buttons.length, 1);
  assert.match(calls.buttons[0], /href="\/opil\/hub\/team\/"/);
  assert.match(calls.buttons[0], /class="r2-btn r2-teampage"/);
  assert.equal(calls.toasts.length, 1);
  assert.equal(calls.toasts[0][0], welcomeCopy());
  calls.on.joined && calls.on.joined();   /* a rejoin after a drop must not welcome again */
  assert.equal(calls.toasts.length, 1);
  p.stop();
  assert.equal(calls.removed, true);
});

test('the welcome is once per team per browser: a second visit (a new mount, same store) is quiet; a new browser is welcomed', () => {
  const store = memStore();
  const first = fakeCtx('team:' + T, store);
  create(first.ctx).start();
  assert.equal(first.calls.toasts.length, 1);
  const again = fakeCtx('team:' + T, store);   /* reload, or a drop the room could not mend and a fresh mount */
  const p2 = create(again.ctx); p2.start();
  assert.equal(again.calls.toasts.length, 0);
  assert.equal(again.calls.buttons.length, 1);   /* the Team page button is there every time */
  again.calls.on.joined && again.calls.on.joined();
  assert.equal(again.calls.toasts.length, 0);
  p2.stop();
  const other = fakeCtx('team:' + T, memStore());
  create(other.ctx).start();
  assert.equal(other.calls.toasts.length, 1);
  const noStore = fakeCtx('team:' + T, null);   /* private mode: better twice than never */
  create(noStore.ctx).start();
  assert.equal(noStore.calls.toasts.length, 1);
});

test('in an OPIL session or an Academy room the plugin adds nothing', () => {
  for (const key of ['opil:1', 'room:abc']) {
    const { calls, ctx } = fakeCtx(key);
    const p = create(ctx); p.start(); p.stop();
    assert.equal(calls.buttons.length, 0, key); assert.equal(calls.toasts.length, 0, key);
  }
});

test('a broken ctx never throws out of start', () => {
  assert.doesNotThrow(() => { const p = create({ roomKey: 'team:' + T, bar: null, on: null, toast: null, store: null }); p.start(); p.stop(); });
  assert.doesNotThrow(() => { const p = create(null); p.start(); p.stop(); });
});

/* ---- the team page block ---- */
test('room-block: paths, and a mount with no team or no document is a no-op', async () => {
  assert.equal(ROOM_PATH, '/opil/hub/team/room/');
  assert.equal(REFRESH_MS, 20000);
  assert.equal(roomHref(T, false), '/opil/hub/team/room/');
  assert.equal(roomHref(T, true), '/opil/hub/team/room/?t=' + T);
  assert.equal(roomHref(null, true), '/opil/hub/team/room/');
  const r = mount(null, { teamId: null });
  assert.equal(typeof r.stop, 'function'); await r.refresh(); r.stop();
  const r2 = mount(null, { teamId: T });   /* no document in Node */
  assert.equal(typeof r2.stop, 'function'); r2.stop();
});

/* a tiny DOM: enough for placeBlock (parentElement, classList, insertBefore, firstChild, ownerDocument) */
function node(cls, children = []) {
  const n = { cls, classList: { contains: (c) => cls.split(' ').includes(c) }, children: [], parentElement: null, ownerDocument: null,
    get firstChild() { return this.children[0] || null; },
    insertBefore(el, ref) { const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(el); else this.children.splice(i, 0, el); el.parentElement = this; return el; } };
  children.forEach(c => { c.parentElement = n; n.children.push(c); });
  return n;
}
test('placeBlock never makes the block a grid child of .hub-grid: before a card → before it; a grid column → inside it, first; nothing → the top of the first column', () => {
  const block = node('tm-block');
  const chat = node('hcard chat'), locker = node('hcard');
  const col = node('', [chat, locker]), side = node('side');
  const grid = node('hub-grid', [col, side]);
  assert.equal(placeBlock(block, chat), 'before');
  assert.deepEqual(col.children.map(c => c.cls), ['tm-block', 'hcard chat', 'hcard']);
  assert.deepEqual(grid.children.map(c => c.cls), ['', 'side']);   /* the grid still has exactly two columns */
  /* the old documented call handed in the column itself */
  const block2 = node('tm-block');
  assert.equal(placeBlock(block2, col), 'inside');
  assert.deepEqual(grid.children.map(c => c.cls), ['', 'side']);
  assert.equal(col.children[0], block2);
  /* nothing to anchor to: the top of the first column, found through the document */
  const block3 = node('tm-block');
  const doc = { querySelector: (sel) => sel === '.hub-grid > div' ? col : null, body: node('body') };
  block3.ownerDocument = doc;
  assert.equal(placeBlock(block3, null), 'top');
  assert.equal(col.children[0], block3);
});
