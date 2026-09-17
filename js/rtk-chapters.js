/* A replay that's a lesson — class plugin (spec 2026-09-16-class-features-design.md §2).
   In the room, on the HOST's page only: the class's timeline goes to ea_class_events as it happens
   (someone on stage, a file shown, small groups open/closed, a poll, the whiteboard), and every final
   transcript line is saved through `ea_class_transcript_add` in 20 s batches, deduped by the kit's
   line id. The room tells the plugin through ctx.on('stage' | 'file' | 'groups' | 'poll' | 'board')
   or by calling logStage / logFile / logGroups / logPoll / logBoard on the plugin the host returns;
   transcript lines arrive as ctx.on('transcript', line). Polls are watched on the meeting itself.
   Nothing is drawn in the room. The replay page (/opil/hub/replay/) imports the pure helpers below:
   chapter offsets against the replay's start, the clock, the transcript search, the copy.
   Import-safe in Node (no document/window at import). */
export const FLUSH_MS = 20000;
export const BATCH_MAX = 400;
export const QUEUE_MAX = 5000;
export const STAGE_DEDUPE_MS = 5000;
export const STREAM_HOST = 'customer-nimm2h959enrq4x1.cloudflarestream.com';
export const STREAM_SDK = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
export const STREAM_SDK_WAIT_MS = 8000;   /* how long the replay page waits for the player SDK before going on without it */

/* ---------- pure: the timeline ---------- */
const toMs = (v) => { if (v == null) return NaN; if (v instanceof Date) return v.getTime(); if (typeof v === 'number') return v; const t = Date.parse(v); return t; };
const clean = (s, n = 200) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/* one row of the timeline, said plainly */
export function chapterLabel(ev) {
  if (!ev) return '';
  const d = ev.data || {};
  const label = clean(ev.label);
  switch (ev.kind) {
    case 'stage': return label || ((clean(d.name) || 'Someone') + ' on stage');
    case 'file': return label || ('Showed ' + (clean(d.title) || 'a file'));
    case 'groups_start': return 'Small groups';
    case 'groups_end': return 'Back together';
    case 'poll': return label || ('Poll' + (clean(d.question) ? ': ' + clean(d.question) : ''));
    case 'board': return label || 'Whiteboard';
    default: return label || clean(ev.kind) || 'Something happened';
  }
}
/* seconds → "0:07", "12:03", "1:02:15" */
export function fmtClock(s) {
  let n = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(n / 3600); n -= h * 3600;
  const m = Math.floor(n / 60), sec = n - m * 60;
  const two = (x) => String(x).padStart(2, '0');
  return h ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec);
}
/* the chapters: every event as an offset from the replay's start (the replay row's created_at — the
   recording was asked for then, so a chapter lands within a few seconds of the moment). Events from
   more than a minute before the start belong to no replay; after the end (when we know it) neither. */
export function chapterOffsets(events, startedAt, { duration } = {}) {
  const t0 = toMs(startedAt); if (!(t0 > 0)) return [];
  const out = [];
  (events || []).forEach((ev) => {
    const at = toMs(ev && ev.at); if (!(at > 0)) return;
    let off = Math.round((at - t0) / 1000);
    if (off < -60) return;
    if (off < 0) off = 0;
    if (Number(duration) > 0 && off > Number(duration) + 60) return;
    out.push({ id: ev.id, kind: ev.kind, at: ev.at, offset: off, clock: fmtClock(off), label: chapterLabel(ev) });
  });
  return out.sort((a, b) => a.offset - b.offset || String(a.at).localeCompare(String(b.at)));
}
/* how long the replay is, the way a person says it: "48 min", "1 hr 5 min" */
export function durationWord(s) {
  const m = Math.round((Number(s) || 0) / 60); if (m <= 0) return '';
  const h = Math.floor(m / 60), r = m - h * 60;
  return h ? h + (h === 1 ? ' hr' : ' hrs') + (r ? ' ' + r + ' min' : '') : m + ' min';
}
/* which chapter is playing at second t: the last one that started at or before t (index, or -1) */
export function chapterAt(chapters, t) {
  let i = -1;
  (chapters || []).forEach((c, k) => { if (c.offset <= t) i = k; });
  return i;
}

