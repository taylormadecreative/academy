/* OPIL Lab Hub — shared runtime. Auth gate, team claim, helpers. */
export async function boot() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(window.BM_CONFIG.SUPABASE_URL, window.BM_CONFIG.SUPABASE_KEY);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('/login/?next=' + encodeURIComponent(location.pathname));
    return null;
  }
  const user = session.user;
  /* claim team from registration (idempotent) */
  let teamId = null;
  try {
    const { data } = await sb.rpc('ea_opil_claim_team');
    teamId = data || null;
  } catch (e) { /* not registered: hub still opens */ }
  let isAdmin = false, isJudge = false, facSessions = [];
  try {
    const { data: role } = await sb.rpc('ea_opil_my_role');
    if (role) { isAdmin = !!role.admin; isJudge = !!role.judge; facSessions = role.facilitator_sessions || []; }
  } catch (e) {}
  if (!isAdmin) { try { const { data } = await sb.from('ea_opil_admins').select('user_id').eq('user_id', user.id).maybeSingle(); isAdmin = !!data; } catch (e) {} }
  return { sb, user, teamId, isAdmin, isJudge, facSessions };
}

export async function names(sb, ids) {
  /* uid -> display name map from ea_profiles; falls back to 'Member' */
  const uniq = [...new Set(ids)].filter(Boolean);
  const map = {};
  if (!uniq.length) return map;
  try {
    const { data } = await sb.from('ea_profiles').select('user_id, display_name').in('user_id', uniq);
    (data || []).forEach((p) => { map[p.user_id] = p.display_name || 'Member'; });
  } catch (e) {}
  uniq.forEach((id) => { if (!map[id]) map[id] = 'Member'; });
  return map;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function when(ts) {
  const d = new Date(ts); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function tabs(active, isAdmin) {
  /* one consistent 5-tab strip on every hub page */
  const items = [
    ['Home', '/opil/hub/'], ['My team', '/opil/hub/team/'],
    ['Messages', '/opil/hub/messages/'], ['Showcase', '/opil/showcase/'],
  ];
  if (isAdmin) items.push(['Coordinator view', '/opil/hub/admin/']);
  const nav = document.querySelector('.hub-tabs');
  if (!nav) return;
  nav.innerHTML = items.map(([label, href]) =>
    `<a class="hub-tab${label === active ? ' on' : ''}" href="${href}">${label}</a>`).join('');
}
