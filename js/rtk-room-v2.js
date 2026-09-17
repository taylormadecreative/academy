/* The class room, v2 — the concept boards made real (spec 2026-09-14-opil-room-v2-design.md).
   RealtimeKit still runs the video; its composable parts (grid, chat, people, polls, breakouts,
   audio, notifications) sit inside OUR layout: a "You're in the right place" join screen, a
   what's-happening-now strip, mic/camera state in words, one big Ask a question, the host's
   Ready-to-speak queue with Bring on stage, and a Tools sheet for the rare stuff.
   Everyone presses Enter themselves, host included — no walking straight into a live room on
   reload. A phone will not play any sound until the person has tapped something on the page,
   so the tap IS the unlock; guests also arrive muted and get a one-time nudge to check their mic.
   v1 (`rtk-room.js`, the kit's own shell) is untouched: `?classic=1` brings it back.

   Nobody ends a class by accident, and every person gets every tool (Nelson, 9/15, after a call
   where he and his guest were both thrown out and she could not share her screen). The rules, for
   every room this module draws (OPIL, the Academy, HT):
     · Leave only leaves. A host's Leave never removes anyone, never stops the recording, never
       flips the row; the page hears ('left', m, 'left') exactly once and offers the way back in.
     · The one way to end is the explicit End in Tools ("End the class for everyone", two taps):
       everyone is removed, we leave, the page hears ('ended', m, 'ended') and closes the row.
     · A drop is never the end. When the kit says roomLeft for any reason but left / kicked / ended
       (the socket died, the tab was throttled), a Reconnecting strip shows and the room rejoins the
       same meeting on its own — twice — before the page hears ('left', m, 'dropped'); the dead client
       is then told to leave, so it never walks the person back in behind the card. Leave pressed while
       a rejoin is in flight wins: the client that lands afterwards leaves at once.
     · One bar, one Tools sheet, for host and guest alike.

   Loading is identical to v1 (proven 9/10): core as the IIFE build, UI kit as ESM, pinned. */

/* The words and the queue helpers live in OPIL's live-rooms.js. They are imported when a room
   mounts, on this module's own ?v= (the pattern opil/hub/hub.js uses for tour.js), so they ride
   its cache stamp and never need a service-worker bump of their own. */
let copy = null;
let sgMod = null;   /* js/rtk-small-groups.js, imported with the page's ?v= (see mountRoomV2) */
let resMod = null;  /* js/rtk-resources.js — the Files tab (OPIL sessions) */
/* ---------- class plugins (spec 2026-09-16-class-features-design.md) ----------
   Every feature that is not the video itself is a plugin: one module at /js/rtk-<name>.js exporting
   create(ctx) → { start, stop, onBind? }. The room hands each the same ctx (tabs, bar, stage, channels,
   the class's key) and never lets one break the class: a plugin that throws is dropped with a console
   line. The list is by room kind so the same feature lights up an Academy room later. */
const PLUGINS = { opil: ['presence', 'reactions', 'warmup', 'roster', 'help', 'scoring'], room: ['presence', 'reactions', 'warmup', 'roster', 'help'], team: ['presence', 'reactions', 'roster', 'help'] };
const pluginMods = {};
async function loadPlugin(name) {
  if (pluginMods[name] !== undefined) return pluginMods[name];
  try { pluginMods[name] = await import('/js/rtk-' + name + '.js' + new URL(import.meta.url).search); }
  catch (e) { console.warn('[room] plugin did not load:', name, e); pluginMods[name] = null; }
  return pluginMods[name];
}
/* the class's key: what every table and channel is filed under */
const roomKeyFor = (target) => target.kind === 'room' ? 'room:' + target.id : target.kind === 'team' ? 'team:' + target.id : 'opil:' + target.session.no;

const CORE = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';
const UI_LOADER = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
const UI_MAIN = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';
const VB_ADDON = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui-addons@0.1.0/dist/video-background.js';
const BACKDROPS = [{ name: 'Navy', url: '/assets/rtk-bg/navy.jpg' }, { name: 'Paper', url: '/assets/rtk-bg/paper.jpg' }];

/* the Academy's own design tokens for provideRtkDesignSystem; target.tokens overrides this per room (HT) */
const ACADEMY_TOKENS = {
  theme: 'dark', borderRadius: 'rounded', spacingBase: 4,
  colors: {
    brand: { 300: '#b28a0a', 400: '#d9a90f', 500: '#fdc921', 600: '#fed45a', 700: '#fee38a' },
    background: { 600: '#22345f', 700: '#162650', 800: '#0f1d44', 900: '#0a1733', 1000: '#04123a' },
    text: '#ffffff', 'text-on-brand': '#04123a', 'video-bg': '#0a1733',
    danger: '#ff5c5c', success: '#3ddc97', warning: '#fdc921',
  },
};

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

/* Ask the server for a token. It decides the role; the page never names a preset.
   joinBody is { session_no, meeting_id? } for an OPIL class or { room: true, key } for the Academy room. */
async function joinTarget(cfg, token, joinBody, words) {
  const r = await fetch(cfg.FUNCTIONS_BASE + '/ea-rtk-join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(joinBody),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error({
      sign_in: 'Sign in again and retry.',
      not_allowed: words.notAllowed,
      not_open: words.notOpen,
      not_found: 'That session no longer exists.',
      bad_link: 'This link isn’t active anymore — ask ' + words.host + ' for the new one.',
      room_full: 'The room is full right now.',
      slow_down: 'Too many tries — wait a minute and try again.',
      rtk_not_configured: words.notConfigured,
    }[d.error] || ('The server said ' + r.status + '.'));
    e.code = d.error; e.status = r.status; throw e;
  }
  return d;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
/* the brand mark, when the target brought one: an <img> and nothing else — no logo, no markup (OPIL and the
   Academy pass none and keep today's DOM byte for byte). height is a hint for the moment before the stylesheet
   sizes it; the CSS (.r2-brand) is what actually sets the size. */
const brandMark = (logo, cls = 'r2-brand') => logo ? `<img class="${cls}" src="${esc(logo.src)}" alt="${esc(logo.alt)}"${Number.isFinite(logo.height) ? ` height="${Math.round(logo.height)}"` : ''}>` : '';
const OWN_BG_KEY = 'r2-own-backdrop';   /* the last photo someone chose, so it is one tap next class */
/* The Transcript tab is BUILT and correct, but Cloudflare sends us no transcript lines — not even
   for opil-host, whose preset has had transcription_enabled:true since 9/11. Rather than show a
   tab that reads "Nothing yet" for two hours of the AUC Kickoff, it is hidden (Nelson, 9/15).
   Flip this to true to bring it back — nothing else needs to change; the lines are still captured
   the whole time, so Tools > Save transcript keeps working the moment the server side is fixed.
   The two open server-side candidates are in gotcha-rtk-room-audio-echo-cpu: the LIVE opil-host
   preset's flag, and Workers AI billing (836 Neurons/min against a 10,000/day free tier). */
const SHOW_TRANSCRIPT = false;

/* "Use my own photo": pick an image, shrink it to 1280 wide, keep it as a data URL */
function pickOwnPhoto() {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return resolve(null);
      const img = new Image();
      img.onload = () => {
        const w = Math.min(1280, img.naturalWidth), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        const url = c.toDataURL('image/jpeg', 0.86); URL.revokeObjectURL(img.src);
        try { localStorage.setItem(OWN_BG_KEY, url); } catch (e) {}
        resolve(url);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(f);
    });
    inp.click();
  });
}
const ownPhoto = () => { try { return localStorage.getItem(OWN_BG_KEY); } catch (e) { return null; } };

/* mountRoomV2 — one call for every situation on the room page:
     mode 'waiting'  a student before the class starts (no kit, no token)
     mode 'student'  the class is running: preview → Enter Class → in class
     mode 'host'     Start class pressed: the meeting is opened now (onOpened gets the id),
                     preview → Enter Class (starts everything) → in class
   Returns { meetingId, host, leave(), end(), setRecording(bool) }. leave() leaves only; end() is the explicit
   end for everyone. onState gets ('joined' | 'left' | 'ended', meeting, reason) where reason is
   'left' | 'kicked' | 'ended' | 'dropped' — why the room went away ('dropped' = the connection died and two
   rejoin attempts failed); a page also hears ('reconnecting', m, 'dropped') when a rejoin starts and
   ('joined', m, 'rejoined') when it lands — both are safe to ignore. 'left' and 'ended' fire ONCE.
   o.target says where the room lives: { kind:'opil', session } (the default, today's OPIL behaviour byte
   for byte) or { kind:'room', id, title, key, slug?, words?, tokens?, logo?: { src, alt }, mark?: { src, alt } }
   (the Academy room, spec 2026-09-14-academy-room-design.md). slug, words, tokens, logo and mark are optional
   overrides (HT); when absent the defaults are the Academy's own (target.key/words/tokens/logo undefined leaves
   OPIL and Academy untouched). logo is a brand mark drawn inside the room so a guest who sees nothing but the
   room for an hour still sees whose room it is (HT, 9/15): the top of the join screen, where there is room for
   a full wordmark. mark is the small version for the head of the what's-happening-now strip — a monogram that
   stays legible and inside its minimum reproduction size at strip height, and leaves the status line its
   width on a phone; when absent the strip uses logo. No logo → not one extra byte of DOM. */
