// deno test supabase/functions/ea-opil-pass/
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanEmail, handlePass, type PassDeps } from "./handler.ts";

const IP = { ip: "1.2.3.4" };

function deps(over: Partial<PassDeps> = {}) {
  const rates: [string, number, number][] = [];
  const minted: [string, string | null][] = [];
  const d: PassDeps & { rates: typeof rates; minted: typeof minted } = {
    rates, minted,
    rateCheck: async (k, m, w) => { rates.push([k, m, w]); return true; },
    findApproved: async (email) => (email === "kiara1.pee@famu.edu" ? { full_name: "Kiara Pee" } : null),
    mintToken: async (email, name) => { minted.push([email, name]); return "hash-" + email; },
    ...over,
  };
  return d;
}

Deno.test("an approved student's email, however typed, comes back with a one-time token and the stored spelling", async () => {
  const d = deps();
  const r = await handlePass({ email: "  Kiara1.Pee@FAMU.edu " }, IP, d);
  assertEquals(r, { status: 200, body: { token_hash: "hash-kiara1.pee@famu.edu", email: "kiara1.pee@famu.edu" } });
  assertEquals(d.minted, [["kiara1.pee@famu.edu", "Kiara Pee"]]);
});

Deno.test("an email that is not on the approved list is refused and nothing is minted — facilitators and strangers alike", async () => {
  const d = deps();
  const r = await handlePass({ email: "casey@blazegroupllc.com" }, IP, d);
  assertEquals(r, { status: 403, body: { error: "not_on_list" } });
  assertEquals(d.minted, []);
});

Deno.test("not an email at all → bad_email before any lookup or rate check", async () => {
  const d = deps();
  for (const bad of ["", "kiara", "kiara@", "@famu.edu", null, undefined, 42, "a@b"]) {
    const r = await handlePass({ email: bad }, IP, d);
    assertEquals(r.status, 400, String(bad));
  }
  assertEquals(d.rates, []);
  assertEquals(d.minted, []);
});

Deno.test("rate limits: 300 per network and 6 per email per 10 minutes; a refused check answers slow_down, an unknown check lets it through", async () => {
  const d = deps();
  await handlePass({ email: "kiara1.pee@famu.edu" }, IP, d);
  assertEquals(d.rates, [["opil_pass_ip:1.2.3.4", 300, 600], ["opil_pass_email:kiara1.pee@famu.edu", 6, 600]]);
  const refused = await handlePass({ email: "kiara1.pee@famu.edu" }, IP, deps({ rateCheck: async () => false }));
  assertEquals(refused, { status: 429, body: { error: "slow_down" } });
  const unknown = await handlePass({ email: "kiara1.pee@famu.edu" }, IP, deps({ rateCheck: async () => null }));
  assertEquals(unknown.status, 200);
});

Deno.test("Supabase refusing to mint is a 503, not a silent 200", async () => {
  const r = await handlePass({ email: "kiara1.pee@famu.edu" }, IP, deps({ mintToken: async () => null }));
  assertEquals(r, { status: 503, body: { error: "sign_in_unavailable" } });
});

Deno.test("cleanEmail", () => {
  assertEquals(cleanEmail(" A.B@X.EDU "), "a.b@x.edu");
  assertEquals(cleanEmail("nope"), null);
  assertEquals(cleanEmail("a@b.c"), "a@b.c");
  assertEquals(cleanEmail("x".repeat(250) + "@a.io"), null);
});
