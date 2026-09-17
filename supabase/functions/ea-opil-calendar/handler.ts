// ea-opil-calendar — the rules. Turns the OPIL session list (ea_opil_sessions: no, kind, title,
// session_date, start_time, end_time, outcome) into one iCalendar feed a phone can subscribe to.
// Pure: no Deno, no fetch, no clock of its own — `icsText(sessions, now)` is the whole function, and
// handler_test.ts (deno) + tests/opil/calendar.test.mjs (node) are the proof.
//
// What a subscriber sees (spec 2026-09-16, feature 9):
//   - every class with a date and a start time  → a timed event in America/New_York
//                                                 (VTIMEZONE included so every app agrees on the hour)
//   - a class with a date but no time yet       → an all-day event ("time to be announced")
//   - a milestone                                → an all-day event
//   - a session with no date                     → left out (nothing to put on a calendar)
//   - hidden test rooms (thread 02–14)           → left out, the same rule hub home uses (9/16)
// UID is opil-<no>@taylormadeacademy.com — the same ids the old static file used, so a calendar that
// already had it updates in place instead of doubling every event.

export type Session = {
  no: number;
  kind: string;                    // 'thread' | 'curriculum' | 'hpc' | 'milestone'
  title: string | null;
  session_date: string | null;     // 'YYYY-MM-DD'
  start_time?: string | null;      // 'HH:MM' or 'HH:MM:SS', America/New_York wall time
  end_time?: string | null;
  outcome?: string | null;
};

export const SITE = "https://taylormadeacademy.com";
export const HUB_URL = `${SITE}/opil/hub/`;
export const CAL_NAME = "OPIL 2026–27";
export const TZID = "America/New_York";
export const DEFAULT_MINUTES = 60;   // a class with a start but no end is one hour long on the calendar

export const roomUrl = (no: number): string => `${SITE}/opil/hub/live/?s=${no}`;

/* the same "which sessions are real" rule as hub home: the Monday AI Thread 02–14 was dropped 9/16,
   and those numbers now serve as hidden test rooms — never on a student's calendar */
export function isHiddenSession(s: Session): boolean {
  return s.kind === "thread" && Number(s.no) >= 2;
}

/* plain-English label for the summary line: "Session 3", "HPC 1", "Kickoff" */
export function sessionLabel(s: Session): string {
  const n = Number(s.no);
  if (s.kind === "curriculum") return `Session ${n % 100}`;
  if (s.kind === "hpc") return `HPC ${n % 100}`;
  if (s.kind === "thread") return n === 1 ? "Kickoff" : `Thread ${n}`;
  return "";
}

export function summaryFor(s: Session): string {
  const title = String(s.title ?? "").trim() || "OPIL session";
  const label = sessionLabel(s);
  return label ? `OPIL · ${label} · ${title}` : `OPIL · ${title}`;
}

/* ---- text rules of RFC 5545 ---- */

/* TEXT values: backslash, semicolon, comma and newlines are escaped; a bare CR is dropped */
export function escText(v: unknown): string {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "\\n");
}