export async function mountRoomV2(o) {
  copy = await import('/opil/hub/live-rooms.js' + new URL(import.meta.url).search);
  /* the Small Groups board (its own module; a failure to load only loses that tool, never the room) */
  if (!sgMod) { try { sgMod = await import('/js/rtk-small-groups.js' + new URL(import.meta.url).search); } catch (e) { sgMod = null; } }
  if (!resMod) { try { resMod = await import('/js/rtk-resources.js' + new URL(import.meta.url).search); } catch (e) { resMod = null; } }
  const pluginNames = PLUGINS[o.target && o.target.kind ? o.target.kind : 'opil'] || [];
  await Promise.all(pluginNames.map(loadPlugin));
  const { mountEl, cfg, token, sb, user, mode, onState, onOpened } = o;
  const target = o.target || { kind: 'opil', session: o.session };
  /* (o.endsSession, the old "Leave ends it from the page that started the class", is read by nobody now:
     Leave leaves, whoever you are; End is its own action) */
  /* derived once; nothing below reads target.session again */
  const isRoom = target.kind === 'room';
  const session = isRoom ? null : target.session;
  const words = target.words || (isRoom ? copy.ROOM_WORDS : copy.OPIL_WORDS);
  const logo = (target.logo && target.logo.src) ? target.logo : null;   /* { src, alt, height? } or nothing */
  const mark = (target.mark && target.mark.src) ? target.mark : logo;   /* the strip's small mark; the logo when none */
  const label = isRoom ? target.title : copy.sessLabel(session) + ' · ' + session.title;
  const title = isRoom ? target.title : session.title;
  /* the day and time in the viewer's own clock (0039 stores Atlanta wall time; null time = not announced —
     the old page said "7:00 PM" for every session, which was wrong for the 6:30 kickoff) */
  const when = isRoom ? null : copy.classWhen({ date: session.session_date, start: session.start_time, end: session.end_time });
  const startsAt = when ? when.startsAt : null;
  /* the join screen's brand row: the Academy mark + name and the partner's logo on a paper-white tile
     (OPIL). A room target may bring its own `brand`; the HT room keeps its `logo` mark as before. */
  const brand = target.brand || (isRoom ? null : OPIL_BRAND);
  /* "You're joining as <name>" — the name the room will show, from the Lab Hub profile */
  const who = await myName(sb, user);
  const hands = isRoom
    ? { table: 'ea_room_hands', col: 'room_id', val: target.id, chan: 'hands-room-' + target.id }
    : { table: 'ea_opil_hands', col: 'session_no', val: session.no, chan: 'hands-' + session.no };
  /* OPIL keeps sending meeting_id; the server ignores it now and uses the session's stored one */
  const joinBody = isRoom ? { room: target.slug || true, key: target.key || null } : (o.meetingId ? { session_no: session.no, meeting_id: o.meetingId } : { session_no: session.no });
  const facilitator = isRoom ? (o.facilitator || words.host) : o.facilitator;
  mountEl.classList.add('r2host');
  document.body.classList.add('in-room', 'in-room-v2');

  /* ---------- waiting: no video library yet, just the promise of what happens next ---------- */
  if (mode === 'waiting') {
    mountEl.innerHTML = '';
    const screen = joinScreen({ label, title, startsAt, when, who, brand, live: false, host: false, facilitator, joined: 0, preview: false, words, isRoom, logo });
    mountEl.appendChild(screen);
    wirePrecheck(screen);
    /* attendance that takes itself: a waiting student is counted as waiting (spec §1) */
    let waitBeat = null; try { const pm = pluginMods.presence; if (pm && pm.startBeating) waitBeat = pm.startBeating(sb, roomKeyFor(target), 'waiting', pm.deviceWord(navigator.userAgent)); } catch (e) {}
    /* the Question of the day card, the cities line and Already here (spec §8) */
    let warmUi = null; try { const wm = pluginMods.warmup; if (wm && wm.mountWaiting) warmUi = wm.mountWaiting({ sb, copy, el, esc, user, uid: user.id, roomKey: roomKeyFor(target), session: isRoom ? null : session, container: screen.querySelector('.r2-join-left') }); } catch (e) { console.warn('[room] warm-up', e); }
    return { meetingId: null, leave: () => { stopPrecheck(); try { if (waitBeat) waitBeat.stop(); } catch (e) {} try { if (warmUi) warmUi.stop(); } catch (e) {} mountEl.innerHTML = ''; }, setRecording() {} };
  }
  stopPrecheck();   /* a camera check from the waiting screen must let go before the room takes the camera */

  /* ---------- the meeting object: for a host this is what OPENS the room ---------- */
  const join = await joinTarget(cfg, token, joinBody, words);
  if (mode === 'host' && onOpened) await onOpened(join.meeting_id);
  const { RealtimeKitClient, ui } = await loadKit();
  if (ui.provideRtkDesignSystem) {
    ui.provideRtkDesignSystem(mountEl, target.tokens || ACADEMY_TOKENS);
  }
  const host = !!join.host;
  const mediaConfiguration = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } };
  /* one init for the first meeting and for a rejoin after a drop (same token, or a fresh one) */
  const initKit = (authToken, audio, video) => RealtimeKitClient.init({ authToken, defaults: { audio, video, mediaConfiguration } });
  /* hosts arrive ready to teach; students arrive muted, camera off, and turn them on in one tap */
  const meeting = await initKit(join.token, host, host);
  let current = meeting;   /* the meeting this page is in: the main room, or a breakout room */
  try { window.__r2 = { get meeting() { return current; }, get effects() { return effects; } }; } catch (e) {}   /* support hook, read-only */

  /* ---------- effects (blur / backdrops), reused from v1's addon, driven by our own buttons ---------- */
  let effects = null, effectsError = null;
  /* the fast engine needs WebAssembly SIMD (older iPhones do not have it): probe once, fall back to plain wasm */
  const wasmSimd = (() => { try { return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); } catch (e) { return false; } })();
  async function loadEffects(m) {
    try {
      const { default: VideoBackground } = await import(VB_ADDON);
      effects = await VideoBackground.init({
        meeting: m, modes: ['blur', 'virtual'], blurStrength: 70, images: BACKDROPS.map(b => location.origin + b.url),
        /* the "meet" person model with edge smoothing: cleaner hair/shoulder edges than the default 256x256 model (Nelson, 9/15: the blur "wasn't that great").
           targetFps drives the loop that redraws the OUTGOING canvas, so it is also the video's frame rate — 24 matches the camera above. It was 30,
           which re-rendered ~6 frames a second the camera never produced. Do NOT lower it further to save CPU: the loop reschedules with
           Math.max(0, interval - elapsed), so a machine that cannot keep up already runs flat out and a lower target only makes the video choppier. */
        segmentationConfig: { model: 'meet', inputResolution: '256x144', pipeline: 'webgl2', backend: wasmSimd ? 'wasmSimd' : 'wasm', targetFps: 24 },
        postProcessingConfig: { smoothSegmentationMask: true, jointBilateralFilter: { sigmaSpace: 2, sigmaColor: 0.15 }, coverage: [0.45, 0.8], lightWrapping: 0.2 },
      });
      effectsError = null;
    } catch (e) { effects = null; effectsError = String((e && e.message) || e || 'unknown'); console.warn('[room] effects did not load:', effectsError); }
  }
  loadEffects(meeting);

  /* ---------- transcript lines: shown live in the Transcript tab, saved on request ----------
     Cloudflare only transcribes people whose PRESET has transcription_enabled (every role, since
     9/15 — rtk_presets.ts brings the live presets in line on the next host join). */
  const lines = [];
  const onLine = [];   /* the Transcript tab registers here to redraw when a line lands */
  const takeLine = (x) => { if (copy.addTranscript(lines, x)) onLine.forEach(f => { try { f(x); } catch (e) {} }); };
  /* the captions overlay wants every event as it comes, partials included: a second list, bound
     beside takeLine so a breakout meeting picks it up through the same keepTranscripts */
  const onRaw = [];
  const keepTranscripts = (m) => { try { (m.ai && m.ai.transcripts || []).forEach(takeLine); if (m.ai && m.ai.on) { m.ai.on('transcript', takeLine); m.ai.on('transcript', (x) => onRaw.forEach(f => { try { f(x); } catch (e) {} })); } } catch (e) {} };
  keepTranscripts(meeting);
  const whenSaid = (ts) => new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const transcript = { lines, whenSaid, watch: (f) => onLine.push(f), watchRaw: (f) => onRaw.push(f) };
  function saveTranscript() {
    const body = copy.transcriptText(lines, whenSaid);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([label + '\n' + new Date().toLocaleString() + '\n\n' + body + '\n'], { type: 'text/plain' }));
    a.download = (label.replace(/[^\w\- ]+/g, '').trim() || 'transcript') + ' transcript.txt';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- getting in ---------- */
  const joinedCount = () => { try { return meeting.participants.joined.toArray().length; } catch (e) { return 0; } };
  const screen = joinScreen({ label, title, startsAt, when, who: join.name || who, brand, live: true, host, facilitator, joined: joinedCount(), preview: true, words, isRoom, logo });
  mountEl.innerHTML = ''; mountEl.appendChild(screen);
  const preview = screen.querySelector('video');
  const attachPreview = () => {
    try {
      const t = meeting.self.videoTrack, box = screen.querySelector('.r2-preview'), ph = screen.querySelector('.r2-ph');
      if (t && preview && meeting.self.videoEnabled) { preview.srcObject = new MediaStream([t]); preview.play().catch(() => {}); box && box.classList.add('has-video'); }
      else {
        if (preview) preview.srcObject = null; box && box.classList.remove('has-video');
        if (ph) ph.innerHTML = meeting.self.videoEnabled ? '<b>Starting your camera…</b><span>If nothing shows in a few seconds, check the browser’s camera permission.</span>' : '<b>Your camera is off</b><span>Tap “Camera is off” below to turn it on and see how you look.</span>';
      }
    } catch (e) {}
  };
  /* Effects on the join screen: a small tray under the preview, same addon as in class */
  const fxChip = screen.querySelector('.r2-fx');
  if (fxChip) fxChip.addEventListener('click', () => {
    let tray = screen.querySelector('.r2-fxtray');
    if (tray) { tray.remove(); return; }
    tray = el(`<div class="r2-fxtray"><button type="button" data-fx="none">No effect</button><button type="button" data-fx="blur">Blur</button>${BACKDROPS.map(b => `<button type="button" data-fx="${b.url}">${b.name}</button>`).join('')}${ownPhoto() ? '<button type="button" data-fx="own">My photo</button>' : ''}<button type="button" data-fx="pick">Use my own photo…</button></div>`);
    tray.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', async () => {
      const kind = b.dataset.fx;
      if (!effects) { const old = b.textContent; b.textContent = effectsError ? 'Not on this device: ' + effectsError.slice(0, 60) : 'Loading…'; setTimeout(() => { b.textContent = old; }, effectsError ? 6000 : 1500); return; }
      try {
        if (kind === 'none') await effects.removeBackground();
        else if (kind === 'blur') await effects.applyBlurBackground();
        else if (kind === 'own') { const u = ownPhoto(); if (u) await effects.applyVirtualBackground(u); }
        else if (kind === 'pick') { const u = await pickOwnPhoto(); if (!u) return; await effects.applyVirtualBackground(u); if (!tray.querySelector('[data-fx="own"]')) b.insertAdjacentHTML('beforebegin', '<button type="button" data-fx="own" class="on">My photo</button>'); }
        else await effects.applyVirtualBackground(location.origin + kind);
      } catch (e) {}
      tray.querySelectorAll('[data-fx]').forEach(x => x.classList.toggle('on', x === b || (kind === 'pick' && x.dataset.fx === 'own')));
    }));
    screen.querySelector('.r2-preview').insertAdjacentElement('afterend', tray);
  });
  const chips = wireChips(screen, () => meeting, attachPreview, (msg) => { const t = el(`<div class="r2-toast">${esc(msg)}</div>`); screen.appendChild(t); setTimeout(() => t.remove(), 7000); });
  attachPreview();
  meeting.self.on('videoUpdate', () => { attachPreview(); chips.sync(); });
  meeting.self.on('audioUpdate', chips.sync);
  chips.sync();

  /* everyone presses Enter themselves — the tap is what lets a phone play sound (iOS blocks audio until then) */
  const enterBtn = screen.querySelector('.r2-enter'); const enterLabel = enterBtn.textContent;
  for (;;) {
    await new Promise((resolve) => { enterBtn.addEventListener('click', resolve, { once: true }); });
    enterBtn.disabled = true; enterBtn.textContent = host ? 'Starting…' : 'Entering…';
    try { await (meeting.join ? meeting.join() : meeting.joinRoom()); break; }
    catch (e) {   /* never a button stuck on "Entering…": say so, and let them try again */
      console.warn('[join]', e); enterBtn.disabled = false; enterBtn.textContent = enterLabel;
      const t = el('<div class="r2-toast" role="status">Couldn’t get you in. Tap Enter again — if it keeps failing, reload the page.</div>'); screen.appendChild(t); setTimeout(() => t.remove(), 8000);
    }
  }

  /* ---------- in class ---------- */
  const room = classRoom({ meeting, ui, host, isRoom, title, hands, words, facilitator, mark, brand, when, sb, user, saveTranscript, transcript, getEffects: () => effects, getEffectsError: () => effectsError, onLeave: leaveNow, onEnd: endNow, onSwitch: (m) => { current = m; }, rootId: meeting.meta && meeting.meta.meetingId });
  mountEl.innerHTML = ''; mountEl.appendChild(room.node);
  room.bind(meeting);
  if (!host) room.toast('You’re muted — tap Mic to talk.');
  if (onState) onState('joined', meeting);
  /* the plugins: one ctx, every feature */
  const plugins = [];
  {
    const ctx = room.pluginCtx({ sb, copy, el, esc, user, uid: user.id, host, isRoom, roomKey: roomKeyFor(target), judge: o.isJudge, admin: o.isAdmin, words, facilitator: facilitator || null, session: isRoom ? null : session, target: isRoom ? target : null, getMeeting: () => current, rootId: meeting.meta && meeting.meta.meetingId, now: () => Date.now() });
    for (const name of pluginNames) {
      const mod = pluginMods[name]; if (!mod || typeof mod.create !== 'function') continue;
      try { const p = mod.create(ctx); if (p) { plugins.push(p);
        try { if (p.pulseEl && p.placePulseAfter) p.placePulseAfter(room.node.querySelector('.r2-now')); } catch (e) {}   /* reactions: the host's Pulse strip under the Now line */
        try { p.start && p.start(); } catch (e) { console.warn('[room] plugin start:', name, e); }
        try { p.mount && p.mount(room.node.querySelector('.r2-pane[data-pane="people"]')); } catch (e) { console.warn('[room] plugin mount:', name, e); }   /* roster: the Class roster block in People */
      } }
      catch (e) { console.warn('[room] plugin create:', name, e); }
    }
    room.hooks.plugins = plugins;
    /* the host's Warm-up answers section under the Ready-to-speak queue */
    if (host) { try { const wp = plugins.find(p => p && typeof p.mountAnswers === 'function'); const pane = room.node.querySelector('.r2-pane[data-pane="queue"]'); if (wp && pane) wp.mountAnswers(pane); } catch (e) { console.warn('[room] warm-up answers', e); } }
  }
  room.hooks.emit('joined', meeting);

  /* breakout rooms hand the page a NEW meeting: rebind everything to it */
  let switching = false;
  const watchBreakouts = (mtg) => { try { mtg.connectedMeetings.on('changingMeeting', () => { switching = true; }); mtg.connectedMeetings.on('meetingChanged', onMeetingChanged); } catch (e) {} };
  const onMeetingChanged = async (next) => {
    current = next; room.bind(next); keepTranscripts(next); watchLeft(next); watchLink(next); await loadEffects(next);
    watchBreakouts(next);
    setTimeout(() => { switching = false; }, 1500);
  };
  watchBreakouts(meeting);

  /* ---------- the way out: once, and only for a reason ----------
     leaving  = we pressed Leave (the room keeps running; the page offers the way back in)
     ending   = we pressed End (everyone is removed first; the page closes the row)
     goneOnce = the page has been told; the kit can say roomLeft twice (its event + our explicit call) */
  let leaving = false, ending = false, goneOnce = false;
  const gone = (why, reason) => () => {
    if (switching || goneOnce) return;
    goneOnce = true;
    try { room.hooks.emit(why === 'ended' ? 'ended' : 'left', current, reason); } catch (e) {}
    room.destroy(); document.body.classList.remove('in-room', 'in-room-v2'); mountEl.innerHTML = '';
    if (onState) onState(why, current, reason);
  };
  /* roomLeft carries why (the kit's LeaveRoomState: kicked | ended | left | rejected | connected-meeting |
     disconnected | failed | stageLeft). 'left' (we pressed Leave), 'kicked' (a host removed you), 'ended' (the
     meeting ended) keep their word; 'connected-meeting' and 'stageLeft' are a move, not an exit (the breakout
     path rebinds); ANYTHING ELSE — 'disconnected', 'failed', 'rejected', an undefined state — is a drop: the
     connection died, not the class (9/15: the host's socket dropped and the page ended the class for
     everyone). A drop reconnects; it never reaches the page as 'left' until both attempts have failed. */
  const watchLeft = (mtg) => { try { mtg.self.on('roomLeft', (ev) => {
    /* a client being replaced by a rejoin says 'kicked' the moment the new one lands (same participant): not ours to hear */
    if (mtg !== current || mtg === replacing) return;
    const st = ev && ev.state;
    if (ending) return gone('ended', 'ended')();
    if (leaving) return gone('left', 'left')();
    const kind = copy.leftKind(st);
    if (kind === 'switch') return;
    if (kind === 'left') return gone('left', 'left')();
    if (kind === 'kicked') return gone('left', 'kicked')();
    if (kind === 'ended') return gone('ended', 'ended')();
    drop(st);
  }); } catch (e) {} };
  /* the kit's own socket: meta 'socketConnectionUpdate' { state: connected | disconnected | reconnecting | failed }.
     While it reconnects on its own, say so on the strip and freeze the mic/camera memory below (the kit turns
     both off while it tears a dead connection down, and that is not what the person had on); 'connected' again
     (or roomJoined { reconnected: true }) clears the strip; 'failed' is it giving up — the same drop as a
     roomLeft, guarded so the two never run twice. */
  let dropping = false, replacing = null, linkTimer = null;
  /* the kit reconnects on its own with a backoff and may never say 'failed' (a socket closed cleanly is not
     retried at all): a socket still not connected LINK_PATIENCE_MS after it went — the "disconnected meeting
     state" — is a drop too, and the rejoin below takes over (it checks first whether the kit got there itself) */
  const LINK_PATIENCE_MS = 15000;
  const linkGone = (mtg, why) => { clearTimeout(linkTimer); linkTimer = setTimeout(() => { linkTimer = null; if (mtg !== current || goneOnce) return; let up = false; try { up = mtg.meta.socketState && mtg.meta.socketState.state === 'connected'; } catch (e) {} if (!up) drop(why); }, LINK_PATIENCE_MS); };
  const watchLink = (mtg) => { try {
    mtg.meta.on('socketConnectionUpdate', (ev) => {
      if (mtg !== current || goneOnce || leaving || ending) return;
      const st = ev && ev.state;
      if (st === 'reconnecting' || st === 'disconnected') { mediaFrozen = true; if (!dropping) { room.reconnecting(copy.reconnectCopy(0)); linkGone(mtg, st); } }
      else if (st === 'connected') { clearTimeout(linkTimer); linkTimer = null; if (!dropping) { mediaFrozen = false; room.reconnecting(null); } }
      else if (st === 'failed') { clearTimeout(linkTimer); linkTimer = null; drop('failed'); }
    });
    mtg.self.on('roomJoined', (ev) => { if (mtg === current && ev && ev.reconnected && !dropping) { clearTimeout(linkTimer); linkTimer = null; mediaFrozen = false; room.reconnecting(null); } });
  } catch (e) {} };
  /* the kit mended it on its own (ROOM_NODE_RECONNECTED puts self.roomState back to 'joined' and says roomJoined
     { reconnected: true }): then there is nothing to rejoin — a second client for the same participant would only
     knock the mended one out. roomState is the word to trust: self.roomJoined is the media transport's memory and
     can still read true after the room node went. */
  const healed = (mtg) => { try { const rs = mtg.self.roomState; return typeof rs === 'string' ? rs === 'joined' : mtg.self.roomJoined === true; } catch (e) { return false; } };
  /* what the person had on, so a rejoin brings it back: the host's defaults until the kit says otherwise */
  let lastMedia = { audio: host, video: host }, mediaFrozen = false;
  const trackMedia = (mtg) => {
    const upd = () => { if (mediaFrozen || mtg !== current) return; try { lastMedia = { audio: !!mtg.self.audioEnabled, video: !!mtg.self.videoEnabled }; } catch (e) {} };
    try { mtg.self.on('audioUpdate', upd); mtg.self.on('videoUpdate', upd); } catch (e) {}
    upd();
  };
  watchLeft(meeting); watchLink(meeting); trackMedia(meeting);

  /* a rejoin after a drop: the same meeting, first with the token we have, then with a fresh one from the
     server (the join function reuses the running meeting for a host and for a guest alike). Mic and camera
     come back the way they were. The page is not told 'joined' again as a first join — reason 'rejoined'. */
  const freshToken = async () => { try { return (await sb.auth.getSession()).data.session?.access_token || token; } catch (e) { return token; } };
  async function rejoin(useFreshToken, media) {
    let tok = join.token;
    if (useFreshToken) { const j = await joinTarget(cfg, await freshToken(), joinBody, words); tok = j.token; }
    const next = await initKit(tok, media.audio, media.video);
    await (next.join ? next.join() : next.joinRoom());
    return next;
  }
  async function drop(state) {
    if (dropping || goneOnce || leaving || ending || switching) return;
    dropping = true; mediaFrozen = true;
    const media = lastMedia;
    room.reconnecting(copy.reconnectCopy(0));
    if (onState) onState('reconnecting', current, 'dropped');
    const back = (m) => { dropping = false; replacing = null; mediaFrozen = false; trackMedia(m); room.reconnecting(null); room.toast('You’re back in.'); if (onState) onState('joined', m, 'rejoined'); };
    for (let attempt = 0; ; attempt++) {
      const wait = copy.rejoinPlan('dropped', attempt);
      if (wait == null) break;
      await new Promise((r) => setTimeout(r, wait));
      if (goneOnce || leaving || ending) { dropping = false; return; }
      if (healed(current)) { back(current); return; }   /* the kit got there first: nothing to do */
      room.reconnecting(copy.reconnectCopy(attempt));
      const old = current; replacing = old;   /* from here the old client's own roomLeft is not ours to hear */
      try {
        const next = await rejoin(attempt > 0, media);
        /* Leave or End pressed while this attempt was in flight: the page has already been told 'left' — the client
           that just landed must not become a ghost in the meeting, and the page must never hear 'joined' after 'left' */
        if (goneOnce || leaving || ending) { try { Promise.resolve(next.leave()).catch(() => {}); } catch (e) {} dropping = false; replacing = null; return; }
        current = next; room.bind(next); keepTranscripts(next); watchLeft(next); watchLink(next); watchBreakouts(next); loadEffects(next);
        back(next);
        try { Promise.resolve(old.leave()).catch(() => {}); } catch (e) {}   /* let go of the camera and mic the dead client still holds; its roomLeft lands on a client that is not current */
        return;
      } catch (e) { replacing = null; console.warn('[room] rejoin ' + (attempt + 1) + ' failed:', String((e && e.message) || e || state)); }
    }
    dropping = false; room.reconnecting(null);
    /* both attempts failed: the page is told first (goneOnce swallows the roomLeft 'left' the leave below emits), then
       the dead client is told to leave — it releases the camera and mic and stops its own reconnecting. Without this
       the kit keeps retrying the socket behind the card and walks the person back in, mic and camera on, while their
       page says they are out; their Rejoin then puts them in twice. */
    gone('left', 'dropped')();
    try { Promise.resolve(current.leave()).catch(() => {}); } catch (e) {}
  }

  /* Leave: this person leaves; the class keeps running for everyone else, the recording keeps going,
     the row stays live. The same for a host — the way back in is one tap on the page. */
  async function leaveNow() {
    if (goneOnce || leaving || ending) return;
    leaving = true;
    try { await current.leave(); } catch (e) {}
    gone('left', 'left')();
  }
  /* End: the ONLY way a class ends. Everyone else is removed, then we leave; the page hears 'ended' and
     stops the recording and closes the row. Reached from Tools ("End the class for everyone", two taps)
     or a page's own End control, never from Leave. */
  async function endNow() {
    if (goneOnce || ending) return false;
    ending = true;
    /* everyone else out first. The kit lets only a preset with kick_participant do that (hosts — removing people
       is not a tool, rtk_presets.ts): when it refuses, nothing has ended, so nobody is told it has — the person
       stays in the room and is told who can end it. A host whose kickAll fails for a passing reason still ends. */
    let removed = false;
    try { if (current.participants.kickAll) { await current.participants.kickAll(); removed = true; } } catch (e) { console.warn('[room] kickAll refused:', String((e && e.message) || e)); }
    if (!removed && !host) { ending = false; room.toast('Only a host can end the ' + words.thing + ' for everyone — Leave takes you out.', 7000); return false; }
    try { await current.leave(); } catch (e) {}
    gone('ended', 'ended')();
    return true;
  }

  return {
    meetingId: join.meeting_id, host,
    leave: leaveNow,
    end: endNow,
    setRecording: (on) => room.setRecording(on),
  };
}

