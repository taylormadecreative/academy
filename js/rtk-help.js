/* Need help outside class — class plugin + the shared piece of the hub's help button
   (spec 2026-09-16-class-features-design.md §5). A student picks a track, writes one paragraph, sends;
   the row lands in ea_class_help (0047) and the page calls ea-class-help-ping, which emails the
   facilitators for that track. The program team answers from the coordinator page; the answer is
   emailed and shows under the student's request. In the class room (OPIL students only) the same
   sheet sits behind a bar button, for the question that can wait until after class.
   Pure decisions (tracks, the status sentences, "5 min ago") are exported for tests. Import-safe in Node. */
export const TRACKS = Object.freeze([
  { key: 'business', label: 'Business track', hint: 'Your model, your customers, your pitch' },
  { key: 'payments', label: 'Open payments track', hint: 'Interledger, wallets, the code' },
  { key: 'hpc', label: 'HPC series', hint: 'Supercomputer time and your data' },
  { key: 'hub', label: 'The hub itself', hint: 'Signing in, your team page, a link that does not work' },
]);
export const TRACK_WORD = Object.freeze(Object.fromEntries(TRACKS.map(t => [t.key, t.label])));
export const MAX_TEXT = 2000;
export const HELP_FUNCTION = '/ea-class-help-ping';

/* a label as a person or a facilitator row says it → the track key: "Track 2 · Casey" → payments,
   "Business" → business, "HPC" → hpc, "the hub" → hub; nothing recognisable → null */
export function trackFor(label) {
  const s = String(label || '').toLowerCase();
  if (!s.trim()) return null;
  if (TRACK_WORD[s.trim()]) return s.trim();
  if (/\bhpc\b|high[\s-]?performance|ashley/.test(s)) return 'hpc';
  if (/track\s*2|open\s*payments|\bpayments?\b|interledger|casey/.test(s)) return 'payments';
  if (/track\s*1|business|jarrell/.test(s)) return 'business';
  if (/\bhub\b|sign[\s-]?in|log[\s-]?in|website|the site/.test(s)) return 'hub';
  return null;
}
export const trackWord = (key) => TRACK_WORD[key] || 'the program';

/* the text as typed → the text as stored: trimmed, at most 2000 characters; '' when there is nothing to send */
export function cleanHelpText(s) { return String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXT); }

/* "just now" · "5 min ago" · "2 hours ago" · "yesterday" · "Sep 12" */
export function ago(iso, now) {
  const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
  const d = Math.max(0, (now == null ? Date.now() : now) - t);
  const m = Math.round(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* the student's line under their own request — one sentence per state */
export function helpStatusCopy(row) {
  const who = (row && row.claimed_name) || 'A facilitator';
  const st = row && row.status;
  if (st === 'answered') return who + ' answered your question.';
  if (st === 'claimed') return who + ' is on it — you will get an email.';
  if (st === 'closed') return row && row.answer ? who + ' answered this, and it is closed.' : 'This one is closed.';
  return 'Sent. A facilitator will email you back — the answer also shows up here.';
}
/* the coordinator's line on a queue row */
export function queueStatusCopy(row, now) {
  const st = row && row.status, when = ago(row && (st === 'open' ? row.created_at : row.updated_at), now);
  if (st === 'claimed') return (row.claimed_name || 'Someone') + ' claimed this' + (when ? ' · ' + when : '');
  if (st === 'answered') return (row.claimed_name || 'Someone') + ' answered' + (when ? ' · ' + when : '') + (row.answer_sent_at ? ' · emailed' : ' · email not sent yet');
  if (st === 'closed') return 'Closed' + (when ? ' · ' + when : '');
  return 'Waiting for someone to claim it' + (when ? ' · asked ' + when : '') + (row && row.pinged_at ? '' : ' · facilitators not emailed yet');
}
/* the note on hub home when there is news: the newest answered request the student has not opened yet
   (seenIds = the answered rows they have already looked at on this device — help-button.js keeps them),
   then a claim, then what is waiting */
export function homeNoteCopy(rows, seenIds) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const a = (rows || []).filter(r => r.status === 'answered' && !seen.has(r.id)).sort((x, y) => Date.parse(y.updated_at || 0) - Date.parse(x.updated_at || 0))[0];
  if (a) return (a.claimed_name || 'A facilitator') + ' answered your question.';
  const c = (rows || []).find(r => r.status === 'claimed');
  if (c) return (c.claimed_name || 'A facilitator') + ' is on your question.';
  const o = (rows || []).filter(r => r.status === 'open').length;
  if (o) return o === 1 ? 'Your request is in — a facilitator will email you back.' : o + ' requests are in — a facilitator will email you back.';
  return '';
}
/* newest first */
export function sortHelp(rows) { return (rows || []).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)); }
/* the coordinator's three lists; closed ones are counted, not listed */
export function queueBuckets(rows) {
  const s = sortHelp(rows);
  return { open: s.filter(r => r.status === 'open'), claimed: s.filter(r => r.status === 'claimed'), answered: s.filter(r => r.status === 'answered'), closed: s.filter(r => r.status === 'closed').length };
}
/* the count on the coordinator's heading: the ones that still need a person */
export const queueCount = (rows) => (rows || []).filter(r => r.status === 'open' || r.status === 'claimed').length;
/* the link to a quick room with the student's team (feature 3), or null when they have no team */
export const teamRoomPath = (teamId) => teamId ? '/opil/hub/team/room/?t=' + encodeURIComponent(teamId) : null;

