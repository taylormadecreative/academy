// ea-opil-calendar — the OPIL 2026–27 schedule as a calendar feed a phone can subscribe to.
// The rules live in handler.ts (icsText); handler_test.ts is the proof. This file only wires the
// world in: the service-role client reads ea_opil_sessions (the schedule is public knowledge — the
// table is read-only to signed-in members, so anon needs the service role to see it) and the feed
// goes out as text/calendar, cached for ten minutes.
//
//   GET  /ea-opil-calendar               ->  200 text/calendar (subscribe: webcal://…/ea-opil-calendar)
//   GET  /ea-opil-calendar?download=1    ->  the same, as a file download (opil-2026-27.ics)
//
// Public on purpose: no token, no body, nothing but dates and titles. Deploy WITHOUT the JWT gate:
//   supabase functions deploy ea-opil-calendar --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calendarResponse, type Session } from "./handler.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin
    .from("ea_opil_sessions")
    .select("no, kind, title, session_date, start_time, end_time, outcome")
    .order("no");
  if (error) {
    console.error("[ea-opil-calendar] sessions", error.message);
    /* a short-lived plain answer, so a subscribed calendar retries in a minute instead of caching an error */
    return new Response("The schedule could not be read just now. Try again in a minute.", { status: 503, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const reply = calendarResponse((data || []) as Session[], Date.now(), download);
  return new Response(req.method === "HEAD" ? null : reply.body, { status: reply.status, headers: { ...CORS, ...reply.headers } });
});
