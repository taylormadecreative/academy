I have enough context from the code and the Stripe best-practices guidance. The review is a static analysis task — I don't need to deploy or run anything. Let me deliver the findings.

# Security Review: BUILD MODE Academy Payment Backend

Reviewed four edge functions against real-money go-live criteria. Verdict at the bottom. Findings are ordered by severity. File paths are relative to `supabase/functions/`.

---

## CRITICAL

### C-1 — Refund/dispute revocation is broken for the most common purchase path (one-time `price_data` items)
**File:** `ea-stripe-webhook/index.ts` → `handleRevoke()`

`handleRevoke` resolves the session from the charge via `stripe.checkout.sessions.list({ payment_intent: piId })`. That works **only if** the entitlement was stamped with that session's id. But for one-time purchases your checkout function attaches metadata to the PaymentIntent (`params.payment_intent_data = { metadata }`), and the entitlement is keyed on `stripe_session_id`. The lookup `sessions.list({ payment_intent })` does return the session, so the id *can* match — **but** there's a real gap: if the buyer was granted via the **bundle child** path, every child entitlement carries the *same* `stripe_session_id`, so those revoke fine. The actual break is subtler and worse:

`charge.refunded` fires on **partial refunds too**. A $1 partial refund on a $50 order triggers `charge.refunded` and your code revokes **all** entitlements for that session unconditionally — it never checks `charge.amount_refunded === charge.amount`. A creator issuing a goodwill partial refund silently nukes the customer's access.

**Fix:** gate full-revocation on a full refund.
```ts
case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  // Only revoke on a FULL refund; ignore partials.
  if (charge.amount_refunded >= charge.amount && charge.refunded) {
    await handleRevoke(sb, charge);
  } else {
    console.log("partial refund, not revoking", charge.id);
  }
  break;
}
```

### C-2 — `findOrCreateUser` lets an attacker hijack another buyer's entitlements via email
**File:** `ea-stripe-webhook/index.ts` → `handleCheckoutCompleted`, `findOrCreateUser`

Access is granted to whatever email Stripe reports on the session, and entitlements attach to the auth user with that email. Your checkout function passes `customer_email` straight from the **client-supplied** `email` field. The webhook then uses `session.customer_email ?? customer_details.email`. There is no verification that the purchaser controls that inbox — Stripe does not verify email ownership at checkout. Combined with `email_confirm: true` in `createUser`, you are **pre-confirming an account for an unverified email** and granting it paid content. An attacker who knows victim@x.com can buy a $5 ebook under that address; the victim later signs up via magic link to that same pre-confirmed account and inherits — or collides with — the attacker's purchase records. More practically: the buyer's *real* login email may differ from their *Stripe receipt* email, so they pay and then cannot access what they bought (support burden), and the pre-confirmed shell account blocks normal signup.

**Fix:** Do not pre-confirm. Create the user **unconfirmed** and let Supabase's normal email-verification / magic-link flow prove ownership before first login. Entitlements can attach to the user id regardless, but the account must not be treated as confirmed until the buyer proves the inbox.
```ts
const { data: created } = await sb.auth.admin.createUser({
  email,
  email_confirm: false, // buyer proves ownership via magic link, not Stripe
});
```
Also: gate fulfillment on `session.payment_status === "paid"` (you check `=== "unpaid"` and skip, but `no_payment_required` / `null` slip through — see C-3).

### C-3 — Paid-status check is inverted-permissive; unpaid/incomplete sessions can grant access
**File:** `ea-stripe-webhook/index.ts` → `handleCheckoutCompleted`

```ts
if (session.payment_status && session.payment_status === "unpaid") { return; }
```
This only blocks the literal string `"unpaid"`. `checkout.session.completed` can fire for `payment_status` values you are *not* filtering. The safe pattern is **allow-list, not deny-list** — default deny:
```ts
const paid =
  session.payment_status === "paid" ||
  session.payment_status === "no_payment_required"; // 100%-off coupon
if (!paid) {
  console.log("session not payable, skipping grant", session.id, session.payment_status);
  return;
}
```

