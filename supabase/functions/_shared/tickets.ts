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

// AI 101 — the free class before the paid workshop. A seat is a $0 tier on an ea_events row with
// this workshop_slug. Its email is the free-class email (no seat code to paste, no "Paid" line), and
// every sign-up is also put on the agent workshop waitlist, so the personal early link in the
// founder's Announce email reaches them for the class price after the class.
export const AI101 = {
  slug: "ai101",
  cheatSheet: `${SITE}/ai101/cheat-sheet.pdf`,
  page: `${SITE}/ai101/`,
};
export const isAi101 = (ev: { workshop_slug?: string | null } | null | undefined) => ev?.workshop_slug === AI101.slug;

// A room link stored on an event goes stale the moment the room link is rotated, and the Academy
// room refuses a stale key. Every email re-reads the live key instead of trusting the stored copy.
export async function freshJoinUrl(sb: SupabaseClient, url: string | null): Promise<string | null> {
  if (!url || !/\/room\/\?k=/.test(url)) return url;
  const { data, error } = await sb.from("ea_rooms").select("link_key").eq("slug", "academy").maybeSingle();
  if (error || !data?.link_key) { console.error("[tickets] room key", error?.message); return url; }
  return url.replace(/\?k=[^&#]*/, `?k=${encodeURIComponent(data.link_key)}`);
}

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

  if (isAi101(res.event)) await joinAgentList(sb, order);
  if (res.event) res.event.join_url = await freshJoinUrl(sb, res.event.join_url);

  await notifyFulfilled(order, res.event ?? null, res.tier ?? null, tickets);
  return tickets;
}

// An AI 101 sign-up lands on the agent workshop list too (source 'ai101'). Someone already on the
// list keeps their row, their place and their early link. A failure here never blocks the seat.
async function joinAgentList(sb: SupabaseClient, order: OrderRow) {
  const email = String(order.email || "").trim().toLowerCase();
  const name = String(order.full_name || "").trim();
  if (!email || name.length < 2) return;
  const { error } = await sb.from("ea_wl_signups").upsert(
    { workshop_slug: WORKSHOP.slug, full_name: name.slice(0, 120), email, source: "ai101" },
    { onConflict: "workshop_slug,email", ignoreDuplicates: true },
  );
  if (error) console.error("ai101 -> agent list failed", order.id, error.message);
}

async function notifyFulfilled(order: OrderRow, ev: EventRow | null, tier: TierRow | null, tickets: TicketRow[]) {
  const codes = tickets.filter((t) => t.status === "valid").map((t) => t.code);

  // The buyer's email is the ONLY place the private address / join link is delivered, so a
  // failure here is a real problem, not a nicety. Tell Nelson explicitly when it happens.
  const sent = await sendTicketEmail(order, ev, tier, codes);

  const free = isAi101(ev);
  const heading = sent.ok ? (free ? "New AI 101 sign-up" : "A seat just sold") : (free ? "An AI 101 sign-up did not get their email" : "A seat sold, but the ticket email did not send");
  const warn = sent.ok
    ? ""
    : `<p style="margin:0 0 14px;padding:12px 14px;background:#fff1f0;border:1px solid #f5c2c0;border-radius:10px;font-size:14px;line-height:1.55;color:#b42318"><b>Action needed.</b> ${free ? "They signed up but never got the room link." : "The buyer has paid but never got their seat code or the address."} Email them directly. (${esc(sent.error ?? (sent.skipped ? "email is not configured" : "unknown error"))})</p>`;

  await sendEmail({
    to: NELSON,
    subject: free
      ? `${sent.ok ? "AI 101 sign-up" : "AI 101 SIGN-UP, EMAIL FAILED"}: ${order.full_name || order.email}`
      : `${sent.ok ? "Seat sold" : "SEAT SOLD, EMAIL FAILED"}: ${order.full_name || order.email} (${tier?.name ?? "ticket"} x${order.qty}, ${money(order.amount_cents)})`,
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
  if (isAi101(ev)) return await sendAi101Email(order, ev as EventRow);
  const title = ev?.title ?? WORKSHOP.title;
  // A tier named "In Person" on an otherwise online event is a seat in the studio: that buyer
  // gets the address, not the room link. Everyone else on a virtual event gets the room.
  const inPerson = /in person/i.test(tier?.name ?? "");
  const where = ev?.format === "virtual" && !inPerson
    ? `<b>Where:</b> Online, in the Taylormade Academy room. ${ev?.join_url ? `Open <a href="${esc(ev.join_url)}" style="color:#0b40e0">${esc(ev.join_url)}</a> and sign in with this email (a free Academy account, one minute to create). Signed in under a different email? Paste your seat code there once.` : "The room link comes by email the day before."}`
    : `<b>Where:</b> ${esc(ev?.venue_address || ev?.venue_label || "Details follow by email.")}${inPerson ? " Bring a laptop that can run Claude or ChatGPT in a browser." : ""}`;
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
    `<p style="margin:16px 0 0;font-size:15px;line-height:1.62;color:#33415b">Have your laptop open and a second tab ready for Claude or ChatGPT. You will leave with a working agent and the playbook to build the next one. Reply to this email with any question, it comes straight to me.</p>` +
    button(`${SITE}/login/?mode=join`, "Join the Academy free before the night");
  return await sendEmail({
    to: order.email,
    subject: `Your seat is confirmed: ${title}`,
    html: layout({ preheader: `Seat code ${codes[0] ?? ""}. ${when(ev?.starts_at, ev?.tz)}.`, kicker: "Ticket", heading: "You are in.", body, foot: `Seven-day refund policy: <a href="${SITE}/refunds/" style="color:#94a3b8">taylormadeacademy.com/refunds</a>. Questions: reply to this email.` }),
  });
}

// The free class: when, the room link, how to get in, the cheat sheet. No seat code to paste
// (the room lets any signed-in Academy account in through the link) and nothing about paying.
export function ai101Details(ev: EventRow): string {
  const room = ev.join_url
    ? `<b>Where:</b> Online, in the Taylormade Academy room: <a href="${esc(ev.join_url)}" style="color:#0b40e0">open the room</a>. It opens a few minutes before 7.`
    : `<b>Where:</b> Online, in the Taylormade Academy room. The link comes by email before the class.`;
  return `<div style="background:#f5f7fc;border-radius:14px;padding:18px 20px;margin:0 0 18px;font-size:15px;line-height:1.7;color:#33415b">` +
    `<b>What:</b> ${esc(ev.title)} (free, one hour: 7 to 8 PM Central)<br>` +
    `<b>When:</b> ${esc(when(ev.starts_at, ev.tz))}<br>` +
    `${room}</div>`;
}

async function sendAi101Email(order: OrderRow, ev: EventRow) {
  const p = (html: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${html}</p>`;
  const body =
    p(`${esc(firstName(order.full_name))}, your free seat is saved. Here is everything you need.`) +
    ai101Details(ev) +
    p(`<b>To get in:</b> you sign in with a free Taylormade Academy account, using this email (${esc(order.email)}). Making the account takes about a minute. Do it now, and on the night you just click the link and walk in.`) +
    button(`${SITE}/login/?mode=join`, "Make my free account") +
    p(`<b>Your cheat sheet:</b> the prompt steps and the AI words on one page. <a href="${esc(AI101.cheatSheet)}" style="color:#0b40e0">Download it here</a> and keep it next to you during class.`) +
    p(`<b>What to have:</b> a laptop, tablet, or phone. A laptop is best if you want to try along with me. A free ChatGPT or Claude account helps, but you can just watch.`) +
    p(`I will send a reminder the day before and one an hour before. Reply to this email with any question, it comes straight to me.`);
  return await sendEmail({
    to: order.email,
    subject: `You are in: ${ev.title}, ${when(ev.starts_at, ev.tz)}`,
    html: layout({
      preheader: `${when(ev.starts_at, ev.tz)}. Your room link and cheat sheet are inside.`,
      kicker: "Free class",
      heading: "You are in.",
      body,
      foot: `You signed up for the free AI 101 class at <a href="${AI101.page}" style="color:#94a3b8">taylormadeacademy.com/ai101</a>.`,
    }),
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
