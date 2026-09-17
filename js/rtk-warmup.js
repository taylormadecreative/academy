/* Warm-ups on the waiting screen — class plugin (spec 2026-09-16-class-features-design.md §8).
   Two surfaces, one table (ea_class_warmups, 0049 — one row per person per class):
   1. mountWaiting(...) — the getting-in screen before the class exists: a Question of the day card
      with a one-line answer, "Where are you joining from?", a line of cities under the card
      ("Joining from Atlanta · Tallahassee · Dallas") and Already here — the classmates whose presence
      row (ea_class_presence, 0043) says waiting or in.
   2. create(ctx) → plugin.mountAnswers(container) — in class, the host's Questions tab gets a
      Warm-up answers section (name · city · answer) to read out, live as answers land, and a way to
      change the question without leaving the room.
   The question lives on ea_opil_sessions.warmup_q (coordinator page or the host in the room); a room
   with no question set shows the default one below. Honest limit: no map — a list of places.
   Pure decisions (the cities line, the already-here sentence, who counts as here, the rows) are
   exported for tests. Import-safe in Node: nothing below touches document or window at import. */
export const DEFAULT_QUESTION = 'What’s one thing you want to get out of this class?';
/* a room (HT, the Academy) has sessions, not classes: its own default question */
export const ROOM_DEFAULT_QUESTION = 'What do you hope to hear today?';
export const HERE_WINDOW_MS = 120000;   /* a presence row older than this is a closed tab that never said goodbye */
export const CITY_MAX = 10;            /* places named before "and N more" */
export const NAME_MAX = 3;             /* names said before "and N others" */
export const POLL_MS = 20000;
export const SETTLE_MS = 1500;         /* realtime events are folded into one redraw per this window */
export const ANSWER_MAX = 280;
export const CITY_CHARS = 80;
export const QUESTION_MAX = 200;
export const HERE_PLACEHOLDER = 'A classmate';   /* someone whose name we could not find yet */

/* ---------- pure helpers ---------- */
/* the question to ask: the one the coordinator typed, or the default */
export function questionOf(session) {
  const q = session && typeof session.warmup_q === 'string' ? session.warmup_q.trim() : '';
  return q ? q.slice(0, QUESTION_MAX) : (session && session.kind === 'room' ? ROOM_DEFAULT_QUESTION : DEFAULT_QUESTION);
}
/* "Atlanta, GA" → "Atlanta"; whitespace collapsed; never longer than 40 chars */
export function cityWord(s) {
  const raw = String(s == null ? '' : s).split(',')[0].replace(/\s+/g, ' ').trim();
  return raw.slice(0, 40);
}
/* the line under the card: "Joining from Atlanta · Tallahassee · Dallas" (each place once, in the order
   people answered, the first CITY_MAX named, then "and N more"); '' when nobody has said where they are */
export function citiesLine(rows) {
  const seen = new Set(), places = [];
  (rows || []).forEach(r => {
    const w = cityWord(r && r.city);
    if (!w) return;
    const k = w.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); places.push(w);
  });
  if (!places.length) return '';
  const shown = places.slice(0, CITY_MAX), rest = places.length - shown.length;
  return 'Joining from ' + shown.join(' · ') + (rest > 0 ? ' · and ' + rest + ' more' : '');
}
/* the sentence over the Already-here list. names: everyone here but me (hereNames has already left me
   out, so a classmate who shares my name is still counted). People we could not name (HERE_PLACEHOLDER)
   are counted, never listed by that label: "Kiara Pee and 2 others", "3 classmates are already here." */
export function alreadyHereCopy(names, one = 'classmate', many = 'classmates') {
  const named = [];
  let unnamed = 0;
  (names || []).forEach(n => {
    const s = String(n == null ? '' : n).trim(); if (!s) return;
    if (s === HERE_PLACEHOLDER) { unnamed++; return; }
    named.push(s);
  });
  if (!named.length && !unnamed) return 'No one else yet — you’re the first one here.';
  if (!named.length) return unnamed === 1 ? 'A ' + one + ' is already here.' : unnamed + ' ' + many + ' are already here.';
  const shown = named.slice(0, NAME_MAX), rest = named.length - shown.length + unnamed;
  if (rest > 0) return shown.join(', ') + ' and ' + rest + (rest === 1 ? ' other are' : ' others are') + ' already here.';
  if (shown.length === 1) return shown[0] + ' is already here.';
  return shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] + ' are already here.';
}
/* a display name for a user id from the profile rows, else the fallback */
export function nameOf(profiles, uid, fallback) {
  const p = (profiles || []).find(x => x && x.user_id === uid);
  const n = p && typeof p.display_name === 'string' ? p.display_name.trim() : '';
  return n || fallback || 'Someone';
}
/* who counts as here: state waiting or in, seen inside the window; me left out; one entry per PERSON
   (keyed on user_id, so two people we could not name are two chips); named people A–Z first, the
   unnamed ones after them */
