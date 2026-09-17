/* "Hide my card" — the switch on the hub's My team page (under the roster) that keeps a student's
   card out of the class room's People list (spec 2026-09-16-class-features-design.md §11; 0052 adds
   ea_profiles.hide_card). The room's roster RPC leaves a hidden person out, so classmates who tap the
   name see "keeps their card private" instead of school, team and project.
   Usage (team page, after the roster paints):
     import { mount as mountHideCard } from '/opil/hub/hide-card.js?v=…';
     mountHideCard(sb, { user, container: document.getElementById('roster') });
   Pure copy is exported for tests. Import-safe in Node. */

export function switchCopy(hidden) {
  return hidden
    ? 'In class, people who tap your name see only that you keep it private.'
    : 'Classmates who tap your name in class see your school, team and what you’re building.';
}
export const SAVE_OK = (hidden) => hidden ? 'Your card is hidden now.' : 'Your card is showing again.';
export const SAVE_FAIL = 'Could not save that. Check your connection and try again.';

export function mount(sb, { user, container } = {}) {
  if (!sb || !user || !container) return null;
  const wrap = document.createElement('div');
  wrap.className = 'hide-card';
  wrap.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:14px 0 4px;margin-top:6px;border-top:1px solid var(--hair, #e6e9f2)';
  wrap.innerHTML = `<label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;min-height:48px">
      <input type="checkbox" class="hide-card-switch" style="width:22px;height:22px;margin:2px 0 0;accent-color:#04123a;flex:none">
      <span><b style="display:block;font-size:14px;color:var(--ink, #04123a)">Hide my card in class</b><span class="hide-card-line" style="display:block;font-size:12.5px;color:var(--muted, #6b7590);line-height:1.45;margin-top:2px">Loading…</span></span>
    </label>`;
  /* inside the roster card's padded body (the roster's rows are painted once, before this runs), so the
     switch lines up with the rows above it instead of sitting flush against the card's edge */
  container.appendChild(wrap);
  const box = wrap.querySelector('.hide-card-switch'), line = wrap.querySelector('.hide-card-line');
  let hidden = false;
  const paint = () => { box.checked = hidden; line.textContent = (hidden ? 'Your card is hidden. ' : '') + switchCopy(hidden); };
  (async () => {
    try {
      const { data, error } = await sb.from('ea_profiles').select('hide_card').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      hidden = !!(data && data.hide_card);
    } catch (e) { console.warn('[hide-card] read', e); hidden = false; }
    paint();
  })();
  box.addEventListener('change', async () => {
    const want = box.checked; box.disabled = true; line.textContent = 'Saving…';
    try {
      const { error } = await sb.from('ea_profiles').upsert({ user_id: user.id, hide_card: want, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      hidden = want; paint(); line.textContent = SAVE_OK(hidden) + ' ' + switchCopy(hidden);
    } catch (e) { console.warn('[hide-card] save', e); paint(); line.textContent = SAVE_FAIL; }
    box.disabled = false;
  });
  return wrap;
}
