// ea-opil-remind — the rules. Every five minutes pg_cron knocks (migration 0050); this decides
// which classes start in 25–35 minutes Atlanta time, who should hear about it, what the email says,
// and remembers what was sent (ea_class_reminders) so nobody is emailed twice. Pure: the clock, the
// database and Resend come in as `deps`, and handler_test.ts (deno) + tests/opil/calendar.test.mjs
// (node) are the proof.
//
//   POST  header x-remind-secret: <REMIND_SECRET>   body ignored
//     200 { ok: true, due: [...], sent: n, skipped: [...] }
//     401 { error: "forbidden" }        wrong or missing secret
//     503 { error: "not_configured" }   REMIND_SECRET is not set on the function
//
// Who is emailed: every approved registration — the team lead (school address, plus the personal one
// when they gave it) AND every teammate listed in `members` — and every facilitator filed for that
// session; each address once. Students hear "no code needed"; facilitators are told to sign in with
// their code, because the no-code door (ea-opil-pass) only admits the approved list.
//
// A claim is only kept when at least one email actually went out. A lookup that fails, an empty list,
// or a Resend that refuses everything hands the claim back so the next five-minute tick (still inside
// the 25–35 minute window) tries again. A chunk that fails is retried once after a short wait, and the
// report says how many addresses were missed.

import { type Session, isHiddenSession, roomUrl, summaryFor, timeMinutes } from "../ea-opil-calendar/handler.ts";
export { type Session } from "../ea-opil-calendar/handler.ts";

export const KIND = "start-30";                 // one reminder kind for now: "starts in half an hour"
export const WINDOW_MIN = 25;
export const WINDOW_MAX = 35;
export const TZ_ET = "America/New_York";
export const TZ_CT = "America/Chicago";
export const BATCH = 100;                       // Resend's batch ceiling

export type RecipientKind = "student" | "teammate" | "facilitator";
export type Recipient = { email: string; name?: string | null; kind?: RecipientKind };
export type Message = { to: string; subject: string; html: string };
export type RemindDeps = {
  now: () => number;
  listSessions: () => Promise<Session[]>;
  /* room keys already reminded for this kind */
  listReminded: (kind: string) => Promise<string[]>;
  /* every approved registration (lead + teammates) + the facilitators filed for this session.
     Throws when a lookup fails — never quietly returns a shorter list. */
  listRecipients: (session: Session) => Promise<Recipient[]>;
  /* claim the reminder before sending: true when this call inserted the row, false when it already existed */
  claim: (roomKey: string, kind: string) => Promise<boolean>;
  /* give the claim back when nothing could be sent, so the next tick tries again */
  unclaim: (roomKey: string, kind: string) => Promise<void>;
  sendBatch: (msgs: Message[]) => Promise<{ ok: boolean; ids: string[]; error?: string }>;
  /* pause before retrying a refused chunk (index.ts: setTimeout; tests: nothing) */
  wait?: (ms: number) => Promise<void>;
  /* the email body pieces from _shared/email.ts (injected so the rules stay pure) */
  layout: (o: { preheader?: string; kicker?: string; heading: string; body: string; foot?: string }) => string;
  button: (href: string, label: string) => string;
  esc: (s: unknown) => string;
};
export type RemindReply = { status: number; body: Record<string, unknown> };
export const RETRY_WAIT_MS = 1500;

/* ---- time ---- */

/* the zone's offset from UTC (ms) at a given instant, from Intl — no table to maintain */
export function offsetAt(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/* 'YYYY-MM-DD' + 'HH:MM[:SS]' on a zone's wall clock → the instant (ms), or null when either is missing */
export function zonedToUtcMs(ymd: string | null | undefined, time: string | null | undefined, tz = TZ_ET): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? "").trim());
  const min = timeMinutes(time);
  if (!m || min == null) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Math.floor(min / 60), min % 60);
  let guess = wall - offsetAt(wall, tz);
  guess = wall - offsetAt(guess, tz);        /* second pass settles a DST edge */
  return guess;
}

