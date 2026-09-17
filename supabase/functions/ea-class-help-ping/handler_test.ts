// deno test supabase/functions/ea-class-help-ping/
import { assertEquals, assertStringIncludes, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleHelp, trackFor, recipientsFor, facilitatorName, cleanId, cleanAnswer, pingEmail, answerEmail, HUB_TEAM, type HelpDeps, type HelpRow, type Facilitator, type Mail } from "./handler.ts";

const ID = "5a2c9d1e-7b3f-4c8a-9e21-0f6d4b8a1c33";
const STUDENT = { id: "u-kiara", email: "kiara1.pee@famu.edu", programTeam: false };
const CASEY = { id: "u-casey", email: "casey@blazegroupllc.com", programTeam: true };
const FACS: Facilitator[] = [
  { email: "jarrell@example.edu", label: "Jarrell Smith · Track 1", session_nos: [201, 203] },
  { email: "casey@blazegroupllc.com", label: "Casey Diké · Track 2", session_nos: [202] },
  { email: "ashley@example.edu", label: "Ashley · HPC", session_nos: [301] },
  { email: "guest@example.edu", label: null, session_nos: [] },
];
const layout = (o: { heading: string; body: string }) => `<h1>${o.heading}</h1>${o.body}`;

function row(over: Partial<HelpRow> = {}): HelpRow {
  return { id: ID, user_id: "u-kiara", room_key: "opil:hub", track: "payments", text: "My wallet address never verifies.\n\nI tried twice.", status: "open", claimed_by: null, claimed_name: null, answer: null, pinged_at: null, answer_sent_at: null, created_at: "2026-09-17T14:00:00Z", ...over };
}
function deps(r: HelpRow | null, over: Partial<HelpDeps> = {}) {
  const sent: Mail[] = []; const marks: string[] = []; const saved: [string, string, string][] = []; const rates: [string, number, number][] = [];
  const d: HelpDeps & { sent: Mail[]; marks: string[]; saved: typeof saved; rates: typeof rates } = {
    sent, marks, saved, rates,
    rateCheck: async (k, m, w) => { rates.push([k, m, w]); return true; },
    getRow: async (id) => (r && r.id === id ? r : null),
    student: async (uid) => (uid === "u-kiara" ? { email: "kiara1.pee@famu.edu", name: "Kiara Pee", school: "FAMU", team_name: "The Rattlers" } : null),
    facilitators: async () => FACS,
    person: async (uid) => (uid === "u-casey" ? { name: "Casey Diké", email: "casey@blazegroupllc.com" } : null),
    markPinged: async (id) => { marks.push("pinged:" + id); },
    saveAnswer: async (id, a, by) => { saved.push([id, a, by]); },
    markAnswerSent: async (id) => { marks.push("sent:" + id); },
    send: async (m) => { sent.push(m); return { ok: true }; },
    ...over,
  };
  return d;
}

Deno.test("trackFor reads a facilitator label or an email the way the coordinator writes them", () => {
  assertEquals(trackFor("Casey Diké · Track 2"), "payments");
  assertEquals(trackFor("Jarrell — Business"), "business");
  assertEquals(trackFor("track1"), "business");
  assertEquals(trackFor("Ashley · HPC"), "hpc");
  assertEquals(trackFor("High-performance computing lead"), "hpc");
  assertEquals(trackFor("Open Payments"), "payments");
  assertEquals(trackFor("ashley@school.edu"), "hpc");
  assertEquals(trackFor("Program coordinator"), null);
  assertEquals(trackFor(""), null);
  assertEquals(trackFor(null), null);
});

Deno.test("recipientsFor: the matching facilitators, then the hub team, no doubles, lower-cased", () => {
  const p = recipientsFor("payments", FACS);
  assertEquals(p.to, ["casey@blazegroupllc.com", ...HUB_TEAM]);
  assertEquals(p.matched.map(facilitatorName), ["Casey Diké"]);
  assertEquals(recipientsFor("business", FACS).to, ["jarrell@example.edu", ...HUB_TEAM]);
  assertEquals(recipientsFor("hpc", FACS).to, ["ashley@example.edu", ...HUB_TEAM]);
  assertEquals(recipientsFor("hub", FACS).to, HUB_TEAM);
  /* nobody filed for a track → the hub team still hears it */
  assertEquals(recipientsFor("hpc", [FACS[0]]).to, HUB_TEAM);
  /* Nelson filed as a facilitator is not emailed twice */
  assertEquals(recipientsFor("business", [{ email: "TaylorMadeMD@gmail.com", label: "Nelson · Track 1" }]).to, ["taylormademd@gmail.com", "jware@aucenter.edu"]);
});

