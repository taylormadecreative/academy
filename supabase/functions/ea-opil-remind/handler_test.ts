// deno test supabase/functions/ea-opil-remind/   (the same rules are also proved under node: tests/opil/calendar.test.mjs)
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chunk, doorSentence, dueSessions, handleRemind, KIND, messagesFor, recipientsFromRegistration, type RemindDeps, secretMatches, type Session, subjectFor, zonedToUtcMs } from "./handler.ts";

const S = (no: number, kind: string, extra: Partial<Session> = {}): Session => ({ no, kind, title: "T" + no, session_date: null, start_time: null, end_time: null, ...extra });
const KICKOFF = S(1, "thread", { title: "Kickoff & Orientation", session_date: "2026-09-16", start_time: "18:30:00", end_time: "19:30:00" });
const START = zonedToUtcMs("2026-09-16", "18:30") as number;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const mail = { layout: (o: { heading: string; body: string }) => `<h1>${o.heading}</h1>${o.body}`, button: (h: string, l: string) => `<a href="${h}">${l}</a>`, esc };
const H = (secret: string | null) => ({ get: (k: string) => (k === "x-remind-secret" ? secret : null) });

function deps(over: Partial<RemindDeps> = {}) {
  const log = { claims: [] as string[], unclaims: [] as string[], batches: [] as string[][] };
  const d: RemindDeps & { log: typeof log } = {
    log,
    now: () => START - 30 * 60000,
    listSessions: async () => [KICKOFF, S(12, "milestone", { session_date: "2026-09-16" })],
    listReminded: async () => [],
    listRecipients: async () => [{ email: "a@x.edu", name: "A" }, { email: "b@x.edu", name: "B" }, { email: "A@x.edu" }],
    claim: async (k) => { log.claims.push(k); return true; },
    unclaim: async (k) => { log.unclaims.push(k); },
    sendBatch: async (msgs) => { log.batches.push(msgs.map((m) => m.to)); return { ok: true, ids: msgs.map(() => "id") }; },
    wait: async () => {},
    ...mail,
    ...over,
  };
  return d;
}

Deno.test("6:30 PM Atlanta is 22:30Z in September and 23:30Z in December", () => {
  assertEquals(zonedToUtcMs("2026-09-16", "18:30:00"), Date.UTC(2026, 8, 16, 22, 30));
  assertEquals(zonedToUtcMs("2026-12-02", "18:30"), Date.UTC(2026, 11, 2, 23, 30));
  assertEquals(zonedToUtcMs("2026-09-16", null), null);
  assertEquals(subjectFor(START), "Class starts at 6:30 PM ET — here’s your link");
});

Deno.test("dueSessions: 25–35 minutes out, not reminded, with a time; never a milestone or a hidden room", () => {
  const sessions = [KICKOFF, S(12, "milestone", { session_date: "2026-09-16", start_time: "18:30" }), S(2, "thread", { session_date: "2026-09-16", start_time: "18:30" }), S(201, "curriculum", { session_date: "2026-09-16" })];
  const at = (min: number) => START - min * 60000;
  assertEquals(dueSessions(sessions, [], at(30)).map((d) => d.roomKey), ["opil:1"]);
  assertEquals(dueSessions(sessions, [], at(25)).length, 1);
  assertEquals(dueSessions(sessions, [], at(35)).length, 1);
  assertEquals(dueSessions(sessions, [], at(24)).length, 0);
  assertEquals(dueSessions(sessions, [], at(36)).length, 0);
  assertEquals(dueSessions(sessions, ["opil:1"], at(30)).length, 0);
});

Deno.test("messagesFor: one email per address, deduped, with the link and the no-code sentence", () => {
  const [due] = dueSessions([KICKOFF], [], START - 30 * 60000);
  const msgs = messagesFor(due, [{ email: "Kiara1.Pee@FAMU.edu", name: "Kiara Pee" }, { email: "kiara1.pee@famu.edu" }, { email: "bad" }], mail);
  assertEquals(msgs.map((m) => m.to), ["kiara1.pee@famu.edu"]);
  assert(msgs[0].html.includes("https://taylormadeacademy.com/opil/hub/live/?s=1"));
  assert(msgs[0].html.includes("No code needed — type the email you applied with"));
  assert(msgs[0].html.includes("Hi Kiara,"));
  assert(msgs[0].html.includes("5:30 PM CT"));
  assertEquals(chunk(Array.from({ length: 250 }, (_, i) => i)).length, 3);
});

