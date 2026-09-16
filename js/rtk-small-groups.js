/* Small groups — the board (concept 4 "Small groups", 2026-09-14) and the student's side of it.
   Spec: docs/superpowers/specs/2026-09-16-opil-small-groups-board-design.md
   Rooms are RealtimeKit connectedMeetings (createMeetings / moveParticipants / deleteMeetings; ids from
   getConnectedMeetings(), matched by customParticipantId). The clock and the host's notes ride a Supabase
   broadcast channel (`sg-<key>`, event `sg`) — no table. "Needs help" is a hand of kind 'help' in the
   same hands table the question line uses (0040), note = the room's meeting id.
   Pure decisions (who goes where, the clock's words, whose note it is) live in opil/hub/live-rooms.js. */
export function createSmallGroups({ sb, copy, el, esc, key, isRoom, words, host, uid, rootId, getMeeting, myIdIn, hands, toast, confirmInline, onTick, closeSheet, facilitator }) {
  let chan = null, timer = { endsAt: null, minutes: 0 }, heartbeat = null, tick = null, noteEl = null, board = null, boardTick = null;
  const m = () => getMeeting();
  const cm = () => m().connectedMeetings;
  const here = () => { try { return m().meta.meetingId; } catch (e) { return null; } };
  const inRoom = () => !!(rootId && here() && here() !== rootId);
  const myName = () => { try { return m().self.name || null; } catch (e) { return null; } };

  /* ---- the channel: the clock and the notes ---- */
  const send = async (payload) => { try { if (chan) await chan.send({ type: 'broadcast', event: 'sg', payload }); } catch (e) {} };
  const handle = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    /* only a host's word counts: a note or a clock from anyone else on the channel is dropped */
    if (payload.from !== uid && !hostIds().has(payload.from)) return;
    if (payload.type === 'timer') {
      timer = { endsAt: payload.endsAt ? Date.parse(payload.endsAt) : null, minutes: Number(payload.minutes) || 0 };
      startTick(); if (onTick) onTick(); paintBoard();
    } else if (payload.from !== uid && copy.noteIsForMe(payload, here()) && inRoom()) {
      showNote(payload);
    }
  };
  function start() {
    try {
      chan = sb.channel('sg-' + key, { config: { broadcast: { self: true } } });
      chan.on('broadcast', { event: 'sg' }, (msg) => handle(msg && msg.payload));
      chan.subscribe();
    } catch (e) { chan = null; }
  }
  function stop() { try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null; clearInterval(heartbeat); clearInterval(tick); clearInterval(boardTick); }
  function startTick() {
    clearInterval(tick); if (!timer.endsAt) return;
    tick = setInterval(() => { if (onTick) onTick(); patchClock(); if (Date.now() >= timer.endsAt + 1500) clearInterval(tick); }, 1000);
  }
  /* the host sets the clock at the split (and clears it at bring-back); repeated every 15 s while rooms
     are open so a student moved in later still gets it */
  const setTimer = (minutes) => {
    timer = { endsAt: minutes ? Date.now() + minutes * 60000 : null, minutes: minutes || 0 };
    startTick(); if (onTick) onTick();
    const payload = () => ({ type: 'timer', from: uid, endsAt: timer.endsAt ? new Date(timer.endsAt).toISOString() : null, minutes: timer.minutes });
    send(payload());
    clearInterval(heartbeat); if (timer.endsAt) heartbeat = setInterval(() => send(payload()), 15000);
  };
  /* what the strip says after the room's name: "09:32" (it appends "left") or over */
  const left = () => { const t = copy.timerCopy({ endsAt: timer.endsAt, minutes: timer.minutes }); return t ? { text: t.left, over: t.over } : null; };

  /* ---- notes from the host: a banner under the strip, and a toast ---- */
  function bindNote(elm) {
    noteEl = elm; if (!noteEl) return;
    noteEl.addEventListener('click', (e) => { if (e.target.closest('.r2-note-x')) { noteEl.hidden = true; noteEl.innerHTML = ''; } });
  }
  function showNote(p) {
    const from = p.from_name || facilitator || copy.capFirst(words.host);
    if (noteEl) { noteEl.innerHTML = `<b>${esc(from)}:</b> <span>${esc(p.text)}</span><button type="button" class="r2-note-x" aria-label="Dismiss">×</button>`; noteEl.hidden = false; }
    toast(from + ': ' + p.text, 8000);
  }
  const sendNote = async (room, text) => {
    const t = String(text || '').trim().slice(0, 200); if (!t) return false;
    await send({ type: 'note', room, text: t, from: uid, from_name: myName() || facilitator || null, at: new Date().toISOString() });
    return true;
  };

  /* ---- help: a hand of kind 'help' with the room's id ---- */
  const myHelp = () => copy.helpRows(hands.rows()).find(h => h.user_id === uid) || null;
  async function askHelp() {
    const room = here(); if (!room) return;
    const { error } = await sb.from(hands.table).insert({ [hands.col]: hands.val, user_id: uid, kind: 'help', note: room });
    if (error && error.code !== '23505') { console.warn('[sg] help', error.message); toast('Could not send your request. Try again, or unmute and ask.'); return; }
    await hands.load();
  }
  async function cancelHelp() { await sb.from(hands.table).delete().eq(hands.col, hands.val).eq('user_id', uid).eq('kind', 'help').is('done_at', null); await hands.load(); }
  async function clearHelp(roomId) {
    const ids = copy.helpRows(hands.rows()).filter(h => h.note === roomId).map(h => h.id);
    if (!ids.length) return;
    await sb.from(hands.table).update({ done_at: new Date().toISOString() }).in('id', ids);
    await hands.load();
  }

  /* ---- the bar, inside a room: Ask for help (students) + Back to the main room ---- */
  function primary(container) {
    const asked = !!myHelp();
    const hc = copy.helpCopy(asked, facilitator);
    container.innerHTML = (host ? '' : `<button type="button" class="r2-cta r2-help${asked ? ' on' : ''}"><b>${esc(hc.b)}</b><span>${esc(hc.s)}</span></button>`)
      + `<button type="button" class="${host ? 'r2-cta' : 'r2-btn'} r2-back"><b>Back to the main room</b>${host ? '<span>Leaves this small group</span>' : ''}</button>`;
    const h = container.querySelector('.r2-help');
    if (h) h.addEventListener('click', async () => { h.disabled = true; try { asked ? await cancelHelp() : await askHelp(); } catch (e) {} h.disabled = false; });
    container.querySelector('.r2-back').addEventListener('click', async (ev) => { const b = ev.currentTarget; if (!host && !confirmInline(b, 'Leave your group?')) return; b.disabled = true; try { await goRoot(); } catch (e) { console.warn('[sg] back', e); toast('Could not move you back. Tap it again — or press Leave and reopen your link.'); b.disabled = false; } });
  }
  const goRoot = async () => { await cm().moveParticipants(here(), rootId, [await myIdIn(here())]); };
  const visit = async (roomId) => { if (roomId === here()) return; await cm().moveParticipants(here(), roomId, [await myIdIn(here())]); };

  /* ---- the board ---- */
  const hostIds = () => { const s = new Set(); try { m().participants.joined.toArray().forEach(x => { if (/host/.test(String(x.presetName || ''))) s.add(x.customParticipantId); }); s.add(m().self.customParticipantId); } catch (e) {} return s; };
  const roster = async () => {
    if (isRoom) return null;
    try { const { data } = await sb.rpc('ea_opil_roster_teams'); if (!Array.isArray(data) || !data.length) return null; const map = new Map(); data.forEach(r => map.set(r.user_id, r.team_name)); return map; } catch (e) { return null; }
  };
  const many = copy.capFirst(words.many);
  const setupHTML = () => `<div class="r2-groups r2-board r2-board-setup">
      <p class="r2-fine" style="text-align:left;margin:0">${many} are moved into rooms automatically. You stay in the main room and can join any room from this board. <b>Bring everyone back</b> closes the rooms.</p>
      <div class="r2-split">
        ${isRoom ? '' : `<label>Split <select class="r2-mode"><option value="team">by team</option><option value="even">evenly</option></select></label>`}
        <label class="r2-n-wrap"${isRoom ? '' : ' hidden'}>Rooms <select class="r2-n">${[2, 3, 4, 5, 6].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Minutes <select class="r2-min">${[5, 10, 15, 20, 30].map(n => `<option value="${n}"${n === 15 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <button type="button" class="r2-btn" data-g="split"><b>Split ${esc(words.many)} into rooms</b></button>
      </div>
      <p class="r2-fine" style="text-align:left">${isRoom ? '' : 'Split by team puts each team in its own room, named after the team; anyone without a team shares an Open room. '}Everyone in a room sees the clock; when it hits zero nobody is moved until you press Bring everyone back.</p>
    </div>`;
  const cardHTML = (r, help) => {
    const ppl = r.participants || [], st = copy.roomStatus({ count: ppl.length, help });
    const me = r.id === here();
    return `<div class="r2-room-card tone-${st.tone}" data-room="${esc(r.id)}">
      <div class="r2-room-top"><b>${esc(r.title || 'Room')}</b><span class="r2-room-status"><i></i>${st.word}</span></div>
      <span class="r2-room-count">${ppl.length} ${ppl.length === 1 ? esc(words.one) : esc(words.many)}</span>
      <p class="r2-room-names">${ppl.length ? esc(ppl.map(x => x.displayName).join(', ')) : 'No one here yet'}</p>
      <div class="r2-room-actions">
        <button type="button" class="r2-mini r2-bring" data-visit="${esc(r.id)}"${me ? ' disabled' : ''}>${me ? 'You are here' : 'Join room'}</button>
        <button type="button" class="r2-mini" data-msg="${esc(r.id)}">Message room</button>
      </div>
      <form class="r2-room-msg" data-room="${esc(r.id)}" hidden><input maxlength="200" placeholder="One line for this room…" aria-label="Message this room" autocomplete="off"><button type="submit" class="r2-mini r2-bring">Send</button></form>
    </div>`;
  };
  const boardHTML = (rooms) => {
    const helps = copy.helpRows(hands.rows());
    const helpFor = (id) => helps.some(h => h.note === id);
    const need = rooms.filter(r => helpFor(r.id));
    const t = copy.timerCopy({ endsAt: timer.endsAt, minutes: timer.minutes });
    return `<div class="r2-groups r2-board">
      <div class="r2-board-head">
        <div><b>Small groups in progress</b><span>${many} are in their rooms. Join any room, or bring everyone back.</span></div>
        <form class="r2-note-all"><input maxlength="200" placeholder="Message all rooms…" aria-label="Message all rooms" autocomplete="off"><button type="submit" class="r2-mini r2-bring">Send to all</button></form>
      </div>
      <div class="r2-board-main">
        <div class="r2-room-cards">${rooms.map(r => cardHTML(r, helpFor(r.id))).join('')}</div>
        <aside class="r2-board-side">
          <section class="r2-timer${t && t.over ? ' over' : ''}"><b>Time left in small groups</b>
            ${t ? `<div class="r2-clock">${t.over ? 'Time’s up' : t.clock}</div><div class="r2-track"><i style="width:${Math.round(t.pct * 100)}%"></i></div><span>${esc(t.session)} · ${esc(t.ends)}</span>` : `<div class="r2-clock r2-clock-none">No clock</div><span>Set minutes when you split next time.</span>`}
          </section>
          <section class="r2-help-list"><b>Rooms needing help (${need.length})</b>
            ${need.length ? need.map(r => `<div class="r2-hand"><span class="r2-dot-help"></span><div class="r2-who"><b>${esc(r.title || 'Room')}</b><span>${(r.participants || []).length} ${esc(words.many)}</span></div><button type="button" class="r2-mini r2-bring" data-visit="${esc(r.id)}">Join</button></div>`).join('') : '<div class="r2-empty">No one needs help right now.</div>'}
          </section>
          <section class="r2-all-rooms"><b>All rooms (${rooms.length})</b>
            ${rooms.map(r => `<div class="r2-room-row tone-${copy.roomStatus({ count: (r.participants || []).length, help: helpFor(r.id) }).tone}"><i></i><span>${esc(r.title || 'Room')}</span><em>${(r.participants || []).length}</em></div>`).join('')}
          </section>
          <button type="button" class="r2-btn danger r2-bring-back" data-g="back"><b>Bring everyone back</b><span>Ends small groups for all rooms</span></button>
        </aside>
      </div>
    </div>`;
  };

  let lastRooms = null;
  const readRooms = async () => { const list = await cm().getConnectedMeetings(); return (list && list.meetings) || []; };
  /* re-paint the open board in place (the clock every second, the help list as hands change) without
     losing a half-typed note */
  /* the clock alone, in place: a repaint every second would un-arm a two-tap button and throw focus (UX review 9/16) */
  function patchClock() {
    const sec = board && board.isConnected ? board.querySelector('.r2-timer') : null; if (!sec) return;
    const t = copy.timerCopy({ endsAt: timer.endsAt, minutes: timer.minutes }); if (!t) return;
    sec.classList.toggle('over', t.over);
    const c = sec.querySelector('.r2-clock'); if (c) c.textContent = t.over ? 'Time’s up' : t.clock;
    const i = sec.querySelector('.r2-track i'); if (i) i.style.width = Math.round(t.pct * 100) + '%';
    const s = sec.querySelector('span'); if (s) s.textContent = t.session + ' · ' + t.ends;
  }
  function paintBoard() {
    if (!board || !board.isConnected || !lastRooms || board.classList.contains('r2-board-setup')) return;
    if (board.querySelector('[data-armed="1"], .r2-room-msg:not([hidden]), input:focus')) { patchClock(); return; }   /* mid-action: leave the buttons alone */
    const typing = board.querySelector('input:focus'); const keep = typing ? { form: typing.closest('form'), value: typing.value, room: typing.closest('form') && typing.closest('form').dataset.room } : null;
    const fresh = el(boardHTML(lastRooms));
    board.replaceChildren(...fresh.childNodes); wire(board);
    if (keep) { const f = keep.room ? board.querySelector(`.r2-room-msg[data-room="${CSS.escape(keep.room)}"]`) : board.querySelector('.r2-note-all'); if (f) { f.hidden = false; const i = f.querySelector('input'); i.value = keep.value; i.focus(); } }
  }
  async function refresh() {
    if (!board || !board.isConnected) return;
    let rooms; try { rooms = await readRooms(); } catch (e) { console.warn('[sg] rooms', e); board.innerHTML = '<div class="r2-empty">Could not load the rooms. Close this and open Tools › Small groups again.</div>'; return; }
    const wasSetup = board.classList.contains('r2-board-setup');
    if (!rooms.length) { if (!wasSetup || !board.querySelector('[data-g="split"]')) { const s = el(setupHTML()); board.className = s.className; board.replaceChildren(...s.childNodes); wire(board); } return; }
    lastRooms = rooms;
    if (wasSetup) board.className = 'r2-groups r2-board';
    paintBoard();
  }
  function wire(root) {
    const split = root.querySelector('[data-g="split"]');
    if (split) {
      const mode = root.querySelector('.r2-mode'), nWrap = root.querySelector('.r2-n-wrap');
      if (mode && nWrap) { const sync = () => { nWrap.hidden = mode.value !== 'even'; }; mode.addEventListener('change', sync); sync(); }
      /* two taps, like Bring everyone back: one stray tap must not scatter a whole class mid-lecture.
         confirmInline rewrites the button's HTML, so the label is set whole below. */
      split.addEventListener('click', async (ev) => {
        const b = ev.currentTarget; if (!confirmInline(b, 'Split ' + words.many + ' into rooms?')) return;
        b.disabled = true; b.innerHTML = '<b>Splitting…</b>';
        try {
          const byTeam = !isRoom && mode && mode.value === 'team';
          const n = Number((root.querySelector('.r2-n') || {}).value) || 2;
          const minutes = Number((root.querySelector('.r2-min') || {}).value) || 15;
          const list = await cm().getConnectedMeetings();
          if (list.meetings && list.meetings.length) { toast('Small groups are already open.'); await refresh(); return; }
          const hosts = hostIds();
          const people = ((list.parentMeeting && list.parentMeeting.participants) || []).filter(x => !hosts.has(x.customParticipantId)).map(x => ({ id: x.id, uid: x.customParticipantId, name: x.displayName }));
          let plan = null;
          if (byTeam) { const teams = await roster(); if (teams) plan = copy.roomsByTeam(people, p => teams.get(p.uid) || null); else toast('Could not read the teams — splitting evenly instead.'); }
          if (!plan || !plan.length) plan = copy.roomsEvenly(people, byTeam ? Math.min(6, Math.max(2, Math.ceil(people.length / 4))) : n);
          const made = await cm().createMeetings(plan.map(r => ({ title: r.title })));
          for (let i = 0; i < made.length; i++) if (plan[i] && plan[i].ids.length) await cm().moveParticipants(rootId, made[i].id, plan[i].ids);
          setTimer(minutes);
          toast(people.length ? people.length + ' ' + (people.length === 1 ? words.one : words.many) + ' moved into ' + made.length + ' rooms · ' + minutes + ' minutes on the clock.' : 'Rooms are open — nobody to move yet.');
        } catch (e) { console.warn('[sg] split', e); toast('Could not finish the split. Check the board — some ' + words.many + ' may already be in rooms — then try again.', 7000); }
        b.disabled = false; b.innerHTML = '<b>Split ' + esc(words.many) + ' into rooms</b>';
        await refresh();
      });
    }
    root.querySelectorAll('[data-visit]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.visit; if (id === here()) return; b.disabled = true;
      try { await visit(id); await clearHelp(id); if (closeSheet) closeSheet(); }
      catch (e) { console.warn('[sg] visit', e); toast('Could not move you into that room. Try again.'); b.disabled = false; }
    }));
    root.querySelectorAll('[data-msg]').forEach(b => b.addEventListener('click', () => { const f = root.querySelector(`.r2-room-msg[data-room="${CSS.escape(b.dataset.msg)}"]`); if (f) { f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); } }));
    root.querySelectorAll('.r2-room-msg, .r2-note-all').forEach(f => f.addEventListener('submit', async (e) => {
      e.preventDefault(); const i = f.querySelector('input'), room = f.dataset.room || 'all';
      if (await sendNote(room, i.value)) { i.value = ''; toast(room === 'all' ? 'Sent to every room.' : 'Sent to that room.'); if (f.dataset.room) f.hidden = true; }
    }));
    const back = root.querySelector('[data-g="back"]');
    if (back) back.addEventListener('click', async (ev) => {
      const b = ev.currentTarget; if (!confirmInline(b, 'Bring everyone back?')) return;
      b.disabled = true;
      try { const rooms = await readRooms(); if (inRoom()) await goRoot(); if (rooms.length) await cm().deleteMeetings(rooms.map(r => r.id)); setTimer(0); lastRooms = null; toast('Small groups closed — everyone is coming back.'); }
      catch (e) { console.warn('[sg] close', e); toast('Could not close the rooms. Tap Bring everyone back again.'); }
      b.disabled = false; await refresh();
    });
  }
  function boardPane() {
    board = el(setupHTML()); wire(board);
    refresh();
    clearInterval(boardTick); boardTick = setInterval(() => { if (!board || !board.isConnected) return clearInterval(boardTick); refresh(); }, 5000);
    return board;
  }

  /* a room asked for help while the board is closed: the host hears about it here (a toast that names the
     room and the way to it), so "Help is on the way" is a promise the room keeps */
  const seenHelp = new Set(); let helpPrimed = false;
  async function onHands() {
    paintBoard();
    const open = copy.helpRows(hands.rows());
    const fresh = open.filter(h => !seenHelp.has(h.id)); open.forEach(h => seenHelp.add(h.id));
    if (!helpPrimed) { helpPrimed = true; return; }   /* the first load is history, not news */
    if (!host || !fresh.length || (board && board.isConnected)) return;
    let title = null;
    try { const rooms = lastRooms || await readRooms(); const r = rooms.find(x => x.id === fresh[0].note); title = r ? r.title : null; } catch (e) {}
    toast((title || 'A room') + ' needs help — open Tools › Small groups and tap Join.', 9000);
  }
  return { start, stop, left, primary, bindNote, board: boardPane, onHands, inRoom };
}
