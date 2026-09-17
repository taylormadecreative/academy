/* Scores on the coordinator page (spec 2026-09-16-class-features-design.md §4).
   mount(sb, el, opts) — el is the DOM element the card draws into (NOT the room's ctx) — draws one card:
   pick a session → the leaderboard (rank, team, school, judges, average, best, one column per rubric
   row), every judge's row with the comment, Export CSV, and the session's rubric (the rows judges tap
   in the room), editable and saved to the session.
   Reads ea_class_scores_rows (the coordinator only — RLS says so; a judge gets no rows).
   opts: { sessions?: rows of ea_opil_sessions (loaded here when absent), zone?: 'America/New_York',
           esc?: fn, sessLabel?: fn, canEdit?: boolean (false hides the rubric editor), session?: no }.
   Returns { refresh(), select(no), destroy() }. Pure helpers exported for tests; import-safe in Node.
   The card is three regions — the picker line, the table, the rubric editor — and a realtime score row
   redraws only the first two, so a coordinator mid-edit on the rubric never loses typed rows. */
/* the room's own helpers, on this module's ?v= (a static import cannot carry a cache stamp) */
const scoring = await import('../../../js/rtk-scoring.js' + new URL(import.meta.url).search);
const { normalizeRubric, rubricMax, leaderboard, judgesWord, DEFAULT_RUBRIC, errorLine } = scoring;
export const csvRows = scoring.csvRows, scoresCSV = scoring.scoresCSV, leaderboardCSV = scoring.leaderboardCSV;

const escFallback = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labelFallback = (s) => s.kind === 'curriculum' ? 'S' + (s.no % 100) : s.kind === 'hpc' ? 'H' + (s.no % 100) : String(s.no).padStart(2, '0');

/* the one line under a session: "4 teams scored by 3 judges" / "No scores yet" */
export function scoresSummary(rows) {
  const list = leaderboard(rows);
  if (!list.length) return 'No scores yet';
  const judges = new Set((rows || []).map(r => r.judge_id).filter(Boolean)).size;
  return list.length + (list.length === 1 ? ' team' : ' teams') + ' scored by ' + judgesWord(judges);
}
/* the rubric editor's fields → rows, or a sentence saying what is wrong.
   A row that already has a key keeps it (so saving the rubric — even with a renamed row — never orphans the
   scores judges saved under that key); only a brand-new row gets its key from its label. */
export function rubricFromFields(fields) {
  const rows = (fields || []).map(f => ({ key: String(f.key || '').trim(), label: String(f.label || '').trim(), max: Number(f.max) })).filter(f => f.label);
  if (!rows.length) return { error: 'Give the rubric at least one row — a name and a top score.' };
  for (const r of rows) { if (!Number.isFinite(r.max) || r.max < 1 || r.max > 10) return { error: '"' + r.label + '" needs a top score from 1 to 10.' }; }
  const labels = rows.map(r => r.label.toLowerCase());
  if (new Set(labels).size !== labels.length) return { error: 'Two rows have the same name — give each row its own.' };
  return { rubric: normalizeRubric(rows.map(r => (r.key ? { key: r.key, label: r.label, max: Math.round(r.max) } : { label: r.label, max: Math.round(r.max) }))) };
}
/* a friendly line for a failed read (the room's errorLine, so both surfaces say the same thing) */
export const readError = (error) => errorLine(error, 'load');

