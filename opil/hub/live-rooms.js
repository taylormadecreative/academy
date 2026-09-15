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
  waiting: 'Nelson hasn’t started yet — when he does, press Enter and you’re in.', replayFor: 'members',
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
    ? capFirst(words.thing) + ' hasn’t started yet. You’re all set — it starts at ' + startsAt + ' — press Enter when it does.'
    : capFirst(words.thing) + ' hasn’t started yet. You’re all set — press Enter when ' + (facilitator || words.host) + ' starts it.';
}

/* the Ask button, in one place: the student's big button and the host's Questions-tab button
   read the same words (anyone in the room can get in line, Nelson 9/15) */
export function askLineCopy(pos) {
  return pos ? { b: 'You’re #' + pos + ' in line', s: 'Tap to leave the line' } : { b: 'Ask a question', s: 'Add yourself to the line' };
}
export const queueEmptyCopy = () => 'When anyone presses Ask a question, they appear here in order.';

/* the transcript: RealtimeKit streams a partial line while someone is still talking and a final
   one when they stop; the same final line can arrive twice (the replay on join + the event).
   Keep only finals, once. Returns true when a line was added, so a live panel knows to redraw. */
export function addTranscript(lines, x) {
  if (!x || x.isPartialTranscript || typeof x.transcript !== 'string' || !x.transcript.trim()) return false;
  if (x.id != null && lines.some(y => y.id === x.id)) return false;
  lines.push(x);
  return true;
}
/* the SDK's parseTranscript gives `date` (a Date); `timestamp` is tolerated for safety only */
export const saidAt = (x) => (x && (x.date != null ? x.date : x.timestamp));
export function transcriptText(lines, when) {
  return lines.length
    ? lines.map(x => when(saidAt(x)) + '  ' + (x.name || 'Someone') + ': ' + x.transcript).join('\n')
    : 'No transcript lines were captured on this device. Transcripts only include people whose role is transcribed, and only while this page was open.';
}

/* The "Recording" chip on the host's control row. It used to be set by hand in three places, so
   ordinary paths stranded it lit: leaving a class this page did not start returns early without
   hiding it, and moving the dropdown to another session never touched it (Nelson, 9/15 — the chip
   said Recording with the session off air and no recording row anywhere). Derive it instead:
   syncCtl() calls this on every change, and `recFor` is the one session this page started a
   recording for (null once it stops). */
export function recChipHidden({ running, recFor, sessionNo }) {
  return !(running && recFor != null && recFor === sessionNo);
}

/* captions over the video (Nelson, 9/15: "show the transcriptions as she talks with the option to
   turn it off too"): the last CAPTION_MAX lines, partials included so the words move while someone
   is still talking. A partial and its final share an id, so the final replaces the partial in
   place. A final fades CAPTION_TTL_MS after it landed; a partial stays until its final arrives.
   Pure: returns a new array, never touches the one passed in. x = null just prunes. */
export const CAPTION_TTL_MS = 8000;
export const CAPTION_MAX = 2;
export function takeCaption(caps, x, now) {
  let next = (caps || []).slice();
  if (x && typeof x.transcript === 'string' && x.transcript.trim()) {
    const text = x.transcript.trim(), final = !x.isPartialTranscript;
    const i = x.id != null ? next.findIndex(c => c.id === x.id) : -1;
    if (i >= 0) next[i] = { ...next[i], text, final, at: now };
    else next.push({ id: x.id ?? (x.peerId + ':' + now), name: x.name || 'Someone', text, final, at: now });
  }
  next = next.filter(c => !(c.final && now - c.at > CAPTION_TTL_MS));
  return next.slice(-CAPTION_MAX);
}
