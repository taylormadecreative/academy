// The real-world dependencies behind a replay event: dedupe table, session lookup, replay
// upsert, Cloudflare Stream copy. Shared by ea-rtk-webhook (live events) and ea-rtk-record
// (a coordinator's Retry re-runs a stored event through the same code).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { WebhookDeps, ReplayRow } from "../ea-rtk-webhook/handler.ts";

export function replayDeps(admin: SupabaseClient, opts: { dedupe: boolean }): WebhookDeps {
  const acct = Deno.env.get("CF_ACCOUNT_ID") || "", streamToken = Deno.env.get("CF_API_TOKEN") || "", sub = Deno.env.get("CF_STREAM_SUBDOMAIN") || "";
  return {
    dedupe: async (id, event, p) => {
      if (!opts.dedupe) return true;   // a Retry deliberately re-runs an event we have already seen
      const { error } = await admin.from("ea_rtk_events").insert({ id, event, payload: p });
      if (!error) return true;
      if (error.code === "23505") return false;   // seen before
      const e = new Error(error.message); e.name = "DedupeError"; throw e;   // the caller answers 503 so Cloudflare retries
    },
    sessionByMeeting: async (meetingId) => {
      const { data } = await admin.from("ea_opil_sessions").select("no, title, kind").eq("stream_url", "rtk:" + meetingId).limit(1).maybeSingle();
      return data ?? null;
    },
    upsertReplay: async (row: ReplayRow) => {
      const { error } = await admin.from("ea_opil_replays").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "recording_id" });
      if (error) throw new Error(error.message);
    },
    streamCopy: async (dl, name) => {
      if (!acct || !streamToken) throw new Error("Stream is not configured");
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream/copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${streamToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: dl, meta: { name } }),
      });
      const j = await r.json().catch(() => ({})) as { success?: boolean; result?: { uid?: string }; errors?: unknown };
      const uid = j?.result?.uid;
      if (!r.ok || !j?.success || !uid) throw new Error(`Stream copy ${r.status}: ${JSON.stringify(j?.errors || {}).slice(0, 200)}`);
      return { uid };
    },
    subdomain: sub,
    currentStatus: async (recordingId) => {
      const { data } = await admin.from("ea_opil_replays").select("status").eq("recording_id", recordingId).maybeSingle();
      return data?.status ?? null;
    },
  };
}

/* When the handler itself blows up (a bad column value, say), the row must not sit on
   "preparing" forever: mark it failed with the reason so the coordinator sees Retry. */
export async function markFailed(admin: SupabaseClient, payload: Record<string, unknown>, message: string) {
  try {
    const rec = (payload.recording || {}) as Record<string, unknown>;
    const recordingId = typeof rec.id === "string" ? rec.id : typeof rec.recordingId === "string" ? rec.recordingId : "";
    if (!recordingId) return;
    await admin.from("ea_opil_replays").update({ status: "error", error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("recording_id", recordingId);
  } catch (_) { /* best effort */ }
}
