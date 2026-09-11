// ea-rtk-join — hands one signed-in person a token for the RealtimeKit meeting behind an
// OPIL session, with the preset their role earns. This is the first slice of the Zoom-style
// room: everyone on camera, the facilitator teaching, students visible.
//
// Auth model, identical to ea-live-publish: verify_jwt is OFF. The caller sends its own
// logged-in access token; we resolve the user with the SERVICE ROLE client, then ask the
// database AS THAT USER which role they hold. The Cloudflare token never leaves this function.
//
//   coordinator (role.admin) or facilitator of this session  -> opil-host
//   judge (role.judge)                                       -> opil-judge   (watch + chat, no media)
//   cohort member (ea_opil_in_cohort)                        -> opil-student
//   anyone else                                              -> 403
//
// The meeting id travels in ea_opil_sessions.stream_url as "rtk:<id>", so this slice needs no
// migration and no new RLS: facilitators can already write their own sessions' stream_url.
// Only a host may create a meeting; students and judges must be handed one that exists.
//
// Secrets: CF_ACCOUNT_ID, CF_RTK_APP_ID, CF_RTK_API_TOKEN (Realtime Admin).
// Deployed to Supabase project pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";
const PRESETS = ["opil-host", "opil-student", "opil-judge"] as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const acct = Deno.env.get("CF_ACCOUNT_ID");
  const app = Deno.env.get("CF_RTK_APP_ID");
  const cfToken = Deno.env.get("CF_RTK_API_TOKEN");
  if (!acct || !app || !cfToken) return json({ error: "rtk_not_configured" }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "sign_in" }, 401);

  let body: { session_no?: number; meeting_id?: string } = {};
  try { body = await req.json(); } catch (_) { /* falls through to bad_session */ }
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return json({ error: "bad_session" }, 400);
  // A meeting id, when supplied, must look like the uuid Cloudflare returns — never trust it raw.
  const given = typeof body.meeting_id === "string" && /^[0-9a-f-]{32,40}$/i.test(body.meeting_id) ? body.meeting_id : null;

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !user) return json({ error: "sign_in" }, 401);

  // Role check runs AS THE CALLER, through the same RPCs the hub pages use.
  const asUser = createClient(url, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: role } = await asUser.rpc("ea_opil_my_role");
  const fac: number[] = Array.isArray(role?.facilitator_sessions) ? role.facilitator_sessions : [];
  const isHost = role?.admin === true || fac.includes(no);
  let preset: typeof PRESETS[number] | null = null;
  if (isHost) preset = "opil-host";
  else if (role?.judge === true) preset = "opil-judge";
  else {
    const { data: inCohort } = await asUser.rpc("ea_opil_in_cohort");
    if (inCohort === true) preset = "opil-student";
  }
  if (!preset || !PRESETS.includes(preset)) return json({ error: "not_allowed" }, 403);

  const RTK = `https://api.cloudflare.com/client/v4/accounts/${acct}/realtime/kit/${app}`;
  const H = { "Authorization": `Bearer ${cfToken}`, "Content-Type": "application/json" };
  const cf = async (method: string, path: string, payload?: unknown) => {
    const r = await fetch(RTK + path, { method, headers: H, body: payload === undefined ? undefined : JSON.stringify(payload) });
    let data: Record<string, unknown> = {};
    try { data = await r.json(); } catch (_) { /* empty body */ }
    return { status: r.status, data: (data.data ?? data.result ?? {}) as Record<string, unknown>, ok: r.ok };
  };

  // The session row is the shared source of truth for which meeting this is. Read it with the
  // service role so a student who cannot yet see the row still gets the right meeting.
  const { data: row } = await admin.from("ea_opil_sessions").select("no, title, stream_url, is_live").eq("no", no).maybeSingle();
  if (!row) return json({ error: "not_found" }, 404);
  const stored = typeof row.stream_url === "string" && row.stream_url.startsWith("rtk:") ? row.stream_url.slice(4) : null;

  let meetingId = stored || given;
  if (!meetingId) {
    // Only a host opens a room. A student arriving before the facilitator gets a plain 409 so the
    // page can say "the room opens when your facilitator starts it" instead of spending minutes.
    if (!isHost) return json({ error: "not_open" }, 409);
    const made = await cf("POST", "/meetings", { title: `OPIL ${no} — ${String(row.title || "session").slice(0, 80)}`, persist_chat: false });
    if (!made.ok) return json({ error: "cloudflare_" + made.status }, 502);
    meetingId = String(made.data.id || "");
    if (!meetingId) return json({ error: "cloudflare_no_id" }, 502);
  }

  // One participant per person per meeting. custom_participant_id is the Supabase uid — never an email.
  const { data: prof } = await admin.from("ea_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  const name = String(prof?.display_name || (user.email || "Member").split("@")[0]).slice(0, 60);
  const added = await cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: user.id, preset_name: preset, name });
  if (!added.ok) return json({ error: "cloudflare_" + added.status }, 502);

  return json({ token: added.data.token, meeting_id: meetingId, preset, host: isHost, name });
});
