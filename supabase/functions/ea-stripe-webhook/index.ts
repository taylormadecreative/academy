// ea-stripe-webhook
// Stripe webhook for the BUILD MODE academy. Deno + Supabase Edge Functions.
//
// This is the ONLY place digital access is granted. It verifies the Stripe
// signature, then writes ea_entitlements / ea_memberships with the SERVICE ROLE
// client (which bypasses RLS). It is idempotent end to end: replays and Stripe
// retries never create duplicate access or double-grant a bundle.
//
// Deployed with verify_jwt = false. The signature check below is the auth.
//
// Runtime secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET.

import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ------------------------------------------------------------------ config
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// This is a server-to-server endpoint (Stripe -> us). No browser ever calls it,
// so there is no CORS to configure here. (H-3)

// ------------------------------------------------------------------ clients
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Pin the API version intentionally. Cast because the stripe@17 typings carry
  // a single literal for the "latest" version; the account is pinned to this
  // one server-side. (L-2)
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ------------------------------------------------------------------ helpers
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Read a subscription's current period end robustly. In recent Stripe API
// versions current_period_end moved onto the subscription ITEM; older shapes
// carry it on the subscription. Prefer the item, fall back to the top-level
// field, so an SDK/API-version bump never silently nulls the period end. (L-1)
function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  // In recent Stripe API versions current_period_end lives on the subscription
  // item; older shapes carry it on the subscription itself. The stripe@17
  // typings don't surface either field on every account version, so read both
  // defensively. (L-1)
  const itemEnd = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)
    ?.current_period_end;
  const end =
    typeof itemEnd === "number"
      ? itemEnd
      : (sub as { current_period_end?: number }).current_period_end;
  return tsFromUnix(end);
}

function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length > 0 ? e : null;
}

function tsFromUnix(secs: unknown): string | null {
  const n = typeof secs === "number" ? secs : Number(secs);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

// Map a Stripe subscription/invoice status to our membership status.
function mapMembershipStatus(stripeStatus: string | null | undefined): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

// Find an existing auth user by email, scanning pages, or create one. Returns
// the user id. We create the account UNCONFIRMED (email_confirm:false): Stripe
// does not verify that the purchaser controls the email on the session, so the
// buyer must prove inbox ownership via the normal magic-link / email-verify
// flow before the account is treated as confirmed. Entitlements still attach to
// the user id regardless. (C-2)
async function findOrCreateUser(
  sb: ReturnType<typeof admin>,
  email: string,
): Promise<string | null> {
  // 1) Try the (paginated) admin list. getUserByEmail is not stable across SDK
  // builds, so we scan, which is reliable and bounded for this audience size.
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers error", error.message);
      break;
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => normEmail(u.email) === email);
    if (hit) return hit.id;
    if (users.length < perPage) break; // last page
  }

  // 2) Create. If it raced with another delivery, recover the existing id.
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    email_confirm: false, // buyer proves ownership via magic link, not Stripe (C-2)
  });
  if (!createErr && created?.user?.id) return created.user.id;

  if (createErr) {
    // Already-registered races: scan once more to recover the id.
    for (let page = 1; page <= 50; page++) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage });
      const users = data?.users ?? [];
      const hit = users.find((u) => normEmail(u.email) === email);
      if (hit) return hit.id;
      if (users.length < perPage) break;
    }
    console.error("createUser error", createErr.message);
  }
  return null;
}

// Make sure a profiles row exists (the signup trigger normally does this, but
// admin-created users created here should be backfilled too).
async function ensureProfile(
  sb: ReturnType<typeof admin>,
  userId: string,
  email: string,
) {
  const { error } = await sb
    .from("profiles")
    .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
  if (error) console.error("ensureProfile error", error.message);
}

// NOTE: product resolution by slug / price id was removed. The webhook now
// grants strictly the product ids the checkout function resolved server-side
// and stamped into metadata.entitlement_product_ids — one source of truth. (M-5)

// Idempotent grant. Upsert on (user_id, product_id) with ignoreDuplicates so a
// replay/retry is a true no-op: it must NEVER clear revoked_at. A Stripe retry
// of checkout.session.completed can land AFTER a refund/dispute has revoked the
// row; resetting revoked_at there would resurrect access the buyer was refunded
// for. Re-purchase should go through an explicit re-grant, not a webhook
// replay. (M-3)
//
// THROWS on a DB error so the outer handler can return 500 and let Stripe retry
// the whole event — the buyer must not pay and silently get no access. The
// idempotent upsert makes those retries safe to re-run. (M-4)
async function grantEntitlement(
  sb: ReturnType<typeof admin>,
  userId: string,
  productId: string,
  sessionId: string | null,
  source: string,
) {
  const { error } = await sb
    .from("ea_entitlements")
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        source,
        stripe_session_id: sessionId,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,product_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(`grantEntitlement failed: ${error.message}`);
}

