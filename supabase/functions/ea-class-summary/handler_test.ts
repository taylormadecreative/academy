// deno test supabase/functions/ea-class-summary/
import { assertEquals, assertMatch, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildUserPrompt, chaptersFrom, cleanKey, fmtClock, handleSummary, parseSummary, transcriptForPrompt, type EventRow, type SummaryDeps, type TranscriptRow } from "./handler.ts";

const T0 = "2026-09-16T22:30:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const ROWS: TranscriptRow[] = [
  { id: "l1", at: at(5), speaker_name: "Jamal Ware", text: "Welcome to the lab. Tonight we build the first agent." },
  { id: "l2", at: at(90), speaker_name: "Kiara Pee", text: "How does an agent decide what to do?" },
  { id: "l3", at: at(3500), speaker_name: "Jamal Ware", text: "For next week, read chapter two and bring one question." },
];
const EVENTS: EventRow[] = [
  { id: "e1", at: at(60), kind: "stage", label: null, data: { name: "Kiara Pee" } },
  { id: "e2", at: at(600), kind: "file", label: null, data: { title: "Week 1 slides.pdf" } },
  { id: "e3", at: at(-500), kind: "poll", label: null, data: { question: "old" } },
];
const MODEL_ANSWER = JSON.stringify({ summary: ["Jamal opened the lab and set the goal: build a first agent.", "Kiara asked how an agent decides; the answer was tools plus a loop.", "The slides walked through the loop.", "Everyone tried one call.", "Next week is chapter two."], assignments: ["Read chapter two and bring one question — next week"] });

function deps(over: Partial<SummaryDeps> = {}) {
  const saved: unknown[] = [];
  const calls: { system: string; user: string }[] = [];
  const d: SummaryDeps & { saved: unknown[]; calls: typeof calls } = {
    saved, calls,
    canRun: async () => true,
    loadTranscript: async () => ROWS,
    loadEvents: async () => EVENTS,
    roomFacts: async () => ({ kind: "opil", title: "Kickoff: your first agent", date: "2026-09-16", facilitator: "Jamal Ware" }),
    startedAt: async () => T0,
    provider: () => ({ name: "anthropic", model: "claude-sonnet-5" }),
    complete: async (_p, system, user) => { calls.push({ system, user }); return MODEL_ANSWER; },
    save: async (row) => { saved.push(row); },
    ...over,
  };
  return d;
}

Deno.test("cleanKey accepts the three class keys and nothing else", () => {
  assertEquals(cleanKey(" OPIL:1 "), "opil:1");
  assertEquals(cleanKey("room:5f4a1d2e-3b6c-4d7e-8f90-a1b2c3d4e5f6"), "room:5f4a1d2e-3b6c-4d7e-8f90-a1b2c3d4e5f6");
  assertEquals(cleanKey("team:5f4a1d2e-3b6c-4d7e-8f90-a1b2c3d4e5f6"), "team:5f4a1d2e-3b6c-4d7e-8f90-a1b2c3d4e5f6");
  for (const bad of ["", "opil:", "opil:x", "session:1", "room:abc", null, undefined, 4]) assertEquals(cleanKey(bad), null, String(bad));
});

Deno.test("chaptersFrom: offsets from the recording start, the page's clock, events from long before dropped", () => {
  const ch = chaptersFrom(EVENTS, T0);
  assertEquals(ch, [
    { at: at(60), offset: 60, kind: "stage", label: "Kiara Pee on stage" },
    { at: at(600), offset: 600, kind: "file", label: "Showed Week 1 slides.pdf" },
  ]);
  assertEquals(chaptersFrom(EVENTS, null, at(30))[0].offset, 30, "without a replay start, the first line said is the start");
  assertEquals(chaptersFrom(EVENTS, null, null), []);
  assertEquals(fmtClock(3735), "1:02:15");
});

Deno.test("transcriptForPrompt: clocked lines; over budget the middle is cut and marked", () => {
  const t = transcriptForPrompt(ROWS, T0);
  assertEquals(t.cut, false);
  assertStringIncludes(t.text, "[0:05] Jamal Ware: Welcome to the lab.");
  assertStringIncludes(t.text, "[58:20] Jamal Ware: For next week");
  const long = Array.from({ length: 400 }, (_, i) => ({ id: "x" + i, at: at(i), speaker_name: "S", text: "word ".repeat(40) }));
  const c = transcriptForPrompt(long, T0, 5000);
  assertEquals(c.cut, true);
  assertStringIncludes(c.text, "[… the middle of the class is left out here …]");
  assertEquals(c.text.length < 5200, true);
});

Deno.test("buildUserPrompt names the class, the timeline and the transcript", () => {
  const p = buildUserPrompt({ facts: { title: "Kickoff", date: "2026-09-16", facilitator: "Jamal Ware" }, chapters: chaptersFrom(EVENTS, T0), transcript: "x", cut: false, lineCount: 3 });
  assertStringIncludes(p, "Class: Kickoff (2026-09-16), led by Jamal Ware.");
  assertStringIncludes(p, "1:00 Kiara Pee on stage");
  assertStringIncludes(p, "Transcript (3 lines):");
  const none = buildUserPrompt({ facts: null, chapters: [], transcript: "", cut: false, lineCount: 0 });
  assertStringIncludes(none, "Timeline: nothing was logged.");
  assertStringIncludes(none, "Transcript: no lines were captured.");
});

