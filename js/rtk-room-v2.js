/* The class room, v2 — the concept boards made real (spec 2026-09-14-opil-room-v2-design.md).
   RealtimeKit still runs the video; its composable parts (grid, chat, people, polls, breakouts,
   audio, notifications) sit inside OUR layout: a "You're in the right place" join screen, a
   what's-happening-now strip, mic/camera state in words, one big Ask a question, the host's
   Ready-to-speak queue with Bring on stage, and a Tools sheet for the rare stuff.
   v1 (`rtk-room.js`, the kit's own shell) is untouched: `?classic=1` brings it back.

   Loading is identical to v1 (proven 9/10): core as the IIFE build, UI kit as ESM, pinned. */

import { stateCopy, nowCopy, queueOrder, queuePosition, nextInLine, joinCopy, sessLabel } from '/opil/hub/live-rooms.js';

const CORE = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';
const UI_LOADER = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
const UI_MAIN = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';
const VB_ADDON = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui-addons@0.1.0/dist/video-background.js';
const BACKDROPS = [{ name: 'Navy', url: '/assets/rtk-bg/navy.jpg' }, { name: 'Paper', url: '/assets/rtk-bg/paper.jpg' }];

let kitReady = null;
function loadKit() {
  if (kitReady) return kitReady;
  kitReady = (async () => {
    await new Promise((res, rej) => {
      if (window.RealtimeKitClient) return res();
      const s = document.createElement('script');
      s.src = CORE; s.onload = res; s.onerror = () => rej(new Error('The video library could not load. Check your connection or any blocker.'));
      document.head.appendChild(s);
    });
    const { defineCustomElements } = await import(UI_LOADER);
    defineCustomElements();
    const ui = await import(UI_MAIN);
    return { RealtimeKitClient: window.RealtimeKitClient, ui };
  })();
  return kitReady;
}

/* Ask the server for a token. It decides the role; the page never names a preset. */
async function joinTarget(cfg, token, sessionNo, meetingId) {
  const r = await fetch(cfg.FUNCTIONS_BASE + '/ea-rtk-join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(meetingId ? { session_no: sessionNo, meeting_id: meetingId } : { session_no: sessionNo }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error({
      sign_in: 'Sign in again and retry.',
      not_allowed: 'Your account is not in this cohort.',
      not_open: 'The room opens when your facilitator starts the class.',
      not_found: 'That session no longer exists.',
      rtk_not_configured: 'The class room is not set up yet.',
    }[d.error] || ('The server said ' + r.status + '.'));
    e.code = d.error; e.status = r.status; throw e;
  }
  return d;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const AUTO_KEY = 'r2-auto-enter';

/* mountRoomV2 — one call for every situation on the room page:
     mode 'waiting'  a student before the class starts (no kit, no token)
     mode 'student'  the class is running: preview → Enter Class → in class
     mode 'host'     Start class pressed: the meeting is opened now (onOpened gets the id),
                     preview → Enter Class (starts everything) → in class
   Returns { meetingId, leave(), setRecording(bool) }. onState gets 'joined' | 'left' | 'ended'. */
