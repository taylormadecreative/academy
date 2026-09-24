// ea-event-remind — the rules. pg_cron knocks every five minutes (migration 0056); this decides which
// ticketed dates (ea_events) are a day away or an hour away, who holds a seat, what the email says, and
// remembers what was sent (ea_event_reminders) so nobody hears the same reminder twice. Pure: the clock,
// the database and Resend come in as `deps`; handler_test.ts is the proof.
//
//   POST  header x-remind-secret: <REMIND_SECRET>   body ignored
//     200 { ok: true, due: [...], sent: n, skipped: [...] }
//     401 { error: "forbidden" }        wrong or missing secret
//     503 { error: "not_configured" }   REMIND_SECRET is not set on the function
//
// The secret is the SAME one ea-opil-remind uses (Vault opil_remind_secret = function secret
// REMIND_SECRET, set by scripts/apply-0050.sh), so there is nothing new to configure.
//
// Two reminders per date:
//   day-before   sent once when the date is between 3 and 24 hours away. A date booked less than 3
//                hours out skips it (an "it's tomorrow" email that arrives an hour before is wrong).
//   hour-before  sent once when the date is between 0 and 60 minutes away.
// A claim is only kept when at least one email went out; otherwise it is handed back and the next tick
// (still inside the window) tries again.

export const BATCH = 100;
export const KINDS = [
  { kind: "day-before", minMin: 180, maxMin: 24 * 60 },
  { kind: "hour-before", minMin: 0, maxMin: 60 },
] as const;
export type Kind = typeof KINDS[number]["kind"];

export type EventRow = {
  id: string; workshop_slug: string; title: string; starts_at: string; tz: string | null;
  format: string; status: string; join_url: string | null; venue_label: string | null; venue_address: string | null;
};
export type Recipient = { email: string; name?: string | null; inPerson?: boolean };
export type Message = { to: string; subject: string; html: string };
export type Due = { event: EventRow; kind: Kind; startsAt: number; minutesAway: number };
export type RemindDeps = {
  now: () => number;
  /* dates on sale (or sold out) that start in the next ~25 hours */
  listEvents: () => Promise<EventRow[]>;
  /* "eventId:kind" already sent */
  listReminded: () => Promise<string[]>;
  /* every valid seat for the date. Throws when the lookup fails — never quietly returns a shorter list. */
  listRecipients: (ev: EventRow) => Promise<Recipient[]>;
  claim: (eventId: string, kind: Kind) => Promise<boolean>;
  unclaim: (eventId: string, kind: Kind) => Promise<void>;
  sendBatch: (msgs: Message[]) => Promise<{ ok: boolean; ids: string[]; error?: string }>;
  layout: (o: { preheader?: string; kicker?: string; heading: string; body: string; foot?: string }) => string;
  button: (href: string, label: string) => string;
  esc: (s: unknown) => string;
  /* "Friday, October 9 at 7:00 PM CDT" (_shared/email.ts when) */
  when: (iso: string, tz?: string) => string;
  site: string;
};
export type RemindReply = { status: number; body: Record<string, unknown> };

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- which dates are due ---- */

