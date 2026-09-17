// ea-opil-pass — signs an APPROVED OPIL student in from the email they applied with, no code.
// The rules live in handler.ts; handler_test.ts is the proof. This file wires the world in:
// the service-role client, the approved list, the rate limiter, and Supabase's one-time token.
//
//   POST { email }  ->  200 { token_hash, email }   the page redeems it with
//                                                   supabase.auth.verifyOtp({ token_hash, type: "magiclink" })
//                       403 { error: "not_on_list" }   not an approved registration (staff use the code sign-in)
//                       429 { error: "slow_down" }     30 tries per network / 6 per email per 10 min
//
// Why it is safe enough: the list is the gate (31 vetted students), the token is single-use and
// short-lived, and nothing is emailed — the same trick ea-demo-login uses for App Review.
// Deploy: supabase functions deploy ea-opil-pass --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp } from "../_shared/rtk_auth.ts";
import { handlePass, type PassBody } from "./handler.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: PassBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_email */ }

  const reply = await handlePass(body, { ip: clientIp(req) }, {
    rateCheck: async (key, max, windowSecs) => {
      const { data } = await admin.rpc("ea_rate_check", { p_key: key, p_max: max, p_window_secs: windowSecs });
      return data === true ? true : data === false ? false : null;
    },
    findApproved: async (email) => {
      /* exact match on the lower-cased address (the register page stores lower-case) — never ilike: `%` and `_`
         are legal in an address and would turn the lookup into a wildcard walk of the roster. The school
         address or the personal one, as the hub itself accepts. */
      type Row = { email: string | null; personal_email: string | null; full_name: string | null };
      for (const col of ["email", "personal_email"] as const) {
        const { data } = await admin.from("ea_opil_registrations").select("email, personal_email, full_name").eq(col, email).eq("approved", true).limit(1).maybeSingle();
        const row = data as Row | null;
        if (row && String(row[col] || "").trim().toLowerCase() === email) return { full_name: row.full_name };
      }
      /* teammates: the lead listed them in members [{ name, email, classification }] — they are approved too (ea_opil_claim_team seats them) */
      const { data: team } = await admin.from("ea_opil_registrations").select("members").eq("approved", true).contains("members", [{ email }]).limit(1).maybeSingle();
      const mates = (team as { members?: unknown } | null)?.members;
      const mate = Array.isArray(mates) ? (mates as { email?: unknown; name?: unknown }[]).find((m) => String(m?.email ?? "").trim().toLowerCase() === email) : null;
      if (mate) return { full_name: typeof mate.name === "string" ? mate.name : null };
      return null;
    },
    mintToken: async (email, fullName) => {
      /* every approved student already has an account (31/31 on 9/16); a late registrant may not — make it, silently */
      await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: fullName ? { full_name: fullName } : undefined }).catch(() => {});
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const hash = (data?.properties as { hashed_token?: string } | undefined)?.hashed_token;
      if (error || !hash) { console.error("[ea-opil-pass] generateLink", error?.message || "no token"); return null; }
      return hash;
    },
  });
  return json(reply.body, reply.status);
});
