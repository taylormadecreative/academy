// ea-demo-login — mints a real Supabase session for the App Store reviewer's demo
// account ONLY. It is hard-locked to a single throwaway email + a single fixed code,
// so the worst case is someone signing into a non-admin reviewer account that holds
// no real data. It self-provisions that account (onboarded profile + active
// membership) so the reviewer always lands in a complete member view.
//
// verify_jwt MUST be false: the reviewer is anonymous (no user JWT) when calling this.
// Kill switch: set the function secret DEMO_LOGIN_DISABLED=1 to turn it off after the
// app is approved (no redeploy needed), or just delete the function.
//
// Deployed to Supabase project pgqdmnmessbbzyszjfvr. Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEMO_EMAIL = "appreview@taylormadecreative.net";
const DEMO_CODE = "424242";

// Publishable / anon key — used only to exchange the admin-generated token for a session.
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";

// The native app runs at https://localhost (Capacitor); the site at its real origin.
const ALLOWED_ORIGINS = new Set([
  "https://academy.taylormadecreative.net",
  "https://localhost",
  "capacitor://localhost",
]);
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://academy.taylormadecreative.net";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  try {
    if (Deno.env.get("DEMO_LOGIN_DISABLED") === "1") return json({ error: "disabled" }, 403, cors);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();
    if (email !== DEMO_EMAIL || code !== DEMO_CODE) return json({ error: "unauthorized" }, 401, cors);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Ensure the demo user exists (idempotent — ignore "already registered").
    await admin.auth.admin.createUser({ email: DEMO_EMAIL, email_confirm: true }).catch(() => {});

    // Generate a magic link to obtain a verifiable token_hash + the user record.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
    });
    const userId = link?.user?.id;
    const tokenHash = (link?.properties as { hashed_token?: string } | undefined)?.hashed_token;
    if (linkErr || !userId || !tokenHash) {
      console.error("generateLink", linkErr);
      return json({ error: "server_error" }, 500, cors);
    }

    // Provision a complete member view (idempotent): onboarded profile + active membership.
    const now = new Date().toISOString();
    await admin.from("ea_profiles").upsert(
      { user_id: userId, display_name: "App Reviewer", onboarded_at: now, updated_at: now },
      { onConflict: "user_id" },
    );
    await admin.from("ea_memberships").upsert(
      { user_id: userId, status: "active", updated_at: now },
      { onConflict: "user_id" },
    );

    // Exchange the token_hash for a real session on a non-privileged client.
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sess, error: vErr } = await anon.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (vErr || !sess?.session) {
      console.error("verifyOtp", vErr);
      return json({ error: "server_error" }, 500, cors);
    }

    return json(
      { access_token: sess.session.access_token, refresh_token: sess.session.refresh_token },
      200,
      cors,
    );
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500, cors);
  }
});
