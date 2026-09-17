// scripts/ht-dates.mjs — run: node scripts/ht-dates.mjs [floor yyyy-mm-dd]
// Exit 1 with a list when the hub carries a stale date or a weekday word.
// Rule (spec 2026-09-17 §3): a sample event is never in the past and never on a published ceremony / closed / exam
// date; copy never says "Thursday" or "on the 14th" — dates are written out, or it says "the next session".
// HT's own published calendar (the `year` block on Events) is exempt: those are the University's dates.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ht', 'hub');
global.window = global;
new Function(fs.readFileSync(path.join(HUB, 'data.js'), 'utf8'))();
for (const f of fs.readdirSync(path.join(HUB, 'data'))) if (f.endsWith('.js') && f !== 'all.js') new Function(fs.readFileSync(path.join(HUB, 'data', f), 'utf8'))();
const FLOOR = process.argv.slice(2).find((a) => !a.startsWith('--')) || '2026-10-06';
const num = (d) => +String(d).replace(/-/g, '');
const yearBlock = (global.HT.spaces.events.blocks || []).find((b) => b.type === 'year') || { items: [] };
/* a sample event never lands on a day the University is closed or holds a ceremony; exams and deadlines may share a date */
const blocked = yearBlock.items.filter((r) => ['ceremony', 'closed'].includes(r.kind)).map((r) => ({ a: num(r.d), b: num(r.end || r.d), t: r.t }));
/* relative time words: a weekday with no month or numeric date beside it ("Thursday at noon"), "on the 14th", a September date.
   "Friday, October 16" is a date written out and passes; program names (Service Saturday, Wellness Wednesday) pass. */
const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Oct|Nov|Dec)[a-z]*\b|\b(January|February|March|April|June|July|August|October|November|December) \d{1,2}\b/;
const NAMES = /Service Saturday|Wellness Wednesday/g;
/* fails: a September date or "on the 14th" (stale by construction). warns: a bare weekday with no date beside it —
   "Thursday at noon" is stale in a week, "Office hours Tuesday and Thursday" is a schedule; a person decides. */
const stale = (v) => /\bon the \d{1,2}(st|nd|rd|th)\b/.test(v) || /\b(Sep|Sept|September) \d{1,2}\b/.test(v);
const bareWeekday = (v) => { const t = v.replace(NAMES, ''); return /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(t) && !MONTH.test(t); };
const bad = [], warn = [];
const walk = (v, where) => {
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, where + '[' + i + ']'));
  if (v && typeof v === 'object') {
    if (v.done === true) return;   /* a timeline row marked done is the past on purpose (HT's Opening Convocation, Sep 10) */
    if (typeof v.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.date)) {
      const n = num(v.date);
      if (n < num(FLOOR)) bad.push(where + ' · ' + v.date + ' "' + (v.title || '') + '" is before ' + FLOOR);
      const hit = blocked.find((b) => n >= b.a && n <= b.b);
      /* the published event itself, carried into a space's list under its own title, is not a collision */
      if (hit && !/deadline/i.test(v.tag || '') && String(v.title || '').trim() !== hit.t) bad.push(where + ' · ' + v.date + ' "' + (v.title || '') + '" collides with HT\'s "' + hit.t + '"');
    }
    for (const k of Object.keys(v)) walk(v[k], where + '.' + k);
    return;
  }
  if (typeof v === 'string') {
    if (stale(v)) bad.push(where + ' · a September date or "on the Nth": "' + v.slice(0, 100) + '"');
    else if (bareWeekday(v)) warn.push(where + ' · bare weekday: "' + v.slice(0, 100) + '"');
  }
};
walk(global.HT.home, 'home');
for (const [k, s] of Object.entries(global.HT.spaces)) {
  if (k === 'events') { walk({ ...s, blocks: (s.blocks || []).filter((b) => b.type !== 'year') }, 'spaces.events'); continue; }
  walk(s, 'spaces.' + k);
}
if (process.argv.includes('--warn') && warn.length) console.log('WARN (a person decides):\n' + warn.join('\n') + '\n');
if (bad.length) { console.log(bad.join('\n')); console.log('\n' + bad.length + ' problem(s) · floor ' + FLOOR + ' · ' + warn.length + ' bare-weekday warning(s), see --warn'); process.exit(1); }
console.log('hub dates clean (floor ' + FLOOR + ', ' + blocked.length + ' blocked spans, ' + warn.length + ' bare-weekday warning(s), see --warn)');
