// ea-waitlist-join — the public waitlist for "Build Your First AI Agent".
//
//   POST { name, email, phone?, city?, experience?, goal?, source?, ref?, hp? }
//     -> { ok: true, position: 23, existing: false }
//   GET  ?unsub=<early_token>   -> one-click leave, returns a small HTML page
//
// verify_jwt is off. This runs with the service role, validates everything itself, and is
// the only writer of ea_wl_signups from the public internet (the table has no anon
// policy at all). Per-IP rate limited through ea_rate_check, fail-open. A filled honeypot
// field is answered with a fake success and nothing is stored.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { SITE, WORKSHOP, NELSON, esc, firstName, button, layout, sendEmail } from "../_shared/email.ts";

const ALLOWED_ORIGIN = "https://taylormadeacademy.com";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const page = (title: string, msg: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
    `<body style="margin:0;background:#fcfdff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a1733"><div style="max-width:520px;margin:12vh auto;padding:0 24px">` +
    `<h1 style="font-size:28px;letter-spacing:-.02em;margin:0 0 12px">${esc(title)}</h1><p style="font-size:17px;line-height:1.6;color:#33415b">${esc(msg)}</p>` +
    `<p><a href="${SITE}/agent/" style="color:#0b40e0;font-weight:600">Back to the workshop page</a></p></div></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EXPERIENCE = new Set(["new", "some", "building"]);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---- one-click leave ------------------------------------------------------
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("unsub") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(token)) return page("That link did not work", "The leave link is incomplete. Reply to any of my emails and I will take you off by hand.", 400);
    const { data, error } = await sb.from("ea_wl_signups").update({ status: "unsubscribed" })
      .eq("early_token", token).neq("status", "purchased").select("id").maybeSingle();
    if (error) return page("Something went wrong", "Try the link again in a minute.", 500);
    if (!data) return page("Already off the list", "That address is not on the waitlist any more.");
    return page("You are off the list", "No more workshop emails from me. If you change your mind, the page is always open.");
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }

    // Honeypot: bots fill every field. Pretend it worked, store nothing.
    if (str(body.hp, 10)) return json({ ok: true, position: null, existing: false });

    const full_name = str(body.name, 120);
    const email = str(body.email, 200).toLowerCase();
    const phone = str(body.phone, 40) || null;
    const city = str(body.city, 120) || null;
    const goal = str(body.goal, 500) || null;
    const experience = EXPERIENCE.has(String(body.experience)) ? String(body.experience) : "new";
    const source = str(body.source, 60) || "agent-page";
    const referrer = str(body.ref, 300) || null;
    if (full_name.length < 2) return json({ error: "name_required" }, 400);
    if (!EMAIL_RX.test(email)) return json({ error: "email_invalid" }, 400);

    // ---- per-IP rate limit (durable, fail-open) --------------------------------
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const { data: allowed } = await sb.rpc("ea_rate_check", { p_key: "wl:" + ip, p_max: 6, p_window_secs: 60 });
    if (allowed === false) return json({ error: "rate_limited" }, 429);

    // ---- already on the list? ---------------------------------------------------
    const { data: existing, error: exErr } = await sb.from("ea_wl_signups")
      .select("id, created_at, status, early_token").eq("workshop_slug", WORKSHOP.slug).eq("email", email).maybeSingle();
    if (exErr) { console.error("lookup failed", exErr.message); return json({ error: "server_error" }, 500); }

    let row: { id: string; created_at: string; early_token: string };
    if (existing) {
      // Refresh what they told us, keep their place and their early token. Someone who
      // left and comes back is simply waiting again.
      const patch: Record<string, unknown> = { full_name, experience };
      if (phone) patch.phone = phone;
      if (city) patch.city = city;
      if (goal) patch.goal = goal;
      if (existing.status === "unsubscribed") patch.status = "waiting";
      const { error } = await sb.from("ea_wl_signups").update(patch).eq("id", existing.id);
      if (error) { console.error("update failed", error.message); return json({ error: "server_error" }, 500); }
      row = existing;
    } else {
      const { data, error } = await sb.from("ea_wl_signups").insert({
        workshop_slug: WORKSHOP.slug, full_name, email, phone, city, experience, goal, source, referrer,
      }).select("id, created_at, early_token").single();
      if (error) {
        // 23505 = raced with a duplicate submit; treat as existing.
        if (error.code === "23505") {
          const { data: again } = await sb.from("ea_wl_signups").select("id, created_at, early_token")
            .eq("workshop_slug", WORKSHOP.slug).eq("email", email).single();
          if (!again) return json({ error: "server_error" }, 500);
          return json({ ok: true, position: await position(sb, again.created_at), existing: true });
        }
        console.error("insert failed", error.message);
        return json({ error: "server_error" }, 500);
      }
      row = data;
    }

    const pos = await position(sb, row.created_at);

    if (!existing) {
      // Confirmation to them, one-line notice to Nelson. Neither blocks the signup.
      const leave = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ea-waitlist-join?unsub=${row.early_token}`;
      await Promise.all([
        sendEmail({
          to: email,
          subject: `You are on the list: ${WORKSHOP.title}`,
          html: layout({
            preheader: `Seat #${pos} on the waitlist. Dates and the early-bird rate come to you first.`,
            kicker: "Waitlist confirmed",
            heading: `${firstName(full_name)}, you are #${pos} on the list.`,
            body:
              `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">Thank you for putting your name down for <b>${esc(WORKSHOP.title)}</b>. This is the first time I am opening it to the public, and the list hears everything before anyone else.</p>` +
              `<p style="margin:0 0 8px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#5d6b84">What happens next</p>` +
              `<ol style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.7;color:#33415b"><li>I email you the date before it goes anywhere public.</li><li>Your email carries a personal early-bird link. It opens the lowest rate before general sale.</li><li>You build a working agent that night, no code, and leave with the playbook.</li></ol>` +
              `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">Until then, the Academy community is free to join and it is where I answer questions between sessions.</p>` +
              button(`${SITE}/login/?mode=join`, "Join the Academy free"),
            foot: `You asked to hear about ${esc(WORKSHOP.title)} at taylormadeacademy.com/agent. <a href="${esc(leave)}" style="color:#94a3b8">Leave the list</a>.`,
          }),
        }),
        sendEmail({
          to: NELSON,
          subject: `Waitlist #${pos}: ${full_name}${city ? ` (${city})` : ""}`,
          html: layout({
            heading: `#${pos} on the agent waitlist`,
            body: `<p style="font-size:15px;line-height:1.7;color:#33415b"><b>${esc(full_name)}</b> &middot; ${esc(email)}${phone ? ` &middot; ${esc(phone)}` : ""}${city ? `<br>${esc(city)}` : ""}<br>Experience: ${esc(experience)}${goal ? `<br>Wants an agent to: ${esc(goal)}` : ""}</p>${button(`${SITE}/founder/#waitlist`, "Open the waitlist")}`,
            foot: "Founder notice from taylormadeacademy.com.",
          }),
        }),
      ]);
    }

    return json({ ok: true, position: pos, existing: !!existing });
  } catch (e) {
    console.error("ea-waitlist-join error", e);
    return json({ error: "server_error" }, 500);
  }
});

async function position(sb: SupabaseClient, createdAt: string): Promise<number> {
  const { count } = await sb.from("ea_wl_signups").select("id", { count: "exact", head: true })
    .eq("workshop_slug", WORKSHOP.slug).lte("created_at", createdAt);
  return Math.max(1, count ?? 1);
}