/* ---------- the join screen ---------- */
/* The OPIL join screen's brand row: the Academy mark + name, and the AUC Data Science Initiative on a
   paper-white tile (its logo is black type on transparent — unreadable on navy; Nelson's rule for the
   partner logos: paper-white only). */
const OPIL_BRAND = { mark: '/opil/email/logo-mark-white.png', name: 'Taylormade Academy', partner: { src: '/opil/aucdsi-black.png', alt: 'The AUC Data Science Initiative' } };   /* the RGBA original (240×153), crisp at 2×; the email's small copy has a baked white box */
/* the name the room will show for this person — the Lab Hub profile, else what they signed up with */
async function myName(sb, user) {
  try { const { data } = await sb.from('ea_profiles').select('display_name').eq('user_id', user.id).maybeSingle(); if (data && data.display_name) return data.display_name; } catch (e) {}
  const md = (user && user.user_metadata) || {};
  if (md.full_name || md.name) return md.full_name || md.name;
  /* a student who never filled a profile (10 of 31 on kickoff day): the name they applied with, never "kiara1.pee" */
  try { if (user && user.email) { const { data } = await sb.from('ea_opil_registrations').select('full_name').ilike('email', user.email).limit(1).maybeSingle(); if (data && data.full_name) return data.full_name; } } catch (e) {}
  return (user && user.email ? user.email.split('@')[0] : '') || 'You';
}
/* a camera check before the class exists (the waiting screen): plain getUserMedia, opt-in, released the
   moment the real room mounts (stopPrecheck) so the kit can take the camera */
