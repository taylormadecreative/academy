/* js/ai101-class.js — the AI 101 class page (/ai101/class/). The page ships with #gate and #app hidden and a
   "Opening your class page…" status line. Signed in → the class. Signed out → the sign-in wall (a sign-up wall,
   not a lock: the HTML is public). If esm.sh or Supabase can't be reached in 6 s, or the session check errors,
   the class shows anyway (fails open): a blocked CDN must never cost an attendee the class. The proof forms
   (js/ai101-proof.js) then try to reconnect on the next tap, and say plainly when they can't save. */
const Q = new URL(import.meta.url).search;
const kit = await import('./ai101-kit.js' + Q);
const { PART_KEYS, promptPieces, buildPrompt, missingParts, splitTokens, readState, writeState, guessOS } = kit;
const $ = (id) => document.getElementById(id);
const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const KEY = { tool: 'a1c.tool', os: 'a1c.os', done: 'a1c.done', builder: 'a1c.builder' };
const TOOLS = ['claude', 'chatgpt', 'gemini'];
const TOOL_NAMES = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };
const OS_NAMES = { mac: 'Mac', windows: 'Windows' };
const NAMES = { role: 'Role', task: 'Task', context: 'Context', format: 'Format' };

function show(which) { $('loading').hidden = true; $('gate').hidden = which !== 'gate'; $('app').hidden = which !== 'app'; }

/* supabase-js from esm.sh. A failed module import is remembered by its URL for the life of the page, so a retry
   asks for the same file under a new #fragment (fetch drops the fragment; the module map keys on it). */
const ESM = 'https://esm.sh/@supabase/supabase-js@2';
let lib = null;
function loadLib() {
  if (!lib || lib.failed) {
    const entry = { failed: false };
    entry.promise = import(lib ? ESM + '#retry-' + Date.now() : ESM).catch((err) => { entry.failed = true; throw err; });
    lib = entry;
  }
  return lib.promise;
}
export async function connect() { // one 6 s deadline around the import AND the session check
  const CFG = window.BM_CONFIG || {};
  const late = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000));
  return Promise.race([(async () => {
    const { createClient } = await loadLib();
    const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
    const { data, error } = await sb.auth.getSession();
    return { sb, session: (data && data.session) || null, error: error || null };
  })(), late]);
}

function toolSwitch() {
  const say = $('toolSay');
  const set = (t, announce) => {
    if (!TOOLS.includes(t)) t = 'claude';
    document.documentElement.dataset.tool = t;
    document.querySelectorAll('[data-pick-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pickTool === t)));
    writeState(LS, KEY.tool, t);
    if (announce && say) say.textContent = `Showing the steps for ${TOOL_NAMES[t]}.`;
  };
  document.querySelectorAll('[data-pick-tool]').forEach((b) => b.addEventListener('click', () => set(b.dataset.pickTool, true)));
  set(readState(LS, KEY.tool, 'claude'), false);
}

function osSwitch() { // Step 2's Mac | Windows switch: starts on the computer the browser reports, then remembers a tap
  const say = $('osSay');
  const set = (o, announce) => {
    if (!OS_NAMES[o]) o = 'mac';
    document.documentElement.dataset.os = o;
    document.querySelectorAll('[data-pick-os]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pickOs === o)));
    if (announce) { writeState(LS, KEY.os, o); if (say) say.textContent = `Showing the steps for ${OS_NAMES[o]}.`; }
  };
  document.querySelectorAll('[data-pick-os]').forEach((b) => b.addEventListener('click', () => set(b.dataset.pickOs, true)));
  const nav = navigator, guess = guessOS({ uaPlatform: (nav.userAgentData && nav.userAgentData.platform) || '', platform: nav.platform || '', ua: nav.userAgent || '' });
  set(readState(LS, KEY.os, guess), false);
}

function progress() {
  const boxes = [...document.querySelectorAll('input[data-step]')];
  const done = readState(LS, KEY.done, {}) || {};
  const draw = () => {
    const n = boxes.filter((b) => b.checked).length;
    $('prog').textContent = `${n} of ${boxes.length} steps done`;
    $('progBar').style.setProperty('--p', String(n / boxes.length));
  };
  boxes.forEach((b) => {
    const li = b.closest('.a1c-step');
    b.checked = !!done[b.dataset.step]; li.classList.toggle('done', b.checked);
    b.addEventListener('change', () => { done[b.dataset.step] = b.checked; li.classList.toggle('done', b.checked); writeState(LS, KEY.done, done); draw(); });
  });
  draw();
}

/* Copy: the button's own label is saved once (a quick second tap must not save "Copied" as the label). The toast
   (role=status) says it out loud. With no clipboard (older phones, in-app browsers) the words are selected and the
   how-to stays up long enough to follow. */
const copyTimers = new WeakMap();
const toast = (msg, ms) => { if (window.BM && BM.toast) BM.toast(msg, ms); }; // static strings only: BM.toast sets innerHTML
async function copyText(text, btn, pre) {
  const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
  clearTimeout(copyTimers.get(btn));
  let ok = true;
  try { if (!navigator.clipboard) throw new Error('no clipboard'); await navigator.clipboard.writeText(text); }
  catch (e) { ok = false; const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  btn.textContent = ok ? 'Copied' : 'Now press and hold the words, then tap Copy';
  toast(ok ? 'Copied. Now paste it into your AI chat.' : 'The words are selected. Press and hold them, then tap Copy.', ok ? 3000 : 12000);
  copyTimers.set(btn, setTimeout(() => { btn.textContent = label; }, ok ? 2000 : 12000));
}
function copyButtons() {
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const pre = b.closest('figure').querySelector('pre'); copyText(pre.textContent, b, pre);
  }));
}

