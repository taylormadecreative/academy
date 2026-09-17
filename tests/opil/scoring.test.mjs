// node --test tests/opil/scoring.test.mjs — judge scoring + leaderboard: the pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RUBRIC, normalizeRubric, rubricMax, rubricTotal, missingRows, totalLine, leaderboard, judgesWord, presentingLine, savedLine, errorLine, csvCell, csvRows, scoresCSV, leaderboardCSV, create } from '../../js/rtk-scoring.js';
import { scoresSummary, rubricFromFields, readError, mount } from '../../opil/hub/admin/scores.js';

const rubric = DEFAULT_RUBRIC;
const rows = [
  { id: '1', team_id: 't1', team: 'The Rattlers', school: 'FAMU', judge_id: 'j1', judge: 'Ada', scores: { problem: 5, solution: 4, open_payments: 5, business: 4, delivery: 5 }, comment: 'Clear pitch, strong demo', total: 23, updated_at: '2026-09-16T23:10:00Z' },
  { id: '2', team_id: 't1', team: 'The Rattlers', school: 'FAMU', judge_id: 'j2', judge: 'Ben', scores: { problem: 4, solution: 4, open_payments: 4, business: 3, delivery: 4 }, comment: null, total: 19, updated_at: '2026-09-16T23:12:00Z' },
  { id: '3', team_id: 't2', team: 'Tech Mongers', school: 'Livingstone', judge_id: 'j1', judge: 'Ada', scores: { problem: 3, solution: 5, open_payments: 4, business: 5, delivery: 4 }, comment: '=SUM(A1) is not a comment, "quoted", and, commas', total: 21, updated_at: '2026-09-16T23:20:00Z' },
  { id: '4', team_id: 't3', team: 'Aggies Pay', school: 'NC A&T', judge_id: 'j2', judge: 'Ben', scores: { problem: 4, solution: 4, open_payments: 5, business: 4, delivery: 4 }, comment: '-5 degrees outside', total: 21, updated_at: '2026-09-16T23:25:00Z' },
];

test('normalizeRubric: null → the standard five; a JSON string works; keys fall out of labels; max is clamped 1–10', () => {
  assert.deepEqual(normalizeRubric(null), DEFAULT_RUBRIC);
  assert.deepEqual(normalizeRubric('[]'), DEFAULT_RUBRIC);
  assert.deepEqual(normalizeRubric('not json'), DEFAULT_RUBRIC);
  const r = normalizeRubric([{ label: 'Team Work!', max: 3 }, { label: 'Wow', max: 99 }, { label: 'Zero', max: 0 }, { label: '' }, { key: 'x', label: 'X' }, { key: 'x', label: 'X again' }]);
  assert.deepEqual(r.map(x => x.key), ['team_work', 'wow', 'zero', 'x', 'x_']);
  assert.deepEqual(r.map(x => x.max), [3, 10, 5, 5, 5]);
  assert.equal(rubricMax(rubric), 25); assert.equal(rubricMax(r), 28);
});

test('rubricTotal: sums the known rows, clamps to 1..max, ignores unknown keys, counts a missing row as 0', () => {
  assert.equal(rubricTotal({ problem: 5, solution: 4, open_payments: 5, business: 4, delivery: 5 }, rubric), 23);
  assert.equal(rubricTotal({ problem: 9, solution: -2, bogus: 5 }, rubric), 5);   /* 9 → 5, -2 → nothing, bogus ignored */
  assert.equal(rubricTotal({ problem: '3', solution: 2.6 }, rubric), 6);   /* strings and decimals round */
  assert.equal(rubricTotal(null, rubric), 0);
  assert.equal(rubricTotal({ a: 2 }, [{ label: 'A', max: 3 }]), 2);
});

