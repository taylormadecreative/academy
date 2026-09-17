/* Reactions + live pulse — class plugin (spec 2026-09-16-class-features-design.md §6).
   Bar button **React** → a tray of six word+emoji chips (Got it 👍 · Confused 🙋 · Slower 🐢 · Faster 🐇 ·
   Applause 👏 · Love it ❤️). A tap sends `{ kind }` on `ctx.channel('react')`; everyone in the same
   meeting sees the emoji float up over the stage for two seconds (reduced motion: it fades in place).
   The host also gets a **Pulse** strip — how many people, over the last minute, are confused / want it
   slower / faster / got it / clapped / sent a heart — red when a quarter of the room is confused;
   a tap clears it. No table: reactions are a moment, not a record.
   Rate limit: one reaction per person per 2 s on the way out (the tray). On the way in it is looser
   (one per sender per 1 s, so a late first message never drops an honest second tap) plus a room-wide
   budget (INBOUND_BURST per INBOUND_BURST_MS, whoever sends) so a flood from made-up senders cannot
   inflate the pulse or grind the host's tab. Reactions come from anyone by design, so nothing here
   checks fromHost.
   The pulse counts PEOPLE, not taps: got it / confused / slower / faster are one state per person
   (their newest wins); applause and hearts count each person once per minute.
   Import-safe in Node: nothing touches document/window until create(ctx).start().
   The host's Pulse strip: the integrator places plugin.pulseEl under the Now line (plugin.placePulseAfter(nowLine));
   unplaced, it falls back to a pill on the stage below the reconnect band, with one console.warn.
   Pure decisions (pulseCounts, pulseCopy, canReact, canAccept, createGate, createPulse, parseReaction, peopleCount,
   floatX) are exported for tests/opil/reactions.test.mjs. CSS: css/rtk-reactions.css, injected once. */

export const KINDS = [
  { id: 'got',      emoji: '👍', word: 'Got it',   one: 'got it',   many: 'got it' },
  { id: 'confused', emoji: '🙋', word: 'Confused', one: 'confused', many: 'confused' },
  { id: 'slower',   emoji: '🐢', word: 'Slower',   one: 'slower',   many: 'slower' },
  { id: 'faster',   emoji: '🐇', word: 'Faster',   one: 'faster',   many: 'faster' },
  { id: 'clap',     emoji: '👏', word: 'Applause', one: 'clap',     many: 'claps' },
  { id: 'heart',    emoji: '❤️', word: 'Love it',  one: 'heart',    many: 'hearts' },
];
/* the order the pulse reads in: what the host must act on first */
export const PULSE_ORDER = ['confused', 'slower', 'faster', 'got', 'clap', 'heart'];
/* got it / confused / slower / faster describe ONE person's state; the newest of them wins */
const UNDERSTANDING = new Set(['got', 'confused', 'slower', 'faster']);
export const WINDOW_MS = 60000;      /* the pulse's rolling window */
export const COOLDOWN_MS = 2000;     /* one reaction per person per 2 s (the tray) */
export const INBOUND_MS = COOLDOWN_MS / 2;   /* on the way in: a sender's next one counts after 1 s (jitter never drops an honest tap) */
export const INBOUND_BURST = 5;      /* room-wide: at most this many accepted reactions ... */
export const INBOUND_BURST_MS = 200; /* ... per this many ms, whoever sent them (a flood of made-up senders is dropped) */
export const FLOAT_MS = 2000;        /* how long an emoji is on the stage */
export const RED_SHARE = 0.25;       /* confused ≥ a quarter of the room → red */
export const MAX_FLOATS = 40;        /* emoji on the stage at once; past that they still count, they just do not draw */
const byId = new Map(KINDS.map(k => [k.id, k]));
export const kindOf = (id) => byId.get(String(id == null ? '' : id)) || null;

