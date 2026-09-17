/* Profile cards in People — class plugin (spec 2026-09-16-class-features-design.md §11).
   The People pane gets a "Class roster" block above the kit's own list: everyone in the room right
   now (from the meeting, plus you), each one a tap away from a card — name, school, team, and
   "Building: …" (the first line of what they wrote when they registered). Cards come from one RPC,
   ea_opil_roster_cards() (0052), for the whole cohort; the room only matches meeting people to rows
   by user id. Someone who flipped "Hide my card" on the hub is not in the RPC's answer, so their row
   says they keep their card private. When the read itself fails (0052 not applied yet, a dropped
   connection) no one is called private: the card says it could not load and a tap tries again.
   Academy / HT rooms (ctx.isRoom) show name + bio from ea_profiles.
   The integrator calls plugin.mount(container) with the People pane; the block is placed before the
   kit's list. Pure decisions (order, the card's words, the blurb) are exported for tests.
   Import-safe in Node: nothing touches document or window until start()/mount(). */
export const BLURB_MAX = 140;
export const RELOAD_MS = 5 * 60000;   /* cards rarely change mid-class; a fresh read every five minutes is plenty */
const CSS_ID = 'rtk-roster-css';

/* the first line of a project write-up, tidied, never longer than 140 characters (the SQL does the same) */
export function blurb(text) {
  const first = String(text || '').split(/\r?\n/)[0].replace(/\s+/g, ' ').trim();
  if (!first) return '';
  return first.length > BLURB_MAX ? first.slice(0, BLURB_MAX - 1).trimEnd() + '…' : first;
}

/* the People list's order: you first, then whoever runs the class, then everyone else by name.
   list = [{ id, name, host }] — id is the user id (customParticipantId), host = a host preset */
export function rosterOrder(list, selfId) {
  const rank = (p) => (p.id === selfId ? 0 : p.host ? 1 : 2);
  return (list || []).slice().sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
}

/* the role word under a name, for someone on the program team (a student's line is school · team) */
export const ROLE_WORD = Object.freeze({ coordinator: 'Coordinator', facilitator: 'Facilitator', judge: 'Judge', student: '' });

/* the words when the cards could not be read at all (the RPC or ea_profiles failed) — never a
   "keeps their card private" for a problem that is ours */
export const LOAD_FAILED_NOTE = 'Couldn’t load the cards right now. Close this and try again in a moment.';

/* the card's words. row = an RPC row (or an ea_profiles row for an Academy/HT room) | null when the
   person hid their card or is not in the cohort; fallback = { name, self, isRoom, failed }.
   failed = the last read of the cards did not succeed, so a missing row means nothing about the person.
   Returns { title, sub, body, note } — every one a sentence or a short line, never computer text. */
export function cardFor(row, { name, self = false, isRoom = false, failed = false } = {}) {
  const title = (row && row.name) || (row && row.display_name) || name || 'Someone';
  if (!row && failed) return { title, sub: '', body: '', note: LOAD_FAILED_NOTE };
  if (isRoom) {
    if (row && row.hide_card) return { title, sub: '', body: '', note: self ? 'Your card is hidden. You can turn it back on from your profile.' : title + ' keeps their card private.' };
    const bio = row && String(row.bio || '').trim();
    return { title, sub: '', body: bio || '', note: bio ? '' : (self ? 'You haven’t written a bio yet — add one on your profile and people in the room will see it here.' : title + ' hasn’t written a bio yet.') };
  }
  /* a hidden program-team member has no switch to flip, so your own note names no switch */
  if (!row) return { title, sub: '', body: '', note: self ? 'Your card isn’t showing right now.' : title + ' keeps their card private.' };
  const role = ROLE_WORD[row.role] || '';
  const sub = [row.school, row.team].filter(Boolean).join(' · ') || role;
  const body = row.blurb ? 'Building: ' + row.blurb : '';
  const note = body ? '' : (role ? '' : (self ? 'You haven’t said what you’re building yet.' : 'No project write-up yet.'));
  return { title, sub, body, note };
}

