/* ht/hub/room.js — the HT class room on /ht/hub/live/. Loaded by ht.js when the space has a `room`
   block. The page decides everything from ea_room_state(k, 'ht'); the room itself is the Academy's
   js/rtk-room-v2.js with HT words and HT design tokens (ht/hub/room-words.js). Hosts read the
   ea_rooms row directly (RLS: ea_room_is_host). We never set `display` on a kit element.
   Spec: docs/superpowers/specs/2026-09-15-ht-class-room-design.md §2, §7.3 */
const SLUG = 'ht';
const V = new URL(import.meta.url).search;   /* our own ?v= — the HT build stamp from ht/build.mjs */
const POLL_MS = 20000;

/* the stylesheet first, so the cards never paint unstyled */
await new Promise((res) => {
  if (document.querySelector('link[href^="/ht/hub/room.css"]')) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/ht/hub/room.css' + V;
  l.onload = res; l.onerror = res; document.head.appendChild(l);
});
const [{ roomKey, roomBranch, statusLine, replayLabel, iframeUrl }, { htWords, HT_TOKENS, htErrorText, htLoginHref, rememberKey, recallKey, forgetKey }, { createClient }] = await Promise.all([
  import('/js/room-page.js' + V),
  import('/ht/hub/room-words.js' + V),
  import('https://esm.sh/@supabase/supabase-js@2'),
]);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mount = document.getElementById('rtkMount');
const ctl = document.querySelector('.ht-room-ctl');
if (!mount || !ctl || !window.BM_CONFIG) throw new Error('room block or config missing');

/* The invitation: ?k= from the link, else the one this device remembered. A guest who started here
   keeps it across the sign-in round trip even when /welcome/ lost bm_next (the code opened in
   another app), and across a reload. localStorage can throw (private mode, blocked site data), so
   it sits behind a shim and the helpers never throw. */
const store = {
  getItem: (n) => { try { return localStorage.getItem(n); } catch (e) { return null; } },
  setItem: (n, v) => { try { localStorage.setItem(n, v); } catch (e) {} },
  removeItem: (n) => { try { localStorage.removeItem(n); } catch (e) {} },
};
const urlKey = roomKey(location.search);
let k = urlKey || recallKey(store, Date.now());
let keyFromStore = !urlKey && !!k;   /* a remembered key the server may no longer know — see below */
if (urlKey) rememberKey(store, urlKey, Date.now());
const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
const user = (await sb.auth.getSession()).data.session?.user || null;
/* the header's Sign in must carry the key back through the email code and /welcome/ */
const carryKey = () => document.querySelectorAll('.site-header a[href^="/login/"]').forEach((a) => a.setAttribute('href', htLoginHref(k)));
if (k) carryKey();

async function getState() {
  const { data, error } = await sb.rpc('ea_room_state', { p_key: k, p_slug: SLUG });
  if (error) throw error;
  return data;
}
const token = async () => (await sb.auth.getSession()).data.session?.access_token || '';

/* ---------- the cards ---------- */
/* the HT wordmark: on the page cards (WM, .ht-room-wm) and, as target.logo, inside the room itself — the
   join screen — because that is all a guest sees for an hour (Nelson, 9/15, on a call with an HT
   administrator: "I need to see the HT logo somewhere on the UI"). The now-strip gets the academic
   monogram (target.mark): at strip height the two-line wordmark falls under HT's minimum reproduction
   width and its second line smears, and on a phone it would crowd out the guest's "this session is being
   recorded" line. Both gold on transparent. */
