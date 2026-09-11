/* The class room: everyone on camera. Mounts a Cloudflare RealtimeKit meeting into a page.
   Shared by the OPIL live room today; the Academy room follows.

   Loading (proven by spike, 2026-09-10): the core MUST come in as the plain script build —
   jsdelivr's ESM conversion of one of its dependencies 404s and kills the whole import graph.
   The UI kit loads fine as a module. Both are pinned; never use @latest. */

const CORE = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.2/dist/browser.js';
const UI_LOADER = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/loader/index.es2017.js';
const UI_MAIN = 'https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@2.0.2/dist/index.js';

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
export async function joinTarget(cfg, token, sessionNo, meetingId) {
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
  return d;   /* { token, meeting_id, preset, host, name } */
}

/* Mount the meeting into `mountEl`. Returns { meeting, meetingId, host, leave }.
   The element joins by itself once `.meeting` is assigned with the setup screen off —
   calling meeting.join() as well throws UnsupportedConcurrentMethodExecution (spike, 9/10). */
export async function mountRoom({ mountEl, cfg, token, sessionNo, meetingId, onState }) {
  const join = await joinTarget(cfg, token, sessionNo, meetingId);
  const { RealtimeKitClient, ui } = await loadKit();

  mountEl.innerHTML = '<rtk-meeting id="rtkRoom"></rtk-meeting>';
  const el = mountEl.querySelector('#rtkRoom');

  /* The presets already carry the Academy tokens, so this only has to match them for the
     chrome the kit draws outside the preset's reach. */
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

  const meeting = await RealtimeKitClient.init({
    authToken: join.token,
    defaults: {
      /* Hosts arrive ready to teach. Students arrive muted with the camera off and turn it
         on when they want to be seen — 27 cameras at once is a wall, and slow connections
         suffer. Everything is one tap away in the control bar either way. */
      audio: join.host, video: join.host,
      mediaConfiguration: { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } },
    },
  });

  if (onState) el.addEventListener('rtkStatesUpdate', (ev) => { const s = ev.detail; if (s && s.meeting) onState(s.meeting, meeting); });
  el.showSetupScreen = true;   /* the "check your camera and mic" screen everyone expects before joining */
  el.leaveOnUnmount = true;
  el.meeting = meeting;

  document.body.classList.add('in-room');
  return {
    meeting, meetingId: join.meeting_id, host: !!join.host, preset: join.preset,
    async leave() {
      document.body.classList.remove('in-room');
      try { await meeting.leave(); } catch (e) {}
      mountEl.innerHTML = '';
    },
  };
}
