// _shared/email.ts — branded transactional email for the Academy, sent through Resend.
// Used by ea-waitlist-join, ea-waitlist-announce, and the ticket fulfilment path in
// ea-stripe-webhook / ea-ticket-checkout. No secrets are baked in: RESEND_API_KEY is a
// function secret and every send degrades to a logged no-op when it is absent.

export const SITE = "https://taylormadeacademy.com";
export const WORKSHOP = {
  slug: "build-your-first-ai-agent",
  title: "Build Your First AI Agent",
  url: `${SITE}/agent/`,
};

// The Resend-verified sending domain is taylormadecreative.net (the same one the member
// notices already use). Replies land in Nelson's inbox.
export const FROM =
  Deno.env.get("ACADEMY_FROM") ?? "Nelson Taylor at Taylormade Academy <hello@taylormadecreative.net>";
export const REPLY_TO = Deno.env.get("ACADEMY_REPLY_TO") ?? "taylormademd@gmail.com";
export const NELSON = Deno.env.get("ACADEMY_NOTIFY_TO") ?? "taylormademd@gmail.com";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

export function firstName(full: string | null | undefined): string {
  const f = String(full ?? "").trim().split(/\s+/)[0] || "";
  return f ? f[0].toUpperCase() + f.slice(1) : "there";
}

export function money(cents: number): string {
  const d = cents / 100;
  return cents % 100 === 0 ? `$${d}` : `$${d.toFixed(2)}`;
}

// "Friday, October 24 at 7:00 PM CDT" in the event's own time zone.
export function when(iso: string | null | undefined, tz = "America/Chicago"): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date to be announced";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "long", month: "long", day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(d);
  return `${date} at ${time}`;
}

// Plain text from a textarea -> safe paragraphs. Blank lines split paragraphs, single
// newlines become <br>. {name} is filled by the caller before this runs.
export function paragraphs(text: string): string {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="background:#0b40e0;border-radius:980px">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-weight:700;font-size:15px;color:#ffffff;text-decoration:none;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${esc(label)} &rarr;</a>` +
    `</td></tr></table>`;
}

export function layout(opts: { preheader?: string; kicker?: string; heading: string; body: string; foot?: string }): string {
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : "";
  const kicker = opts.kicker
    ? `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#0730ad;margin-bottom:12px"><span style="display:inline-block;width:20px;height:3px;background:#f2b705;border-radius:2px;vertical-align:middle;margin-right:10px"></span>${esc(opts.kicker)}</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fc">${pre}
<div style="background:#f5f7fc;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:#04123a;border-radius:18px 18px 0 0;padding:18px 24px;display:flex;align-items:center">
      <img src="${SITE}/assets/logo-email.png" width="34" height="34" alt="" style="display:inline-block;vertical-align:middle;border-radius:8px">
      <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:#fff;font-weight:700;font-size:16px;letter-spacing:-.01em">Taylormade Academy</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e4e9f1;border-top:0;border-radius:0 0 18px 18px;padding:30px 28px 26px">
      ${kicker}
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:#0a1733">${esc(opts.heading)}</h1>
      ${opts.body}
      <p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#33415b">Nelson<br><span style="color:#5d6b84">Taylormade Academy, Dallas-Fort Worth</span></p>
    </div>
    <p style="margin:16px 8px 0;font-size:12px;line-height:1.6;color:#94a3b8">${opts.foot ?? `You are getting this because you asked to hear about ${esc(WORKSHOP.title)} at <a href="${WORKSHOP.url}" style="color:#94a3b8">taylormadeacademy.com/agent</a>.`}</p>
  </div>
</div></body></html>`;
}

export type SendResult = { ok: boolean; id?: string; error?: string; skipped?: boolean };

export async function sendEmail(msg: { to: string | string[]; subject: string; html: string; from?: string; replyTo?: string }): Promise<SendResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.log("RESEND_API_KEY not set, skipping email", msg.subject, msg.to);
    return { ok: false, skipped: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: msg.from ?? FROM,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        reply_to: msg.replyTo ?? REPLY_TO,
        subject: msg.subject,
        html: msg.html,
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("resend error", r.status, JSON.stringify(body).slice(0, 300));
      return { ok: false, error: `resend_${r.status}` };
    }
    return { ok: true, id: (body as { id?: string }).id };
  } catch (e) {
    console.error("resend fetch failed", (e as Error).message);
    return { ok: false, error: "resend_unreachable" };
  }
}

// Resend batch endpoint: up to 100 messages per call.
export async function sendBatch(msgs: { to: string; subject: string; html: string }[]): Promise<{ ok: boolean; ids: string[]; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, ids: [], error: "not_configured" };
  if (!msgs.length) return { ok: true, ids: [] };
  try {
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(msgs.map((m) => ({ from: FROM, to: [m.to], reply_to: REPLY_TO, subject: m.subject, html: m.html }))),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("resend batch error", r.status, JSON.stringify(body).slice(0, 300));
      return { ok: false, ids: [], error: `resend_${r.status}` };
    }
    const data = (body as { data?: { id: string }[] }).data ?? [];
    return { ok: true, ids: data.map((d) => d.id) };
  } catch (e) {
    console.error("resend batch fetch failed", (e as Error).message);
    return { ok: false, ids: [], error: "resend_unreachable" };
  }
}