Deno.test("secretMatches", () => {
  assertEquals(secretMatches("abc", "abc"), true);
  assertEquals(secretMatches("abd", "abc"), false);
  assertEquals(secretMatches("", ""), false);
  assertEquals(secretMatches(null, "abc"), false);
});

Deno.test("handleRemind: the right secret claims, sends, reports; the wrong one is refused; no secret is 503", async () => {
  const d = deps();
  const r = await handleRemind(H("s3cret"), "s3cret", d);
  assertEquals(r.status, 200);
  assertEquals(r.body.sent, 2);
  assertEquals(d.log.claims, ["opil:1"]);
  assertEquals(d.log.batches, [["a@x.edu", "b@x.edu"]]);
  assertEquals(await handleRemind(H("nope"), "s3cret", d), { status: 401, body: { error: "forbidden" } });
  assertEquals(await handleRemind(H("s3cret"), undefined, d), { status: 503, body: { error: "not_configured" } });
  assertEquals(d.log.claims.length, 1);
});

Deno.test("handleRemind: an already-claimed room is skipped; a failed send gives the claim back", async () => {
  const skipped = await handleRemind(H("s3cret"), "s3cret", deps({ claim: async () => false }));
  assertEquals(skipped.body.skipped, [{ room_key: "opil:1", why: "already_sent" }]);
  let tries = 0;
  const d = deps({ sendBatch: async () => { tries++; return { ok: false, ids: [], error: "resend_500" }; } });
  const failed = await handleRemind(H("s3cret"), "s3cret", d);
  assertEquals(failed.body.sent, 0);
  assertEquals(d.log.unclaims, ["opil:1"]);
  assertEquals(tries, 2, "tried twice before giving up");
  assertEquals(KIND, "start-30");
});

Deno.test("handleRemind: an empty list or a lookup that throws gives the claim back", async () => {
  const empty = deps({ listRecipients: async () => [] });
  const r1 = await handleRemind(H("s3cret"), "s3cret", empty);
  assertEquals(r1.body.skipped, [{ room_key: "opil:1", why: "no_recipients" }]);
  assertEquals(empty.log.unclaims, ["opil:1"]);
  const broken = deps({ listRecipients: async () => { throw new Error("registrations: timeout"); } });
  const r2 = await handleRemind(H("s3cret"), "s3cret", broken);
  assertEquals(r2.body.skipped, [{ room_key: "opil:1", why: "lookup_failed" }]);
  assertEquals(broken.log.unclaims, ["opil:1"]);
  assertEquals(broken.log.batches, []);
});

Deno.test("handleRemind: a chunk refused twice is counted as missed; the rest still goes out", async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ email: `s${i}@x.edu` }));
  const d = deps({ listRecipients: async () => many });
  d.sendBatch = async (msgs) => { d.log.batches.push(msgs.map((m) => m.to)); return msgs[0].to === "s100@x.edu" ? { ok: false, ids: [], error: "resend_429" } : { ok: true, ids: msgs.map(() => "id") }; };
  const r = await handleRemind(H("s3cret"), "s3cret", d);
  assertEquals(r.body.sent, 150);
  assertEquals((r.body.due as { missed: number }[])[0].missed, 100);
  assertEquals(d.log.batches.map((b) => b.length), [100, 100, 100, 50]);
  assertEquals(d.log.unclaims, []);
});

Deno.test("a registration is a whole team; the door sentence fits the reader", () => {
  const r = recipientsFromRegistration({ email: "lead@famu.edu", personal_email: "lead@gmail.com", full_name: "Lead", members: [{ name: "B", email: "b@famu.edu" }, { name: "no address" }, "junk"] });
  assertEquals(r.map((x) => [x.email, x.kind]), [["lead@famu.edu", "student"], ["lead@gmail.com", "student"], ["b@famu.edu", "teammate"]]);
  const [due] = dueSessions([KICKOFF], [], START - 30 * 60000);
  const msgs = messagesFor(due, [{ email: "s@famu.edu", kind: "student" }, { email: "f@auc.edu", kind: "facilitator" }], mail);
  assert(msgs[0].html.includes("No code needed"));
  assert(msgs[1].html.includes("sign in with the code the page emails you"));
  assert(!msgs[1].html.includes("No code needed"));
  assertEquals(doorSentence(undefined), doorSentence("student"));
});