let precheckStream = null;
function stopPrecheck() { try { if (precheckStream) precheckStream.getTracks().forEach(t => t.stop()); } catch (e) {} precheckStream = null; }
function wirePrecheck(screen) {
  const btn = screen.querySelector('.r2-chip[data-t="precheck"]'), box = screen.querySelector('.r2-preview'), video = screen.querySelector('video');
  if (!btn || !box || !video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  const say = (b, s) => { btn.querySelector('b').textContent = b; btn.querySelector('span').textContent = s; };
  btn.addEventListener('click', async () => {
    if (precheckStream) { stopPrecheck(); video.srcObject = null; box.classList.remove('has-video'); btn.classList.remove('on'); say('Check my camera', 'Turn it on to see how you look'); return; }
    btn.disabled = true; say('Starting your camera…', 'Allow the camera if your browser asks');
    try { precheckStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); video.srcObject = precheckStream; video.play().catch(() => {}); box.classList.add('has-video'); btn.classList.add('on'); say('Camera looks good!', 'Tap to turn it off again'); }
    catch (e) { say('Camera didn’t start', 'Allow the camera for taylormadeacademy.com, then tap again'); }
    btn.disabled = false;
  });
}
const ICON = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3"/></svg>',
};
/* The getting-in screen, after the concept board (2026-09-14, concept 3 "Getting into class"; Nelson 9/16:
   "getting in should look like this except with my real logo and the auc logo"). Brand row, a centered
   "You're in the right place." with the session and facilitator, a card that says the day, the class time
   and who you are joining as, the one gold button, the camera preview beside it — and, before the class
   exists, a bar that says what will happen next. Words over icons; every state readable as a sentence. */
function joinScreen({ label, title, startsAt, when, who, brand, live, host, facilitator, joined, preview, words, isRoom, logo }) {
  const line = copy.joinCopy({ live, host, facilitator, joined, startsAt: live ? null : startsAt }, words);
  const cta = !live && !host ? '' : `<div class="r2-go"><button type="button" class="r2-enter">${host && !live ? 'Start ' + esc(copy.capFirst(words.thing)) + ' →' : 'Enter ' + esc(copy.capFirst(words.thing)) + ' →'}</button>
      <p class="r2-under">${host ? 'You’ll join with your mic and camera on.' : 'You’ll be muted when you join. You can unmute anytime. ' + esc(copy.capFirst(words.thing)) + ' is recorded so you can rewatch it.'}</p></div>`;
  const brandRow = brand
    ? `<div class="r2-jbrand"><img class="r2-mark" src="${esc(brand.mark)}" alt=""><span class="r2-name">${esc(brand.name)}</span></div>${brand.partner ? `<div class="r2-jpartner"><img src="${esc(brand.partner.src)}" alt="${esc(brand.partner.alt)}"></div>` : ''}`
    : (logo ? `<div class="r2-jbrand">${brandMark(logo)}</div>` : '');
  const w = when || {};
  const dayLabel = w.today ? 'Today' : 'Date';
  const timeLine = w.time ? esc(w.time) : (isRoom ? 'When ' + esc(words.host) + ' opens the room' : 'When ' + esc(facilitator || words.host) + ' opens the room');
  const info = `<div class="r2-info">
      <div class="r2-cells2">
        <div class="r2-cell">${ICON.cal}<div><b>${dayLabel}</b><span>${w.day ? esc(w.day) : esc(title)}</span></div></div>
        <div class="r2-cell">${ICON.clock}<div><b>${esc(copy.capFirst(words.thing))} time</b><span>${timeLine}</span></div></div>
      </div>
      <div class="r2-cell r2-cell-who">${ICON.people}<div><b>You’re joining as</b><span>${esc(who || 'You')}</span></div></div>
    </div>`;
  const previewBox = preview
    ? `<div class="r2-preview"><video muted playsinline autoplay></video>
        <div class="r2-ph"><b>Your camera is off</b><span>Tap “Camera is off” below to turn it on and see how you look.</span></div>
        <div class="r2-chips">
          <button type="button" class="r2-chip" data-t="mic"><b></b><span></span></button>
          <button type="button" class="r2-chip" data-t="cam"><b></b><span></span></button>
          <button type="button" class="r2-chip r2-fx" data-t="fx"><b>Effects</b><span>Blur or a backdrop</span></button>
        </div></div>`
    : `<div class="r2-preview r2-precheck"><video muted playsinline autoplay></video>
        <div class="r2-ph"><b>Want to see how you look?</b><span>Optional. Nothing is shared until you enter.</span></div>
        <div class="r2-chips"><button type="button" class="r2-chip" data-t="precheck"><b>Check my camera</b><span>Turn it on to see how you look</span></button></div></div>`;
  const waitBar = !live && !host
    ? `<div class="r2-wait">
        <div class="r2-wait-a">${ICON.clock}<div><b>${esc(copy.capFirst(words.thing))} hasn’t started yet. You’re all set!</b><span>${startsAt ? 'The ' + esc(words.thing) + ' will start at ' + esc(startsAt) + '.' : 'It starts when ' + esc(facilitator || words.host) + ' opens the room.'}</span></div></div>
        <div class="r2-wait-b"><b>Here’s what will happen next:</b><ol><li>Stay on this page — it opens by itself when ${esc(words.thing)} starts. No need to refresh.</li><li>Tap the gold Enter ${esc(copy.capFirst(words.thing))} button when it appears.</li><li>You’ll see everyone, and ${esc(facilitator || copy.capFirst(words.host))} will know you’re here.</li></ol></div>
        <div class="r2-wait-c">${ICON.cup}<b>While you wait…</b><span>Grab some water, get comfortable, and you’re good to go.</span></div>
      </div>`
    : '';
  return el(`<section class="r2-join${live ? ' live' : ' waiting'}">
    <header class="r2-jhead">
      ${brandRow}
      <div class="r2-jtitle"><div class="r2-kicker">You’re in the right place.</div><h2 class="r2-title">${esc(label)}</h2>${facilitator && !host ? `<p class="r2-with">with ${esc(facilitator)}</p>` : ''}</div>
    </header>
    <div class="r2-jgrid">
      <div class="r2-join-left">
        ${live || isRoom ? `<p class="r2-line">${esc(line)}</p>` : ''}
        ${info}
        ${cta}
        <p class="r2-fine">No downloads. Works in your browser.</p>
      </div>
      <div class="r2-join-right">${previewBox}</div>
    </div>
    ${waitBar}
  </section>`);
}