export async function mountRoomV2(o) {
  const { mountEl, cfg, token, sb, user, session, mode, facilitator, onState, onOpened } = o;
  const no = session.no, title = sessLabel(session) + ' · ' + session.title;
  mountEl.classList.add('r2host');
  document.body.classList.add('in-room', 'in-room-v2');

  /* ---------- waiting: no video library yet, just the promise of what happens next ---------- */
  if (mode === 'waiting') {
    mountEl.innerHTML = '';
    mountEl.appendChild(joinScreen({ title, session, live: false, host: false, facilitator, joined: 0, preview: false }));
    try { sessionStorage.setItem(AUTO_KEY, String(no)); } catch (e) {}   /* when the page reloads live, walk straight in */
    return { meetingId: null, leave: () => { mountEl.innerHTML = ''; }, setRecording() {} };
  }

  /* ---------- the meeting object: for a host this is what OPENS the room ---------- */
  const join = await joinTarget(cfg, token, no, o.meetingId || null);
  if (mode === 'host' && onOpened) await onOpened(join.meeting_id);
  const { RealtimeKitClient, ui } = await loadKit();
  if (ui.provideRtkDesignSystem) {
    ui.provideRtkDesignSystem(mountEl, {
      theme: 'dark', borderRadius: 'rounded', spacingBase: 4,
      colors: {
        brand: { 300: '#b28a0a', 400: '#d9a90f', 500: '#fdc921', 600: '#fed45a', 700: '#fee38a' },
        background: { 600: '#22345f', 700: '#162650', 800: '#0f1d44', 900: '#0a1733', 1000: '#04123a' },
        text: '#ffffff', 'text-on-brand': '#04123a', 'video-bg': '#0a1733',
        danger: '#ff5c5c', success: '#3ddc97', warning: '#fdc921',
      },
    });
  }
  const host = !!join.host;
  const meeting = await RealtimeKitClient.init({
    authToken: join.token,
    /* hosts arrive ready to teach; students arrive muted, camera off, and turn them on in one tap */
    defaults: { audio: host, video: host, mediaConfiguration: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } } },
  });
  let current = meeting;   /* the meeting this page is in: the main room, or a breakout room */

  /* ---------- effects (blur / backdrops), reused from v1's addon, driven by our own buttons ---------- */
  let effects = null;
  async function loadEffects(m) {
    try {
      const { default: VideoBackground } = await import(VB_ADDON);
      effects = await VideoBackground.init({ meeting: m, modes: ['blur', 'virtual'], blurStrength: 50, images: BACKDROPS.map(b => location.origin + b.url) });
    } catch (e) { effects = null; }
  }
  loadEffects(meeting);

  /* ---------- transcript lines, saved on request ---------- */
  const lines = [];
  const keepTranscripts = (m) => { try { (m.ai && m.ai.transcripts || []).forEach(x => x && !x.isPartialTranscript && lines.push(x)); m.ai && m.ai.on && m.ai.on('transcript', (x) => { if (x && !x.isPartialTranscript && !lines.some(y => y.id === x.id)) lines.push(x); }); } catch (e) {} };
  keepTranscripts(meeting);
  function saveTranscript() {
    const when = (ts) => new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const body = lines.length ? lines.map(x => when(x.timestamp) + '  ' + (x.name || 'Someone') + ': ' + x.transcript).join('\n')
      : 'No transcript lines were captured on this device. Transcripts only include people whose role is transcribed, and only while this page was open.';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([title + '\n' + new Date().toLocaleString() + '\n\n' + body + '\n'], { type: 'text/plain' }));
    a.download = (title.replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- getting in ---------- */
  const joinedCount = () => { try { return meeting.participants.joined.toArray().length; } catch (e) { return 0; } };
  const screen = joinScreen({ title, session, live: true, host, facilitator, joined: joinedCount(), preview: true });
  mountEl.innerHTML = ''; mountEl.appendChild(screen);
  const preview = screen.querySelector('video');
  const attachPreview = () => {
    try {
      const t = meeting.self.videoTrack, box = screen.querySelector('.r2-preview'), ph = screen.querySelector('.r2-ph');
      if (t && preview && meeting.self.videoEnabled) { preview.srcObject = new MediaStream([t]); preview.play().catch(() => {}); box && box.classList.add('has-video'); }
      else {
        if (preview) preview.srcObject = null; box && box.classList.remove('has-video');
        if (ph) ph.innerHTML = meeting.self.videoEnabled ? '<b>Starting your camera…</b><span>If nothing shows in a few seconds, check the browser’s camera permission.</span>' : '<b>Your camera is off</b><span>Tap the camera chip to check how you look.</span>';
      }
    } catch (e) {}
  };
  /* Effects on the join screen: a small tray under the preview, same addon as in class */
  const fxChip = screen.querySelector('.r2-fx');
  if (fxChip) fxChip.addEventListener('click', () => {
    let tray = screen.querySelector('.r2-fxtray');
    if (tray) { tray.remove(); return; }
    tray = el(`<div class="r2-fxtray"><button type="button" data-fx="none">No effect</button><button type="button" data-fx="blur">Blur</button>${BACKDROPS.map(b => `<button type="button" data-fx="${b.url}">${b.name}</button>`).join('')}</div>`);
    tray.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', async () => {
      if (!effects) { b.textContent = 'Loading…'; setTimeout(() => { b.textContent = b.dataset.fx === 'none' ? 'No effect' : b.dataset.fx === 'blur' ? 'Blur' : (BACKDROPS.find(x => x.url === b.dataset.fx) || {}).name; }, 1500); return; }
      try { if (b.dataset.fx === 'none') await effects.removeBackground(); else if (b.dataset.fx === 'blur') await effects.applyBlurBackground(); else await effects.applyVirtualBackground(location.origin + b.dataset.fx); } catch (e) {}
      tray.querySelectorAll('[data-fx]').forEach(x => x.classList.toggle('on', x === b));
    }));
    screen.querySelector('.r2-preview').insertAdjacentElement('afterend', tray);
  });
  const chips = wireChips(screen, () => meeting, attachPreview);
  attachPreview();
  meeting.self.on('videoUpdate', () => { attachPreview(); chips.sync(); });
  meeting.self.on('audioUpdate', chips.sync);
  chips.sync();

  let autoEnter = false;
  try { autoEnter = sessionStorage.getItem(AUTO_KEY) === String(no); sessionStorage.removeItem(AUTO_KEY); } catch (e) {}
  const enterBtn = screen.querySelector('.r2-enter');
  await new Promise((resolve) => {
    if (autoEnter && !host) return resolve();
    enterBtn.addEventListener('click', resolve, { once: true });
  });
  enterBtn.disabled = true; enterBtn.textContent = host ? 'Starting…' : 'Entering…';
  await (meeting.join ? meeting.join() : meeting.joinRoom());

  /* ---------- in class ---------- */
  const room = classRoom({ meeting, ui, host, title, session, facilitator, sb, user, saveTranscript, getEffects: () => effects, onLeave: leaveNow, onSwitch: (m) => { current = m; } });
  mountEl.innerHTML = ''; mountEl.appendChild(room.node);
  room.bind(meeting);
  if (onState) onState('joined', meeting);

  /* breakout rooms hand the page a NEW meeting: rebind everything to it */
  let switching = false;
  const onMeetingChanged = async (next) => {
    current = next; room.bind(next); keepTranscripts(next); await loadEffects(next);
    try { next.connectedMeetings.on('changingMeeting', () => { switching = true; }); next.connectedMeetings.on('meetingChanged', onMeetingChanged); } catch (e) {}
    setTimeout(() => { switching = false; }, 1500);
  };
  try { meeting.connectedMeetings.on('changingMeeting', () => { switching = true; }); meeting.connectedMeetings.on('meetingChanged', onMeetingChanged); } catch (e) {}

  const gone = (why) => () => { if (switching) return; room.destroy(); document.body.classList.remove('in-room', 'in-room-v2'); mountEl.innerHTML = ''; if (onState) onState(why, current); };
  /* roomLeft carries why: 'left' (we pressed Leave), 'ended' (the host ended it), 'kicked' */
  try { meeting.self.on('roomLeft', (ev) => gone(ev && ev.state === 'ended' ? 'ended' : 'left')()); } catch (e) {}

  async function leaveNow() { try { await current.leave(); } catch (e) {} gone('left')(); }

  return {
    meetingId: join.meeting_id, host,
    leave: leaveNow,
    setRecording: (on) => room.setRecording(on),
  };
}