export function herePeople(presence, profiles, { uid, now } = {}) {
  const t = typeof now === 'number' ? now : Date.now();
  const seenIds = new Set(), people = [];
  (presence || []).forEach(r => {
    if (!r || !r.user_id || r.user_id === uid || seenIds.has(r.user_id)) return;
    if (r.state !== 'waiting' && r.state !== 'in') return;
    const seen = r.last_seen ? Date.parse(r.last_seen) : NaN;
    if (!Number.isFinite(seen) || t - seen > HERE_WINDOW_MS) return;
    seenIds.add(r.user_id);
    const name = nameOf(profiles, r.user_id, HERE_PLACEHOLDER);
    people.push({ user_id: r.user_id, name, named: name !== HERE_PLACEHOLDER });
  });
  return people.sort((a, b) => (a.named === b.named ? a.name.localeCompare(b.name) : (a.named ? -1 : 1)));
}
export function hereNames(presence, profiles, opts) { return herePeople(presence, profiles, opts).map(p => p.name); }
/* the host's rows: name · city · answer, oldest first, blank rows (no answer and no city) left out */
export function answerRows(warmups, profiles) {
  return (warmups || [])
    .filter(r => r && ((r.answer && String(r.answer).trim()) || cityWord(r.city)))
    .map(r => ({ user_id: r.user_id, name: nameOf(profiles, r.user_id, 'Someone'), city: cityWord(r.city), answer: String(r.answer || '').trim(), created_at: r.created_at || '' }))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}
/* the count line for the host: "3 answers · 2 said where they’re from" */
export function answersSummary(rows) {
  const list = rows || [];
  const a = list.filter(r => r.answer).length, c = list.filter(r => r.city).length;
  if (!list.length) return 'No answers yet';
  const parts = [a === 1 ? '1 answer' : a + ' answers'];
  if (c) parts.push(c + ' said where they’re from');
  return parts.join(' · ');
}
/* what a person's saved row says under the button */
export function savedCopy({ answer, city }) {
  if (!answer && !city) return '';
  if (answer && city) return 'Saved. Your host sees it when the class starts — change it any time.';
  if (answer) return 'Saved. Add where you’re joining from too and your city joins the line below.';
  return 'Saved. Add an answer too — your host reads them out when class starts.';
}

