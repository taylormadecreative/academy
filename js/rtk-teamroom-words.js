/* Team rooms that persist — the words and the pure decisions (spec 2026-09-16-class-features-design.md §3).
   A team's standing room: no host, no recording, no question line; it opens the moment the first
   teammate walks in and stays open all year. The room page (opil/hub/team/room/) hands these words
   to mountRoomV2 as target.words; the team page's gold block (opil/hub/team/room-block.js) reads
   the presence rows through inRoomNow / teammatesLine. Import-safe in Node: no document, no window. */

/* the room's nouns, same shape as OPIL_WORDS / ROOM_WORDS in opil/hub/live-rooms.js.
   waiting: null   — a team room never waits for anyone; the first teammate opens it
   notOpen: ''     — the server never answers not_open for a team (the first entrant mints the meeting)
   recorded: false — the join screen must not say "Team room is recorded so you can rewatch it" */
export const TEAM_WORDS = Object.freeze({
  one: 'teammate', many: 'teammates', host: 'your team', teaching: 'is in the room', thing: 'team room',
  waiting: null, replayFor: 'your team', recorded: false,
  notAllowed: 'This room is for the team.', notOpen: '',
  notConfigured: 'The team room is not set up yet.',
});

/* the join screen's two info cells for a team room (js/rtk-room-v2.js reads when.day / when.time): a team
   room has no date and no start — without these the cells would say "When your team opens the room" under
   a line that says the room is open. The page hands this to mountRoomV2 as target.when. */
export const TEAM_WHEN = Object.freeze({ day: 'Open all year', time: 'Whenever your team wants', startsAt: null, today: false });

export const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the class's key for every table and channel — the same rule js/rtk-room-v2.js applies:
   'team:<uuid>' | 'room:<uuid>' | 'opil:<session no>'; null when the target names nothing */
export function roomKeyFor(target) {
  if (!target || typeof target !== 'object') return null;
  if (target.kind === 'team') return target.id ? 'team:' + String(target.id) : null;
  if (target.kind === 'room') return target.id ? 'room:' + String(target.id) : null;
  const no = target.session && target.session.no;
  return Number.isInteger(no) ? 'opil:' + no : null;
}

/* "Team The Rattlers" — unless the team already calls itself Team Something */
export function teamTitle(name) {
  const n = String(name || '').trim();
  if (!n) return 'Team room';
  return /^team\b/i.test(n) ? n : 'Team ' + n;
}

/* ?t=<uuid> on the room page (a coordinator opening a student team's room, feature 5) → the id, else null */
export function teamFromQuery(search) {
  let v; try { v = new URLSearchParams(search || '').get('t'); } catch (e) { return null; }
  return v && UUID_RX.test(v) ? v.toLowerCase() : null;
}

/* who counts as "in the room now": a presence row in state 'in' whose last beat is fresh
   (the room beats every 30 s; 90 s covers a throttled tab). now is injectable for tests. */
export const FRESH_MS = 90000;
export function inRoomNow(rows, now = Date.now()) {
  return (rows || []).filter(r => r && r.state === 'in' && r.last_seen && (now - Date.parse(r.last_seen)) <= FRESH_MS);
}

/* the line under the gold button: counts everyone but me */
export function teammatesLine(n) {
  const k = Math.max(0, Number(n) || 0);
  if (k === 0) return 'No one is in the room right now — you’d be first.';
  if (k === 1) return '1 teammate in the room now.';
  return k + ' teammates in the room now.';
}

/* the what's-happening-now strip inside a team room (no facilitator, no title to teach) */
export function teamNowLine(others) {
  const k = Math.max(0, Number(others) || 0);
  if (k === 0) return 'Your team room: just you so far — teammates join here anytime.';
  if (k === 1) return 'Your team room: you and 1 teammate.';
  return 'Your team room: you and ' + k + ' teammates.';
}

/* the card the room page shows when the room goes away — every reason is a sentence with a way back */
export function teamLeftCopy(reason) {
  const why = reason || 'left';
  if (why === 'kicked') return { kicker: 'Hold on', title: 'You were removed from the team room.', lede: 'Open it again from your team page and you are back in.' };
  if (why === 'ended') return { kicker: 'Until next time', title: 'The team room closed.', lede: 'It opens again the moment a teammate walks in. Tap Open team room to go back.' };
  if (why === 'dropped') return { kicker: 'Connection lost', title: 'You dropped out of the team room.', lede: 'Check your connection, then come back in — your teammates are still there.' };
  return { kicker: 'See you soon', title: 'You left the team room.', lede: 'It stays open for your team. Come back whenever you like.' };
}

/* the room page's branch before it touches the DOM: which team, and whether this person may open it.
   ctx = { teamId (from the hub boot), isStaffTeam, isAdmin, isJudge, facSessions, query (location.search) }
   isStaffTeam: the hub seats every admin on the staff team (ea_opil_my_team, 0030), which is nobody's
   room — with it true the page treats them as having no team of their own, so a coordinator landing here
   bare gets the picker ("Which team's room?") instead of a room called "Team Program Team". */
export function teamRoomBranch(ctx) {
  const c = ctx || {};
  const staff = !!c.isAdmin || !!c.isJudge || (Array.isArray(c.facSessions) && c.facSessions.length > 0);
  const own = c.teamId && !c.isStaffTeam ? String(c.teamId).toLowerCase() : null;
  const asked = teamFromQuery(c.query);
  if (asked && (staff || (own && asked === own))) return { branch: 'room', teamId: asked, staff };
  if (asked && !staff) return { branch: 'not_yours', teamId: asked, staff };
  if (own) return { branch: 'room', teamId: own, staff };
  return { branch: staff ? 'pick' : 'no_team', teamId: null, staff };
}

/* the one-time welcome inside the room: once per team per browser (store = localStorage or anything
   with getItem/setItem; a store that throws or is missing means "welcome them" — better twice than never) */
export const WELCOME_KEY = (roomKey) => 'tm-welcome:' + String(roomKey || '');
export function shouldWelcome(store, roomKey) {
  if (!roomKey) return false;
  try { if (store && store.getItem(WELCOME_KEY(roomKey))) return false; } catch (e) {}
  try { if (store) store.setItem(WELCOME_KEY(roomKey), new Date().toISOString()); } catch (e) {}
  return true;
}
