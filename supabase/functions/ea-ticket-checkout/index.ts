// ea-ticket-checkout — Taylormade Academy sells its own workshop seats.
//
//   POST { tier_id, email, name, qty?, early? }  ->  { url }        (Stripe Checkout)
//                                                ->  { done: true, codes: [...] } for a $0 tier
//
// verify_jwt is off. Price, availability, sales window and access all come from the
// database, never from the browser.
//
// The seat hold is ATOMIC: ea_hold_seats (migration 0025) takes an advisory lock on the
// tier, counts what is taken, and inserts the pending order in one transaction. Checking
// availability here and inserting afterwards would let two buyers race for the last seat
// of a 15-seat room, which is exactly the traffic the announcement email produces.
// The hold lapses after 30 minutes, which is also the Checkout session expiry.
// Fulfilment (paid -> seats -> email) happens in one place, _shared/tickets.ts.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, when } from "../_shared/email.ts";
import { fulfillOrder } from "../_shared/tickets.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QTY = 4;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type PublicTier = {
  id: string; event_id: string; name: string; description: string | null; price_cents: number; qty: number;
  sales_start: string | null; sales_end: string | null; access: string; sold: number;
};
type HeldOrder = { id: string; qty: number; amount_cents: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // GET ?session_id=cs_... -> what the thank-you page shows. Session ids are Stripe's
  // own unguessable tokens; the buyer just came back from Stripe holding one.
  if (req.method === "GET") {
    const sid = new URL(req.url).searchParams.get("session_id") ?? "";
    if (!/^cs_[A-Za-z0-9_]{10,}$/.test(sid)) return json({ error: "bad_request" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await sb.from("ea_orders").select("id, status, qty, event_id, tier_id, full_name")
      .eq("stripe_session_id", sid).maybeSingle();
    if (!order) return json({ error: "not_found" }, 404);
    const [{ data: ev }, { data: tier }, { data: tix }] = await Promise.all([
      sb.from("ea_events").select("title, starts_at, tz, format, venue_label").eq("id", order.event_id).maybeSingle(),
      sb.from("ea_ticket_tiers").select("name").eq("id", order.tier_id).maybeSingle(),
      sb.from("ea_tickets").select("code").eq("order_id", order.id).eq("status", "valid").order("created_at"),
    ]);
    return json({
      status: order.status, qty: order.qty, first_name: (order.full_name || "").split(" ")[0] || "",
      event: ev ? { title: ev.title, when: when(ev.starts_at, ev.tz), format: ev.format, venue_label: ev.venue_label } : null,
      tier: tier?.name ?? null,
      codes: (tix ?? []).map((t) => t.code),
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }

    const tierId = str(body.tier_id, 40);
    const email = str(body.email, 200).toLowerCase();
    const name = str(body.name, 120);
    const early = str(body.early, 40);
    const qtyRaw = Number(body.qty ?? 1);
    const qty = Number.isInteger(qtyRaw) && qtyRaw >= 1 && qtyRaw <= MAX_QTY ? qtyRaw : 1;
    if (!UUID_RX.test(tierId)) return json({ error: "bad_request" }, 400);
    if (!EMAIL_RX.test(email)) return json({ error: "email_invalid" }, 400);
    if (name.length < 2) return json({ error: "name_required" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const { data: allowed } = await sb.rpc("ea_rate_check", { p_key: "tix:" + ip, p_max: 10, p_window_secs: 60 });
    if (allowed === false) return json({ error: "rate_limited" }, 429);

    // ---- the tier, through the same public view the page reads --------------------
    const { data: tier, error: tErr } = await sb.from("ea_tiers_public").select("*").eq("id", tierId).maybeSingle<PublicTier>();
    if (tErr) { console.error("tier lookup", tErr.message); return json({ error: "server_error" }, 500); }
    if (!tier) return json({ error: "not_on_sale" }, 404);

    const now = Date.now();
    if (tier.sales_start && now < Date.parse(tier.sales_start)) return json({ error: "not_open_yet", opens_at: tier.sales_start }, 400);
    if (tier.sales_end && now > Date.parse(tier.sales_end)) return json({ error: "sales_closed" }, 400);

    const { data: ev, error: eErr } = await sb.from("ea_events")
      .select("id, workshop_slug, title, starts_at, tz, format, venue_label, status").eq("id", tier.event_id).maybeSingle();
    if (eErr || !ev) { console.error("event lookup", eErr?.message); return json({ error: "server_error" }, 500); }
    if (ev.status !== "on_sale") return json({ error: "not_on_sale" }, 400);

    // ---- waitlist early access ----------------------------------------------------
    let signupId: string | null = null;
    if (early && UUID_RX.test(early)) {
      const { data: su } = await sb.from("ea_wl_signups").select("id, status")
        .eq("early_token", early).eq("workshop_slug", ev.workshop_slug).maybeSingle();
      if (su && su.status !== "unsubscribed") signupId = su.id;
    }
    if (tier.access === "waitlist" && !signupId) return json({ error: "waitlist_only" }, 403);

    // ---- hold the seat(s), atomically -------------------------------------------------
    // One statement: lock the tier, recount what is taken, insert the pending order.
    const { data: held, error: hErr } = await sb.rpc("ea_hold_seats", {
      p_tier_id: tier.id, p_email: email, p_full_name: name, p_qty: qty, p_signup_id: signupId,
    });
    if (hErr) { console.error("ea_hold_seats", hErr.message); return json({ error: "server_error" }, 500); }
    const hold = (held ?? {}) as { error?: string; available?: number; order?: HeldOrder };
    if (hold.error === "sold_out") return json({ error: "sold_out", available: hold.available ?? 0 }, 409);
    if (hold.error) return json({ error: hold.error === "not_on_sale" ? "not_on_sale" : "server_error" }, hold.error === "not_on_sale" ? 400 : 500);
    const order = hold.order;
    if (!order) { console.error("hold returned no order", held); return json({ error: "server_error" }, 500); }

    // From here on, any failure must release the seat we just held.
    const releaseSeat = async () => {
      const { error } = await sb.from("ea_orders").update({ status: "canceled" }).eq("id", order.id).eq("status", "pending");
      if (error) console.error("could not release held seat", order.id, error.message);
    };

    // ---- a free seat never goes through Stripe ---------------------------------------
    if (order.amount_cents === 0) {
      try {
        const tickets = await fulfillOrder(sb, order.id);
        return json({ done: true, order_id: order.id, codes: tickets.map((t) => t.code) });
      } catch (e) {
        await releaseSeat();
        console.error("free fulfilment failed", (e as Error).message);
        return json({ error: "server_error" }, 500);
      }
    }

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) {
      await releaseSeat();
      return json({ error: "payments_not_configured" }, 503);
    }
    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

    const metadata: Record<string, string> = {
      kind: "ticket", order_id: order.id, event_id: ev.id, tier_id: tier.id, qty: String(qty), email,
    };
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          quantity: qty,
          price_data: {
            currency: "usd",
            unit_amount: tier.price_cents,
            product_data: {
              name: `${ev.title} - ${tier.name}`,
              description: `${when(ev.starts_at, ev.tz)}${ev.venue_label ? ` - ${ev.venue_label}` : ""}`,
            },
          },
        }],
        metadata,
        payment_intent_data: { metadata },
        customer_email: email,
        allow_promotion_codes: true,
        expires_at: Math.floor(now / 1000) + 31 * 60,
        success_url: `${SITE}/agent/thanks/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE}/agent/#seats`,
      });
    } catch (e) {
      // Stripe refused or was unreachable. Give the seat back immediately rather than
      // letting a dead hold block a real buyer for the next 30 minutes.
      await releaseSeat();
      console.error("stripe session create failed", (e as Error).message);
      return json({ error: "server_error" }, 500);
    }
    if (!session.url) {
      await releaseSeat();
      console.error("stripe session without url", session.id);
      return json({ error: "server_error" }, 500);
    }
    await sb.from("ea_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return json({ url: session.url });
  } catch (e) {
    console.error("ea-ticket-checkout error", e);
    return json({ error: "server_error" }, 500);
  }
});
