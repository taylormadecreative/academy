// ea-delete-account — lets a signed-in member permanently delete their own account
// from inside the app (required by App Store Guideline 5.1.1(v)) or the website.
//
// Auth model (same as ea-billing-portal): verify_jwt is disabled. The caller sends
// its own logged-in user access token as `Authorization: Bearer <token>`. We resolve
// that user on a NON-privileged client (anon key) so the GoTrue call is token-scoped,
// then use the SERVICE ROLE client only to (a) best-effort cancel their Stripe
// subscription and (b) delete the auth user. Deleting the user cascades every ea_*
// row (memberships, entitlements, posts, comments, profile, notes, messages, likes,
// blocks) via `on delete cascade`.
//
// Deployed to Supabase project pgqdmnmessbbzyszjfvr. Deno runtime.
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The native app runs at https://localhost (Capacitor); the site at its real origin.
// Echo back whichever allowed origin made the request (no wildcard).
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

// Publishable / anon key — used ONLY to validate the caller's JWT on a non-privileged client.
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  try {
    // Require a real logged-in user token (3-segment JWT), not the publishable key.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+/i.test(authHeader)) return json({ error: "unauthorized" }, 401, cors);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return json({ error: "unauthorized" }, 401, cors);

    // Resolve identity on a token-scoped, non-privileged client.
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "unauthorized" }, 401, cors);
    if (user.role && user.role !== "authenticated") return json({ error: "unauthorized" }, 401, cors);

    // Service-role client for the privileged operations (identity established above).
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Best-effort: cancel their Stripe subscription so deletion doesn't leave them
    // billed. Never let a Stripe hiccup block the account deletion itself.
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const { data: membership } = await sb
        .from("ea_memberships")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (stripeKey && membership?.stripe_customer_id) {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
          httpClient: Stripe.createFetchHttpClient(),
        });
        const subs = await stripe.subscriptions.list({
          customer: membership.stripe_customer_id,
          status: "active",
          limit: 100,
        });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id).catch((e) => console.error("sub cancel", e));
        }
      }
    } catch (e) {
      console.error("stripe cleanup (non-fatal)", e);
    }

    // Delete the auth user. All ea_* rows referencing auth.users(id) cascade away.
    const { error: delErr } = await sb.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("deleteUser", delErr);
      return json({ error: "server_error" }, 500, cors);
    }

    return json({ ok: true }, 200, cors);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500, cors);
  }
});