/* may this person react now? lastAt = when they last did (ms), null = never */
export function canReact(lastAt, now, gapMs = COOLDOWN_MS) {
  if (lastAt == null) return true;
  const t = Number(lastAt); if (!Number.isFinite(t)) return true;
  return now - t >= gapMs;
}
/* may this page count another reaction from `who`? (the inbound window is half the tray's cooldown) */
export function canAccept(lastAt, now) { return canReact(lastAt, now, INBOUND_MS); }

/* a room-wide budget: allow() is true for at most `max` calls in any `perMs` window, whoever sent them */
export function createGate({ now = () => Date.now(), max = INBOUND_BURST, perMs = INBOUND_BURST_MS } = {}) {
  let at = -Infinity, n = 0, dropped = 0;
  return {
    allow() { const t = now(); if (t - at >= perMs) { at = t; n = 0; } if (n < max) { n++; return true; } dropped++; return false; },
    get dropped() { return dropped; },
  };
}

/* counts per kind over (now − windowMs, now], only events at or after `since` (the host's last clear).
   events: [{ kind, from, at }] — `at` is when THIS page heard it (its own clock, so no skew).
   Returns { got, confused, slower, faster, clap, heart, total } — people, not taps (see the header). */
export function pulseCounts(events, now, windowMs = WINDOW_MS, since = 0) {
  const t0 = now - windowMs;
  const counts = {}; KINDS.forEach(k => { counts[k.id] = 0; });
  const state = new Map();              /* person → their newest understanding kind */
  const seen = new Map();               /* applause kind → Set(person) */
  let anon = 0;
  const live = (events || [])
    .filter(e => e && byId.has(e.kind) && Number.isFinite(Number(e.at)) && e.at > t0 && e.at <= now && e.at >= (since || 0))
    .sort((a, b) => a.at - b.at);
  for (const e of live) {
    const who = e.from == null || e.from === '' ? 'anon-' + (anon++) : String(e.from);
    if (UNDERSTANDING.has(e.kind)) state.set(who, e.kind);
    else { if (!seen.has(e.kind)) seen.set(e.kind, new Set()); seen.get(e.kind).add(who); }
  }
  state.forEach(kind => { counts[kind]++; });
  seen.forEach((set, kind) => { counts[kind] = set.size; });
  counts.total = KINDS.reduce((n, k) => n + counts[k.id], 0);
  return counts;
}

/* the strip's words: "6 confused · 3 slower · 2 got it · 4 claps" — red when confused ≥ 25% of people.
   people = everyone in the meeting including me (peopleCount). Returns { line, red, note, empty }. */
export function pulseCopy(counts, people) {
  const c = counts || {};
  const parts = [];
  const cap = Number(people) > 0 ? Number(people) : Infinity;   /* counts are people: never more than are in the room */
  const of = (id) => Math.min(cap, Math.max(0, Number(c[id]) || 0));
  for (const id of PULSE_ORDER) { const k = byId.get(id), n = of(id); if (n > 0) parts.push(n + ' ' + (n === 1 ? k.one : k.many)); }
  const n = Math.max(1, Number(people) || 0);
  const confused = of('confused');
  const red = confused > 0 && confused >= n * RED_SHARE;
  const note = red ? (confused === n ? 'Everyone here is confused — worth a pause.' : confused + ' of ' + n + ' confused — worth a pause.') : '';
  return { line: parts.join(' · '), red, note, empty: parts.length === 0 };
}

/* the host's rolling window as a small object: add / reset / counts (used by the plugin; tested alone) */
export function createPulse({ now = () => Date.now(), windowMs = WINDOW_MS } = {}) {
  let events = [], since = 0;
  const prune = () => { const cut = now() - windowMs; if (events.length && events[0].at <= cut) events = events.filter(e => e.at > cut); };
  return {
    add(kind, from, at) { const k = kindOf(kind); if (!k) return false; events.push({ kind: k.id, from: from == null ? null : String(from), at: at == null ? now() : Number(at) }); prune(); return true; },
    reset() { since = now(); events = []; },
    counts() { prune(); return pulseCounts(events, now(), windowMs, since); },
    get size() { return events.length; },
    get since() { return since; },
  };
}

