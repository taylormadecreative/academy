// ea-class-summary — the rules. A coordinator or the class's host asks for the lesson of a class:
// the function reads what was said (ea_class_transcripts) and what happened (ea_class_events),
// asks a model for five plain lines + what was assigned, files it in ea_class_summaries, and hands
// it back. No key on the server → `no_key` (the page says "Summary isn't set up yet"); nothing
// saved for the class → `nothing_to_summarize`. Pure: every outside touch is a dep; handler_test.ts is the proof.
export type SummaryBody = { room_key?: unknown };
export type TranscriptRow = { id: string; at: string; speaker_name: string | null; text: string };
export type EventRow = { id: string; at: string; kind: string; label: string | null; data: Record<string, unknown> | null };
export type RoomFacts = { kind?: string; title?: string; date?: string; starts?: string; facilitator?: string | null; host?: string | null } | null;
export type Provider = { name: "anthropic" | "openai"; model: string };
export type SummaryOut = { summary: string; assignments: string[]; chapters: Chapter[]; model: string };
export type Chapter = { at: string; offset: number; kind: string; label: string };
export type SummaryDeps = {
  /* may this caller make the summary for this class? (admin, or ea_class_is_host as the caller) */
  canRun: (roomKey: string) => Promise<boolean>;
  loadTranscript: (roomKey: string) => Promise<TranscriptRow[]>;
  loadEvents: (roomKey: string) => Promise<EventRow[]>;
  roomFacts: (roomKey: string) => Promise<RoomFacts>;
  /* when the recording began (the replay row's created_at), or null: chapters are offsets from it */
  startedAt: (roomKey: string) => Promise<string | null>;
  /* how long that recording is, in seconds, or null. A standing room (HT, the Academy) files every session under
     ONE key for the life of the room, so the summary must read only the lines and events inside this replay's
     window — otherwise every rehearsal since the room was made lands in the notes. Optional: without it the
     window is open-ended after the start. */
  durationS?: (roomKey: string) => Promise<number | null>;
  /* which model may answer, or null when no key is set */
  provider: () => Provider | null;
  /* one completion: the system prompt + the user prompt → the model's text (throws on a failed call) */
  complete: (provider: Provider, system: string, user: string) => Promise<string>;
  save: (row: { room_key: string } & SummaryOut) => Promise<void>;
};
export type SummaryReply = { status: number; body: Record<string, unknown> };

export const ROOM_KEY_RX = /^(opil:\d{1,6}|room:[0-9a-f-]{36}|team:[0-9a-f-]{36})$/;
export const TRANSCRIPT_BUDGET = 60000;   /* characters of transcript sent to the model (~15k tokens) */
export const MAX_SUMMARY_LINES = 5;

export function cleanKey(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return ROOM_KEY_RX.test(s) ? s : null;
}

