/** Student success: early alerts and advisor caseloads.
 *  Staff and admins work the caseload (names, signals, next steps). Leadership sees the
 *  pattern only, never a name. Students see their own success team, never a flag.
 *  Every student here is a fictional SAMPLE; changes are kept in this browser only. */

const STORE_KEY = 'ht-hub-success-demo-v1';
const DAY = 86400000;
const CHAR_LIMIT = 600;

const REASONS = { A: 'Missed two or more assignments', S: 'No Hub sign-in in 10 days', G: 'Grade below C at midterm', C: 'Missed three classes' };
const REASON_ORDER = ['A', 'S', 'G', 'C'];
const YEARS = { 1: 'First-year', 2: 'Sophomore', 3: 'Junior', 4: 'Senior' };
const OWNERS = { M: 'Morgan T.', E: 'Dr. Ellis P.', D: 'Dana K.' };
/* Sample sections outside the interactive demo roster, so a flag never points at a class whose
   real (demo) roster could not hold that student. */
const SECTIONS = ['First-Year Seminar · Section 4', 'Financial Wellness · Sophomore Cohort', 'Intro to Data · Business Majors', 'Intro to Biology · Section 2', 'College Writing I · Section 7'];
const OFFICES = [
  ['Tutoring & Writing Center', 'Free help with any class, drop-in or by appointment.'],
  ['Financial Aid', 'Questions about aid, bills, work-study, or emergency funds.'],
  ['Counseling', 'Private, free support when things feel heavy.'],
  ['Career Services', 'Jobs, internships, resumes, and a plan after HT.'],
  ['Student Life', 'Housing, clubs, and finding your people on the Hill.']
];
const RESOLVE_REASONS = ['Back on track', 'Withdrew', 'Other'];
const STATUS = {
  new: { label: 'Needs first touch', icon: 'bell' },
  contacted: { label: 'Contacted', icon: 'chat' },
  resolved: { label: 'Resolved', icon: 'check' }
};
const STATUS_FILTERS = [['new', 'Needs first touch'], ['contacted', 'Contacted'], ['resolved', 'Resolved'], ['all', 'All']];

/* Sample roster: fictional names. 38 flagged students.
   [name, year, major, reason, owner, section, days since flagged, status n|c|r, days to first touch, secondary signal] */
const ROWS = [
  ['Aaliyah M.', 1, 'Biology', 'A', 'M', 0, 2, 'n', 0, ''],
  ['DeShawn R.', 1, 'Business Administration', 'S', 'M', 0, 6, 'n', 0, ''],
  ['Maria G.', 1, 'Psychology', 'A', 'M', 0, 3, 'c', 1, 'S'],
  ['Jalen T.', 1, 'Kinesiology', 'G', 'M', 0, 9, 'r', 2, ''],
  ['Naomi B.', 1, 'Mass Communication', 'A', 'M', 4, 1, 'n', 0, ''],
  ['Marcus W.', 1, 'Computer Science', 'S', 'M', 2, 4, 'c', 1, ''],
  ['Destiny H.', 1, 'Criminal Justice', 'A', 'M', 0, 11, 'r', 1, 'C'],
  ['Andre L.', 1, 'Accounting', 'C', 'M', 2, 2, 'n', 0, ''],
  ['Nia C.', 1, 'Education', 'A', 'M', 0, 5, 'c', 2, ''],
  ['Isaiah P.', 1, 'Music', 'S', 'M', 4, 8, 'r', 3, ''],
  ['Keisha D.', 1, 'Social Work', 'G', 'M', 0, 1, 'n', 0, 'A'],
  ['Carlos V.', 1, 'Computer Science', 'A', 'M', 2, 7, 'c', 1, ''],
  ['Brianna J.', 1, 'Biology', 'S', 'M', 0, 0, 'n', 0, ''],
  ['Tyrell S.', 1, 'Business Administration', 'A', 'M', 0, 10, 'r', 2, ''],
  ['Ximena R.', 1, 'Psychology', 'S', 'M', 0, 3, 'n', 0, ''],
  ['Malik A.', 1, 'Kinesiology', 'A', 'M', 0, 6, 'c', 3, ''],
  ['Jasmine O.', 1, 'English', 'G', 'M', 4, 12, 'r', 1, ''],
  ['Darius K.', 2, 'Business Administration', 'A', 'D', 1, 4, 'n', 0, ''],
  ['Amara N.', 2, 'Chemistry', 'S', 'D', 1, 7, 'c', 2, ''],
  ['Elijah F.', 2, 'Computer Science', 'A', 'M', 2, 9, 'r', 1, ''],
  ['Sofia M.', 2, 'Psychology', 'G', 'D', 1, 2, 'n', 0, 'S'],
  ['Trevon B.', 2, 'Kinesiology', 'A', 'D', 1, 5, 'c', 1, ''],
  ['Kiara E.', 2, 'Mass Communication', 'S', 'M', 4, 1, 'n', 0, ''],
  ['Omari H.', 2, 'Accounting', 'C', 'D', 1, 8, 'r', 2, ''],
  ['Zoe L.', 2, 'Biology', 'A', 'M', 1, 3, 'c', 1, ''],
  ['Xavier G.', 2, 'Criminal Justice', 'S', 'M', 2, 5, 'n', 0, ''],
  ['Tiana W.', 3, 'Political Science', 'A', 'E', 3, 2, 'n', 0, ''],
  ['Luis A.', 3, 'Computer Science', 'G', 'E', 2, 10, 'r', 1, ''],
  ['Ebony S.', 3, 'Education', 'S', 'E', 3, 6, 'c', 2, ''],
  ['Micah D.', 3, 'Business Administration', 'A', 'M', 2, 4, 'n', 0, 'C'],
  ['Priya S.', 3, 'Biology', 'C', 'E', 3, 9, 'r', 3, ''],
  ['Devon C.', 3, 'Music', 'A', 'M', 4, 3, 'c', 1, ''],
  ['Aisha K.', 4, 'Psychology', 'S', 'E', 3, 1, 'n', 0, ''],
  ['Mateo R.', 4, 'Kinesiology', 'A', 'M', 3, 7, 'c', 1, ''],
  ['Janae P.', 4, 'Mass Communication', 'G', 'E', 3, 11, 'r', 2, ''],
  ['Quincy T.', 4, 'Accounting', 'S', 'M', 2, 5, 'c', 4, ''],
  ['Leah O.', 4, 'English', 'G', 'E', 3, 8, 'c', 2, ''],
  ['Rashad J.', 4, 'Computer Science', 'C', 'D', 2, 6, 'r', 1, '']
];
const LOW_GRADES = ['D', 'F', 'D+', 'C-'];
const OK_GRADES = ['B-', 'C+', 'B', 'C'];

