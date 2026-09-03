import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { firstName, money, when, paragraphs, esc } from "./email.ts";

Deno.test("firstName capitalises and falls back", () => {
  assertEquals(firstName("nelson taylor"), "Nelson");
  assertEquals(firstName("  "), "there");
  assertEquals(firstName(null), "there");
});
Deno.test("money drops cents when whole", () => {
  assertEquals(money(14900), "$149");
  assertEquals(money(4550), "$45.50");
});
Deno.test("when renders in the event time zone", () => {
  const s = when("2026-10-24T00:00:00Z", "America/Chicago"); // 7:00 PM CDT the day before
  assertStringIncludes(s, "Friday, October 23");
  assertStringIncludes(s, "7:00 PM");
  assertEquals(when(null), "Date to be announced");
});
Deno.test("paragraphs escapes and splits", () => {
  const html = paragraphs("Hi <b>{name}</b>\nline two\n\nsecond para");
  assertStringIncludes(html, "&lt;b&gt;");
  assertStringIncludes(html, "line two");
  assertEquals((html.match(/<p /g) || []).length, 2);
});
Deno.test("esc handles quotes", () => assertEquals(esc(`a"b'c`), "a&quot;b&#39;c"));
