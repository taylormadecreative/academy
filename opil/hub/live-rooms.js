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
