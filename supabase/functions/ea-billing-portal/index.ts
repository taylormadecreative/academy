// ea-billing-portal — returns a Stripe Billing Portal URL so a BUILD MODE member
// can self-manage their subscription (update card, cancel, view invoices).
//
// Auth model: verify_jwt is disabled. The caller sends its own logged-in user
// access token as `Authorization: Bearer <token>`; we resolve that user with the
// SERVICE ROLE client (auth.getUser) and look up their membership server-side.
// The service role key is a function secret and is never sent to the browser.
//
// Deployed to Supabase project pgqdmnmessbbzyszjfvr.
// Deno runtime. Stripe via the npm specifier + fetch http client.
import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lock CORS to the storefront origin (no wildcard). Vary: Origin keeps shared
// caches from leaking this allow-origin to other sites. (H-3)
const ALLOWED_ORIGIN = "https://academy.taylormadecreative.net";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The anon / publishable key. Used ONLY to validate the caller's JWT on a
// non-privileged client; the service-role client is used only for the DB read
// once identity is established. (H-1)
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const RETURN_URL = "https://academy.taylormadecreative.net/dashboard/";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "payments_not_configured" }, 503);

    // Require a logged-in user token. Guard against the publishable / anon key
    // (or other garbage) being passed as a bearer token by requiring the
    // 3-segment JWT shape before ever calling GoTrue — the same early-out
    // ea-issue-media uses. (H-2)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+/i.test(authHeader)) return json({ error: "unauthorized" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) {
      return json({ error: "unauthorized" }, 401);
    }

    // Validate the caller's token on a NON-privileged client (anon key +
    // Authorization header) so the GoTrue call is token-scoped and never runs in
    // the service-role context. (H-1)
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "unauthorized" }, 401);
    // Reject anything that is not an authenticated end-user role. (H-2)
    if (user.role && user.role !== "authenticated") {
      return json({ error: "unauthorized" }, 401);
    }

    // Service-role client for the membership lookup only (identity is already
    // established above). (H-1)
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Look up their membership for the Stripe customer id.
    const { data: membership, error: memErr } = await sb
      .from("ea_memberships")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr) {
      console.error(memErr);
      return json({ error: "server_error" }, 500);
    }
    if (!membership || !membership.stripe_customer_id) {
      return json({ error: "no_subscription" }, 400);
    }

    const stripe = new Stripe(key, {
      // Pin the API version intentionally; cast for the stripe@17 literal. (L-2)
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: RETURN_URL,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