export function dueEvents(events: EventRow[], reminded: string[], nowMs: number): Due[] {
  const done = new Set(reminded || []);
  const out: Due[] = [];
  for (const ev of events || []) {
    if (!ev || (ev.status !== "on_sale" && ev.status !== "sold_out")) continue;
    const startsAt = Date.parse(ev.starts_at);
    if (!Number.isFinite(startsAt)) continue;
    const minutesAway = (startsAt - nowMs) / 60000;
    for (const k of KINDS) {
      if (minutesAway <= k.minMin || minutesAway > k.maxMin) continue;
      if (done.has(`${ev.id}:${k.kind}`)) continue;
      out.push({ event: ev, kind: k.kind, startsAt, minutesAway: Math.round(minutesAway) });
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

/* ---- the email ---- */

const P = (html: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${html}</p>`;

export function subjectFor(due: Due, deps: Pick<RemindDeps, "when">): string {
  const ev = due.event;
  if (due.kind === "hour-before") return `Starting in an hour: ${ev.title}`;
  return `Tomorrow: ${ev.title}, ${deps.when(ev.starts_at, ev.tz ?? undefined)}`;
}

export function emailFor(due: Due, r: Recipient, deps: Pick<RemindDeps, "layout" | "button" | "esc" | "when" | "site">): string {
  const ev = due.event, e = deps.esc;
  const whenTxt = deps.when(ev.starts_at, ev.tz ?? undefined);
  const first = String(r.name ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hi ${e(first[0].toUpperCase() + first.slice(1))},` : "Hi,";
  const soon = due.kind === "hour-before";
  const free = ev.workshop_slug === "ai101";
  const online = ev.format === "virtual" && !r.inPerson;
  let body = P(hello) + P(`<b>${e(ev.title)}</b> is ${soon ? "starting in about an hour" : "tomorrow"}: <b>${e(whenTxt)}</b>.`);
  if (online) {
    if (ev.join_url) {
      body += P(`Here is your link to the room. ${soon ? "It opens a few minutes before the start." : "Keep this email handy for tomorrow."}`) +
        deps.button(ev.join_url, "Open the room") +
        P(`You sign in with a free Taylormade Academy account, using the email this came to. No account yet? <a href="${e(deps.site + "/login/?mode=join")}" style="color:#0b40e0">Make one now</a>, it takes about a minute.`);
    } else {
      body += P(`The room link is in your confirmation email. Reply to this one if you cannot find it.`);
    }
  } else {
    body += P(`<b>Where:</b> ${e(ev.venue_address || ev.venue_label || "the address is in your ticket email")}. Bring a laptop that can run Claude or ChatGPT in a browser.`);
  }
  if (free) {
    body += P(`Have your cheat sheet ready: <a href="${e(deps.site + "/ai101/cheat-sheet.pdf")}" style="color:#0b40e0">download it here</a>. A laptop is best if you want to try along with me, but a phone works to watch.`);
  }
  body += P(`Questions? Reply to this email, it comes straight to me.`);
  return deps.layout({
    preheader: `${whenTxt}. ${online && ev.join_url ? "Your room link is inside." : "Everything you need is inside."}`,
    kicker: free ? "Free class" : "Reminder",
    heading: soon ? `Starting in an hour` : `See you tomorrow`,
    body,
    foot: `You are getting this because you saved a seat for ${e(ev.title)} at taylormadeacademy.com.`,
  });
}

/* one message per address, lower-cased and deduped; an in-person seat wins if someone holds both */
export function messagesFor(due: Due, recipients: Recipient[], deps: Pick<RemindDeps, "layout" | "button" | "esc" | "when" | "site">): Message[] {
  const by = new Map<string, Recipient>();
  for (const r of recipients || []) {
    const to = String(r?.email ?? "").trim().toLowerCase();
    if (!to || !EMAIL_RX.test(to)) continue;
    const prev = by.get(to);
    if (!prev) by.set(to, { ...r, email: to });
    else if (r.inPerson && !prev.inPerson) by.set(to, { ...prev, inPerson: true });
  }
  const subject = subjectFor(due, deps);
  return [...by.values()].map((r) => ({ to: r.email, subject, html: emailFor(due, r, deps) }));
}

export function chunk<T>(arr: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* same length, every byte compared */
export function secretMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  const a = String(given ?? ""), b = String(expected ?? "");
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---- the knock ---- */

export async function handleRemind(headers: { get: (k: string) => string | null }, expected: string | undefined, deps: RemindDeps): Promise<RemindReply> {
  if (!expected) return { status: 503, body: { error: "not_configured" } };
  if (!secretMatches(headers.get("x-remind-secret"), expected)) return { status: 401, body: { error: "forbidden" } };

  const due = dueEvents(await deps.listEvents(), await deps.listReminded(), deps.now());
  let sent = 0;
  const skipped: string[] = [];
  const report: string[] = [];
  for (const d of due) {
    const key = `${d.event.id}:${d.kind}`;
    if (!(await deps.claim(d.event.id, d.kind))) { skipped.push(key + " (claimed elsewhere)"); continue; }
    let msgs: Message[];
    try { msgs = messagesFor(d, await deps.listRecipients(d.event), deps); }
    catch (e) { await deps.unclaim(d.event.id, d.kind); skipped.push(key + " (lookup failed: " + (e as Error).message + ")"); continue; }
    if (!msgs.length) { await deps.unclaim(d.event.id, d.kind); skipped.push(key + " (no seats yet)"); continue; }
    let ok = 0, missed = 0;
    for (const c of chunk(msgs)) {
      const r = await deps.sendBatch(c);
      if (r.ok) ok += c.length; else missed += c.length;
    }
    if (!ok) { await deps.unclaim(d.event.id, d.kind); skipped.push(key + " (send failed)"); continue; }
    sent += ok;
    report.push(`${key}: ${ok} sent${missed ? `, ${missed} missed` : ""}`);
  }
  return { status: 200, body: { ok: true, due: report, sent, skipped } };
}
