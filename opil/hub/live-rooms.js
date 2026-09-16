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
  if (breakout) return 'Small groups · ' + breakout.name + (breakout.over ? ' · Time’s up — wrap up. ' + (breakout.facilitator || 'Your facilitator') + ' will bring everyone back.' : breakout.left ? ' · ' + breakout.left + ' left' : '');
  const who = facilitator ? facilitator + ' ' + words.teaching + ': ' + title : capFirst(words.thing) + ' in progress: ' + title;
  return recording ? who + ' · This ' + words.thing + ' is being recorded' : who;
}

/* the question queue: open hands in the order raised; a staged hand is "on deck" first.
   A 'help' hand (a small group asking the facilitator to pop in, 0040) is not a question — it never
   enters this line; helpRows() is where it shows. */
export function queueOrder(rows) {
  return (rows || []).filter(r => !r.done_at && r.kind !== 'help').slice().sort((a, b) => {
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
  /* the count is everyone already in the room, the facilitator included — say it as "others", and make an
     empty room an invitation, not a doubt (the first student tonight should not read "0 students joined") */
  if (live) {
    const others = Math.max(0, n - (facilitator ? 1 : 0));
    if (facilitator) return others ? facilitator + ' and ' + others + (others === 1 ? ' other are' : ' others are') + ' in the room.' : facilitator + ' is in the room — come on in.';
    return n ? n + ' in the room so far.' : 'The room is open — come on in.';
  }
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

/* ---------- nobody ends a class by accident (Nelson, 9/15: "i never asked for a rule anywhere to cut off a
   class I am in the middle of talking on … i dont want to be booted out again") ----------
   On 9/15 the host's own socket dropped mid-call; the kit reported roomLeft, and the page treated that
   like the host pressing Leave — which, back then, ended the class for everyone. Three rules now, for
   every room (OPIL, the Academy, HT): Leave only leaves; the one way to end is the explicit End; a drop
   reconnects. The words and the plan live here so the pages and the module agree, and node tests them. */

/* Why the kit says you are out, in one of five words. The kit's LeaveRoomState is kicked | ended | left |
   rejected | connected-meeting | disconnected | failed | stageLeft: 'left' (you pressed Leave), 'kicked' (a
   host removed you), 'ended' (the meeting ended) keep their word; 'connected-meeting' and 'stageLeft' are a
   'switch' — a move to a small group or off a stage, not an exit; anything else ('disconnected', 'failed',
   'rejected', undefined…) is a DROP: the connection died. A drop is never the end of anything. */
export function leftKind(state) {
  if (state === 'left' || state === 'kicked' || state === 'ended') return state;
  if (state === 'connected-meeting' || state === 'stageLeft') return 'switch';
  return 'dropped';
}

/* the reconnect plan: how long to wait before attempt N (0-based), or null when there is no attempt N —
   twice after a drop (2 s, then 4 s more, about 6 s in); never after Leave, a kick, or an ended meeting */
export const REJOIN_DELAYS_MS = Object.freeze([2000, 4000]);
export function rejoinPlan(kind, attempt) {
  if (kind !== 'dropped') return null;
  const n = Number(attempt);
  if (!Number.isInteger(n) || n < 0 || n >= REJOIN_DELAYS_MS.length) return null;
  return REJOIN_DELAYS_MS[n];
}
/* the strip while it happens: plain words, one line */
export function reconnectCopy(attempt) {
  return attempt > 0 ? 'Still reconnecting — one more try…' : 'Reconnecting…';
}

/* the Leave and End words, from the room's own noun (class / session). No name, no vendor. */
export function endCopy(words = OPIL_WORDS) {
  const t = words.thing;
  return Object.freeze({
    leave: 'Leave ' + t + '?',                                                       /* a guest's Leave, as today */
    leaveHost: 'Leave the room? The ' + t + ' keeps running — you can come back.',   /* a host's Leave: leaves only */
    endButton: 'End the ' + t + ' for everyone',                                      /* the one way to end it */
    endAsk: 'End the ' + t + ' for everyone?',
    endAgain: 'Tap again to end it.',
    endHint: 'Closes the room for everyone and stops the recording',
    stillRunning: 'You left — the ' + t + ' is still running.',
    stillRunningHint: 'People are still in the room and the recording is still going. Rejoin, or end the ' + t + ' for everyone.',
    backOn: 'The ' + t + ' is back on — rejoin when you’re ready.',
    rejoin: 'Rejoin →',
  });
}

/* The ended card keeps listening, so nobody who was removed or whose class ended is stranded when a new
   one starts. "Live again" means the room was seen OFF air since the card appeared (a removed person in a
   class that never stopped is not offered the door back until a new class starts) and is live now.
   Pure: prev = { seenOff }, isLiveNow = the poll's answer → { seenOff, again }. */
export function backOn(prev, isLiveNow) {
  const seenOff = !!(prev && prev.seenOff) || isLiveNow === false;
  return { seenOff, again: isLiveNow === true && seenOff };
}

/* When the class is, in the viewer's own clock. Sessions store a date and (since 0039) a start and
   end time as Atlanta wall time — the program is an AUC program and Jamal's invites say ET. A
   student in Dallas reads "5:30 – 6:30 PM CT", one in Atlanta "6:30 – 7:30 PM ET"; the zone is
   always named so nobody guesses. No time on the row → time null (the screen says "starts when
   <facilitator> opens the room" instead of a made-up hour). Pure: zone and now are injectable. */
const PROGRAM_ZONE = 'America/New_York';
const ZONE_WORD = { EDT: 'ET', EST: 'ET', CDT: 'CT', CST: 'CT', MDT: 'MT', MST: 'MT', PDT: 'PT', PST: 'PT' };
function zoneOffsetMin(zone, at) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(at);
  const g = (t) => Number(p.find(x => x.type === t).value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - at.getTime()) / 60000;
}
/* the instant at which a wall-clock date + time happens in the program zone */
export function programInstant(date, hm) {
  const [y, mo, d] = String(date).split('-').map(Number), [h, mi] = String(hm).split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi || 0);
  let inst = guess - zoneOffsetMin(PROGRAM_ZONE, new Date(guess)) * 60000;
  inst = guess - zoneOffsetMin(PROGRAM_ZONE, new Date(inst)) * 60000;   /* once more for a DST edge */
  return new Date(inst);
}
export function classWhen({ date, start, end, zone, now } = {}) {
  if (!date) return { day: null, time: null, startsAt: null, today: false };
  const tz = zone || (Intl.DateTimeFormat().resolvedOptions().timeZone || PROGRAM_ZONE);
  const dayAt = programInstant(date, '12:00');
  const day = dayAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: PROGRAM_ZONE });
  const todayThere = (now || new Date()).toLocaleDateString('en-CA', { timeZone: PROGRAM_ZONE });
  const today = todayThere === String(date).slice(0, 10);
  if (!start) return { day, time: null, startsAt: null, today };
  const t = (inst) => inst.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  const zoneName = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(dayAt).find(x => x.type === 'timeZoneName');
  const z = zoneName ? (ZONE_WORD[zoneName.value] || zoneName.value) : '';
  const s = programInstant(date, start), e = end ? programInstant(date, end) : null;
  const st = t(s), et = e ? t(e) : null;
  /* "6:30 – 7:30 PM" when both share AM/PM; "11:30 AM – 12:30 PM" when they do not */
  const sameHalf = et && st.slice(-2) === et.slice(-2);
  const time = et ? (sameHalf ? st.slice(0, -3) : st) + ' – ' + et + (z ? ' ' + z : '') : st + (z ? ' ' + z : '');
  return { day, time, startsAt: st + (z ? ' ' + z : ''), today };
}

