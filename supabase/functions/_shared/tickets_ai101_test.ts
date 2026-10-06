// deno test --allow-env supabase/functions/_shared/tickets_ai101_test.ts
// The free class's confirmation email: it links the class page and promises the cheat sheet IN class (Nelson 10/6),
// and no longer hands out the PDF early. (--allow-env: email.ts reads its sender defaults from the environment.)
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ai101EmailBody } from "./tickets.ts";

const order = { full_name: "Ann Lee", email: "ann@x.com" } as Parameters<typeof ai101EmailBody>[0];
const ev = { title: "AI 101", starts_at: "2026-10-10T00:00:00Z", tz: "America/Chicago", join_url: "https://taylormadeacademy.com/room/?k=abc" } as Parameters<typeof ai101EmailBody>[1];

Deno.test("AI 101 confirmation: the class page, the cheat sheet promised in class, no early PDF", () => {
  const html = ai101EmailBody(order, ev);
  assert(html.includes("/ai101/class/"), "the class page link");
  assert(html.includes("cheat sheet in class"), "the cheat sheet is handed out in class");
  assert(!html.includes("cheat-sheet.pdf"), "no early PDF link");
  assert(html.includes("open the room"), "the room link block is unchanged");
  assert(html.includes("Ann,"), "first name greeting");
  assert(html.includes("texts a code to your phone"), "the Claude sign-up code, before it stalls the room");
  assert(html.includes("Gemini"), "the no-new-account path for Gmail users");
});