/* "6:30 PM" in a zone */
export function clockIn(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

/* "Wednesday, September 16" in a zone */
export function dayIn(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(ms));
}

/* ---- which classes are due ---- */

export type Due = { session: Session; roomKey: string; startsAt: number; minutesAway: number };

/* the classes that start WINDOW_MIN–WINDOW_MAX minutes from `nowMs` and have not been reminded yet.
   Milestones have no room; hidden test rooms never email anyone; a class with no time cannot be "in 30 minutes". */
export function dueSessions(sessions: Session[], reminded: string[], nowMs: number): Due[] {
  const done = new Set(reminded || []);
  const out: Due[] = [];
  for (const s of sessions || []) {
    if (!s || s.kind === "milestone" || isHiddenSession(s)) continue;
    const startsAt = zonedToUtcMs(s.session_date, s.start_time);
    if (startsAt == null) continue;
    const minutesAway = (startsAt - nowMs) / 60000;
    if (minutesAway < WINDOW_MIN || minutesAway > WINDOW_MAX) continue;
    const roomKey = `opil:${Number(s.no)}`;
    if (done.has(roomKey)) continue;
    out.push({ session: s, roomKey, startsAt, minutesAway: Math.round(minutesAway) });
  }
  return out.sort((a, b) => a.startsAt - b.startsAt || a.session.no - b.session.no);
}

/* ---- who is on a registration ---- */

export type RegistrationRow = { email?: string | null; personal_email?: string | null; full_name?: string | null; members?: unknown };

/* one approved registration is a whole team: the lead (both addresses) plus every teammate in `members`
   ([{ name, email, classification }] — the register page writes it; anything else in there is skipped) */
export function recipientsFromRegistration(row: RegistrationRow | null | undefined): Recipient[] {
  const out: Recipient[] = [];
  if (!row) return out;
  const lead = String(row.full_name ?? "").trim() || null;
  if (row.email) out.push({ email: String(row.email), name: lead, kind: "student" });
  if (row.personal_email) out.push({ email: String(row.personal_email), name: lead, kind: "student" });
  if (Array.isArray(row.members)) {
    for (const m of row.members as unknown[]) {
      if (!m || typeof m !== "object") continue;
      const mm = m as { email?: unknown; name?: unknown };
      if (typeof mm.email !== "string" || !mm.email.trim()) continue;
      out.push({ email: mm.email, name: typeof mm.name === "string" ? mm.name : null, kind: "teammate" });
    }
  }
  return out;
}

/* ---- the email ---- */

export function subjectFor(startsAt: number): string {
  return `Class starts at ${clockIn(startsAt, TZ_ET)} ET — here’s your link`;
}

/* the sentence after the button: students walk in with their email; facilitators run the class and sign in with a code */
export function doorSentence(kind: RecipientKind | undefined): string {
  if (kind === "facilitator") return "You run this class — sign in with the code the page emails you, then press Start class.";
  if (kind === "teammate") return "No code needed — type the email your team listed for you and you are in.";
  return "No code needed — type the email you applied with and you are in.";
}

export function emailFor(due: Due, name: string | null | undefined, deps: Pick<RemindDeps, "layout" | "button" | "esc">, kind?: RecipientKind): Message["html"] {
  const link = roomUrl(Number(due.session.no));
  const et = clockIn(due.startsAt, TZ_ET);
  const ct = clockIn(due.startsAt, TZ_CT);
  const title = String(due.session.title ?? "").trim() || "Class";
  const first = String(name ?? "").trim().split(/\s+/)[0] || "";
  const hello = first ? `Hi ${deps.esc(first)},` : "Hi,";
  const body =
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b">${hello}</p>` +
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#33415b"><b>${deps.esc(title)}</b> starts at <b>${deps.esc(et)} ET</b> (${deps.esc(ct)} CT) — about half an hour from now. Here is your link to the class room.</p>` +
    deps.button(link, "Open the class room") +
    `<p style="margin:16px 0 0;font-size:15px;line-height:1.62;color:#33415b">${deps.esc(doorSentence(kind))}</p>` +
    `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#5d6b84">If the button does not open, copy this link into your browser:<br><a href="${deps.esc(link)}" style="color:#0b40e0">${deps.esc(link)}</a></p>`;
  return deps.layout({
    preheader: `${title} starts at ${et} ET. Your link is inside.`,
    kicker: "Open Payments Innovation Lab",
    heading: `${title} starts at ${et} ET`,
    body,
    foot: `You are getting this because you are part of the Open Payments Innovation Lab 2026–27. The full schedule lives on the Lab Hub at <a href="https://taylormadeacademy.com/opil/hub/" style="color:#94a3b8">taylormadeacademy.com/opil/hub</a>.`,
  });
}

