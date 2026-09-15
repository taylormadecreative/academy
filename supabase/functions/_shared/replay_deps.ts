// The real-world dependencies behind a replay event: dedupe table, meeting → owner lookup, replay
// upsert, Cloudflare Stream copy. Shared by ea-rtk-webhook (live events) and ea-rtk-record
// (a Retry re-runs a stored event through the same code). A recording belongs to Nelson's room
// (ea_room_replays) or to an OPIL session (ea_opil_replays); target.kind says which table.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { WebhookDeps, ReplayRow, Target } from "../ea-rtk-webhook/handler.ts";

const table = (t: Target) => (t.kind === "room" ? "ea_room_replays" : "ea_opil_replays");

export function replayDeps(admin: SupabaseClient, opts: { dedupe: boolean }): WebhookDeps {
  return {
    dedupe: async (id, event, p) => {
      if (!opts.dedupe) return true;   // a Retry deliberately re-runs an event we have already seen
      const { error } = await admin.from("ea_rtk_events").insert({ id, event, payload: p });
      if (!error) return true;
      if (error.code === "23505") return false;   // seen before
      const e = new Error(error.message); e.name = "DedupeError"; throw e;   // the caller answers 503 so Cloudflare retries
    },
    /* Room FIRST, OPIL LAST: an OPIL session whose stream_url points at the room's meeting must never
       receive an Academy recording. Step 2 catches a recording that finishes after the next Start class
       replaced ea_rooms.meeting_id — its own replay row still says which room it belongs to. A table
       that is not there yet (0036 unapplied) answers { data: null } and simply falls through. */
    targetByMeeting: async (meetingId) => {
      const live = await admin.from("ea_rooms").select("id, slug, title, live_since").eq("meeting_id", meetingId).limit(1).maybeSingle();
      if (live.data) return { kind: "room", room: { id: String(live.data.id), slug: String(live.data.slug || "academy"), title: live.data.title ?? null, startedAt: live.data.live_since ?? null } };
      const prior = await admin.from("ea_room_replays").select("room_id, created_at").eq("meeting_id", meetingId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (prior.data) {
        if (!prior.data.room_id) return null;   // an Academy replay whose room is gone is still not OPIL's
        const r = await admin.from("ea_rooms").select("slug, title").eq("id", prior.data.room_id).maybeSingle();
        return { kind: "room", room: { id: String(prior.data.room_id), slug: String(r.data?.slug || "academy"), title: r.data?.title ?? null, startedAt: prior.data.created_at ?? null } };
      }
      const { data } = await admin.from("ea_opil_sessions").select("no, title, kind").eq("stream_url", "rtk:" + meetingId).limit(1).maybeSingle();
      return data ? { kind: "opil", session: { no: data.no, title: data.title ?? null, kind: data.kind ?? null } } : null;
    },
    upsertReplay: async (row: ReplayRow, target) => {
      const { error } = await admin.from(table(target)).upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "recording_id" });
      if (error) throw new Error(error.message);
    },
    streamCopy: async (dl, name) => {
      const acct = Deno.env.get("CF_ACCOUNT_ID") || "", streamToken = Deno.env.get("CF_API_TOKEN") || "";
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
    /* env is read when used, not when the deps are built: replay_deps_test.ts builds them with no --allow-env */
    get subdomain() { return Deno.env.get("CF_STREAM_SUBDOMAIN") || ""; },
    currentStatus: async (recordingId, target) => {
      const { data } = await admin.from(table(target)).select("status").eq("recording_id", recordingId).maybeSingle();
      return data?.status ?? null;
    },
  };
}

/* When the handler itself blows up (a bad column value, say), the row must not sit on "preparing"
   forever: mark it failed with the reason so Nelson (or the coordinator) sees Retry. The catch only
   has the payload, not the target, so try the room table first and, if it matched no row, OPIL's.
   .select("id") on the update makes supabase-js return the rows it touched. */
export async function markFailed(admin: SupabaseClient, payload: Record<string, unknown>, message: string) {
  try {
    const rec = (payload.recording || {}) as Record<string, unknown>;
    const recordingId = typeof rec.id === "string" ? rec.id : typeof rec.recordingId === "string" ? rec.recordingId : "";
    if (!recordingId) return;
    const patch = { status: "error", error: message.slice(0, 500), updated_at: new Date().toISOString() };
    const room = await admin.from("ea_room_replays").update(patch).eq("recording_id", recordingId).select("id");
    if (Array.isArray(room.data) && room.data.length > 0) return;
    await admin.from("ea_opil_replays").update(patch).eq("recording_id", recordingId);
  } catch (_) { /* best effort */ }
}