/* "No Hub sign-in" keeps its capital H: only the first letter drops to lowercase. */
function lowerFirst(text) { return text.charAt(0).toLowerCase() + text.slice(1); }
/* Ends a sentence after a name without doubling the period ("DeShawn R." not "DeShawn R.."). */
function endSentence(text) { return /[.!?]$/.test(text) ? text : `${text}.`; }
function buildBaseline() {
  const now = Date.now();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const clamp = (t) => Math.min(t, now - 20 * 60000);
  return ROWS.map(([name, year, major, reason, ownerKey, sectionIndex, days, code, delay, second], i) => {
    const n = i + 1, id = `s${String(n).padStart(2, '0')}`;
    const owner = OWNERS[ownerKey], section = SECTIONS[sectionIndex];
    const flaggedAt = clamp(today.getTime() - days * DAY + (8 * 60 + (n * 37) % 240) * 60000);
    /* A "no sign-in" flag fires the day the gap reaches 10 days, so the gap at the flag is
       exactly 10 (11 when it is only a second signal). The page adds the days since the flag. */
    const signals = {
      signIn: reason === 'S' ? 10 : second === 'S' ? 11 : (n % 4) + 1,
      missing: reason === 'A' ? 2 + (n % 3) : second === 'A' ? 2 : n % 5 === 0 ? 1 : 0,
      grade: reason === 'G' ? LOW_GRADES[n % 4] : OK_GRADES[n % 4],
      classes: reason === 'C' ? 3 + (n % 2) : second === 'C' ? 3 : n % 3 === 0 ? 1 : 0
    };
    const log = [{ at: new Date(flaggedAt).toISOString(), kind: 'flag', text: `Flagged by the Hub from ${section}: ${lowerFirst(REASONS[reason])}.` }];
    let status = 'new', firstTouch = null, resolvedReason = null;
    if (code !== 'n') {
      status = 'contacted'; firstTouch = delay;
      const touchAt = clamp(flaggedAt + delay * DAY + 2 * 3600000);
      const touch = n % 3 === 0 ? `Referred to Tutoring & Writing Center by ${owner}` : n % 3 === 1 ? `Nudge sent by ${owner}` : `Met with ${owner} during office hours.`;
      log.push({ at: new Date(touchAt).toISOString(), kind: n % 3 === 0 ? 'refer' : n % 3 === 1 ? 'nudge' : 'note', text: touch });
      if (code === 'r') {
        status = 'resolved'; resolvedReason = n === 24 ? 'Other' : 'Back on track';
        const doneAt = clamp(touchAt + Math.ceil((days - delay) / 2) * DAY);
        if (n === 24) log.push({ at: new Date(doneAt - 3600000).toISOString(), kind: 'note', text: `Note from ${owner}`, detail: 'Moved to a lighter course load for the rest of the term.' });
        log.push({ at: new Date(doneAt).toISOString(), kind: 'resolve', text: `Marked resolved (${resolvedReason}) by ${owner}` });
      }
    }
    return { id, name, year, major, reason, second, owner, section, flaggedAt, days, signals, status, firstTouch, resolvedReason, log };
  });
}
const BASELINE = buildBaseline();
const BY_ID = new Map(BASELINE.map((s) => [s.id, s]));

/* ---------- sample persistence ---------- */
let store = null;
function loadStore() {
  if (store) return store;
  store = { students: {} };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data.students === 'object') {
      for (const [id, o] of Object.entries(data.students)) {
        if (!BY_ID.has(id) || !o || !STATUS[o.status]) continue;
        store.students[id] = {
          status: o.status,
          firstTouch: typeof o.firstTouch === 'number' ? o.firstTouch : null,
          resolvedReason: RESOLVE_REASONS.includes(o.resolvedReason) ? o.resolvedReason : null,
          log: Array.isArray(o.log) ? o.log.filter((e) => e && typeof e.text === 'string' && !Number.isNaN(Date.parse(e.at))).map((e) => ({ at: e.at, kind: String(e.kind || 'note'), text: e.text, ...(typeof e.detail === 'string' && e.detail ? { detail: e.detail } : {}) })).slice(-60) : []
        };
      }
    }
  } catch { /* storage unavailable: the page still works for this visit */ }
  return store;
}
function saveStore() {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* keep going in memory */ }
}
function student(id) {
  const base = BY_ID.get(id);
  if (!base) return null;
  const o = loadStore().students[id];
  return o ? { ...base, status: o.status, firstTouch: o.firstTouch, resolvedReason: o.resolvedReason, log: [...base.log, ...o.log] } : base;
}
function everyone() { return BASELINE.map((s) => student(s.id)); }
/* Staff and admins see only the flags they own (the Security page promise: advisors see their
   caseload only). The owner is the signed-in person's display name, set on every render. */
