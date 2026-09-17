/* Judge scoring + leaderboard — class plugin (spec 2026-09-16-class-features-design.md §4).
   The host puts a team on stage ("Now presenting"); judges and coordinators get a Score tab with
   the presenting team's name, the session's rubric as tappable 1–5 pills, a comment and one gold
   Save score (an upsert: one row per judge per team per class). A Leaderboard tab shows the
   average total per team and how many judges have scored (the aggregate RPC — a judge never sees
   another judge's picks or note; the coordinator page does). Students see nothing.
   Who is presenting lives on the session row (ea_opil_sessions.presenting_team — the row is the
   truth); the `stage` broadcast is only a nudge to re-read it, so a forged payload changes nothing.
   Pure decisions (the rubric math, the leaderboard order, the CSV) are exported for tests.
   Import-safe in Node: nothing here touches document or window at import time.
   The integrator passes ctx.judge (boot().isJudge) and ctx.admin (boot().isAdmin); when either is
   missing the plugin asks ea_opil_my_role() itself, so a forgotten line never hides the tab. */
const CSS_HREF = '/css/rtk-scoring.css' + new URL(import.meta.url).search;
export const DEFAULT_RUBRIC = [
  { key: 'problem', label: 'Problem', max: 5 },
  { key: 'solution', label: 'Solution', max: 5 },
  { key: 'open_payments', label: 'Open-payments use', max: 5 },
  { key: 'business', label: 'Business model', max: 5 },
  { key: 'delivery', label: 'Delivery', max: 5 },
];
export const POLL_MS = 20000;

/* ---- the rubric ---- */
/* whatever the session row holds (null, a JSON string, an array of rows) → a clean list of rows;
   a row needs a label; its key falls out of the label; max is 1–10, default 5 */
export function normalizeRubric(raw) {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  if (!Array.isArray(v) || !v.length) return DEFAULT_RUBRIC.map(r => ({ ...r }));
  const seen = new Set(); const out = [];
  v.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const label = String(r.label || r.key || '').trim().slice(0, 60); if (!label) return;
    let key = String(r.key || label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'row' + i;
    while (seen.has(key)) key += '_';
    seen.add(key);
    let max = Math.round(Number(r.max)); if (!Number.isFinite(max) || max < 1) max = 5; if (max > 10) max = 10;
    out.push({ key, label, max });
  });
  return out.length ? out : DEFAULT_RUBRIC.map(r => ({ ...r }));
}
export const rubricMax = (rubric) => normalizeRubric(rubric).reduce((n, r) => n + r.max, 0);
/* a judge's picks {key: n} → the total: each pick clamped to 1..max, an unknown key ignored, a missing one counts 0 */
export function rubricTotal(scores, rubric) {
  const rows = normalizeRubric(rubric); const s = scores && typeof scores === 'object' ? scores : {};
  return rows.reduce((n, r) => {
    const v = Number(s[r.key]); if (!Number.isFinite(v) || v <= 0) return n;
    return n + Math.min(r.max, Math.max(1, Math.round(v)));
  }, 0);
}
/* every row picked? (Save is allowed on a partial score — the sentence says which rows are still blank) */
export function missingRows(scores, rubric) {
  const s = scores && typeof scores === 'object' ? scores : {};
  return normalizeRubric(rubric).filter(r => !(Number(s[r.key]) >= 1)).map(r => r.label);
}
/* the line under Save: "18 of 25" or "18 of 25 · Delivery not scored yet" */
export function totalLine(scores, rubric) {
  const t = rubricTotal(scores, rubric), max = rubricMax(rubric), miss = missingRows(scores, rubric);
  if (!miss.length) return t + ' of ' + max;
  if (miss.length === normalizeRubric(rubric).length) return 'Tap a number on each row';
  return t + ' of ' + max + ' · ' + (miss.length === 1 ? miss[0] + ' not scored yet' : miss.length + ' rows not scored yet');
}