/* the two word-chips (mic / camera) — shared by the join screen and the class bar */
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' did not respond')), ms))]);
const MEDIA_HELP = { mic: 'Your mic didn’t turn on. Allow the microphone for taylormadeacademy.com in your browser (Safari: Settings ▸ Websites ▸ Microphone), then tap again.', cam: 'Your camera didn’t turn on. Allow the camera for taylormadeacademy.com in your browser (Safari: Settings ▸ Websites ▸ Camera), close any other app using it, then tap again.' };
function wireChips(root, getMeeting, onVideo, onError) {
  const mic = root.querySelector('.r2-chip[data-t="mic"]'), cam = root.querySelector('.r2-chip[data-t="cam"]');
  const sync = () => {
    const s = getMeeting().self;
    const c = copy.stateCopy({ audio: !!s.audioEnabled, video: !!s.videoEnabled });
    if (mic) { mic.querySelector('b').textContent = c.mic[0]; mic.querySelector('span').textContent = c.mic[1]; mic.classList.toggle('on', !!s.audioEnabled); }
    if (cam) { cam.querySelector('b').textContent = c.cam[0]; cam.querySelector('span').textContent = c.cam[1]; cam.classList.toggle('on', !!s.videoEnabled); }
  };
  const flip = async (btn, kind) => {
    const s = getMeeting().self; const on = kind === 'mic' ? s.audioEnabled : s.videoEnabled;
    btn.disabled = true;
    try { await withTimeout(kind === 'mic' ? (on ? s.disableAudio() : s.enableAudio()) : (on ? s.disableVideo() : s.enableVideo()), 12000, kind); }
    catch (e) { if (!on && onError) onError(MEDIA_HELP[kind], e); }
    btn.disabled = false; sync(); if (kind === 'cam' && onVideo) onVideo();
    /* a browser that reports success but never turns the track on: say so instead of a chip that reads "on" */
    if (!on && kind === 'cam' && onError) setTimeout(() => { const t = getMeeting().self; if (t.videoEnabled && !t.videoTrack) onError(MEDIA_HELP.cam); }, 3000);
  };
  if (mic) mic.addEventListener('click', () => flip(mic, 'mic'));
  if (cam) cam.addEventListener('click', () => flip(cam, 'cam'));
  return { sync };
}