const LOGO = { src: '/ht/img/ht-wordmark-gold.png', alt: 'Huston-Tillotson University' };
const MARK = { src: '/ht/img/ht-monogram-gold.png', alt: 'Huston-Tillotson University' };
const WM = '<img class="ht-room-wm" src="' + LOGO.src + '" alt="' + LOGO.alt + '">';
const onAirLine = (st) => '<p class="s">' + (st.is_live ? 'Live now' : 'Off air') + '</p>';
function card(inner, after) { ctl.innerHTML = '<div class="ht-room-card">' + WM + inner + '</div>' + (after || ''); mount.innerHTML = ''; mount.classList.remove('r2host'); }
function lastSession(st) {
  const u = iframeUrl(st && st.recording_url); if (!u) return '';
  return '<div class="ht-room-last"><b>Last session</b><div class="frame"><iframe src="' + esc(u) + '" title="Last session replay" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a href="' + esc(st.recording_url) + '" target="_blank" rel="noopener">Open in a new tab</a></div>';
}
function endedCard() { if (poll) { clearInterval(poll); poll = null; } document.body.classList.remove('in-room', 'in-room-v2'); card('<h3>This session has ended.</h3><p>If you were here, you can rewatch it on this page once your host publishes it.</p>', lastSession(state)); }
function leftCard() { if (poll) { clearInterval(poll); poll = null; } document.body.classList.remove('in-room', 'in-room-v2'); card('<h3>You left the room.</h3><a class="btn ht-gold" href="' + esc(location.pathname + location.search) + '">Rejoin →</a>'); }

/* ---------- state → branch ---------- */
let state = null, stateErr = null;
try { state = await getState(); } catch (e) { stateErr = e; }   /* null state → roomBranch → 'error' → the card below; never throw (ht.js would overwrite the card) */
/* the host made a new link since this device remembered the old one: forget it and ask again with
   no key, so a member or a host gets their own card instead of the dead-link one. A dead key in
   the URL itself keeps today's dead-link card — that link really is gone. */
if (state && state.bad_link && keyFromStore) {
  forgetKey(store); k = null; keyFromStore = false; carryKey();
  state = null; stateErr = null;
  try { state = await getState(); } catch (e) { stateErr = e; }
}
const branch = roomBranch(state);
const words = htWords(state && state.host_name);
const target = () => ({ kind: 'room', slug: SLUG, id: state.id, title: state.title, host_name: state.host_name, key: k, words, tokens: HT_TOKENS, logo: LOGO, mark: MARK });   /* key: the guest's ?k=, or the one this device remembered — the room module sends it in the join body */

let r2 = null;            /* the mounted room, when there is one */
let poll = null;          /* the guest's 20 s state check */
let hosting = false;      /* this page started (or re-entered) the class as host */
let pendingRecord = false;/* start the recording on the host's 'joined' — never on Start class */

async function mountRoom(mode, extra) {
  const { mountRoomV2 } = await import('/js/rtk-room-v2.js' + V);
  r2 = await mountRoomV2(Object.assign({
    mountEl: mount, cfg: window.BM_CONFIG, token: await token(), sb, user, mode,
    target: target(), facilitator: state.host_name, onState,
  }, extra || {}));
  /* scroll AFTER the mount, never before: the room module adds body.in-room, which hides the preview bar,
     the HT head and the site header above the room — a target measured before that lands ~40px too far and
     cut the wordmark off the top of a phone. Measured now, the room sits 8px under the top edge. (While a
     class is live the module resolves once the person presses Enter; until then the collapsed chrome
     already holds the join screen at the top, so this is a small settle into the class view.) */
  window.scrollTo({ top: Math.max(0, mount.getBoundingClientRect().top + window.scrollY - 8), behavior: 'smooth' });
  return r2;
}
function onState(st, meeting, reason) {
  if (st === 'joined' && pendingRecord) {
    pendingRecord = false;
    record('start').then(() => { host.rec(true); if (r2 && r2.setRecording) r2.setRecording(true); })
      .catch((e) => host.note('You’re in, but the replay could not start recording (' + (e.message || e) + '). The session itself is fine.'));
  }
  if (st === 'left' || st === 'ended') {
    document.body.classList.remove('in-room', 'in-room-v2');
    if (hosting) host.endSession();
    else if (st === 'left' && reason !== 'kicked') leftCard();
    else endedCard();
  }
}
async function record(action, extra) {
  const r = await fetch(window.BM_CONFIG.FUNCTIONS_BASE + '/ea-rtk-record', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
    body: JSON.stringify(Object.assign({ room: SLUG, action }, extra || {})),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(htErrorText(d.error || ('server_' + r.status), r.status, words)); e.code = d.error; throw e; }
  return d;
}

