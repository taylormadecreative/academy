/* The gold "Open team room" block on the team page (spec 2026-09-16-class-features-design.md §3).
   One call from opil/hub/team/index.html (before = the first card in the LEFT column, so the block
   lands above Team chat; a `before` that is a grid column itself is handled: the block goes inside
   it, at the top — never as a grid child of .hub-grid, which would push the chat into the sidebar):
     import { mount as mountRoomBlock } from '/opil/hub/team/room-block.js?v=…';
     mountRoomBlock(sb, { teamId, user, team, names, before: document.querySelector('.hub-grid > div > .hcard') });
   It says who is in the room now (ea_class_presence rows for team:<id>, fresh within 90 s), refreshes
   every 20 s, and links to the room page. Nothing here can break the team page: every read is
   guarded, and a missing presence table (0043 not applied yet) simply reads "No one is in the room". */
/* the words ride this module's own ?v= (sw.js is cache-first on every script: a bare import would go stale) */
const { roomKeyFor, inRoomNow, teammatesLine } = await import('../../../js/rtk-teamroom-words.js' + new URL(import.meta.url).search);

export const ROOM_PATH = '/opil/hub/team/room/';
export const REFRESH_MS = 20000;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cssIn = false;
function ensureCss() {
  if (cssIn) return; cssIn = true;
  try {
    if (document.querySelector('link[href^="/css/rtk-teamroom.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/rtk-teamroom.css' + new URL(import.meta.url).search; document.head.appendChild(l);
  } catch (e) { console.warn('[teamroom] css', e); }
}

/* the link to the room: a member's own team needs no id; a coordinator opening a student team's room names it */
export const roomHref = (teamId, withId) => ROOM_PATH + (withId && teamId ? '?t=' + encodeURIComponent(teamId) : '');

/* where the block goes: before `before` when that sits inside a column; at the top of `before` when
   `before` IS a column of .hub-grid (grid-template-columns: 1fr 340px — a new grid child would take
   column 1 and shove the chat into the 340 px sidebar); else the top of the first column / main / body */
export function placeBlock(el, before) {
  const doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const parent = before && before.parentElement;
  if (parent && parent.classList && parent.classList.contains('hub-grid')) { before.insertBefore(el, before.firstChild); return 'inside'; }
  if (parent) { parent.insertBefore(el, before); return 'before'; }
  const host = doc && (doc.querySelector('.hub-grid > div') || doc.querySelector('main') || doc.body);
  if (!host) return 'nowhere';
  host.insertBefore(el, host.firstChild); return 'top';
}

export function mount(sb, { teamId, user, team, names, before, withId } = {}) {
  if (!teamId || typeof document === 'undefined') return { stop() {}, refresh: async () => {} };
  ensureCss();
  const key = roomKeyFor({ kind: 'team', id: teamId });
  const uid = user && user.id;
  const el = document.createElement('section');
  el.className = 'tm-block';
  el.setAttribute('aria-label', 'Team room');
  el.innerHTML = `<span class="tm-k">Your team room</span>
    <h2>Meet on camera, whenever you want.</h2>
    <p class="tm-line" role="status"><i></i><span>Checking who’s there…</span></p>
    <div class="tm-who" hidden></div>
    <div class="tm-acts"><a class="tm-go" href="${esc(roomHref(teamId, withId))}">Open team room <span aria-hidden="true">→</span></a></div>
    <p class="tm-fine">It opens the moment the first teammate walks in and stays open all year. Chat, share your screen, show files. Not recorded. Files you share in the room are listed for your team and the program team.</p>`;
  placeBlock(el, before);

  const line = el.querySelector('.tm-line'), lineTxt = line.querySelector('span'), who = el.querySelector('.tm-who');
  const nameCache = new Map();
  async function resolve(ids) {
    const need = [...new Set(ids)].filter(id => !nameCache.has(id));
    if (!need.length) return;
    try {
      if (typeof names === 'function') { const map = await names(sb, need); need.forEach(id => nameCache.set(id, map[id] || 'A teammate')); return; }
      const { data } = await sb.from('ea_profiles').select('user_id, display_name').in('user_id', need);
      need.forEach(id => { const r = (data || []).find(x => x.user_id === id); nameCache.set(id, (r && r.display_name) || 'A teammate'); });
    } catch (e) { need.forEach(id => nameCache.set(id, 'A teammate')); }
  }
  let timer = null, stopped = false;
  async function refresh() {
    if (stopped) return;
    let rows = [];
    try {
      const { data, error } = await sb.from('ea_class_presence').select('user_id, state, last_seen').eq('room_key', key);
      if (error) { console.warn('[teamroom] presence', error.message); }
      rows = data || [];
    } catch (e) { console.warn('[teamroom] presence', e); rows = []; }
    const here = inRoomNow(rows).filter(r => r.user_id !== uid);
    lineTxt.textContent = teammatesLine(here.length);
    line.classList.toggle('on', here.length > 0);
    if (here.length) {
      await resolve(here.map(r => r.user_id));
      who.innerHTML = here.map(r => `<span>${esc(nameCache.get(r.user_id) || 'A teammate')}</span>`).join('');
      who.hidden = false;
    } else { who.hidden = true; who.innerHTML = ''; }
  }
  const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
  refresh();
  timer = setInterval(refresh, REFRESH_MS);
  try { document.addEventListener('visibilitychange', onVis); } catch (e) {}
  return {
    el, refresh,
    stop() { stopped = true; clearInterval(timer); try { document.removeEventListener('visibilitychange', onVis); } catch (e) {} },
  };
}