/* a payload off the channel → { kind, from, m } or null (a stranger's shape is dropped, never thrown on) */
export function parseReaction(p) {
  if (!p || typeof p !== 'object') return null;
  const k = kindOf(p.kind); if (!k) return null;
  return { kind: k.id, from: p.from == null ? null : String(p.from), m: p.m == null ? null : String(p.m) };
}
/* everyone in the meeting, me included (the kit's `joined` leaves me out) */
export function peopleCount(meeting) {
  try {
    const j = meeting && meeting.participants && meeting.participants.joined; if (!j) return 1;
    const n = typeof j.size === 'number' ? j.size : (typeof j.toArray === 'function' ? j.toArray().length : 0);
    return (Number(n) || 0) + 1;
  } catch (e) { return 1; }
}
export function meetingIdOf(meeting) { try { return (meeting && meeting.meta && meeting.meta.meetingId) || null; } catch (e) { return null; } }
/* where an emoji starts, as a % of the stage width: the left two thirds, so the tray (bottom right) stays clear */
export function floatX(rnd) { const r = Math.min(1, Math.max(0, Number(rnd) || 0)); return Math.round(6 + r * 60); }

/* ---- the plugin ---- */
let cssDone = false;
function ensureCss() {
  if (cssDone) return; cssDone = true;
  try {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-rtk="reactions"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.rtk = 'reactions';
    l.href = '/css/rtk-reactions.css' + new URL(import.meta.url).search;
    document.head.appendChild(l);
  } catch (e) { console.warn('[reactions] css', e); }
}