/* No code for approved students (Nelson, 9/16, the first class ever): a signed-out visitor on a room
   link types the email they applied with and is in. What the card says back for each answer from
   ea-opil-pass; every line tells the person what to do next, and the way out is always the code sign-in. */
export function passCopy(code) {
  switch (code) {
    case 'not_on_list': return 'That email isn’t on the approved student list. Try the email you applied with, or email Jamal Ware at jware@aucenter.edu.';
    case 'slow_down': return 'Too many tries from this network. Wait ten minutes, or sign in with a code — campus Wi-Fi counts as one network, so cellular data works too.';
    case 'bad_email': return 'That doesn’t look like an email address. Check for a typo and try again.';
    case 'verify': return 'Your email checked out but the sign-in didn’t stick. Try once more, or sign in with a code.';
    default: return 'Something went wrong on our side. Try again, or sign in with a code.';
  }
}

/* ---- Small groups (the board, spec 2026-09-16-opil-small-groups-board-design.md) ---- */
/* open 'help' hands: a small group asking the facilitator to pop in; note = that room's meeting id */
export function helpRows(rows) { return (rows || []).filter(r => !r.done_at && r.kind === 'help'); }

/* deal people round-robin into n rooms ("Room 1"…); n is clamped to 1–8; rooms may be empty */
export function roomsEvenly(people, n) {
  const k = Math.max(1, Math.min(8, Number(n) || 2));
  const rooms = Array.from({ length: k }, (_, i) => ({ title: 'Room ' + (i + 1), ids: [] }));
  (people || []).forEach((p, i) => rooms[i % k].ids.push(p.id));
  return rooms;
}