/* the one-line row in the list: name + a short line under it */
export function rowLine(row, { self = false, isRoom = false, host = false, failed = false } = {}) {
  if (self) return 'You';
  if (!row && failed) return host ? (isRoom ? 'Running this session' : 'Running this class') : (isRoom ? 'In the room' : 'In the class');
  if (isRoom) return host ? 'Running this session' : (row && row.hide_card ? 'Card kept private' : (row && String(row.bio || '').trim() ? 'Tap for their bio' : 'In the room'));
  if (!row) return host ? 'Running this class' : 'Card kept private';
  const role = ROLE_WORD[row.role] || '';
  return [row.school, row.team].filter(Boolean).join(' · ') || role || (host ? 'Running this class' : 'In the class');
}

/* the line under your own OPIL card that names the "Hide my card" switch — only a student has one
   (it lives on the hub's My team page; the program team has no team page). isRoom cards never show it. */
export function selfFinePrint(row, { isRoom = false } = {}) {
  if (isRoom || !row || row.role !== 'student') return '';
  return 'Classmates see this card when they tap your name. You can hide it under My team on the hub.';
}

/* only a real user id goes to the database (a kit peer id is not one, and one bad id fails the whole read) */
export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

/* the heading's count line: "3 in the room now" */
export function countCopy(n, words) {
  const w = words && words.thing === 'class' ? 'in class now' : 'in the room now';
  return n === 1 ? '1 ' + w : n + ' ' + w;
}

