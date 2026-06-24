// ea-create-checkout — creates a Stripe Checkout session for a BUILD MODE academy
// product (ebook, course, membership, or bundle).
//
// Auth model: verify_jwt is disabled. This function does its own work with the
// service role client and never trusts a price or amount from the browser. It
// reads the product (and its price) from ea_products by slug, server-side. The
// service role key is a function secret and is never returned to the caller.
//
// The static storefront (https://academy.taylormadecreative.net) POSTs
//   { product_id: <slug>, email?: <string> }
// and redirects the browser to the returned { url }. On HTTP 503 the front-end
// shows a "payments not switched on yet" notice.
//
// Access is granted later by the webhook (the single writer of ea_entitlements),
// using the metadata this function stamps onto the Checkout session.
//
// Deployed to Supabase project pgqdmnmessbbzyszjfvr.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

// Lock CORS to the storefront origin (no wildcard). Vary: Origin keeps caches
// from serving this allow-origin to other sites. (H-3)
const ALLOWED_ORIGIN = "https://academy.taylormadecreative.net";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// NOTE: rate limiting. This function is unauthenticated (verify_jwt = false) and
// calls Stripe on every request. Supabase Edge Functions cannot durably
// rate-limit on their own, so per-IP throttling MUST be added at the
// Cloudflare / WAF layer in front of this endpoint to blunt abuse and protect
// the Stripe API budget. The email-enumeration surface (the old open-session
// reuse path) has been removed below. (H-4)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SITE_BASE = "https://academy.taylormadecreative.net";
const SUCCESS_URL = `${SITE_BASE}/thank-you/?session_id={CHECKOUT_SESSION_ID}`;

type ProductRow = {
  id: string;
  slug: string;
  type: string;
  title: string;
  blurb: string | null;
  price_cents: number | null;
  stripe_price_id: string | null;
  billing: string;
  cover_url: string | null;
  bundle_of: string[] | null;
  status: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // ---- parse + validate input -------------------------------------------
    let payload: { product_id?: unknown; email?: unknown };
    try {
      payload = await req.json();
    } catch (_) {
      return json({ error: "bad_request" }, 400);
    }
    const slug = typeof payload.product_id === "string" ? payload.product_id.trim() : "";
    if (!slug) return json({ error: "bad_request" }, 400);

    const rawEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    // light sanity check; Stripe revalidates and we only use it as a hint
    const email = rawEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail) ? rawEmail : "";

    // ---- payments configured? ---------------------------------------------
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "payments_not_configured" }, 503);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- load the product server-side -------------------------------------
    const { data: product, error: prodErr } = await sb
      .from("ea_products")
      .select(
        "id, slug, type, title, blurb, price_cents, stripe_price_id, billing, cover_url, bundle_of, status",
      )
      .eq("slug", slug)
      .maybeSingle<ProductRow>();

    if (prodErr) {
      console.error("product lookup failed", prodErr);
      return json({ error: "server_error" }, 500);
    }
    if (!product) return json({ error: "not_found" }, 404);

    // Only published products are purchasable. A coming_soon course (or any
    // draft/archived row) is not for sale.
    if (product.status !== "published") return json({ error: "not_for_sale" }, 400);

    // ---- resolve the bundle's children to entitlement IDs -----------------
    // The webhook grants one entitlement per product the buyer paid for. For a
    // bundle that means BOTH child ebooks. We resolve child slugs -> product ids
    // here (server-side) and stamp them into metadata so the webhook never has
    // to interpret the bundle itself.
    let entitlementIds: string[] = [product.id];
    let bundleSlugsCsv = "";
    if (product.type === "bundle" && Array.isArray(product.bundle_of) && product.bundle_of.length) {
      const childSlugs = product.bundle_of.map((s) => String(s).trim()).filter(Boolean);
      if (childSlugs.length) {
        const { data: children, error: childErr } = await sb
          .from("ea_products")
          .select("id, slug")
          .in("slug", childSlugs);
        if (childErr) {
          console.error("bundle children lookup failed", childErr);
          return json({ error: "server_error" }, 500);
        }
        const found = children ?? [];
        if (found.length !== childSlugs.length) {
          // a child slug in bundle_of does not resolve to a product
          console.error("bundle child slug unresolved", { slug, childSlugs, found: found.map((c) => c.slug) });
          return json({ error: "bundle_misconfigured" }, 409);
        }
        // grant the children; do NOT also grant the bundle wrapper row
        entitlementIds = found.map((c) => c.id);
        bundleSlugsCsv = found.map((c) => c.slug).join(",");
      }
    }

    // ---- determine price, server-side only --------------------------------
    const hasPriceId = !!(product.stripe_price_id && product.stripe_price_id.trim());
    const hasAmount = typeof product.price_cents === "number" && product.price_cents > 0;
    if (!hasPriceId && !hasAmount) return json({ error: "price_not_set" }, 409);

    const mode: "subscription" | "payment" = product.billing === "recurring" ? "subscription" : "payment";

    // A recurring product must be sold through a Stripe Price (subscriptions
    // require a recurring price object; ad-hoc price_data cannot express the
    // interval). Refuse rather than silently charge a one-time amount.
    if (mode === "subscription" && !hasPriceId) {
      console.error("recurring product missing stripe_price_id", { slug });
      return json({ error: "price_not_set" }, 409);
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = hasPriceId
      ? { price: product.stripe_price_id!.trim(), quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.title,
              ...(product.blurb ? { description: product.blurb } : {}),
              ...(product.cover_url && /^https?:\/\//.test(product.cover_url)
                ? { images: [product.cover_url] }
                : {}),
            },
            unit_amount: product.price_cents!,
          },
          quantity: 1,
        };

    // Metadata the webhook reads to grant access. Stripe metadata values are
    // strings, so entitlement product ids ride as a CSV.
    const metadata: Record<string, string> = {
      product_slug: product.slug,
      product_type: product.type,
      entitlement_product_ids: entitlementIds.join(","),
      bundle_of: bundleSlugsCsv,
      email,
    };

    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

    // NOTE: the previous "reuse an open Checkout session for this buyer + email"
    // optimization was REMOVED. Because the email is client-supplied and
    // unverified, it let a caller POST a victim's email and receive that
    // victim's payable session URL (info disclosure + purchase confusion), and
    // it was an email-enumeration surface. We rely on Stripe's own idempotency
    // instead; the small double-charge risk is acceptable next to the spoof
    // risk it created. (M-1, H-4)

    // ---- create the Checkout session --------------------------------------
    const params: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [lineItem],
      metadata,
      success_url: SUCCESS_URL,
      cancel_url: `${SITE_BASE}/store/`,
      allow_promotion_codes: true,
      ...(email ? { customer_email: email } : {}),
    };
    // Carry metadata onto the subscription too, so subscription-lifecycle
    // webhooks (renewals, cancellations) can also find the buyer + product.
    if (mode === "subscription") {
      params.subscription_data = { metadata };
    } else {
      // surface the same metadata on the resulting PaymentIntent for support
      params.payment_intent_data = { metadata };
    }

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) {
      console.error("stripe returned a session without a url", { id: session.id });
      return json({ error: "server_error" }, 500);
    }
    return json({ url: session.url });
  } catch (e) {
    // never leak secrets or Stripe internals to the caller
    console.error("ea-create-checkout error", e);
    return json({ error: "server_error" }, 500);
  }
});
