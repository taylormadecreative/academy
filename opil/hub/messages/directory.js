/* The Messages page's people list (migration 0057). Pure, import-safe in Node for tests/opil/messages-directory.test.mjs.
   directory(rows, partners, me) — rows: [{ user_id, team_name }] (the cohort), partners: the caller's own DM rows
   ({ sender_id, recipient_id }). Returns { teams: [{ name, uids }], program: [uid] }:
   - teams A→Z, people in the order they came, the caller left out, one entry per person
   - program: anyone the caller has messaged with who is on no team — the facilitators and admins who wrote to a
     student, so the student can find the thread and answer */
export function directory(rows, partners, me) {
  const byTeam = new Map(), onTeam = new Set();
  for (const r of rows || []) {
    if (!r || !r.user_id || onTeam.has(r.user_id)) continue;
    onTeam.add(r.user_id);
    if (r.user_id === me) continue;
    const name = String(r.team_name || '').trim() || 'No team yet';
    if (!byTeam.has(name)) byTeam.set(name, []);
    byTeam.get(name).push(r.user_id);
  }
  const program = [];
  for (const p of partners || []) {
    for (const id of [p && p.sender_id, p && p.recipient_id]) {
      if (id && id !== me && !onTeam.has(id) && !program.includes(id)) program.push(id);
    }
  }
  const teams = [...byTeam].map(([name, uids]) => ({ name, uids }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { teams, program };
}

const people = (n) => n + (n === 1 ? ' person' : ' people');

/* what the sender reads after "Message the whole team" */
export function teamSentLine(team, n) {
  return `Sent to ${people(n)} on ${team}. Each of them got it as a private message from you, and their replies come to you one by one.`;
}
export const teamIntro = (team, n) =>
  `This goes to all ${people(n)} on ${team}, as a private message from you to each of them. Replies come back to you one by one, and team chat stays private to the team.`;
