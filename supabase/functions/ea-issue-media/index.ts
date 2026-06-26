// ea-issue-media — BUILD MODE academy gated download gateway.
//
// Issues a short-lived signed URL for an ebook PDF (or any deliverable) that
// lives in the PRIVATE 'ea-files' Storage bucket, but only to a logged-in
// buyer who actually owns the product.
//
// Access flow (all validated server-side with the service role):
//   1. POST JSON { product_id: <slug> } with an Authorization: Bearer <JWT>
//      header carrying the logged-in buyer's Supabase access token.
//   2. The service-role client resolves the user from that token via
//      auth.getUser(token). No valid user -> 401.
//   3. The product slug is looked up in ea_products to get its id +
//      storage_path.
//   4. ea_entitlements is checked for (user_id, product_id) with
//      revoked_at IS NULL. No live entitlement (or unknown product) ->
//      404 { error: "not_found" }. We never reveal whether the product
//      exists or where its file lives.
//   5. On success, a 1-hour signed URL is minted with
//      storage.from('ea-files').createSignedUrl(path, 3600) and returned.
//
// verify_jwt is OFF; this function does its OWN auth. The service role key
// is a function secret and is never sent to the browser. The storage path is
// never returned to the client.
//
// Deployed to Supabase project pgqdmnmessbbzyszjfvr.
import { createClient } from "npm:@supabase/supabase-js@2";

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
// non-privileged client (token-scoped getUser), never for DB or storage reads.
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";

// Rate limiting (H-4): this endpoint mints signed download URLs and could be
// brute-forced across product slugs. A durable, DB-backed per-user limiter (the
// ea_rate_check RPC, migration 0004) now guards it below — 40 requests / 60s /
// authenticated user, fail-open.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const BUCKET = "ea-files";
const SIGN_TTL = 60 * 60; // 1 hour

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

// Resolve the buyer from the Authorization bearer JWT. Returns the user id, or
// null if there is no valid logged-in user. We guard against the publishable /
// anon key being passed as a bearer token by requiring a 3-part JWT shape
// before ever calling getUser.
//
// The token is validated on a NON-privileged client built with the anon key and
// the caller's Authorization header, so the GoTrue call is scoped to that token
// and never runs in the service-role context. The service-role client is used
// only for DB/storage reads after identity is established. (H-1)
async function resolveUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;
    // Reject anything that is not an authenticated end-user role.
    if (data.user.role && data.user.role !== "authenticated") return null;
    return data.user.id;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Fail closed if the runtime is misconfigured rather than throwing.
  if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("ea-issue-media: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "server_error" }, 500);
  }

  let body: { product_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const slug = typeof body?.product_id === "string" ? body.product_id.trim() : "";
  if (!slug) return json({ error: "bad_request" }, 400);

  // Identity is established on a NON-privileged client (H-1); the service-role
  // client below is used only for DB / storage reads after that.
  const db = svc();

  try {
    // 1. Authenticate the buyer (token validated on the anon client). (H-1)
    const userId = await resolveUserId(req);
    if (!userId) return json({ error: "unauthorized" }, 401);

    // 1.5 per-user rate limit (durable, DB-backed; fail-open). Blunts
    //     slug-probing of the gated download gateway. (H-4)
    const { data: allowed } = await db.rpc("ea_rate_check", {
      p_key: "media:" + userId, p_max: 40, p_window_secs: 60,
    });
    if (allowed === false) return json({ error: "rate_limited" }, 429);

    // 2. Resolve the product by slug. Select only what we need; the
    //    storage_path stays server-side and is never returned to the client.
    //    type drives the all-access-membership unlock for courses.
    const { data: product, error: prodErr } = await db
      .from("ea_products")
      .select("id, type, storage_path, is_free")
      .eq("slug", slug)
      .maybeSingle<{ id: string; type: string; storage_path: string | null; is_free: boolean }>();

    // Treat unknown products exactly like "not entitled" so we never reveal
    // whether a given slug exists.
    if (prodErr) {
      console.error("ea-issue-media product lookup", prodErr);
      return json({ error: "server_error" }, 500);
    }
    if (!product || !product.storage_path) {
      return json({ error: "not_found" }, 404);
    }

    // 3. Decide access. A product is unlocked if EITHER:
    //      (a) the user has a non-revoked ea_entitlement for it (à la carte
    //          purchase — applies to every product type, incl. ebooks), OR
    //      (b) the product is a 'course' AND the user holds an ACTIVE
    //          all-access ea_membership (status = 'active').
    //    Ebooks remain entitlement-only. Any "not unlocked" path returns the
    //    identical 404 not_found used for unknown products — no existence or
    //    path leak.
    const { data: ent, error: entErr } = await db
      .from("ea_entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (entErr) {
      console.error("ea-issue-media entitlement lookup", entErr);
      return json({ error: "server_error" }, 500);
    }

    let unlocked = !!ent;

    // Free products are unlocked for any authenticated user.
    if (!unlocked && product.is_free === true) unlocked = true;

    // All-access subscription unlocks courses (only). Check only if not already
    // unlocked by a direct entitlement.
    if (!unlocked && product.type === "course") {
      const { data: membership, error: memErr } = await db
        .from("ea_memberships")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (memErr) {
        console.error("ea-issue-media membership lookup", memErr);
        return json({ error: "server_error" }, 500);
      }
      if (membership) unlocked = true;
    }

    if (!unlocked) {
      // Not owned / not covered -> indistinguishable from "does not exist".
      return json({ error: "not_found" }, 404);
    }

    // 4. Mint a short-lived signed URL for the private file.
    const { data: signed, error: signErr } = await db.storage
      .from(BUCKET)
      .createSignedUrl(product.storage_path, SIGN_TTL);

    if (signErr || !signed?.signedUrl) {
      console.error("ea-issue-media createSignedUrl", signErr);
      return json({ error: "server_error" }, 500);
    }

    return json({ url: signed.signedUrl });
  } catch (e) {
    console.error("ea-issue-media", e);
    return json({ error: "server_error" }, 500);
  }
});