/* ---- the calls (never throw for the caller: every failure is a sentence) ---- */
export const NOT_REGISTERED_COPY = 'You are signed in but not registered for the Lab yet — email taylormademd@gmail.com and we will get you in.';
export const SEND_FAILED_COPY = 'Could not send that right now. Check your connection and try again.';
/* the database said no (42501 = the insert policy refused it): the person is not on the Lab, not offline */
export function sendErrorCopy(error) {
  const code = String((error && error.code) || '');
  const msg = String((error && error.message) || '').toLowerCase();
  if (code === '42501' || /row-level security|policy/.test(msg)) return NOT_REGISTERED_COPY;
  return SEND_FAILED_COPY;
}
export async function sendHelp(sb, { track, text, roomKey }) {
  const t = cleanHelpText(text);
  if (!TRACK_WORD[track]) return { error: 'Pick which track this is about first.' };
  if (!t) return { error: 'Write a sentence or two about what you need.' };
  try {
    const { data, error } = await sb.from('ea_class_help').insert({ track, text: t, room_key: roomKey || 'opil:hub' }).select('*').single();
    if (error) { console.warn('[help] insert', error); return { error: sendErrorCopy(error) }; }
    return { row: data };
  } catch (e) { console.warn('[help] insert', e); return { error: sendErrorCopy(e) }; }
}
/* the ping: emails go out from the server; the row is already saved, so a failed ping is said softly */
export async function pingHelp(sb, cfg, body) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { ok: false, why: 'sign_in' };
    const base = (cfg && cfg.FUNCTIONS_BASE) || '';
    const r = await fetch(base + HELP_FUNCTION, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.warn('[help] ping', r.status, d); return { ok: false, why: d.error || 'failed' }; }
    return Object.assign({ ok: true }, d);
  } catch (e) { console.warn('[help] ping', e); return { ok: false, why: 'unreachable' }; }
}
/* what to say after Send: the row is in either way */
export function sentCopy(ping) {
  if (ping && ping.ok && ping.emailed) return 'Sent. The facilitators have your message — you will get an email back.';
  if (ping && ping.ok && ping.already) return 'Already sent — the facilitators have it.';
  return 'Saved. The program team sees it on their page; the email did not go out, so it may take a little longer.';
}

/* ---- the sheet everyone shares (hub and room); `dark` picks the room's classes ---- */
export function injectCss(href) {
  try {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-rtk-help]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.rtkHelp = '1'; document.head.appendChild(l);
  } catch (e) {}
}
export const cssHref = () => '/css/rtk-help.css' + new URL(import.meta.url).search;

export function formHTML(esc, { dark } = {}) {
  const p = dark ? 'r2-help' : 'hh';
  return `<form class="${p}-form" novalidate>
    <div class="${p}-lbl">What is it about?</div>
    <div class="${p}-tracks" role="radiogroup" aria-label="Which track">${TRACKS.map((t) => `<label class="${p}-track"><input type="radio" name="track" value="${t.key}"><span><b>${esc(t.label)}</b><small>${esc(t.hint)}</small></span></label>`).join('')}</div>
    <label class="${p}-lbl" for="${p}-text">What do you need?</label>
    <textarea id="${p}-text" class="${p}-text" name="text" rows="4" maxlength="${MAX_TEXT}" placeholder="A sentence or two is plenty. Say what you tried, if you tried something."></textarea>
    <div class="${p}-row"><button type="submit" class="${p}-send">Send</button><span class="${p}-msg" role="status"></span></div>
  </form>`;
}
export function requestHTML(esc, r, { dark } = {}) {
  const p = dark ? 'r2-help' : 'hh';
  return `<div class="${p}-req" data-id="${esc(r.id)}">
    <div class="${p}-req-head"><span class="${p}-pill">${esc(trackWord(r.track))}</span><span class="${p}-when">${esc(ago(r.created_at))}</span></div>
    <p class="${p}-q">${esc(r.text)}</p>
    ${r.answer ? `<div class="${p}-a"><b>${esc(r.claimed_name || 'A facilitator')}:</b> ${esc(r.answer)}</div>` : ''}
    <div class="${p}-st">${esc(helpStatusCopy(r))}</div>
  </div>`;
}
/* wires a form: on submit → sendHelp → pingHelp → onSent(row, ping). Returns the form. */
export function wireForm(form, { sb, cfg, roomKey, onSent, defaultTrack }) {
  const msg = form.querySelector('.hh-msg, .r2-help-msg'), send = form.querySelector('.hh-send, .r2-help-send');
  if (defaultTrack) { const r = form.querySelector(`input[name="track"][value="${defaultTrack}"]`); if (r) r.checked = true; }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const track = (form.querySelector('input[name="track"]:checked') || {}).value;
    const text = form.querySelector('textarea[name="text"]').value;
    msg.textContent = ''; send.disabled = true; send.textContent = 'Sending…';
    const res = await sendHelp(sb, { track, text, roomKey });
    if (res.error) { msg.textContent = res.error; send.disabled = false; send.textContent = 'Send'; return; }
    const ping = await pingHelp(sb, cfg, { id: res.row.id });
    form.querySelector('textarea[name="text"]').value = '';
    send.disabled = false; send.textContent = 'Send';
    msg.textContent = sentCopy(ping);
    if (onSent) { try { onSent(res.row, ping); } catch (e) {} }
  });
  return form;
}