/* ---------- shared plumbing (browser only; nothing here runs at import) ---------- */
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  try {
    if (document.querySelector('link[data-rtk-warmup]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.rtkWarmup = '1';
    l.href = '/css/rtk-warmup.css' + new URL(import.meta.url).search;
    document.head.appendChild(l);
  } catch (e) { console.warn('[warmup] css', e); }
}
/* one run at a time: a call while a run is in flight marks it dirty and the run repeats once at the end,
   so overlapping loads never paint an older result over a newer one (exported for the tests) */
export function serial(fn) {
  let busy = false, again = false;
  return async function run() {
    if (busy) { again = true; return; }
    busy = true;
    try { await fn(); }
    finally { busy = false; if (again) { again = false; run(); } }
  };
}
/* the class's rows and a redraw on every change: realtime first, a slow poll as the net. A burst of
   events (every presence beat is an UPDATE) folds into one redraw per SETTLE_MS. tables: a name, or
   { table, event } to listen to one kind of change only. */
function watch(sb, roomKey, tables, onChange) {
  let chan = null, poll = null, timer = null, stopped = false;
  const settle = () => { if (stopped) return; clearTimeout(timer); timer = setTimeout(() => { timer = null; if (!stopped) onChange(); }, SETTLE_MS); };
  try {
    chan = sb.channel('warm-' + roomKey + '-' + Math.random().toString(36).slice(2, 7));
    tables.forEach(t => {
      const spec = typeof t === 'string' ? { table: t, event: '*' } : t;
      chan.on('postgres_changes', { event: spec.event || '*', schema: 'public', table: spec.table, filter: 'room_key=eq.' + roomKey }, settle);
    });
    chan.subscribe();
  } catch (e) { chan = null; }
  poll = setInterval(() => { if (!stopped) onChange(); }, POLL_MS);
  return { stop() { stopped = true; clearInterval(poll); clearTimeout(timer); try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null; } };
}
async function loadWarmups(sb, roomKey) {
  const { data, error } = await sb.from('ea_class_warmups').select('room_key, user_id, answer, city, created_at, updated_at').eq('room_key', roomKey).order('created_at');
  if (error) throw error;
  return data || [];
}
async function loadPresence(sb, roomKey) {
  const { data, error } = await sb.from('ea_class_presence').select('room_key, user_id, state, last_seen, first_seen').eq('room_key', roomKey);
  if (error) throw error;
  return data || [];
}
/* names, cached per page. First ea_class_names (0049): profile name, else the registration name, else the
   part of the email before @ — so a student who never filled a profile still reads as a person (a third
   of the cohort, per the room). ea_profiles is the fallback when the function is not there yet. Only the
   ids not yet known are fetched. */
const profileCache = new Map();
async function profilesFor(sb, roomKey, ids) {
  const need = [...new Set((ids || []).filter(Boolean))].filter(id => !profileCache.has(id));
  if (need.length) {
    let got = false;
    if (roomKey) {
      try {
        const { data, error } = await sb.rpc('ea_class_names', { p_key: roomKey });
        if (error) throw error;
        (data || []).forEach(r => { if (r && r.user_id) profileCache.set(r.user_id, (r.name || '').trim()); });
        got = true;
      } catch (e) { console.warn('[warmup] names', e); }
    }
    const still = need.filter(id => !profileCache.has(id) || !profileCache.get(id));
    if (!got || still.length) {
      try { const { data } = await sb.from('ea_profiles').select('user_id, display_name').in('user_id', still.length ? still : need); (data || []).forEach(r => { if (r && r.display_name) profileCache.set(r.user_id, r.display_name); }); } catch (e) { console.warn('[warmup] profiles', e); }
    }
    need.forEach(id => { if (!profileCache.has(id)) profileCache.set(id, ''); });
  }
  return (ids || []).map(id => ({ user_id: id, display_name: profileCache.get(id) || '' }));
}
export function rememberName(uid, name) { if (uid && name) profileCache.set(uid, name); }

/* ---------- 1. the waiting screen ---------- */
export function mountWaiting({ sb, copy, el, esc, user, uid, roomKey, session, room, container, now }) {
  ensureCss();
  const me = uid || (user && user.id) || null;
  const nowFn = typeof now === 'function' ? now : () => Date.now();
  let question = questionOf(session || room), mine = { answer: '', city: '' }, hasRow = false, filled = false, warm = [], pres = [], profiles = [], stopped = false, watcher = null, saving = false;   /* a room (HT, the Academy) carries warmup_q on its state (0054) */
  if (!container || typeof container.appendChild !== 'function') { console.warn('[warmup] mountWaiting: no container'); return { stop() {} }; }
  const node = el(`<section class="r2-warm" aria-label="Warm-up">
      <div class="r2-warm-card">
        <div class="r2-warm-kicker">Question of the day</div>
        <h3 class="r2-warm-q"></h3>
        <label class="r2-warm-field"><span>Your answer — one line is plenty</span><input class="r2-warm-answer" type="text" maxlength="${ANSWER_MAX}" placeholder="Type your answer here" autocomplete="off"></label>
        <label class="r2-warm-field"><span>Where are you joining from?</span><input class="r2-warm-city" type="text" maxlength="${CITY_CHARS}" placeholder="${esc((room && room.city_hint) || 'Atlanta, GA')}" autocomplete="address-level2"></label>
        <div class="r2-warm-row"><button type="button" class="r2-btn r2-warm-save">Send my answer</button><span class="r2-warm-status" role="status"></span></div>
      </div>
      <p class="r2-warm-cities" hidden></p>
      <div class="r2-warm-here">
        <div class="r2-warm-kicker">Already here</div>
        <p class="r2-warm-here-line">${room ? 'Looking for who else is here…' : 'Looking for your classmates…'}</p>
        <div class="r2-warm-chips"></div>
      </div>
    </section>`);
  container.appendChild(node);
  const q = (s) => node.querySelector(s);
  const answerIn = q('.r2-warm-answer'), cityIn = q('.r2-warm-city'), saveBtn = q('.r2-warm-save'), status = q('.r2-warm-status');
  q('.r2-warm-q').textContent = question;
  const say = (text, tone) => { status.textContent = text || ''; status.classList.toggle('bad', tone === 'bad'); };

  function paintCities() {
    const line = citiesLine(warm), p = q('.r2-warm-cities');
    p.textContent = line; p.hidden = !line;
  }
  function paintHere() {
    /* hereNames already leaves me out by id — a classmate who shares my name still counts */
    const names = hereNames(pres, profiles, { uid: me, now: nowFn() });
    q('.r2-warm-here-line').textContent = room ? alreadyHereCopy(names, 'person', 'people') : alreadyHereCopy(names);
    q('.r2-warm-chips').innerHTML = names.map(n => `<span class="r2-warm-chip">${esc(n)}</span>`).join('');
  }
  /* the button says what the tap does: send a first answer, or update the one on file */
  function labelBtn() { if (!saving) saveBtn.textContent = hasRow ? 'Update my answer' : 'Send my answer'; }
  /* my saved row fills the fields ONCE (a reload, a second device) — never again, so a field they cleared
     on purpose stays cleared; the button label follows whether a row exists */
  function fillMine() {
    const row = warm.find(r => r.user_id === me);
    hasRow = !!row;
    labelBtn();
    if (!row || filled) return;
    filled = true;
    mine = { answer: row.answer || '', city: row.city || '' };
    if (document.activeElement !== answerIn && !answerIn.value) answerIn.value = mine.answer;
    if (document.activeElement !== cityIn && !cityIn.value) cityIn.value = mine.city;
    if (!status.textContent) say(savedCopy(mine));
  }
  const refresh = serial(async () => {
    if (stopped) return;
    /* the two reads stand alone: a hiccup on one never blanks the other */
    let presOk = true;
    try { warm = await loadWarmups(sb, roomKey); } catch (e) { console.warn('[warmup] answers', e); }
    try { pres = await loadPresence(sb, roomKey); } catch (e) { console.warn('[warmup] presence', e); presOk = false; }
    if (stopped) return;
    try { profiles = await profilesFor(sb, roomKey, [...new Set([...warm.map(r => r.user_id), ...pres.map(r => r.user_id), me])]); } catch (e) {}
    if (stopped) return;
    fillMine(); paintCities();
    if (presOk) paintHere();
    else { q('.r2-warm-here-line').textContent = 'Couldn’t check who’s here just now — it keeps trying while you wait.'; q('.r2-warm-chips').innerHTML = ''; }
    /* the coordinator may change the question while people wait */
    if (session && session.no != null) {
      try {
        const { data } = await sb.from('ea_opil_sessions').select('warmup_q').eq('no', session.no).limit(1);
        const fresh = questionOf(data && data[0]);
        if (fresh !== question) { question = fresh; q('.r2-warm-q').textContent = question; }
      } catch (e) {}
    } else if (room && room.slug) {
      /* a room's question rides on ea_room_state — a guest cannot select ea_rooms */
      try {
        const { data } = await sb.rpc('ea_room_state', { p_key: room.key || null, p_slug: room.slug });
        const fresh = questionOf(data);
        if (fresh !== question) { question = fresh; q('.r2-warm-q').textContent = question; }
      } catch (e) {}
    }
  });
  async function save() {
    if (saving) return;
    const answer = answerIn.value.trim().slice(0, ANSWER_MAX), city = cityIn.value.trim().slice(0, CITY_CHARS);
    if (!answer && !city && !hasRow) { say('Type an answer, or where you’re joining from, then tap Send.', 'bad'); answerIn.focus(); return; }
    const clearing = !answer && !city;   /* both fields emptied over a saved row: take the answer back */
    saving = true; saveBtn.disabled = true; saveBtn.textContent = clearing ? 'Clearing…' : 'Sending…';
    try {
      if (clearing) {
        const { error } = await sb.from('ea_class_warmups').delete().eq('room_key', roomKey).eq('user_id', me);
        if (error) throw error;
        mine = { answer: '', city: '' }; hasRow = false; filled = true;
        say('Your answer is cleared. Type a new one any time before ' + (room ? 'the session' : 'class') + '.');
      } else {
        const { error } = await sb.from('ea_class_warmups').upsert({ room_key: roomKey, user_id: me, answer: answer || null, city: city || null }, { onConflict: 'room_key,user_id' });
        if (error) throw error;
        mine = { answer, city }; hasRow = true; filled = true;
        say(savedCopy(mine));
      }
      await refresh();   /* the label settles in finally, once the row is re-read */
    } catch (e) {
      console.warn('[warmup] save', e);
      say(clearing ? 'Couldn’t clear that. Check your connection and tap again.' : 'Couldn’t save that. Check your connection and tap Send again.', 'bad');
    } finally { saving = false; saveBtn.disabled = false; labelBtn(); }
  }
  saveBtn.addEventListener('click', save);
  [answerIn, cityIn].forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }));
  refresh();
  /* realtime: every answer change, and a NEW arrival on presence (an INSERT). The 30 s beats are UPDATEs
     and are left to the 20 s poll — the Already-here window is 120 s, so nothing is missed and forty
     people beating never turns into forty redraws. */
  watcher = watch(sb, roomKey, ['ea_class_warmups', { table: 'ea_class_presence', event: 'INSERT' }], refresh);
  return { stop() { stopped = true; try { if (watcher) watcher.stop(); } catch (e) {} watcher = null; try { node.remove(); } catch (e) {} }, refresh, node };
}

