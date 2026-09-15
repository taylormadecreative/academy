/* OPIL live rooms — the decisions the live page and hub home share. Pure: no DOM, no supabase,
   so `node --test tests/opil/*.test.mjs` covers every branch.
   A room is a scheduled session; its link is /opil/hub/live/?s=<no>. Several sessions may be
   live at once (migration 0032), so "which room am I in" is a question, answered here. */

export const sessLabel = (s) => s.kind === 'curriculum' ? 'S' + (s.no % 100) : s.kind === 'hpc' ? 'H' + (s.no % 100) : String(s.no).padStart(2, '0');

/* ?s=7 → 7. Anything that is not a positive integer → null, so a bad link degrades to the
   no-s view instead of a blank page. */
export function roomFromQuery(search) {
  let v; try { v = new URLSearchParams(search || '').get('s'); } catch (e) { return null; }
  if (v == null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}

/* wanted (a session no, or null) + every session the caller can see →
   { mode:'room', session } | { mode:'list', live } | { mode:'idle' }.
   A named session is a room even before it is live: the student who clicked early waits there. */
export function pickRoom(sessions, wanted) {
  const all = sessions || [];
  if (wanted != null) { const s = all.find(x => x.no === wanted); if (s) return { mode: 'room', session: s }; }
  const live = all.filter(x => x.is_live).slice().sort((a, b) => a.no - b.no);
  if (live.length === 1) return { mode: 'room', session: live[0] };
  if (live.length > 1) return { mode: 'list', live };
  return { mode: 'idle' };
}

export const roomPath = (no) => '/opil/hub/live/?s=' + no;

/* The "Live now" list: hub home and the room page's no-s view render the same rows. */
export function liveListHTML(live, esc) {
  return (live || []).map(s => `<a class="live-row" href="${roomPath(s.no)}"><span class="no2">${esc(sessLabel(s))}</span><b>${esc(s.title)}</b><span class="join">Join &rarr;</span></a>`).join('');
}

/* ---------- room v2 (spec 2026-09-14-opil-room-v2-design.md): the words on the screen ---------- */

/* v2 is the default when the page's flag says so; ?classic=1 on any link brings the old room back */
export function useV2(search, flag) {
  let q = null; try { q = new URLSearchParams(search || ''); } catch (e) { return !!flag; }
  if (q.get('classic') === '1') return false;   /* the old room, this visit */
  if (q.get('v2') === '1') return true;         /* the new room, this visit — for testing before the flag flips */
  return !!flag;
}

/* mic/camera state as a sentence + what a tap does — never just an icon */
export function stateCopy({ audio, video }) {
  return {
    mic: audio ? ['Mic is on', 'People can hear you'] : ['You’re muted', 'Tap to unmute'],
    cam: video ? ['Camera is on', 'You’ll be seen'] : ['Camera is off', 'Tap to turn on'],
  };
}

/* The words that differ between the OPIL class room and Nelson's Academy room. Every helper
   below defaults to OPIL_WORDS, so the OPIL pages read exactly what they read before. */
export const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const OPIL_WORDS = Object.freeze({
  one: 'student', many: 'students', host: 'your facilitator', teaching: 'is teaching', thing: 'class',
  waiting: null, replayFor: 'your students',
  notAllowed: 'Your account is not in this cohort.', notOpen: 'The room opens when your facilitator starts the class.',
  notConfigured: 'The class room is not set up yet.',
});
export const ROOM_WORDS = Object.freeze({
  one: 'person', many: 'people', host: 'Nelson', teaching: 'is live', thing: 'session',
  waiting: 'Nelson hasn’t started yet — we’ll bring you in the moment he does.', replayFor: 'members',
  notAllowed: 'You need Nelson’s link or an Academy membership.', notOpen: 'Nelson hasn’t started yet.',
  notConfigured: 'The room is not set up yet.',
});

/* the "what's happening now" strip */
export function nowCopy({ facilitator, title, recording, breakout }, words = OPIL_WORDS) {
  if (breakout) return 'Small groups · ' + breakout.name + (breakout.left ? ' · ' + breakout.left + ' left' : '');
  const who = facilitator ? facilitator + ' ' + words.teaching + ': ' + title : capFirst(words.thing) + ' in progress: ' + title;
  return recording ? who + ' · This ' + words.thing + ' is being recorded' : who;
}

/* the question queue: open hands in the order raised; a staged hand is "on deck" first */
export function queueOrder(rows) {
  return (rows || []).filter(r => !r.done_at).slice().sort((a, b) => {
    const sa = a.staged_at ? 0 : 1, sb = b.staged_at ? 0 : 1;
    return sa - sb || String(a.created_at).localeCompare(String(b.created_at));
  });
}
export function queuePosition(rows, uid) {
  const i = queueOrder(rows).findIndex(r => r.user_id === uid);
  return i < 0 ? null : i + 1;
}
export function nextInLine(rows) { return queueOrder(rows)[0] || null; }

/* the sentence under the title on the join screen; words.waiting (the Academy room) replaces
   the two "hasn’t started yet" sentences because that room has no scheduled start time */
export function joinCopy({ live, host, facilitator, joined, startsAt }, words = OPIL_WORDS) {
  const n = Number(joined || 0), people = n === 1 ? '1 ' + words.one + ' joined' : n + ' ' + words.many + ' joined';
  if (host) return live ? 'Your ' + words.thing + ' is running · ' + people : 'This room is yours. Start the ' + words.thing + ' when you’re ready — ' + words.many + ' who have the link are waiting here.';
  if (live) return (facilitator ? facilitator + ' is in the room' : 'The ' + words.thing + ' is running') + ' · ' + people;
  if (words.waiting) return words.waiting;
  return startsAt
    ? capFirst(words.thing) + ' hasn’t started yet. You’re all set — it starts at ' + startsAt + ' and you’ll enter on your own.'
    : capFirst(words.thing) + ' hasn’t started yet. You’re all set — you’ll enter on your own when ' + (facilitator || words.host) + ' starts it.';
}