/* ---------- the join screen ---------- */
function joinScreen({ title, session, live, host, facilitator, joined, preview }) {
  const when = session.session_date ? new Date(session.session_date + 'T19:00:00').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const line = joinCopy({ live, host, facilitator, joined, startsAt: live ? null : when });
  const cta = !live && !host ? '' : `<button type="button" class="r2-enter">${host && !live ? 'Start class →' : 'Enter Class →'}</button>
      <p class="r2-under">${host ? 'You’ll join with your mic and camera on.' : 'You’ll be muted when you join. You can unmute anytime.'}</p>`;
  return el(`<section class="r2-join">
    <div class="r2-join-left">
      <div class="r2-kicker">You’re in the right place.</div>
      <h2 class="r2-title">${esc(title)}</h2>
      <p class="r2-line">${esc(line)}</p>
      ${preview ? `<div class="r2-preview"><video muted playsinline autoplay></video>
        <div class="r2-ph"><b>Your camera is off</b><span>Tap the camera chip to check how you look.</span></div>
        <div class="r2-chips">
          <button type="button" class="r2-chip" data-t="mic"><b></b><span></span></button>
          <button type="button" class="r2-chip" data-t="cam"><b></b><span></span></button>
          <button type="button" class="r2-chip r2-fx" data-t="fx"><b>Effects</b><span>Blur or a backdrop</span></button>
        </div></div>` : `<div class="r2-wait"><b>${esc(session.title)}</b><span>${when ? 'Starts at ' + esc(when) : 'Starts when your facilitator opens it'}</span>
        <ol><li>You’ll enter the class on your own.</li><li>Your facilitator will know you’re here.</li><li>You’ll see everyone once it starts.</li></ol></div>`}
    </div>
    <div class="r2-join-right">${cta}<p class="r2-fine">No downloads. Works in your browser.</p></div>
  </section>`);
}

