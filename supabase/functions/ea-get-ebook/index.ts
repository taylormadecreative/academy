// ea-get-ebook — free lead magnet capture + delivery.
// Captures the lead in ea_subscribers WITH rich data (lead magnet, landing page,
// referrer, UTM params, user agent) so the list can be exported as a Meta/Google
// custom audience, then emails the ebook download link via Resend.
// verify_jwt is OFF (public form); does its own work with the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("NEWSLETTER_FROM") ?? "Taylormade Academy <hello@taylormadecreative.net>";
const REPLY_TO = Deno.env.get("NEWSLETTER_REPLY_TO") ?? "taylormademd@gmail.com";
const FUNCTIONS_BASE = "https://pgqdmnmessbbzyszjfvr.functions.supabase.co";
const SITE = "https://academy.taylormadecreative.net";
const EBOOK_URL = `${SITE}/free/ai-for-beginners/the-creators-ai-playbook.pdf`;
const ALLOW = new Set(["https://academy.taylormadecreative.net", "https://taylormadecreative.github.io"]);

function cors(origin: string | null) {
  const o = origin && ALLOW.has(origin) ? origin : SITE;
  return { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const admin = () => createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

async function sendEbook(email: string, token: string) {
  if (!RESEND_API_KEY) return;
  const unsub = `${FUNCTIONS_BASE}/ea-unsubscribe?t=${token}`;
  const html = `<div style="background:#eef2f9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e4e9f1;overflow:hidden">
    <div style="padding:24px 30px 0"><span style="font-weight:800;font-size:18px;color:#0a1733">Taylormade <span style="color:#0b40e0">Academy</span></span></div>
    <div style="padding:14px 30px 8px;color:#33415b">
      <h1 style="font-size:25px;color:#0a1733;margin:6px 0 10px;font-weight:800">Your free e-book is here.</h1>
      <p style="font-size:16px;line-height:1.6;margin:0 0 18px">Thanks for grabbing <strong>The Creator's AI Playbook</strong>. It's the shortest path from "I have no idea what I'm doing" to actually using ChatGPT, Claude, and Gemini. Tap below to read it.</p>
      <p style="margin:0 0 8px"><a href="${EBOOK_URL}" style="display:inline-block;background:#0b40e0;color:#fff;text-decoration:none;padding:14px 26px;border-radius:12px;font-weight:700;font-size:16px">Download the Playbook &rarr;</a></p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 20px">Or paste this link: ${EBOOK_URL}</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 6px">When you're ready for more, the community is free to join, come say hey:</p>
      <p style="margin:0 0 20px"><a href="${SITE}/community/" style="color:#0b40e0;font-weight:700;text-decoration:none">Join the community &rarr;</a></p>
      <p style="font-size:16px;margin:0">— Nelson</p>
    </div>
    <div style="padding:16px 30px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8">You requested this at academy.taylormadecreative.net. <a href="${unsub}" style="color:#94a3b8">Unsubscribe</a>.</div>
  </div></div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], reply_to: REPLY_TO, subject: "Your free AI Playbook is here", html, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
  } catch (e) { console.error("ebook send error", (e as Error).message); }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400, origin); }
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "invalid_email" }, 400, origin);

  const sb = admin();

  // per-IP rate limit (durable; fail-open)
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: allowed } = await sb.rpc("ea_rate_check", { p_key: "ebook:" + ip, p_max: 20, p_window_secs: 60 });
  if (allowed === false) return json({ error: "rate_limited" }, 429, origin);

  // rich lead data for ad-audience export
  const meta = {
    source: clip(b.source, 80) ?? "ebook",
    lead_magnet: clip(b.lead_magnet, 80) ?? "ai-playbook",
    landing_page: clip(b.landing_page, 300),
    referrer: clip(b.referrer, 300),
    utm_source: clip(b.utm_source, 120),
    utm_medium: clip(b.utm_medium, 120),
    utm_campaign: clip(b.utm_campaign, 160),
    utm_content: clip(b.utm_content, 160),
    utm_term: clip(b.utm_term, 160),
    user_agent: clip(req.headers.get("user-agent"), 400),
  };

  let token = "";
  const { data: existing } = await sb.from("ea_subscribers").select("id,unsub_token").eq("email", email).maybeSingle();
  if (existing) {
    token = existing.unsub_token;
    await sb.from("ea_subscribers").update({ status: "subscribed", ...meta, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    const { data: created, error } = await sb.from("ea_subscribers").insert({ email, ...meta }).select("unsub_token").single();
    if (error || !created) { console.error("ebook insert error", error?.message); return json({ ok: true, url: EBOOK_URL }, 200, origin); }
    token = created.unsub_token;
  }
  await sendEbook(email, token);
  return json({ ok: true, url: EBOOK_URL }, 200, origin);
});