/* ---------- in class ---------- */
function classRoom({ meeting, ui, host, isRoom, title, hands: handsAt, words, facilitator, mark, brand, when, sb, user, saveTranscript, transcript, getEffects, getEffectsError, onLeave, onEnd, onSwitch, rootId }) {
  const ec = copy.endCopy(words);   /* the Leave / End words, from the room's own noun */
  /* the top of the room, after the boards (Nelson 9/16): the brand · the class with who/when · "Class is live /
     You're in the class" — then the gold "What's happening now:" pill with the sentence, and the recording note */
  const headBrand = brand
    ? `<div class="r2-jbrand r2-head-brand"><img class="r2-mark" src="${esc(brand.mark)}" alt=""><span class="r2-name">${esc(brand.name)}</span></div>`
    : (mark ? `<div class="r2-head-brand">${brandMark(mark, 'r2-brand r2-brand-strip')}</div>` : '');
  const w = when || {};
  const node = el(`<div class="r2">
    <div class="r2-head">
      ${headBrand}
      <div class="r2-head-title"><b>${esc(title)}</b><span class="r2-head-sub"></span></div>
      <div class="r2-head-live"><b><i></i><span class="r2-head-state"></span></b><span class="r2-head-you"></span></div>
    </div>
    <div class="r2-now"><span class="r2-now-pill">What’s happening now:</span><span class="r2-dot" hidden></span><span class="r2-nowtxt"></span><span class="r2-rec" hidden>Recording <b class="r2-rectime"></b> · saves automatically for ${esc(words.replayFor)}</span><span class="r2-rec-note" hidden>This ${esc(words.thing)} is being recorded.</span></div>
    <div class="r2-note" role="status" hidden></div>
    <div class="r2-main">
      <div class="r2-stage">
        <rtk-ui-provider>
          <rtk-grid class="r2-grid"></rtk-grid>
          <rtk-grid-pagination class="r2-pages"></rtk-grid-pagination>
          <rtk-participants-audio></rtk-participants-audio>
          <rtk-notifications></rtk-notifications>
          <rtk-dialog-manager></rtk-dialog-manager>
        </rtk-ui-provider>
        <div class="r2-cc" role="region" aria-label="Captions" hidden></div>
        <div class="r2-reconnect" role="status" hidden></div>
        <div class="r2-show" role="region" aria-label="Shown to the class" hidden></div>
      </div>
      <aside class="r2-panel">
        <div class="r2-tabs">
          ${host ? '<button type="button" class="r2-tab" data-tab="queue">Questions <em>0</em></button>' : ''}
          <button type="button" class="r2-tab" data-tab="chat">Chat</button>
          <button type="button" class="r2-tab" data-tab="people">People <em></em></button>
          <button type="button" class="r2-tab" data-tab="polls">Polls <em></em></button>
          ${SHOW_TRANSCRIPT ? '<button type="button" class="r2-tab" data-tab="transcript">Transcript <em></em></button>' : ''}
          ${isRoom ? '' : '<button type="button" class="r2-tab" data-tab="files">Files <em></em></button>'}
        </div>
        <div class="r2-pane" data-pane="queue" hidden><div class="r2-queue-head">Ready to speak</div><div class="r2-queue"></div></div>
        <div class="r2-pane" data-pane="chat" hidden><rtk-chat></rtk-chat></div>
        <div class="r2-pane" data-pane="people" hidden>${host ? '<div class="r2-stagelist"></div>' : ''}<rtk-participants></rtk-participants></div>
        <div class="r2-pane" data-pane="polls" hidden><rtk-polls></rtk-polls></div>
        ${SHOW_TRANSCRIPT ? '<div class="r2-pane" data-pane="transcript" hidden><div class="r2-transcript"></div></div>' : ''}
        ${isRoom ? '' : '<div class="r2-pane" data-pane="files" hidden><div class="r2-files"></div></div>'}
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
        ${isRoom ? '' : '<button type="button" class="r2-btn r2-files-btn">Files</button>'}
        <button type="button" class="r2-btn r2-tools">Tools</button>
        <!-- Share my screen, Effects and Captions live in Tools (Nelson 9/16: "simplify it"); these two stay in the DOM, hidden, because the rest of the room reads their pressed state -->
        <button type="button" class="r2-btn r2-share" aria-pressed="false" hidden>Share my screen</button>
        <button type="button" class="r2-btn r2-cc-btn" aria-pressed="false" hidden>Captions</button>
        <button type="button" class="r2-leave">Leave</button>
      </div>
    </div>
    <div class="r2-sheet" role="dialog" aria-modal="true" aria-labelledby="r2SheetTitle" hidden>
      <div class="r2-sheet-card">
        <div class="r2-sheet-head"><b id="r2SheetTitle">Tools</b><button type="button" class="r2-sheet-close">Close</button></div>
        <div class="r2-sheet-body"></div>
      </div>
    </div>
  </div>`);
  const q = (s) => node.querySelector(s);
  let m = meeting, recording = !host, pinnedId = null;   /* every class records; students are told so, hosts are told once it actually starts */

  /* the strip. No facilitator filed for this session (the AI Thread, a stand-in)? Then whoever holds the
     host preset is teaching — the reader is told a name, never "class in progress". */
  const hostName = () => { try { if (host) return m.self.name || null; const p = m.participants.joined.toArray().find(x => /host/.test(String(x.presetName || ''))); return p ? p.name : null; } catch (e) { return null; } };
  /* a small group is any meeting that is not the one this page started in (the kit's parentMeeting is
     unreliable: it points at the meeting itself in the main room and is empty inside a fresh child) */
  const inBreakout = () => { try { return !!(rootId && m.meta && m.meta.meetingId && m.meta.meetingId !== rootId); } catch (e) { return false; } };
  /* this build has no moveToParentMeeting: moving yourself is moveParticipants(here, root, [me]).
     The id the API wants is the one in getConnectedMeetings() (a room re-issues participant ids), so
     find yourself there by customParticipantId, never trust m.self.id. */
  const myIdIn = async (meetingId) => {
    const cm = m.connectedMeetings; const list = await cm.getConnectedMeetings();
    const rooms = [list.parentMeeting].concat(list.meetings || []).filter(Boolean);
    const here = rooms.find(r => r.id === meetingId); const mine = m.self.customParticipantId;
    const me = here && (here.participants || []).find(x => x.customParticipantId === mine);
    if (!me) throw new Error('could not find you in this room');
    return me.id;
  };
  const goToRoot = async () => { const cm = m.connectedMeetings; await cm.moveParticipants(m.meta.meetingId, rootId, [await myIdIn(m.meta.meetingId)]); };
  let sg = null, sgStarted = false;   /* the Small Groups board + the student's side of it (created once loadHands exists; declared here because setNow reads it) */
  let res = null, resStarted = false;  /* Files for the class (OPIL sessions) */
  const setNow = () => {
    const lf = inBreakout() && sg ? sg.left() : null;   /* the clock, when the host set one */
    const breakout = inBreakout() ? { name: (m.meta && m.meta.meetingTitle) || 'your room', left: lf ? lf.text : null, over: !!(lf && lf.over) } : null;
    const who = facilitator || hostName();
    const line = copy.nowCopy({ facilitator: who, title, recording: false, breakout }, words);
    const nt = q('.r2-nowtxt'), cut = breakout ? -1 : line.indexOf(': ');
    if (cut > 0) nt.innerHTML = esc(line.slice(0, cut + 1)) + ' <b>' + esc(line.slice(cut + 2)) + '</b>'; else nt.textContent = line;   /* "Casey Dike is teaching: <b>the title</b>" */
    q('.r2-rec').hidden = !recording || !host;
    q('.r2-rec-note').hidden = !(recording && !host && !breakout);
    /* the header: who · when, and the live word for where you are */
    const sub = q('.r2-head-sub'); if (sub) sub.textContent = [who, w.day, w.time].filter(Boolean).join(' · ');
    const st = q('.r2-head-state'), you = q('.r2-head-you');
    /* the clock is news in the main room too: a host (or a student not moved) sees "Small groups running · 07:12 left" */
    const running = !breakout && sg ? sg.left() : null;
    if (st) st.textContent = breakout ? 'Small groups' + (lf ? (lf.over ? ' · Time’s up' : ' · ' + lf.text + ' left') : '') : running ? 'Small groups running · ' + (running.over ? 'Time’s up' : running.text + ' left') : copy.capFirst(words.thing) + ' is live';
    node.classList.toggle('groups-running', !!running);
    /* the host's big button turns into the way to the board while rooms are open; the clock in it updates in place */
    if (host && !breakout) { const btn = q('.r2-primary .r2-sg-open'); if (!!btn !== !!running) renderPrimary(); else if (btn) btn.querySelector('b').textContent = 'Small groups · ' + (running.over ? 'Time’s up' : running.text + ' left'); }
    if (you) you.textContent = breakout ? 'You’re in ' + breakout.name : (host ? 'You’re teaching' : 'You’re in the ' + words.thing);
    node.classList.toggle('in-breakout', !!breakout);
  };
  let recStart = null, recTick = null;
  const setRecording = (on) => {
    recording = on;
    if (on && host && !recStart) { recStart = Date.now(); const tick = () => { const s = Math.floor((Date.now() - recStart) / 1000); q('.r2-rectime').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, '0')).join(':'); }; tick(); recTick = setInterval(tick, 1000); }
    if (!on && recTick) { clearInterval(recTick); recTick = null; recStart = null; }
    setNow();
  };
  setNow();

  /* mic / camera in words — wired once; a breakout switch only re-points them at the new meeting */
  const chips = wireChips(node, () => m, null, (msg) => toast(msg, 7000));
  const bindSelf = () => { try { m.self.on('audioUpdate', chips.sync); m.self.on('videoUpdate', chips.sync); m.self.on('screenShareUpdate', syncShare); } catch (e) {} chips.sync(); syncShare(); };

  /* the side panel (desktop) / sheet (phone) */
  /* The kit's grid measures itself with a resize observer that can miss the first layout: tiles sit
     tiny for up to half a minute. Wiggling the grid's own height by a hair forces a real size change,
     which the observer cannot ignore. Repeated a few times because the kit re-creates the inner grid. */
  const nudge = () => [80, 600, 1500, 3000, 6000].forEach(ms => setTimeout(() => {
    try {
      const g = node.querySelector('.r2-grid'); if (!g) return;
      g.style.height = 'calc(100% - 1px)';
      setTimeout(() => { g.style.height = ''; try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 40);   /* not rAF: a background tab never paints */
    } catch (e) {}
  }, ms));
  const showPane = (name) => {
    node.querySelectorAll('.r2-pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
    node.querySelectorAll('.r2-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    node.classList.add('panel-open'); nudge();
  };
  node.querySelectorAll('.r2-tab').forEach(t => t.addEventListener('click', () => showPane(t.dataset.tab)));
  q('.r2-open').addEventListener('click', () => showPane(host ? 'queue' : 'chat'));
  { const fb = q('.r2-files-btn'); if (fb) fb.addEventListener('click', () => showPane('files')); }   /* Files, one tap from the bar (Nelson 9/16: whoever has the spotlight needs it fast) */
  q('.r2-close').addEventListener('click', () => { node.classList.remove('panel-open'); nudge(); });
  const peopleCount = () => { try { const n = m.participants.joined.toArray().length + 1; q('.r2-tab[data-tab="people"] em').textContent = n; } catch (e) {} renderStageList(); };
  /* the host's spotlight list (Nelson 9/16: "a button jamal can press to bring anyone to the spotlight without them
     asking a question"): every name in the room with Put on stage / Take off stage — a pin, no question needed */
  function renderStageList() {
    const box = q('.r2-stagelist'); if (!box) return;
    let people = []; try { people = m.participants.joined.toArray(); } catch (e) {}
    box.innerHTML = people.length
      ? '<div class="r2-queue-head">On stage</div>' + people.map(p => `<div class="r2-hand${p.isPinned ? ' staged' : ''}"><div class="r2-who"><b>${esc(p.name || 'Someone')}</b><span>${p.isPinned ? 'On stage now' : (p.videoEnabled ? 'Camera on' : 'Camera off')}</span></div><button type="button" class="r2-mini${p.isPinned ? '' : ' r2-bring'}" data-pin="${esc(p.id)}">${p.isPinned ? 'Take off stage' : 'Put on stage'}</button></div>`).join('')
      : '<div class="r2-queue-head">On stage</div><div class="r2-empty">When people are in the room, each one gets a Put on stage button here.</div>';
    box.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', async () => {
      const p = people.find(x => x.id === b.dataset.pin); if (!p) return; b.disabled = true;
      try {
        if (p.isPinned) { await p.unpin(); pinnedId = null; }
        else { people.forEach(x => { if (x.isPinned && x.id !== p.id) { try { x.unpin(); } catch (e) {} } }); try { if (m.self.isPinned) m.self.unpin(); } catch (e) {} await p.pin(); pinnedId = p.customParticipantId; }
      } catch (e) { console.warn('[stage]', e); toast('Could not change the stage. Try again.'); }
      setTimeout(renderStageList, 400);
    }));
  }

  /* the question queue */
  let hands = [];
  const uid = user.id;
  const primary = q('.r2-primary');
  const nameOf = (id) => { try { const p = m.participants.joined.toArray().find(x => x.customParticipantId === id); return p ? p.name : null; } catch (e) { return null; } };
  const renderPrimary = () => {
    if (inBreakout()) {
      if (sg) sg.primary(primary);   /* Ask for help (students) + Back to the main room */
      else {
        primary.innerHTML = `<button type="button" class="r2-cta r2-back"><b>Back to the main room</b><span>Leaves this small group</span></button>`;
        primary.querySelector('.r2-back').addEventListener('click', async (ev) => { const b = ev.currentTarget; b.disabled = true; try { await goToRoot(); } catch (e) { console.warn('[back]', e); toast('Could not move you back. Tap it again — or press Leave and reopen your link.'); b.disabled = false; } });
      }
      const em = q('.r2-tab[data-tab="queue"] em'); if (em) em.textContent = copy.queueOrder(hands).length;
      return;
    }
    if (host) {
      const running = sg ? sg.left() : null;
      if (running) {   /* rooms are open: the one big button is the board */
        primary.innerHTML = `<button type="button" class="r2-cta r2-sg-open"><b>Small groups · ${esc(running.over ? 'Time’s up' : running.text + ' left')}</b><span>Open the board — join a room, message, bring everyone back</span></button>`;
        primary.querySelector('.r2-sg-open').addEventListener('click', () => openSheet('Small groups', sg.board()));
        const em0 = q('.r2-tab[data-tab="queue"] em'); if (em0) em0.textContent = copy.queueOrder(hands).length;
        return;
      }
      const next = copy.nextInLine(hands);
      const nm = next ? (nameOf(next.user_id) || 'the next person') : null;
      primary.innerHTML = next
        ? `<button type="button" class="r2-cta r2-stage-btn"><b>Bring ${esc(nm)} on stage</b><span>${copy.queueOrder(hands).length} in line</span></button>`
        : `<button type="button" class="r2-cta" disabled><b>No one in line</b><span>Questions show up here</span></button>`;
      const b = primary.querySelector('.r2-stage-btn'); if (b) b.addEventListener('click', () => bringOnStage(next));
    } else {
      const pos = copy.queuePosition(hands, uid);
      const ac = copy.askLineCopy(pos);
      primary.innerHTML = `<button type="button" class="r2-cta${pos ? ' on' : ''}"><b>${esc(ac.b)}</b><span>${esc(ac.s)}</span></button>`;
      primary.querySelector('.r2-cta').addEventListener('click', () => pos ? leaveLine() : askQuestion());
    }
    const em = q('.r2-tab[data-tab="queue"] em'); if (em) em.textContent = copy.queueOrder(hands).length;
  };
  const renderQueue = () => {
    const box = q('.r2-queue'); if (!box) return;
    const rows = copy.queueOrder(hands);
    box.innerHTML = rows.length ? rows.map((r, i) => `<div class="r2-hand${r.staged_at ? ' staged' : ''}"><span class="r2-n">${i + 1}</span><div class="r2-who"><b>${esc(nameOf(r.user_id) || copy.capFirst(words.one))}</b><span>${r.kind === 'comment' ? 'Would like to comment' : 'Has a question'}${r.staged_at ? ' · on stage' : ''}</span></div><button type="button" class="r2-mini r2-bring" data-id="${r.id}">Bring on stage</button><button type="button" class="r2-mini r2-done" data-id="${r.id}">Done</button></div>`).join('')
      : '<div class="r2-empty">' + esc(copy.queueEmptyCopy()) + '</div>';
    box.querySelectorAll('.r2-bring').forEach(b => b.addEventListener('click', () => bringOnStage(hands.find(h => h.id === b.dataset.id))));
    box.querySelectorAll('.r2-done').forEach(b => b.addEventListener('click', () => markDone(hands.find(h => h.id === b.dataset.id))));
    /* a host who is not the one teaching (a coordinator sitting in) gets in the same line as everyone
       else; their big button stays Bring on stage, so the Ask button lives here (Nelson, 9/15) */
    if (host) {
      const pos = copy.queuePosition(hands, uid), ac = copy.askLineCopy(pos);
      const b = el(`<button type="button" class="r2-cta r2-ask-me${pos ? ' on' : ''}"><b>${esc(ac.b)}</b><span>${esc(ac.s)}</span></button>`);
      b.addEventListener('click', () => pos ? leaveLine() : askQuestion());
      box.appendChild(b);
    }
  };
  /* the Transcript tab: every final line as it lands, newest at the bottom, sticky to the bottom
     unless the reader has scrolled up. Only people whose preset is transcribed appear. */
  const tbox = q('.r2-transcript');
  const tcount = () => { const em = q('.r2-tab[data-tab="transcript"] em'); if (em) em.textContent = transcript.lines.length || ''; };
  const renderTranscript = () => {
    if (!tbox) return;
    const atBottom = tbox.scrollHeight - tbox.scrollTop - tbox.clientHeight < 40;
    tbox.innerHTML = transcript.lines.length
      ? transcript.lines.map(x => `<div class="r2-tline"><span class="r2-twhen">${esc(transcript.whenSaid(copy.saidAt(x)))}</span><b>${esc(x.name || 'Someone')}</b><span class="r2-ttext">${esc(x.transcript)}</span></div>`).join('')
      : '<div class="r2-empty">Nothing yet. Lines appear here as people talk — only those whose role is transcribed.</div>';
    if (atBottom) tbox.scrollTop = tbox.scrollHeight;
    tcount();
  };
  transcript.watch(renderTranscript); renderTranscript();
  /* captions over the video (Nelson, 9/15: "show the transcriptions as she talks with the option
     to turn it off too"): the last two lines, partials included, for everyone. Off until you tap
     Captions; the choice is remembered on this device. The raw listener is bound per meeting
     (keepTranscripts), so turning captions on inside a small group works the same. */
  const CC_KEY = 'r2-captions', CC_HINT_MS = 6000;
  const ccBox = q('.r2-cc'), ccBtn = q('.r2-cc-btn');
  let ccOn = false; try { ccOn = localStorage.getItem(CC_KEY) === '1'; } catch (e) {}
  let caps = [], ccWarned = false, ccSeen = false, ccOnAt = 0;
  /* only people whose PRESET is transcribed are captioned. Every preset these rooms use says so now (9/15:
     the Academy guest was the last one off); the "host's words" hint and notice stay as the honest fallback
     for a live preset the join function has not brought in line yet. */
  const ccMine = () => { try { return m.self.permissions.transcriptionEnabled === true; } catch (e) { return false; } };
  const ccHint = () => ccMine() ? 'Captions appear here as people speak.' : 'Captions appear here when the host speaks.';
  const paintCC = () => {
    if (!ccBox) return;
    if (caps.length) { ccBox.innerHTML = caps.map(c => `<div class="r2-cc-line${c.final ? '' : ' partial'}"><b>${esc(c.name)}</b>${esc(c.text)}</div>`).join(''); return; }
    /* the hint shows until the first caption ever lands, and for a few seconds after Captions goes
       on; after that a pause shows nothing, like any caption track (the grid is pointer-events:none) */
    ccBox.innerHTML = (!ccSeen || Date.now() - ccOnAt < CC_HINT_MS) ? `<div class="r2-cc-line r2-cc-empty">${esc(ccHint())}</div>` : '';
  };
  const syncCC = () => { if (ccBtn) ccBtn.setAttribute('aria-pressed', ccOn ? 'true' : 'false'); if (ccBox) ccBox.hidden = !ccOn; if (ccOn) paintCC(); };
  if (ccBtn) ccBtn.addEventListener('click', () => {
    ccOn = !ccOn; try { localStorage.setItem(CC_KEY, ccOn ? '1' : '0'); } catch (e) {}
    if (ccOn) ccOnAt = Date.now();
    syncCC();
    /* say so once, the first time captions go on for someone whose own voice isn't transcribed */
    if (ccOn && !ccWarned && !ccMine()) { ccWarned = true; toast('Your voice isn’t captioned in this room — the host’s words are.', 7000); }
  });
  if (transcript.watchRaw) transcript.watchRaw((x) => { caps = copy.takeCaption(caps, x, Date.now()); if (caps.length) ccSeen = true; if (ccOn) paintCC(); });
  const ccTick = setInterval(() => { caps = copy.takeCaption(caps, null, Date.now()); if (ccOn) paintCC(); }, 2000);   /* finals fade on their own; cleared in destroy() */
  if (ccOn) ccOnAt = Date.now();
  syncCC();
  const loadHands = async () => { const { data } = await sb.from(handsAt.table).select('*').eq(handsAt.col, handsAt.val).is('done_at', null).order('created_at'); hands = data || []; renderPrimary(); renderQueue(); if (sg) sg.onHands(); };
  async function askQuestion() { const { error } = await sb.from(handsAt.table).insert({ [handsAt.col]: handsAt.val, user_id: uid, kind: 'question' }); if (error && error.code !== '23505') { console.warn('[hands]', error.message); toast('Could not add you to the line. Try again.'); }; await loadHands(); }
  async function leaveLine() { await sb.from(handsAt.table).delete().eq(handsAt.col, handsAt.val).eq('user_id', uid).is('done_at', null); await loadHands(); }
  async function markDone(h) { if (!h) return; await sb.from(handsAt.table).update({ done_at: new Date().toISOString() }).eq('id', h.id); if (pinnedId === h.user_id) { unpin(); } await loadHands(); }
  async function bringOnStage(h) {
    if (!h) return;
    try {
      const p = m.participants.joined.toArray().find(x => x.customParticipantId === h.user_id);
      if (!p) { toast((nameOf(h.user_id) || 'That ' + words.one) + ' isn’t in the room right now.'); return; }
      m.participants.joined.toArray().forEach(x => { if (x.isPinned && x.id !== p.id) { try { x.unpin(); } catch (e) {} } });
      try { if (m.self.isPinned) m.self.unpin(); } catch (e) {}
      await p.pin(); pinnedId = h.user_id;
      /* the previous person on stage is done; this one is on stage now */
      const prev = hands.find(x => x.staged_at && x.id !== h.id); if (prev) await sb.from(handsAt.table).update({ done_at: new Date().toISOString() }).eq('id', prev.id);
      await sb.from(handsAt.table).update({ staged_at: new Date().toISOString() }).eq('id', h.id);
      await loadHands();
    } catch (e) { console.warn('[stage]', e); toast('Could not bring them on stage. Ask them to unmute.'); }
  }
  function unpin() { try { m.participants.joined.toArray().forEach(x => { if (x.isPinned) x.unpin(); }); } catch (e) {} pinnedId = null; }
  let handsChan = null, handsTimer = null;
  const watchHands = () => { try { handsChan = sb.channel(handsAt.chan).on('postgres_changes', { event: '*', schema: 'public', table: handsAt.table, filter: handsAt.col + '=eq.' + handsAt.val }, loadHands).subscribe(); } catch (e) {} handsTimer = setInterval(loadHands, 15000); };
  /* Small groups: the board in Tools, the clock in the strip, Ask for help + notes inside a room */
  if (sgMod) {
    try {
      sg = sgMod.createSmallGroups({
        sb, copy, el, esc, key: isRoom ? 'room-' + handsAt.val : String(handsAt.val), isRoom, words, host, uid, rootId,
        getMeeting: () => m, myIdIn, toast, confirmInline, facilitator: facilitator || null,
        hands: { rows: () => hands, load: loadHands, table: handsAt.table, col: handsAt.col, val: handsAt.val },
        onTick: () => { try { setNow(); } catch (e) {} },
        closeSheet: () => closeSheet(),
      });
      sg.bindNote(q('.r2-note'));
    } catch (e) { sg = null; }
  }
  /* Files for the class: the Files tab and the stage overlay (OPIL sessions; the Academy/HT rooms have no materials table) */
  if (resMod && !isRoom && q('.r2-files')) {
    try {
      res = resMod.createResources({ sb, copy, el, esc, sessionNo: handsAt.val, uid, host, getMeeting: () => m, toast, paneEl: q('.r2-files'), stageEl: q('.r2-show'), countEl: q('.r2-tab[data-tab="files"] em') });
    } catch (e) { res = null; }
  }

  /* the sheet: the same Tools for everyone — host and guest (Nelson, 9/15: "every single person should
     have access to ALL THE TOOLS on every platform"). The preset decides what the kit lets a tap do;
     rtk_presets.ts opens screen share, polls, chat files, pin and small groups to every role. */
  const sheet = q('.r2-sheet'), sheetBody = q('.r2-sheet-body');
  const openSheet = (titleTxt, inner) => { q('.r2-sheet-head b').textContent = titleTxt; sheetBody.innerHTML = ''; sheetBody.appendChild(inner); q('.r2-sheet-card').classList.toggle('wide', !!(inner.classList && inner.classList.contains('r2-board'))); sheetBack = document.activeElement; sheet.hidden = false; try { q('.r2-sheet-close').focus(); } catch (e) {} };
  const closeSheet = () => { sheet.hidden = true; sheetBody.innerHTML = ''; try { if (sheetBack && sheetBack.isConnected) sheetBack.focus(); } catch (e) {} sheetBack = null; };
  let sheetBack = null;
  q('.r2-sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  node.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  const effectsPane = () => {
    const p = el(`<div class="r2-fxpane"><button type="button" class="r2-btn" data-fx="none">No effect</button><button type="button" class="r2-btn" data-fx="blur">Blur my background</button>${BACKDROPS.map(b => `<button type="button" class="r2-btn" data-fx="${b.url}">${b.name} backdrop</button>`).join('')}${ownPhoto() ? '<button type="button" class="r2-btn" data-fx="own">My photo</button>' : ''}<button type="button" class="r2-btn" data-fx="pick">Use my own photo…</button><p class="r2-fine">Effects can take a few seconds the first time. Your own photo stays on this device only.</p></div>`);
    p.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', async () => {
      const fx = getEffects(); if (!fx) { toast(getEffectsError && getEffectsError() ? 'Effects can’t run in this browser. Your camera still works without them.' : 'Effects are still loading — try again in a moment.'); return; }
      const kind = b.dataset.fx;
      try {
        if (kind === 'none') await fx.removeBackground();
        else if (kind === 'blur') await fx.applyBlurBackground();
        else if (kind === 'own') { const u = ownPhoto(); if (u) await fx.applyVirtualBackground(u); }
        else if (kind === 'pick') { const u = await pickOwnPhoto(); if (!u) return; await fx.applyVirtualBackground(u); toast('Your photo is on.'); }
        else await fx.applyVirtualBackground(location.origin + kind);
      } catch (e) { toast('Could not apply that — ' + (e.message || e)); }
    }));
    return p;
  };
  /* Share my screen: one toggle, wherever it is pressed (the bar, the Tools sheet). The kit refuses when
     the browser cannot capture a screen (most phones) or the preset says no — the toast says which. */
  const shareBtn = q('.r2-share');
  const syncShare = () => { let on = false; try { on = !!m.self.screenShareEnabled; } catch (e) {} if (shareBtn) { shareBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); shareBtn.textContent = on ? 'Stop sharing' : 'Share my screen'; } };
  async function toggleShare() {
    let can = true; try { can = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia); } catch (e) {}
    if (!can) { toast('This browser can’t share a screen — a laptop can.', 6000); return; }
    try { m.self.screenShareEnabled ? await m.self.disableScreenShare() : await m.self.enableScreenShare(); }
    catch (e) { { console.warn('[share]', e); toast('Could not start screen share. Allow it if your browser asks, then try again.', 6000); }; }
    syncShare();
  }
  if (shareBtn) shareBtn.addEventListener('click', toggleShare);
  const fxBtn = q('.r2-fx-btn'); if (fxBtn) fxBtn.addEventListener('click', () => openSheet('Effects', effectsPane()));
  const toolsPane = () => {
    const p = el(`<div class="r2-tools">
      <button type="button" class="r2-btn" data-tool="share"><b>Share my screen</b><span>${esc(copy.capFirst(words.many))} see your screen instead of the grid</span></button>
      <button type="button" class="r2-btn" data-tool="fx"><b>Effects</b><span>Blur or a backdrop</span></button>
      <button type="button" class="r2-btn" data-tool="captions"><b>${ccOn ? 'Turn captions off' : 'Turn captions on'}</b><span>Words appear over the video as people speak</span></button>
      <button type="button" class="r2-btn" data-tool="settings"><b>Camera &amp; mic settings</b><span>Pick a different device</span></button>
      <button type="button" class="r2-btn" data-tool="poll"><b>Poll</b><span>Ask everyone, see the bars live (opens the Polls tab)</span></button>
      <button type="button" class="r2-btn" data-tool="breakout"><b>Small groups</b><span>${host ? 'Split ' + esc(words.many) + ' into rooms, join one, bring everyone back' : 'See the rooms and join one'}</span></button>
      <button type="button" class="r2-btn" data-tool="transcript"><b>Save transcript</b><span>Everything said, as a text file</span></button>
      <button type="button" class="r2-btn danger" data-tool="end"><b>${esc(ec.endButton)}</b><span>${esc(ec.endHint)}</span></button>
    </div>`);
    p.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', async () => {
      const t = b.dataset.tool;
      if (t === 'share') { sheet.hidden = true; await toggleShare(); }
      else if (t === 'fx') openSheet('Effects', effectsPane());
      else if (t === 'captions') { sheet.hidden = true; sheetBody.innerHTML = ''; if (ccBtn) ccBtn.click(); }
      else if (t === 'breakout') openSheet('Small groups', sg ? sg.board() : el('<div class="r2-empty">Small groups aren’t available right now — reload the page and try again.</div>'));
      else if (t === 'poll') { sheet.hidden = true; sheetBody.innerHTML = ''; showPane('polls'); }
      else if (t === 'settings') { const c = document.createElement('rtk-settings'); c.meeting = m; c.className = 'r2-kit'; openSheet('Camera & mic', c); }
      else if (t === 'transcript') { saveTranscript(); sheet.hidden = true; }
      /* the ONLY way a class ends: two taps, then everyone is removed and the page closes the row */
      else if (t === 'end') { if (confirmInline(b, ec.endAsk, ec.endAgain)) { b.disabled = true; const ended = await onEnd(); if (!ended) { b.disabled = false; sheet.hidden = true; sheetBody.innerHTML = ''; } } }
    }));
    return p;
  };
  /* (the guest's "Need help?" menu is gone: its three items live in the same Tools sheet everyone gets) */
  const tb = q('.r2-tools'); if (tb) tb.addEventListener('click', () => openSheet('Tools', toolsPane()));

  /* Leave: two taps, never one accidental one — and it only ever LEAVES. A host is told the class keeps
     running; nobody is removed, nothing stops, the row stays live (the End in Tools does that, on purpose). */
  const leaveBtn = q('.r2-leave');
  leaveBtn.addEventListener('click', async () => { if (confirmInline(leaveBtn, host ? ec.leaveHost : ec.leave)) { leaveBtn.disabled = true; await onLeave(); } });
  function confirmInline(btn, label, again) {
    /* a double-click is one intention, not two: the second tap counts only after 500 ms (9/16: the class was ended by
       accident at 6:28 — End is two taps and a double-click is two taps) */
    if (btn.dataset.armed === '1') { if (Date.now() - Number(btn.dataset.armedAt || 0) < 500) return false; btn.dataset.armed = ''; return true; }
    const old = btn.innerHTML; btn.dataset.armed = '1'; btn.dataset.armedAt = String(Date.now()); btn.innerHTML = esc(label) + ' <em>' + esc(again || 'Tap again') + '</em>';
    setTimeout(() => { if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.innerHTML = old; } }, 4000);
    return false;
  }

  /* the Reconnecting strip over the video: a sentence, or nothing */
  const reconnectEl = q('.r2-reconnect');
  function reconnecting(text) { if (!reconnectEl) return; if (text) { reconnectEl.textContent = text; reconnectEl.hidden = false; } else { reconnectEl.hidden = true; reconnectEl.textContent = ''; } }

  function toast(msg, ms) { const t = el(`<div class="r2-toast" role="status">${esc(msg)}</div>`); node.appendChild(t); setTimeout(() => t.remove(), ms || 4000); }

  /* bind the kit's parts (and re-bind after a breakout switch) */
  /* polls: the tab counts them; a new one opens the tab for a student so nobody misses the vote */
  let pollCount = 0;
  function watchPolls(mm) {
    const count = () => { try { const n = (mm.polls && mm.polls.items ? mm.polls.items.length : 0); const em = q('.r2-tab[data-tab="polls"] em'); if (em) em.textContent = n || ''; return n; } catch (e) { return 0; } };
    pollCount = count();
    try { mm.polls.on('pollsUpdate', () => { const n = count(); if (n > pollCount && !host) { showPane('polls'); toast('New poll from ' + (facilitator || hostName() || words.host) + ' — tap an answer.', 6000); } pollCount = n; }); } catch (e) {}
  }
  let bound = false;
  function bind(mm) {
    m = mm; if (onSwitch) onSwitch(mm);
    node.querySelectorAll('rtk-ui-provider, rtk-grid, rtk-grid-pagination, rtk-participants-audio, rtk-notifications, rtk-dialog-manager, rtk-chat, rtk-participants, rtk-polls').forEach(c => { c.meeting = mm; });
    watchPolls(mm);
    bindSelf(); peopleCount(); setNow(); renderPrimary(); nudge();
    try { mm.participants.joined.on('participantJoined', () => { peopleCount(); setNow(); renderQueue(); renderPrimary(); }); mm.participants.joined.on('participantLeft', () => { peopleCount(); setNow(); renderQueue(); renderPrimary(); }); } catch (e) {}
    if (!handsChan) watchHands();
    loadHands();
    if (sg && !sgStarted) { sgStarted = true; sg.start(); }
    if (sg && sg.onBind) { try { sg.onBind(); } catch (e) {} }   /* remember who the hosts are while they are visible (the main room) */
    if (res && !resStarted) { resStarted = true; try { res.start(); } catch (e) {} }
    if (sg && !inBreakout()) { const n = q('.r2-note'); if (n) { n.hidden = true; n.innerHTML = ''; } }   /* a room's note does not follow you back */
    /* the concept boards keep chat and people beside the video on a desktop; a phone starts on the video */
    if (!bound) { bound = true; try { if (window.matchMedia('(min-width: 1100px)').matches) showPane(host ? 'queue' : 'chat'); } catch (e) {} }
    try { hooks.emit('bind', mm); (hooks.plugins || []).forEach(p => { try { p.onBind && p.onBind(mm); } catch (e) {} }); } catch (e) {}
  }
  /* ---------- the plugin host: what a class plugin may touch (spec 2026-09-16-class-features-design.md) ---------- */
  const hooks = { listeners: {}, plugins: [],
    on(ev, cb) { (hooks.listeners[ev] = hooks.listeners[ev] || []).push(cb); },
    emit(ev, ...args) { (hooks.listeners[ev] || []).forEach(cb => { try { cb(...args); } catch (e) { console.warn('[room] hook', ev, e); } }); } };
  /* the hosts this page has SEEN (in the main room): a channel payload is trusted as a host's only from one of them */
  const seenHosts = new Set();
  hooks.on('bind', (mm) => { try { if (host) seenHosts.add(user.id); mm.participants.joined.toArray().forEach(x => { if (/host/.test(String(x.presetName || ''))) seenHosts.add(x.customParticipantId); }); } catch (e) {} });
  function pluginCtx(base) {
    const ctx = Object.assign({}, base, {
      inSmallGroup: () => inBreakout(),
      toast, openSheet, closeSheet, confirmInline,
      on: hooks.on,
      panel: { addTab(name, label) {
        const tabs = q('.r2-tabs'), panes = q('.r2-panel');
        const tab = el(`<button type="button" class="r2-tab" data-tab="${esc(name)}">${esc(label)} <em></em></button>`);
        tabs.appendChild(tab); tab.addEventListener('click', () => showPane(name));
        const pane = el(`<div class="r2-pane" data-pane="${esc(name)}" hidden></div>`);
        const anchor = q('.r2-panel .r2-close') ? q('.r2-panel .r2-close').closest('.r2-panel > *') : null;
        if (anchor && anchor.parentElement === panes) panes.insertBefore(pane, anchor); else panes.appendChild(pane);
        return { pane, count: tab.querySelector('em'), show: () => showPane(name) };
      } },
      bar: { addButton(html) { const b = el(html); const right = q('.r2-right'); right.insertBefore(b, right.querySelector('.r2-tools') || null); return b; }, get primary() { return q('.r2-primary'); } },
      stage: { overlay(cls) { const d = el(`<div class="r2-overlay ${esc(cls)}" hidden></div>`); q('.r2-stage').appendChild(d); return d; } },
      channel(name) {
        const key = name + '-' + base.roomKey; let ch = null;
        const subs = [];
        try { ch = sb.channel(key, { config: { broadcast: { self: true } } }); ch.on('broadcast', { event: 'p' }, (msg) => { const p = msg && msg.payload; if (!p) return; const fromHost = p.from === user.id ? host : seenHosts.has(p.from); subs.forEach(cb => { try { cb(p, { fromHost, mine: p.from === user.id }); } catch (e) {} }); }); ch.subscribe(); } catch (e) { ch = null; }
        return { on(cb) { subs.push(cb); }, async send(payload) { try { if (ch) await ch.send({ type: 'broadcast', event: 'p', payload: Object.assign({}, payload, { from: user.id }) }); } catch (e) {} }, stop() { try { if (ch) sb.removeChannel(ch); } catch (e) {} ch = null; } };
      },
      events: {
        async log(kind, label, data) { try { const { error } = await sb.from('ea_class_events').insert({ room_key: base.roomKey, kind, label: label || null, data: data || null }); if (error) console.warn('[room] event', error.message); } catch (e) {} },
        async list() { try { const { data } = await sb.from('ea_class_events').select('*').eq('room_key', base.roomKey).order('at'); return data || []; } catch (e) { return []; } },
      },
    });
    return ctx;
  }
  function destroy() { try { handsChan && sb.removeChannel(handsChan); } catch (e) {} clearInterval(ccTick); clearInterval(handsTimer); try { if (sg) sg.stop(); } catch (e) {} try { if (res) res.stop(); } catch (e) {} (hooks.plugins || []).forEach(p => { try { p.stop && p.stop(); } catch (e) {} }); hooks.plugins = []; }
  return { node, bind, destroy, setRecording, toast, reconnecting, hooks, pluginCtx };
}