test('missingRows + totalLine read like the judge would', () => {
  assert.deepEqual(missingRows({ problem: 5 }, rubric), ['Solution', 'Open-payments use', 'Business model', 'Delivery']);
  assert.equal(totalLine({}, rubric), 'Tap a number on each row');
  assert.equal(totalLine({ problem: 5, solution: 4, open_payments: 5, business: 4 }, rubric), '18 of 25 · Delivery not scored yet');
  assert.equal(totalLine({ problem: 5, solution: 4 }, rubric), '9 of 25 · 3 rows not scored yet');
  assert.equal(totalLine({ problem: 5, solution: 4, open_payments: 5, business: 4, delivery: 5 }, rubric), '23 of 25');
});

test('leaderboard: average per team, judge count, ties share a rank then more judges wins, per-row averages', () => {
  const lb = leaderboard(rows, rubric);
  assert.deepEqual(lb.map(t => [t.rank, t.name, t.judges, t.avg]), [[1, 'The Rattlers', 2, 21], [1, 'Aggies Pay', 1, 21], [1, 'Tech Mongers', 1, 21]]);
  assert.equal(lb[0].best, 23);
  assert.equal(lb[0].perKey.problem, 4.5); assert.equal(lb[0].perKey.business, 3.5);
  assert.deepEqual(leaderboard([], rubric), []);
  /* a total that is missing is computed from the picks */
  const lb2 = leaderboard([{ team_id: 'a', team: 'A', scores: { problem: 2 } }, { team_id: 'a', team: 'A', scores: { problem: 4 } }], rubric);
  assert.equal(lb2[0].avg, 3); assert.equal(lb2[0].judges, 2);
  /* the pre-aggregated shape from ea_class_leaderboard() passes through */
  const lb3 = leaderboard([{ team_id: 'a', name: 'A', school: 'S', judges: 3, avg_total: 20.5, best_total: 24 }, { team_id: 'b', name: 'B', judges: 1, avg_total: 22 }]);
  assert.deepEqual(lb3.map(t => [t.rank, t.name, t.judges, t.avg, t.best]), [[1, 'B', 1, 22, 0], [2, 'A', 3, 20.5, 24]]);
  /* a rank gap after a tie: 1, 1, 3 */
  const lb4 = leaderboard([{ team_id: 'a', team: 'A', total: 10 }, { team_id: 'b', team: 'B', total: 10 }, { team_id: 'c', team: 'C', total: 9 }]);
  assert.deepEqual(lb4.map(t => t.rank), [1, 1, 3]);
});

test('the sentences', () => {
  assert.equal(judgesWord(1), '1 judge'); assert.equal(judgesWord(3), '3 judges');
  assert.equal(presentingLine(null, { host: true }), 'No team is on stage. Tap Now presenting in the bar to put one up.');
  assert.equal(presentingLine(null, {}), 'No team is presenting yet. When the host puts a team on stage, their name appears here.');
  assert.equal(presentingLine({ name: 'The Rattlers', school: 'FAMU' }), 'The Rattlers is presenting · FAMU');
  assert.equal(presentingLine({ name: 'Solo' }), 'Solo is presenting');
  assert.equal(savedLine({ name: 'The Rattlers' }, { problem: 5, solution: 4 }, rubric), 'Saved — The Rattlers: 9 of 25.');
});