Deno.test("parseSummary: JSON, fenced JSON, or plain lines — five lines at most, bullets stripped", () => {
  const j = parseSummary(MODEL_ANSWER);
  assertEquals(j.summary.split("\n").length, 5);
  assertEquals(j.assignments, ["Read chapter two and bring one question — next week"]);
  const fenced = parseSummary("```json\n" + JSON.stringify({ summary: "- One\n- Two", assignments: [{ text: "Read ch. 2" }] }) + "\n```");
  assertEquals(fenced.summary, "One\nTwo"); assertEquals(fenced.assignments, ["Read ch. 2"]);
  const plain = parseSummary("Sure! Here is the lesson:\n1. One\n2. Two\n3. Three\n4. Four\n5. Five\n6. Six");
  assertEquals(plain.summary.split("\n").length, 5); assertEquals(plain.assignments, []);
  assertEquals(parseSummary("").summary, "");
});

Deno.test("parseSummary: an answer cut off mid-JSON is refused, never saved as the lesson", () => {
  assertEquals(parseSummary('{"summary": ["Jamal opened the lab and set the goal'), { summary: "", assignments: [] });
  assertEquals(parseSummary('```json\n{"summary": ["One", "Tw'), { summary: "", assignments: [] });
});

Deno.test("a cut-off model answer → model_failed and nothing is saved", async () => {
  const cut = deps({ complete: async () => '{"summary": ["Jamal opened the lab' });
  assertEquals(await handleSummary({ room_key: "opil:1" }, cut), { status: 502, body: { error: "model_failed" } });
  assertEquals(cut.saved, []);
});

Deno.test("a coordinator gets the lesson back and it is saved under the class key with the model's name", async () => {
  const d = deps();
  const r = await handleSummary({ room_key: "opil:1" }, d);
  assertEquals(r.status, 200);
  assertEquals(r.body.ok, true); assertEquals(r.body.room_key, "opil:1"); assertEquals(r.body.model, "anthropic:claude-sonnet-5");
  assertEquals((r.body.summary as string).split("\n").length, 5);
  assertEquals(r.body.assignments, ["Read chapter two and bring one question — next week"]);
  assertEquals((r.body.chapters as unknown[]).length, 2);
  assertEquals(d.saved.length, 1);
  assertEquals((d.saved[0] as { room_key: string }).room_key, "opil:1");
  assertMatch(d.calls[0].system, /Never invent/);
  assertStringIncludes(d.calls[0].user, "led by Jamal Ware");
});

Deno.test("no key on the server → no_key before anything is read", async () => {
  let read = 0;
  const d = deps({ provider: () => null, loadTranscript: async () => { read++; return ROWS; } });
  const r = await handleSummary({ room_key: "opil:1" }, d);
  assertEquals(r, { status: 503, body: { error: "no_key" } });
  assertEquals(read, 0); assertEquals(d.saved, []);
});

Deno.test("not the coordinator or the host → not_allowed; a bad key → bad_key", async () => {
  const d = deps({ canRun: async () => false });
  assertEquals(await handleSummary({ room_key: "opil:1" }, d), { status: 403, body: { error: "not_allowed" } });
  assertEquals(await handleSummary({ room_key: "nope" }, deps()), { status: 400, body: { error: "bad_key" } });
  assertEquals(await handleSummary({}, deps()), { status: 400, body: { error: "bad_key" } });
});

Deno.test("nothing saved for the class → nothing_to_summarize, no model call", async () => {
  const d = deps({ loadTranscript: async () => [], loadEvents: async () => [] });
  const r = await handleSummary({ room_key: "opil:1" }, d);
  assertEquals(r, { status: 409, body: { error: "nothing_to_summarize" } });
  assertEquals(d.calls.length, 0);
});

Deno.test("events without a transcript still make a lesson (chapters only)", async () => {
  const d = deps({ loadTranscript: async () => [], complete: async () => JSON.stringify({ summary: ["Kiara came on stage.", "The slides were shown."], assignments: [] }) });
  const r = await handleSummary({ room_key: "opil:1" }, d);
  assertEquals(r.status, 200);
  assertEquals((r.body.chapters as unknown[]).length, 2);
});

Deno.test("the model fails or answers with nothing → model_failed and nothing is saved", async () => {
  const boom = deps({ complete: async () => { throw new Error("529 overloaded"); } });
  assertEquals(await handleSummary({ room_key: "opil:1" }, boom), { status: 502, body: { error: "model_failed" } });
  assertEquals(boom.saved, []);
  const empty = deps({ complete: async () => "   " });
  assertEquals((await handleSummary({ room_key: "opil:1" }, empty)).body, { error: "model_failed" });
});

Deno.test("OpenAI is the provider when it is the one with a key", async () => {
  const d = deps({ provider: () => ({ name: "openai", model: "gpt-5-mini" }) });
  const r = await handleSummary({ room_key: "opil:1" }, d);
  assertEquals(r.body.model, "openai:gpt-5-mini");
});