/* ---- the leaderboard: score rows → one line per team, best first ---- */
/* rows: { team_id, team|name, school, judge_id, total, scores } (the RPC's shape, or the leaderboard RPC's
   { team_id, name, school, judges, avg_total }). Ties share a rank; then more judges wins; then the name. */
export function leaderboard(rows, rubric) {
  const by = new Map();
  (rows || []).forEach(r => {
    if (!r || !r.team_id) return;
    const name = r.team || r.name || 'A team';
    let t = by.get(r.team_id); if (!t) { t = { team_id: r.team_id, name, school: r.school || '', judges: 0, sum: 0, best: 0, perKey: {}, n: {} }; by.set(r.team_id, t); }
    if (r.judges != null && r.avg_total != null) {   /* a pre-aggregated line */
      t.judges = Number(r.judges) || 0; t.sum = (Number(r.avg_total) || 0) * t.judges; t.best = Number(r.best_total) || 0; return;
    }
    const total = r.total != null ? Number(r.total) : rubricTotal(r.scores, rubric);
    t.judges += 1; t.sum += total; t.best = Math.max(t.best, total);
    const s = r.scores && typeof r.scores === 'object' ? r.scores : {};
    Object.keys(s).forEach(k => { const v = Number(s[k]); if (!Number.isFinite(v)) return; t.perKey[k] = (t.perKey[k] || 0) + v; t.n[k] = (t.n[k] || 0) + 1; });
  });
  const list = [...by.values()].map(t => ({
    team_id: t.team_id, name: t.name, school: t.school, judges: t.judges,
    avg: t.judges ? Math.round((t.sum / t.judges) * 100) / 100 : 0, best: t.best,
    perKey: Object.fromEntries(Object.keys(t.perKey).map(k => [k, Math.round((t.perKey[k] / t.n[k]) * 100) / 100])),
  }));
  list.sort((a, b) => b.avg - a.avg || b.judges - a.judges || a.name.localeCompare(b.name));
  let rank = 0, prev = null;
  list.forEach((t, i) => { if (prev === null || t.avg !== prev) rank = i + 1; t.rank = rank; prev = t.avg; });
  return list;
}
export const judgesWord = (n) => n === 1 ? '1 judge' : n + ' judges';
/* the sentence over the Score tab */
export function presentingLine(team, { host } = {}) {
  if (!team) return host ? 'No team is on stage. Tap Now presenting in the bar to put one up.' : 'No team is presenting yet. When the host puts a team on stage, their name appears here.';
  return (team.name || 'A team') + ' is presenting' + (team.school ? ' · ' + team.school : '');
}
export const savedLine = (team, scores, rubric) => 'Saved — ' + (team && team.name ? team.name : 'that team') + ': ' + rubricTotal(scores, rubric) + ' of ' + rubricMax(rubric) + '.';

/* ---- a failed request → one sentence with a next step (the raw error goes to console.warn) ---- */
/* what: 'load' (reading) or 'save' (writing) — the sentence names the thing to do next */
export function errorLine(error, what = 'load') {
  const m = String(error && error.message || error || '');
  if (/does not exist|not find the function|schema cache|relation .* does not exist/i.test(m)) return 'Scores are not switched on yet — the scoring update (0046) has not been applied.';
  if (/permission|policy|denied|row-level security|401|403/i.test(m)) return what === 'save' ? 'Only judges and the coordinator can save a score — this sign-in cannot.' : 'Only the coordinator can see every score; judges see the leaderboard.';
  if (what === 'save') return 'Could not save the score. Check your connection and tap Save score again.';
  return 'Could not load scores right now. Try again in a moment.';
}

/* ---- the CSV (the coordinator's export) ---- */
/* a quote wraps anything with a comma, quote or newline; a leading = + - @ or tab gets a quote so a
   spreadsheet never runs it as a formula — a plain signed number is left alone (the repo's gotcha) */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/* rows from ea_class_scores_rows → a header row + one row per score: team, school, judge, each rubric row, total, comment, when */