let caseOwner = null;
function setOwner(ctx) { caseOwner = ctx?.state?.member?.display_name || null; return caseOwner; }
function mine() { return everyone().filter((s) => s.owner === caseOwner); }
function isMine(id) { const base = BY_ID.get(id); return !!base && base.owner === caseOwner; }
function override(id) {
  const s = student(id), all = loadStore().students;
  if (!all[id]) all[id] = { status: s.status, firstTouch: s.firstTouch, resolvedReason: s.resolvedReason, log: [] };
  return all[id];
}

/* ---------- derived numbers ---------- */
function median(list) {
  if (!list.length) return null;
  const v = [...list].sort((a, b) => a - b), mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
function totals(list = everyone()) {
  const waiting = list.filter((s) => s.status === 'new');
  const contacted = list.filter((s) => s.status !== 'new');
  const resolved = list.filter((s) => s.status === 'resolved');
  const oldest = waiting.reduce((m, s) => Math.max(m, daysSince(s.flaggedAt)), 0);
  return { flagged: list.length, waiting: waiting.length, contacted: contacted.length, open: contacted.length - resolved.length, resolved: resolved.length, median: median(contacted.map((s) => s.firstTouch).filter((n) => n != null)), oldest };
}
/** The same numbers the Student success page shows, read from the same saved sample.
 *  Pass an owner's name for just their flags (an unknown or empty name gets none). Call it with
 *  no argument for campus totals, which only the leadership pattern view shows. */
export function caseloadSummary(...args) {
  const ownerName = args[0];
  const list = args.length ? everyone().filter((s) => !!ownerName && s.owner === ownerName) : everyone();
  const t = totals(list);
  return { flagged: t.flagged, waiting: t.waiting, open: t.open, resolved: t.resolved, median: t.median, oldest: t.oldest };
}
function daysSince(t) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const then = new Date(t); then.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((start - then) / DAY));
}
const ago = (d) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);
const oneDecimal = (n) => (n == null ? '–' : String(Math.round(n * 10) / 10));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const firstName = (name) => String(name).split(' ')[0];
const course = (section) => String(section).split(' · ')[0];

function triggered(s) {
  const g = s.signals;
  return { S: g.signIn >= 10, A: g.missing >= 2, G: LOW_GRADES.includes(g.grade), C: g.classes >= 3 };
}
function nudgeTemplate(s, actor) {
  const f = firstName(s.name), me = firstName(actor), c = course(s.section);
  return {
    A: `Hi ${f}, I noticed a couple of assignments in ${c} haven't come in yet. That happens, and it is easy to catch up if we start now. Can you stop by office hours this week, or reply with a time that works? I'm here to help. - ${me}`,
    S: `Hi ${f}, we haven't seen you in the Hub for a little while, and I wanted to check in. Is everything okay? If something is getting in the way, reply here and we'll figure it out together. - ${me}`,
    G: `Hi ${f}, your midterm grade in ${c} is lower than I know you want, and there is still plenty of time to turn it around. Let's make a plan. The Tutoring & Writing Center has open hours, and I can meet with you this week. - ${me}`,
    C: `Hi ${f}, I've missed seeing you in ${c} the last few classes. I hope you're doing okay. Reply when you can and let me know how I can help you get back on track. - ${me}`
  }[s.reason];
}

/* ---------- module UI state (survives app re-renders) ---------- */
let statusFilter = 'new', reasonFilter = 'all', yearFilter = 'all', query = '', selectedId = null;
let composer = null; // { type: 'nudge'|'refer'|'note'|'resolve', id }
const nudgeDrafts = new Map();
let liveCtx = null;

function matches(s) {
  if (statusFilter !== 'all' && s.status !== statusFilter) return false;
  if (reasonFilter !== 'all' && s.reason !== reasonFilter) return false;
  if (yearFilter !== 'all' && String(s.year) !== yearFilter) return false;
  const q = query.trim().toLowerCase();
  return !q || s.name.toLowerCase().includes(q) || s.major.toLowerCase().includes(q);
}
const STATUS_RANK = { new: 0, contacted: 1, resolved: 2 };
function filtered() {
  return mine().filter(matches).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.flaggedAt - b.flaggedAt || a.name.localeCompare(b.name));
}

/* ---------- shared pieces ---------- */
function statusLabel(ctx, status) {
  const st = STATUS[status];
  return `<span class="success-status" data-status="${status}">${ctx.icon(st.icon)}<span>${st.label}</span></span>`;
}
function kpi(label, value, detail) {
  return `<article class="lead-kpi success-kpi"><span class="lead-kpi-label">${label}</span><strong>${value}</strong>${detail ? `<span class="lead-kpi-detail">${detail}</span>` : ''}</article>`;
}
function barList(rows, max) {
  const top = max || Math.max(1, ...rows.map((r) => r[1]));
  return `<ul class="lead-bars">${rows.map(([label, value]) => `<li><span class="lead-bar-label">${label}</span><span class="lead-bar-track"><span class="lead-bar-fill" style="width:${Math.max(2, (value / top) * 100).toFixed(1)}%"></span></span><span class="lead-bar-value">${value}</span></li>`).join('')}</ul>`;
}

