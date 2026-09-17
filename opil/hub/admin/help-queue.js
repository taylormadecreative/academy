/* The coordinator's Help requests (spec 2026-09-16 §5). mount(sb, el): three lists — waiting, claimed,
   answered — with Claim, Answer (saves, then emails the student through ea-class-help-ping), Close
   (two taps), and "Start a quick room" (the student's team room, feature 3) when they have a team.
   Rows come from ea_class_help_queue() (0047), which names the student, school and team for a
   facilitator who cannot read the roster tables. Realtime on the table so a new request appears
   while the page is open. `#help` in the address scrolls here (the facilitators' email link). */
const { injectCss, cssHref, queueBuckets, queueCount, queueStatusCopy, trackWord, teamRoomPath, pingHelp, cleanHelpText, ago } = await import('/js/rtk-help.js' + new URL(import.meta.url).search);

export function mount(sb, el, { esc, countEl } = {}) {
  if (!el) return null;
  const E = esc || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const cfg = (typeof window !== 'undefined' && window.BM_CONFIG) || {};
  injectCss(cssHref());
  let rows = [], chan = null, uid = null, poll = null;
  el.classList.add('hq');
  el.innerHTML = '<div class="hq-empty">Loading…</div>';
  /* who is tapping: needed before a claim or an answer is written, so the row names the right person */
  async function me() {
    if (uid) return uid;
    try { const { data } = await sb.auth.getSession(); uid = data && data.session && data.session.user ? data.session.user.id : null; } catch (e) { uid = null; }
    return uid;
  }
  me();

  async function load() {
    try { const { data, error } = await sb.rpc('ea_class_help_queue'); if (error) { console.warn('[help-queue]', error); el.innerHTML = '<div class="hq-empty">Could not load help requests. Reload the page to try again.</div>'; return; } rows = data || []; }
    catch (e) { console.warn('[help-queue]', e); el.innerHTML = '<div class="hq-empty">Could not load help requests. Reload the page to try again.</div>'; return; }
    paint();
  }
  function rowHTML(r) {
    const room = teamRoomPath(r.team_id);
    const meta = [r.school, r.team_name].filter(Boolean).join(' · ');
    const canAnswer = r.status === 'open' || r.status === 'claimed' || r.status === 'answered';
    return `<div class="hq-row ${E(r.status)}" data-id="${E(r.id)}">
      <div class="hq-who"><b>${E(r.name || 'Someone')}</b>${meta ? `<span class="hq-meta">${E(meta)}</span>` : ''}<span class="hq-pill">${E(trackWord(r.track))}</span><span class="hq-meta">${E(ago(r.created_at))}</span></div>
      <p class="hq-q">${E(r.text)}</p>
      ${r.answer ? `<div class="hq-a"><b>${E(r.claimed_name || 'Answer')}:</b> ${E(r.answer)}</div>` : ''}
      <div class="hq-st">${E(queueStatusCopy(r))}</div>
      <div class="hq-actions">
        ${r.status === 'open' ? `<button type="button" class="hq-btn gold" data-act="claim">I’ll take this</button>` : ''}
        ${canAnswer ? `<button type="button" class="hq-btn${r.status === 'claimed' ? ' gold' : ''}" data-act="answer">${r.answer ? 'Change the answer' : 'Answer'}</button>` : ''}
        ${r.email ? `<a class="hq-btn" href="mailto:${E(r.email)}?subject=${encodeURIComponent('Your OPIL question')}">Email ${E((r.name || '').split(' ')[0] || 'them')}</a>` : ''}
        ${room ? `<a class="hq-btn" href="${E(room)}">Start a quick room</a>` : ''}
        ${r.status !== 'closed' ? `<button type="button" class="hq-btn" data-act="close">Close</button>` : ''}
      </div>
      <div class="hq-answer" hidden>
        <textarea maxlength="4000" placeholder="Write the answer here. It is emailed to ${E((r.name || 'the student').split(' ')[0])} and shows on their hub home.">${E(r.answer || '')}</textarea>
        <div class="hq-actions"><button type="button" class="hq-btn gold" data-act="send">Send the answer</button><button type="button" class="hq-btn" data-act="cancel">Never mind</button><span class="hq-msg" role="status"></span></div>
      </div>
    </div>`;
  }
  function paint() {
    if (el.querySelector('[data-armed="1"]') || el.querySelector('.hq-answer:not([hidden])')) return;   /* never wipe a half-written answer or a Close mid-tap */
    const b = queueBuckets(rows);
    if (countEl) countEl.textContent = queueCount(rows) ? String(queueCount(rows)) : '';
    const group = (title, list, empty) => `<div class="hq-group"><h3>${title}</h3><div class="hq-list">${list.length ? list.map(rowHTML).join('') : `<div class="hq-empty">${empty}</div>`}</div></div>`;
    el.innerHTML = rows.length
      ? `<div class="hq-sum">${b.open.length ? b.open.length + (b.open.length === 1 ? ' request is waiting' : ' requests are waiting') : 'Nothing waiting'} · ${b.claimed.length} claimed · ${b.answered.length} answered · ${b.closed} closed. Claim one so the others know it is taken; Answer emails the student.</div>`
        + group('Waiting', b.open, 'No one is waiting on help right now.')
        + (b.claimed.length ? group('Claimed', b.claimed, '') : '')
        + (b.answered.length ? group('Answered', b.answered, '') : '')
      : '<div class="hq-empty">No help requests yet. When a student taps “Need help with something?” on the hub, it lands here and the facilitators for that track get an email.</div>';
    wire();
  }
  function wire() {
    el.querySelectorAll('.hq-row').forEach(rowEl => {
      const id = rowEl.dataset.id, r = rows.find(x => x.id === id); if (!r) return;
      const box = rowEl.querySelector('.hq-answer'), msg = rowEl.querySelector('.hq-msg');
      rowEl.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        if (act === 'claim') { btn.disabled = true; await claim(r); }
        else if (act === 'answer') { box.hidden = false; try { box.querySelector('textarea').focus(); } catch (e) {} }
        else if (act === 'cancel') { box.hidden = true; paint(); }
        else if (act === 'send') {
          const answer = cleanHelpText(box.querySelector('textarea').value).slice(0, 4000);
          if (!answer) { msg.textContent = 'Write the answer first.'; return; }
          btn.disabled = true; msg.textContent = 'Saving…';
          /* the answerer owns the answer: claimed_by moves to them so the hub ("Jamal answered your question")
             and the email (sent as the caller) name the same person */
          const by = await me();
          const ok = await update(r, Object.assign({ status: 'answered', answer }, by ? { claimed_by: by } : {}), null, true);
          if (!ok) { btn.disabled = false; msg.textContent = 'Could not save the answer. Check your connection and try again.'; return; }
          msg.textContent = 'Saved. Emailing ' + ((r.name || 'the student').split(' ')[0]) + '…';
          const ping = await pingHelp(sb, cfg, { id: r.id, answer });
          box.hidden = true;
          toastLine(ping && ping.ok && ping.emailed ? 'Answer sent — ' + (r.name || 'the student') + ' has it by email and on their hub home.' : 'Answer saved and on their hub home. The email did not go out — use Email ' + ((r.name || '').split(' ')[0] || 'them') + ' if it is urgent.');
          await load();
        }
        else if (act === 'close') {
          if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Close? Tap again'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Close'; } }, 4000); return; }
          btn.dataset.armed = '';   /* let paint() redraw the moment the row is closed — an armed button blocks it */
          btn.disabled = true; await update(r, { status: 'closed' }, 'Closed.');
        }
      }));
    });
  }
  let toastEl = null;
  function toastLine(text) {
    try { if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'hub-note'; toastEl.setAttribute('role', 'status'); el.parentElement.insertBefore(toastEl, el); } toastEl.textContent = text; toastEl.hidden = false; setTimeout(() => { if (toastEl) toastEl.hidden = true; }, 7000); } catch (e) {}
  }
  async function update(r, patch, doneLine, quiet) {
    try {
      const { error } = await sb.from('ea_class_help').update(patch).eq('id', r.id);
      if (error) throw error;
      if (doneLine) toastLine(doneLine);
      if (!quiet) await load();
      return true;
    } catch (e) { console.warn('[help-queue] update', e); if (!quiet) { toastLine('Could not save that. Check your connection and try again.'); await load(); } return false; }
  }
  /* a claim only lands on a row that is still open: two facilitators tapping at once cannot both be told it is theirs */
  async function claim(r) {
    const by = await me();
    try {
      const { data, error } = await sb.from('ea_class_help').update(Object.assign({ status: 'claimed' }, by ? { claimed_by: by } : {})).eq('id', r.id).eq('status', 'open').select('id');
      if (error) throw error;
      toastLine(data && data.length ? 'Claimed — the others see it is yours.' : 'Someone else just took this one.');
    } catch (e) { console.warn('[help-queue] claim', e); toastLine('Could not claim that. Check your connection and try again.'); }
    await load();
  }
  try { chan = sb.channel('help-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'ea_class_help' }, () => load()).subscribe(); } catch (e) { chan = null; }
  poll = setInterval(load, 60000);
  load();
  try { if (location.hash === '#help') setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300); } catch (e) {}
  return { reload: load, destroy() { clearInterval(poll); try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null; } };
}