export function csvRows(rows, rubric, { zone } = {}) {
  const rb = normalizeRubric(rubric);
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }; if (zone) opts.timeZone = zone;
  const when = (iso) => iso ? new Date(iso).toLocaleString('en-US', opts) : '';
  const head = ['Team', 'School', 'Judge', ...rb.map(r => r.label + ' (of ' + r.max + ')'), 'Total (of ' + rubricMax(rb) + ')', 'Comment', 'Scored at'];
  const body = (rows || []).map(r => {
    const s = r.scores && typeof r.scores === 'object' ? r.scores : {};
    return [r.team || r.name || '', r.school || '', r.judge || '', ...rb.map(x => s[x.key] != null ? Number(s[x.key]) : ''), r.total != null ? Number(r.total) : rubricTotal(s, rb), r.comment || '', when(r.updated_at)];
  });
  return [head, ...body];
}
export function scoresCSV(rows, { rubric, title, zone } = {}) {
  const lines = csvRows(rows, rubric, { zone }).map(r => r.map(csvCell).join(','));
  return (title ? csvCell(title) + '\n' : '') + lines.join('\n') + '\n';
}
/* the leaderboard as CSV: rank, team, school, judges, average, best */
export function leaderboardCSV(rows, { rubric, title } = {}) {
  const max = rubricMax(rubric);
  const lines = [['Rank', 'Team', 'School', 'Judges', 'Average (of ' + max + ')', 'Best (of ' + max + ')'].map(csvCell).join(',')];
  leaderboard(rows, rubric).forEach(t => lines.push([t.rank, t.name, t.school, t.judges, t.avg, t.best].map(csvCell).join(',')));
  return (title ? csvCell(title) + '\n' : '') + lines.join('\n') + '\n';
}

