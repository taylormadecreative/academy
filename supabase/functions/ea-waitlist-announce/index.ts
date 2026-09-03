// ea-waitlist-announce — Nelson tells the waitlist about a date, from the founder dashboard.
//
//   POST (Authorization: Bearer <the signed-in admin's JWT>)
//     { event_id?, subject, body_text, cta_label?, test_to? }
//     -> { ok: true, sent: 1 }                     (test_to: one preview, nothing stamped)
//     -> { ok: true, sent: 42, failed: 0, total: 42 } (real send, in batches of 100)
//
// Every recipient gets their own early-bird link (/agent/?early=<token>) and a one-click
// leave link. A real send stamps invited_at and moves 'waiting' -> 'invited'. The caller
// must be an admin (profiles.role = 'admin'); the JWT is verified against Supabase Auth,
// never trusted from the body.
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, WORKSHOP, esc, firstName, when, paragraphs, button, layout, sendEmail, sendBatch } from "../_shared/email.ts";

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

type Signup = { id: string; full_name: string; email: string; early_token: string; status: string };
type Ev = { id: string; title: string; starts_at: string; tz: string; format: string; venue_label: string | null; status: string } | null;

function render(s: { full_name: string; early_token: string }, ev: Ev, subject: string, bodyText: string, cta: string, functionsBase: string) {
  const early = `${SITE}/agent/?early=${s.early_token}#seats`;
  const leave = `${functionsBase}/ea-waitlist-join?unsub=${s.early_token}`;
  const dateBox = ev
    ? `<div style="background:#f5f7fc;border-radius:14px;padding:16px 20px;margin:0 0 18px;font-size:15px;line-height:1.7;color:#33415b"><b>${esc(ev.title)}</b><br>${esc(when(ev.starts_at, ev.tz))}<br>${esc(ev.format === "virtual" ? "Online" : (ev.venue_label || "Dallas-Fort Worth"))}</div>`
    : "";
  const body = paragraphs(bodyText.replace(/\{name\}/g, firstName(s.full_name))) + dateBox + button(early, cta) +
    `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#94a3b8">That button is yours alone. It unlocks the waitlist rate before the public sale.</p>`;
  return layout({
    preheader: ev ? `${when(ev.starts_at, ev.tz)}. Your early-bird link is inside.` : "Your early-bird link is inside.",
    kicker: "From the waitlist",
    heading: subject,
    body,
    foot: `You are on the ${esc(WORKSHOP.title)} waitlist at taylormadeacademy.com/agent. <a href="${esc(leave)}" style="color:#94a3b8">Leave the list</a>.`,
  });
}

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
    const subject = str(body.subject, 160);
    const bodyText = str(body.body_text, 6000);
    const cta = str(body.cta_label, 60) || "Open my early-bird link";
    const eventId = str(body.event_id, 40);
    const testTo = str(body.test_to, 200).toLowerCase();
    if (subject.length < 3) return json({ error: "subject_required" }, 400);
    if (bodyText.length < 10) return json({ error: "body_required" }, 400);

    let ev: Ev = null;
    if (eventId) {
      const { data } = await sb.from("ea_events").select("id, title, starts_at, tz, format, venue_label, status").eq("id", eventId).maybeSingle();
      ev = (data as Ev) ?? null;
      if (!ev) return json({ error: "event_not_found" }, 404);
    }
    const functionsBase = `${url}/functions/v1`;

    // ---- preview to one address, nothing stamped ---------------------------------------
    if (testTo) {
      if (!EMAIL_RX.test(testTo)) return json({ error: "email_invalid" }, 400);
      const { data: mine } = await sb.from("ea_wl_signups").select("full_name, early_token").eq("email", testTo).maybeSingle();
      const sample = mine ?? { full_name: "Nelson", early_token: "00000000-0000-0000-0000-000000000000" };
      const r = await sendEmail({ to: testTo, subject: `[TEST] ${subject}`, html: render(sample, ev, subject, bodyText, cta, functionsBase) });
      if (!r.ok) return json({ error: r.error ?? "send_failed" }, 502);
      return json({ ok: true, sent: 1, test: true });
    }

    // ---- the real send ------------------------------------------------------------------
    const { data: list, error: lErr } = await sb.from("ea_wl_signups")
      .select("id, full_name, email, early_token, status")
      .eq("workshop_slug", WORKSHOP.slug).in("status", ["waiting", "invited"]).order("created_at");
    if (lErr) { console.error("list failed", lErr.message); return json({ error: "server_error" }, 500); }
    const recipients = (list ?? []) as Signup[];
    if (!recipients.length) return json({ ok: true, sent: 0, failed: 0, total: 0 });

    let sent = 0, failed = 0;
    const stamp = new Date().toISOString();
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100);
      const r = await sendBatch(chunk.map((s) => ({ to: s.email, subject, html: render(s, ev, subject, bodyText, cta, functionsBase) })));
      if (r.ok) {
        sent += chunk.length;
        const ids = chunk.map((s) => s.id);
        await sb.from("ea_wl_signups").update({ invited_at: stamp }).in("id", ids);
        await sb.from("ea_wl_signups").update({ status: "invited" }).in("id", ids).eq("status", "waiting");
      } else {
        failed += chunk.length;
        console.error("batch failed", i, r.error);
      }
    }
    return json({ ok: failed === 0, sent, failed, total: recipients.length });
  } catch (e) {
    console.error("ea-waitlist-announce error", e);
    return json({ error: "server_error" }, 500);
  }
});
