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
const NEW = '__new__';

export function wire(sb, table, { esc, regs, teams }) {
  if (!sb || !table) return;
  const regOf = (id) => (regs || []).find(r => r.id === id);
  const close = () => table.querySelectorAll('tr.moverow').forEach(tr => tr.remove());

  function open(r, anchorRow) {
    close();
    const choices = teamChoices(teams, regs, r.team_name);
    const tr = document.createElement('tr');
    tr.className = 'moverow'; tr.dataset.for = r.id;
    tr.innerHTML = `<td colspan="7" style="background:var(--blue-soft,#eef3ff);padding:14px 18px">
      <div data-step="pick" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <label style="font-size:13.5px;color:var(--ink)">Move <b>${esc(r.full_name)}</b> from <b>${esc(String(r.team_name || '').trim())}</b> to</label>
        <select data-m="team" style="${FIELD};min-width:200px">
          <option value="">Choose a team…</option>
          ${choices.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
          <option value="${NEW}">New team…</option>
        </select>
        <input data-m="name" maxlength="80" placeholder="New team's name" hidden style="${FIELD};min-width:200px">
        <button type="button" class="pillbtn" data-m="next" style="min-height:40px;background:var(--blue);color:#fff">Move</button>
        <button type="button" class="pillbtn" data-m="cancel" style="min-height:40px;background:transparent;color:var(--muted)">Cancel</button>
      </div>
      <div data-step="confirm" hidden style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <span data-m="question" style="font-size:14px;color:var(--ink);font-weight:600"></span>
        <button type="button" class="pillbtn" data-m="yes" style="min-height:40px;background:var(--blue);color:#fff">Yes, move</button>
        <button type="button" class="pillbtn" data-m="back" style="min-height:40px;background:transparent;color:var(--muted)">Back</button>
      </div>
      <div data-m="msg" aria-live="polite" style="font-size:13px;margin-top:8px;color:var(--muted)"></div>
    </td>`;
    /* after the detail row, so an open "+" panel stays attached to its row */
    const detail = table.querySelector(`[data-detail="${r.id}"]`);
    (detail || anchorRow).insertAdjacentElement('afterend', tr);

    const $ = (k) => tr.querySelector(`[data-m="${k}"]`);
    const step = (s) => tr.querySelectorAll('[data-step]').forEach(d => { d.hidden = d.dataset.step !== s; d.style.display = d.hidden ? 'none' : 'flex'; });
    const say = (t, bad) => { $('msg').textContent = t || ''; $('msg').style.color = bad ? 'var(--red,#b42318)' : 'var(--muted)'; };
    const target = () => $('team').value === NEW ? $('name').value.trim() : $('team').value;
    step('pick');

    $('team').addEventListener('change', () => { const isNew = $('team').value === NEW; $('name').hidden = !isNew; if (isNew) $('name').focus(); say(''); });
    $('cancel').addEventListener('click', close);
    $('back').addEventListener('click', () => { step('pick'); say(''); });
    $('next').addEventListener('click', () => {
      const to = target();
      if (!to) { say($('team').value === NEW ? "Type the new team's name." : 'Choose a team first.', true); return; }
      if (teamKey(to) === teamKey(r.team_name)) { say(`${first(r.full_name)} is already on ${String(r.team_name || '').trim()}.`, true); return; }
      const isNew = $('team').value === NEW && !choices.some(n => teamKey(n) === teamKey(to));
      $('question').textContent = `Move ${r.full_name} from ${String(r.team_name || '').trim()} to ${isNew ? 'a new team, ' : ''}${to}?`;
      say(''); step('confirm'); $('yes').focus();
    });
    $('yes').addEventListener('click', async () => {
      const to = target();
      $('yes').disabled = true; $('yes').textContent = 'Moving…';
      let res, error;
      try { ({ data: res, error } = await sb.rpc('ea_opil_move_student', { p_reg: r.id, p_team: to })); }
      catch (e) { error = e; }
      $('yes').disabled = false; $('yes').textContent = 'Yes, move';
      if (error) { step('pick'); say('Could not move: ' + (error.message || 'try again') + '. Nothing changed.', true); return; }
      const from = r.team_name;
      r.team_name = res.to;
      /* keep the page's lists true so the next Move offers the right teams */
      if (res.old_removed && teams) { const i = teams.findIndex(t => !t.is_staff && teamKey(t.name) === teamKey(from)); if (i >= 0) teams.splice(i, 1); }
      if (teams && res.seated && !teams.some(t => teamKey(t.name) === teamKey(res.to))) teams.push({ name: res.to, is_staff: false });
      const cell = anchorRow.querySelector('td b'); if (cell) cell.textContent = res.to;
      tr.querySelector('td').innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><span style="font-size:13.5px;color:var(--emerald);font-weight:600">${esc(resultLine(res, r.full_name))}</span><button type="button" class="pillbtn" data-m="done" style="min-height:40px">Done</button></div>`;
      tr.querySelector('[data-m="done"]').addEventListener('click', close);
    });
  }

  table.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-move]'); if (!b) return;
    const r = regOf(b.dataset.move); if (!r) return;
    const already = table.querySelector(`tr.moverow[data-for="${r.id}"]`);
    if (already) { close(); return; }
    open(r, b.closest('tr'));
  });
}
