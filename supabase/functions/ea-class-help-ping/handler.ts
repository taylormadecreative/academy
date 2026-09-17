// ea-class-help-ping — the rules (spec 2026-09-16-class-features-design.md §5). Two things, one function:
//   { id }          the student who filed the help request asks us to email the facilitators for its
//                   track — once (pinged_at); a second call answers `already`.
//   { id, answer }  a program-team member answers: the row is saved (if the page has not already) and
//                   the student is emailed the answer — once per answer (answer_sent_at).
// Who gets the ping: ea_opil_facilitators matched by a keyword in their label (or email) —
// "Track 1"/business/Jarrell → the business track, "Track 2"/open payments/Casey → open payments,
// "HPC"/Ashley → the HPC series. Nobody matched → the hub team. The hub team (Jamal + Nelson) is on
// every ping, so no request is ever unseen. Reply-to is the student, so a facilitator can just reply.
export type Track = "business" | "payments" | "hpc" | "hub";
export const TRACK_WORD: Record<Track, string> = { business: "the business track", payments: "the open payments track", hpc: "the HPC series", hub: "the hub itself" };
export const HUB_TEAM = ["jware@aucenter.edu", "taylormademd@gmail.com"];
export const SITE = "https://taylormadeacademy.com";
export const QUEUE_LINK = `${SITE}/opil/hub/admin/#help`;
export const HOME_LINK = `${SITE}/opil/hub/#help`;

export type HelpBody = { id?: unknown; answer?: unknown };
export type Caller = { id: string; email?: string | null; programTeam: boolean };
export type HelpRow = {
  id: string; user_id: string; room_key?: string | null; track: string; text: string; status: string;
  claimed_by: string | null; claimed_name: string | null; answer: string | null;
  pinged_at: string | null; answer_sent_at: string | null; created_at: string;
};
export type Facilitator = { email: string; label: string | null; session_nos?: number[] | null };
export type Student = { email: string; name: string; school: string | null; team_name: string | null };
export type Mail = { to: string[]; subject: string; html: string; replyTo?: string };
export type HelpDeps = {
  /* fail-open like every ea_rate_check caller: only an explicit false refuses */
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;
  getRow: (id: string) => Promise<HelpRow | null>;
  student: (userId: string) => Promise<Student | null>;
  facilitators: () => Promise<Facilitator[]>;
  /* the answerer's name and email, for the student's email; null when unknown */
  person: (userId: string) => Promise<{ name: string; email: string | null } | null>;
  markPinged: (id: string) => Promise<void>;
  saveAnswer: (id: string, answer: string, byUserId: string) => Promise<void>;
  markAnswerSent: (id: string) => Promise<void>;
  send: (msg: Mail) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
};
export type HelpReply = { status: number; body: Record<string, unknown> };

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cleanId(raw: unknown): string | null { const s = String(raw ?? "").trim().toLowerCase(); return UUID_RX.test(s) ? s : null; }
export function cleanAnswer(raw: unknown): string { return String(raw ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000); }

