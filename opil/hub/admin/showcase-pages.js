/* The coordinator's "Team pages" card (spec 2026-09-16-class-features-design.md §10): every real team, whether
   its showcase page is live or a draft, what is still missing, a link to see it, and a two-tap Publish / Take down.
   mount(sb, el) — the program team only (the RPC ea_opil_team_publish enforces it). Import-safe in Node. */
const V = new URL(import.meta.url).search;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const href = '/css/rtk-showcase.css' + V;
  if (document.querySelector('link[href="' + href + '"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}

export async function mount(sb, el) {
  if (!el) return null;
  ensureCss();
  const H = await import('/js/rtk-showcase.js' + V);
  let teams = [];
  const armTimers = new Map();   /* one relax timer per team id — arming one row never leaves another row armed */
  async function load() {
    const { data, error } = await sb.from('ea_opil_teams').select('id, name, school, slug, tagline, project, prototype_url, video_url, cover_path, published, published_at, is_staff').order('name');
    if (error) throw error;
    teams = (data || []).filter(t => !t.is_staff);
  }
  function paint() {
    if (!teams.length) { el.innerHTML = '<div class="empty">No teams yet. Pages appear here as teams form.</div>'; return; }
    const live = teams.filter(t => t.published).length;
    el.innerHTML = `<p class="sc-ed-hint" style="margin:0 0 12px">${live ? `${live} of ${teams.length} team page${teams.length === 1 ? '' : 's'} ${live === 1 ? 'is' : 'are'} live.` : 'No team page is live yet.'} A team publishes from its own team page; you can publish or take down any page here.</p>
      <div class="st-files" style="display:grid;gap:0">${teams.map(t => `<div class="sc-ad-row" data-id="${esc(t.id)}" style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;min-height:56px;padding:10px 0;border-top:1px solid var(--hair-soft)">
        <div style="flex:1;min-width:200px"><b style="font-size:14px;color:var(--ink)">${esc(t.name)}</b><span style="display:block;font-size:12.5px;color:${t.published ? '#067a56' : 'var(--muted)'}">${t.published ? 'Live' : 'Draft'} · ${esc(H.readiness(t))}</span></div>
        ${t.published && t.slug ? `<a class="sc-ed-see" style="min-height:40px" href="${esc(H.showcasePath(t.slug))}" target="_blank" rel="noopener">See the page</a>` : ''}
        <button type="button" class="sc-ed-switch${t.published ? ' on' : ''}" style="min-height:40px" data-publish="${esc(t.id)}">${t.published ? 'Take down' : 'Publish'}</button>
      </div>`).join('')}</div>
      <div class="sc-ed-msg" data-msg aria-live="polite" style="margin-top:8px"></div>`;
    el.querySelectorAll('[data-publish]').forEach(b => b.addEventListener('click', () => flip(b, teams.find(t => t.id === b.dataset.publish))));
  }
  const say = (text, tone) => { const m = el.querySelector('[data-msg]'); if (!m) return; m.textContent = text || ''; m.className = 'sc-ed-msg' + (tone ? ' ' + tone : ''); };
  const relax = (b) => { clearTimeout(armTimers.get(b.dataset.publish)); armTimers.delete(b.dataset.publish); if (b.isConnected) { const t = teams.find(x => x.id === b.dataset.publish); b.dataset.armed = ''; b.textContent = t && t.published ? 'Take down' : 'Publish'; } };
  /* two taps per row: the first arms THAT row (every other armed row relaxes), four seconds later it relaxes on its own */
  async function flip(btn, t) {
    if (!t || btn.disabled) return;
    if (btn.dataset.armed !== '1') {
      el.querySelectorAll('[data-publish][data-armed="1"]').forEach(b => { if (b !== btn) relax(b); });
      btn.dataset.armed = '1'; btn.textContent = t.published ? 'Take it down? Tap again' : 'Make it public? Tap again';
      clearTimeout(armTimers.get(t.id)); armTimers.set(t.id, setTimeout(() => relax(btn), 4000));
      return;
    }
    clearTimeout(armTimers.get(t.id)); armTimers.delete(t.id); btn.dataset.armed = ''; btn.disabled = true;
    try {
      const { error } = await sb.rpc('ea_opil_team_publish', { p_team: t.id, p_on: !t.published });
      if (error) throw error;
      await load(); paint();
      say(t.published ? t.name + '’s page is down.' : t.name + '’s page is live at ' + H.showcaseUrl(t.slug || H.slugify(t.name), location.origin), 'ok');
    } catch (e) { console.warn('[showcase] publish', e); btn.disabled = false; say(H.saveError(e), 'bad'); }
  }
  try { await load(); paint(); } catch (e) { console.warn('[showcase] load', e); el.innerHTML = '<div class="empty">Could not load the team pages right now. Reload and try again.</div>'; }
  return { reload: async () => { try { await load(); paint(); } catch (e) { console.warn('[showcase] reload', e); } } };
}
