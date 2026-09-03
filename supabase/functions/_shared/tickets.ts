// _shared/tickets.ts — the ONE place a ticket order is fulfilled.
// Called by ea-stripe-webhook (after a paid Checkout session) and by ea-ticket-checkout
// (for a $0 tier, which never touches Stripe).
//
// Idempotency is enforced in Postgres, not here: ea_fulfill_order (migration 0025) takes a
// transaction-scoped advisory lock on the order, marks it paid, issues exactly the missing
// seats, links the waitlist row, and reports first_time=false when another call already did
// the work. Stripe delivers checkout.session.completed AT LEAST once, so this matters: only
// the call that actually completes the order sends email.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { SITE, WORKSHOP, NELSON, esc, firstName, money, when, button, layout, sendEmail } from "./email.ts";

export type OrderRow = {
  id: string; event_id: string; tier_id: string; email: string; full_name: string | null;
  qty: number; amount_cents: number; stripe_session_id: string | null; stripe_payment_intent: string | null;
  status: string; paid_at: string | null; signup_id: string | null;
};
export type EventRow = {
  id: string; workshop_slug: string; title: string; blurb: string | null; starts_at: string; ends_at: string | null;
  tz: string; format: string; venue_label: string | null; venue_address: string | null; join_url: string | null;
};
export type TierRow = { id: string; name: string; description: string | null; price_cents: number };
export type TicketRow = { id: string; code: string; status: string };

type FulfilResult = {
  error?: string;
  first_time?: boolean;
  order?: OrderRow;
  event?: EventRow | null;
  tier?: TierRow | null;
  tickets?: TicketRow[];
};

export async function fulfillOrder(
  sb: SupabaseClient,
  orderId: string,
  stripe: { sessionId?: string | null; paymentIntent?: string | null } = {},
): Promise<TicketRow[]> {
  const { data, error } = await sb.rpc("ea_fulfill_order", {
    p_order_id: orderId,
    p_session: stripe.sessionId ?? null,
    p_pi: stripe.paymentIntent ?? null,
  });
  // THROW on a DB error so the webhook returns 500 and Stripe retries. The RPC is
  // idempotent, so a retry is always safe.
  if (error) throw new Error(`ea_fulfill_order failed: ${error.message}`);

  const res = (data ?? {}) as FulfilResult;
  if (res.error) {
    // Not retryable (unknown, refunded, or canceled order). Log and acknowledge.
    console.error("order not fulfillable", orderId, res.error);
    return [];
  }
  const tickets = res.tickets ?? [];
  const order = res.order;
  if (!order) return tickets;

  // Another delivery already completed this order and already emailed. Stop here.
  if (!res.first_time) return tickets;

  await notifyFulfilled(order, res.event ?? null, res.tier ?? null, tickets);
  return tickets;
}

async function notifyFulfilled(order: OrderRow, ev: EventRow | null, tier: TierRow | null, tickets: TicketRow[]) {
  const codes = tickets.filter((t) => t.status === "valid").map((t) => t.code);

  // The buyer's email is the ONLY place the private address / join link is delivered, so a
  // failure here is a real problem, not a nicety. Tell Nelson explicitly when it happens.
  const sent = await sendTicketEmail(order, ev, tier, codes);

  const heading = sent.ok ? "A seat just sold" : "A seat sold, but the ticket email did not send";
  const warn = sent.ok
    ? ""
    : `<p style="margin:0 0 14px;padding:12px 14px;background:#fff1f0;border:1px solid #f5c2c0;border-radius:10px;font-size:14px;line-height:1.55;color:#b42318"><b>Action needed.</b> The buyer has paid but never got their seat code or the address. Email them directly. (${esc(sent.error ?? (sent.skipped ? "email is not configured" : "unknown error"))})</p>`;

  await sendEmail({
    to: NELSON,
    subject: `${sent.ok ? "Seat sold" : "SEAT SOLD, EMAIL FAILED"}: ${order.full_name || order.email} (${tier?.name ?? "ticket"} x${order.qty}, ${money(order.amount_cents)})`,
    html: layout({
      heading,
      body: warn +
        `<p style="font-size:15px;line-height:1.6;color:#33415b">${esc(order.full_name || "Someone")} &middot; ${esc(order.email)}<br>${esc(ev?.title ?? WORKSHOP.title)} &middot; ${esc(tier?.name ?? "")} &times; ${order.qty} &middot; ${money(order.amount_cents)}<br>Codes: ${codes.map((c) => esc(c)).join(", ") || "none"}</p>` +
        button(`${SITE}/founder/#orders`, "Open the founder dashboard"),
      foot: "Founder notice from taylormadeacademy.com.",
    }),
  });
}

export async function sendTicketEmail(order: OrderRow, ev: EventRow | null, tier: TierRow | null, codes: string[]) {
  const title = ev?.title ?? WORKSHOP.title;
  const where = ev?.format === "virtual"
    ? `<b>Where:</b> Online. ${ev?.join_url ? `Your link: <a href="${esc(ev.join_url)}" style="color:#0b40e0">${esc(ev.join_url)}</a>` : "The join link comes by email the day before."}`
    : `<b>Where:</b> ${esc(ev?.venue_address || ev?.venue_label || "Details follow by email.")}`;
  const codeHtml = codes.map((c) =>
    `<div style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border:2px dashed #c9d3e6;border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;letter-spacing:.08em;color:#0a1733;font-weight:700">${esc(c)}</div>`
  ).join("");
  const body =
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${esc(firstName(order.full_name))}, your seat is confirmed. Here is everything you need.</p>` +
    `<div style="background:#f5f7fc;border-radius:14px;padding:18px 20px;margin:0 0 18px;font-size:15px;line-height:1.7;color:#33415b">` +
    `<b>What:</b> ${esc(title)}${tier ? ` &middot; ${esc(tier.name)}` : ""}<br>` +
    `<b>When:</b> ${esc(when(ev?.starts_at, ev?.tz))}<br>` +
    `${where}<br>` +
    `<b>Seats:</b> ${order.qty} &middot; <b>Paid:</b> ${money(order.amount_cents)}</div>` +
    `<p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#5d6b84">Your seat code${codes.length > 1 ? "s" : ""}</p>${codeHtml}` +
    `<p style="margin:16px 0 0;font-size:15px;line-height:1.62;color:#33415b">Bring a laptop and a charger. You will leave with a working agent and the playbook to build the next one. Reply to this email with any question, it comes straight to me.</p>` +
    button(`${SITE}/login/?mode=join`, "Join the Academy free before the night");
  return await sendEmail({
    to: order.email,
    subject: `Your seat is confirmed: ${title}`,
    html: layout({ preheader: `Seat code ${codes[0] ?? ""}. ${when(ev?.starts_at, ev?.tz)}.`, kicker: "Ticket", heading: "You are in.", body, foot: `Seven-day refund policy: <a href="${SITE}/refunds/" style="color:#94a3b8">taylormadeacademy.com/refunds</a>. Questions: reply to this email.` }),
  });
}

// Full refund or dispute: the order is refunded and its seats are void.
export async function voidOrderBySession(sb: SupabaseClient, sessionId: string) {
  const { data: order, error } = await sb.from("ea_orders").select("id, status").eq("stripe_session_id", sessionId).maybeSingle();
  if (error || !order) return;
  if (order.status !== "refunded") {
    await sb.from("ea_orders").update({ status: "refunded" }).eq("id", order.id);
  }
  await sb.from("ea_tickets").update({ status: "void" }).eq("order_id", order.id).eq("status", "valid");
}