/* a facilitator's label ("Casey Diké · Track 2", "Jarrell — Business", "hpc lead") or email → the track it names, or null */
export function trackFor(label: unknown): Track | null {
  const s = String(label ?? "").toLowerCase();
  if (!s.trim()) return null;
  if (/\bhpc\b|high[\s-]?performance|ashley/.test(s)) return "hpc";
  if (/track\s*2|open\s*payments|\bpayments?\b|interledger|casey/.test(s)) return "payments";
  if (/track\s*1|business|jarrell/.test(s)) return "business";
  if (/\bhub\b/.test(s)) return "hub";
  return null;
}
/* "Casey Diké · Track 2" → "Casey Diké"; no label → the email's first half */
export function facilitatorName(f: Facilitator): string {
  const first = String(f.label ?? "").split(" · ")[0].trim();
  return first || String(f.email).split("@")[0];
}
/* who is emailed for a track: the matching facilitators, then always the hub team; lower-cased, no doubles */
export function recipientsFor(track: string, facs: Facilitator[]): { to: string[]; matched: Facilitator[] } {
  const matched = track === "hub" ? [] : (facs || []).filter((f) => f && f.email && (trackFor(f.label) === track || trackFor(f.email) === track));
  const seen = new Set<string>(); const to: string[] = [];
  for (const e of [...matched.map((f) => f.email), ...HUB_TEAM]) { const k = String(e).trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); to.push(k); } }
  return { to, matched };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const paras = (t: string) => String(t ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.62;color:#33415b">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const quote = (t: string) => `<div style="margin:6px 0 18px;padding:14px 16px;border-left:3px solid #fdc921;background:#fff6da;border-radius:0 12px 12px 0">${paras(t)}</div>`;
const btn = (href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px"><tr><td style="background:#04123a;border-radius:980px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-weight:700;font-size:15px;color:#fdc921;text-decoration:none;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${esc(label)} &rarr;</a></td></tr></table>`;
export const firstName = (full: string | null | undefined) => (String(full ?? "").trim().split(/\s+/)[0] || "there");

/* the email the facilitators get */
export function pingEmail(row: HelpRow, st: Student, matched: Facilitator[]): { subject: string; heading: string; body: string } {
  const track = TRACK_WORD[row.track as Track] || "the program";
  const where = [st.school, st.team_name ? "Team " + st.team_name : ""].filter(Boolean).join(" · ");
  const names = matched.map(facilitatorName);
  const hi = names.length === 1 ? `Hi ${esc(names[0].split(" ")[0])}, ` : names.length > 1 ? `Hi ${esc(names.map((n) => n.split(" ")[0]).join(" and "))}, ` : "";
  return {
    subject: `${st.name} needs help with ${track}`,
    heading: `${st.name} needs help with ${track}`,
    body: `<p style="margin:0 0 14px;font-size:16px;line-height:1.62;color:#33415b">${hi}${esc(st.name)}${where ? ` (${esc(where)})` : ""} sent this from the Lab Hub:</p>${quote(row.text)}` +
      `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#33415b">Reply to this email and it goes straight to ${esc(firstName(st.name))}. Or claim it on the coordinator page so the rest of the team knows it is yours, and answer there — the answer is emailed and shows on their hub home.</p>` +
      btn(QUEUE_LINK, "Open help requests"),
  };
}
/* the email the student gets */
export function answerEmail(row: HelpRow, st: Student, answer: string, by: { name: string } | null): { subject: string; heading: string; body: string } {
  const who = (by && by.name) || row.claimed_name || "A facilitator";
  return {
    subject: `${who} answered your question`,
    heading: `${who} answered your question`,
    body: `<p style="margin:0 0 10px;font-size:16px;line-height:1.62;color:#33415b">Hi ${esc(firstName(st.name))}, you asked about ${esc(TRACK_WORD[row.track as Track] || "the program")}:</p>${quote(row.text)}` +
      `<p style="margin:0 0 10px;font-size:16px;line-height:1.62;color:#33415b"><b>${esc(who)}</b> wrote back:</p><div style="margin:6px 0 18px;padding:14px 16px;border-left:3px solid #10b981;background:#ecfdf5;border-radius:0 12px 12px 0">${paras(answer)}</div>` +
      `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#33415b">Reply to this email if you have a follow-up. The answer is on your hub home too.</p>` +
      btn(HOME_LINK, "Open the Lab Hub"),
  };
}

export async function handleHelp(body: HelpBody, caller: Caller, deps: HelpDeps, layout: (o: { heading: string; body: string; preheader?: string; kicker?: string; foot?: string }) => string): Promise<HelpReply> {
  const id = cleanId(body?.id);
  if (!id) return { status: 400, body: { error: "bad_id" } };
  const row = await deps.getRow(id);
  if (!row) return { status: 404, body: { error: "not_found" } };
  /* only OPIL help is emailed: a row filed under any other key (0047's policy refuses those too) never makes the Academy send mail */
  if (!/^opil:/.test(String(row.room_key ?? ""))) return { status: 403, body: { error: "not_allowed" } };
  const answer = cleanAnswer(body?.answer);
  const answering = answer.length > 0 || (caller.programTeam && row.user_id !== caller.id);

  if (!answering) {
    /* ── the student's ping ── */
    if (row.user_id !== caller.id) return { status: 403, body: { error: "not_allowed" } };
    if (row.pinged_at) return { status: 200, body: { ok: true, already: true, emailed: false } };
    if ((await deps.rateCheck(`help_ping:${caller.id}`, 10, 3600)) === false) return { status: 429, body: { error: "slow_down" } };
    const st = await deps.student(row.user_id);
    if (!st) return { status: 404, body: { error: "no_student" } };
    const { to, matched } = recipientsFor(row.track, await deps.facilitators());
    const m = pingEmail(row, st, matched);
    const r = await deps.send({ to, subject: m.subject, replyTo: st.email, html: layout({ kicker: "Lab Hub · help request", preheader: row.text.slice(0, 120), heading: m.heading, body: m.body, foot: `Sent by the Lab Hub because ${esc(st.name)} asked for help with ${esc(TRACK_WORD[row.track as Track] || "the program")}. The whole list is at ${esc(QUEUE_LINK)}.` }) });
    if (r.ok) await deps.markPinged(id);
    return { status: 200, body: { ok: true, emailed: r.ok, to: to.length, why: r.ok ? undefined : (r.skipped ? "email_not_set_up" : r.error || "email_failed") } };
  }

  /* ── a program-team answer ── */
  if (!caller.programTeam) return { status: 403, body: { error: "not_allowed" } };
  const finalAnswer = answer || cleanAnswer(row.answer);
  if (!finalAnswer) return { status: 400, body: { error: "no_answer" } };
  let saved = false;
  if (finalAnswer !== cleanAnswer(row.answer) || row.status !== "answered") { await deps.saveAnswer(id, finalAnswer, caller.id); saved = true; }
  else if (row.answer_sent_at) return { status: 200, body: { ok: true, already: true, emailed: false } };
  const st = await deps.student(row.user_id);
  if (!st) return { status: 404, body: { error: "no_student" } };
  const by = await deps.person(caller.id);
  const m = answerEmail(row, st, finalAnswer, by);
  const r = await deps.send({ to: [st.email], subject: m.subject, replyTo: (by && by.email) || undefined, html: layout({ kicker: "Lab Hub · your question", preheader: finalAnswer.slice(0, 120), heading: m.heading, body: m.body, foot: `You are getting this because you asked for help on the Lab Hub at ${esc(HOME_LINK)}.` }) });
  if (r.ok) await deps.markAnswerSent(id);
  return { status: 200, body: { ok: true, emailed: r.ok, saved, why: r.ok ? undefined : (r.skipped ? "email_not_set_up" : r.error || "email_failed") } };
}