test('csvCell: quotes commas, doubles quotes, defuses formulas, leaves signed numbers alone (the repo gotcha)', () => {
  assert.equal(csvCell('Pee, Kiara'), '"Pee, Kiara"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('@cmd'), "'@cmd"); assert.equal(csvCell('+cmd'), "'+cmd");
  assert.equal(csvCell('-5'), '-5'); assert.equal(csvCell(-5), '-5'); assert.equal(csvCell('+12.5'), '+12.5'); assert.equal(csvCell(21), '21');
  assert.equal(csvCell(null), ''); assert.equal(csvCell(undefined), '');
});

test('csvRows: a header with one column per rubric row, one row per score, a blank for an unscored row', () => {
  const out = csvRows(rows, rubric, { zone: 'America/New_York' });
  assert.equal(out.length, 5);
  assert.deepEqual(out[0], ['Team', 'School', 'Judge', 'Problem (of 5)', 'Solution (of 5)', 'Open-payments use (of 5)', 'Business model (of 5)', 'Delivery (of 5)', 'Total (of 25)', 'Comment', 'Scored at']);
  assert.deepEqual(out[1].slice(0, 9), ['The Rattlers', 'FAMU', 'Ada', 5, 4, 5, 4, 5, 23]);
  assert.equal(out[1][10], 'Sep 16, 7:10 PM');
  const partial = csvRows([{ team: 'A', judge: 'J', scores: { problem: 3 } }], rubric)[1];
  assert.deepEqual(partial.slice(3, 9), [3, '', '', '', '', 3]);
});

test('scoresCSV + leaderboardCSV: the title line, the guard on a formula comment, numbers untouched', () => {
  const csv = scoresCSV(rows, { rubric, title: 'OPIL 01 · Kickoff · 2026-09-16', zone: 'America/New_York' });
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'OPIL 01 · Kickoff · 2026-09-16');
  assert.equal(lines.length, 6);
  assert.match(lines[2], /^The Rattlers,FAMU,Ada,5,4,5,4,5,23,"Clear pitch, strong demo",/);
  assert.match(lines[4], /"'=SUM\(A1\) is not a comment, ""quoted"", and, commas"/);
  assert.match(lines[5], /,21,'-5 degrees outside,/);   /* text that starts with - is defused; the 21 before it (a number) is not */
  const lb = leaderboardCSV(rows, { rubric }).trim().split('\n');
  assert.equal(lb[0], 'Rank,Team,School,Judges,Average (of 25),Best (of 25)');
  assert.equal(lb[1], '1,The Rattlers,FAMU,2,21,23');
  assert.equal(lb[2], '1,Aggies Pay,NC A&T,1,21,21');
});

test('coordinator helpers: the summary line, the rubric editor, the friendly read errors', () => {
  assert.equal(scoresSummary(rows), '3 teams scored by 2 judges');
  assert.equal(scoresSummary([rows[0]]), '1 team scored by 1 judge');
  assert.equal(scoresSummary([]), 'No scores yet');
  assert.deepEqual(rubricFromFields([{ label: 'Problem', max: '5' }, { label: ' Demo ', max: 3 }, { label: '', max: 5 }]).rubric, [{ key: 'problem', label: 'Problem', max: 5 }, { key: 'demo', label: 'Demo', max: 3 }]);
  /* saving the standard five untouched keeps every key (open_payments stays open_payments — scores under it still match) */
  assert.deepEqual(rubricFromFields(DEFAULT_RUBRIC.map(r => ({ key: r.key, label: r.label, max: String(r.max) }))).rubric, DEFAULT_RUBRIC);
  /* a renamed row keeps its key; a new row gets one from its label */
  const edited = rubricFromFields([{ key: 'open_payments', label: 'Open payments', max: 5 }, { key: '', label: 'Teamwork', max: 3 }]).rubric;
  assert.deepEqual(edited, [{ key: 'open_payments', label: 'Open payments', max: 5 }, { key: 'teamwork', label: 'Teamwork', max: 3 }]);
  assert.equal(rubricFromFields([]).error, 'Give the rubric at least one row — a name and a top score.');
  assert.equal(rubricFromFields([{ label: 'A', max: 11 }]).error, '"A" needs a top score from 1 to 10.');
  assert.equal(rubricFromFields([{ label: 'A', max: 'x' }]).error, '"A" needs a top score from 1 to 10.');
  assert.equal(rubricFromFields([{ label: 'A', max: 5 }, { label: 'a', max: 5 }]).error, 'Two rows have the same name — give each row its own.');
  assert.match(readError({ message: 'function public.ea_class_scores_rows(p_key => text) does not exist' }), /0046/);
  assert.match(readError({ message: 'Could not find the function in the schema cache' }), /0046/);
  assert.equal(readError({ message: 'permission denied for table' }), 'Only the coordinator can see every score; judges see the leaderboard.');
  assert.equal(readError(new Error('fetch failed')), 'Could not load scores right now. Try again in a moment.');
  assert.equal(errorLine({ message: 'relation "public.ea_class_scores" does not exist' }, 'save'), 'Scores are not switched on yet — the scoring update (0046) has not been applied.');
  assert.equal(errorLine({ message: 'new row violates row-level security policy' }, 'save'), 'Only judges and the coordinator can save a score — this sign-in cannot.');
  assert.equal(errorLine(new Error('Failed to fetch'), 'save'), 'Could not save the score. Check your connection and tap Save score again.');
  assert.equal(typeof mount, 'function');
});

/* a stub supabase client: enough of from/rpc/channel for the plugin's start() and a save.
   o is read live, so a test can move the presenting team or add a saved row mid-flight;
   o.delay = { rpc?: ms, [team_id]: ms } slows a call down; o.mine = { [team_id]: row } is my saved score. */
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const teamsList = [{ id: 't1', name: 'The Rattlers', school: 'FAMU' }, { id: 't2', name: 'Tech Mongers', school: 'Livingstone' }];
const agg = [{ team_id: 't1', name: 'The Rattlers', school: 'FAMU', judges: 2, avg_total: 21, best_total: 23 }, { team_id: 't3', name: 'Aggies Pay', school: 'NC A&T', judges: 1, avg_total: 21, best_total: 21 }, { team_id: 't2', name: 'Tech Mongers', school: 'Livingstone', judges: 1, avg_total: 21, best_total: 21 }];
function stubSb(log, o = {}) {
  o.role = o.role || { judge: true, admin: false }; o.presenting = o.presenting || null; o.mine = o.mine || {}; o.delay = o.delay || {};
  const chain = (table) => { const c = { _eq: {}, select() { return c; }, eq(k, v) { c._eq[k] = v; return c; }, async maybeSingle() {
    if (table === 'ea_opil_sessions') return { data: { rubric: o.rubric || null, presenting_team: o.presenting } };
    const id = c._eq.team_id; log.push(['mine', id]); if (o.delay[id]) await wait(o.delay[id]); return { data: o.mine[id] || null }; } }; return c; };
  return {
    rpc: async (name, args) => { log.push(['rpc', name, args]); if (o.delay.rpc) await wait(o.delay.rpc); if (name === 'ea_opil_my_role') return { data: o.role }; if (name === 'ea_class_teams') return o.teamsError ? { error: new Error(o.teamsError) } : { data: teamsList }; if (name === 'ea_class_leaderboard') return { data: agg }; if (name === 'ea_class_scores_rows') return { data: rows }; return { data: null }; },
    from: (table) => ({
      select: () => chain(table),
      update: (patch) => ({ eq: async (col, v) => { log.push(['update', table, patch, col, v]); return { error: null }; } }),
      upsert: async (row, x) => { log.push(['upsert', table, row, x]); return o.saveError ? { error: new Error(o.saveError) } : { error: null }; },
    }),
    channel: () => { log.push(['channel']); return { on() { return this; }, subscribe() { return this; } }; },
    removeChannel: () => { log.push(['removeChannel']); },
  };
}
/* a fake Score pane: reads the HTML the plugin writes and hands back pills, the textarea, the select — enough to tap and type */
function fakePane() {
  const doc = { activeElement: null };
  const mk = (extra) => { const n = { hidden: false, h: {}, ownerDocument: doc, set: new Set(), classList: { toggle: (c, on) => { on ? n.set.add(c) : n.set.delete(c); }, contains: (c) => n.set.has(c) }, setAttribute() {}, addEventListener(ev, fn) { n.h[ev] = fn; }, fire(ev) { return n.h[ev] && n.h[ev](); } }; return Object.assign(n, extra); };
  let html = '', pills = [], ta = null, sel = null, total = null, clear = null, head = null, save = null;
  const parse = () => {
    pills = []; for (const m of html.matchAll(/class="r2-pill( on)?"[^>]*data-key="([^"]+)" data-n="(\d+)"/g)) { const pl = mk({ dataset: { key: m[2], n: m[3] } }); if (m[1]) pl.set.add('on'); pl.parentElement = { querySelectorAll: () => pills.filter(x => x.dataset.key === m[2]) }; pills.push(pl); }
    const t = html.match(/<textarea class="r2-score-comment" data-team="([^"]*)"[^>]*>([\s\S]*?)<\/textarea>/); ta = t ? mk({ value: t[2], dataset: { team: t[1] } }) : null;
    const sm = html.match(/<option value="([^"]*)" selected>/); sel = html.includes('r2-score-team') ? mk({ value: sm ? sm[1] : '', innerHTML: '' }) : null;
    const tm = html.match(/class="r2-score-total">([^<]*)</); total = tm ? mk({ textContent: tm[1] }) : null;
    const cm = html.match(/class="r2-btn r2-score-clear"( hidden)?/); clear = cm ? mk({ hidden: !!cm[1] }) : null;
    const hm = html.match(/<div class="r2-score-head">([\s\S]*?)<\/div>/); head = hm ? mk({ innerHTML: hm[1] }) : null;
    save = html.includes('r2-score-save') ? mk({}) : null;
  };
  const pane = { doc, count: { textContent: '' }, shown: 0,
    querySelector: (q) => ({ '.r2-score-comment': ta, '.r2-score-team': sel, '.r2-score-total': total, '.r2-score-clear': clear, '.r2-score-head': head, '.r2-score-save': save })[q] || null,
    querySelectorAll: (q) => q === '.r2-pill' ? pills : [],
    tap: (key, n) => pills.find(x => x.dataset.key === key && x.dataset.n === String(n)).fire('click'),
    type: (v) => { ta.value = v; ta.fire('input'); }, focus: () => { doc.activeElement = ta; }, get ta() { return ta; }, get sel() { return sel; }, get head() { return head; }, get clear() { return clear; }, get save() { return save; } };
  Object.defineProperty(pane, 'innerHTML', { get: () => html, set: (v) => { html = v; parse(); } });
  return pane;
}
const fakeCtx = (sb, extra = {}) => {
  const tabs = {}, bar = [], sheets = [], toasts = [], events = [], sent = [], chans = [];
  return { ctx: {
    sb, el: (h) => ({ html: h, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} }), esc: (s) => String(s), uid: 'j1', host: false, roomKey: 'opil:2', session: { no: 2, title: 'Pitch night' },
    toast: (m) => toasts.push(m), openSheet: (t, n) => sheets.push([t, n]), closeSheet() {},
    panel: { addTab: (name, label) => { const pane = name === 'score' ? fakePane() : { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }; const t = { pane, count: { textContent: '' }, shown: 0, show() { t.shown++; } }; tabs[name] = t; return t; } },
    bar: { addButton: (h) => { const b = { html: h, addEventListener() {} }; bar.push(b); return b; } },
    channel: () => { const c = { cbs: [], on(cb) { c.cbs.push(cb); }, send: (p) => sent.push(p), stop() { c.stopped = true; }, fire: (p, meta) => c.cbs.forEach(cb => cb(p, meta)) }; chans.push(c); return c; },
    events: { log: async (k, l, d) => events.push([k, l, d]) }, on() {},
    ...extra }, tabs, bar, sheets, toasts, events, sent, chans };
};
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
/* the host moved the stage: the broadcast nudge + the session row both say so */
const stageTo = (f, o, id, name) => { o.presenting = id; f.chans[0].fire({ team_id: id, name }, { fromHost: true, mine: false }); };

