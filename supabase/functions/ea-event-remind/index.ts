// ea-event-remind — "See you tomorrow" and "Starting in an hour" for every ticketed date (ea_events):
// the free AI 101 class and the paid workshop alike. The rules live in handler.ts; handler_test.ts is
// the proof. This file wires the world in: the service-role client (events, seats, the sent-log),
// Resend through _shared/email.ts, and the shared secret pg_cron sends (migration 0056 schedules the
// knock every 5 minutes, reusing the Vault secret opil_remind_secret = function secret REMIND_SECRET).
//
//   POST  x-remind-secret: <REMIND_SECRET>   ->  200 { ok, due, sent, skipped }
//
// Deploy WITHOUT the JWT gate (pg_cron carries no user token):
//   supabase functions deploy ea-event-remind --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
import { createClient } from "npm:@supabase/supabase-js@2";
import { NELSON, SITE, button, esc, layout, sendBatch, sendEmail, when } from "../_shared/email.ts";
import { type EventRow, handleRemind, type Kind, type Recipient } from "./handler.ts";
import { freshJoinUrl } from "../_shared/tickets.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

  const reply = await handleRemind(req.headers, Deno.env.get("REMIND_SECRET"), {
    now: () => Date.now(),
    listEvents: async () => {
      const from = new Date(Date.now() - 5 * 60000).toISOString();
      const to = new Date(Date.now() + 25 * 3600e3).toISOString();
      const { data, error } = await admin.from("ea_events")
        .select("id, workshop_slug, title, starts_at, tz, format, status, join_url, venue_label, venue_address")
        .in("status", ["on_sale", "sold_out"]).gte("starts_at", from).lte("starts_at", to);
      if (error) { console.error("[ea-event-remind] events", error.message); return []; }
      const evs = (data || []) as EventRow[];
      for (const ev of evs) ev.join_url = await freshJoinUrl(admin, ev.join_url);
      return evs;
    },
    listReminded: async () => {
      const { data, error } = await admin.from("ea_event_reminders").select("event_id, kind");
      if (error) { console.error("[ea-event-remind] reminders", error.message); return []; }
      return (data || []).map((r: { event_id: string; kind: string }) => `${r.event_id}:${r.kind}`);
    },
    listRecipients: async (ev) => {
      const { data, error } = await admin.from("ea_tickets")
        .select("holder_email, holder_name, ea_ticket_tiers(name)").eq("event_id", ev.id).eq("status", "valid");
      if (error) throw new Error(error.message);
      return (data || []).map((t: { holder_email: string; holder_name: string | null; ea_ticket_tiers: { name: string } | { name: string }[] | null }): Recipient => {
        const tier = Array.isArray(t.ea_ticket_tiers) ? t.ea_ticket_tiers[0] : t.ea_ticket_tiers;
        return { email: t.holder_email, name: t.holder_name, inPerson: /in person/i.test(tier?.name ?? "") };
      });
    },
    claim: async (eventId: string, kind: Kind) => {
      const { data, error } = await admin.from("ea_event_reminders")
        .upsert({ event_id: eventId, kind }, { onConflict: "event_id,kind", ignoreDuplicates: true }).select("event_id");
      if (error) { console.error("[ea-event-remind] claim", error.message); return false; }
      return Array.isArray(data) && data.length === 1;
    },
    unclaim: async (eventId: string, kind: Kind) => {
      const { error } = await admin.from("ea_event_reminders").delete().eq("event_id", eventId).eq("kind", kind);
      if (error) console.error("[ea-event-remind] unclaim", error.message);
    },
    sendBatch,
    layout,
    button,
    esc,
    when,
    site: SITE,
  });
  if (reply.status === 200) console.log("[ea-event-remind]", JSON.stringify(reply.body));
  const missed = ((reply.body as { due?: string[] }).due || []).filter((l) => /missed/.test(l));
  if (missed.length) {
    await sendEmail({ to: NELSON, subject: "REMINDER EMAIL PARTLY FAILED",
      html: `<p>Some reminder emails did not go out:</p><p>${missed.map(esc).join("<br>")}</p><p>Resend the room link from /founder/ → Announce.</p>` })
      .catch((e) => console.error("[ea-event-remind] alert", (e as Error).message));
  }
  return json(reply.body, reply.status);
});