/* ---- the plugin ---- */
export function create(ctx) {
  const { sb, el, esc, uid, host, isRoom, toast } = ctx;
  let container = null, block = null, cards = new Map(), loaded = false, failed = false, loadedAt = 0, timer = null, stopped = false, inflight = null;
  const followed = new Map();   /* meeting → its two handlers, so a meeting is followed once and let go on stop() */

  function injectCSS() {
    try {
      if (document.getElementById(CSS_ID)) return;
      const l = document.createElement('link'); l.id = CSS_ID; l.rel = 'stylesheet';
      l.href = '/css/rtk-roster.css' + new URL(import.meta.url).search;
      document.head.appendChild(l);
    } catch (e) {}
  }

  /* everyone in the room right now, as { id, name, host } — you included */
  function people() {
    const out = [];
    let m = null; try { m = ctx.getMeeting(); } catch (e) { m = null; }
    if (!m) return out;
    try { out.push({ id: m.self.customParticipantId || uid, name: m.self.name || (ctx.user && ctx.user.email ? ctx.user.email.split('@')[0] : 'You'), host: !!host }); } catch (e) { out.push({ id: uid, name: 'You', host: !!host }); }
    /* a person with no user id (a guest, a re-join edge) is listed by name alone — never keyed by the kit's peer id */
    try { m.participants.joined.toArray().forEach(p => { out.push({ id: p.customParticipantId || '', name: p.name || 'Someone', host: /host/.test(String(p.presetName || '')) }); }); } catch (e) {}
    return rosterOrder(out, uid);
  }

  /* the cards: OPIL → the RPC (hidden cards are simply absent); rooms → ea_profiles for the ids in the room */
  function load(force) {
    if (inflight) return inflight;   /* mount() and start() both ask; one read answers both */
    if (!force && loaded && ctx.now() - loadedAt < RELOAD_MS) return Promise.resolve();
    inflight = doLoad().finally(() => { inflight = null; });
    return inflight;
  }
  async function doLoad() {
    try {
      if (isRoom) {
        const ids = people().map(p => p.id).filter(isUuid);
        if (!ids.length) { failed = false; return; }
        const { data, error } = await sb.from('ea_profiles').select('user_id, display_name, bio, hide_card').in('user_id', ids);
        if (error) throw error;
        (data || []).forEach(r => cards.set(r.user_id, r));
      } else {
        const { data, error } = await sb.rpc('ea_opil_roster_cards');
        if (error) throw error;
        cards = new Map(); (data || []).forEach(r => cards.set(r.user_id, r));
      }
      loaded = true; failed = false; loadedAt = ctx.now();
    } catch (e) { failed = true; console.warn('[roster] load', e); }
    paint();
  }

  function paint() {
    if (!block || !block.isConnected) return;
    const list = people();
    const head = block.querySelector('.r2-roster-count'); if (head) head.textContent = countCopy(list.length, ctx.words);
    const body = block.querySelector('.r2-roster-list');
    if (!list.length) { body.innerHTML = '<div class="r2-empty">When people are in the room, each one is listed here — tap a name to see their card.</div>'; return; }
    body.innerHTML = list.map((p, i) => {
      const self = p.id === uid, row = (p.id && cards.get(p.id)) || null;
      const line = loaded ? rowLine(row, { self, isRoom, host: p.host, failed }) : (self ? 'You' : (p.host ? 'Running this class' : 'In the room'));
      return `<button type="button" class="r2-roster-row${self ? ' me' : ''}" data-id="${esc(p.id || '')}" data-i="${i}"><span class="r2-roster-av" aria-hidden="true">${esc(String(p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span><span class="r2-who"><b>${esc(p.name)}</b><span>${esc(line)}</span></span><span class="r2-roster-go">Card</span></button>`;
    }).join('');
    body.querySelectorAll('.r2-roster-row').forEach(b => b.addEventListener('click', () => open(b.dataset.id, Number(b.dataset.i))));
  }

  async function open(id, i) {
    const list = people();
    const p = (id && list.find(x => x.id === id)) || list[i] || { id, name: 'Someone', host: false };
    if (!loaded || failed) await load(true);
    const row = (id && cards.get(id)) || null;
    const c = cardFor(row, { name: p.name, self: id === uid, isRoom, failed });
    const fine = id === uid ? selfFinePrint(row, { isRoom }) : '';
    const node = el(`<div class="r2-roster-card">
      <div class="r2-roster-card-top"><span class="r2-roster-av big" aria-hidden="true">${esc(String(c.title || '?').trim().charAt(0).toUpperCase() || '?')}</span><div><b>${esc(c.title)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}${p.host ? `<span class="r2-roster-host">${isRoom ? 'Running this session' : 'Running this class'}</span>` : ''}</div></div>
      ${c.body ? `<p class="r2-roster-body">${esc(c.body)}</p>` : ''}
      ${c.note ? `<p class="r2-roster-note">${esc(c.note)}</p>` : ''}
      ${fine ? `<p class="r2-fine">${esc(fine)}</p>` : ''}
    </div>`);
    try { ctx.openSheet(id === uid ? 'Your card' : c.title, node); }
    catch (e) { console.warn('[roster] open', e); toast('Could not open that card right now. Try again in a moment.'); }
  }

  /* the block lives in the People pane, above the kit's list. The integrator hands us the pane. */
  function mount(paneEl) {
    if (!paneEl) return null;
    injectCSS();
    container = paneEl;
    if (block && block.isConnected) return block;
    block = el(`<div class="r2-roster"><div class="r2-roster-head"><b>Class roster</b><span class="r2-roster-count"></span></div><div class="r2-roster-list"><div class="r2-empty">Loading who’s here…</div></div></div>`);
    const kit = paneEl.querySelector('rtk-participants');
    if (kit) paneEl.insertBefore(block, kit); else paneEl.insertBefore(block, paneEl.firstChild);
    paint();
    if (!stopped && !loaded) load(true);
    return block;
  }

  /* repaint when someone comes or goes; the meeting changes in a small group, so follow it on bind */
  function follow(m) {
    if (!m || stopped || followed.has(m)) return;   /* main → small group → main: the main meeting is followed once */
    const onJoin = () => { if (stopped) return; paint(); if (isRoom) load(true); };
    const onLeave = () => { if (!stopped) paint(); };
    followed.set(m, { onJoin, onLeave });
    try { m.participants.joined.on('participantJoined', onJoin); m.participants.joined.on('participantLeft', onLeave); } catch (e) {}
    paint();
  }
  function unfollowAll() {
    followed.forEach((h, m) => { try { m.participants.joined.off('participantJoined', h.onJoin); m.participants.joined.off('participantLeft', h.onLeave); } catch (e) {} });
    followed.clear();
  }

  return {
    mount,
    start() {
      try {
        injectCSS();
        ctx.on('bind', (m) => follow(m));
        try { follow(ctx.getMeeting()); } catch (e) {}
        load(true);
        timer = setInterval(() => load(false), RELOAD_MS + 1000);
      } catch (e) { console.warn('[roster] start', e); }
    },
    onBind(m) { follow(m); },
    stop() { stopped = true; clearInterval(timer); timer = null; unfollowAll(); try { if (block) block.remove(); } catch (e) {} block = null; container = null; },
    /* for the integrator / tests */
    get cards() { return cards; },
    get failed() { return failed; },
    get followedCount() { return followed.size; },
    paint,
    load: () => load(true),
  };
}
