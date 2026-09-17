/* The team page's "Our showcase page" card (spec 2026-09-16-class-features-design.md §10).
   mount(sb, teamId, el, { isAdmin? }) draws: tagline, what you built, the prototype link, the pitch video link,
   Save (the one gold action), the Publish our page switch (two taps), and a "See our page" link once it is live.
   The program team (coordinator, facilitators, judges) also gets the cover picture upload — the picture goes
   to the public "content" bucket under opil/teams/<slug>/. Words are saved through ea_opil_team_update; the
   switch is ea_opil_team_publish (migration 0051). Every state is a sentence; raw errors go to console.warn.
   The form is painted ONCE per load: publishing and a cover upload update the state line, the switch, the
   "See our page" link and the cover in place, so words typed but not yet saved are never thrown away — and
   Publish saves any changed words first, so the live page is what the team sees in the form.
   Import-safe in Node (nothing touches the document until mount). */
const V = new URL(import.meta.url).search;
const helpers = () => import('/js/rtk-showcase.js' + V);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const href = '/css/rtk-showcase.css' + V;
  if (document.querySelector('link[href="' + href + '"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}
const supabaseUrl = () => { try { return (window.BM_CONFIG && window.BM_CONFIG.SUPABASE_URL) || ''; } catch (e) { return ''; } };

export async function mount(sb, teamId, el, opts = {}) {
  if (!el || !teamId) return null;
  ensureCss();
  const H = await helpers();
  /* the cover upload is the program team's (admin, facilitator, judge) — the same rule the RPC enforces */
  let canCover = opts.isAdmin;
  if (canCover == null) { try { const { data } = await sb.rpc('ea_opil_my_role'); canCover = !!(data && (data.admin || data.judge || (data.facilitator_sessions || []).length)); } catch (e) { canCover = false; } }
  let team = null, armTimer = null;
  const origin = (typeof location !== 'undefined' && location.origin) || undefined;

  async function load() {
    const { data, error } = await sb.from('ea_opil_teams').select('id, name, school, slug, tagline, project, prototype_url, video_url, cover_path, published, published_at, is_staff').eq('id', teamId).maybeSingle();
    if (error) throw error;
    team = data;
  }
  function paint() {
    if (!team) { el.innerHTML = '<div class="empty">Could not load your page. Reload and try again.</div>'; return; }
    const cover = H.coverUrl(supabaseUrl(), team.cover_path);
    el.innerHTML = `<div class="hcard" id="showcase-card">
      <div class="hd2"><h2>Our showcase page</h2></div>
      <div class="bd"><form class="sc-ed" novalidate>
        <p class="sc-ed-state${team.published ? ' on' : ''}" data-state>${stateHTML()}</p>
        <label>Tagline <span>One line under your team name · up to ${H.TAGLINE_MAX} characters</span>
          <input type="text" name="tagline" maxlength="${H.TAGLINE_MAX}" placeholder="Open payments for the corner store" value="${esc(team.tagline || '')}"></label>
        <label>What you built <span>The problem, the prototype, who it is for. A blank line starts a new paragraph.</span>
          <textarea name="project" maxlength="${H.PROJECT_MAX}" placeholder="We built…">${esc(team.project || '')}</textarea></label>
        <label>Prototype link <span>Where someone can try it or see the code</span>
          <input type="url" name="prototype_url" placeholder="https://" value="${esc(team.prototype_url || '')}">
          <p class="sc-ed-hint" data-hint="prototype_url"></p></label>
        <label>Pitch video link <span>YouTube, Vimeo or Cloudflare Stream</span>
          <input type="url" name="video_url" placeholder="https://" value="${esc(team.video_url || '')}">
          <p class="sc-ed-hint" data-hint="video_url">${esc(H.videoWord(team.video_url))}</p></label>
        ${canCover ? `<div class="sc-ed-cover"><label>Cover picture <span>Program team only · PNG, JPG or WebP · up to 10 MB · shows across the top of the page</span>
          <input type="file" name="cover" accept="image/png,image/jpeg,image/webp"></label>
          ${cover ? `<img src="${esc(cover)}" alt="The team's cover picture">` : ''}<p class="sc-ed-hint" data-hint="cover"></p></div>` : (cover ? `<div class="sc-ed-cover"><img src="${esc(cover)}" alt="The team's cover picture"><p class="sc-ed-hint">Your cover picture. Ask the coordinator to change it.</p></div>` : '')}
        <div class="sc-ed-row">
          <button type="submit" class="sc-ed-save">Save</button>
          <button type="button" class="sc-ed-switch${team.published ? ' on' : ''}" data-publish ${team.is_staff ? 'disabled' : ''}>${esc(H.publishLabel(team.published))}</button>
          ${seeLinkHTML()}
        </div>
        <div class="sc-ed-msg" data-msg aria-live="polite"></div>
      </form></div></div>`;
    wire();
  }
  function stateHTML() {
    if (team.published && team.slug) return 'Your page is live at <a href="' + esc(H.showcasePath(team.slug)) + '" target="_blank" rel="noopener">' + esc(H.showcaseUrl(team.slug, origin)) + '</a> — anyone with the link can see it. ' + esc(H.readiness(team));
    return esc(H.publishWord(team, origin)) + ' ' + esc(H.readiness(team));
  }
  const seeLinkHTML = () => (team.published && team.slug) ? `<a class="sc-ed-see" href="${esc(H.showcasePath(team.slug))}" target="_blank" rel="noopener">See our page</a>` : '';
  const q = (s) => el.querySelector(s);
  /* the parts that reflect `team`, refreshed in place — the inputs are never touched */
  function syncState() {
    const st = q('[data-state]'); if (st) { st.innerHTML = stateHTML(); st.className = 'sc-ed-state' + (team.published ? ' on' : ''); }
    const sw = q('[data-publish]'); if (sw) { sw.textContent = H.publishLabel(team.published); sw.className = 'sc-ed-switch' + (team.published ? ' on' : ''); sw.dataset.armed = ''; }
    const old = q('.sc-ed-see'); if (old) old.remove();
    const row = q('.sc-ed-row'); if (row && seeLinkHTML()) row.insertAdjacentHTML('beforeend', seeLinkHTML());
  }
  function syncCover() {
    const box = q('.sc-ed-cover'); if (!box) return;
    const src = H.coverUrl(supabaseUrl(), team.cover_path); if (!src) return;
    let img = box.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = "The team's cover picture"; const hint = box.querySelector('[data-hint="cover"]'); hint ? box.insertBefore(img, hint) : box.appendChild(img); }
    img.src = src;
  }
  /* the form's words as the RPC wants them */
  const values = () => ({ tagline: q('[name="tagline"]').value, project: q('[name="project"]').value, prototype_url: q('[name="prototype_url"]').value.trim(), video_url: q('[name="video_url"]').value.trim() });
  const say = (text, tone) => { const m = q('[data-msg]'); if (!m) return; m.textContent = text || ''; m.className = 'sc-ed-msg' + (tone ? ' ' + tone : ''); };
  function wire() {
    const form = q('form');
    form.addEventListener('submit', (ev) => { ev.preventDefault(); save(); });
    const proto = q('[name="prototype_url"]'), video = q('[name="video_url"]');
    const check = () => {
      const hp = q('[data-hint="prototype_url"]'), hv = q('[data-hint="video_url"]');
      const p1 = H.urlProblem(proto.value); hp.textContent = p1 || (proto.value.trim() ? 'Shows as a “Try the prototype” button.' : ''); hp.className = 'sc-ed-hint' + (p1 ? ' bad' : '');
      const p2 = H.urlProblem(video.value); hv.textContent = p2 || H.videoWord(video.value); hv.className = 'sc-ed-hint' + (p2 ? ' bad' : (H.embedFor(video.value) ? ' ok' : ''));
    };
    proto.addEventListener('input', check); video.addEventListener('input', check);
    q('[data-publish]').addEventListener('click', (ev) => publish(ev.currentTarget));
    const cover = q('[name="cover"]'); if (cover) cover.addEventListener('change', () => { const f = cover.files && cover.files[0]; cover.value = ''; if (f) uploadCover(f); });
  }
  /* returns true when the words are saved (or nothing had changed); says why when they are not */
  async function save(quiet) {
    const btn = q('.sc-ed-save');
    const patch = values();
    const bad = H.urlProblem(patch.prototype_url) || H.urlProblem(patch.video_url);
    if (bad) { say(bad, 'bad'); return false; }
    btn.disabled = true; if (!quiet) say('Saving…');
    try {
      const { data, error } = await sb.rpc('ea_opil_team_update', { p_team: teamId, p_patch: patch });
      if (error) throw error;
      team = Object.assign({}, team, data || patch);
      if (!quiet) say(team.published ? 'Saved — your live page is updated.' : 'Saved. ' + H.readiness(team), 'ok');
      syncState();
      return true;
    } catch (e) { console.warn('[showcase] save', e); say(H.saveError(e), 'bad'); return false; }
    finally { btn.disabled = false; }
  }
  /* two taps: the first arms the switch and says what the second does; four seconds later it relaxes.
     Publishing saves any changed words first — the page that goes live is the one in the form. */
  async function publish(btn) {
    if (btn.disabled) return;
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = H.publishAgain(team.published);
      clearTimeout(armTimer); armTimer = setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = H.publishLabel(team.published); } }, 4000);
      return;
    }
    clearTimeout(armTimer); btn.dataset.armed = ''; btn.disabled = true;
    const on = !team.published;
    try {
      if (on && H.changedFields(team, values()).length) {
        say('Saving your words first…');
        if (!await save(true)) { btn.textContent = H.publishLabel(team.published); btn.disabled = false; return; }   /* save() said why */
      }
      say(on ? 'Publishing…' : 'Taking it down…');
      const { data, error } = await sb.rpc('ea_opil_team_publish', { p_team: teamId, p_on: on });
      if (error) throw error;
      team = Object.assign({}, team, data || { published: on });
      syncState();
      say(on ? 'Your page is live. Share the link with anyone.' : 'Your page is down. Only people in the lab can see the draft now.', 'ok');
    } catch (e) { console.warn('[showcase] publish', e); btn.textContent = H.publishLabel(team.published); say(H.saveError(e), 'bad'); }
    finally { btn.disabled = false; }
  }
  async function uploadCover(file) {
    const hint = q('[data-hint="cover"]');
    const why = H.coverRefusal(file); if (why) { hint.textContent = why; hint.className = 'sc-ed-hint bad'; return; }
    const slug = team.slug || H.slugify(team.name);
    const path = H.coverPath(slug, file.name);
    hint.textContent = 'Uploading ' + file.name + '…'; hint.className = 'sc-ed-hint';
    try {
      const up = await sb.storage.from(H.COVER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { data, error } = await sb.rpc('ea_opil_team_update', { p_team: teamId, p_patch: { cover_path: path } });
      if (error) { try { await sb.storage.from(H.COVER_BUCKET).remove([path]); } catch (e) {} throw error; }
      team = Object.assign({}, team, data || { cover_path: path });
      syncCover(); hint.textContent = ''; hint.className = 'sc-ed-hint'; say('Cover picture saved.', 'ok');
    } catch (e) {
      console.warn('[showcase] cover', e);
      hint.textContent = 'Could not upload that picture. Check your connection and try again.'; hint.className = 'sc-ed-hint bad';
    }
  }

  try { await load(); } catch (e) { console.warn('[showcase] load', e); team = null; }
  paint();
  return { reload: async () => { try { await load(); paint(); } catch (e) { console.warn('[showcase] reload', e); } }, get team() { return team; } };
}