function builder() {
  const fields = Object.fromEntries(PART_KEYS.map((k) => [k, document.querySelector(`[data-b="${k}"]`)]));
  const saved = readState(LS, KEY.builder, {}) || {};
  PART_KEYS.forEach((k) => { fields[k].value = typeof saved[k] === 'string' ? saved[k] : ''; });
  const out = $('bOut'), miss = $('bMissing');
  let had = new Set();
  const parts = () => Object.fromEntries(PART_KEYS.map((k) => [k, fields[k].value]));
  const say = (t) => { if (miss.textContent !== t) miss.textContent = t; }; // same words, no re-announcement
  const draw = () => {
    const p = parts(), pieces = promptPieces(p), m = missingParts(p);
    if (!pieces.length) { out.textContent = 'Fill in the boxes and your prompt shows up here.'; out.classList.add('empty'); had = new Set(); }
    else {
      out.classList.remove('empty');
      const nodes = [];
      pieces.forEach((pc, i) => {
        const s = document.createElement('span'); s.dataset.part = pc.key; s.textContent = pc.text;
        if (!had.has(pc.key)) s.className = 'new';
        if (i) nodes.push(document.createTextNode(' '));
        nodes.push(s);
      });
      out.replaceChildren(...nodes); had = new Set(pieces.map((pc) => pc.key));
    }
    say(!pieces.length ? '' : m.length ? 'Still empty: ' + m.map((k) => NAMES[k]).join(', ') : 'Ready. Copy it and paste it into your AI chat.');
    PART_KEYS.forEach((k) => fields[k].closest('.a1c-b-field').classList.toggle('filled', !!fields[k].value.trim()));
    writeState(LS, KEY.builder, p);
  };
  PART_KEYS.forEach((k) => fields[k].addEventListener('input', draw));
  $('bCopy').addEventListener('click', () => { const t = buildPrompt(parts()); if (t) copyText(t, $('bCopy'), out); else { say('Fill in a box first, starting with Role.'); fields.role.focus(); } });
  $('bClear').addEventListener('click', () => { PART_KEYS.forEach((k) => { fields[k].value = ''; }); draw(); fields.role.focus(); });
  draw();
}

function tokenToy() {
  const input = $('toyIn'), out = $('toyOut'), n = $('toyN'), say = $('toySay');
  let t = null;
  const draw = () => {
    const toks = splitTokens(input.value);
    out.replaceChildren(...toks.map((x, i) => { const s = document.createElement('span'); s.className = 'tok'; s.style.setProperty('--i', String(i % 6)); s.textContent = x.trim(); return s; }));
    n.textContent = String(toks.length);
    clearTimeout(t); t = setTimeout(() => { say.textContent = `${toks.length} tokens`; }, 800); // spoken once you pause, not per key
  };
  input.addEventListener('input', draw); draw();
}

async function roomLink(sb) {
  try {
    const { data, error } = await sb.rpc('ea_ai101_room_link');
    if (error) throw error;
    if (typeof data === 'string' && data.startsWith('/room/')) { $('joinRoom').href = data; $('joinRoom').hidden = false; $('joinNote').hidden = true; }
  } catch (e) { console.warn('class page: no room link', e); }
}

function gateLinks() { // sign in, then come back to this exact spot (hash included)
  const here = encodeURIComponent(location.pathname + location.hash);
  document.querySelectorAll('#gate a[data-next]').forEach((a) => { a.href = a.getAttribute('href').replace(/next=[^&]*/, 'next=' + here); });
}

function jumpToHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; } // a mangled link must not stop the page
  if (id) { const el = document.getElementById(id); if (el) el.scrollIntoView(); }
}

export async function boot() {
  toolSwitch(); osSwitch(); progress(); copyButtons(); builder(); tokenToy();
  let conn = null;
  try { conn = await connect(); } catch (e) { console.warn('class page: Supabase unreachable, showing the class anyway', e); }
  if (conn && conn.error) console.warn('class page: the session check failed, showing the class anyway', conn.error);
  if (conn && !conn.error && !conn.session) { gateLinks(); show('gate'); return; }
  show('app'); jumpToHash();
  const signedIn = !!(conn && conn.session);
  if (signedIn) roomLink(conn.sb);
  try {
    const proof = await import('./ai101-proof.js' + Q);
    proof.mountProof({
      sb: signedIn ? conn.sb : null, session: signedIn ? conn.session : null, slug: 'ai101', kit,
      reconnect: async () => { const c = await connect(); return c.session && !c.error ? c : null; },
    });
  } catch (e) { console.warn('class page: proof forms unavailable', e); }
  try { // the end-of-class badge (Nelson 10/9): unlocks at 7:56 PM CT for everyone, ?badge=preview to check it early
    const badge = await import('./ai101-badge.js' + Q);
    badge.mountBadge({ sb: signedIn ? conn.sb : null, session: signedIn ? conn.session : null });
  } catch (e) { console.warn('class page: badge unavailable', e); }
}