export function create(ctx) {
  const now = () => (typeof ctx.now === 'function' ? ctx.now() : Date.now());
  const esc = ctx.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const el = ctx.el;
  const pulse = createPulse({ now });
  const lastFrom = new Map();            /* sender → when this page last accepted a reaction from them */
  const gate = createGate({ now });      /* the room-wide inbound budget */
  let btn = null, layer = null, tray = null, chan = null, tick = null, cooldownT = null, floats = 0, open = false, lastSent = null, lastLine = null, started = false, warnedPlace = false;
  let pulseEl = null;

  /* the Pulse strip is built now so the integrator can place it (plugin.pulseEl) before start() */
  try {
    if (ctx.host && typeof el === 'function') {
      pulseEl = el('<button type="button" class="r2-pulse" aria-live="polite" title="Tap to clear" hidden><b>Pulse</b><span class="r2-pulse-line"></span><span class="r2-pulse-note"></span><em>Tap to clear</em></button>');
      pulseEl.addEventListener('click', () => { pulse.reset(); paintPulse(true); try { ctx.toast && ctx.toast('Pulse cleared — reactions from now on show here.', 3500); } catch (e) {} });
    }
  } catch (e) { console.warn('[reactions] pulse element', e); pulseEl = null; }

  const chipsHTML = () => KINDS.map(k => `<button type="button" class="r2-react-chip" data-kind="${esc(k.id)}" aria-label="${esc(k.word)}"><i aria-hidden="true">${k.emoji}</i><span>${esc(k.word)}</span></button>`).join('');
  const DEFAULT_LINE = 'Tap one — everyone in the room sees it float by for a moment.';

  function paintLine(text) { const p = tray && tray.querySelector('.r2-react-line'); if (p) p.textContent = text; }
  function setOpen(v) {
    open = !!v;
    if (tray) tray.hidden = !open;
    if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.classList.toggle('on', open); }
    if (open) { paintLine(canReact(lastSent, now()) ? DEFAULT_LINE : 'One at a time — you can send another in a moment.'); const first = tray && tray.querySelector('.r2-react-chip:not(:disabled)'); try { if (first && !window.matchMedia('(pointer:coarse)').matches) first.focus(); } catch (e) {} }
  }
  const onDoc = (e) => { if (!open) return; const t = e.target; if ((tray && tray.contains(t)) || (btn && btn.contains(t))) return; setOpen(false); };
  const onKey = (e) => { if (open && e.key === 'Escape') { setOpen(false); try { btn && btn.focus(); } catch (x) {} } };

  /* ---- sending ---- */
  function tap(kind) {
    const k = kindOf(kind); if (!k) return;
    const t = now();
    if (!canReact(lastSent, t)) { paintLine('One at a time — you can send another in a moment.'); return; }
    lastSent = t;
    const m = meetingIdOf(ctx.getMeeting && ctx.getMeeting());
    try { chan && chan.send({ kind: k.id, m }); } catch (e) { console.warn('[reactions] send', e); }
    /* my own reaction draws at once (the echo of it is ignored in handle) */
    show(k, ctx.uid, t);
    if (!tray) return;
    tray.querySelectorAll('.r2-react-chip').forEach(b => { b.disabled = true; b.classList.toggle('sent', b.dataset.kind === k.id); });
    paintLine('Sent ' + k.word + ' ' + k.emoji + ' — you can send another in a moment.');
    /* the tray closes on a send so the page arrows and captions under it come back; the words go in a short toast */
    setOpen(false);
    try { ctx.toast && ctx.toast('Sent ' + k.word + ' ' + k.emoji + ' — you can send another in a moment.', COOLDOWN_MS); } catch (e) {}
    clearTimeout(cooldownT);
    cooldownT = setTimeout(() => { if (!tray) return; tray.querySelectorAll('.r2-react-chip').forEach(b => { b.disabled = false; b.classList.remove('sent'); }); paintLine(DEFAULT_LINE); }, COOLDOWN_MS);
    if (cooldownT && typeof cooldownT.unref === 'function') cooldownT.unref();
  }

  /* ---- receiving ---- */
  function handle(payload, meta) {
    const p = parseReaction(payload); if (!p) return;
    const mine = (meta && meta.mine) || (p.from != null && p.from === ctx.uid); if (mine) return;
    const here = meetingIdOf(ctx.getMeeting && ctx.getMeeting());
    if (p.m && here && p.m !== here) return;          /* a small group's claps stay in that group */
    const t = now();
    const who = p.from || 'someone';
    if (!canAccept(lastFrom.get(who), t)) return;     /* a flood from one sender is ignored */
    if (!gate.allow()) return;                        /* a flood from many (made-up) senders is ignored too */
    lastFrom.set(who, t);
    if (lastFrom.size > 256) pruneSenders(t);
    show(kindOf(p.kind), who, t);
  }
  /* forget senders whose window has passed (so the map never grows without bound) */
  function pruneSenders(t) { lastFrom.forEach((at, who) => { if (canAccept(at, t)) lastFrom.delete(who); }); }
  /* draw it and count it */
  function show(k, who, at) {
    if (!k) return;
    if (pulseEl) { pulse.add(k.id, who, at); paintPulse(); }
    if (!layer || floats >= MAX_FLOATS || typeof document === 'undefined') return;
    try {
      const s = document.createElement('span'); s.className = 'r2-react-float'; s.setAttribute('aria-hidden', 'true');
      s.style.left = floatX(Math.random()) + '%'; s.textContent = k.emoji;
      layer.appendChild(s); floats++;
      let gone = false; const bye = () => { if (gone) return; gone = true; floats = Math.max(0, floats - 1); try { s.remove(); } catch (e) {} };
      s.addEventListener('animationend', bye); setTimeout(bye, FLOAT_MS + 600);
    } catch (e) { console.warn('[reactions] float', e); }
  }

  /* ---- the host's strip ---- */
  /* the integrator calls this once with the Now line (a full-width strip under it); see the wiring notes */
  function placePulseAfter(node) {
    if (!pulseEl || !node) return false;
    try { pulseEl.classList.add('r2-pulse-row'); node.insertAdjacentElement('afterend', pulseEl); return true; } catch (e) { console.warn('[reactions] place pulse', e); return false; }
  }
  /* unplaced at start(): a pill on the stage, below the reconnect band and the "Showing" bar (a fallback, not the spec's place) */
  function fallbackPulse() {
    if (!pulseEl || pulseEl.parentElement || !layer) return;
    try { pulseEl.classList.remove('r2-pulse-row'); layer.appendChild(pulseEl); } catch (e) { return; }
    if (!warnedPlace) { warnedPlace = true; console.warn('[reactions] the Pulse strip was not placed under the Now line (plugin.placePulseAfter(nowLine)) — showing it as a pill on the stage instead'); }
  }
  function paintPulse(force) {
    if (!pulseEl) return;
    const c = pulse.counts();
    const copy = pulseCopy(c, peopleCount(ctx.getMeeting && ctx.getMeeting()));
    const key = copy.line + '|' + copy.red + '|' + copy.note;
    if (!force && key === lastLine) return; lastLine = key;
    pulseEl.hidden = copy.empty;
    pulseEl.classList.toggle('is-red', copy.red);
    const line = pulseEl.querySelector('.r2-pulse-line'), note = pulseEl.querySelector('.r2-pulse-note');
    if (line) line.textContent = copy.line;
    if (note) { note.textContent = copy.note; note.hidden = !copy.note; }
  }

  function start() {
    if (started) return; started = true;
    try {
      ensureCss();
      chan = ctx.channel('react');
      chan.on(handle);
      layer = ctx.stage.overlay('r2-react-layer');
      layer.hidden = false;   /* the chips and the Pulse strip live here too, so the layer itself is never aria-hidden (each float is) */
      tray = el(`<div class="r2-react-tray" role="group" aria-label="React" hidden><div class="r2-react-chips">${chipsHTML()}</div><p class="r2-react-line">${esc(DEFAULT_LINE)}</p>${ctx.host ? '<p class="r2-react-fine">You’ll see a Pulse strip when the class reacts — tap it to clear.</p>' : ''}</div>`);
      layer.appendChild(tray);
      tray.querySelectorAll('.r2-react-chip').forEach(b => b.addEventListener('click', () => tap(b.dataset.kind)));
      fallbackPulse();   /* the integrator normally placed it already (under the Now line) */
      btn = ctx.bar.addButton('<button type="button" class="r2-btn r2-react-btn" aria-haspopup="true" aria-expanded="false">React</button>');
      btn.addEventListener('click', () => setOpen(!open));
      if (typeof document !== 'undefined') { document.addEventListener('pointerdown', onDoc, true); document.addEventListener('keydown', onKey); }
      tick = setInterval(() => { pruneSenders(now()); paintPulse(); }, 1000);   /* the window rolls: the words follow it; stale senders are forgotten (unref: a Node test can exit) */
      if (tick && typeof tick.unref === 'function') tick.unref();
    } catch (e) { console.warn('[reactions] start', e); try { ctx.toast && ctx.toast('Reactions didn’t load this time — everything else in the class still works.', 6000); } catch (x) {} }
  }
  function stop() {
    clearInterval(tick); clearTimeout(cooldownT); tick = cooldownT = null;
    try { if (typeof document !== 'undefined') { document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey); } } catch (e) {}
    try { chan && chan.stop(); } catch (e) {} chan = null;
    try { btn && btn.remove(); } catch (e) {} btn = null;
    try { layer && layer.remove(); } catch (e) {} layer = tray = null;
    try { pulseEl && pulseEl.remove(); } catch (e) {}   /* off the page (under the Now line too); the element is kept so it can be placed again */
    started = false; open = false;
  }
  /* registered once here, not per start(): the room's hooks.on has no off; inert while stopped */
  try { ctx.on && ctx.on('bind', () => { if (!started) return; setOpen(false); paintPulse(true); }); } catch (e) { console.warn('[reactions] bind hook', e); }

  return { name: 'reactions', start, stop, pulseEl, placePulseAfter, get pulse() { return pulse; }, get isOpen() { return open; }, get dropped() { return gate.dropped; }, react: tap, handle };
}