/* UTF-8 length of one code point — folding counts octets, not characters */
function octets(cp: number): number {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/* Fold one content line at 75 octets: the first physical line carries at most 75 octets, every
   continuation starts with a single space and carries at most 74 more, and a multi-byte character
   is never cut in half. Physical lines are joined with CRLF. */
export function foldLine(line: string, max = 75): string {
  const out: string[] = [];
  let cur = "";
  let used = 0;
  let limit = max;                       // the first line has no leading space
  for (const ch of line) {
    const n = octets(ch.codePointAt(0) as number);
    if (used + n > limit) {
      out.push(cur);
      cur = " " + ch;
      used = 1 + n;
      limit = max;
      continue;
    }
    cur += ch;
    used += n;
  }
  out.push(cur);
  return out.join("\r\n");
}

/* one property line, folded; a null value drops the line */
export function prop(name: string, value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return foldLine(`${name}:${value}`);
}

/* ---- dates ---- */

const DATE_RX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/;

export function dateValue(ymd: string | null | undefined): string | null {
  const m = DATE_RX.exec(String(ymd ?? "").trim());
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/* 'HH:MM[:SS]' → minutes after midnight, or null */
export function timeMinutes(t: string | null | undefined): number | null {
  const m = TIME_RX.exec(String(t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/* the next calendar day as YYYYMMDD (all-day DTEND is exclusive) */
export function nextDay(ymd: string): string {
  const m = DATE_RX.exec(ymd) as RegExpExecArray;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/* local wall time 'YYYYMMDDTHHMMSS' for a date + minutes after midnight (may roll into the next day) */
export function localStamp(ymd: string, minutes: number): string {
  const m = DATE_RX.exec(ymd) as RegExpExecArray;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Math.floor(minutes / 60), minutes % 60));
  return d.toISOString().slice(0, 19).replace(/[-:]/g, "");
}

export function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/* ---- the calendar ---- */

/* America/New_York, the rules since 2007 (second Sunday of March → first Sunday of November) */
export const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "X-LIC-LOCATION:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export type CalEvent = {
  uid: string;
  no: number;
  allDay: boolean;
  start: string;          // YYYYMMDD (all-day) or YYYYMMDDTHHMMSS (local wall time)
  end: string;
  summary: string;
  description: string;
  url: string;
  location: string | null;
  sortKey: string;
};

/* the sessions that belong on a calendar, in date order, as neutral event records */
export function eventsFor(sessions: Session[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const s of sessions || []) {
    if (!s || isHiddenSession(s)) continue;
    const date = dateValue(s.session_date);
    if (!date) continue;
    const isMilestone = s.kind === "milestone";
    const startMin = isMilestone ? null : timeMinutes(s.start_time);
    const link = isMilestone ? HUB_URL : roomUrl(Number(s.no));
    const summary = summaryFor(s);
    const notes = String(s.outcome ?? "").trim();
    const base: Pick<CalEvent, "uid" | "no" | "summary" | "url"> = {
      uid: `opil-${Number(s.no)}@taylormadeacademy.com`,
      no: Number(s.no),
      summary,
      url: link,
    };
    if (startMin == null) {
      const description = isMilestone
        ? `Details on the Lab Hub: ${HUB_URL}` + (notes ? `\n${notes}` : "")
        : `Time to be announced — the Lab Hub will say when. Join from ${link}\nNo code needed: sign in with the email you applied with.` + (notes ? `\n${notes}` : "");
      out.push({ ...base, allDay: true, start: date, end: nextDay(String(s.session_date).trim()), description, location: isMilestone ? null : link, sortKey: `${date}T000000` });
      continue;
    }
    let endMin = timeMinutes(s.end_time);
    if (endMin == null || endMin <= startMin) endMin = startMin + DEFAULT_MINUTES;
    const ymd = String(s.session_date).trim();
    const description = `Join the class room: ${link}\nNo code needed — sign in with the email you applied with.` + (notes ? `\n${notes}` : "");
    const start = localStamp(ymd, startMin);
    out.push({ ...base, allDay: false, start, end: localStamp(ymd, endMin), description, location: link, sortKey: start });
  }
  out.sort((a, b) => a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.no - b.no);
  return out;
}

export function vevent(e: CalEvent, stamp: string): string[] {
  const lines: (string | null)[] = [
    "BEGIN:VEVENT",
    prop("UID", e.uid),
    prop("DTSTAMP", stamp),
    e.allDay ? prop("DTSTART;VALUE=DATE", e.start) : prop(`DTSTART;TZID=${TZID}`, e.start),
    e.allDay ? prop("DTEND;VALUE=DATE", e.end) : prop(`DTEND;TZID=${TZID}`, e.end),
    prop("SUMMARY", escText(e.summary)),
    prop("DESCRIPTION", escText(e.description)),
    prop("LOCATION", e.location ? escText(e.location) : null),
    prop("URL", e.url),
    "END:VEVENT",
  ];
  return lines.filter((l): l is string => l != null);
}

/* the whole feed. `now` (ms) stamps every event; CRLF line ends; ends with a CRLF. */
export function icsText(sessions: Session[], now: number = Date.now()): string {
  const stamp = utcStamp(now);
  const head = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Taylormade Academy//OPIL Lab Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escText(CAL_NAME)}`),
    `X-WR-TIMEZONE:${TZID}`,
    "X-PUBLISHED-TTL:PT10M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT10M",
    ...VTIMEZONE,
  ];
  const body = eventsFor(sessions).flatMap((e) => vevent(e, stamp));
  return [...head, ...body, "END:VCALENDAR"].join("\r\n") + "\r\n";
}

/* what the HTTP layer sends back for a GET; `download` = the "Download .ics" button (Content-Disposition) */
export function calendarResponse(sessions: Session[], now: number, download: boolean): { status: number; headers: Record<string, string>; body: string } {
  const body = icsText(sessions, now);
  const headers: Record<string, string> = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, max-age=600",
  };
  if (download) headers["Content-Disposition"] = 'attachment; filename="opil-2026-27.ics"';
  return { status: 200, headers, body };
}
