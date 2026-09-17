// ea-opil-remind — "Class starts at 6:30 PM ET — here's your link", half an hour before every class.
// The rules live in handler.ts; handler_test.ts is the proof. This file wires the world in: the
// service-role client (sessions, approved registrations, facilitators, the sent-log), Resend through
// _shared/email.ts, and the shared secret pg_cron sends (migration 0050 schedules the knock every 5 min).
//
//   POST  x-remind-secret: <REMIND_SECRET>   ->  200 { ok, due, sent, skipped }
//                                              401 forbidden · 503 not_configured
//
// Secrets: REMIND_SECRET (must equal the Vault secret opil_remind_secret that pg_cron sends —
// scripts/apply-0050.sh sets both), RESEND_API_KEY (already on the project for the other mailers).
// Deploy WITHOUT the JWT gate (pg_cron carries no user token):
//   supabase functions deploy ea-opil-remind --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { button, esc, layout, sendBatch } from "../_shared/email.ts";
import { handleRemind, type Recipient, recipientsFromRegistration, type RegistrationRow, type Session } from "./handler.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://taylormadeacademy.com",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-remind-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

  const reply = await handleRemind(req.headers, Deno.env.get("REMIND_SECRET"), {
    now: () => Date.now(),
    listSessions: async () => {
      const { data, error } = await admin.from("ea_opil_sessions").select("no, kind, title, session_date, start_time, end_time").order("no");
      if (error) { console.error("[ea-opil-remind] sessions", error.message); return []; }
      return (data || []) as Session[];
    },
    listReminded: async (kind) => {
      const { data, error } = await admin.from("ea_class_reminders").select("room_key").eq("kind", kind);
      if (error) { console.error("[ea-opil-remind] reminders", error.message); return []; }
      return (data || []).map((r: { room_key: string }) => r.room_key);
    },
    listRecipients: async (session) => {
      /* a failed read THROWS — the handler then hands the claim back and the next tick retries. Returning a
         shorter list here would look like "nobody to email" and burn the class's one reminder. */
      const { data: regs, error: e1 } = await admin.from("ea_opil_registrations").select("email, personal_email, full_name, members").eq("approved", true);
      if (e1) throw new Error("registrations: " + e1.message);
      const out: Recipient[] = [];
      for (const r of (regs || []) as RegistrationRow[]) out.push(...recipientsFromRegistration(r));   /* lead + teammates */
      const { data: facs, error: e2 } = await admin.from("ea_opil_facilitators").select("email, label").contains("session_nos", [Number(session.no)]);
      if (e2) throw new Error("facilitators: " + e2.message);
      for (const f of (facs || []) as { email: string; label: string | null }[]) {
        out.push({ email: f.email, name: (f.label || "").split(" · ")[0] || null, kind: "facilitator" });
      }
      return out;
    },
    claim: async (roomKey, kind) => {
      /* insert-if-absent: the row coming back means this call made it; nothing back means it was already there */
      const { data, error } = await admin.from("ea_class_reminders").upsert({ room_key: roomKey, kind }, { onConflict: "room_key,kind", ignoreDuplicates: true }).select("room_key");
      if (error) { console.error("[ea-opil-remind] claim", error.message); return false; }
      return Array.isArray(data) && data.length === 1;
    },
    unclaim: async (roomKey, kind) => {
      const { error } = await admin.from("ea_class_reminders").delete().eq("room_key", roomKey).eq("kind", kind);
      if (error) console.error("[ea-opil-remind] unclaim", error.message);
    },
    sendBatch,
    wait: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
    layout,
    button,
    esc,
  });
  if (reply.status === 200) console.log("[ea-opil-remind]", JSON.stringify(reply.body));
  return json(reply.body, reply.status);
});
