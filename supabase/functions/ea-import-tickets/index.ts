// ea-import-tickets — seats sold somewhere else (Eventbrite) get Academy seat codes.
//
//   POST (Authorization: Bearer <the signed-in admin's JWT>)
//     { event_id, tier_id, source: 'eventbrite' | 'comp',
//       rows: [{ name, email, amount_cents?, ref? }], send_email?: true }
//     -> { ok: true, issued: 3, skipped: 1, failed: 0, results: [...] }
//
// Each new row becomes a paid ea_orders row (source stamped) and runs through the SAME
// fulfilment path as a Stripe sale: ea_fulfill_order issues the seat, and _shared/tickets
// sends the ticket email with the room link. A row whose email already holds a valid seat
// for this event is skipped, so re-pasting the Eventbrite export is safe.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fulfillOrder } from "../_shared/tickets.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // ---- who is calling? -------------------------------------------------------------
    const auth = req.headers.get("authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user }, error: uErr } = await asUser.auth.getUser(jwt);
    if (uErr || !user) return json({ error: "unauthorized" }, 401);

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") return json({ error: "forbidden" }, 403);

    // ---- input -----------------------------------------------------------------------
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }
    const eventId = str(body.event_id, 40);
    const tierId = str(body.tier_id, 40);
    const source = str(body.source, 20) === "comp" ? "comp" : "eventbrite";
    const rowsIn = Array.isArray(body.rows) ? body.rows.slice(0, 200) : [];
    if (!eventId || !tierId) return json({ error: "event_and_tier_required" }, 400);
    if (!rowsIn.length) return json({ error: "rows_required" }, 400);

    const { data: ev } = await sb.from("ea_events").select("id, title").eq("id", eventId).maybeSingle();
    if (!ev) return json({ error: "event_not_found" }, 404);
    const { data: tier } = await sb.from("ea_ticket_tiers").select("id, event_id, price_cents").eq("id", tierId).maybeSingle();
    if (!tier || tier.event_id !== eventId) return json({ error: "tier_not_on_event" }, 400);

    // Emails that already hold a valid seat on this event are skipped, whatever the source.
    const { data: held } = await sb.from("ea_tickets").select("holder_email").eq("event_id", eventId).eq("status", "valid");
    const have = new Set((held ?? []).map((t: { holder_email: string }) => t.holder_email.toLowerCase()));

    const results: Array<Record<string, unknown>> = [];
    let issued = 0, skipped = 0, failed = 0;
    for (const raw of rowsIn) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const email = str(r.email, 200).toLowerCase();
      const name = str(r.name, 120);
      const cents = Number.isFinite(Number(r.amount_cents)) ? Math.max(0, Math.round(Number(r.amount_cents))) : tier.price_cents;
      if (!EMAIL_RX.test(email)) { failed++; results.push({ email, error: "bad_email" }); continue; }
      if (have.has(email)) { skipped++; results.push({ email, skipped: "already_has_seat" }); continue; }

      const { data: order, error: oErr } = await sb.from("ea_orders").insert({
        event_id: eventId, tier_id: tierId, email, full_name: name || null, qty: 1,
        amount_cents: cents, status: "pending", source,
        stripe_session_id: r.ref ? `${source}:${str(r.ref, 80)}` : null,
      }).select("id").single();
      if (oErr || !order) { failed++; results.push({ email, error: oErr?.message ?? "insert_failed" }); continue; }

      try {
        const tickets = await fulfillOrder(sb, order.id);
        have.add(email);
        issued++;
        results.push({ email, codes: tickets.map((t) => t.code) });
      } catch (e) {
        failed++;
        results.push({ email, error: (e as Error).message });
      }
    }
    return json({ ok: true, issued, skipped, failed, results });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