/* ---------- staff and admin: the caseload ---------- */
/* Three counts that add up to every flag, then the speed measure. */
function summaryStrip(t, label = 'Caseload summary') {
  return `<section class="lead-kpis success-kpis" aria-label="${label}">
    ${kpi('Waiting on first touch', t.waiting, t.waiting ? `Of ${t.flagged} flagged · oldest ${ago(t.oldest)}` : `Of ${t.flagged} flagged · everyone reached`)}
    ${kpi('Contacted, still open', t.open, `Of ${t.flagged} flagged · reached, not done yet`)}
    ${kpi('Resolved', t.resolved, `Of ${t.flagged} flagged · ${pct(t.resolved, t.flagged)}%`)}
    ${kpi('Median days to first touch', oneDecimal(t.median), 'Goal: 2 days or less')}
  </section>`;
}
function filterBar(ctx, list) {
  const { esc, icon } = ctx, all = mine();
  const count = (k) => (k === 'all' ? all.length : all.filter((s) => s.status === k).length);
  return `<div class="success-filters" role="search" aria-label="Filter students">
    <div class="success-filter-group" role="group" aria-labelledby="successStatusLabel"><span class="success-filter-label" id="successStatusLabel">Status</span><div class="success-chips">${STATUS_FILTERS.map(([k, l]) => `<button type="button" class="lead-chip success-chip" data-success-status="${k}" data-sf="status-${k}" aria-pressed="${statusFilter === k}">${l} <span class="success-chip-count">${count(k)}</span></button>`).join('')}</div></div>
    <div class="success-filter-row">
      <div class="success-filter-field"><label class="success-filter-label" for="successReason">Reason</label><select id="successReason" data-success-reason data-sf="reason"><option value="all">All reasons</option>${REASON_ORDER.map((k) => `<option value="${k}"${reasonFilter === k ? ' selected' : ''}>${REASONS[k]}</option>`).join('')}</select></div>
      <div class="success-filter-field"><label class="success-filter-label" for="successYear">Class year</label><select id="successYear" data-success-year data-sf="year"><option value="all">All years</option>${Object.entries(YEARS).map(([k, l]) => `<option value="${k}"${yearFilter === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="success-filter-field success-search"><label class="success-filter-label" for="successSearch">Search</label><span class="success-search-box">${icon('search')}<input id="successSearch" type="search" data-success-search data-sf="search" value="${esc(query)}" placeholder="Name or major" autocomplete="off"></span></div>
    </div>
  </div>`;
}
function listRow(ctx, s) {
  const { esc } = ctx, d = daysSince(s.flaggedAt), current = s.id === selectedId;
  return `<li><button type="button" class="success-row" data-success-open="${s.id}" data-sf="row-${s.id}"${current ? ' aria-current="true"' : ''}>
    <span class="success-row-top"><strong>${esc(s.name)}</strong>${statusLabel(ctx, s.status)}</span>
    <span class="success-row-meta">${esc(YEARS[s.year])} · ${esc(s.major)}</span>
    <span class="success-row-foot"><span class="success-reason">${esc(REASONS[s.reason])}</span><span class="success-row-when">Flagged ${ago(d)} · ${esc(s.owner)}</span></span>
  </button></li>`;
}
function emptyState(ctx) {
  const noFilters = reasonFilter === 'all' && yearFilter === 'all' && !query.trim();
  if (noFilters && statusFilter === 'new') {
    return `<div class="campus-empty success-empty">${ctx.icon('check')}<h3>Every flagged student has had a first touch.</h3><p>Nice work. New flags will show up here as soon as the Hub notices them.</p><button type="button" class="campus-button campus-button-secondary campus-button-small" data-success-status="all" data-sf="empty-all">See all students</button></div>`;
  }
  return `<div class="campus-empty success-empty">${ctx.icon('search')}<h3>No students match these filters.</h3><p>Try a different status, reason, or class year, or clear the search.</p><button type="button" class="campus-button campus-button-secondary campus-button-small" data-success-clear data-sf="empty-clear">Clear filters</button></div>`;
}
/* Signals as of today. While a student is still open, a sign-in gap keeps growing by one each
   day after the flag. Once resolved, the card shows what the Hub saw on the day of the flag. */
function signalsNow(s) {
  const g = { ...s.signals };
  if (s.status !== 'resolved' && (s.reason === 'S' || s.second === 'S')) g.signIn += daysSince(s.flaggedAt);
  return g;
}
function signalRows(ctx, s) {
  const g = signalsNow(s), hit = triggered({ ...s, signals: g });
  const rows = [
    ['S', 'Days since Hub sign-in', String(g.signIn)],
    ['A', 'Missing assignments', String(g.missing)],
    ['G', 'Midterm grade', g.grade],
    ['C', 'Classes missed', String(g.classes)]
  ];
  return `<ul class="success-signals">${rows.map(([k, label, value]) => {
    const tag = k === s.reason ? 'Why flagged' : hit[k] ? 'Also noticed' : '';
    return `<li${tag ? ' class="is-hit"' : ''}><span class="success-signal-label">${label}</span><strong>${ctx.esc(value)}</strong>${tag ? `<span class="success-signal-tag">${ctx.icon(k === s.reason ? 'bell' : 'clock')}${tag}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}
function composerForm(ctx, s, actor) {
  if (!composer || composer.id !== s.id) return '';
  const { esc } = ctx, f = firstName(s.name);
  const actions = (label) => `<div class="campus-form-actions"><button type="submit" class="campus-button" data-sf="submit-${composer.type}">${label}</button><button type="button" class="campus-button campus-button-secondary" data-success-cancel data-sf="cancel">Cancel</button></div>`;
  if (composer.type === 'nudge') {
    const text = nudgeDrafts.get(s.id) ?? nudgeTemplate(s, actor);
    return `<form class="success-composer" id="successComposer" data-success-form="nudge" data-student="${s.id}" aria-label="Send a nudge to ${esc(s.name)}">
      <div class="campus-field"><label for="successNudgeText">Message to ${esc(f)}</label><textarea id="successNudgeText" name="message" rows="6" maxlength="${CHAR_LIMIT}" required aria-describedby="successNudgeHelp successNudgeCount" data-success-nudge-text data-sf="nudge-text">${esc(text)}</textarea>
      <span class="success-field-foot"><small id="successNudgeHelp">Kind and specific works best. ${esc(f)} can reply right in the Hub.</small><small id="successNudgeCount" data-success-count>${text.length} / ${CHAR_LIMIT}</small></span></div>
      ${actions('Send nudge')}</form>`;
  }
  if (composer.type === 'refer') {
    return `<form class="success-composer" id="successComposer" data-success-form="refer" data-student="${s.id}" aria-label="Refer ${esc(s.name)} to an office">
      <div class="campus-field"><label for="successOffice">Office</label><select id="successOffice" name="office" required data-sf="office"><option value="">Choose an office</option>${OFFICES.map(([o]) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select><small>The office gets ${esc(f)}'s name and your note. They reach out within one business day.</small></div>
      <div class="campus-field"><label for="successReferNote">Note for the office (optional)</label><textarea id="successReferNote" name="note" rows="3" maxlength="400" data-sf="refer-note"></textarea></div>
      ${actions('Send referral')}</form>`;
  }
  if (composer.type === 'note') {
    return `<form class="success-composer" id="successComposer" data-success-form="note" data-student="${s.id}" aria-label="Add a note about ${esc(s.name)}">
      <div class="campus-field"><label for="successNoteText">Note</label><textarea id="successNoteText" name="note" rows="4" maxlength="500" required data-sf="note-text"></textarea><small>Only advisors and ${esc(s.owner === actor ? 'you' : s.owner)} can read notes. ${esc(f)} never sees them.</small></div>
      ${actions('Save note')}</form>`;
  }
  return `<form class="success-composer" id="successComposer" data-success-form="resolve" data-student="${s.id}" aria-label="Mark ${esc(s.name)} resolved">
    <fieldset class="success-radios"><legend>Why is this resolved?</legend>${RESOLVE_REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${r}"${i === 0 ? ' checked' : ''} data-sf="resolve-${i}"> <span>${r}</span></label>`).join('')}</fieldset>
    <div class="campus-field"><label for="successResolveNote">Anything to add? (optional)</label><textarea id="successResolveNote" name="note" rows="3" maxlength="400" data-sf="resolve-note"></textarea></div>
    ${actions('Mark resolved')}</form>`;
}
function detailPanel(ctx, s, actor) {
  const { esc, icon, formatDate, formatTime } = ctx;
  if (!s) {
    return `<section class="campus-panel success-detail success-detail-empty" aria-label="Student details">${icon('users')}<h2>Choose a student</h2><p class="campus-muted">Pick a name from the list to see what the Hub noticed and what to do next.</p></section>`;
  }
  const d = daysSince(s.flaggedAt), open = composer && composer.id === s.id ? composer.type : null;
  const btn = (type, label, ic, primary) => `<button type="button" class="campus-button ${primary ? '' : 'campus-button-secondary '}campus-button-small" data-success-action="${type}" data-sf="action-${type}" aria-expanded="${open === type}" aria-controls="successComposer">${icon(ic)}${label}</button>`;
  const history = [...s.log].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const hidden = !matches(s) ? `<p class="success-moved">${icon('arrow')}<span>${esc(firstName(s.name))} is now in <strong>${STATUS[s.status].label}</strong>, so this name no longer shows in the ${esc(STATUS_FILTERS.find(([k]) => k === statusFilter)[1])} list.</span></p>` : '';
  return `<section class="campus-panel success-detail" aria-labelledby="successDetailName">
    <div class="success-detail-head"><div><p class="campus-eyebrow">Early alert</p><h2 id="successDetailName" tabindex="-1" data-sf="detail-name">${esc(s.name)}</h2><p class="campus-muted">${esc(YEARS[s.year])} · ${esc(s.major)}</p></div>${statusLabel(ctx, s.status)}</div>
    ${hidden}
    <dl class="success-facts">
      <div><dt>Owner</dt><dd>${esc(s.owner)}</dd></div>
      <div><dt>Flagged</dt><dd>${ago(d)} · ${esc(formatDate(new Date(s.flaggedAt).toISOString()))}</dd></div>
      <div><dt>From</dt><dd>${esc(s.section)}</dd></div>
      ${s.status === 'resolved' ? `<div><dt>Resolved</dt><dd>${esc(s.resolvedReason || 'Other')}</dd></div>` : ''}
    </dl>
    <h3 class="success-subhead">${s.status === 'resolved' ? 'What the Hub noticed on the day of the flag' : 'What the Hub notices today'}</h3>
    ${signalRows(ctx, s)}
    <h3 class="success-subhead">Next step</h3>
    <div class="success-actions">
      ${btn('nudge', 'Send a nudge', 'chat', s.status === 'new')}
      ${btn('refer', 'Refer to an office', 'door')}
      ${btn('note', 'Add a note', 'book')}
      ${s.status === 'resolved' ? `<button type="button" class="campus-button campus-button-secondary campus-button-small" data-success-reopen data-sf="action-reopen">${icon('arrow')}Reopen</button>` : btn('resolve', 'Mark resolved', 'check')}
    </div>
    ${composerForm(ctx, s, actor)}
    <h3 class="success-subhead">History</h3>
    <ol class="success-history">${history.map((e) => `<li data-kind="${esc(e.kind)}"><time datetime="${esc(e.at)}">${esc(formatDate(e.at))} · ${esc(formatTime(e.at))}</time><span>${esc(e.text)}</span>${e.detail ? `<span class="success-history-detail">${esc(e.detail)}</span>` : ''}</li>`).join('')}</ol>
  </section>`;
}
function staffBody(ctx) {
  const actor = setOwner(ctx) || 'You';
  const list = filtered(), caseload = mine();
  if (!selectedId || !isMine(selectedId)) selectedId = list[0]?.id || null;
  const current = selectedId ? student(selectedId) : null;
  const label = STATUS_FILTERS.find(([k]) => k === statusFilter)[1];
  return `${summaryStrip(totals(caseload), 'Your caseload')}
    ${filterBar(ctx, list)}
    <div class="success-layout">
      <section class="campus-panel success-list-panel" aria-labelledby="successListTitle">
        <div class="success-list-head"><h2 id="successListTitle">${statusFilter === 'all' ? 'All flagged students' : label}</h2><p class="campus-muted" aria-hidden="true">${list.length} of ${caseload.length} · oldest first</p></div>
        ${list.length ? `<ul class="success-list">${list.map((s) => listRow(ctx, s)).join('')}</ul>` : emptyState(ctx)}
      </section>
      ${detailPanel(ctx, current, actor)}
    </div>
    <div class="success-foot"><p class="campus-muted">Not university records. Nudges, referrals, and notes you add are kept only in this browser.</p><button type="button" class="campus-button campus-button-secondary campus-button-small" data-success-reset data-sf="reset">Reset sample</button></div>`;
}
function liveText() {
  const n = filtered().length, label = STATUS_FILTERS.find(([k]) => k === statusFilter)[1];
  return `Showing ${n} ${n === 1 ? 'student' : 'students'}${statusFilter === 'all' ? '' : `, ${label.toLowerCase()}`}.`;
}
function staffView(ctx) {
  setOwner(ctx);
  return `<div class="success-view" data-success-root data-success-mode="caseload">
    <p class="lead-sample-note">${ctx.icon('users')}<span><strong>Sample caseload with fictional students.</strong> Early alerts come from Hub sign-ins, assignments, midterm grades, and attendance. Each flag has an owner and a clear next step.</span></p>
    <p class="success-scope">${ctx.icon('shield')}<span>You see the students assigned to you. Other advisors see theirs; leadership sees totals only.</span></p>
    <p class="campus-sr-only" aria-live="polite" data-success-live>${liveText()}</p>
    <div data-success-body>${staffBody(ctx)}</div>
  </div>`;
}

/* ---------- leadership: the pattern, never names ---------- */
function leadershipView(ctx) {
  const { esc, href, icon } = ctx, all = everyone(), t = totals(all);
  const byReason = REASON_ORDER.map((k) => [REASONS[k], all.filter((s) => s.reason === k).length]);
  const byYear = Object.entries(YEARS).map(([k, l]) => [l, all.filter((s) => String(s.year) === k).length]);
  const owners = Object.values(OWNERS).map((o) => { const mine = all.filter((s) => s.owner === o); return [o, mine.length, mine.filter((s) => s.status === 'new').length]; });
  const owned = all.filter((s) => s.owner).length;
  return `<div class="success-view" data-success-root data-success-mode="pattern">
    <p class="lead-sample-note">${icon('shield')}<span><strong>Sample pattern with fictional students.</strong> ${t.flagged} early alerts this term, Fall 2026 · week 6. Advisors see the names. You see the pattern, and whether every flag has an owner.</span></p>
    ${summaryStrip(t, 'Early alerts this term')}
    <div class="campus-grid campus-grid-main">
      <div class="campus-stack">
        <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Why students were flagged</p><h2>First signal, by reason</h2></div></div>
          ${barList(byReason)}<p class="campus-muted success-note">Missed work is the most common first sign. It is also the easiest to fix when someone reaches out in the first few days.</p></section>
        <section class="campus-panel"><div class="campus-section-head"><div><p class="campus-eyebrow">Where the need is</p><h2>Flags by class year</h2></div></div>
          ${barList(byYear)}<p class="campus-muted success-note">In this sample, first-year students hold ${byYear[0][1]} of ${t.flagged} flags. The first fall is often when a hand matters most.</p></section>
      </div>
      <aside class="campus-stack">
        <section class="campus-panel success-owners"><p class="campus-eyebrow">Owner coverage</p>
          <p class="success-big">${icon('check')}<span><strong>${owned} of ${t.flagged}</strong> flags have a named owner</span></p>
          <p class="success-big success-big-wait">${icon('clock')}<span><strong>${t.waiting}</strong> ${t.waiting === 1 ? 'is' : 'are'} waiting on a first touch${t.waiting ? `, the oldest from ${ago(t.oldest)}` : ''}</span></p>
          <ul class="success-owner-list" aria-label="Flags by owner">${owners.map(([o, n, w]) => `<li><strong>${esc(o)}</strong><span>${n} flags · ${w} waiting</span></li>`).join('')}</ul></section>
        <section class="campus-panel success-privacy">${icon('shield')}<div><h2>What stays private</h2><p class="campus-muted">Student names, grades, and notes stay with the advisor who owns the flag. This page shows only counts, so you can ask the right question without seeing a single record.</p><a href="${esc(href('insights'))}">Open campus insights <span aria-hidden="true">→</span></a></div></section>
      </aside>
    </div>
    <p class="campus-muted success-footnote">Counts come from the sample caseload above, not university records.</p>
  </div>`;
}

/* ---------- students: their own success team ---------- */
function studentView(ctx) {
  const { esc, href, icon } = ctx;
  const help = [
    ['Tutoring & Writing Center', 'book', 'Free help with any class, drop-in or by appointment.', href('support')],
    ['Financial Aid', 'gift', 'Aid, bills, work-study, and emergency funds.', href('support')],
    ['Counseling', 'shield', 'Private, free support when things feel heavy.', href('support')],
    ['Career Services', 'briefcase', 'Jobs, internships, and your resume.', href('/ht/hub/career/')],
    ['Student Life', 'users', 'Housing, clubs, and finding your people.', href('spaces')]
  ];
  return `<div class="success-view" data-success-root data-success-mode="team">
    <div class="campus-grid campus-grid-main">
      <section class="campus-panel success-team"><p class="campus-eyebrow">Your success team</p><h2 class="success-serif">People in your corner</h2>
        <p class="campus-muted">Everyone here wants you to finish strong. You never need a reason to reach out.</p>
        <div class="success-advisor"><span class="success-avatar" aria-hidden="true">MT</span><div><strong>Morgan T.</strong><span>Your advisor · AI Literacy instructor</span><span>Office hours: Tuesdays and Thursdays, 2 to 4 PM</span></div></div>
        <div class="campus-card-actions"><a class="campus-button" href="${esc(href('support'))}">${icon('calendar')}Book time with Morgan</a><a class="campus-button campus-button-secondary" href="${esc(href('people'))}">${icon('chat')}Send a message</a></div>
        <h3 class="success-subhead">More people who can help</h3>
        <ul class="success-help-list">${help.map(([n, ic, line, link]) => `<li><a href="${esc(link)}">${icon(ic)}<span><strong>${esc(n)}</strong><span>${esc(line)}</span></span></a></li>`).join('')}</ul>
      </section>
      <aside class="campus-stack">
        <section class="campus-panel success-ask">${icon('help')}<h2>Ask for help</h2><p class="campus-muted">Stuck on a class, money, or something else? Tell us early. Asking is what strong students do, and a real person will answer.</p><a class="campus-button" href="${esc(href('support'))}">Ask for help</a></section>
        <section class="campus-panel"><h2>How the Hub looks out for you</h2><p class="campus-muted">If you miss a few assignments or classes, your advisor may send a short note to check in. It is a friendly hello, never a mark against you.</p></section>
      </aside>
    </div>
  </div>`;
}

export function renderSuccess(view, ctx) {
  liveCtx = ctx;
  const r = ctx.state?.member?.role;
  if (r === 'staff' || r === 'admin') return staffView(ctx);
  if (r === 'leadership') return leadershipView(ctx);
  return studentView(ctx);
}

/* ---------- binding ---------- */
function paint(root, focusKey) {
  const body = root.querySelector('[data-success-body]');
  if (!body || !liveCtx) return;
  const active = document.activeElement;
  const key = focusKey || (body.contains(active) ? active?.dataset?.sf : null);
  const caret = active && active.matches?.('input[type=search]') ? active.selectionStart : null;
  body.innerHTML = staffBody(liveCtx);
  const live = root.querySelector('[data-success-live]');
  if (live) live.textContent = liveText();
  if (!key) return;
  const target = body.querySelector(`[data-sf="${key}"]`) || (key.startsWith('row-') ? body.querySelector('[data-success-open]') : null) || body.querySelector('#successDetailName');
  if (target) {
    target.focus({ preventScroll: true });
    if (caret != null && target.setSelectionRange) try { target.setSelectionRange(caret, caret); } catch { /* not a text input */ }
  }
}
function log(id, kind, text, detail) {
  override(id).log.push({ at: new Date().toISOString(), kind, text, ...(detail ? { detail } : {}) });
}
function touch(id) {
  const o = override(id), s = student(id);
  if (o.status === 'new') { o.status = 'contacted'; o.firstTouch = Math.max(0, (Date.now() - s.flaggedAt) / DAY); }
}
function narrow() { return window.matchMedia?.('(max-width: 900px)').matches; }

export function bindSuccess(view, root, ctx) {
  liveCtx = ctx;
  const r = ctx.state?.member?.role;
  if (!['staff', 'admin'].includes(r) || !root.querySelector('[data-success-body]')) return () => {};
  const actor = () => setOwner(ctx) || 'You';
  const closeComposer = (form) => { if (form) ctx.discardDraft?.(form); composer = null; };

  const click = (e) => {
    const t = e.target.closest('button');
    if (!t || !root.contains(t) || !t.closest('[data-success-root]')) return;
    if (t.dataset.successStatus) { statusFilter = t.dataset.successStatus; selectedId = null; closeComposer(root.querySelector('#successComposer')); paint(root, `status-${statusFilter}`); return; }
    if (t.hasAttribute('data-success-clear')) { statusFilter = 'all'; reasonFilter = 'all'; yearFilter = 'all'; query = ''; selectedId = null; paint(root, 'status-all'); return; }
    if (t.dataset.successOpen) {
      if (!isMine(t.dataset.successOpen)) return;
      if (selectedId !== t.dataset.successOpen) closeComposer(root.querySelector('#successComposer'));
      selectedId = t.dataset.successOpen;
      if (narrow()) { paint(root, 'detail-name'); root.querySelector('.success-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      else paint(root, `row-${selectedId}`);
      return;
    }
    if (t.dataset.successAction) {
      const type = t.dataset.successAction;
      const form = root.querySelector('#successComposer');
      if (composer && composer.type === type && composer.id === selectedId) { closeComposer(form); paint(root, `action-${type}`); return; }
      closeComposer(form);
      composer = { type, id: selectedId };
      paint(root, { nudge: 'nudge-text', refer: 'office', note: 'note-text', resolve: 'resolve-0' }[type]);
      return;
    }
    if (t.hasAttribute('data-success-cancel')) { const type = composer?.type; if (type === 'nudge') nudgeDrafts.delete(selectedId); closeComposer(t.closest('form')); paint(root, `action-${type || 'nudge'}`); return; }
    if (t.hasAttribute('data-success-reopen')) {
      if (!isMine(selectedId)) return;
      const s = student(selectedId), o = override(selectedId);
      o.status = o.firstTouch == null ? 'new' : 'contacted'; o.resolvedReason = null;
      log(selectedId, 'reopen', `Reopened by ${actor()}`);
      saveStore(); paint(root, 'action-resolve'); ctx.notify(`${s.name} is open again.`);
      return;
    }
    if (t.hasAttribute('data-success-reset')) {
      store = { students: {} };
      try { window.localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
      nudgeDrafts.clear(); closeComposer(root.querySelector('#successComposer'));
      statusFilter = 'new'; reasonFilter = 'all'; yearFilter = 'all'; query = ''; selectedId = null;
      paint(root, 'reset'); ctx.notify('Sample caseload reset to the start of the week.');
    }
  };

  const submit = (e) => {
    const form = e.target.closest('form[data-success-form]');
    if (!form || !root.contains(form)) return;
    e.preventDefault();
    const id = form.dataset.student, s = isMine(id) ? student(id) : null;
    if (!s) return;
    const data = new FormData(form), type = form.dataset.successForm, me = actor();
    const text = (name) => String(data.get(name) || '').trim();
    if (type === 'nudge') {
      const message = text('message').slice(0, CHAR_LIMIT);
      if (!message) { ctx.notify('Write a short message before sending.', 'error'); form.querySelector('textarea')?.focus(); return; }
      touch(id); log(id, 'nudge', `Nudge sent by ${me}`, `"${message.length > 160 ? message.slice(0, 157) + '...' : message}"`);
      nudgeDrafts.delete(id); closeComposer(form); saveStore(); paint(root, 'action-nudge');
      ctx.notify(`${endSentence(`Nudge sent to ${s.name}`)} It will appear in their Hub messages.`);
    } else if (type === 'refer') {
      const office = text('office');
      if (!OFFICES.some(([o]) => o === office)) { ctx.notify('Choose an office for the referral.', 'error'); form.querySelector('select')?.focus(); return; }
      const note = text('note').slice(0, 400);
      touch(id); log(id, 'refer', `Referred to ${office} by ${me}`, note);
      closeComposer(form); saveStore(); paint(root, 'action-refer');
      ctx.notify(endSentence(`Referral sent to ${office} for ${s.name}`));
    } else if (type === 'note') {
      const note = text('note').slice(0, 500);
      if (!note) { ctx.notify('Write a note before saving.', 'error'); form.querySelector('textarea')?.focus(); return; }
      override(id); log(id, 'note', `Note from ${me}`, note);
      closeComposer(form); saveStore(); paint(root, 'action-note');
      ctx.notify(`Note added to ${s.name}'s history.`);
    } else if (type === 'resolve') {
      const reason = RESOLVE_REASONS.includes(text('reason')) ? text('reason') : 'Other';
      const note = text('note').slice(0, 400);
      touch(id); const o = override(id); o.status = 'resolved'; o.resolvedReason = reason;
      log(id, 'resolve', `Marked resolved (${reason}) by ${me}`, note);
      closeComposer(form); saveStore(); paint(root, 'action-reopen');
      ctx.notify(`${s.name} marked resolved.`);
    }
  };

  const input = (e) => {
    const el = e.target;
    if (!root.contains(el)) return;
    if (el.matches('[data-success-search]')) { query = el.value; selectedId = null; paint(root, 'search'); return; }
    if (el.matches('[data-success-nudge-text]')) {
      nudgeDrafts.set(composer?.id, el.value);
      const count = root.querySelector('[data-success-count]');
      if (count) count.textContent = `${el.value.length} / ${CHAR_LIMIT}`;
    }
  };
  const change = (e) => {
    const el = e.target;
    if (!root.contains(el)) return;
    if (el.matches('[data-success-reason]')) { reasonFilter = el.value; selectedId = null; paint(root, 'reason'); }
    else if (el.matches('[data-success-year]')) { yearFilter = el.value; selectedId = null; paint(root, 'year'); }
  };
  const key = (e) => {
    if (e.key !== 'Escape' || !composer) return;
    const form = root.querySelector('#successComposer');
    if (!form || !form.contains(e.target)) return;
    const type = composer.type; closeComposer(form); paint(root, `action-${type}`);
  };

  root.addEventListener('click', click);
  root.addEventListener('submit', submit);
  root.addEventListener('input', input);
  root.addEventListener('change', change);
  root.addEventListener('keydown', key);
  return () => {
    root.removeEventListener('click', click);
    root.removeEventListener('submit', submit);
    root.removeEventListener('input', input);
    root.removeEventListener('change', change);
    root.removeEventListener('keydown', key);
  };
}