/* ---------- pure: the transcript ---------- */
/* a kit line → the row the RPC saves; null for partials, blanks, or lines without an id */
export function transcriptLine(x, now) {
  if (!x || x.isPartialTranscript || typeof x.transcript !== 'string') return null;
  const text = clean(x.transcript, 4000); if (!text) return null;
  const id = x.id != null ? String(x.id) : ''; if (!id) return null;
  const at = toMs(x.date != null ? x.date : x.timestamp);
  return {
    id: id.slice(0, 200),
    at: new Date(at > 0 ? at : (now || Date.now())).toISOString(),
    speaker_id: x.customParticipantId || x.userId || x.peerId ? String(x.customParticipantId || x.userId || x.peerId).slice(0, 120) : null,
    speaker_name: clean(x.name, 120) || null,
    text,
  };
}
/* saved rows → the lines the page shows, each with its offset in the replay */
export function transcriptOffsets(rows, startedAt) {
  const t0 = toMs(startedAt);
  return (rows || []).map((r) => {
    const at = toMs(r.at);
    const off = t0 > 0 && at > 0 ? Math.max(0, Math.round((at - t0) / 1000)) : null;
    return { id: r.id, at: r.at, offset: off, clock: off == null ? '' : fmtClock(off), speaker: clean(r.speaker_name, 120) || 'Someone', text: String(r.text || '') };
  }).sort((a, b) => toMs(a.at) - toMs(b.at));
}
/* the lines that say it: a case-insensitive match on the words or the speaker; an empty search is every line */
export function transcriptSearch(lines, q) {
  const needle = clean(q, 100).toLowerCase();
  const all = (lines || []).slice();
  if (!needle) return all;
  return all.filter((l) => String(l.text || l.transcript || '').toLowerCase().includes(needle) || String(l.speaker || l.speaker_name || l.name || '').toLowerCase().includes(needle));
}
export function searchCopy(n, q, total) {
  const needle = clean(q, 100);
  if (!needle) return total ? total + (total === 1 ? ' line' : ' lines') : 'No transcript lines were saved for this class.';
  if (!n) return 'Nothing in the transcript says “' + needle + '”.';
  return n + (n === 1 ? ' line mentions “' : ' lines mention “') + needle + '” — tap one to jump there.';
}
/* the words of a line cut around the search, for a highlight: [{text, hit}] — the page escapes each piece itself,
   so a search for “<agent>” or “&” finds what the count found instead of chewing the escaped entities */
export function markText(text, q) {
  const s = String(text == null ? '' : text); const needle = clean(q, 100);
  if (!needle) return s ? [{ text: s, hit: false }] : [];
  const rx = new RegExp('(' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return s.split(rx).map((x, i) => ({ text: x, hit: i % 2 === 1 })).filter((x) => x.text);
}
/* why the transcript pane shows no lines: '' when there are lines to show */
export function transcriptGateCopy({ open, lines, failed }) {
  if (!open) return 'The transcript shows here with the replay once the program team publishes it.';
  if (failed) return 'The transcript could not be loaded right now. Reload the page to try again.';
  if (!lines) return 'No transcript lines were saved for this class. Lines are saved while the host’s page is open in the room.';
  return '';
}
/* the transcript as a text file */
export function transcriptText(lines, title) {
  const body = (lines || []).map((l) => (l.clock ? l.clock + '  ' : '') + l.speaker + ': ' + l.text).join('\n');
  return (title ? title + '\n\n' : '') + (body || 'No transcript lines were saved for this class.') + '\n';
}

/* every row of a table, a page at a time: the database hands back at most 1,000 rows per request
   (PostgREST's cap), so a long class — ~1,500 lines in two hours — needs more than one. `fetchPage(from, to)`
   answers { data, error } for that inclusive range; the loop stops on an error, an empty page, or a short one. */
export const PAGE_ROWS = 1000;
export async function loadAllRows(fetchPage, pageSize = PAGE_ROWS, maxRows = 20000) {
  const rows = []; let from = 0, error = null;
  for (;;) {
    let r; try { r = await fetchPage(from, from + pageSize - 1); } catch (e) { r = { data: null, error: e }; }
    if (r && r.error) { error = r.error; break; }
    const page = (r && r.data) || [];
    for (const x of page) rows.push(x);
    if (page.length < pageSize || rows.length >= maxRows) break;
    from += pageSize;
  }
  return { rows, error };
}

/* ---------- pure: the summary ---------- */
/* the model's paragraph or bullets → clean lines (at most five on the page) */
export function summaryLines(text, max = 5) {
  return String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, max);
}
/* assignments as stored (strings, or {text, who, due}) → one sentence each */
export function assignmentList(a) {
  const src = Array.isArray(a) ? a : typeof a === 'string' ? a.split(/\r?\n/) : [];
  return src.map((x) => {
    if (x == null) return '';
    if (typeof x === 'string') return clean(x, 400);
    const t = clean(x.text || x.title || x.task, 400); if (!t) return '';
    const who = clean(x.who || x.owner, 80), due = clean(x.due || x.when, 80);
    return t + (who ? ' — ' + who : '') + (due ? ' · due ' + due : '');
  }).filter(Boolean);
}
/* the server's word → a sentence with a next step */
export function summaryErrorCopy(code) {
  switch (String(code || '')) {
    case 'no_key': return 'The summary isn’t set up yet — a summary key has to be added on the server. Nelson can do that in a minute.';
    case 'nothing_to_summarize': return 'There’s nothing to summarize yet — no transcript lines or chapters were saved for this class.';
    case 'not_allowed': return 'Only the coordinator or this session’s facilitator can make the summary.';
    case 'sign_in': return 'Your sign-in ran out. Sign in again, then press Make summary.';
    case 'bad_key': return 'This page doesn’t know which class to summarize. Open it from the session’s Replay link.';
    case 'model_failed': return 'The summary didn’t come back this time. Try again in a minute.';
    default: return 'Could not make the summary. Try again in a minute.';
  }
}
/* the summary card's state, in words */
export function summaryStateCopy({ row, staff, busy }) {
  if (busy) return 'Writing the summary… this takes about half a minute.';
  if (row && row.summary) return '';
  return staff ? 'No summary yet. Press Make summary and it reads the transcript and the chapters for you.' : 'The summary is on its way — the program team makes it after class.';
}