/* seconds → "0:07" / "12:03" / "1:02:15" — the same clock the page shows */
export function fmtClock(s: number): string {
  let n = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(n / 3600); n -= h * 3600;
  const m = Math.floor(n / 60), sec = n - m * 60;
  const two = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
const clean = (s: unknown, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/* one row of the timeline, said plainly (mirrors js/rtk-chapters.js chapterLabel) */
export function chapterLabel(ev: EventRow): string {
  const d = (ev.data || {}) as Record<string, unknown>;
  const label = clean(ev.label);
  switch (ev.kind) {
    case "stage": return label || `${clean(d.name) || "Someone"} on stage`;
    case "file": return label || `Showed ${clean(d.title) || "a file"}`;
    case "groups_start": return "Small groups";
    case "groups_end": return "Back together";
    case "poll": return label || `Poll${clean(d.question) ? ": " + clean(d.question) : ""}`;
    case "board": return label || "Whiteboard";
    default: return label || clean(ev.kind) || "Something happened";
  }
}
/* is this row inside the replay's window? Without a start everything is in; before the start (a minute of grace for
   the lines said while the recording spun up) is out; with a duration, more than a quarter hour after the end is out
   (the transcript flushes and a board save can land a little after End). */
export const WINDOW_BEFORE_S = 60, WINDOW_AFTER_S = 15 * 60;
export function inWindow(at: string, startedAt: string | null, durationS: number | null): boolean {
  const t0 = Date.parse(startedAt || ""); if (!(t0 > 0)) return true;
  const t = Date.parse(at || ""); if (!(t > 0)) return false;
  if (t < t0 - WINDOW_BEFORE_S * 1000) return false;
  if (Number(durationS) > 0 && t > t0 + (Number(durationS) + WINDOW_AFTER_S) * 1000) return false;
  return true;
}

/* the chapters as offsets from the recording's start; without a start, from the first line said or the first event */
export function chaptersFrom(events: EventRow[], startedAt: string | null, fallbackStart?: string | null): Chapter[] {
  const t0 = Date.parse(startedAt || fallbackStart || "");
  if (!(t0 > 0)) return [];
  return events
    .map((ev) => { const at = Date.parse(ev.at); return { ev, at, off: Math.round((at - t0) / 1000) }; })
    .filter((x) => x.at > 0 && x.off >= -60)
    .map((x) => ({ at: x.ev.at, offset: Math.max(0, x.off), kind: x.ev.kind, label: chapterLabel(x.ev) }))
    .sort((a, b) => a.offset - b.offset);
}

/* the transcript as text the model reads: "[12:03] Jamal Ware: …" per line. Over budget, the middle is
   cut and marked — the opening and the close of a class carry the assignments. */
export function transcriptForPrompt(rows: TranscriptRow[], startedAt: string | null, budget = TRANSCRIPT_BUDGET): { text: string; cut: boolean } {
  const t0 = Date.parse(startedAt || rows[0]?.at || "");
  const lines = rows.map((r) => {
    const at = Date.parse(r.at);
    const clock = t0 > 0 && at > 0 ? `[${fmtClock(Math.max(0, (at - t0) / 1000))}] ` : "";
    return `${clock}${clean(r.speaker_name, 80) || "Someone"}: ${clean(r.text, 4000)}`;
  });
  const full = lines.join("\n");
  if (full.length <= budget) return { text: full, cut: false };
  const head = Math.floor(budget * 0.6), tail = budget - head;
  return { text: full.slice(0, head) + "\n[… the middle of the class is left out here …]\n" + full.slice(full.length - tail), cut: true };
}

export const SYSTEM_PROMPT = `You write the lesson notes for a recorded class so a student who missed it can catch up in one minute.
Write for a college student in plain English. Sentence case. No jargon that was not said in class. Never invent a fact, a name, or an assignment that is not in the transcript or the timeline.
Answer with JSON only, no code fences, in exactly this shape:
{"summary": ["line 1", "line 2", "line 3", "line 4", "line 5"], "assignments": ["what was assigned, with who and when if said"]}
Rules: "summary" is five short lines (fewer only if the class was very short), each one thing that was taught or decided, in the order it happened. "assignments" lists every task, reading, or thing to bring next time that the facilitator asked for; an empty list when nothing was assigned. Plain strings, no markdown.`;

export function buildUserPrompt(o: { facts: RoomFacts; chapters: Chapter[]; transcript: string; cut: boolean; lineCount: number }): string {
  const f = o.facts || {};
  const who = clean(f.facilitator || f.host, 80);
  const head = [
    `Class: ${clean(f.title, 160) || "a class"}${f.date ? ` (${clean(f.date, 40)})` : ""}${who ? `, led by ${who}` : ""}.`,
    o.chapters.length ? `Timeline (minutes:seconds from the start):\n${o.chapters.map((c) => `${fmtClock(c.offset)} ${c.label}`).join("\n")}` : "Timeline: nothing was logged.",
    o.lineCount ? `Transcript (${o.lineCount} lines${o.cut ? ", the middle left out for length" : ""}):\n${o.transcript}` : "Transcript: no lines were captured.",
  ];
  return head.join("\n\n");
}

/* the model's text → {summary, assignments}: JSON first, a fenced block or a stray sentence tolerated.
   An answer that STARTS like JSON but never parses (cut off mid-string) is refused — an empty summary —
   so a fragment like `{"summary": ["Jamal opened the lab` is never saved as the lesson. */
export function parseSummary(text: string): { summary: string; assignments: string[] } {
  const raw = String(text ?? "").trim();
  const tryJson = (s: string) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let j = tryJson(raw);
  if (!j) { const m = /\{[\s\S]*\}/.exec(raw); if (m) j = tryJson(m[0]); }
  const looksLikeJson = /^(?:```[a-z]*\s*)?\{/.test(raw);
  if (!j && looksLikeJson) return { summary: "", assignments: [] };
  const toLines = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [])
    .map((x) => clean(typeof x === "object" && x ? (x as Record<string, unknown>).text ?? (x as Record<string, unknown>).task ?? "" : x, 400))
    .map((x) => x.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (j && typeof j === "object") {
    const summary = toLines((j as Record<string, unknown>).summary).slice(0, MAX_SUMMARY_LINES);
    const assignments = toLines((j as Record<string, unknown>).assignments).slice(0, 20);
    if (summary.length) return { summary: summary.join("\n"), assignments };
  }
  /* not JSON: take the first five non-empty lines as the summary and nothing as assigned */
  const summary = toLines(raw.replace(/```[a-z]*|```/g, "")).slice(0, MAX_SUMMARY_LINES);
  return { summary: summary.join("\n"), assignments: [] };
}

export async function handleSummary(body: SummaryBody, deps: SummaryDeps): Promise<SummaryReply> {
  const key = cleanKey(body?.room_key);
  if (!key) return { status: 400, body: { error: "bad_key" } };
  if (!(await deps.canRun(key))) return { status: 403, body: { error: "not_allowed" } };
  const provider = deps.provider();
  if (!provider) return { status: 503, body: { error: "no_key" } };
  const [allRows, allEvents, facts, startedAt, durationS] = await Promise.all([deps.loadTranscript(key), deps.loadEvents(key), deps.roomFacts(key), deps.startedAt(key), deps.durationS ? deps.durationS(key) : Promise.resolve(null)]);
  /* only this replay's session — a standing room's key carries every session it ever held */
  const rows = allRows.filter((r) => inWindow(r.at, startedAt, durationS));
  const events = allEvents.filter((e) => inWindow(e.at, startedAt, durationS));
  if (!rows.length && !events.length) return { status: 409, body: { error: "nothing_to_summarize" } };
  const chapters = chaptersFrom(events, startedAt, rows[0]?.at ?? events[0]?.at ?? null);
  const t = transcriptForPrompt(rows, startedAt);
  const user = buildUserPrompt({ facts, chapters, transcript: t.text, cut: t.cut, lineCount: rows.length });
  let text: string;
  try { text = await deps.complete(provider, SYSTEM_PROMPT, user); }
  catch (e) { console.error("[ea-class-summary] model", (e as Error)?.message || e); return { status: 502, body: { error: "model_failed" } }; }
  const parsed = parseSummary(text);
  if (!parsed.summary) return { status: 502, body: { error: "model_failed" } };
  const out: SummaryOut = { summary: parsed.summary, assignments: parsed.assignments, chapters, model: `${provider.name}:${provider.model}` };
  try { await deps.save({ room_key: key, ...out }); }
  catch (e) { console.error("[ea-class-summary] save", (e as Error)?.message || e); return { status: 500, body: { error: "save_failed" } }; }
  return { status: 200, body: { ok: true, room_key: key, ...out } };
}