// ------------------------------------------------------------------ handlers

// checkout.session.completed -> create/find user, grant entitlement(s).
async function handleCheckoutCompleted(
  sb: ReturnType<typeof admin>,
  session: Stripe.Checkout.Session,
) {
  // Allow-list the payable states; default deny. checkout.session.completed can
  // fire with payment_status values we must NOT fulfil. Only "paid" and
  // "no_payment_required" (a 100%-off coupon) grant access. (C-3)
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!paid) {
    console.log(
      "session not payable, skipping grant",
      session.id,
      session.payment_status,
    );
    return;
  }

  const email =
    normEmail(session.customer_email) ??
    normEmail(session.customer_details?.email);
  if (!email) {
    console.error("no email on checkout.session", session.id);
    return;
  }

  const userId = await findOrCreateUser(sb, email);
  if (!userId) {
    console.error("could not resolve user for", email);
    return;
  }
  await ensureProfile(sb, userId, email);

  const meta = session.metadata ?? {};

  // Single source of truth: the checkout function resolves every product the
  // buyer pays for (the product itself, or a bundle's children) server-side and
  // stamps their DB ids into entitlement_product_ids as a CSV. We grant exactly
  // those ids and never re-derive by slug or price. The two functions share one
  // contract. (M-5)
  const idsCsv =
    typeof meta.entitlement_product_ids === "string"
      ? meta.entitlement_product_ids
      : "";
  const productIds = idsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (productIds.length === 0) {
    // Bad/missing metadata is not retryable — log and ack. (Throwing here would
    // make Stripe retry forever on a permanently-broken session.)
    console.error("no entitlement_product_ids on session", session.id);
    return;
  }

  // grantEntitlement THROWS on DB error so the outer handler returns 500 and
  // Stripe retries the whole event; the idempotent upsert makes that safe. (M-4)
  for (const productId of productIds) {
    await grantEntitlement(sb, userId, productId, session.id, "purchase");
  }
}

// Resolve a user id from a Stripe customer (by email on the customer record).
async function userIdFromCustomer(
  sb: ReturnType<typeof admin>,
  customerId: string | null | undefined,
): Promise<{ userId: string | null; email: string | null }> {
  if (!customerId) return { userId: null, email: null };
  try {
    const cust = await stripe.customers.retrieve(customerId);
    if (cust && !("deleted" in cust && cust.deleted)) {
      const email = normEmail((cust as Stripe.Customer).email);
      if (email) {
        const userId = await findOrCreateUser(sb, email);
        if (userId) await ensureProfile(sb, userId, email);
        return { userId, email };
      }
    }
  } catch (e) {
    console.error("customers.retrieve error", customerId, (e as Error).message);
  }
  return { userId: null, email: null };
}

// Subscription lifecycle -> ea_memberships. Idempotent upsert on user_id.
async function handleSubscriptionChange(
  sb: ReturnType<typeof admin>,
  sub: Stripe.Subscription,
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const { userId } = await userIdFromCustomer(sb, customerId);
  if (!userId) {
    console.error("no user for subscription", sub.id);
    return;
  }

  const status = mapMembershipStatus(sub.status);
  const periodEnd = subscriptionPeriodEnd(sub);

  const { error } = await sb.from("ea_memberships").upsert(
    {
      user_id: userId,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  // THROW so the outer handler returns 500 and Stripe retries; the upsert on
  // user_id is idempotent, so retries are safe. (M-4)
  if (error) throw new Error(`membership upsert failed: ${error.message}`);
}

// invoice.paid / invoice.payment_failed -> refresh membership status.
async function handleInvoice(
  sb: ReturnType<typeof admin>,
  invoice: Stripe.Invoice,
  paid: boolean,
) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const subId =
    typeof (invoice as { subscription?: unknown }).subscription === "string"
      ? ((invoice as { subscription?: string }).subscription as string)
      : null;
  if (!subId) return; // one-off invoices are not memberships

  const { userId } = await userIdFromCustomer(sb, customerId);
  if (!userId) {
    console.error("no user for invoice", invoice.id);
    return;
  }

  let status = paid ? "active" : "past_due";
  let periodEnd: string | null = null;
  // Pull the live subscription so status + period_end stay authoritative.
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    status = mapMembershipStatus(sub.status);
    periodEnd = subscriptionPeriodEnd(sub);
  } catch (e) {
    console.error("subscriptions.retrieve error", subId, (e as Error).message);
  }

  const { error } = await sb.from("ea_memberships").upsert(
    {
      user_id: userId,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  // THROW so the outer handler returns 500 and Stripe retries (idempotent). (M-4)
  if (error) throw new Error(`membership invoice upsert failed: ${error.message}`);
}

// charge.refunded / charge.dispute.created -> revoke the entitlements that were
// granted by the originating checkout session.
async function handleRevoke(
  sb: ReturnType<typeof admin>,
  charge: Stripe.Charge,
) {
  // Find the checkout session(s) tied to this charge's payment intent, then
  // revoke any entitlements stamped with those session ids.
  const sessionIds = new Set<string>();
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (piId) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: piId,
        limit: 10,
      });
      for (const s of sessions.data) sessionIds.add(s.id);
    } catch (e) {
      console.error("sessions.list by PI error", piId, (e as Error).message);
    }
  }

  if (sessionIds.size === 0) {
    console.error("no session resolved for charge", charge.id);
    return;
  }

  const now = new Date().toISOString();
  for (const sid of sessionIds) {
    const { error } = await sb
      .from("ea_entitlements")
      .update({ revoked_at: now })
      .eq("stripe_session_id", sid)
      .is("revoked_at", null);
    if (error) console.error("revoke error", sid, error.message);
  }
}

