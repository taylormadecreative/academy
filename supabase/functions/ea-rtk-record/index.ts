// ea-rtk-record — start/stop the recording of an OPIL class or of a room, and (admin) wire the
// webhook. The page calls `start` right after the host is in and `stop` when the host leaves;
// nobody presses Record. See handler.ts for the rules and handler_test.ts for the proof.
// Body { session_no, action } = OPIL (ea_opil_replays); { room, action, replay_id? } = a room by
// slug — true (or "academy") for Nelson's room, another institution's slug (e.g. "ht") for its
// own — filed in ea_room_replays, host = the Academy admin or an email on that room's row.
//
// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, rtkClient } from "../_shared/rtk_auth.ts";
import { handleRecord, type RecordBody, type ClassroomAccess } from "./handler.ts";
import { handleEvent } from "../ea-rtk-webhook/handler.ts";
import { replayDeps } from "../_shared/replay_deps.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const ACTIVE = ["invoked", "recording"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const acct = Deno.env.get("CF_ACCOUNT_ID"), app = Deno.env.get("CF_RTK_APP_ID"), cfToken = Deno.env.get("CF_RTK_API_TOKEN");
  if (!acct || !app || !cfToken) return json({ error: "rtk_not_configured" }, 503);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const who = await resolveCaller(req, admin, url, ANON_KEY);
  if ("error" in who) return json({ error: who.error }, who.status);

  let body: RecordBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_action */ }

  const reply = await handleRecord(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, functionsBase: url + "/functions/v1" }, {
    classroomAccess: async (slug) => {
      const { data, error } = await who.asUser.rpc("ht_classroom_access", { p_slug: slug });
      if (error) throw new Error("Classroom authorization is unavailable.");
      return data as ClassroomAccess | null;
    },
    getSession: async (no) => {
      const { data } = await admin.from("ea_opil_sessions").select("no, title, stream_url, is_live").eq("no", no).maybeSingle();
      return data ?? null;
    },
    latestActive: async (meetingId) => {
      const { data } = await admin.from("ea_opil_replays").select("recording_id, status").eq("meeting_id", meetingId).in("status", ACTIVE)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
    },
    insertReplay: async (row) => {
      const { error } = await admin.from("ea_opil_replays").insert(row);
      if (error) throw new Error(error.message);
    },
    cf: rtkClient(acct, app, cfToken),
    updateReplayStatus: async (recordingId, status) => {
      await admin.from("ea_opil_replays").update({ status, updated_at: new Date().toISOString() }).eq("recording_id", recordingId);
    },
    latestAny: async (meetingId) => {
      const { data } = await admin.from("ea_opil_replays").select("recording_id, status").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
    },
    uploadedEvent: async (recordingId) => {
      const { data } = await admin.from("ea_rtk_events").select("payload").eq("id", recordingId + ":UPLOADED").maybeSingle();
      return (data?.payload as Record<string, unknown>) ?? null;
    },
    reprocess: async (payload) => {
      const r = await handleEvent(payload, replayDeps(admin, { dedupe: false }));
      const b = r.body as { status?: string };
      return { status: b.status || "unknown" };
    },
    /* ── a room by slug (ea_rooms / ea_room_replays, migration 0036+0037) ── */
    getRoom: async (slug) => {
      const { data } = await admin.from("ea_rooms").select("id, meeting_id, host_emails").eq("slug", slug).maybeSingle();
      return data ?? null;
    },
    roomMeetingIds: async (meetingId) => {
      /* The OPIL path must not operate on a campus meeting when either lookup fails. */
      const ids = new Set<string>();
      const [rooms, replays] = await Promise.all([
        admin.from("ea_rooms").select("meeting_id").eq("meeting_id", meetingId).limit(1),
        admin.from("ea_room_replays").select("meeting_id").eq("meeting_id", meetingId).limit(1),
      ]);
      if (rooms.error || replays.error) throw new Error("Classroom meeting isolation could not be verified.");
      for (const r of rooms.data || []) if (typeof r.meeting_id === "string") ids.add(r.meeting_id);
      for (const r of replays.data || []) if (typeof r.meeting_id === "string") ids.add(r.meeting_id);
      return ids;
    },
    room: {
      latestActive: async (meetingId) => {
        const { data } = await admin.from("ea_room_replays").select("recording_id, status").eq("meeting_id", meetingId).in("status", ACTIVE)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        return data ?? null;
      },
      latestAny: async (meetingId) => {
        const { data } = await admin.from("ea_room_replays").select("recording_id, status").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
        return data ?? null;
      },
      insertReplay: async (row) => {
        const { error } = await admin.from("ea_room_replays").insert(row);
        if (error) throw new Error(error.message);
      },
      updateReplayStatus: async (recordingId, status) => {
        await admin.from("ea_room_replays").update({ status, updated_at: new Date().toISOString() }).eq("recording_id", recordingId);
      },
      replayById: async (id) => {
        const { data } = await admin.from("ea_room_replays").select("id, room_id, meeting_id, recording_id, status").eq("id", id).maybeSingle();
        return data ?? null;
      },
    },
  }).catch((e) => { console.error("[ea-rtk-record]", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });

  return json(reply.body, reply.status);
});
