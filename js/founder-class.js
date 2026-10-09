/* js/founder-class.js — the founder's "Class results" tab: what the AI 101 class page asks (ea_class_pulse, 0059)
   and the math on what people answered. No DOM here, so tests/academy/founder-class.test.mjs can check it.
   CLASS_Q is a copy of ai101_course.py (PULSE_Q, PULSE_ENDS, PRACTICE_TAPS, CHECK_ITEMS): that test fails the moment
   the two disagree, so a reworded question or a moved right answer never shows Nelson the wrong percentage. */
export const CLASS_Q = {
  before: "How confident are you that you could use AI to get something useful done?",
  after: "Now, how confident are you that you could use AI to get something useful done?",
  ends: ["Not at all confident", "Very confident"],
  taps: [ // score = the button's number, 1-based
    { kind: "useful", q: "Was the first answer useful?", labels: ["Not yet", "Almost", "Yes"] },
    { kind: "steered", q: "Did you reply to make it better?", labels: ["Not yet", "Yes"] },
  ],
  checks: [ // score = the option picked, 1-based; the server keeps each person's FIRST answer
    { kind: "chk_safe", q: "Your company allows AI for writing help. A customer sends you an angry email. What do you paste into the AI?",
      options: ["The whole email, with their name and account number", "The email, with their name and account number swapped for [brackets]", "Only their account number"], right: 2 },
    { kind: "chk_verify", q: "The AI gives you a number and says where it came from. What's the best next step?",
      options: ["Use it. It sounded sure.", "Ask the AI “Are you sure?” and use it if it says yes.", "Open the source yourself and see if it says that."], right: 3 },
    { kind: "chk_prompt", q: "The AI's answer is too generic. Which of these will most likely fix it?",
      options: ["Ask the same thing again", "Add who it's for, and show it one you like", "Switch to a different AI"], right: 2 },
  ],
};

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* rows: [{user_id, kind, score, updated_at}]. exclude: a user_id left out (Nelson's own test taps).
   Rows with a kind the class doesn't ask, or a score outside that question's buttons, are skipped. */
export function summarizePulse(rows, { exclude = null } = {}) {
  const max = { before: 5, after: 5 };
  CLASS_Q.taps.forEach((t) => { max[t.kind] = t.labels.length; });
  CLASS_Q.checks.forEach((c) => { max[c.kind] = c.options.length; });
  const by = {}, people = new Set();
  let last = null;
  for (const r of rows || []) {
    if (!r || r.user_id == null || (exclude && r.user_id === exclude)) continue;
    const s = Number(r.score);
    if (!(r.kind in max) || !Number.isInteger(s) || s < 1 || s > max[r.kind]) continue;
    (by[r.kind] ||= new Map()).set(r.user_id, s); // one row per person per question (unique in 0059)
    people.add(r.user_id);
    if (r.updated_at && (!last || r.updated_at > last)) last = r.updated_at;
  }
  const scale = (kind) => {
    const m = by[kind] || new Map(), xs = [...m.values()], dist = [0, 0, 0, 0, 0];
    xs.forEach((s) => { dist[s - 1]++; });
    return { n: xs.length, avg: avg(xs), dist };
  };
  const b = by.before || new Map(), a = by.after || new Map();
  const changes = [...a.keys()].filter((u) => b.has(u)).map((u) => a.get(u) - b.get(u));
  return {
    people: people.size,
    before: scale("before"),
    after: scale("after"),
    paired: { n: changes.length, avgChange: avg(changes) },
    taps: CLASS_Q.taps.map((t) => {
      const counts = t.labels.map(() => 0);
      (by[t.kind] || new Map()).forEach((s) => { counts[s - 1]++; });
      return { kind: t.kind, q: t.q, labels: t.labels, counts, n: counts.reduce((x, y) => x + y, 0) };
    }),
    checks: CLASS_Q.checks.map((c) => {
      const counts = c.options.map(() => 0);
      (by[c.kind] || new Map()).forEach((s) => { counts[s - 1]++; });
      const n = counts.reduce((x, y) => x + y, 0), rightN = counts[c.right - 1];
      return { kind: c.kind, q: c.q, options: c.options, right: c.right, counts, n, rightN, pct: n ? Math.round((rightN / n) * 100) : null };
    }),
    last,
  };
}

/* 3.4 -> "3.4", null -> "–"; a change keeps its sign: +1.2, -0.5, 0.0 */
export const oneDp = (x) => (x == null ? "–" : (Math.round(x * 10) / 10).toFixed(1));
export const signed = (x) => {
  if (x == null) return "–";
  const r = Math.round(x * 10) / 10; // sign of the rounded value, so -0.04 reads 0.0, not −0.0
  return (r > 0 ? "+" : r < 0 ? "−" : "") + oneDp(Math.abs(r));
};