// Dispute carries a charge id; resolve the charge then reuse handleRevoke.
async function handleDispute(
  sb: ReturnType<typeof admin>,
  dispute: Stripe.Dispute,
) {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  if (!chargeId) {
    console.error("dispute without charge", dispute.id);
    return;
  }
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    await handleRevoke(sb, charge as Stripe.Charge);
  } catch (e) {
    console.error("charges.retrieve error", chargeId, (e as Error).message);
  }
}

// ------------------------------------------------------------------ entry
Deno.serve(async (req) => {
  // Server-to-server only (Stripe -> us). No CORS / preflight handling. (H-3)
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    // Misconfiguration. 500 (not 400) so Stripe retries after secrets are set.
    console.error("missing Stripe secrets");
    return json({ error: "not_configured" }, 500);
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!sig) return json({ error: "missing_signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("signature verification failed", (err as Error).message);
    return json({ error: "invalid_signature" }, 400);
  }

  const sb = admin();

  // Handle inside a try so a downstream error never turns into a 400 (which
  // would tell Stripe the signature was bad). On a handler/DB failure we return
  // 500 so Stripe RETRIES the event — grants and membership writes are
  // idempotent upserts, so re-running is safe and the buyer never silently ends
  // up paid-but-not-provisioned. Only a bad signature returns 400. (M-4)
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Subscriptions are fulfilled via subscription.* events; only grant
        // file entitlements for one-time (payment) sessions here.
        if (session.mode === "subscription") {
          // Make sure a membership row exists right away from the session.
          const email =
            normEmail(session.customer_email) ??
            normEmail(session.customer_details?.email);
          const customerId =
            typeof session.customer === "string" ? session.customer : null;
          if (email) {
            const userId = await findOrCreateUser(sb, email);
            if (userId) {
              await ensureProfile(sb, userId, email);
              const { error: memErr } = await sb.from("ea_memberships").upsert(
                {
                  user_id: userId,
                  status: "active",
                  stripe_customer_id: customerId,
                  stripe_subscription_id:
                    typeof session.subscription === "string"
                      ? session.subscription
                      : null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" },
              );
              // THROW so the handler returns 500 and Stripe retries. (M-4)
              if (memErr) {
                throw new Error(`membership session upsert failed: ${memErr.message}`);
              }
            }
          }
        } else {
          await handleCheckoutCompleted(sb, session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(sb, event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.paid": {
        await handleInvoice(sb, event.data.object as Stripe.Invoice, true);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoice(sb, event.data.object as Stripe.Invoice, false);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Only revoke on a FULL refund. A partial (goodwill) refund must NOT
        // pull the buyer's access. (C-1)
        if (charge.amount_refunded >= charge.amount && charge.refunded) {
          await handleRevoke(sb, charge);
        } else {
          console.log("partial refund, not revoking", charge.id);
        }
        break;
      }
      case "charge.dispute.created": {
        await handleDispute(sb, event.data.object as Stripe.Dispute);
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (e) {
    console.error("handler error", event.type, (e as Error).message);
    // Return 500 so Stripe retries this event. The grant/membership writes are
    // idempotent, so a retry is safe. (M-4)
    return json({ error: "handler_failed" }, 500);
  }

  return json({ received: true }, 200);
});
