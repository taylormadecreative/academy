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

const ICON = {
  home: '<path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2"/><path d="M16 13.8A4.4 4.4 0 0 1 20.5 18"/>',
  messages: '<path d="M4 5h16v11H9l-4 3z"/>',
  showcase: '<path d="M12 3.5l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z"/>',
  admin: '<path d="M3.5 6.5h17"/><path d="M3.5 12h17"/><path d="M3.5 17.5h17"/><circle cx="8" cy="6.5" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="10" cy="17.5" r="1.6"/>',
  judge: '<path d="M12 4v16"/><path d="M6 8h12"/><path d="M4.5 8 2.5 13h4z"/><path d="M19.5 8 17.5 13h4z"/><path d="M8 20h8"/>'
};

/* The four surfaces every member of the Lab has, in the order they matter. */
const STUDENT = [
  ['home', 'Home', '/opil/hub/'],
  ['team', 'My team', '/opil/hub/team/'],
  ['messages', 'Messages', '/opil/hub/messages/'],
  ['showcase', 'Showcase', '/opil/showcase/']
];

/* Role views, only for the people who hold that role. A facilitator lands on the
   same page as a coordinator but sees only their own sessions, so it is labelled
   for what they will actually find there. */
function teamLinks(ctx) {
  const out = [];
  if (ctx.isAdmin) out.push(['admin', 'Coordinator', '/opil/hub/admin/']);
  else if ((ctx.facSessions || []).length) out.push(['admin', 'My sessions', '/opil/hub/admin/']);
  if (ctx.isJudge) out.push(['judge', 'Judging', '/opil/hub/judge/']);
  return out;
}

function svg(key) {
  return '<svg class="ln-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[key] + '</svg>';
}

/* One navigation for every Lab page. Desktop: student surfaces on the left, the
   role views set apart on the right. Mobile: student surfaces move to a thumb-reachable
   bottom bar, role views stay a row under the title. Nothing hides behind a menu. */
export function nav(ctx, active) {
  const team = teamLinks(ctx);
  const onTeamPage = team.some(([k]) => k === active);

  let mount = document.querySelector('.hub-tabs');
  if (!mount) {
    mount = document.createElement('div');
    const head = document.querySelector('.hub-head');
    if (head && head.parentNode) head.parentNode.insertBefore(mount, head.nextSibling);
    else (document.querySelector('.hub-wrap') || document.body).prepend(mount);
  }
  mount.className = 'labnav';
  mount.removeAttribute('id');

  const tab = ([key, label, href]) =>
    '<a class="ln-tab' + (key === active ? ' on' : '') + '" href="' + href + '"'
    + (key === active ? ' aria-current="page"' : '') + '>' + svg(key) + '<span>' + esc(label) + '</span></a>';

  const role = ([key, label, href]) =>
    '<a class="ln-role' + (key === active ? ' on' : '') + '" href="' + href + '"'
    + (key === active ? ' aria-current="page"' : '') + '>' + svg(key) + '<span>' + esc(label) + '</span></a>';

  mount.innerHTML =
    '<nav class="ln-bar" aria-label="Lab sections">'
    + '<div class="ln-primary">' + STUDENT.map(tab).join('') + '</div>'
    + (team.length
        ? '<div class="ln-team"><span class="ln-team-lbl">Program team</span>' + team.map(role).join('') + '</div>'
        : '')
    + '</nav>';

  /* Bottom bar, mobile only. Same four surfaces, thumb height, never more than four. */
  document.querySelector('.ln-dock')?.remove();
  const dock = document.createElement('nav');
  dock.className = 'ln-dock';
  dock.setAttribute('aria-label', 'Lab sections');
  dock.innerHTML = STUDENT.map(([key, label, href]) =>
    '<a class="ln-dock-a' + (key === active ? ' on' : '') + '" href="' + href + '"'
    + (key === active ? ' aria-current="page"' : '') + '>' + svg(key) + '<span>' + esc(label) + '</span></a>').join('');
  document.body.appendChild(dock);
  document.body.classList.add('has-dock');

  /* A coordinator or judge standing in a student surface should know it, and get
     back in one tap. This is the whole point: look at what the cohort sees, then leave. */
  document.querySelector('.ln-ctx')?.remove();
  if (team.length && !onTeamPage) {
    const [, label, href] = team[0];
    const band = document.createElement('div');
    band.className = 'ln-ctx';
    band.innerHTML = '<span>Student view. This is what the cohort sees.</span>'
      + '<a href="' + href + '">Back to ' + esc(label) + '</a>';
    mount.parentNode.insertBefore(band, mount.nextSibling);
  }
}

/* Older call sites passed (activeLabel, isAdmin). Keep them working. */
export function tabs(active, isAdmin) {
  const map = { 'Home': 'home', 'My team': 'team', 'Messages': 'messages',
                'Showcase': 'showcase', 'Coordinator view': 'admin', 'Judging': 'judge' };
  nav({ isAdmin: !!isAdmin, isJudge: false, facSessions: [] }, map[active] || '');
}