export function mount(sb, el, opts = {}) {
  const esc = opts.esc || escFallback, sessLabel = opts.sessLabel || labelFallback, zone = opts.zone || 'America/New_York';
  const canEdit = opts.canEdit !== false;
  let sessions = opts.sessions || null, current = null, rows = [], chan = null, destroyed = false, notice = '';
  const key = (no) => 'opil:' + no;
  const sessionOf = (no) => (sessions || []).find(s => s.no === no) || null;
  const q = (s) => el.querySelector(s);

  async function loadSessions() {
    if (sessions) return;
    const { data, error } = await sb.from('ea_opil_sessions').select('no, kind, title, session_date, rubric, presenting_team').neq('kind', 'milestone').order('no');
    if (error) { console.warn('[scores] sessions', error); sessions = []; notice = readError(error); return; }
    sessions = data || [];
  }
  async function loadRows() {
    if (current == null) { rows = []; return; }
    const { data, error } = await sb.rpc('ea_class_scores_rows', { p_key: key(current) });
    if (error) { console.warn('[scores] rows', error); rows = []; notice = readError(error); return; }
    rows = data || []; notice = '';
  }
  function watch() {
    try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null;
    if (current == null) return;
    try { chan = sb.channel('scores-admin-' + current).on('postgres_changes', { event: '*', schema: 'public', table: 'ea_class_scores', filter: 'room_key=eq.' + key(current) }, () => refresh()).subscribe(); } catch (e) { chan = null; }
  }

  const cell = 'padding:6px 8px;font-size:13px;vertical-align:top';
  const rubricOf = () => normalizeRubric(sessionOf(current) && sessionOf(current).rubric);
  /* the whole card: the picker line, the table, the rubric editor (each its own child so a refresh can leave the editor alone) */
  function paint() {
    if (destroyed) return;
    el.innerHTML = `<div class="scoresMod" style="display:grid;gap:14px"><div class="scoresHead"></div><div class="scoresTable"></div><div class="scoresRubric"></div></div>`;
    paintHead(); paintTable(); paintRubric();
  }
  function paintHead() {
    const h = q('.scoresHead'); if (!h) return;
    const s = sessionOf(current);
    h.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label style="font-size:13px;color:var(--muted)">Session</label>
        <select class="scoresSess" style="font:inherit;font-size:13.5px;padding:8px 12px;border:1.5px solid var(--hair);border-radius:10px;min-height:40px">
          ${(sessions || []).map(x => `<option value="${x.no}"${x.no === current ? ' selected' : ''}>${esc(sessLabel(x))} · ${esc(x.title || '')}</option>`).join('')}
        </select>
        <span class="scoresSum" style="font-size:13px;color:var(--muted)">${esc(scoresSummary(rows))}${s && s.presenting_team ? ' · a team is on stage now' : ''}</span>
        <button type="button" class="pillbtn scoresCsv"${rows.length ? '' : ' hidden'}>Export CSV</button><button type="button" class="pillbtn scoresLbCsv"${rows.length ? '' : ' hidden'}>Export leaderboard</button>
      </div>`;
    const sel = q('.scoresSess'); if (sel) sel.addEventListener('change', () => select(Number(sel.value)));
    const csv = q('.scoresCsv'); if (csv) csv.addEventListener('click', () => download(scoresCSV(rows, { rubric: rubricOf(), title: csvTitle(), zone }), 'OPIL scores ' + fileLabel() + '.csv'));
    const lb = q('.scoresLbCsv'); if (lb) lb.addEventListener('click', () => download(leaderboardCSV(rows, { rubric: rubricOf(), title: csvTitle() }), 'OPIL leaderboard ' + fileLabel() + '.csv'));
  }
  /* a new score row: the summary line and the export buttons update in place; the picker keeps its focus */
  function refreshHead() {
    const s = sessionOf(current);
    const sum = q('.scoresSum'); if (sum) sum.textContent = scoresSummary(rows) + (s && s.presenting_team ? ' · a team is on stage now' : '');
    const csv = q('.scoresCsv'); if (csv) csv.hidden = !rows.length;
    const lb = q('.scoresLbCsv'); if (lb) lb.hidden = !rows.length;
  }
  function paintTable() {
    const box = q('.scoresTable'); if (!box) return;
    const rubric = rubricOf(), max = rubricMax(rubric), list = leaderboard(rows, rubric);
    const byTeam = new Map(); rows.forEach(r => { if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []); byTeam.get(r.team_id).push(r); });
    const when = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone }) : '';
    box.innerHTML = `${notice ? `<div style="font-size:13px;color:#b4451f">${esc(notice)}</div>` : ''}
      ${list.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:var(--muted);font-size:12px"><th style="${cell}">#</th><th style="${cell}">Team</th><th style="${cell}">School</th><th style="${cell}">Judges</th><th style="${cell}">Average (of ${max})</th><th style="${cell}">Best</th>${rubric.map(r => `<th style="${cell}">${esc(r.label)}</th>`).join('')}</tr></thead>
        <tbody>${list.map(t => `<tr style="border-top:1px solid var(--hair-soft)"><td style="${cell}"><b>${t.rank}</b></td><td style="${cell}"><b>${esc(t.name)}</b></td><td style="${cell}">${esc(t.school || '')}</td><td style="${cell}">${t.judges}</td><td style="${cell}"><b style="color:#067a56">${t.avg}</b></td><td style="${cell}">${t.best}</td>${rubric.map(r => `<td style="${cell}">${t.perKey[r.key] != null ? t.perKey[r.key] : '–'}</td>`).join('')}</tr>
          <tr><td colspan="${6 + rubric.length}" style="padding:0 8px 8px 28px"><details style="font-size:12.5px"><summary style="cursor:pointer;color:var(--blue);font-weight:600">${esc(judgesWord(t.judges))} · open to read each score</summary>
            <table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr style="text-align:left;color:var(--muted);font-size:11.5px"><th style="${cell}">Judge</th>${rubric.map(r => `<th style="${cell}">${esc(r.label)}</th>`).join('')}<th style="${cell}">Total</th><th style="${cell}">Comment</th><th style="${cell}">When</th></tr></thead>
            <tbody>${(byTeam.get(t.team_id) || []).map(r => `<tr style="border-top:1px solid var(--hair-soft)"><td style="${cell}">${esc(r.judge || '')}</td>${rubric.map(x => `<td style="${cell}">${r.scores && r.scores[x.key] != null ? esc(String(r.scores[x.key])) : '–'}</td>`).join('')}<td style="${cell}"><b>${esc(String(r.total != null ? r.total : ''))}</b></td><td style="${cell};max-width:32ch;white-space:pre-wrap">${esc(r.comment || '')}</td><td style="${cell};white-space:nowrap">${esc(when(r.updated_at))}</td></tr>`).join('')}</tbody></table>
          </details></td></tr>`).join('')}</tbody></table></div>`
        : (notice ? '' : `<div style="font-size:13.5px;color:var(--muted)">No scores for this session yet. Judges score from the class room: the host taps <b>Now presenting</b>, judges open their <b>Score</b> tab and tap <b>Save score</b>. Rows appear here as they do.</div>`)}`;
  }
  function paintRubric() {
    const box = q('.scoresRubric'); if (!box) return;
    const s = sessionOf(current), rubric = rubricOf(), max = rubricMax(rubric);
    box.innerHTML = canEdit && s ? `<details class="rubricWrap" style="font-size:13.5px"><summary style="cursor:pointer;color:var(--blue);font-weight:600">Rubric for this session · ${rubric.length} rows, ${max} points</summary>
        <form class="rubricForm" style="display:grid;gap:8px;padding:10px 0 4px">
          <div class="rubricRows" style="display:grid;gap:6px">${rubric.map(r => rubricRowHTML(r, esc)).join('')}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="pillbtn rubricAdd">Add a row</button><button type="button" class="pillbtn rubricReset">Back to the standard five</button><button type="submit" class="pillbtn rubricSave" style="background:var(--ink);color:#fff">Save rubric</button><span class="rubricNote" style="font-size:12.5px;color:var(--muted)">Judges see these rows in the room. Renaming a row or changing its top score keeps the scores already saved on it; a new row starts blank; a removed row's scores leave the table and the CSV.</span></div>
        </form></details>` : '';
    wireRubric();
  }
  /* one editor row; data-key carries the row's existing key so a save never re-keys it (a new row has none) */
  function rubricRowHTML(r, e) {
    return `<div class="rubricRow" data-key="${e(r.key || '')}" style="display:grid;grid-template-columns:1fr 90px auto;gap:8px;align-items:center"><input name="label" value="${e(r.label)}" maxlength="60" placeholder="What is judged (Problem, Solution…)" style="font:inherit;font-size:13px;padding:8px 12px;border:1.5px solid var(--hair);border-radius:10px;min-height:40px"><input name="max" type="number" min="1" max="10" value="${e(String(r.max))}" title="Top score for this row" style="font:inherit;font-size:13px;padding:8px 12px;border:1.5px solid var(--hair);border-radius:10px;min-height:40px"><button type="button" class="pillbtn rubricRm" style="color:#b4451f;background:#fdf0e7;min-height:40px">Remove</button></div>`;
  }
  function wireRubric() {
    const form = q('.rubricForm');
    if (!form) return;
    form.querySelector('.rubricAdd').addEventListener('click', () => { form.querySelector('.rubricRows').insertAdjacentHTML('beforeend', rubricRowHTML({ label: '', max: 5 }, esc)); wireRm(form); });
    form.querySelector('.rubricReset').addEventListener('click', () => { form.querySelector('.rubricRows').innerHTML = DEFAULT_RUBRIC.map(r => rubricRowHTML(r, esc)).join(''); wireRm(form); });
    wireRm(form);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fields = [...form.querySelectorAll('.rubricRow')].map(r => ({ key: r.dataset.key || '', label: r.querySelector('[name="label"]').value, max: r.querySelector('[name="max"]').value }));
      const out = rubricFromFields(fields), note = form.querySelector('.rubricNote');
      if (out.error) { note.textContent = out.error; note.style.color = '#b4451f'; return; }
      const btn = form.querySelector('.rubricSave'); btn.disabled = true;
      const { error } = await sb.from('ea_opil_sessions').update({ rubric: out.rubric }).eq('no', current);
      btn.disabled = false;
      if (destroyed) return;
      if (error) { console.warn('[scores] rubric', error); note.textContent = 'Could not save the rubric. Check your connection and tap Save rubric again.'; note.style.color = '#b4451f'; return; }
      const s = sessionOf(current); if (s) s.rubric = out.rubric;
      /* the new rows now carry their keys; the table's columns follow — the editor stays as it is, open, under the coordinator's hands */
      form.querySelector('.rubricRows').innerHTML = out.rubric.map(r => rubricRowHTML(r, esc)).join(''); wireRm(form);
      const sum = q('.rubricWrap summary'); if (sum) sum.textContent = 'Rubric for this session · ' + out.rubric.length + ' rows, ' + rubricMax(out.rubric) + ' points';
      note.textContent = 'Saved — judges see the new rows the next time their Score tab draws.'; note.style.color = '#067a56';
      paintTable();
    });
  }
  function wireRm(form) { form.querySelectorAll('.rubricRm').forEach(b => { if (b.dataset.wired) return; b.dataset.wired = '1'; b.addEventListener('click', () => b.closest('.rubricRow').remove()); }); }
  const csvTitle = () => { const s = sessionOf(current); return s ? 'OPIL ' + sessLabel(s) + ' · ' + (s.title || '') + ' · ' + (s.session_date || '') : 'OPIL scores'; };
  const fileLabel = () => { const s = sessionOf(current); return s ? sessLabel(s) : String(current); };
  function download(text, name) {
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) { console.warn('[scores] csv', e); const n = q('.scoresSum'); if (n) n.textContent = 'Could not start the download — try again, or use a laptop.'; }
  }

  /* a new score row (realtime) or a manual refresh: the table and the summary redraw; the rubric editor is left alone */
  async function refresh() { if (destroyed) return; await loadRows(); if (destroyed) return; if (q('.scoresTable')) { refreshHead(); paintTable(); } else paint(); }
  /* a different session: everything redraws, editor included */
  async function select(no) { current = no; watch(); await loadRows(); paint(); }
  function destroy() { destroyed = true; try { if (chan) sb.removeChannel(chan); } catch (e) {} chan = null; }

  (async () => {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted)">Loading scores…</div>';
    await loadSessions();
    if (destroyed) return;
    const wanted = opts.session != null ? opts.session : null;
    const first = (sessions || []).find(s => s.no === wanted) || (sessions || []).find(s => s.presenting_team) || (sessions || [])[0] || null;
    if (!first) { el.innerHTML = `<div style="font-size:13px;color:var(--muted)">${esc(notice || 'No sessions to score yet.')}</div>`; return; }
    await select(first.no);
  })().catch(e => { console.warn('[scores] mount', e); el.innerHTML = '<div style="font-size:13px;color:#b4451f">Could not load scores right now. Reload the page to try again.</div>'; });

  return { refresh, select, destroy };
}