---

## HIGH

### H-1 — `ea-issue-media` and `ea-billing-portal` validate the JWT with the **service-role** client, which bypasses token revocation/RLS guarantees
**Files:** `ea-issue-media/index.ts` → `resolveUserId`, `ea-billing-portal/index.ts`

`db.auth.getUser(token)` *does* validate the JWT signature and expiry, so this is not an auth bypass — but you are calling it on a client created with the **service role key**. The correct, defensible pattern for "verify a caller's token" is to construct the client with the **anon key** and pass the user's token in the `Authorization` global header, so the GoTrue call is scoped to that token and you don't risk the service-role client silently honoring an admin/impersonation context. Functionally `getUser(token)` is token-scoped, so this is lower risk than it looks, but for a money path you want the token validation isolated from the privileged client. Keep the service-role client **only** for the DB/storage reads after identity is established.
```ts
const userClient = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: { user } } = await userClient.auth.getUser();
```
This is a defense-in-depth hardening, not a proven exploit — but on a real-money gate it should be done.

### H-2 — `ea-billing-portal` accepts the anon/publishable key as a bearer token
**File:** `ea-billing-portal/index.ts`

Unlike `ea-issue-media` (which guards with `token.split(".").length !== 3`), the billing portal does **no shape check**. With `verify_jwt = false`, `sb.auth.getUser(<garbage>)` is called on every request. It will reject invalid tokens, but you're spending a GoTrue round-trip on unauthenticated noise and have no early-out. Add the same 3-segment guard `ea-issue-media` already has, and reject anything that resolves to a non-`authenticated` role. Low exploitability, but inconsistent hardening across two functions that should be identical.

### H-3 — CORS is `Access-Control-Allow-Origin: *` on authenticated, credentialed endpoints
**Files:** all four functions