test('create(ctx): a judge gets Score + Leaderboard tabs and no bar button; the role is asked when the integrator did not pass it', async () => {
  const log = []; const sb = stubSb(log);
  const f = fakeCtx(sb); const p = create(f.ctx); p.start(); await tick();
  assert.ok(f.tabs.score && f.tabs.leaderboard, 'both tabs');
  assert.equal(f.bar.length, 0, 'no Now presenting for a judge');
  assert.ok(log.some(l => l[0] === 'rpc' && l[1] === 'ea_opil_my_role'), 'asked the role');
  assert.match(f.tabs.score.pane.innerHTML, /No team is presenting yet/);
  assert.ok(log.some(l => l[1] === 'ea_class_leaderboard'), 'the board is the aggregate RPC');
  assert.ok(!log.some(l => l[1] === 'ea_class_scores_rows'), 'the room never asks for other judges\' rows');
  assert.match(f.tabs.leaderboard.pane.innerHTML, /The Rattlers/);
  assert.equal(f.tabs.leaderboard.count.textContent, 3);
  /* every team on rank 1 is drawn as a leader (the emerald average), not just the first row */
  assert.equal((f.tabs.leaderboard.pane.innerHTML.match(/r2-lb-row lead/g) || []).length, 3);
  p.stop();
});