/* one room per team, titled with the team's name (A–Z); people with no team share an "Open room" at
   the end. Only rooms with someone in them. teamOf(person) → team name or null. */
export function roomsByTeam(people, teamOf) {
  const byTeam = new Map(); const loose = [];
  (people || []).forEach(p => { const t = teamOf ? teamOf(p) : null; if (t) { if (!byTeam.has(t)) byTeam.set(t, []); byTeam.get(t).push(p.id); } else loose.push(p.id); });
  const rooms = [...byTeam.keys()].sort((a, b) => a.localeCompare(b)).map(t => ({ title: t, ids: byTeam.get(t) }));
  if (loose.length) rooms.push({ title: 'Open room', ids: loose });
  return rooms;
}

/* the clock: mm:ss left, how far along, when it ends (viewer's clock). null when no timer is set. */
export function timerCopy({ endsAt, minutes, now, zone } = {}) {
  if (!endsAt) return null;
  const at = now == null ? Date.now() : now;
  const total = Math.max(1, (Number(minutes) || 0) * 60000);
  const remaining = Math.max(0, endsAt - at);
  const s = Math.ceil(remaining / 1000);
  const clock = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const over = remaining === 0;
  const opts = { hour: 'numeric', minute: '2-digit' }; if (zone) opts.timeZone = zone;
  return {
    clock, over,
    pct: Math.min(1, Math.max(0, 1 - remaining / total)),
    session: (Number(minutes) || 0) + ' minutes on the clock',
    ends: 'Ends at ' + new Date(endsAt).toLocaleTimeString('en-US', opts),
    left: over ? 'Time’s up' : clock,
  };
}

/* a room's dot and word: Needs help beats Working beats Empty */
export function roomStatus({ count, help }) {
  if (help) return { word: 'Needs help', tone: 'help' };
  return count ? { word: 'Working', tone: 'ok' } : { word: 'Empty', tone: 'empty' };
}

/* a note from the host is for me when it names my room or every room */
export function noteIsForMe(payload, myRoomId) {
  return !!(payload && payload.type === 'note' && typeof payload.text === 'string' && payload.text.trim() && (payload.room === 'all' || (myRoomId && payload.room === myRoomId)));
}

/* the student's help button in a small group: before and after asking */
export function helpCopy(asked, facilitator) {
  const who = facilitator || 'Your facilitator';
  return asked ? { b: 'Help is on the way', s: who + ' will pop in · tap to cancel' } : { b: 'Ask for help', s: who + ' will pop in' };
}