/* ---- the plugin ---- */
function ensureCss() {
  try { if (typeof document === 'undefined') return; if (document.querySelector('link[data-rtk="scoring"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.rtk = 'scoring'; document.head.appendChild(l); } catch (e) {}
}
/* is this element the one being typed in? (its document's activeElement — works on a stub too) */
const isFocused = (n) => { try { return !!n && !!n.ownerDocument && n.ownerDocument.activeElement === n; } catch (e) { return false; } };
export function create(ctx) {
  const { sb, el, esc, uid } = ctx;
  const sessionNo = ctx.session && ctx.session.no;
  const roomKey = ctx.roomKey;
  let judge = !!ctx.judge, admin = !!ctx.admin, host = !!ctx.host;
  let rubric = normalizeRubric(ctx.session && ctx.session.rubric);
  let teams = [], teamsError = null, presenting = null, target = null, picks = {}, comment = '', mine = null, saving = false, dirty = false;
  let scoreTab = null, boardTab = null, stageChan = null, scoresChan = null, poll = null, boardRows = [], boardLoaded = false, boardError = null, barBtn = null, stopped = false;
  const toast = (m, ms) => { try { ctx.toast(m, ms); } catch (e) {} };
  const teamById = (id) => teams.find(t => t.id === id) || null;
  const unsaved = () => dirty && (Object.keys(picks).some(k => Number(picks[k]) >= 1) || !!(comment || '').trim());

  /* ---- reading the session: the rubric and who is presenting (the row is the truth) ---- */
  async function loadTeams() {
    try { const { data, error } = await sb.rpc('ea_class_teams', { p_key: roomKey }); if (error) throw error; teams = data || []; teamsError = null; }
    catch (e) { console.warn('[scoring] teams', e); teamsError = e || new Error('teams'); }
  }
  async function loadSession() {
    if (!sessionNo || stopped) return;
    try {
      const { data, error } = await sb.from('ea_opil_sessions').select('rubric, presenting_team').eq('no', sessionNo).maybeSingle();
      if (error) throw error;
      if (stopped) return;
      if (data) { rubric = normalizeRubric(data.rubric); setPresenting(data.presenting_team ? (teamById(data.presenting_team) || { id: data.presenting_team, name: 'A team', school: '' }) : null); }
    } catch (e) { console.warn('[scoring] session', e); }
  }
  /* the team on stage changed. The Score tab follows the stage only when the judge has nothing unsaved;
     half-scored picks or a half-typed note stay put, with a sentence saying who is on stage now. */
  function setPresenting(team) {
    const was = presenting && presenting.id, now = team && team.id;
    presenting = team;
    if (was === now) return;
    const following = !target || target.id === was;
    if (following && unsaved() && team) {
      toast(team.name + ' is on stage — finish or save ' + (target.name || 'this team') + ', then pick ' + team.name + ' from the list.', 7000);
    } else if (following) {
      switchTarget(team);
    }
    paintScore();
    if (team && (judge || admin) && !host) {
      toast(team.name + ' is presenting — the Score tab is ready.', 5000);
      try { if (scoreTab && !unsaved()) scoreTab.show(); } catch (e) {}
    }
  }
  /* point the Score tab at a team: a clean slate, then their saved row if there is one */
  function switchTarget(team) {
    target = team; picks = {}; comment = ''; mine = null; dirty = false;
    if (team) loadMine();
  }

  /* ---- the host: Now presenting ---- */
  async function present(team) {
    if (!sessionNo) return false;
    try {
      const { error } = await sb.from('ea_opil_sessions').update({ presenting_team: team ? team.id : null }).eq('no', sessionNo);
      if (error) throw error;
      setPresenting(team);
      if (stageChan) stageChan.send({ team_id: team ? team.id : null, name: team ? team.name : null });
      try { ctx.events.log('presenting', team ? team.name : 'Stage cleared', { team_id: team ? team.id : null }); } catch (e) {}
      toast(team ? team.name + ' is now presenting — judges can score them.' : 'The stage is clear — no team is presenting.', 5000);
      return true;
    } catch (e) { console.warn('[scoring] present', e); toast('Could not put that team on stage. Check your connection and tap the team again.', 7000); return false; }
  }
  const noTeamsLine = () => teamsError ? errorLine(teamsError, 'load').replace('Could not load scores right now', 'Could not load the team list') + (/0046/.test(errorLine(teamsError)) ? '' : ' If it keeps happening, reload the page.') : 'No teams yet. Teams appear here once the coordinator has approved them on the hub.';
  function presentingPane() {
    const p = el(`<div class="r2-tools r2-present">
      <p class="r2-present-line">${esc(presentingLine(presenting, { host: true }))}</p>
      ${teams.length ? teams.map(t => `<button type="button" class="r2-btn r2-present-team${presenting && presenting.id === t.id ? ' on' : ''}" data-team="${esc(t.id)}"><b>${esc(t.name)}</b><span>${presenting && presenting.id === t.id ? 'Presenting now · tap to keep them up' : (t.school ? esc(t.school) + ' · ' : '') + 'tap to put them on stage'}</span></button>`).join('') : `<div class="r2-empty">${esc(noTeamsLine())}</div>`}
      ${presenting ? '<button type="button" class="r2-btn r2-present-clear" data-team=""><b>Clear the stage</b><span>No team presenting — judges see the tab go quiet</span></button>' : ''}
      <p class="r2-fine">Judges score the team on stage from their Score tab. If the team is in a small group, bring everyone back first.</p>
    </div>`);
    p.querySelectorAll('[data-team]').forEach(b => b.addEventListener('click', async () => {
      const t = b.dataset.team ? teamById(b.dataset.team) : null;
      if (b.dataset.team && !t) return;
      b.disabled = true; const ok = await present(t); b.disabled = false;
      if (ok) { try { ctx.closeSheet(); } catch (e) {} }
    }));
    return p;
  }
  function openPresenting() { try { ctx.openSheet('Now presenting', presentingPane()); } catch (e) { console.warn('[scoring] sheet', e); } }

  /* ---- the judge: the Score tab ---- */
  /* my saved row for the target team. Guarded: if the target moved on while this was in flight, the
     answer is dropped — a slow reply for team A never paints under team B. */
  async function loadMine() {
    if (!target) return;
    const want = target.id;
    try {
      const { data, error } = await sb.from('ea_class_scores').select('scores, comment, total').eq('room_key', roomKey).eq('team_id', want).eq('judge_id', uid).maybeSingle();
      if (error) throw error;
      if (stopped || !target || target.id !== want || dirty) return;   /* moved on, or the judge started tapping: keep what is on screen */
      mine = data || null;
      if (mine) { picks = Object.assign({}, mine.scores || {}); comment = mine.comment || ''; }
      paintScore();
    } catch (e) { console.warn('[scoring] mine', e); }
  }
  function headHTML() {
    const t = target;
    return `<b>${esc(presentingLine(presenting, { host }))}</b>${t && presenting && t.id !== presenting.id ? `<span>You are scoring ${esc(t.name)} — not the team on stage.</span>` : ''}`;
  }
  function optionsHTML() {
    const t = target;
    return `<option value="">Choose a team…</option>${teams.map(x => `<option value="${esc(x.id)}"${t && t.id === x.id ? ' selected' : ''}>${esc(x.name)}${presenting && presenting.id === x.id ? ' · on stage' : ''}</option>`).join('')}`;
  }
  function paintScore() {
    if (!scoreTab) return;
    const pane = scoreTab.pane; if (!pane) return;
    const ta = pane.querySelector('.r2-score-comment');
    /* the judge is typing about THIS team: keep their textarea and pills; refresh only the words around them */
    if (ta && isFocused(ta) && target && ta.dataset && ta.dataset.team === target.id) {
      comment = ta.value;
      const h = pane.querySelector('.r2-score-head'); if (h) h.innerHTML = headHTML();
      const sel = pane.querySelector('.r2-score-team'); if (sel) sel.innerHTML = optionsHTML();
      return;
    }
    const t = target;
    pane.innerHTML = `<div class="r2-score">
      <div class="r2-score-head">${headHTML()}</div>
      ${teams.length ? `<label class="r2-score-pick"><span>Scoring</span><select class="r2-score-team">${optionsHTML()}</select></label>` : ''}
      ${t ? `<div class="r2-rubric">${rubric.map(r => `<div class="r2-rubric-row"><span class="r2-rubric-label">${esc(r.label)}</span><div class="r2-rubric-pills" role="radiogroup" aria-label="${esc(r.label)}">${Array.from({ length: r.max }, (_, i) => i + 1).map(n => `<button type="button" class="r2-pill${Number(picks[r.key]) === n ? ' on' : ''}" role="radio" aria-checked="${Number(picks[r.key]) === n}" data-key="${esc(r.key)}" data-n="${n}">${n}</button>`).join('')}</div></div>`).join('')}</div>
        <textarea class="r2-score-comment" data-team="${esc(t.id)}" maxlength="2000" rows="3" placeholder="A note for the coordinator (optional)">${esc(comment)}</textarea>
        <button type="button" class="r2-cta r2-score-save"${saving ? ' disabled' : ''}><b>${saving ? 'Saving…' : mine ? 'Update score' : 'Save score'}</b><span class="r2-score-total">${esc(totalLine(picks, rubric))}</span></button>
        <button type="button" class="r2-btn r2-score-clear"${unsaved() ? '' : ' hidden'}>Clear this score — start ${esc(t.name)} over</button>
        <p class="r2-fine">${mine ? 'You scored this team already — saving again replaces it.' : 'Only you and the coordinator see your score. Students never do.'}</p>`
      : `<div class="r2-empty">${teamsError ? esc(noTeamsLine()) : teams.length ? 'Pick a team above to score them, or wait for the host to put one on stage.' : 'No teams to score yet. Once the coordinator approves teams on the hub, they appear here.'}</div>`}
    </div>`;
    const sel = pane.querySelector('.r2-score-team');
    if (sel) sel.addEventListener('change', () => {
      const next = teamById(sel.value);
      if (unsaved() && next !== target) {
        const back = target;
        toast('You have an unsaved score for ' + (back && back.name || 'this team') + ' — tap Save score first, or Clear this score below.', 6000);
        sel.value = back ? back.id : '';
        return;
      }
      switchTarget(next); paintScore();
    });
    const showClear = () => { const c = pane.querySelector('.r2-score-clear'); if (c) c.hidden = !unsaved(); };
    pane.querySelectorAll('.r2-pill').forEach(b => b.addEventListener('click', () => {
      picks[b.dataset.key] = Number(b.dataset.n); dirty = true; showClear();
      const row = b.parentElement; row.querySelectorAll('.r2-pill').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      const tot = pane.querySelector('.r2-score-total'); if (tot) tot.textContent = totalLine(picks, rubric);
    }));
    const nta = pane.querySelector('.r2-score-comment'); if (nta) nta.addEventListener('input', () => { comment = nta.value; dirty = true; showClear(); });
    const save = pane.querySelector('.r2-score-save'); if (save) save.addEventListener('click', saveScore);
    const clear = pane.querySelector('.r2-score-clear'); if (clear) clear.addEventListener('click', () => { const t2 = target; switchTarget(presenting && presenting.id !== (t2 && t2.id) ? presenting : t2); paintScore(); });
  }
  async function saveScore() {
    if (!target || saving) return;
    const miss = missingRows(picks, rubric);
    if (miss.length === rubric.length) { toast('Tap a number on each row first.'); return; }
    saving = true; paintScore();
    const team = target, scores = {}; rubric.forEach(r => { if (Number(picks[r.key]) >= 1) scores[r.key] = Math.min(r.max, Math.max(1, Math.round(Number(picks[r.key])))); });
    const row = { room_key: roomKey, team_id: team.id, judge_id: uid, scores, comment: (comment || '').trim().slice(0, 2000) || null, total: rubricTotal(scores, rubric) };
    try {
      const { error } = await sb.from('ea_class_scores').upsert(row, { onConflict: 'room_key,team_id,judge_id' });
      if (error) throw error;
      if (target === team) { mine = { scores, comment: row.comment, total: row.total }; dirty = false; }
      toast(savedLine(team, scores, rubric) + (miss.length ? ' ' + (miss.length === 1 ? miss[0] + ' is' : miss.length + ' rows are') + ' still blank — you can come back to it.' : ''), 6000);
      loadBoard();
      /* the stage moved on while this was being scored: follow it now that the score is safe */
      if (target === team && presenting && presenting.id !== team.id) { switchTarget(presenting); toast(presenting.name + ' is on stage — the Score tab is on them now.', 5000); }
    } catch (e) { console.warn('[scoring] save', e); toast(errorLine(e, 'save'), 8000); }
    saving = false; paintScore();
  }

  /* ---- the leaderboard tab: the aggregate (average, judge count) — never another judge's picks ---- */
  async function loadBoard() {
    if (stopped) return;
    try { const { data, error } = await sb.rpc('ea_class_leaderboard', { p_key: roomKey }); if (error) throw error; boardRows = data || []; boardLoaded = true; boardError = null; }
    catch (e) { console.warn('[scoring] board', e); boardError = e || new Error('board'); }
    if (stopped) return;
    paintBoard();
  }
  function paintBoard() {
    if (!boardTab) return;
    const pane = boardTab.pane; if (!pane) return;
    const list = leaderboard(boardRows, rubric), max = rubricMax(rubric);
    if (boardTab.count) boardTab.count.textContent = list.length || '';
    pane.innerHTML = `<div class="r2-board-scores">
      <div class="r2-queue-head">Leaderboard <span class="r2-fine-inline">average of ${esc(String(max))} · live</span></div>
      ${list.length ? list.map(t => `<div class="r2-lb-row${t.rank === 1 ? ' lead' : ''}${presenting && presenting.id === t.team_id ? ' staged' : ''}"><span class="r2-n">${t.rank}</span><div class="r2-who"><b>${esc(t.name)}</b><span>${esc(t.school || '')}${t.school ? ' · ' : ''}${esc(judgesWord(t.judges))}${presenting && presenting.id === t.team_id ? ' · on stage' : ''}</span></div><b class="r2-lb-avg">${esc(String(t.avg))}</b></div>`).join('')
        : `<div class="r2-empty">${boardError && !boardLoaded ? esc(errorLine(boardError, 'load').replace('load scores', 'load the board')) : boardLoaded ? 'No scores yet. The board fills in as judges tap Save score.' : 'Loading the board…'}</div>`}
      <p class="r2-fine">Only judges and the coordinator see this. Each judge's own picks stay between them and the coordinator.</p>
    </div>`;
  }

  /* ---- start / stop ---- */
  async function resolveRole() {
    if (ctx.judge != null && ctx.admin != null) return;
    try { const { data } = await sb.rpc('ea_opil_my_role'); if (data) { if (ctx.judge == null) judge = !!data.judge; if (ctx.admin == null) admin = !!data.admin; } }
    catch (e) { console.warn('[scoring] role', e); }
  }
  function start() {
    try {
      if (!sessionNo) { console.warn('[scoring] no session on this room — scoring is for OPIL sessions'); return; }
      ensureCss();
      (async () => {
        await resolveRole();
        if (stopped) return;
        if (!host && !judge && !admin) return;   /* a student: no tab, no button, no polling — scores are not theirs to see */
        await loadTeams();
        if (stopped) return;
        if (host) {
          try { barBtn = ctx.bar.addButton('<button type="button" class="r2-btn r2-presenting">Now presenting</button>'); barBtn.addEventListener('click', openPresenting); } catch (e) { console.warn('[scoring] bar', e); }
        }
        if (judge || admin) {
          try { scoreTab = ctx.panel.addTab('score', 'Score'); boardTab = ctx.panel.addTab('leaderboard', 'Leaderboard'); } catch (e) { console.warn('[scoring] tabs', e); }
          paintScore(); paintBoard();
          /* realtime hands a judge only their own rows (RLS) — enough to refresh after a save; the 20 s poll below keeps
             everyone's board honest. The coordinator (who reads every row) hears every save. */
          try { scoresChan = sb.channel('scores-' + roomKey).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_class_scores', filter: 'room_key=eq.' + roomKey }, () => loadBoard()).subscribe(); } catch (e) { scoresChan = null; }
          loadBoard();
        }
        await loadSession();
        if (stopped) { stop(); return; }
        if (target) loadMine();
        try { stageChan = ctx.channel('stage'); stageChan.on((p, meta) => { if (stopped) return; if (meta && meta.mine) return; if (meta && meta.fromHost && p) setPresenting(p.team_id ? (teamById(p.team_id) || { id: p.team_id, name: String(p.name || 'A team').slice(0, 160), school: '' }) : null); loadSession(); }); } catch (e) { stageChan = null; }
        poll = setInterval(() => { if (stopped) return; loadSession(); if (boardTab) loadBoard(); }, POLL_MS);
        if (stopped) stop();
      })().catch(e => console.warn('[scoring] start', e));
    } catch (e) { console.warn('[scoring] start', e); }
  }
  function stop() {
    stopped = true;
    clearInterval(poll); poll = null;
    try { if (stageChan) stageChan.stop(); } catch (e) {} stageChan = null;
    try { if (scoresChan) sb.removeChannel(scoresChan); } catch (e) {} scoresChan = null;
  }
  return { start, stop, openPresenting, present, get presenting() { return presenting; }, get target() { return target; }, get rubric() { return rubric; }, get unsaved() { return unsaved(); } };
}
