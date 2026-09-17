/* The hub's "Need help with something?" — hub home and the team page (spec 2026-09-16 §5).
   mount(sb, user, anchorEl): a gold button, a one-line note when there is news ("Casey answered your
   question."), and a sheet: which track, a paragraph, Send, then the student's own requests with the
   answers underneath. Rides js/rtk-help.js for the words and the calls; realtime on the student's own
   rows so an answer shows up without a reload. `#help` in the address opens the sheet (the email link). */
/* the shared module rides this file's own ?v= (hub.js's stamp), so it cache-busts with the rest of the hub */
const { formHTML, requestHTML, wireForm, injectCss, cssHref, homeNoteCopy, sortHelp, trackFor } = await import('/js/rtk-help.js' + new URL(import.meta.url).search);

export function mount(sb, user, anchorEl, { esc, defaultTrack } = {}) {
  if (!anchorEl || !user) return null;
  const E = esc || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const cfg = (typeof window !== 'undefined' && window.BM_CONFIG) || {};
  injectCss(cssHref());
  let rows = [], chan = null, sheet = null, lastFocus = null;
  /* the answered requests this person has already opened on this device — the "answered your question" note
     goes quiet once they have seen the answer (per viewer, per browser; empty when storage is off) */
  const SEEN_KEY = 'opil_help_seen_' + user.id;
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { seen = new Set(); }
  function markSeen() {
    let changed = false;
    rows.forEach(r => { if (r.status === 'answered' && !seen.has(r.id)) { seen.add(r.id); changed = true; } });
    if (changed) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-50))); } catch (e) {} }
    return changed;
  }

  anchorEl.classList.add('hh');
  anchorEl.innerHTML = `<div><button type="button" class="hh-btn">Need help with something?</button></div><div class="hh-note" aria-live="polite"></div>`;
  const btn = anchorEl.querySelector('.hh-btn'), note = anchorEl.querySelector('.hh-note');

  async function load() {
    try { const { data, error } = await sb.from('ea_class_help').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30); if (error) console.warn('[help] load', error); rows = sortHelp(data || []); }
    catch (e) { console.warn('[help] load', e); rows = []; }
    paintNote(); paintMine();
  }
  function paintNote() {
    const line = homeNoteCopy(rows, seen);
    note.innerHTML = line ? `<b>${E(line)}</b><button type="button" class="hh-note-open">See it</button>` : '';
    const o = note.querySelector('.hh-note-open'); if (o) o.addEventListener('click', open);
  }
  function paintMine() {
    if (!sheet) return;
    const m = sheet.querySelector('.hh-mine');
    m.innerHTML = rows.length ? '<div class="hh-lbl">Your requests</div>' + rows.map(r => requestHTML(E, r)).join('') : '<div class="hh-empty">Nothing sent yet. Your requests and the answers will show here.</div>';
  }
  function open() {
    if (sheet) { close(); }
    lastFocus = document.activeElement;
    sheet = document.createElement('div');
    sheet.className = 'hh-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'hh-title');
    sheet.innerHTML = `<div class="hh-card">
      <div class="hh-head"><h2 id="hh-title">Need help with something?</h2><button type="button" class="hh-close">Close</button></div>
      <div class="hh-body">
        <p class="hh-intro">Stuck between classes? Say what you need and the facilitators for that track get an email. They answer you by email, and the answer shows up here too.</p>
        ${formHTML(E)}
        <div class="hh-mine"></div>
      </div>
    </div>`;
    document.body.appendChild(sheet);
    sheet.querySelector('.hh-close').addEventListener('click', close);
    sheet.addEventListener('click', (ev) => { if (ev.target === sheet) close(); });
    document.addEventListener('keydown', onKey);
    wireForm(sheet.querySelector('form'), { sb, cfg, roomKey: 'opil:hub', defaultTrack: defaultTrack || 'business', onSent: (row) => { rows = sortHelp([row].concat(rows)); paintNote(); paintMine(); } });
    paintMine();
    if (markSeen()) paintNote();   /* the answers are on screen now: the home note stops saying "answered" */
    try { sheet.querySelector('textarea').focus(); } catch (e) {}
  }
  function onKey(ev) { if (ev.key === 'Escape') close(); }
  function close() {
    if (!sheet) return;
    document.removeEventListener('keydown', onKey);
    sheet.remove(); sheet = null;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  btn.addEventListener('click', open);

  /* the student's own rows change (a claim, an answer) → repaint; RLS keeps this to their rows */
  try {
    chan = sb.channel('help-mine-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_class_help', filter: 'user_id=eq.' + user.id }, () => load()).subscribe();
  } catch (e) { chan = null; }
  load();
  /* the email's link: /opil/hub/#help */
  try { if (location.hash === '#help') { open(); anchorEl.scrollIntoView({ block: 'center' }); } } catch (e) {}

  return { open, close, reload: load, destroy() { close(); try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null; } };
}
export { trackFor };
