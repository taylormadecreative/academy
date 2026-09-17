// ea-class-help-ping — emails the facilitators when a student asks for help outside class, and emails
// the student when the program team answers (spec 2026-09-16-class-features-design.md §5). The rules
// live in handler.ts; handler_test.ts is the proof. This file wires the world in: who is calling
// (resolveCaller — verify_jwt is OFF, the browser sends its own token), the service-role reads,
// the facilitator list, and Resend through _shared/email.ts.
//
//   POST { id }          by the student who filed it  → 200 { ok, emailed, to }   (once; then { already })
//   POST { id, answer }  by the program team          → 200 { ok, emailed, saved }
//                        403 not_allowed · 404 not_found · 400 bad_id / no_answer · 429 slow_down
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (absent = saved, not emailed).
// Deploy: supabase functions deploy ea-class-help-ping --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "../_shared/rtk_auth.ts";
import { layout, sendEmail } from "../_shared/email.ts";
import { handleHelp, type HelpBody, type HelpRow, type Facilitator } from "./handler.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ANON_KEY = "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

  const who = await resolveCaller(req, admin, url, ANON_KEY);
  if ("error" in who) return json({ error: who.error }, who.status);
  const programTeam = who.role.admin || who.role.judge || who.role.facilitator_sessions.length > 0 || who.academyAdmin;

  let body: HelpBody = {};
  try { body = await req.json(); } catch (_) { /* handler answers bad_id */ }

  /* one person's name + email (profile name, facilitator label, registration name, then the email's first half) */
  const person = async (userId: string): Promise<{ name: string; email: string | null } | null> => {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email ?? null;
    const { data: name } = await admin.rpc("ea_class_person_name", { p_uid: userId });
    const n = String(name || "").trim() || (email ? email.split("@")[0] : "");
    return n || email ? { name: n || "Someone", email } : null;
  };

  const reply = await handleHelp(body, { id: who.user.id, email: who.user.email, programTeam }, {
    rateCheck: async (key, max, windowSecs) => {
      const { data } = await admin.rpc("ea_rate_check", { p_key: key, p_max: max, p_window_secs: windowSecs });
      return data === true ? true : data === false ? false : null;
    },
    getRow: async (id) => {
      const { data } = await admin.from("ea_class_help").select("id, user_id, room_key, track, text, status, claimed_by, claimed_name, answer, pinged_at, answer_sent_at, created_at").eq("id", id).maybeSingle();
      return (data as HelpRow | null) ?? null;
    },
    student: async (userId) => {
      const p = await person(userId);
      if (!p || !p.email) return null;
      /* exact match on the lower-cased address — never ilike (% and _ are legal in an address); the school address or the personal one */
      const em = p.email.trim().toLowerCase();
      let school: string | null = null;
      for (const col of ["email", "personal_email"] as const) {
        const { data: reg } = await admin.from("ea_opil_registrations").select("school").eq(col, em).limit(1).maybeSingle();
        if (reg) { school = (reg as { school?: string | null }).school ?? null; break; }
      }
      const { data: tm } = await admin.from("ea_opil_team_members").select("team_id, ea_opil_teams(name, is_staff)").eq("user_id", userId).limit(3);
      const team = (tm || []).map((r) => (r as unknown as { ea_opil_teams: { name: string; is_staff: boolean | null } | null }).ea_opil_teams).find((t) => t && !t.is_staff) ?? null;
      return { email: p.email, name: p.name, school, team_name: team?.name ?? null };
    },
    facilitators: async () => {
      const { data } = await admin.from("ea_opil_facilitators").select("email, label, session_nos");
      return (data as Facilitator[] | null) ?? [];
    },
    person,
    markPinged: async (id) => { await admin.from("ea_class_help").update({ pinged_at: new Date().toISOString() }).eq("id", id); },
    /* the answerer owns the answer (claimed_by moves to them; the trigger renames claimed_name), so the hub's
       "Jamal answered your question" and this email's subject name the same person */
    saveAnswer: async (id, answer, byUserId) => {
      const { error } = await admin.from("ea_class_help").update({ status: "answered", answer, claimed_by: byUserId }).eq("id", id);
      if (error) console.error("[ea-class-help-ping] saveAnswer", error.message);
    },
    markAnswerSent: async (id) => { await admin.from("ea_class_help").update({ answer_sent_at: new Date().toISOString() }).eq("id", id); },
    send: async (msg) => {
      const r = await sendEmail({ to: msg.to, subject: msg.subject, html: msg.html, replyTo: msg.replyTo });
      return { ok: r.ok, skipped: r.skipped, error: r.error };
    },
  }, layout);
  return json(reply.body, reply.status);
});