/* one message per address, addresses lower-cased and deduped, in the order first seen */
export function messagesFor(due: Due, recipients: Recipient[], deps: Pick<RemindDeps, "layout" | "button" | "esc">): Message[] {
  const seen = new Set<string>();
  const subject = subjectFor(due.startsAt);
  const out: Message[] = [];
  for (const r of recipients || []) {
    const to = String(r?.email ?? "").trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || seen.has(to)) continue;
    seen.add(to);
    out.push({ to, subject, html: emailFor(due, r.name, deps, r.kind) });
  }
  return out;
}

export function chunk<T>(arr: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---- the secret ---- */

/* same length, every byte compared — a mismatch never leaves early */
export function secretMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  const a = String(given ?? ""), b = String(expected ?? "");
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---- the whole call ---- */

export async function handleRemind(headers: { get: (k: string) => string | null }, expectedSecret: string | undefined, deps: RemindDeps): Promise<RemindReply> {
  if (!expectedSecret) return { status: 503, body: { error: "not_configured" } };
  if (!secretMatches(headers.get("x-remind-secret"), expectedSecret)) return { status: 401, body: { error: "forbidden" } };

  const now = deps.now();
  const [sessions, reminded] = await Promise.all([deps.listSessions(), deps.listReminded(KIND)]);
  const due = dueSessions(sessions, reminded, now);
  const report: { due: Record<string, unknown>[]; sent: number; skipped: Record<string, unknown>[] } = { due: [], sent: 0, skipped: [] };

  for (const d of due) {
    const claimed = await deps.claim(d.roomKey, KIND);
    if (!claimed) { report.skipped.push({ room_key: d.roomKey, why: "already_sent" }); continue; }
    /* the claim is only kept once something went out — every other exit below gives it back */
    let msgs: Message[];
    try {
      msgs = messagesFor(d, await deps.listRecipients(d.session), deps);
    } catch (e) {
      console.warn("[ea-opil-remind] recipients", (e as Error)?.message || e);
      await deps.unclaim(d.roomKey, KIND);
      report.skipped.push({ room_key: d.roomKey, why: "lookup_failed" });
      continue;
    }
    if (!msgs.length) {
      await deps.unclaim(d.roomKey, KIND);
      report.skipped.push({ room_key: d.roomKey, why: "no_recipients" });
      continue;
    }
    let sent = 0, missed = 0, error: string | undefined;
    for (const part of chunk(msgs)) {
      let r = await deps.sendBatch(part);
      if (!r.ok) {
        /* one more try after a breath — a Resend blip should not cost a hundred people their reminder */
        if (deps.wait) await deps.wait(RETRY_WAIT_MS);
        r = await deps.sendBatch(part);
      }
      if (r.ok) sent += part.length; else { missed += part.length; error = r.error || error; }
    }
    if (sent === 0) {
      /* nothing went out — give the claim back so the next tick (still inside the window) retries */
      await deps.unclaim(d.roomKey, KIND);
      report.skipped.push({ room_key: d.roomKey, why: error || "send_failed" });
      continue;
    }
    report.sent += sent;
    report.due.push({ room_key: d.roomKey, title: summaryFor(d.session), minutes_away: d.minutesAway, recipients: msgs.length, sent, missed, partial: missed > 0 || undefined, error: missed > 0 ? error : undefined });
  }
  return { status: 200, body: { ok: true, ...report } };
}