Deno.test("facilitatorName: the label's first part, else the email's first half", () => {
  assertEquals(facilitatorName(FACS[1]), "Casey Diké");
  assertEquals(facilitatorName(FACS[3]), "guest");
});

Deno.test("the student's ping emails the track's facilitators with the text, a reply-to of the student, and the queue link — then marks the row", async () => {
  const d = deps(row());
  const r = await handleHelp({ id: ID }, STUDENT, d, layout);
  assertEquals(r.status, 200);
  assertEquals(r.body.ok, true); assertEquals(r.body.emailed, true); assertEquals(r.body.to, 3);
  assertEquals(d.sent.length, 1);
  assertEquals(d.sent[0].to, ["casey@blazegroupllc.com", ...HUB_TEAM]);
  assertEquals(d.sent[0].replyTo, "kiara1.pee@famu.edu");
  assertEquals(d.sent[0].subject, "Kiara Pee needs help with the open payments track");
  assertStringIncludes(d.sent[0].html, "My wallet address never verifies.");
  assertStringIncludes(d.sent[0].html, "FAMU · Team The Rattlers");
  assertStringIncludes(d.sent[0].html, "Hi Casey, ");
  assertStringIncludes(d.sent[0].html, "https://taylormadeacademy.com/opil/hub/admin/#help");
  assertEquals(d.marks, ["pinged:" + ID]);
  assertEquals(d.rates, [["help_ping:u-kiara", 10, 3600]]);
});

Deno.test("a second ping does not email again", async () => {
  const d = deps(row({ pinged_at: "2026-09-17T14:01:00Z" }));
  const r = await handleHelp({ id: ID }, STUDENT, d, layout);
  assertEquals(r, { status: 200, body: { ok: true, already: true, emailed: false } });
  assertEquals(d.sent, []);
});

Deno.test("someone else's request cannot be pinged; a bad or unknown id is refused before any read", async () => {
  const d = deps(row());
  assertEquals((await handleHelp({ id: ID }, { id: "u-other", email: null, programTeam: false }, d, layout)).status, 403);
  assertEquals((await handleHelp({ id: "nope" }, STUDENT, d, layout)).status, 400);
  assertEquals((await handleHelp({}, STUDENT, d, layout)).status, 400);
  assertEquals((await handleHelp({ id: ID }, STUDENT, deps(null), layout)).status, 404);
  assertEquals(d.sent, []);
});

Deno.test("a row filed under a room: key (or no key) is never emailed — not by its student, not by the program team", async () => {
  const d = deps(row({ room_key: "room:9b1d" }));
  assertEquals((await handleHelp({ id: ID }, STUDENT, d, layout)).status, 403);
  assertEquals((await handleHelp({ id: ID, answer: "hi" }, CASEY, d, layout)).status, 403);
  const d2 = deps(row({ room_key: null }));
  assertEquals((await handleHelp({ id: ID }, STUDENT, d2, layout)).status, 403);
  assertEquals(d.sent, []); assertEquals(d2.sent, []); assertEquals(d.marks, []); assertEquals(d.saved, []);
  /* an OPIL session key is fine */
  const d3 = deps(row({ room_key: "opil:12" }));
  assertEquals((await handleHelp({ id: ID }, STUDENT, d3, layout)).status, 200);
  assertEquals(d3.sent.length, 1);
});

Deno.test("Resend not set up: the row is saved, the reply says so, nothing is marked pinged", async () => {
  const d = deps(row(), { send: async () => ({ ok: false, skipped: true }) });
  const r = await handleHelp({ id: ID }, STUDENT, d, layout);
  assertEquals(r.status, 200);
  assertEquals(r.body.emailed, false); assertEquals(r.body.why, "email_not_set_up");
  assertEquals(d.marks, []);
});