/* ---------- guests ---------- */
async function guestWait() {
  ctl.innerHTML = '';
  await mountRoom('waiting');
  poll = setInterval(async () => { try { const s = await getState(); if (s && s.is_live) location.reload(); } catch (e) {} }, POLL_MS);
}
async function guestEnter() {
  ctl.innerHTML = '';
  try { await mountRoom('student'); }
  catch (e) { card('<h3>' + esc(htErrorText(e.code, e.status, words)) + '</h3><p>Reload to try again.</p>'); return; }
  poll = setInterval(async () => {
    try { const s = await getState(); if (s && !s.is_live) { clearInterval(poll); poll = null; state = s; try { await r2.leave(); } catch (x) {} endedCard(); } } catch (e) {}
  }, POLL_MS);
}

/* ---------- the host card ---------- */
const START = 'Start class — everyone on camera';
const host = {
  room: null, admin: false, tick: null, els: {},
  note(t) { if (this.els.note) this.els.note.textContent = t; },
  rec(on) { if (this.els.rec) this.els.rec.hidden = !on; },
  async load() {
    const { data, error } = await sb.from('ea_rooms')
      .select('id,slug,title,host_name,host_emails,link_key,is_live,live_since,max_participants,recording_url')
      .eq('slug', SLUG).maybeSingle();
    if (error || !data) throw new Error(error ? error.message : 'no room row');
    this.room = data; return data;
  },
  link() { return location.origin + '/ht/hub/live/?k=' + this.room.link_key; },
  render() {
    const r = this.room;
    ctl.innerHTML = `<div class="ht-room-host">
  <div class="hd2"><h3>Your room</h3><span class="mono">Hosts only</span></div>
  <div class="row"><label style="flex:1"><span>The link to send</span><input id="rmLink" readonly aria-label="Link to this room" value="${esc(this.link())}"></label><button type="button" class="pill" id="rmCopy" aria-live="polite">Copy link</button><button type="button" class="pill ghost" id="rmNew">New link</button></div>
  <div class="row two"><label>Title <span class="saved" id="rmTitleSaved"></span><input id="rmTitle" maxlength="120" value="${esc(r.title)}"></label><label>Host name <span class="saved" id="rmHostSaved"></span><input id="rmHost" maxlength="80" value="${esc(r.host_name)}"></label><label>Max people (you included) <span class="saved" id="rmMaxSaved"></span><input id="rmMax" type="number" min="2" max="500" value="${esc(r.max_participants)}"></label></div>
  ${this.admin ? `<label>Hosts — one email per line <span class="saved" id="rmHostsSaved"></span><textarea id="rmHosts" spellcheck="false">${esc((r.host_emails || []).join('\n'))}</textarea></label><div class="row"><button type="button" class="pill" id="rmHostsSave">Save hosts</button><p class="fine" style="margin:0">Anyone on this list who signs in with that email gets this card and can start a session.</p></div>` : ''}
  <div class="row"><button type="button" class="btn ht-gold" id="rmStart">${START}</button><button type="button" class="pill" id="rmEnd" hidden title="For a session left running from another device. Leaving the room from the device that started it ends the session on its own.">End session</button><span id="rmRec" hidden><i></i>Recording</span><span class="status" id="rmStatus"></span></div>
  <p class="note" id="rmNote">1. Copy the link and send it. It works before you start — people wait in the room. &nbsp;2. Start class, check your camera, press Enter Class. &nbsp;3. Leave ends the session for everyone; the replay lands below to review and publish.</p>
  <h4>Replays</h4><div id="rmReplays"><p class="fine">Loading…</p></div>
  <details id="rmWho"><summary>Who joined</summary><div></div></details>
</div>` + '<div id="rmLast">' + lastSession(state) + '</div>';
    const $ = (id) => document.getElementById(id);
    this.els = { link: $('rmLink'), copy: $('rmCopy'), neu: $('rmNew'), title: $('rmTitle'), hostName: $('rmHost'), max: $('rmMax'), hosts: $('rmHosts'), hostsSave: $('rmHostsSave'),
      start: $('rmStart'), end: $('rmEnd'), rec: $('rmRec'), status: $('rmStatus'), note: $('rmNote'), reps: $('rmReplays'), who: $('rmWho'), last: $('rmLast') };
    this.wire(); this.syncCtl(); this.loadReplays(); this.loadWho();
  },
  wire() {
    const e = this.els;
    e.copy.addEventListener('click', async () => {
      e.link.select(); let done = false;
      try { await navigator.clipboard.writeText(e.link.value); done = true; } catch (x) {}
      if (!done) { try { done = document.execCommand('copy'); } catch (x) {} }
      e.copy.textContent = done ? 'Copied' : (/Mac|iPhone|iPad/.test(navigator.platform) ? 'Press ⌘C' : 'Press Ctrl+C');
      setTimeout(() => { e.copy.textContent = 'Copy link'; }, 1600);
    });
    /* New link: two taps within 4 s — the old link stops working for everyone holding it */
    let armed = null;
    e.neu.addEventListener('click', async () => {
      if (!armed) { armed = setTimeout(() => { armed = null; e.neu.textContent = 'New link'; }, 4000); e.neu.textContent = 'Tap again to cut off the old link'; return; }
      clearTimeout(armed); armed = null; e.neu.disabled = true;
      try {
        const { data, error } = await sb.rpc('ea_room_rotate_link', { p_room: this.room.id });
        if (error || !data) { this.note('Could not make a new link — ' + (error ? error.message : 'try again.')); return; }
        this.room.link_key = data; e.link.value = this.link(); this.note('New link made. The old one no longer opens the room. Send the new one.');
      } finally {
        e.neu.disabled = false; e.neu.textContent = 'New link';
      }
    });
    const saveField = (input, savedEl, col, parse) => {
      input.addEventListener('change', async () => {
        const v = parse ? parse(input.value) : input.value.trim();
        if (v == null || v === '') { input.value = this.room[col]; return; }
        const { error } = await sb.from('ea_rooms').update({ [col]: v }).eq('id', this.room.id);
        if (error) { savedEl.textContent = 'not saved'; return; }
        this.room[col] = v; input.value = v; savedEl.textContent = 'Saved'; setTimeout(() => { savedEl.textContent = ''; }, 1800);
        if (col === 'host_name') state.host_name = v;
      });
    };
    saveField(e.title, document.getElementById('rmTitleSaved'), 'title');
    saveField(e.hostName, document.getElementById('rmHostSaved'), 'host_name');
    saveField(e.max, document.getElementById('rmMaxSaved'), 'max_participants', (s) => { const n = parseInt(s, 10); return Number.isInteger(n) && n >= 2 && n <= 500 ? n : null; });
    if (e.hostsSave) e.hostsSave.addEventListener('click', async () => {
      const lines = e.hosts.value.split(/\n/).map((s) => s.trim()).filter(Boolean);
      e.hostsSave.disabled = true;
      const s = document.getElementById('rmHostsSaved');
      try {
        const { data, error } = await sb.rpc('ea_room_set_hosts', { p_room: this.room.id, p_emails: lines });
        if (error) { s.textContent = 'not saved'; this.note('Could not save hosts — ' + error.message); return; }
        this.room.host_emails = data || []; e.hosts.value = this.room.host_emails.join('\n'); s.textContent = 'Saved'; setTimeout(() => { s.textContent = ''; }, 1800);
      } finally {
        e.hostsSave.disabled = false;
      }
    });
    e.start.addEventListener('click', () => this.start());
    e.end.addEventListener('click', () => { if (r2) { r2.leave(); } else { this.endSession(); } });
  },
  syncCtl() {
    const e = this.els, live = !!this.room.is_live;
    e.start.disabled = live; e.start.textContent = live ? 'Class is running' : START;
    e.end.hidden = !live;
    e.status.textContent = statusLine(Object.assign({}, state, { is_live: live }));
    e.status.classList.toggle('live', live);
    if (live && !this.tick) this.tick = setInterval(() => this.onTick(), POLL_MS);
  },
  async onTick() {
    let s; try { s = await getState(); } catch (e) { return; }
    if (!s) return;
    state = s;
    this.room.is_live = !!state.is_live;
    this.syncCtl();
    this.els.status.textContent = statusLine(state);
    await this.loadReplays();
    if (!this.room.is_live && !this.busy) { clearInterval(this.tick); this.tick = null; }
  },
  async flip(on) {
    const patch = on ? { is_live: true, updated_at: new Date().toISOString() } : { is_live: false, ended_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error } = await sb.from('ea_rooms').update(patch).eq('id', this.room.id);
    if (error) throw new Error(error.message);
    Object.assign(this.room, patch); state.is_live = on;
  },
  /* Start class: the server opens a fresh meeting and hands this host a token; ea-rtk-join already
     stamps is_live + live_since on the row with the server clock the moment the meeting exists
     (before Enter) — that is when the room actually flips live. onOpened re-reads the row and the
     state instead of writing them again; a fast host clock must never overwrite the server's
     live_since (it would kill the guest question queue and the people count). No reload: it would
     drop the camera we are about to use. */
  async start() {
    const e = this.els;
    e.start.disabled = true; e.start.textContent = 'Opening the room…';
    let opened = false;
    try {
      hosting = true; if (poll) { clearInterval(poll); poll = null; }
      await mountRoom('host', { onOpened: async () => {
        await this.load(); try { state = await getState(); } catch (e) {}
        opened = true; pendingRecord = true; this.syncCtl();
        this.note('Your room is open. Check your camera below and press Enter Class — the recording starts when you’re in. When you’re done, press Leave and the session ends for everyone.');
      } });
    } catch (x) {
      hosting = false; e.start.disabled = false; e.start.textContent = START;
      const msg = x.code ? htErrorText(x.code, x.status, words) : (x.message || x);
      if (opened) {
        try { await this.flip(false); } catch (y) {}
        this.syncCtl();
        this.note('The room opened but this device could not enter it — ' + msg + '. The session was closed; press Start class to try again.');
      } else {
        this.note('Could not open the room — ' + msg);
      }
    }
  },
  /* re-entry: a reload or a second device while the class runs — same meeting, no new recording
     (start is idempotent server-side) */
  async reenter() {
    hosting = true; pendingRecord = true;
    try { await mountRoom('host'); }
    catch (x) { hosting = false; this.note('The class is running but this device could not enter it — ' + (x.code ? htErrorText(x.code, x.status, words) : (x.message || x)) + '. Press End session to close it.'); }
  },
  /* the host leaving IS the end of the session — one action */
  async endSession() {
    hosting = false; let recorded = false;
    try { recorded = !!(await record('stop')).stopped; } catch (x) {}
    this.rec(false);
    try { await this.flip(false); }
    catch (x) { this.syncCtl(); this.note('You left, but the session could not be closed (' + x.message + '). Press End session.'); return; }
    this.syncCtl();
    this.note(recorded ? 'Session ended — the replay is being prepared. It shows below when it is ready to review; the people who were here see it once you publish it.'
                       : 'Session ended — the room is closed for everyone. Start class to open it again.');
    this.loadReplays(); this.loadWho();
  },
  busy: false,
  async loadReplays() {
    const e = this.els;
    const { data, error } = await sb.from('ea_room_replays').select('id,status,watch_url,duration_s,published,created_at')
      .eq('room_id', this.room.id).order('created_at', { ascending: false }).limit(8);
    if (error) this.note('Could not load replays — ' + error.message);
    const rows = data || [];
    this.busy = rows.some((r) => ['invoked', 'recording', 'uploading', 'uploaded'].includes(r.status));
    if (this.busy && !this.tick) this.tick = setInterval(() => this.onTick(), POLL_MS);
    this.rec(rows.some((r) => r.status === 'invoked' || r.status === 'recording') && !!this.room.is_live);
    e.reps.innerHTML = rows.length ? rows.map((r) => {
      const d = new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const mins = r.duration_s ? ' · ' + Math.max(1, Math.round(r.duration_s / 60)) + ' min' : '';
      const acts = r.status === 'ready'
        ? `<a class="pill ghost" href="${esc(r.watch_url)}" target="_blank" rel="noopener">Review</a><button type="button" class="pill" data-pub="${esc(r.id)}" data-on="${r.published ? '0' : '1'}">${r.published ? 'Unpublish' : 'Publish'}</button>`
        : r.status === 'error' ? `<button type="button" class="pill" data-retry="${esc(r.id)}">Retry</button>` : '';
      return `<div class="ht-room-rep"><span><b>${esc(d)}</b> · ${esc(replayLabel(r))}${mins}</span><span class="acts">${acts}</span></div>`;
    }).join('') : '<p class="fine">No replays yet. Each session records itself and lands here to review.</p>';
    e.reps.querySelectorAll('[data-pub]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await sb.rpc('ea_room_publish_replay', { p_replay: b.getAttribute('data-pub'), p_publish: b.getAttribute('data-on') === '1' });
      if (error) this.note('Could not change the replay — ' + error.message);
      try { state = await getState(); } catch (x) {}
      e.last.innerHTML = lastSession(state);
      await this.loadReplays();
    }));
    e.reps.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await record('retry_replay', { replay_id: b.getAttribute('data-retry') }); } catch (x) { this.note(x.message); }
      await this.loadReplays();
    }));
  },
  async loadWho() {
    const e = this.els;
    const { data: mem, error } = await sb.from('ea_room_members').select('user_id,last_joined_at').eq('room_id', this.room.id).order('last_joined_at', { ascending: false }).limit(200);
    if (error) this.note('Could not load who joined — ' + error.message);
    const since = this.room.live_since ? new Date(this.room.live_since).getTime() : 0;
    const cur = (mem || []).filter((m) => new Date(m.last_joined_at).getTime() >= since);
    const names = {};
    if (cur.length) {
      const { data: pr } = await sb.from('ea_profiles').select('user_id,display_name').in('user_id', cur.map((m) => m.user_id));
      (pr || []).forEach((p) => { names[p.user_id] = p.display_name; });
    }
    e.who.querySelector('summary').textContent = (this.room.is_live ? 'In this session' : 'Last session') + ' · ' + cur.length + (cur.length === 1 ? ' person' : ' people');
    e.who.querySelector('div').innerHTML = cur.length ? '<ul>' + cur.map((m) => '<li>' + esc(names[m.user_id] || 'Someone who joined') + '</li>').join('') + '</ul>' : '<p class="fine">Nobody yet.</p>';
  },
};