/* ---------- 2. in class: the host's Warm-up answers section ---------- */
export function create(ctx) {
  const { sb, el, esc, host, roomKey, session, target } = ctx;
  const room = !session && target && target.kind === 'room' && target.id ? target : null;   /* an ea_rooms room: the question lives on the row (0054) */
  let warm = [], profiles = [], watcher = null, box = null, stopped = false, begun = false, question = questionOf(session || room);
  /* a name the meeting knows is better than a blank profile */
  const meetingName = (id) => { try { const m = ctx.getMeeting(); if (m.self.customParticipantId === id) return m.self.name; const p = m.participants.joined.toArray().find(x => x.customParticipantId === id); return p ? p.name : null; } catch (e) { return null; } };
  const load = serial(async () => {
    if (stopped) return;
    try {
      warm = await loadWarmups(sb, roomKey);
      warm.forEach(r => { const n = meetingName(r.user_id); if (n) rememberName(r.user_id, n); });
      profiles = await profilesFor(sb, roomKey, warm.map(r => r.user_id));
    } catch (e) { console.warn('[warmup] load', e); }
    paint();
  });
  /* the section is the host's (spec §8): only a host opens a channel and polls the answers. A student's
     start() is a no-op — nothing to paint, nothing to fetch. */
  function begin() {
    if (begun || stopped) return;
    begun = true;
    ensureCss(); watcher = watch(sb, roomKey, ['ea_class_warmups'], load); load();
  }
  /* a write the database filtered to zero rows (a host taken off the list mid-class) is not a save */
  const changedRows = (data) => Array.isArray(data) ? data.length : (data ? 1 : 0);
  function paint() {
    if (!box || !box.isConnected) return;
    if (box.querySelector('.r2-warm-edit')) return;   /* the host is mid-edit of the question: leave the box alone */
    const rows = answerRows(warm, profiles);
    box.innerHTML = `<div class="r2-queue-head r2-warm-head">Warm-up answers <em>${rows.length || ''}</em></div>
      <div class="r2-warm-qline"><span class="r2-warm-kicker">Question of the day</span><b>${esc(question)}</b>${host && (session || room) ? '<button type="button" class="r2-mini r2-warm-change">Change the question</button>' : ''}</div>
      <p class="r2-fine r2-warm-sum">${esc(answersSummary(rows))}</p>
      ${rows.length
        ? `<div class="r2-warm-list">${rows.map(r => `<div class="r2-hand r2-warm-row"><div class="r2-who"><b>${esc(r.name)}</b><span>${r.city ? 'Joining from ' + esc(r.city) : 'Didn’t say where from'}</span></div><span class="r2-warm-a">${r.answer ? esc(r.answer) : '<i>No answer — just said where from</i>'}</span>${host ? `<button type="button" class="r2-mini r2-warm-x" data-rm="${esc(r.user_id)}" aria-label="Remove ${esc(r.name)}’s answer">Remove</button>` : ''}</div>`).join('')}</div>`
        : '<div class="r2-empty">No answers yet. People answer on the waiting screen before ' + (room ? 'the session' : 'class') + ' — answers land here as they come in.</div>'}`;
    const ch = box.querySelector('.r2-warm-change'); if (ch) ch.addEventListener('click', editQuestion);
    box.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => remove(b.dataset.rm, b)));
  }
  function editQuestion() {
    const line = box.querySelector('.r2-warm-qline'); if (!line) return;
    line.innerHTML = `<span class="r2-warm-kicker">Question of the day</span><div class="r2-warm-edit"><input type="text" maxlength="${QUESTION_MAX}" value="${esc(question === DEFAULT_QUESTION || question === ROOM_DEFAULT_QUESTION ? '' : question)}" placeholder="${esc(room ? ROOM_DEFAULT_QUESTION : DEFAULT_QUESTION)}"><button type="button" class="r2-mini r2-bring" data-q="save">Save</button><button type="button" class="r2-mini" data-q="cancel">Keep it</button></div><span class="r2-fine">Leave it blank to use the default. Students on the waiting screen see the new question within a minute.</span>`;
    const input = line.querySelector('input'); input.focus();
    line.querySelector('[data-q="cancel"]').addEventListener('click', () => { line.querySelector('.r2-warm-edit').remove(); paint(); });
    const saveQ = async () => {
      const v = input.value.trim().slice(0, QUESTION_MAX);
      const b = line.querySelector('[data-q="save"]'); b.disabled = true; b.textContent = 'Saving…';
      try {
        const { data, error } = room
          ? await sb.from('ea_rooms').update({ warmup_q: v || null }).eq('id', room.id).select('id')
          : await sb.from('ea_opil_sessions').update({ warmup_q: v || null }).eq('no', session.no).select('no');
        if (error) throw error;
        if (!changedRows(data)) throw Object.assign(new Error('no rows updated — not a host of this ' + (room ? 'room' : 'session') + ' any more'), { notHost: true });
        question = v || DEFAULT_QUESTION;
        try { ctx.toast('Question saved. The waiting screen shows it within a minute.', 5000); } catch (e) {}
        line.querySelector('.r2-warm-edit').remove(); paint();
      } catch (e) {
        console.warn('[warmup] question', e); b.disabled = false; b.textContent = 'Save';
        try { ctx.toast(room
          ? (e && e.notHost ? 'The question didn’t save — you’re no longer a host of this room.' : 'Couldn’t save the question — try again, or set it on the room card.')
          : (e && e.notHost ? 'The question didn’t save — you’re no longer set as a host of this class. The coordinator can set it on the sessions page.' : 'Couldn’t save the question — the coordinator can set it on the sessions page.'), 7000); } catch (x) {}
      }
    };
    line.querySelector('[data-q="save"]').addEventListener('click', saveQ);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveQ(); } });
  }
  async function remove(userId, btn) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Remove? Tap again'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Remove'; } }, 4000); return; }
    try {
      const { data, error } = await sb.from('ea_class_warmups').delete().eq('room_key', roomKey).eq('user_id', userId).select('user_id');
      if (error) throw error;
      if (!changedRows(data)) {
        /* nothing went: either it was already gone (fine — re-read) or this person is no longer a host here */
        const stillThere = (await loadWarmups(sb, roomKey).catch(() => warm)).some(r => r.user_id === userId);
        if (stillThere) { try { ctx.toast('That answer didn’t go — you’re no longer set as a host of this class, so answers stay as they are.', 7000); } catch (x) {} load(); return; }
      }
      warm = warm.filter(r => r.user_id !== userId); paint();
    } catch (e) { console.warn('[warmup] remove', e); try { ctx.toast('Couldn’t remove that answer right now. Check your connection and tap Remove again.'); } catch (x) {} }
  }
  return {
    start() {
      try { if (host) begin(); }
      catch (e) { console.warn('[warmup] start', e); }
    },
    stop() { stopped = true; try { if (watcher) watcher.stop(); } catch (e) {} watcher = null; },
    /* the integrator hands over a container inside the host's Questions tab (spec §8); handing one over
       is what starts the watching if start() had nothing to do */
    mountAnswers(container) {
      if (!container) return null;
      box = el('<div class="r2-warm-answers"></div>'); container.appendChild(box); paint();
      try { begin(); } catch (e) { console.warn('[warmup] mount', e); }
      return box;
    },
    get rows() { return answerRows(warm, profiles); },
    get question() { return question; },
    refresh: load,
  };
}
