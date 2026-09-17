// deno test supabase/functions/ea-opil-calendar/   (the same rules are also proved under node: tests/opil/calendar.test.mjs)
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calendarResponse, escText, eventsFor, foldLine, icsText, type Session, summaryFor } from "./handler.ts";

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0);
const S = (no: number, kind: string, extra: Partial<Session> = {}): Session => ({ no, kind, title: "T" + no, session_date: null, start_time: null, end_time: null, ...extra });
const KICKOFF = S(1, "thread", { title: "Kickoff & Orientation", session_date: "2026-09-16", start_time: "18:30:00", end_time: "19:30:00" });
const bytes = (s: string) => new TextEncoder().encode(s).length;

Deno.test("foldLine keeps every physical line at 75 octets or fewer and never splits a multi-byte character", () => {
  for (const line of ["DESCRIPTION:" + "a".repeat(200), "SUMMARY:" + "é".repeat(60), "X:" + "🎓".repeat(30)]) {
    const lines = foldLine(line).split("\r\n");
    for (const [i, l] of lines.entries()) {
      assert(bytes(l) <= 75, `${bytes(l)} octets`);
      if (i) assertEquals(l[0], " ");
    }
    assertEquals(lines.map((l, i) => i ? l.slice(1) : l).join(""), line);
  }
  assertEquals(foldLine("SUMMARY:short"), "SUMMARY:short");
});

Deno.test("escText follows RFC 5545", () => {
  assertEquals(escText("a;b,c\\d\ne\r\nf"), "a\\;b\\,c\\\\d\\ne\\nf");
});

Deno.test("timed classes get TZID times, milestones and untimed classes are all-day, hidden rooms and undated rows are left out", () => {
  const ev = eventsFor([
    KICKOFF,
    S(2, "thread", { session_date: "2026-09-21", start_time: "18:30" }),
    S(12, "milestone", { title: "Demo Day", session_date: "2027-04-20" }),
    S(202, "curriculum", { session_date: "2026-10-14" }),
    S(203, "curriculum"),
  ]);
  assertEquals(ev.map((e) => e.no), [1, 202, 12]);
  assertEquals(ev[0].allDay, false);
  assertEquals(ev[0].start, "20260916T183000");
  assertEquals(ev[0].end, "20260916T193000");
  assertEquals(ev[1].allDay, true);
  assertEquals(ev[2].start, "20270420");
  assertEquals(ev[2].end, "20270421");
  assertEquals(summaryFor(KICKOFF), "OPIL · Kickoff · Kickoff & Orientation");
});

Deno.test("icsText: CRLF, the calendar name, a New York VTIMEZONE, stable UIDs, nothing over 75 octets", () => {
  const ics = icsText([KICKOFF, S(12, "milestone", { title: "Demo, Day; one", session_date: "2027-04-20" })], NOW);
  assert(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert(ics.endsWith("END:VCALENDAR\r\n"));
  assert(ics.includes("X-WR-CALNAME:OPIL 2026–27\r\n"));
  assert(ics.includes("BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\n"));
  assert(ics.includes("DTSTART;TZID=America/New_York:20260916T183000\r\n"));
  assert(ics.includes("DTSTART;VALUE=DATE:20270420\r\n"));
  assert(ics.includes("UID:opil-1@taylormadeacademy.com\r\n"));
  assert(ics.includes("SUMMARY:OPIL · Demo\\, Day\\; one\r\n"));
  assert(ics.includes("DTSTAMP:20260916T120000Z\r\n"));
  assert(ics.includes("LOCATION:https://taylormadeacademy.com/opil/hub/live/?s=1\r\n"));
  for (const l of ics.split("\r\n")) assert(bytes(l) <= 75, l);
  assertEquals(icsText([KICKOFF], NOW), icsText([KICKOFF], NOW));
});

Deno.test("calendarResponse: text/calendar cached ten minutes; the download adds a filename", () => {
  const r = calendarResponse([KICKOFF], NOW, false);
  assertEquals(r.headers["Content-Type"], "text/calendar; charset=utf-8");
  assertEquals(r.headers["Cache-Control"], "public, max-age=600");
  assertEquals(r.headers["Content-Disposition"], undefined);
  assertEquals(calendarResponse([KICKOFF], NOW, true).headers["Content-Disposition"], 'attachment; filename="opil-2026-27.ics"');
});