/* ---------- pure: the replay row and the player ---------- */
/* the published replay, else (for the program team) the newest ready one */
export function pickReplay(rows) {
  const ready = (rows || []).filter((r) => r && r.status === 'ready' && (r.watch_url || r.stream_uid));
  const pub = ready.filter((r) => r.published).sort((a, b) => toMs(b.created_at) - toMs(a.created_at));
  if (pub.length) return pub[0];
  return ready.sort((a, b) => toMs(b.created_at) - toMs(a.created_at))[0] || null;
}
/* the Stream player URL from the row: the watch link with /watch → /iframe, else the stream id on the Academy's host */
export function replayPlayerSrc(replay) {
  if (!replay) return null;
  const m = /^https:\/\/([a-z0-9.-]+cloudflarestream\.com)\/([A-Za-z0-9_-]+)\/watch\/?$/i.exec(String(replay.watch_url || ''));
  if (m) return 'https://' + m[1] + '/' + m[2] + '/iframe';
  if (replay.stream_uid && /^[A-Za-z0-9_-]+$/.test(replay.stream_uid)) return 'https://' + STREAM_HOST + '/' + replay.stream_uid + '/iframe';
  return null;
}
/* what the page says when there is no replay to show */
export function replayMissingCopy({ session, staff, replays }) {
  const any = (replays || []).length;
  if (!session) return 'That session isn’t on the calendar. Go back to the hub and pick one from the list.';
  if (staff && any) return 'The replay for this class is still being prepared. It shows here as soon as it is ready — usually a few minutes after class.';
  return staff ? 'Nothing was recorded for this class yet. When a class is recorded, its replay lands here after it ends.' : 'The replay for this class isn’t published yet. It shows here once the program team reviews it.';
}

/* ---------- pure: whose poll is it ---------- */
/* Two host pages (the coordinator + the facilitator is the normal room) both hear pollsUpdate for the same new
   poll; only the page that created it should log the chapter. true = mine, false = someone else's, null = the
   kit did not say who made it (then the page logs it and the database's once-a-minute index catches a twin). */
export function pollIsMine(poll, self, uid) {
  if (!poll || typeof poll !== 'object') return null;
  const creators = ['createdBy', 'createdByUserId', 'createdByPeerId', 'creatorId', 'creator', 'userId', 'peerId']
    .map((k) => poll[k]).filter((v) => v != null && v !== '').map((v) => String(typeof v === 'object' ? (v.id || v.userId || v.name || '') : v));
  if (!creators.length) return null;
  const me = [uid, self && self.id, self && self.userId, self && self.customParticipantId, self && self.name]
    .filter((v) => v != null && v !== '').map(String);
  return creators.some((c) => me.includes(c));
}

