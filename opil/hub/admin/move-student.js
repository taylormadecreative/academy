/* Registrations → Move (migration 0055): the coordinator moves an approved student to another team.
   wire(sb, table, { esc, regs, teams }) — delegates clicks on [data-move] inside the registrations table.
   Two steps, both on the page: pick a team (or type a new one) → "Move X from A to B?" → Yes, move.
   The RPC ea_opil_move_student does the work and refuses anyone off the program team.
   The pure parts (teamKey, teamChoices, resultLine) are import-safe in Node for tests/opil/move-student.test.mjs. */

/* mirrors ea_opil_team_key() in 0026: case, punctuation and a leading "Team " never split a team */
export const teamKey = (t) => String(t ?? '').toLowerCase().replace(/^\s*team\s+/, '').replace(/[^a-z0-9]/g, '');

/* every real team a student could join, one entry per key, current team left out, A→Z.
   Teams that exist only as a registration name (nobody signed in yet) are choices too. */
export function teamChoices(teams, regs, currentName) {
  const cur = teamKey(currentName), seen = new Map();
  for (const t of teams || []) if (!t.is_staff && t.name && teamKey(t.name) && !seen.has(teamKey(t.name))) seen.set(teamKey(t.name), t.name.trim());
  const staff = new Set((teams || []).filter(t => t.is_staff).map(t => teamKey(t.name)));
  for (const r of regs || []) { const k = teamKey(r.team_name); if (k && !seen.has(k) && !staff.has(k)) seen.set(k, r.team_name.trim()); }
  seen.delete(cur);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'The student';

/* what the coordinator reads after a move */
export function resultLine(res, fullName) {
  if (!res) return '';
  const who = first(fullName);
  if (res.unchanged) return `${who} is already on ${res.to}. Nothing changed.`;
  let s = res.seated
    ? `Moved. ${who} will see ${res.to} the next time they open the hub.`
    : `Moved. ${who} hasn't signed in yet, so they land on ${res.to} the first time they do.`;
  if (res.old_removed) s += ` ${res.from} had no one left, so it was removed.`;
  else if (res.old_kept) s += ` ${res.from} stays on the list because ${res.old_kept}.`;
  return s;
}

const FIELD = 'font:inherit;font-size:13.5px;padding:9px 13px;border:1.5px solid var(--hair);border-radius:10px;min-height:40px';
const PRIMARY = 'min-height:40px;background:var(--blue);color:#fff';
const QUIET = 'min-height:40px;background:transparent;color:var(--ink-2,#3d4a66)';
const NEW = '__new__';
/* the RPC's own refusals are written for the coordinator; anything else gets plain words */
const KNOWN = /^(only the program team|give the team a name|that registration no longer exists|approve this student first|that name belongs to the program team)/;
export const errorLine = (e) => 'Could not move: ' + (KNOWN.test(e?.message || '') ? e.message : 'the connection dropped or something went wrong, so try again') + '. Nothing changed.';

export function wire(sb, table, { esc, regs, teams }) {
  if (!sb || !table) return;
  const regOf = (id) => (regs || []).find(r => r.id === id);
  let busy = false;   /* a move in flight: the row stays open so its result has somewhere to land */
  const btnFor = (id) => table.querySelector(`[data-move="${id}"]`);
  const close = (refocus) => table.querySelectorAll('tr.moverow').forEach(tr => {
    const b = btnFor(tr.dataset.for); if (b) b.setAttribute('aria-expanded', 'false');
    tr.remove(); if (refocus && b) b.focus();
  });

  function open(r, anchorRow) {
    close(false);
    const choices = teamChoices(teams, regs, r.team_name);
    const cur = String(r.team_name || '').trim();
    const tr = document.createElement('tr');
    tr.className = 'moverow'; tr.dataset.for = r.id;
    const lid = 'mvl-' + r.id, qid = 'mvq-' + r.id;
    tr.innerHTML = `<td colspan="7" style="background:var(--blue-soft,#eef3ff);padding:14px 18px">
      <div data-step="pick" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <span id="${lid}" style="font-size:13.5px;color:var(--ink)">Move <b>${esc(r.full_name)}</b> from <b>${esc(cur)}</b> to</span>
        <select data-m="team" aria-labelledby="${lid}" style="${FIELD};min-width:200px">
          <option value="">Choose a team…</option>
          ${choices.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
          <option value="${NEW}">New team…</option>
        </select>
        <input data-m="name" maxlength="80" placeholder="New team's name" aria-label="New team's name" hidden style="${FIELD};min-width:200px">
        <button type="button" class="pillbtn" data-m="next" style="${PRIMARY}">Move</button>
        <button type="button" class="pillbtn" data-m="cancel" style="${QUIET}">Cancel</button>
      </div>
      <div data-step="confirm" style="display:none;flex-wrap:wrap;gap:10px;align-items:center">
        <span data-m="question" id="${qid}" style="font-size:14px;color:var(--ink);font-weight:600"></span>
        <button type="button" class="pillbtn" data-m="yes" aria-describedby="${qid}" style="${PRIMARY}">Yes, move</button>
        <button type="button" class="pillbtn" data-m="back" style="${QUIET}">Back</button>
      </div>
      <div data-m="msg" role="status" aria-live="polite" style="font-size:13.5px;margin-top:8px;color:var(--ink-2,#3d4a66)"></div>
      <div data-step="done" style="display:none;margin-top:10px;flex-wrap:wrap;gap:10px;align-items:center">
        <button type="button" class="pillbtn" data-m="done" style="min-height:40px;border:1.5px solid var(--blue)">Done</button>
      </div>
    </td>`;
    /* after the detail row, so an open "+" panel stays attached to its row */
    const detail = table.querySelector(`[data-detail="${r.id}"]`);
    (detail || anchorRow).insertAdjacentElement('afterend', tr);
    const mb = btnFor(r.id); if (mb) mb.setAttribute('aria-expanded', 'true');

    const $ = (k) => tr.querySelector(`[data-m="${k}"]`);
    const step = (s) => tr.querySelectorAll('[data-step]').forEach(d => { d.style.display = d.dataset.step === s ? 'flex' : 'none'; });
    const say = (t, tone) => { $('msg').textContent = t || ''; $('msg').style.color = tone === 'bad' ? '#b42318' : tone === 'good' ? '#067a56' : 'var(--ink-2,#3d4a66)'; $('msg').style.fontWeight = tone === 'good' ? '600' : '400'; };
    const target = () => $('team').value === NEW ? $('name').value.trim() : $('team').value;
    step('pick'); $('team').focus();

    const next = () => {
      const to = target();
      if (!to) { say($('team').value === NEW ? "Type the new team's name." : 'Choose a team first.', 'bad'); ($('team').value === NEW ? $('name') : $('team')).focus(); return; }
      if (teamKey(to) === teamKey(cur)) { say(`${first(r.full_name)} is already on ${cur}.`, 'bad'); return; }
      const isNew = $('team').value === NEW && !choices.some(n => teamKey(n) === teamKey(to));
      $('question').textContent = `Move ${r.full_name} from ${cur} to ${isNew ? 'a new team, ' : ''}${to}?`;
      say(''); step('confirm'); $('yes').focus();
    };
    $('team').addEventListener('change', () => { const isNew = $('team').value === NEW; $('name').hidden = !isNew; if (isNew) $('name').focus(); say(''); });
    $('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !busy) { e.preventDefault(); close(true); } });
    $('cancel').addEventListener('click', () => close(true));
    $('done').addEventListener('click', () => close(true));
    $('back').addEventListener('click', () => { step('pick'); say(''); $('team').focus(); });
    $('next').addEventListener('click', next);
    $('yes').addEventListener('click', async () => {
      if (busy) return;
      const to = target();
      busy = true; $('yes').disabled = true; $('yes').textContent = 'Moving…';
      let res, error;
      try { ({ data: res, error } = await sb.rpc('ea_opil_move_student', { p_reg: r.id, p_team: to })); }
      catch (e) { error = e; }
      busy = false; $('yes').disabled = false; $('yes').textContent = 'Yes, move';
      if (error || !res) { step('pick'); say(errorLine(error), 'bad'); $('team').focus(); return; }
      const from = r.team_name;
      /* keep the page's lists true so the next Move offers the right teams */
      for (const x of regs || []) if (x.email && r.email && x.email.toLowerCase() === r.email.toLowerCase()) x.team_name = res.to;
      r.team_name = res.to;
      if (res.old_removed && teams) { const i = teams.findIndex(t => !t.is_staff && teamKey(t.name) === teamKey(from)); if (i >= 0) teams.splice(i, 1); }
      if (teams && res.seated && !teams.some(t => teamKey(t.name) === teamKey(res.to))) teams.push({ name: res.to, is_staff: false });
      const cell = anchorRow.querySelector('td b'); if (cell) cell.textContent = res.to;
      step('done');
      say(resultLine(res, r.full_name) + (res.unchanged ? '' : ' Reload the page before exporting attendance.'), 'good');
      $('done').focus();
    });
  }

  table.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-move]'); if (!b) return;
    if (busy) return;
    const r = regOf(b.dataset.move); if (!r) return;
    if (table.querySelector(`tr.moverow[data-for="${r.id}"]`)) { close(true); return; }
    open(r, b.closest('tr'));
  });
}
