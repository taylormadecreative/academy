// deno test supabase/functions/ea-event-remind/
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dueEvents, type EventRow, handleRemind, messagesFor, type RemindDeps, secretMatches } from "./handler.ts";

const START = Date.UTC(2026, 9, 4, 0, 0);   // Sat Oct 3 2026, 7:00 PM CDT
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const mail = {
  layout: (o: { heading: string; body: string; kicker?: string }) => `<k>${o.kicker}</k><h1>${o.heading}</h1>${o.body}`,
  button: (h: string, l: string) => `<a href="${h}">${l}</a>`,
  esc,
  when: () => "Saturday, October 3 at 7:00 PM CDT",
  site: "https://taylormadeacademy.com",
};
const EV = (over: Partial<EventRow> = {}): EventRow => ({
  id: "e1", workshop_slug: "ai101", title: "AI 101", starts_at: new Date(START).toISOString(), tz: "America/Chicago",
  format: "virtual", status: "on_sale", join_url: "https://taylormadeacademy.com/room/?k=abc", venue_label: null, venue_address: null, ...over,
});
const H = (s: string | null) => ({ get: (k: string) => (k === "x-remind-secret" ? s : null) });

function deps(over: Partial<RemindDeps> = {}) {
  const log = { claims: [] as string[], unclaims: [] as string[], batches: [] as string[][], subjects: [] as string[] };
  const d: RemindDeps & { log: typeof log } = {
    log,
    now: () => START - 20 * 3600e3,
    listEvents: async () => [EV()],
    listReminded: async () => [],
    listRecipients: async () => [{ email: "A@x.com", name: "ann lee" }, { email: "a@x.com" }, { email: "b@x.com", name: "Bo" }, { email: "nope" }],
    claim: async (id, k) => { log.claims.push(id + ":" + k); return true; },
    unclaim: async (id, k) => { log.unclaims.push(id + ":" + k); },
    sendBatch: async (m) => { log.batches.push(m.map((x) => x.to)); log.subjects.push(...m.map((x) => x.subject)); return { ok: true, ids: m.map(() => "id") }; },
    ...mail,
    ...over,
  };
  return d;
}

Deno.test("windows: day-before between 3 and 24 hours out, hour-before inside the last hour", () => {
  const at = (min: number) => START - min * 60000;
  const kinds = (min: number, done: string[] = []) => dueEvents([EV()], done, at(min)).map((d) => d.kind);
  assertEquals(kinds(24 * 60 + 5), []);
  assertEquals(kinds(24 * 60), ["day-before"]);
  assertEquals(kinds(200), ["day-before"]);
  assertEquals(kinds(180), []);                        // booked late: no "tomorrow" email
  assertEquals(kinds(90), []);
  assertEquals(kinds(60), ["hour-before"]);
  assertEquals(kinds(5), ["hour-before"]);
  assertEquals(kinds(0), []);                          // started: nothing
  assertEquals(kinds(-10), []);
  assertEquals(kinds(30, ["e1:hour-before"]), []);     // already sent
  assertEquals(dueEvents([EV({ status: "draft" })], [], at(30)), []);
  assertEquals(dueEvents([EV({ starts_at: "junk" })], [], at(30)), []);
});

Deno.test("messages: one per address, lower-cased, bad addresses dropped; AI 101 carries the room + cheat sheet", () => {
  const [due] = dueEvents([EV()], [], START - 30 * 60000);
  const msgs = messagesFor(due, [{ email: "A@x.com", name: "ann" }, { email: "a@x.com" }, { email: "b@x.com" }, { email: "bad" }], mail);
  assertEquals(msgs.map((m) => m.to), ["a@x.com", "b@x.com"]);
  assertEquals(msgs[0].subject, "Starting in an hour: AI 101");
  assert(msgs[0].html.includes("Hi Ann,"));
  assert(msgs[0].html.includes("/room/?k=abc"));
  assert(msgs[0].html.includes("/ai101/cheat-sheet.pdf"));
  assert(msgs[0].html.includes("Free class"));
});

Deno.test("messages: a paid date sends the room to online seats and the address to in-person seats, no cheat sheet", () => {
  const ev = EV({ id: "e2", workshop_slug: "build-your-first-ai-agent", title: "Build Your First AI Agent", venue_address: "123 Studio Rd" });
  const [due] = dueEvents([ev], [], START - 20 * 3600e3);
  const msgs = messagesFor(due, [{ email: "on@x.com" }, { email: "in@x.com", inPerson: true }, { email: "IN@x.com" }], mail);
  assertEquals(msgs.length, 2);
  assert(msgs[0].subject.startsWith("Tomorrow: Build Your First AI Agent"));
  assert(msgs[0].html.includes("Open the room") && !msgs[0].html.includes("cheat-sheet"));
  assert(msgs[1].html.includes("123 Studio Rd") && !msgs[1].html.includes("Open the room"));
});

Deno.test("knock: secret checked, one claim, one batch, deduped", async () => {
  assertEquals((await handleRemind(H("x"), undefined, deps())).status, 503);
  assertEquals((await handleRemind(H("wrong"), "right", deps())).status, 401);
  assert(!secretMatches("abc", "abcd"));
  const d = deps();
  const r = await handleRemind(H("right"), "right", d);
  assertEquals(r.status, 200);
  assertEquals(r.body.sent, 2);
  assertEquals(d.log.claims, ["e1:day-before"]);
  assertEquals(d.log.batches, [["a@x.com", "b@x.com"]]);
  assertEquals(d.log.unclaims, []);
});

Deno.test("knock: the claim is handed back when nothing could be sent", async () => {
  const empty = deps({ listRecipients: async () => [] });
  await handleRemind(H("s"), "s", empty);
  assertEquals(empty.log.unclaims, ["e1:day-before"]);
  const broken = deps({ listRecipients: async () => { throw new Error("db down"); } });
  const r = await handleRemind(H("s"), "s", broken);
  assertEquals(broken.log.unclaims, ["e1:day-before"]);
  assert(String((r.body.skipped as string[])[0]).includes("lookup failed"));
  const refused = deps({ sendBatch: async () => ({ ok: false, ids: [], error: "resend_500" }) });
  await handleRemind(H("s"), "s", refused);
  assertEquals(refused.log.unclaims, ["e1:day-before"]);
  const taken = deps({ claim: async () => false });
  const r2 = await handleRemind(H("s"), "s", taken);
  assertEquals(r2.body.sent, 0);
  assertEquals(taken.log.batches, []);
});
