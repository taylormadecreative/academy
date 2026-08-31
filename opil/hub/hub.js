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
  let isAdmin = false;
  try {
    const { data } = await sb.from('ea_opil_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    isAdmin = !!data;
  } catch (e) {}
  return { sb, user, teamId, isAdmin };
}

export async function names(sb, ids) {
  /* uid -> display name map from ea_profiles; falls back to 'Member' */
  const uniq = [...new Set(ids)].filter(Boolean);
  const map = {};
  if (!uniq.length) return map;
  try {
    const { data } = await sb.from('ea_profiles').select('id, display_name').in('id', uniq);
    (data || []).forEach((p) => { map[p.id] = p.display_name || 'Member'; });
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
