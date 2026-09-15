// deno test supabase/functions/_shared/rtk_auth_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientIp } from "./rtk_auth.ts";

const req = (headers: Record<string, string>) => new Request("https://p.supabase.co/functions/v1/ea-rtk-join", { method: "POST", headers });

Deno.test("clientIp prefers cf-connecting-ip", () => {
  assertEquals(clientIp(req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 203.0.113.9" })), "203.0.113.9");
});

Deno.test("clientIp takes the LAST x-forwarded-for entry — the first one is written by the caller", () => {
  assertEquals(clientIp(req({ "x-forwarded-for": "1.1.1.1, 198.51.100.7" })), "198.51.100.7");
  assertEquals(clientIp(req({ "x-forwarded-for": " 198.51.100.7 " })), "198.51.100.7");
  assertEquals(clientIp(req({ "x-forwarded-for": "198.51.100.7, , " })), "198.51.100.7");
});

Deno.test("clientIp falls back to 'unknown'", () => {
  assertEquals(clientIp(req({})), "unknown");
  assertEquals(clientIp(req({ "x-forwarded-for": " , " })), "unknown");
});