/* ---------- go ---------- */
switch (branch) {
  case 'dead_link':
    card('<h3>This link isn’t active anymore.</h3><p>Ask your host for the new one.</p>'); break;
  case 'landing':
    card(`<h3>${esc(state.host_name)}’s room</h3><p class="t">${esc(state.title)}</p>` + onAirLine(state) +
         `<a class="btn ht-gold" href="${esc(htLoginHref(k))}">Sign in to join</a><p class="fine">Email, then the 6-digit code — no app to install.<br>Type the code and you’ll be brought straight back here.</p>`, lastSession(state)); break;
  case 'not_allowed':
    /* signed in with no key on this device (the code was opened in another browser, or they came
       to the page by hand): the link they were sent is the way in — say so, no dead-end button */
    card('<h3>Almost in.</h3>' + onAirLine(state) +
         '<p>You’re signed in — now open the invitation link your host sent you (it ends in ?k=…). It will bring you straight into the room.</p>' +
         (state.is_live ? '<p>The session is running now — you’ll be in as soon as the link opens.</p>' : '') +
         '<p class="fine">On a phone, tap the link in the message; on a laptop, paste it into this window’s address bar.</p>', lastSession(state)); break;
  case 'host_idle':
  case 'host_live':
    try {
      await host.load();
      try { host.admin = (await sb.rpc('ea_is_admin')).data === true; } catch (e) { host.admin = false; }
      host.render();
      if (branch === 'host_live') { host.note('Class is running. This device is entering it — Leave here ends the session for everyone, or press End session.'); await host.reenter(); }
    } catch (e) { card('<h3>The host card could not load.</h3><p>' + esc(e.message || e) + '</p>'); }
    break;
  case 'waiting': await guestWait(); break;
  case 'student': await guestEnter(); break;
  default:
    card('<h3>The room could not load.</h3><p>' + esc(stateErr && stateErr.message ? stateErr.message : 'Reload to try again.') + '</p>');
}