test('create(ctx): a student (not judge, not admin, not host) gets nothing at all', async () => {
  const log = []; const sb = stubSb(log, { role: { judge: false, admin: false } });
  const f = fakeCtx(sb, { judge: false, admin: false }); const p = create(f.ctx); p.start(); await tick();
  assert.deepEqual(Object.keys(f.tabs), []); assert.equal(f.bar.length, 0);
  assert.ok(!log.some(l => l[1] === 'ea_opil_my_role'), 'no role call when ctx says so');
  assert.ok(!log.some(l => l[1] === 'ea_class_leaderboard' || l[1] === 'ea_class_scores_rows'), 'never reads scores');
  assert.ok(!log.some(l => l[1] === 'ea_class_teams'), 'never even lists teams');
  p.stop();
});

test('create(ctx): the host gets Now presenting; present() writes the session row, broadcasts stage, logs the event, says a sentence', async () => {
  const log = []; const sb = stubSb(log, { role: { judge: false, admin: true } });
  const f = fakeCtx(sb, { host: true, judge: false, admin: true }); const p = create(f.ctx); p.start(); await tick();
  assert.equal(f.bar.length, 1); assert.match(f.bar[0].html, /Now presenting/);
  assert.ok(f.tabs.score, 'an admin host also scores');
  const ok = await p.present({ id: 't1', name: 'The Rattlers', school: 'FAMU' });
  assert.equal(ok, true);
  const up = log.find(l => l[0] === 'update'); assert.deepEqual(up.slice(1), ['ea_opil_sessions', { presenting_team: 't1' }, 'no', 2]);
  assert.deepEqual(f.sent[0], { team_id: 't1', name: 'The Rattlers' });
  assert.deepEqual(f.events[0], ['presenting', 'The Rattlers', { team_id: 't1' }]);
  assert.equal(f.toasts.at(-1), 'The Rattlers is now presenting — judges can score them.');
  assert.equal(p.presenting.id, 't1');
  assert.match(f.tabs.score.pane.innerHTML, /The Rattlers is presenting · FAMU/);
  assert.equal(f.tabs.score.shown, 0, 'the host is not yanked onto the Score tab');
  await p.present(null);
  assert.equal(f.toasts.at(-1), 'The stage is clear — no team is presenting.');
  assert.equal(p.presenting, null);
  p.stop();
});

