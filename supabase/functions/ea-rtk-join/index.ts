// ea-rtk-join — hands one signed-in person a token for a RealtimeKit meeting, with the preset
// their role earns. The rules live in handler.ts; handler_test.ts is the proof. This file only
// wires the world in: env, the service-role client, the caller, the Cloudflare client.
//
// Two bodies, one function:
//   { session_no }          an OPIL class. coordinator (role.admin) or facilitator of this session
//                           -> opil-host · judge -> opil-judge (watch + chat, no media) · cohort
//                           member -> opil-student · anyone else -> 403. The meeting is the
//                           session's stored "rtk:" id (ea_opil_sessions.stream_url) or one a host
//                           creates here; a meeting_id in the body is ignored, and a session
//                           pointed at the Academy room's meeting is refused.
//   { room, key? }          a room by slug: true (or "academy") for the Academy room, or another
//                           institution's slug (e.g. "ht"). The Academy admin, or an email listed
//                           on that room's row, -> the row's host_preset; an Academy membership
//                           (Academy room only) or someone holding the current link -> the row's
//                           guest_preset; both presets are created on Cloudflare by ensurePresets
//                           the first time a host joins.
//
// Auth model: verify_jwt is OFF. The caller sends its own logged-in access token; we resolve the
// user with the SERVICE ROLE client, then ask the database AS THAT USER which role they hold
// (resolveCaller: ea_opil_my_role + ea_is_admin). The Cloudflare token never leaves this function.
//
// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Deploy: --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, resolveCaller, rtkClient } from "../_shared/rtk_auth.ts";
import { ensurePresets, ensureOpilPresets } from "../_shared/rtk_presets.ts";
import { handleJoin, type JoinBody, type RoomRow, type ClassroomAccess } from "./handler.ts";
import { handleTeamJoin, type TeamRow } from "./team.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const ROOM_COLS = "id,slug,title,host_name,host_emails,host_preset,guest_preset,link_key,is_live,live_since,meeting_id,max_participants,open_door";

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

  let body: JoinBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_session */ }

  const cf = rtkClient(acct, app, cfToken);
  const displayName = async (userId: string) => {
      const { data } = await admin.from("ea_profiles").select("display_name").eq("user_id", userId).maybeSingle();
      if (typeof data?.display_name === "string" && data.display_name.trim()) return data.display_name;
      /* no profile yet (10 of 31 students on kickoff day): the name they applied with, never "kiara1.pee" */
      const email = who.user.email;
      if (!email) return null;
      const { data: reg } = await admin.from("ea_opil_registrations").select("full_name").ilike("email", email).limit(1).maybeSingle();
      return typeof reg?.full_name === "string" && reg.full_name.trim() ? reg.full_name : null;
  };
  const caller = { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) };
  const rateCheck = async (key: string, max: number, windowSecs: number) => {
    const { data } = await admin.rpc("ea_rate_check", { p_key: key, p_max: max, p_window_secs: windowSecs });
    return data === true ? true : data === false ? false : null;
  };
  // Shared by OPIL sessions and team rooms. Partial results cannot establish isolation
  // from protected campus sessions, so either lookup failing denies the token request.
  const roomMeetingIds = async (meetingId: string) => {
    const ids = new Set<string>();
    const [rooms, replays] = await Promise.all([
      admin.from("ea_rooms").select("meeting_id").eq("meeting_id", meetingId).limit(1),
      admin.from("ea_room_replays").select("meeting_id").eq("meeting_id", meetingId).limit(1),
    ]);
    if (rooms.error || replays.error) throw new Error("Classroom meeting isolation could not be verified.");
    for (const r of [...(rooms.data || []), ...(replays.data || [])]) if (typeof r.meeting_id === "string" && r.meeting_id) ids.add(r.meeting_id);
    return ids;
  };
  /* a team's standing room (spec §3): its own handler, BEFORE handleJoin (which would answer bad_session) */
  if (typeof (body as { team?: unknown }).team === "string") {
    const reply = await handleTeamJoin(body as { team?: unknown }, caller, {
      cf, rateCheck, displayName, roomMeetingIds,
      getTeam: async (id) => { const { data } = await admin.from("ea_opil_teams").select("id, name, meeting_id, room_open_since, is_staff").eq("id", id).maybeSingle(); return (data as TeamRow) ?? null; },
      isMember: async (id) => { const { data } = await admin.from("ea_opil_team_members").select("user_id").eq("team_id", id).eq("user_id", who.user.id).limit(1); return !!(data && data.length); },
      /* conditional store: only while the row still holds expectPrev (null = no meeting yet). Two teammates minting in the same second → one write lands; the other re-reads and joins the winner's meeting */
      setTeamMeeting: async (id, meetingId, expectPrev) => {
        const at = new Date().toISOString();
        let q = admin.from("ea_opil_teams").update({ meeting_id: meetingId, room_open_since: at }).eq("id", id);
        q = expectPrev ? q.eq("meeting_id", expectPrev) : q.is("meeting_id", null);
        const { data, error } = await q.select("meeting_id");
        if (error) throw new Error(error.message);
        if (data && data.length) return meetingId;
        const { data: row } = await admin.from("ea_opil_teams").select("meeting_id").eq("id", id).maybeSingle();
        return typeof row?.meeting_id === "string" && row.meeting_id ? row.meeting_id : null;
      },
      ensureOpilPresets: () => ensureOpilPresets(cf),
      now: () => new Date(),
    }).catch((e) => { console.error("[ea-rtk-join] team", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });
    return json(reply.body, reply.status);
  }
  const reply = await handleJoin(body, { user: who.user, role: who.role, academyAdmin: who.academyAdmin, ip: clientIp(req) }, {
    cf,
    /* fail-open like every other ea_rate_check caller: only an explicit false refuses */
    rateCheck: async (key, max, windowSecs) => {
      const { data } = await admin.rpc("ea_rate_check", { p_key: key, p_max: max, p_window_secs: windowSecs });
      return data === true ? true : data === false ? false : null;
    },
    getSession: async (no) => {
      const { data } = await admin.from("ea_opil_sessions").select("no, title, stream_url, is_live").eq("no", no).maybeSingle();
      return data ?? null;
    },
    classroomAccess: async (slug) => {
      const { data, error } = await who.asUser.rpc("ht_classroom_access", { p_slug: slug });
      if (error) throw new Error("Classroom authorization is unavailable.");
      return data as ClassroomAccess | null;
    },
    claimClassroomMeeting: async (roomId, meetingId, previousMeetingId) => {
      const at = new Date().toISOString();
      let q = admin.from("ea_rooms").update({ meeting_id: meetingId, is_live: true, live_since: at, updated_at: at }).eq("id", roomId);
      q = previousMeetingId ? q.eq("meeting_id", previousMeetingId).eq("is_live", false) : q.is("meeting_id", null);
      const claimed = await q.select("meeting_id");
      if (claimed.error) throw new Error("Classroom meeting could not be saved.");
      if (claimed.data?.length) return meetingId;
      const current = await admin.from("ea_rooms").select("meeting_id,is_live").eq("id", roomId).maybeSingle();
      if (current.error) throw new Error("Classroom meeting could not be verified.");
      return current.data?.is_live === true && typeof current.data.meeting_id === "string" ? current.data.meeting_id : null;
    },
    inCohort: async () => (await who.asUser.rpc("ea_opil_in_cohort")).data === true,
    isMember: async () => (await who.asUser.rpc("ea_is_member")).data === true,
    getRoom: async (slug) => {
      const { data } = await admin.from("ea_rooms").select(ROOM_COLS).eq("slug", slug).maybeSingle();
      return (data as RoomRow) ?? null;
    },
    setRoomMeeting: async (roomId, meetingId) => {   /* a fresh meeting IS a fresh session: is_live + live_since move with it (server clock — the hands policy compares last_joined_at against live_since), so a row left live by a dead tab (> 4 h, spec §6.1 step 5) admits people again the moment Nelson re-enters. The page writes NOTHING on Start; only the way out (is_live=false, ended_at) is written from a page. */
      const at = new Date().toISOString(), { error } = await admin.from("ea_rooms").update({ meeting_id: meetingId, is_live: true, live_since: at, updated_at: at }).eq("id", roomId);
      if (error) throw new Error(error.message);
    },
    roomMeetingIds,
    /* joins + 1 and last_joined_at = now(); the first join also sets first_joined_at (a default,
       but stated so a re-join never resets it) */
    upsertMember: async (roomId, userId) => {
      const { data: have } = await admin.from("ea_room_members").select("joins").eq("room_id", roomId).eq("user_id", userId).maybeSingle();
      const at = new Date().toISOString();
      const row: Record<string, unknown> = have
        ? { room_id: roomId, user_id: userId, joins: Number(have.joins || 0) + 1, last_joined_at: at }
        : { room_id: roomId, user_id: userId, joins: 1, first_joined_at: at, last_joined_at: at };
      const { error } = await admin.from("ea_room_members").upsert(row, { onConflict: "room_id,user_id" });
      if (error) throw new Error(error.message);
    },
    displayName,
    /* the host's first join creates this room's two presets on Cloudflare (cached per name; never throws) */
    ensurePresets: (h, g) => ensurePresets(cf, [h, g]),
    ensureOpilPresets: () => ensureOpilPresets(cf),
    now: () => new Date(),
  }).catch((e) => { console.error("[ea-rtk-join]", String(e && e.message || e)); return { status: 500, body: { error: "server" } }; });

  return json(reply.body, reply.status);
});