`*` on `ea-issue-media` and `ea-billing-portal` means any website can make a logged-in user's browser POST to your media/portal endpoints with their bearer token (if the site can read it). You're not using cookie auth (token is in a header, not credentialed cookies), so this is **medium** not critical — but there's no reason to allow `*`. Lock the origin to your storefront. Reflecting `*` while also documenting `Access-Control-Allow-Headers: authorization` is the worst-of-both signal to an auditor.
```ts
const ALLOWED_ORIGIN = "https://academy.taylormadecreative.net";
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```
The webhook is server-to-server — drop CORS there entirely (it's noise, and `*` is meaningless to Stripe).

### H-4 — No rate limiting on `ea-create-checkout` or `ea-issue-media`
**Files:** `ea-create-checkout/index.ts`, `ea-issue-media/index.ts`

`ea-create-checkout` is unauthenticated (`verify_jwt = false`) and calls `stripe.checkout.sessions.list({ limit: 20 })` on every request where an email is supplied. An attacker can hammer it to (a) burn your Stripe API rate budget and (b) enumerate which emails have open sessions for which product slugs (the reuse path returns a live payable URL for `customer_email == email`). `ea-issue-media` mints signed URLs and can be brute-forced across slugs. Add per-IP throttling (Supabase doesn't give you this for free — implement a token-bucket in Postgres/Redis or put it behind a WAF/Cloudflare rule). At minimum, restrict the reuse-lookup to reduce the enumeration surface.

---

## MEDIUM

### M-1 — Session-reuse path can hand one buyer another buyer's payable Checkout URL
**File:** `ea-create-checkout/index.ts`

The reuse filter matches `s.metadata?.product_slug === product.slug && (s.customer_email ?? "").toLowerCase() === email`. Because `email` is **client-supplied and unverified**, anyone can POST `{ product_id, email: "victim@x.com" }` and, if a matching open session exists, receive **that session's payable `url`**. Paying it completes a purchase that the webhook will attribute to victim@x.com. This is an information-disclosure + purchase-confusion vector. Either drop the reuse optimization, or key reuse on something the caller can't spoof (you can't, pre-auth) — safest is to remove it and rely on Checkout's own idempotency. The double-charge risk it's solving is small; the spoof risk it creates is larger.

### M-2 — `charge.dispute.created` does a full extra `charges.retrieve` then reuses C-1's broken revoke
**File:** `ea-stripe-webhook/index.ts` → `handleDispute` / `handleRevoke`

Disputes correctly revoke (full access pull on a chargeback is intended). But it inherits C-1's partial-refund bug only via the refunded path; disputes are fine logically. The concern here is **idempotency of revoke vs. re-grant ordering**: a dispute revokes, but if `checkout.session.completed` is *retried by Stripe after* the dispute (out-of-order delivery, which Stripe explicitly does not guarantee ordering for), `grantEntitlement` upserts `revoked_at: null` and **silently re-grants access to a disputed purchase**. Guard the grant against an existing dispute, or never clear `revoked_at` on upsert (see M-3).

### M-3 — `grantEntitlement` unconditionally clears `revoked_at` on every upsert — replays resurrect revoked access
**File:** `ea-stripe-webhook/index.ts` → `grantEntitlement`

```ts
.upsert({ ..., revoked_at: null }, { onConflict: "user_id,product_id" })
```
Stripe **retries `checkout.session.completed`** (up to 3 days). If a refund/dispute lands between the original delivery and a retry, the retry re-runs the grant and **wipes `revoked_at`**, restoring access to content the buyer was refunded for. This is a direct revenue-loss / fraud hole on the idempotency path you advertise as "safe on retries." Make the grant **not** un-revoke:
```ts
// On conflict, do not touch revoked_at. Re-purchase should go through an
// explicit re-grant, not a webhook replay.
.upsert(
  { user_id, product_id, source, stripe_session_id, granted_at: new Date().toISOString() },
  { onConflict: "user_id,product_id", ignoreDuplicates: true },
);
```
If you genuinely want re-purchase to re-grant, do it conditionally: only clear `revoked_at` when the new `stripe_session_id` differs from the revoking session — not on a blind replay of the same session.

### M-4 — Webhook swallows all handler errors and returns 200, so failed grants are never retried
**File:** `ea-stripe-webhook/index.ts` → entry `try/catch`

Every handler error is caught, logged, and acked with `200`. A transient Supabase outage during `grantEntitlement` means **the buyer pays and never gets access, and Stripe never retries** because you told it success. For a money path this is the wrong default. Return `500` on grant failure so Stripe retries; only swallow truly-unrecoverable errors (bad metadata). Concretely, make `grantEntitlement` / membership upserts **throw** on DB error, and let the outer catch return `500` for fulfillment events:
```ts
if (error) throw new Error(`grantEntitlement failed: ${error.message}`);
```
```ts
} catch (e) {
  console.error("handler error", event.type, (e as Error).message);
  return json({ error: "handler_failed" }, 500); // Stripe will retry
}
```
This pairs with your idempotency upserts — retries are safe to re-run.

### M-5 — `productIdFromLineItems` / `productIdBySlugOrId` reference metadata fields the checkout function never sets, masking misconfig
**File:** `ea-stripe-webhook/index.ts` → `handleCheckoutCompleted`

The webhook looks for `meta.product_id` and `meta.slug`, but `ea-create-checkout` stamps `product_slug` and `entitlement_product_ids` (not `product_id`/`slug`). The fallbacks happen to work via `product_slug`, but the dead branches mean the **`entitlement_product_ids` CSV the checkout function carefully builds is never read** — the webhook re-resolves products by slug/price instead. For a bundle, the checkout function resolves children into `entitlement_product_ids` *and* `bundle_of`; the webhook only reads `bundle_of`. It works today, but the two functions disagree about the contract. Pick one source of truth: have the webhook iterate `entitlement_product_ids` directly (ids, already resolved server-side) and stop re-deriving. This also closes the price-id fallback path (`productIdFromLineItems`) which could mis-map shared prices.

---

## LOW / INFORMATIONAL

### L-1 — `current_period_end` accessed via cast suggests SDK version drift
**File:** `ea-stripe-webhook/index.ts` (multiple)

You cast `(sub as { current_period_end?: number })`. In recent Stripe API versions `current_period_end` moved to the subscription **item**, not the subscription. With `apiVersion: "2024-06-20"` pinned it's on the subscription, so this works — but the cast is hiding a real version coupling. If anyone bumps the API version, `periodEnd` silently becomes `null` and memberships look expired. Pin intentionally and add a comment, or read from `sub.items.data[0].current_period_end` per the newer shape. Not a security bug; a latent 500-to-null correctness bug.

### L-2 — Stripe SDK versions differ across functions (v17 in checkout, v14 in webhook/portal)
**Files:** `ea-create-checkout` (`npm:stripe@17`) vs `ea-stripe-webhook`/`ea-billing-portal` (`esm.sh/stripe@14`)

Mixing major versions across functions that share metadata contracts and API-version assumptions is a maintenance/runtime-bug risk. Standardize on one major version and one import source (prefer `npm:` specifier consistently on Deno). Verify the chosen version supports `constructEventAsync` + `createSubtleCryptoProvider` (v14 and v17 both do).

### L-3 — `ensureProfile` upsert with `ignoreDuplicates: true` on `onConflict: "id"` silently no-ops email backfill
**File:** `ea-stripe-webhook/index.ts`

If a profile row already exists with a stale/empty email, `ignoreDuplicates` means it's never corrected. Minor data-quality issue, not security.

---

## What is correct (briefly)

- **Webhook signature verification is done right.** `constructEventAsync` with `createSubtleCryptoProvider()` (the async Deno/SubtleCrypto verifier), the **raw** body via `await req.text()` (not parsed), the secret from `STRIPE_WEBHOOK_SECRET` env, and it **rejects with 400 on failure** before any DB work. This is the single most important thing and it's solid. ✅
- **Price integrity is correct.** Price/amount is always read server-side from `ea_products` by slug; the client only sends a slug + optional email hint. No client-supplied amount ever reaches Stripe. ✅
- **Bundle grants both child entitlements** (checkout resolves children server-side; webhook grants each). The mechanism is sound; just consolidate the metadata contract (M-5). ✅
- **Entitlement gating in `ea-issue-media` is well-designed**: JWT validated, ownership checked via `(user_id, product_id, revoked_at IS NULL)`, unknown product and not-entitled both return identical `404 not_found` (no path/existence leak), storage_path never returned, 1-hour TTL signed URL. The only hardening is H-1 (validate token on a non-privileged client). ✅
- **Service-role key is server-side only**; never returned to the browser; `503 payments_not_configured` graceful-degrade path is clean. ✅
- **Bearer token is required and validated** on both `ea-issue-media` and `ea-billing-portal`. ✅
- **Idempotent upserts on unique keys** (`user_id,product_id` for entitlements, `user_id` for memberships) are the right shape — the bug is the `revoked_at: null` reset (M-3), not the upsert itself.

---

## Verdict

**FIX FIRST.** Blockers before real money: C-1 (partial refunds nuke access), C-2/C-3 (unverified-email pre-confirmed accounts + permissive paid-status check), M-3 (webhook replay resurrects revoked access), and M-4 (paid-but-failed-grant is never retried). The signature verification and price-integrity core are correct — the gaps are in fulfillment idempotency, refund/revocation correctness, and email-identity trust.

Files needing edits: `supabase/functions/ea-stripe-webhook/index.ts` (C-1, C-2, C-3, M-2, M-3, M-4, M-5, L-1, L-3), `supabase/functions/ea-create-checkout/index.ts` (M-1, H-3, H-4), `supabase/functions/ea-issue-media/index.ts` (H-1, H-3, H-4), `supabase/functions/ea-billing-portal/index.ts` (H-1, H-2, H-3).