/* the two word-chips (mic / camera) — shared by the join screen and the class bar */
function wireChips(root, getMeeting, onVideo) {
  const mic = root.querySelector('.r2-chip[data-t="mic"]'), cam = root.querySelector('.r2-chip[data-t="cam"]');
  const sync = () => {
    const s = getMeeting().self;
    const c = stateCopy({ audio: !!s.audioEnabled, video: !!s.videoEnabled });
    if (mic) { mic.querySelector('b').textContent = c.mic[0]; mic.querySelector('span').textContent = c.mic[1]; mic.classList.toggle('on', !!s.audioEnabled); }
    if (cam) { cam.querySelector('b').textContent = c.cam[0]; cam.querySelector('span').textContent = c.cam[1]; cam.classList.toggle('on', !!s.videoEnabled); }
  };
  if (mic) mic.addEventListener('click', async () => { const s = getMeeting().self; try { s.audioEnabled ? await s.disableAudio() : await s.enableAudio(); } catch (e) {} sync(); });
  if (cam) cam.addEventListener('click', async () => { const s = getMeeting().self; try { s.videoEnabled ? await s.disableVideo() : await s.enableVideo(); } catch (e) {} sync(); if (onVideo) onVideo(); });
  return { sync };
}

/* ---------- in class ---------- */
function classRoom({ meeting, ui, host, title, session, facilitator, sb, user, saveTranscript, getEffects, onLeave, onSwitch }) {
  const node = el(`<div class="r2">
    <div class="r2-now"><span class="r2-dot"></span><span class="r2-nowtxt"></span><span class="r2-rec" hidden>Recording · saves automatically for your students</span></div>
    <div class="r2-main">
      <div class="r2-stage">
        <rtk-ui-provider>
          <rtk-grid class="r2-grid"></rtk-grid>
          <rtk-participants-audio></rtk-participants-audio>
          <rtk-notifications></rtk-notifications>
          <rtk-dialog-manager></rtk-dialog-manager>
        </rtk-ui-provider>
      </div>
      <aside class="r2-panel">
        <div class="r2-tabs">
          ${host ? '<button type="button" class="r2-tab" data-tab="queue">Questions <em>0</em></button>' : ''}
          <button type="button" class="r2-tab" data-tab="chat">Chat</button>
          <button type="button" class="r2-tab" data-tab="people">People <em></em></button>
        </div>
        <div class="r2-pane" data-pane="queue" hidden><div class="r2-queue-head">Ready to speak</div><div class="r2-queue"></div></div>
        <div class="r2-pane" data-pane="chat" hidden><rtk-chat></rtk-chat></div>
        <div class="r2-pane" data-pane="people" hidden><rtk-participants></rtk-participants></div>
        <button type="button" class="r2-close" aria-label="Close">Close</button>
      </aside>
    </div>
    <div class="r2-bar">
      <div class="r2-chips">
        <button type="button" class="r2-chip" data-t="mic"><b></b><span></span></button>
        <button type="button" class="r2-chip" data-t="cam"><b></b><span></span></button>
      </div>
      <div class="r2-primary"></div>
      <div class="r2-right">
        <button type="button" class="r2-btn r2-open" data-open="chat">Chat &amp; people</button>
        ${host ? '<button type="button" class="r2-btn r2-tools">Tools</button>' : '<button type="button" class="r2-btn r2-help">Need help?</button>'}
        <button type="button" class="r2-leave">Leave</button>
      </div>
    </div>
    <div class="r2-sheet" hidden>
      <div class="r2-sheet-card">
        <div class="r2-sheet-head"><b>Tools</b><button type="button" class="r2-sheet-close">Close</button></div>
        <div class="r2-sheet-body"></div>
      </div>
    </div>
  </div>`);
  const q = (s) => node.querySelector(s);
  let m = meeting, recording = !host, pinnedId = null;   /* every class records; students are told so, hosts are told once it actually starts */

  /* the strip */
  const setNow = () => { q('.r2-nowtxt').textContent = nowCopy({ facilitator, title: session.title, recording: false }); q('.r2-rec').hidden = !recording || !host; if (recording && !host) q('.r2-nowtxt').textContent += ' · This class is being recorded'; };
  const setRecording = (on) => { recording = on; setNow(); };
  setNow();

  /* mic / camera in words — wired once; a breakout switch only re-points them at the new meeting */
  const chips = wireChips(node, () => m);
  const bindSelf = () => { try { m.self.on('audioUpdate', chips.sync); m.self.on('videoUpdate', chips.sync); } catch (e) {} chips.sync(); };

  /* the side panel (desktop) / sheet (phone) */
  const showPane = (name) => {
    node.querySelectorAll('.r2-pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
    node.querySelectorAll('.r2-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    node.classList.add('panel-open');
  };
  node.querySelectorAll('.r2-tab').forEach(t => t.addEventListener('click', () => showPane(t.dataset.tab)));
  q('.r2-open').addEventListener('click', () => showPane(host ? 'queue' : 'chat'));
  q('.r2-close').addEventListener('click', () => node.classList.remove('panel-open'));
  const peopleCount = () => { try { const n = m.participants.joined.toArray().length + 1; q('.r2-tab[data-tab="people"] em').textContent = n; } catch (e) {} };

  /* the question queue */
  let hands = [];
  const uid = user.id;
  const primary = q('.r2-primary');
  const nameOf = (id) => { try { const p = m.participants.joined.toArray().find(x => x.customParticipantId === id); return p ? p.name : null; } catch (e) { return null; } };
  const renderPrimary = () => {
    if (host) {
      const next = nextInLine(hands);
      const nm = next ? (nameOf(next.user_id) || 'the next person') : null;
      primary.innerHTML = next
        ? `<button type="button" class="r2-cta r2-stage-btn"><b>Bring ${esc(nm)} on stage</b><span>${queueOrder(hands).length} in line</span></button>`
        : `<button type="button" class="r2-cta" disabled><b>No one in line</b><span>Questions show up here</span></button>`;
      const b = primary.querySelector('.r2-stage-btn'); if (b) b.addEventListener('click', () => bringOnStage(next));
    } else {
      const pos = queuePosition(hands, uid);
      primary.innerHTML = pos
        ? `<button type="button" class="r2-cta on"><b>You’re #${pos} in line</b><span>Tap to leave the line</span></button>`
        : `<button type="button" class="r2-cta"><b>Ask a question</b><span>Add yourself to the line</span></button>`;
      primary.querySelector('.r2-cta').addEventListener('click', () => pos ? leaveLine() : askQuestion());
    }
    const em = q('.r2-tab[data-tab="queue"] em'); if (em) em.textContent = queueOrder(hands).length;
  };
  const renderQueue = () => {
    const box = q('.r2-queue'); if (!box) return;
    const rows = queueOrder(hands);
    box.innerHTML = rows.length ? rows.map((r, i) => `<div class="r2-hand${r.staged_at ? ' staged' : ''}"><span class="r2-n">${i + 1}</span><div class="r2-who"><b>${esc(nameOf(r.user_id) || 'Student')}</b><span>${r.kind === 'comment' ? 'Would like to comment' : 'Has a question'}${r.staged_at ? ' · on stage' : ''}</span></div><button type="button" class="r2-mini r2-bring" data-id="${r.id}">Bring on stage</button><button type="button" class="r2-mini r2-done" data-id="${r.id}">Done</button></div>`).join('')
      : '<div class="r2-empty">When a student presses Ask a question, they appear here in order.</div>';
    box.querySelectorAll('.r2-bring').forEach(b => b.addEventListener('click', () => bringOnStage(hands.find(h => h.id === b.dataset.id))));
    box.querySelectorAll('.r2-done').forEach(b => b.addEventListener('click', () => markDone(hands.find(h => h.id === b.dataset.id))));
  };
  const loadHands = async () => { const { data } = await sb.from('ea_opil_hands').select('*').eq('session_no', session.no).is('done_at', null).order('created_at'); hands = data || []; renderPrimary(); renderQueue(); };
  async function askQuestion() { const { error } = await sb.from('ea_opil_hands').insert({ session_no: session.no, user_id: uid, kind: 'question' }); if (error && error.code !== '23505') toast('Could not raise your hand — ' + error.message); await loadHands(); }
  async function leaveLine() { await sb.from('ea_opil_hands').delete().eq('session_no', session.no).eq('user_id', uid).is('done_at', null); await loadHands(); }
  async function markDone(h) { if (!h) return; await sb.from('ea_opil_hands').update({ done_at: new Date().toISOString() }).eq('id', h.id); if (pinnedId === h.user_id) { unpin(); } await loadHands(); }
  async function bringOnStage(h) {
    if (!h) return;
    try {
      const p = m.participants.joined.toArray().find(x => x.customParticipantId === h.user_id);
      if (!p) { toast((nameOf(h.user_id) || 'That student') + ' isn’t in the room right now.'); return; }
      m.participants.joined.toArray().forEach(x => { if (x.isPinned && x.id !== p.id) { try { x.unpin(); } catch (e) {} } });
      try { if (m.self.isPinned) m.self.unpin(); } catch (e) {}
      await p.pin(); pinnedId = h.user_id;
      /* the previous person on stage is done; this one is on stage now */
      const prev = hands.find(x => x.staged_at && x.id !== h.id); if (prev) await sb.from('ea_opil_hands').update({ done_at: new Date().toISOString() }).eq('id', prev.id);
      await sb.from('ea_opil_hands').update({ staged_at: new Date().toISOString() }).eq('id', h.id);
      await loadHands();
    } catch (e) { toast('Could not bring them on stage — ' + (e.message || e)); }
  }
  function unpin() { try { m.participants.joined.toArray().forEach(x => { if (x.isPinned) x.unpin(); }); } catch (e) {} pinnedId = null; }
  let handsChan = null;
  const watchHands = () => { try { handsChan = sb.channel('hands-' + session.no).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_opil_hands', filter: 'session_no=eq.' + session.no }, loadHands).subscribe(); } catch (e) {} setInterval(loadHands, 15000); };

  /* the sheet: tools for the host, help for students */
  const sheet = q('.r2-sheet'), sheetBody = q('.r2-sheet-body');
  const openSheet = (titleTxt, inner) => { q('.r2-sheet-head b').textContent = titleTxt; sheetBody.innerHTML = ''; sheetBody.appendChild(inner); sheet.hidden = false; };
  q('.r2-sheet-close').addEventListener('click', () => { sheet.hidden = true; sheetBody.innerHTML = ''; });
  const effectsPane = () => {
    const p = el(`<div class="r2-fxpane"><button type="button" class="r2-btn" data-fx="none">No effect</button><button type="button" class="r2-btn" data-fx="blur">Blur my background</button>${BACKDROPS.map(b => `<button type="button" class="r2-btn" data-fx="${b.url}">${b.name} backdrop</button>`).join('')}<p class="r2-fine">Effects can take a few seconds the first time.</p></div>`);
    p.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', async () => {
      const fx = getEffects(); if (!fx) { toast('Effects are still loading — try again in a moment.'); return; }
      try { if (b.dataset.fx === 'none') await fx.removeBackground(); else if (b.dataset.fx === 'blur') await fx.applyBlurBackground(); else await fx.applyVirtualBackground(location.origin + b.dataset.fx); } catch (e) { toast('Could not apply that — ' + (e.message || e)); }
    }));
    return p;
  };
  const toolsPane = () => {
    const p = el(`<div class="r2-tools">
      <button type="button" class="r2-btn" data-tool="share"><b>Share my screen</b><span>Students see your screen instead of the grid</span></button>
      <button type="button" class="r2-btn" data-tool="fx"><b>Effects</b><span>Blur or a backdrop</span></button>
      <button type="button" class="r2-btn" data-tool="breakout"><b>Breakout rooms</b><span>Split the class into team rooms</span></button>
      <button type="button" class="r2-btn" data-tool="poll"><b>Poll</b><span>Ask everyone, see the bars live</span></button>
      <button type="button" class="r2-btn" data-tool="settings"><b>Camera &amp; mic settings</b><span>Pick a different device</span></button>
      <button type="button" class="r2-btn" data-tool="transcript"><b>Save transcript</b><span>Everything said, as a text file</span></button>
      <button type="button" class="r2-btn danger" data-tool="end"><b>End class for everyone</b><span>Closes the room and stops the recording</span></button>
    </div>`);
    p.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', async () => {
      const t = b.dataset.tool;
      if (t === 'share') { try { m.self.screenShareEnabled ? await m.self.disableScreenShare() : await m.self.enableScreenShare(); } catch (e) { toast('Screen share: ' + (e.message || e)); } sheet.hidden = true; }
      else if (t === 'fx') openSheet('Effects', effectsPane());
      else if (t === 'breakout') { const c = document.createElement('rtk-breakout-rooms-manager'); c.meeting = m; c.className = 'r2-kit'; openSheet('Breakout rooms', c); }
      else if (t === 'poll') { const c = document.createElement('rtk-polls'); c.meeting = m; c.className = 'r2-kit'; openSheet('Poll', c); }
      else if (t === 'settings') { const c = document.createElement('rtk-settings'); c.meeting = m; c.className = 'r2-kit'; openSheet('Camera & mic', c); }
      else if (t === 'transcript') { saveTranscript(); sheet.hidden = true; }
      else if (t === 'end') { if (confirmInline(b, 'End class for everyone?')) { try { if (m.participants.kickAll) await m.participants.kickAll(); } catch (e) {} await onLeave(); } }
    }));
    return p;
  };
  const helpPane = () => {
    const p = el(`<div class="r2-tools">
      <button type="button" class="r2-btn" data-h="fx"><b>Effects</b><span>Blur or a backdrop</span></button>
      <button type="button" class="r2-btn" data-h="settings"><b>Camera &amp; mic settings</b><span>Pick a different device</span></button>
      <button type="button" class="r2-btn" data-h="share"><b>Share my screen</b><span>Only if your facilitator asks</span></button>
      <p class="r2-fine">Can’t hear? Check your speakers under Camera &amp; mic. Can’t be heard? Tap the mic chip — it says whether you’re muted.</p>
    </div>`);
    p.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', async () => {
      const t = b.dataset.h;
      if (t === 'fx') openSheet('Effects', effectsPane());
      else if (t === 'settings') { const c = document.createElement('rtk-settings'); c.meeting = m; c.className = 'r2-kit'; openSheet('Camera & mic', c); }
      else if (t === 'share') { try { m.self.screenShareEnabled ? await m.self.disableScreenShare() : await m.self.enableScreenShare(); } catch (e) { toast('Screen share: ' + (e.message || e)); } sheet.hidden = true; }
    }));
    return p;
  };
  const tb = q('.r2-tools'); if (tb) tb.addEventListener('click', () => openSheet('Tools', toolsPane()));
  const hb = q('.r2-help'); if (hb) hb.addEventListener('click', () => openSheet('Need help?', helpPane()));

  /* leave: two taps, never one accidental one */
  const leaveBtn = q('.r2-leave');
  leaveBtn.addEventListener('click', async () => { if (confirmInline(leaveBtn, 'Leave class?')) await onLeave(); });
  function confirmInline(btn, label) {
    if (btn.dataset.armed === '1') { btn.dataset.armed = ''; return true; }
    const old = btn.innerHTML; btn.dataset.armed = '1'; btn.innerHTML = esc(label) + ' <em>Tap again</em>';
    setTimeout(() => { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.innerHTML = old; } }, 4000);
    return false;
  }

  function toast(msg) { const t = el(`<div class="r2-toast">${esc(msg)}</div>`); node.appendChild(t); setTimeout(() => t.remove(), 4000); }

  /* bind the kit's parts (and re-bind after a breakout switch) */
  function bind(mm) {
    m = mm; if (onSwitch) onSwitch(mm);
    node.querySelectorAll('rtk-ui-provider, rtk-grid, rtk-participants-audio, rtk-notifications, rtk-dialog-manager, rtk-chat, rtk-participants').forEach(c => { c.meeting = mm; });
    bindSelf(); peopleCount();
    try { mm.participants.joined.on('participantJoined', () => { peopleCount(); renderQueue(); renderPrimary(); }); mm.participants.joined.on('participantLeft', () => { peopleCount(); renderQueue(); renderPrimary(); }); } catch (e) {}
    if (!handsChan) watchHands();
    loadHands();
  }
  function destroy() { try { handsChan && sb.removeChannel(handsChan); } catch (e) {} }
  return { node, bind, destroy, setRecording };
}
