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
  let classic = false; try { classic = new URLSearchParams(search || '').get('classic') === '1'; } catch (e) {}
  return !!flag && !classic;
}

/* mic/camera state as a sentence + what a tap does — never just an icon */
export function stateCopy({ audio, video }) {
  return {
    mic: audio ? ['Mic is on', 'People can hear you'] : ['You’re muted', 'Tap to unmute'],
    cam: video ? ['Camera is on', 'You’ll be seen'] : ['Camera is off', 'Tap to turn on'],
  };
}

/* the "what's happening now" strip */
export function nowCopy({ facilitator, title, recording, breakout }) {
  if (breakout) return 'Small groups · ' + breakout.name + (breakout.left ? ' · ' + breakout.left + ' left' : '');
  const who = facilitator ? facilitator + ' is teaching: ' + title : 'Class in progress: ' + title;
  return recording ? who + ' · This class is being recorded' : who;
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

/* the sentence under the title on the join screen */
export function joinCopy({ live, host, facilitator, joined, startsAt }) {
  const n = Number(joined || 0), students = n === 1 ? '1 student joined' : n + ' students joined';
  if (host) return live ? 'Your class is running · ' + students : 'This room is yours. Start the class when you’re ready — students who have the link are waiting here.';
  if (live) return (facilitator ? facilitator + ' is in the room' : 'The class is running') + ' · ' + students;
  return startsAt
    ? 'Class hasn’t started yet. You’re all set — it starts at ' + startsAt + ' and you’ll enter on your own.'
    : 'Class hasn’t started yet. You’re all set — you’ll enter on your own when ' + (facilitator || 'your facilitator') + ' starts it.';
}
