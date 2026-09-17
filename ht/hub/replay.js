/* ht/hub/replay.js — the HT replay page: the last session of HT's room with clickable chapters, the summary,
   what was assigned, the files shown, and a searchable transcript. A port of /opil/hub/replay/ onto the HT
   frame reading the same ea_class_* tables under the room's class key 'room:<id>'
   (spec 2026-09-17-ht-hub-demo-ready-design.md §2.2). Hosts see the newest ready replay (a draft until it
   is published); everyone else the published one — and only if they were in the room: ea_room_state hands
   recording_url to hosts and past joiners alone, and 0044's transcript rule says the same for the words. */
const SLUG = 'ht';
const V = new URL(import.meta.url).search;   /* our own ?v= — the HT build stamp from ht/build.mjs */

/* the lesson card's stylesheet first, so nothing paints unstyled */
await new Promise((res) => {
  if (document.querySelector('link[href^="/css/rtk-chapters.css"]')) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/rtk-chapters.css' + V;
  l.onload = res; l.onerror = res; document.head.appendChild(l);
});
const [{ chapterOffsets, chapterAt, durationWord, transcriptOffsets, transcriptSearch, searchCopy, transcriptText, transcriptGateCopy, markText, loadAllRows, summaryLines, assignmentList, summaryErrorCopy, summaryStateCopy, pickReplay, replayPlayerSrc, STREAM_SDK, STREAM_SDK_WAIT_MS }, { iframeUrl }, { createClient }] = await Promise.all([
  import('/js/rtk-chapters.js' + V),
  import('/js/room-page.js' + V),
  import('https://esm.sh/@supabase/supabase-js@2'),
]);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* the shared lesson helpers speak OPIL ("the program team", "this class"); HT's room has hosts and sessions */
const roomWords = (t) => String(t == null ? '' : t)
  .replace(/the program team makes it after class/gi, 'your host makes it after the session')
  .replace(/Only the coordinator or this session[’']s facilitator[^.]*\./g, 'Only a host can make the summary.')
  .replace(/Nelson can do that in a minute\.?/g, 'The summary isn’t set up on the server yet.')
  .replace(/the program team/gi, 'a host').replace(/this class/g, 'this session').replace(/which class/g, 'which session').replace(/after class/g, 'after the session');
const root = document.getElementById('htReplay');
if (!root || !window.BM_CONFIG) throw new Error('replay block or config missing');
const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
const user = (await sb.auth.getSession()).data.session?.user || null;
const { data: state, error: stateErr } = await sb.rpc('ea_room_state', { p_key: null, p_slug: SLUG });

root.innerHTML = `<div class="rp-grid">
  <div>
    <div class="rp-player" id="player"><div class="rp-idle" id="idle"><b>Finding the replay&hellip;</b><span>One moment.</span></div></div>
    <p class="rp-now" id="now"></p>
    <p class="rp-fine" id="msg" role="status" hidden></p>
  </div>
  <div class="hc" id="lesson">
    <div class="rp-tabs" role="tablist">
      <button type="button" class="rp-tab on" data-tab="chapters" role="tab">Chapters <em id="nChap"></em></button>
      <button type="button" class="rp-tab" data-tab="summary" role="tab">Summary</button>
      <button type="button" class="rp-tab" data-tab="assigned" role="tab">Assigned <em id="nAsg"></em></button>
      <button type="button" class="rp-tab" data-tab="files" role="tab">Files <em id="nFiles"></em></button>
      <button type="button" class="rp-tab" data-tab="transcript" role="tab">Transcript <em id="nLines"></em></button>
    </div>
    <div class="rp-pane" data-pane="chapters"><div class="rp-empty">Loading the chapters&hellip;</div></div>
    <div class="rp-pane" data-pane="summary" hidden><div class="rp-empty">Loading the summary&hellip;</div></div>
    <div class="rp-pane" data-pane="assigned" hidden><div class="rp-empty">Loading&hellip;</div></div>
    <div class="rp-pane" data-pane="files" hidden><div class="rp-empty">Loading the files&hellip;</div></div>
    <div class="rp-pane" data-pane="transcript" hidden><div class="rp-empty">Loading the transcript&hellip;</div></div>
  </div>
</div>`;
const q = (s) => root.querySelector(s);
const $ = (id) => document.getElementById(id);
const pane = (n) => q(`.rp-pane[data-pane="${n}"]`);
/* a passing message under the player — its own line, gone after a few seconds */
const toast = (m, ms = 6000) => { const e = $('msg'); e.textContent = m; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, ms); };
const TABS = [...root.querySelectorAll('.rp-tab')];
TABS.forEach((t) => { t.id = 'rpTab-' + t.dataset.tab; t.setAttribute('aria-controls', 'rpPane-' + t.dataset.tab); t.addEventListener('click', () => showPane(t.dataset.tab)); });
root.querySelectorAll('.rp-pane').forEach((p) => { p.id = 'rpPane-' + p.dataset.pane; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'rpTab-' + p.dataset.pane); });
/* arrow keys move between the tabs, as a tab list should */
root.querySelector('.rp-tabs').addEventListener('keydown', (e) => {
  if (!/^Arrow(Left|Right)$/.test(e.key)) return;
  const i = TABS.findIndex((t) => t.classList.contains('on')); const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
  e.preventDefault(); showPane(TABS[n].dataset.tab); TABS[n].focus();
});
function showPane(name) {
  TABS.forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  root.querySelectorAll('.rp-pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
}
showPane('chapters');
const idle = (title, text, extra) => { $('idle').innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span>` + (extra || ''); };
const emptyPanes = (text) => root.querySelectorAll('.rp-pane').forEach((p) => { p.innerHTML = `<div class="rp-empty">${esc(text)}</div>`; });

/* the page: a gate that stops here returns quietly — the card it painted is the page (a throw would reject the
   module import, and ht.js would log it as a failure to load) */
async function page() {
/* ---- who may see what ---- */
if (!state || !state.id) {
  idle('The replay page could not load', stateErr && stateErr.message ? stateErr.message : 'Reload to try again.');
  emptyPanes('Nothing to show until the page loads.');
  return;
}
if (!user) {
  idle('Sign in to watch the replay', 'Use the email you joined with. We send a six-digit code, no password.',
    `<a class="btn ht-gold" style="margin-top:14px" href="/login/?next=${encodeURIComponent('/ht/hub/replay/')}">Sign in</a>`);
  emptyPanes('Sign in to see the chapters, the summary, the files and the transcript.');
  return;
}
const key = 'room:' + state.id, staff = !!state.is_host;
let replay = null;
if (staff) {
  /* a host sees the newest READY replay — a draft until it is published (spec §2.2) */
  const { data, error } = await sb.from('ea_room_replays').select('id, status, stream_uid, watch_url, duration_s, published, created_at').eq('room_id', state.id).order('created_at', { ascending: false });
  if (error) console.warn('[replay] replays', error.message);
  replay = (data || []).filter((r) => r && r.status === 'ready' && (r.watch_url || r.stream_uid))[0] || null;
} else if (state.recording_url) {
  /* a past joiner: the published recording, through the state (the replays table is hosts-only); the state also
     carries that replay's start and length (0054), the window the chapters and lines are read from */
  replay = { watch_url: state.recording_url, published: true, created_at: state.replay_started_at || null, duration_s: state.replay_duration_s || null };
}
if (!replay) {
  idle(staff ? 'No replay yet' : 'Nothing to watch here yet',
    staff ? 'A session records itself. Its replay lands on the Live space to review and publish, and here with its chapters.'
          : 'Replays show here for the people who were in the room, once the host publishes the session.');
  if (!staff) { emptyPanes('The chapters, the summary, the files and the transcript arrive with the published replay.'); return; }
}
/* the session's window: a standing room files every session under ONE key for the life of the room, so only the
   rows inside this replay's span are this session's (a minute before the start; a quarter hour after the end) */
const WIN_BEFORE = 60e3, WIN_AFTER = 15 * 60e3;
const winStart = replay && replay.created_at ? Date.parse(replay.created_at) : NaN;
const winEnd = Number.isFinite(winStart) && Number(replay.duration_s) > 0 ? winStart + Number(replay.duration_s) * 1000 + WIN_AFTER : Infinity;
const inWindow = (at) => { if (!Number.isFinite(winStart)) return true; const t = Date.parse(at || ''); return t >= winStart - WIN_BEFORE && t <= winEnd; };
const sinceIso = Number.isFinite(winStart) ? new Date(winStart - WIN_BEFORE).toISOString() : null;

/* ---- the lesson rows, loading while the player sets up ----
   The offsets count from the replay's start. A host's replay row carries created_at; a guest's came through the
   state with no clock, so the guest's chapters line up from the first event or transcript line of the session
   (a few seconds after the recording began — close enough to tap into). */
const since = (qb) => (sinceIso ? qb.gte('at', sinceIso) : qb);   /* the database drops what came before the window; the page trims the after */
const lessonLoad = Promise.all([
  since(sb.from('ea_class_events').select('id, at, kind, label, data').eq('room_key', key)).order('at').order('id').limit(1000),
  sb.from('ea_class_summaries').select('summary, assignments, chapters, updated_at').eq('room_key', key).maybeSingle(),
  loadAllRows((from, to) => since(sb.from('ea_class_transcripts').select('id, at, speaker_name, text').eq('room_key', key)).order('at').order('id').range(from, to)),
  sb.from('ea_opil_materials').select('id, title, kind, link_url, file_path, created_at').eq('room_key', key).order('created_at'),
]);

/* ---- the player: Cloudflare Stream in an iframe; the embed SDK seeks it ---- */
let player = null, iframe = null, seekReady = false;
const playerSrc = replay ? (replayPlayerSrc(replay) || iframeUrl(replay.watch_url)) : null;
if (playerSrc) {
  iframe = document.createElement('iframe');
  iframe.src = playerSrc + '?preload=metadata';
  iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;';
  iframe.allowFullscreen = true;
  iframe.title = 'Replay of the last session';
  $('player').innerHTML = ''; $('player').appendChild(iframe);
  $('now').innerHTML = `<b>${esc(state.title || 'HT Live')}</b>${replay.duration_s ? ' · ' + esc(durationWord(replay.duration_s)) + ' long' : ''}${replay.published ? '' : ' <span class="rp-chip draft">Draft — only hosts see this until it is published</span>'}`;
  try {
    /* the SDK gets a few seconds; past that the page goes on without it and a tap reloads the player at that moment instead */
    await new Promise((resolve, reject) => {
      const sc = document.createElement('script'); sc.src = STREAM_SDK; sc.onload = resolve; sc.onerror = () => reject(new Error('sdk failed to load'));
      setTimeout(() => reject(new Error('sdk took too long')), STREAM_SDK_WAIT_MS);
      document.head.appendChild(sc);
    });
    player = window.Stream(iframe); seekReady = true;
    player.addEventListener('timeupdate', () => { try { markPlaying(player.currentTime || 0); } catch (e) {} });
  } catch (e) { console.warn('[replay] player sdk', e); }
}
/* jump to a second: the SDK when it loaded; else the iframe reloads at that time */
function seek(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  if (!iframe) return;
  if (seekReady && player) { try { player.currentTime = s; const p = player.play(); if (p && p.catch) p.catch(() => {}); return; } catch (e) {} }
  iframe.src = playerSrc + '?startTime=' + s + 's&autoplay=true';
}

/* ---- the lesson: chapters, summary, what was assigned, files, transcript ---- */
const [ev, sm, tr, mt] = await lessonLoad;
[ev, sm, tr, mt].forEach((r) => { if (r.error) console.warn('[replay] load', r.error.message || r.error); });
let summaryRow = sm.data || null;
const events = (ev.data || []).filter((e) => inWindow(e.at)), transcriptRows = (tr.rows || []).filter((r) => inWindow(r.at));
/* the files shown in this session — a file added in an earlier session belongs to that session's page */
const materials = (mt.data || []).filter((m) => inWindow(m.created_at));
/* the clock the offsets count from: the replay's start when we know it, else the first event or line of this class */
const firstAt = [events[0] && events[0].at, transcriptRows[0] && transcriptRows[0].at].filter(Boolean).sort()[0] || null;
const started = (replay && replay.created_at) || firstAt;

/* chapters */
const chapters = chapterOffsets(events, started, { duration: replay && replay.duration_s });
$('nChap').textContent = chapters.length || '';
function paintChapters() {
  const p = pane('chapters');
  if (!chapters.length) {
    p.innerHTML = `<div class="rp-empty">${started ? 'No chapters were logged for this session — the timeline fills in when someone is brought on stage, a file is shown, the whiteboard opens, small groups open, or a poll runs.' : 'The chapters line up once a replay is ready.'}</div>`;
    return;
  }
  p.innerHTML = chapters.map((c, i) => `<button type="button" class="rp-chapter" data-i="${i}" data-off="${c.offset}"><span class="rp-clock">${esc(c.clock)}</span><span><b>${esc(c.label)}</b></span></button>`).join('');
  p.querySelectorAll('.rp-chapter').forEach((b) => b.addEventListener('click', () => { seek(b.dataset.off); p.querySelectorAll('.rp-chapter').forEach((x) => x.classList.toggle('on', x === b)); }));
}
function markPlaying(t) {
  const i = chapterAt(chapters, t);
  pane('chapters').querySelectorAll('.rp-chapter').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
}
paintChapters();

/* summary + assigned (a host may make it; ea-class-summary answers room keys) */
let busy = false;
/* Publish on the room card asked for the summary moments ago (room.js): say so, and look again in a little while */
let pendingSince = 0; try { pendingSince = Number(sessionStorage.getItem('ht-summary-pending')) || 0; } catch (e) {}
const summaryPending = () => staff && !summaryRow && pendingSince && Date.now() - pendingSince < 3 * 60e3;
if (summaryPending()) setTimeout(async () => { try { const { data } = await sb.from('ea_class_summaries').select('summary, assignments, chapters, updated_at').eq('room_key', key).maybeSingle(); if (data) { summaryRow = data; pendingSince = 0; paintSummary(); } } catch (e) {} }, 45e3);
function paintSummary() {
  const p = pane('summary'), a = pane('assigned');
  const lines = summaryRow ? summaryLines(summaryRow.summary) : [];
  const todo = summaryRow ? assignmentList(summaryRow.assignments) : [];
  $('nAsg').textContent = todo.length || '';
  const madeOn = summaryRow && summaryRow.updated_at ? new Date(summaryRow.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const st = summaryPending() ? 'Writing the summary — about half a minute. It shows here on its own; the button below makes it again.' : roomWords(summaryStateCopy({ row: summaryRow, staff, busy }));
  p.innerHTML = (lines.length
      ? `<ul class="rp-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="rp-fine">Written from the transcript and the chapters${madeOn ? ' on ' + esc(madeOn) : ''}. Read it as notes, not as the record.</p>`
      : `<div class="rp-empty">${esc(st)}</div>`)
    + (staff ? `<button type="button" class="rp-make${lines.length ? ' quiet' : ''}" id="make"${busy ? ' disabled' : ''}>${busy ? 'Writing the summary…' : (lines.length ? 'Make it again' : 'Make summary')}<span>${busy ? 'About half a minute.' : 'From the transcript and the chapters.'}</span></button><p class="rp-fine" id="mkErr" hidden></p>` : '');
  a.innerHTML = todo.length ? `<ul class="rp-lines rp-todo">${todo.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
    : `<div class="rp-empty">${summaryRow ? 'Nothing was assigned in this session.' : 'What was assigned shows up here with the summary.'}</div>`;
  const mk = $('make'); if (mk) mk.addEventListener('click', makeSummary);
}
async function makeSummary() {
  if (busy) return; busy = true; paintSummary();
  try {
    const tok = (await sb.auth.getSession()).data.session?.access_token || '';
    const r = await fetch(window.BM_CONFIG.FUNCTIONS_BASE + '/ea-class-summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ room_key: key }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) { console.warn('[replay] summary', r.status, d); throw new Error(roomWords(summaryErrorCopy(d.error || (r.status === 401 ? 'sign_in' : '')))); }
    summaryRow = { summary: d.summary, assignments: d.assignments, chapters: d.chapters, updated_at: new Date().toISOString() };
    busy = false; paintSummary(); showPane('summary');
  } catch (e) {
    busy = false; paintSummary();
    const err = $('mkErr'); if (err) { err.textContent = e.message || roomWords(summaryErrorCopy('')); err.hidden = false; }
  }
}
paintSummary();

/* files: the room's materials, a short signed link each (the room prefix is readable by anyone who was in the room, 0054) */
function paintFiles() {
  const p = pane('files');
  $('nFiles').textContent = materials.length || '';
  if (!materials.length) { p.innerHTML = '<div class="rp-empty">No files were shown in this session. Files a host adds in the room land here.</div>'; return; }
  const kindWord = (m) => { if (m.link_url) return 'Link'; const ext = /\.([a-z0-9]{2,5})$/i.exec(String(m.title || '')); return ext ? ext[1].toUpperCase() : 'File'; };
  p.innerHTML = materials.map((m) => `<div class="rp-file"><span class="rp-kindtag">${esc(kindWord(m))}</span>${m.link_url ? `<a href="${esc(m.link_url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<a href="#" data-matfile="${esc(m.file_path)}">${esc(m.title)}</a>`}</div>`).join('');
  p.querySelectorAll('[data-matfile]').forEach((a) => a.addEventListener('click', async (ev2) => {
    ev2.preventDefault();
    const w = window.open('', '_blank');   /* opened inside the tap — Safari refuses a window opened after an await */
    const { data, error } = await sb.storage.from('opil-files').createSignedUrl(a.dataset.matfile, 300);
    if (error || !data || !data.signedUrl) { console.warn('[replay] file', error && error.message); try { if (w) w.close(); } catch (e) {} toast('That file could not be opened right now. Try again in a moment.'); return; }
    if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  }));
}
paintFiles();

/* transcript: search, tap to jump, download */
const lines = transcriptOffsets(transcriptRows, started);
$('nLines').textContent = lines.length || '';
function paintTranscript() {
  const p = pane('transcript');
  const gate = roomWords(transcriptGateCopy({ open: true, lines: lines.length, failed: !!tr.error }));
  if (gate) { p.innerHTML = `<div class="rp-empty">${esc(gate)}</div>`; return; }
  p.innerHTML = `<div class="rp-search"><input type="search" id="tq" placeholder="Search what was said" autocomplete="off" aria-label="Search the transcript"><button type="button" id="tdl">Download</button></div><p class="rp-count" id="tcount"></p><div id="tlist"></div>`;
  const input = $('tq'), list = $('tlist'), count = $('tcount');
  const draw = () => {
    const needle = input.value.trim();
    const hits = transcriptSearch(lines, needle);
    count.textContent = searchCopy(hits.length, needle, lines.length);
    /* the match is found on the raw words, then each piece is escaped */
    const mark = (s) => markText(s, needle).map((x) => x.hit ? '<mark>' + esc(x.text) + '</mark>' : esc(x.text)).join('');
    list.innerHTML = hits.slice(0, 600).map((l) => `<button type="button" class="rp-tline" data-off="${l.offset == null ? '' : l.offset}"><span class="rp-clock">${esc(l.clock)}</span><b>${esc(l.speaker)}</b><span class="rp-text">${mark(l.text)}</span></button>`).join('')
      + (hits.length > 600 ? '<div class="rp-empty">Showing the first 600 lines — search to narrow it.</div>' : '');
    list.querySelectorAll('.rp-tline').forEach((b) => b.addEventListener('click', () => { if (b.dataset.off !== '') seek(b.dataset.off); list.querySelectorAll('.rp-tline').forEach((x) => x.classList.toggle('on', x === b)); }));
  };
  let t = null; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  $('tdl').addEventListener('click', () => {
    const title = (state.title || 'HT Live') + ' · last session';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([transcriptText(lines, title)], { type: 'text/plain' }));
    a.download = ((state.title || 'HT Live').replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  });
  draw();
}
paintTranscript();
}
await page();
