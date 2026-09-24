import { assert, assertEquals } from "jsr:@std/assert@1";
import { mergeHtml, HTML_MAX } from "./merge.ts";

const v = { firstName: "Pat <b>", buttonUrl: "https://taylormadeacademy.com/agent/?early=abc#seats", unsubUrl: "https://x.test/leave?unsub=abc", listName: "Build Your First AI Agent" };

Deno.test("fills name (escaped), button and unsub", () => {
  const out = mergeHtml(`<body><p>Hey {name}</p><a href="{{button_url}}">Go</a><a href="{{unsub_url}}">Leave</a></body>`, v);
  assert(out.includes("Hey Pat &lt;b&gt;"));
  assert(out.includes('href="https://taylormadeacademy.com/agent/?early=abc#seats"'));
  assert(out.includes('href="https://x.test/leave?unsub=abc"'));
  assertEquals(out.match(/Leave the list/g), null); // its own link used, no footer added
});

Deno.test("every placeholder is replaced, not just the first", () => {
  const out = mergeHtml(`{name} {name} {{button_url}} {{button_url}} {{unsub_url}}`, v);
  assert(!out.includes("{name}") && !out.includes("{{button_url}}") && !out.includes("{{unsub_url}}"));
});

Deno.test("missing unsub link -> footer appended before </body>", () => {
  const out = mergeHtml(`<html><body><p>Hi</p></body></html>`, v);
  assert(/Leave the list<\/a>\.<\/p><\/body>/.test(out));
  assert(out.includes("https://x.test/leave?unsub=abc"));
});

Deno.test("missing unsub link and no </body> -> footer appended at the end", () => {
  const out = mergeHtml(`<p>Hi</p>`, v);
  assert(out.endsWith("</p>") && out.includes("Leave the list"));
});

Deno.test("size cap is 100 KB", () => assertEquals(HTML_MAX, 100_000));