Deno.test("rate limit: a refused check answers slow_down; an unknown one lets it through", async () => {
  assertEquals((await handleHelp({ id: ID }, STUDENT, deps(row(), { rateCheck: async () => false }), layout)).status, 429);
  assertEquals((await handleHelp({ id: ID }, STUDENT, deps(row(), { rateCheck: async () => null }), layout)).status, 200);
});

Deno.test("a program-team answer saves the row, emails the student with both texts, reply-to the answerer, and marks it sent", async () => {
  const d = deps(row({ status: "claimed", claimed_by: "u-casey", claimed_name: "Casey Diké" }));
  const r = await handleHelp({ id: ID, answer: "  Use the test wallet from session 2 — the live one needs KYC first.\r\n\r\nPing me if it still fails. " }, CASEY, d, layout);
  assertEquals(r.status, 200);
  assertEquals(r.body, { ok: true, emailed: true, saved: true, why: undefined });
  assertEquals(d.saved, [[ID, "Use the test wallet from session 2 — the live one needs KYC first.\n\nPing me if it still fails.", "u-casey"]]);
  assertEquals(d.sent.length, 1);
  assertEquals(d.sent[0].to, ["kiara1.pee@famu.edu"]);
  assertEquals(d.sent[0].replyTo, "casey@blazegroupllc.com");
  assertEquals(d.sent[0].subject, "Casey Diké answered your question");
  assertStringIncludes(d.sent[0].html, "Hi Kiara, you asked about the open payments track");
  assertStringIncludes(d.sent[0].html, "My wallet address never verifies.");
  assertStringIncludes(d.sent[0].html, "Use the test wallet from session 2");
  assertStringIncludes(d.sent[0].html, "https://taylormadeacademy.com/opil/hub/#help");
  assertEquals(d.marks, ["sent:" + ID]);
});

Deno.test("an answer already saved by the page and not yet emailed is emailed without saving again; once sent it is not sent twice", async () => {
  const d = deps(row({ status: "answered", claimed_by: "u-casey", claimed_name: "Casey Diké", answer: "Use the test wallet." }));
  const r = await handleHelp({ id: ID, answer: "Use the test wallet." }, CASEY, d, layout);
  assertEquals(r.body.saved, false); assertEquals(d.sent.length, 1); assertEquals(d.marks, ["sent:" + ID]);
  const d2 = deps(row({ status: "answered", claimed_by: "u-casey", answer: "Use the test wallet.", answer_sent_at: "2026-09-17T15:00:00Z" }));
  const r2 = await handleHelp({ id: ID, answer: "Use the test wallet." }, CASEY, d2, layout);
  assertEquals(r2.body.already, true); assertEquals(d2.sent, []);
});

Deno.test("a student cannot answer; the program team cannot answer with nothing", async () => {
  assertEquals((await handleHelp({ id: ID, answer: "hi" }, STUDENT, deps(row()), layout)).status, 403);
  const r = await handleHelp({ id: ID }, CASEY, deps(row()), layout);
  assertEquals(r, { status: 400, body: { error: "no_answer" } });
});

Deno.test("cleanId / cleanAnswer", () => {
  assertEquals(cleanId(" " + ID.toUpperCase() + " "), ID);
  assertEquals(cleanId("123"), null);
  assertEquals(cleanAnswer("  a\r\nb  "), "a\nb");
  assertEquals(cleanAnswer("x".repeat(5000)).length, 4000);
});

Deno.test("emails never print raw HTML from a student", () => {
  const m = pingEmail(row({ text: "<script>alert(1)</script>" }), { email: "k@x.edu", name: "K <b>", school: null, team_name: null }, []);
  assert(!m.body.includes("<script>"));
  assertStringIncludes(m.body, "&lt;script&gt;");
  const a = answerEmail(row(), { email: "k@x.edu", name: "Kiara", school: null, team_name: null }, "<img src=x>", null);
  assert(!a.body.includes("<img"));
  assertEquals(a.subject, "A facilitator answered your question");
});
