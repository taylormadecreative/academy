// ea-live-publish — hands an authorised broadcaster the address their browser streams
// to (Cloudflare Stream WHIP) and the playback URL viewers will watch, so "Go live from
// this device" works with nothing installed and no stream key ever sitting in a page.
//
// Auth model: verify_jwt is disabled. The caller sends its own logged-in access token
// as `Authorization: Bearer <token>`; we resolve that user with the SERVICE ROLE client,
// then ask the database — as that user — whether they may broadcast this room:
//   room "academy"  → ea_is_admin()
//   room "opil"     → ea_opil_my_role(): admin, or facilitator of that session_no
// The Cloudflare input key is a function secret and is returned only to that person,
// only for the minutes they are on air.
//
// Two actions after the role check:
//   (default)         → { whip, whep, hls }: where to send the picture, where viewers watch.
//                       Cloudflare makes neither HLS nor a recording from a WHIP broadcast, so
//                       browser broadcasts are watched over WHEP and recorded in the browser.
//   action "record"   → creates a resumable (tus) direct-creator upload for that recording and
//                       returns { uploadUrl, uid, watch, hls }; the bytes go browser → Cloudflare.
//
// Secrets: CF_STREAM_SUBDOMAIN (customer-xxxx), CF_STREAM_INPUT_ID, CF_STREAM_WHIP_KEY,
//          CF_ACCOUNT_ID + CF_API_TOKEN (Stream:Edit) for the recording upload.
// NOTE the WHIP secret is NOT the RTMPS stream key: each live input carries a separate
// webRTC.url secret (GET /stream/live_inputs/{id} → result.webRTC.url). Verified 2026-09-10:
// the RTMPS key on the WHIP path answers 401 to everything, including the CORS preflight.
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sub = Deno.env.get("CF_STREAM_SUBDOMAIN");
  const inputId = Deno.env.get("CF_STREAM_INPUT_ID");
  const whipKey = Deno.env.get("CF_STREAM_WHIP_KEY");
  if (!sub || !inputId || !whipKey) return json({ error: "stream_not_configured" }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "sign_in" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !user) return json({ error: "sign_in" }, 401);

  let body: { room?: string; session_no?: number; action?: string; bytes?: number; title?: string } = {};
  try { body = await req.json(); } catch (_) { /* empty body is a bad request below */ }
  const room = body.room === "opil" ? "opil" : body.room === "academy" ? "academy" : null;
  if (!room) return json({ error: "bad_room" }, 400);

  // Role checks run AS THE CALLER, through the same RPCs the pages use.
  const asUser = createClient(url, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  let allowed = false;
  if (room === "academy") {
    const { data } = await asUser.rpc("ea_is_admin");
    allowed = data === true;
  } else {
    const no = Number(body.session_no);
    if (!Number.isInteger(no)) return json({ error: "bad_session" }, 400);
    const { data: role } = await asUser.rpc("ea_opil_my_role");
    const fac: number[] = Array.isArray(role?.facilitator_sessions) ? role.facilitator_sessions : [];
    allowed = role?.admin === true || fac.includes(no);
  }
  if (!allowed) return json({ error: "not_allowed" }, 403);

  const base = `https://${sub}.cloudflarestream.com`;

  if (body.action === "record") {
    const acct = Deno.env.get("CF_ACCOUNT_ID"), apiTok = Deno.env.get("CF_API_TOKEN");
    if (!acct || !apiTok) return json({ error: "recording_not_configured" }, 503);
    const bytes = Number(body.bytes);
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 8_000_000_000) return json({ error: "bad_size" }, 400);
    const b64 = (v: string) => btoa(String.fromCharCode(...new TextEncoder().encode(v)));
    const name = String(body.title || (room === "opil" ? "OPIL Lab session" : "Taylormade Academy Live")).slice(0, 120);
    const expiry = new Date(Date.now() + 6 * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    // tus creation is done here with the API token; the browser then PATCHes chunks to
    // the returned one-time URL, so the token never leaves this function.
    const cf = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/stream?direct_user=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiTok}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(bytes),
        "Upload-Metadata": `name ${b64(name)},maxDurationSeconds ${b64("14400")},expiry ${b64(expiry)}`,
      },
    });
    const uploadUrl = cf.headers.get("Location"), uid = cf.headers.get("stream-media-id");
    if (!cf.ok || !uploadUrl || !uid) return json({ error: "cloudflare_" + cf.status }, 502);
    return json({ uploadUrl, uid, watch: `${base}/${uid}/watch`, hls: `${base}/${uid}/manifest/video.m3u8` });
  }

  return json({
    whip: `${base}/${whipKey}/webRTC/publish`,
    whep: `${base}/${inputId}/webRTC/play`,
    hls: `${base}/${inputId}/manifest/video.m3u8`,
  });
});