test('create(ctx): the presenting team on the session row is picked up at start, the Score tab names it and is opened for the judge', async () => {
  const log = []; const sb = stubSb(log, { presenting: 't2' });
  const f = fakeCtx(sb, { judge: true, admin: false }); const p = create(f.ctx); p.start(); await tick();
  assert.equal(p.presenting.name, 'Tech Mongers');
  assert.match(f.tabs.score.pane.innerHTML, /Tech Mongers is presenting · Livingstone/);
  assert.match(f.tabs.score.pane.innerHTML, /Save score/);
  assert.ok((f.tabs.score.pane.innerHTML.match(/class="r2-pill/g) || []).length === 25, '5 rows × 5 pills');
  assert.equal(f.toasts.at(-1), 'Tech Mongers is presenting — the Score tab is ready.');
  assert.equal(f.tabs.score.shown, 1, 'the tab the sentence points at is actually opened (a phone keeps the panel closed otherwise)');
  p.stop();
});

test('create(ctx): a judge\'s unsaved picks and note survive the host switching the stage; Save keeps them on the right team, then follows the stage', async () => {
  const log = [], o = { presenting: 't1' }; const sb = stubSb(log, o);
  const f = fakeCtx(sb, { judge: true, admin: false }); const p = create(f.ctx); p.start(); await tick();
  const pane = f.tabs.score.pane;
  assert.equal(p.target.id, 't1'); assert.equal(pane.clear.hidden, true, 'nothing to clear yet');
  pane.tap('problem', 5); pane.tap('solution', 4); pane.type('Strong demo');
  assert.equal(p.unsaved, true); assert.equal(pane.clear.hidden, false);
  stageTo(f, o, 't2', 'Tech Mongers'); await tick();
  assert.equal(p.presenting.id, 't2'); assert.equal(p.target.id, 't1', 'the Score tab stays on the team being scored');
  assert.ok(f.toasts.some(t => t === 'Tech Mongers is on stage — finish or save The Rattlers, then pick Tech Mongers from the list.'), f.toasts.join(' | '));
  assert.match(pane.innerHTML, /You are scoring The Rattlers — not the team on stage/);
  assert.match(pane.innerHTML, /class="r2-pill on"[^>]*data-key="problem" data-n="5"/, 'the picks are still on');
  assert.equal(pane.ta.value, 'Strong demo', 'the note is still there, under the right team');
  assert.equal(pane.ta.dataset.team, 't1');
  pane.save.fire('click'); await tick();
  const up = log.find(l => l[0] === 'upsert'); assert.equal(up[2].team_id, 't1'); assert.equal(up[2].comment, 'Strong demo'); assert.deepEqual(up[2].scores, { problem: 5, solution: 4 });
  assert.equal(p.target.id, 't2', 'once the score is safe, the tab follows the stage');
  assert.equal(p.unsaved, false); assert.equal(pane.ta.value, '', 'a clean slate for the new team');
  assert.ok(f.toasts.some(t => t === 'Tech Mongers is on stage — the Score tab is on them now.'));
  p.stop();
});

test('create(ctx): a note being typed never re-renders under the next team, and typing keeps its textarea when the stage moves', async () => {
  /* not dirty, textarea focused but empty → the tab follows the stage and the note stays blank */
  let log = [], o = { presenting: 't1' }; let sb = stubSb(log, o);
  let f = fakeCtx(sb, { judge: true, admin: false }); let p = create(f.ctx); p.start(); await tick();
  let pane = f.tabs.score.pane; pane.focus(); pane.ta.value = 'half a thou';   /* typed with no input event yet — the stale focused read the reviewer caught */
  stageTo(f, o, 't2', 'Tech Mongers'); await tick();
  assert.equal(p.target.id, 't2'); assert.equal(pane.ta.value, '', 'nothing carried over'); assert.equal(pane.ta.dataset.team, 't2');
  p.stop();
  /* dirty + focused: the pane is patched in place — same textarea object, new head line */
  log = []; o = { presenting: 't1' }; sb = stubSb(log, o);
  f = fakeCtx(sb, { judge: true, admin: false }); p = create(f.ctx); p.start(); await tick();
  pane = f.tabs.score.pane; pane.focus(); pane.type('Clear pitch'); const before = pane.ta;
  stageTo(f, o, 't2', 'Tech Mongers'); await tick();
  assert.equal(pane.ta, before, 'the textarea was not replaced mid-typing');
  assert.match(pane.head.innerHTML, /Tech Mongers is presenting/); assert.match(pane.head.innerHTML, /You are scoring The Rattlers/);
  assert.match(pane.sel.innerHTML, /Tech Mongers · on stage/);
  p.stop();
});

test('create(ctx): a slow reply for the last team never paints under the new one (loadMine sequence guard)', async () => {
  const log = [], o = { presenting: 't1', mine: { t1: { scores: { problem: 5, solution: 5 }, comment: 'old note', total: 10 } }, delay: { t1: 60 } }; const sb = stubSb(log, o);
  const f = fakeCtx(sb, { judge: true, admin: false }); const p = create(f.ctx); p.start(); await tick();
  assert.equal(p.target.id, 't1');
  stageTo(f, o, 't2', 'Tech Mongers'); await tick(120);
  assert.equal(p.target.id, 't2');
  const pane = f.tabs.score.pane;
  assert.ok(!/r2-pill on/.test(pane.innerHTML), 'no pick from team 1 shows under team 2');
  assert.equal(pane.ta.value, '', 'team 1\'s note did not land on team 2');
  assert.match(pane.innerHTML, /Save score/, 'not "Update score" — there is no row for team 2');
  p.stop();
});

test('create(ctx): stop() during start()\'s awaits leaves no poll and no channel behind', async () => {
  const log = [], o = { delay: { rpc: 40 } }; const sb = stubSb(log, o);
  const f = fakeCtx(sb, { judge: true, admin: false }); const p = create(f.ctx); p.start();
  await tick(5); p.stop();
  await tick(200);
  assert.deepEqual(Object.keys(f.tabs), [], 'no tabs after a stop mid-start');
  assert.equal(f.chans.length, 0, 'no stage channel'); assert.ok(!log.some(l => l[0] === 'channel'), 'no scores channel');
  assert.ok(!log.some(l => l[1] === 'ea_class_leaderboard'), 'no board read after stop');
  /* a stop that lands between the last await and the timer still tears everything down */
  const log2 = []; const sb2 = stubSb(log2, {}); const f2 = fakeCtx(sb2, { judge: true, admin: false }); const p2 = create(f2.ctx); p2.start(); await tick(); p2.stop();
  assert.ok(f2.chans[0].stopped, 'the stage channel was stopped'); assert.ok(log2.some(l => l[0] === 'removeChannel'), 'the scores channel was removed');
});

test('create(ctx): the sentences say what actually went wrong — a missing team list is not "not approved yet", a 404 on save is not "your connection"', async () => {
  const log = []; const sb = stubSb(log, { teamsError: 'Could not find the function public.ea_class_teams in the schema cache', presenting: null });
  const f = fakeCtx(sb, { judge: true, admin: false, host: true }); const p = create(f.ctx); p.start(); await tick();
  assert.match(f.tabs.score.pane.innerHTML, /Scores are not switched on yet — the scoring update \(0046\) has not been applied/);
  p.openPresenting();
  assert.match(f.sheets[0][1].html, /0046/); assert.ok(!/approved them on the hub/.test(f.sheets[0][1].html), 'no promise the code cannot keep');
  p.stop();
  const log2 = [], o2 = { presenting: 't1', saveError: 'relation "public.ea_class_scores" does not exist' }; const sb2 = stubSb(log2, o2);
  const f2 = fakeCtx(sb2, { judge: true, admin: false }); const p2 = create(f2.ctx); p2.start(); await tick();
  f2.tabs.score.pane.tap('problem', 3); f2.tabs.score.pane.save.fire('click'); await tick();
  assert.equal(f2.toasts.at(-1), 'Scores are not switched on yet — the scoring update (0046) has not been applied.');
  assert.equal(p2.unsaved, true, 'the picks are kept for a retry');
  p2.stop();
});

test('create(ctx): a room without a session (Academy / HT) starts quietly and adds nothing', async () => {
  const log = []; const sb = stubSb(log);
  const f = fakeCtx(sb, { session: null, roomKey: 'room:abc', judge: true, admin: true, host: true }); const p = create(f.ctx); p.start(); await tick();
  assert.deepEqual(Object.keys(f.tabs), []); assert.equal(f.bar.length, 0); assert.equal(log.length, 0);
  p.stop();
});

test('create(ctx): a broken connection never throws out of start()', async () => {
  const sb = { rpc: async () => { throw new Error('offline'); }, from: () => { throw new Error('offline'); }, channel: () => { throw new Error('offline'); }, removeChannel() {} };
  const f = fakeCtx(sb, { judge: true, admin: false }); const p = create(f.ctx);
  assert.doesNotThrow(() => p.start()); await tick();
  assert.ok(f.tabs.score, 'the tab still exists, it just says nobody is presenting');
  assert.doesNotThrow(() => p.stop());
});
