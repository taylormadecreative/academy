/* Attendance that takes itself — class plugin (spec 2026-09-16-class-features-design.md §1).
   The room beats `ea_class_presence_beat(roomKey, state)` on join, every 30 s, and on the way out;
   the waiting screen beats 'waiting'. Nothing to tap, nothing to read out: at ten minutes in an OPIL
   session the server also writes the check-in row the reports already use. The coordinator page reads
   `ea_class_attendance_rows(roomKey)` and exports a CSV. Pure decisions (minutes, the rows, the CSV)
   are exported for tests. Import-safe in Node. */
export const BEAT_MS = 30000;
export const AUTO_MARK_SECONDS = 600;

/* one beat; never throws — attendance must never break the class */
export async function beat(sb, roomKey, state, device) {
  try { const { data, error } = await sb.rpc('ea_class_presence_beat', { p_key: roomKey, p_state: state || 'in', p_device: device || null }); if (error) console.warn('[presence]', error.message); return data || null; }
  catch (e) { console.warn('[presence]', e); return null; }
}
/* what this browser is, in one word, for the coordinator's table */
export function deviceWord(ua) {
  const s = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(s)) return 'iPhone';
  if (/Android/i.test(s)) return 'Android';
  if (/Macintosh/i.test(s)) return 'Mac';
  if (/Windows/i.test(s)) return 'Windows';
  return 'browser';
}
/* a steady beat while the page is open: start now, every 30 s, once more when the tab hides */
export function startBeating(sb, roomKey, state, device) {
  let timer = null, stopped = false;
  const tick = () => { if (!stopped) beat(sb, roomKey, state, device); };
  tick(); timer = setInterval(tick, BEAT_MS);
  const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') tick(); };
  try { document.addEventListener('visibilitychange', onVis); } catch (e) {}
  return { setState(s) { state = s; tick(); }, stop(finalState) { if (stopped) return; stopped = true; clearInterval(timer); try { document.removeEventListener('visibilitychange', onVis); } catch (e) {} if (finalState) { stopped = false; beat(sb, roomKey, finalState, device); stopped = true; } } };
}

/* ---- the coordinator's numbers ---- */
export function minutesWord(seconds) {
  const m = Math.round((Number(seconds) || 0) / 60);
  return m === 1 ? '1 minute' : m + ' minutes';
}
/* rows for the table: name, school, team, in at, last seen, minutes, waited, present (≥ 10 min) */
export function attendanceRows(rows, { zone } = {}) {
  const opts = { hour: 'numeric', minute: '2-digit' }; if (zone) opts.timeZone = zone;
  const t = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', opts) : '';
  return (rows || []).map(r => ({
    user_id: r.user_id, name: r.name || 'Someone', school: r.school || '', team: r.team || '',
    inAt: t(r.first_seen), lastSeen: t(r.last_seen),
    minutes: Math.round((Number(r.seconds) || 0) / 60), waited: Math.round((Number(r.waited_s) || 0) / 60),
    present: (Number(r.seconds) || 0) >= AUTO_MARK_SECONDS, stillIn: r.state === 'in',
  })).sort((a, b) => a.name.localeCompare(b.name));
}
/* the summary line under a session: "24 present · 3 dropped in under 10 min · 2 waited but never entered" */
export function attendanceSummary(rows) {
  const list = attendanceRows(rows);
  const present = list.filter(r => r.present).length;
  const brief = list.filter(r => !r.present && r.minutes > 0).length;
  const waitedOnly = list.filter(r => !r.present && r.minutes === 0 && r.waited > 0).length;
  const parts = [present + ' present'];
  if (brief) parts.push(brief + (brief === 1 ? ' dropped in under 10 min' : ' dropped in under 10 min'));
  if (waitedOnly) parts.push(waitedOnly + ' waited but never entered');
  return list.length ? parts.join(' · ') : 'No one yet';
}
/* CSV cells: a quote wraps anything with a comma, quote or newline; a leading = + - @ or tab is prefixed
   with a quote so a spreadsheet never runs it as a formula — a plain signed number is left alone
   (the repo's gotcha: the guard must not eat -5) */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function attendanceCSV(rows, { title, zone } = {}) {
  const head = ['Name', 'School', 'Team', 'In at', 'Last seen', 'Minutes in class', 'Minutes waited', 'Present (10+ min)'];
  const lines = [head.map(csvCell).join(',')];
  attendanceRows(rows, { zone }).forEach(r => lines.push([r.name, r.school, r.team, r.inAt, r.lastSeen, r.minutes, r.waited, r.present ? 'yes' : 'no'].map(csvCell).join(',')));
  return (title ? csvCell(title) + '\n' : '') + lines.join('\n') + '\n';
}

/* ---- the plugin ---- */
export function create(ctx) {
  let beater = null;
  const device = deviceWord(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return {
    start() {
      try {
        beater = startBeating(ctx.sb, ctx.roomKey, 'in', device);
        ctx.on('left', () => { if (beater) beater.stop('out'); beater = null; });
        ctx.on('ended', () => { if (beater) beater.stop('out'); beater = null; });
      } catch (e) { console.warn('[presence] start', e); }
    },
    stop() { if (beater) beater.stop('out'); beater = null; },
  };
}
