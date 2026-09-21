// ea-class-summary — the lesson of a recorded class: five plain lines, what was assigned, the chapters.
// The rules live in handler.ts; handler_test.ts is the proof. This file wires the world in: who is
// calling (the service-role client + the caller's own token, as every OPIL room function does), the
// class's transcript and timeline, the replay's start time, the model, and the row it writes.
//
//   POST { room_key }  Authorization: Bearer <the caller's access token>
//     200 { ok, room_key, summary, assignments, chapters, model }
//     400 { error: "bad_key" }              not a class key (opil:N | room:<uuid> | team:<uuid>)
//     401 { error: "sign_in" }              no usable token
//     403 { error: "not_allowed" }          not a coordinator / admin / the class's host
//     409 { error: "nothing_to_summarize" } nothing saved for that class yet
//     502 { error: "model_failed" }         the model did not answer
//     503 { error: "no_key" }               no ANTHROPIC_API_KEY and no OPENAI_API_KEY on the server
//
// Model: Anthropic `claude-sonnet-5` when ANTHROPIC_API_KEY is set; else OpenAI (SUMMARY_MODEL, default
// gpt-5-mini) when OPENAI_API_KEY is set. Called by the coordinator page's Publish and Make summary.
// Deploy: supabase functions deploy ea-class-summary --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
// Secrets: ANTHROPIC_API_KEY (or OPENAI_API_KEY [+ SUMMARY_MODEL]), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "../_shared/rtk_auth.ts";
import { handleSummary, canRunSummary, type EventRow, type Provider, type SummaryBody, type TranscriptRow } from "./handler.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const ANTHROPIC_MODEL = "claude-sonnet-5";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";
const MAX_LINES = 20000;  /* transcript rows read per class at most (a two-hour class is ~1,500) */
const PAGE_ROWS = 1000;   /* the database answers at most 1,000 rows per request (PostgREST's cap), so the read pages */
const MAX_TOKENS = 16000; /* thinking counts against this on claude-sonnet-5; the answer itself is a few hundred tokens */

/* every row, a page at a time, until a page comes back short */
export async function loadAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, pageSize = PAGE_ROWS, maxRows = MAX_LINES): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data || [];
    rows.push(...(page as T[]));
    if (page.length < pageSize || rows.length >= maxRows) return rows;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* the provider from the secrets: Anthropic first, then OpenAI, else none */
export function pickProvider(env: { get: (k: string) => string | undefined }): Provider | null {
  if (env.get("ANTHROPIC_API_KEY")) return { name: "anthropic", model: ANTHROPIC_MODEL };
  if (env.get("OPENAI_API_KEY")) return { name: "openai", model: (env.get("SUMMARY_MODEL") || "").trim() || OPENAI_DEFAULT_MODEL };
  return null;
}

/* one completion, raw HTTP (the functions here carry no SDKs): the model's text, or a throw */
async function complete(provider: Provider, system: string, user: string): Promise<string> {
  if (provider.name === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      /* adaptive thinking at low effort: the model reads ~15k tokens and writes a short JSON answer; thinking tokens
         count against max_tokens, so the ceiling is generous and a cut-off answer is a failure, never a saved fragment */
      body: JSON.stringify({ model: provider.model, max_tokens: MAX_TOKENS, thinking: { type: "adaptive" }, output_config: { effort: "low" }, system, messages: [{ role: "user", content: user }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
    if (j?.stop_reason === "refusal") throw new Error("anthropic refused");
    if (j?.stop_reason === "max_tokens") throw new Error("anthropic: cut off");
    const text = (Array.isArray(j?.content) ? j.content : []).filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text || "").join("\n");
    if (!text.trim()) throw new Error("anthropic: empty answer");
    return text;
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" }, max_completion_tokens: MAX_TOKENS }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`openai ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  if (j?.choices?.[0]?.finish_reason === "length") throw new Error("openai: cut off");
  const text = j?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("openai: empty answer");
  return text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
  const who = await resolveCaller(req, admin, url, ANON_KEY);
  if ("error" in who) return json({ error: who.error }, who.status);

  let body: SummaryBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_key */ }

  /* the replay this summary is for: the newest published ready row, else the newest ready one (read once, used twice) */
  const replayCache = new Map<string, Promise<{ created_at?: string; duration_s?: number } | null>>();
  const replayRow = (key: string) => {
    if (!replayCache.has(key)) replayCache.set(key, (async () => {
      const [kind, id] = [key.split(":")[0], key.slice(key.indexOf(":") + 1)];
      const table = kind === "opil" ? "ea_opil_replays" : kind === "room" ? "ea_room_replays" : null;
      if (!table) return null;
      const col = kind === "opil" ? "session_no" : "room_id";
      const val = kind === "opil" ? Number(id) : id;
      const { data } = await admin.from(table).select("created_at, duration_s, published").eq(col, val).eq("status", "ready")
        .order("published", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data as { created_at?: string; duration_s?: number } | null) ?? null;
    })());
    return replayCache.get(key)!;
  };
  const reply = await handleSummary(body, {
    canRun: (key) => canRunSummary(key, { admin: who.role.admin, academyAdmin: who.academyAdmin }, async (classKey) => {
      const { data, error } = await who.asUser.rpc("ea_class_is_host", { p_key: classKey });
      if (error) throw new Error("Classroom authorization is unavailable.");
      return data === true;
    }),
    loadTranscript: (key) => loadAllRows<TranscriptRow>((from, to) =>
      admin.from("ea_class_transcripts").select("id, at, speaker_name, text").eq("room_key", key).order("at").order("id").range(from, to)),
    loadEvents: async (key) => {
      const { data, error } = await admin.from("ea_class_events").select("id, at, kind, label, data").eq("room_key", key).order("at").limit(500);
      if (error) throw new Error(error.message);
      return (data || []) as EventRow[];
    },
    roomFacts: async (key) => {
      const { data } = await who.asUser.rpc("ea_class_room_of", { p_key: key });   /* the caller may read the class, so this answers */
      return (data && typeof data === "object" ? data : null) as Record<string, string> | null;
    },
    startedAt: async (key) => (await replayRow(key))?.created_at ?? null,
    durationS: async (key) => { const d = (await replayRow(key))?.duration_s; return typeof d === "number" && d > 0 ? d : null; },
    provider: () => pickProvider(Deno.env),
    complete,
    save: async (row) => {
      const { error } = await admin.from("ea_class_summaries").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "room_key" });
      if (error) throw new Error(error.message);
    },
  });
  return json(reply.body, reply.status);
});