/* where a request from a class room is filed: an OPIL session under its own key, anything else (a team's quick
   room) under the hub — only OPIL keys may carry help (0047), and the facilitator queue is one queue */
export const helpKeyFor = (roomKey) => (/^opil:/.test(String(roomKey || '')) ? String(roomKey) : 'opil:hub');

/* ---- the class plugin: an OPIL student's "Help later" in the bar ---- */
export function create(ctx) {
  let btn = null, rows = [], chan = null;
  const toasted = new Set();   /* answered rows already announced: the page's save and the function's "emailed" mark are two events for one answer */
  const cfg = () => (typeof window !== 'undefined' && window.BM_CONFIG) || {};
  async function load() {
    try { const { data } = await ctx.sb.from('ea_class_help').select('*').eq('user_id', ctx.uid).order('created_at', { ascending: false }).limit(20); rows = data || []; } catch (e) { rows = []; }
    rows.forEach(r => { if (r.status === 'answered') toasted.add(r.id); });   /* already answered when we looked = not news */
  }
  function sheet() {
    const node = ctx.el(`<div class="r2-help">
      <p class="r2-help-intro">For the thing that can wait until after class. A facilitator emails you back, and the answer shows up on your hub home too. For a question right now, use Ask a question.</p>
      <div class="r2-help-formwrap"></div>
      <div class="r2-help-mine"></div>
    </div>`);
    const wrap = node.querySelector('.r2-help-formwrap');
    wrap.innerHTML = formHTML(ctx.esc, { dark: true });
    const sessionTrack = ctx.session ? (ctx.session.kind === 'hpc' ? 'hpc' : trackFor(ctx.session.title)) : null;
    wireForm(wrap.querySelector('form'), { sb: ctx.sb, cfg: cfg(), roomKey: helpKeyFor(ctx.roomKey), defaultTrack: sessionTrack || 'business', onSent: (row, ping) => { rows.unshift(row); paintMine(node); ctx.toast(sentCopy(ping), 6000); } });
    paintMine(node);
    return node;
  }
  function paintMine(node) {
    const m = node.querySelector('.r2-help-mine'); if (!m) return;
    m.innerHTML = rows.length ? '<div class="r2-help-lbl">Your requests</div>' + rows.map(r => requestHTML(ctx.esc, r, { dark: true })).join('') : '';
  }
  return {
    start() {
      try {
        if (ctx.isRoom || ctx.host) return;   /* an OPIL student's feature: rooms and hosts have no facilitator queue */
        injectCss(cssHref());
        btn = ctx.bar.addButton('<button type="button" class="r2-btn r2-help-btn">Help later</button>');
        btn.addEventListener('click', async () => { await load(); ctx.openSheet('Need help with something?', sheet()); });
        try { chan = ctx.sb.channel('help-' + ctx.uid).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_class_help', filter: 'user_id=eq.' + ctx.uid }, (p) => { const r = p && p.new; if (r && r.status === 'answered' && !toasted.has(r.id)) { toasted.add(r.id); ctx.toast((r.claimed_name || 'A facilitator') + ' answered your question — it is on your hub home.', 8000); } load(); }).subscribe(); } catch (e) { chan = null; }
      } catch (e) { console.warn('[help] start', e); }
    },
    stop() { try { if (chan) ctx.sb.removeChannel(chan); } catch (e) {} chan = null; if (btn) { try { btn.remove(); } catch (e) {} } btn = null; },
  };
}