/* ---------- the plugin (the host's page) ---------- */
let cssDone = false;
/* the page's stylesheet, once, riding this module's own cache stamp */
export function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  try {
    const href = '/css/rtk-chapters.css' + new URL(import.meta.url).search;
    if (document.querySelector('link[href^="/css/rtk-chapters.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  } catch (e) {}
}

export function create(ctx) {
  const seen = new Set();
  let queue = [], timer = null, stopped = false, lastStage = { name: null, at: 0 }, groupsOpen = false;
  const pollCounts = (typeof WeakMap === 'function') ? new WeakMap() : null;
  const now = () => (ctx.now ? ctx.now() : Date.now());
  const log = async (kind, label, data) => {
    if (!ctx.host || stopped) return false;
    try { await ctx.events.log(kind, label, data || null); return true; }
    catch (e) { console.warn('[chapters] log', kind, e); return false; }
  };
  /* the public timeline API — the room calls these, or emits the matching hook */
  const api = {
    logStage(name) {
      const n = clean(name, 120) || 'Someone'; const t = now();
      if (lastStage.name === n && t - lastStage.at < STAGE_DEDUPE_MS) return Promise.resolve(false);   /* the same tap twice */
      lastStage = { name: n, at: t };
      return log('stage', n + ' on stage', { name: n });
    },
    logFile(title) { const t = clean(title, 160) || 'a file'; return log('file', 'Showed ' + t, { title: t }); },
    logGroups(open) {
      open = !!open; if (open === groupsOpen) return Promise.resolve(false);   /* the clock repeats every 15 s; the change is the chapter */
      groupsOpen = open;
      return log(open ? 'groups_start' : 'groups_end', open ? 'Small groups' : 'Back together');
    },
    logPoll(q) { const question = clean(q, 200); return log('poll', 'Poll' + (question ? ': ' + question : ''), question ? { question } : null); },
    logBoard(label) { return log('board', clean(label, 120) || 'Whiteboard'); },
  };
  /* ---- the transcript: final lines, once, saved in batches ---- */
  function take(x) {
    const row = transcriptLine(x, now()); if (!row || seen.has(row.id)) return false;
    seen.add(row.id); queue.push(row);
    if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
    return true;
  }
  async function flush() {
    if (!ctx.host || !queue.length) return 0;
    const batch = queue.splice(0, BATCH_MAX);
    try {
      const { data, error } = await ctx.sb.rpc('ea_class_transcript_add', { p_key: ctx.roomKey, p_lines: batch });
      if (error) throw error;
      if (data && data.ok === false) { console.warn('[chapters] transcript refused:', data.why); return 0; }   /* not the host any more: nothing to retry */
      return (data && data.added) || 0;
    } catch (e) {
      console.warn('[chapters] transcript save', e && e.message ? e.message : e);
      queue = batch.concat(queue);   /* the network blinked: the same lines go next time */
      if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
      return 0;
    }
  }
  /* ---- polls: the meeting says when one is added; the newest one's question is the chapter ---- */
  function watchPolls(mm) {
    if (!ctx.host || !mm || !pollCounts) return;
    try {
      const items = () => (mm.polls && mm.polls.items) || [];
      if (pollCounts.has(mm)) return;
      pollCounts.set(mm, items().length);
      mm.polls.on('pollsUpdate', () => {
        const it = items(), before = pollCounts.get(mm) || 0;
        if (it.length > before) {
          const p = it[it.length - 1];
          const mine = pollIsMine(p, mm.self, ctx.uid);
          if (mine !== false) api.logPoll(p && (p.question || p.title));   /* the page that made it logs it; unknown maker → log */
        }
        pollCounts.set(mm, it.length);
      });
    } catch (e) {}
  }
  const onHide = () => { try { if (document.visibilityState === 'hidden') flush(); } catch (e) {} };
  const onPageHide = () => { flush(); };
  return Object.assign({
    start() {
      try {
        ensureCss();
        if (!ctx.host) return;   /* a student's page logs nothing and saves nothing — one timeline per class */
        ctx.on('transcript', take);
        ctx.on('stage', (name) => api.logStage(name));
        ctx.on('file', (title) => api.logFile(title));
        ctx.on('groups', (open) => api.logGroups(open));
        ctx.on('poll', (q) => api.logPoll(q));
        ctx.on('board', (label) => api.logBoard(label));
        ctx.on('left', () => flush());
        ctx.on('ended', () => flush());
        timer = setInterval(flush, FLUSH_MS);
        try { document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', onPageHide); } catch (e) {}
        try { watchPolls(ctx.getMeeting && ctx.getMeeting()); } catch (e) {}
      } catch (e) { console.warn('[chapters] start', e); }
    },
    stop() {
      clearInterval(timer); timer = null;
      try { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onPageHide); } catch (e) {}
      const last = flush();   /* the last lines go before the plugin is told to stop, so nothing said in the final seconds is lost */
      stopped = true;
      return last;
    },
    onBind(mm) { watchPolls(mm); },
    /* for tests and the curious: what is waiting to be saved */
    flush, take, get pending() { return queue.length; },
  }, api);
}
