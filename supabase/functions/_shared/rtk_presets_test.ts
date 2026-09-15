// deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_presets_test.ts
// ensurePresets caches success per preset name in a module-level Set, so every test imports its own
// copy of the module (a different query string = a fresh instance in Deno) instead of sharing one cache.
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PRESET_BODIES } from "./rtk_presets.ts";
import type { JoinDeps } from "../ea-rtk-join/handler.ts";

const TMA_NAMES = ["tma-class-host", "tma-class-guest"];

type Call = { method: string; path: string; body?: unknown };
type Answer = (method: string, path: string) => { ok: boolean; status: number; data: unknown };

function fakeCf(answer: Answer): JoinDeps["cf"] & { calls: Call[] } {
  const calls: Call[] = [];
  const cf = (async (method: string, path: string, body?: unknown) => { calls.push({ method, path, body }); return answer(method, path); }) as JoinDeps["cf"] & { calls: Call[] };
  cf.calls = calls;
  return cf;
}
const HOST_ON_CF = { id: "p-host", name: "tma-class-host", permissions: PRESET_BODIES["tma-class-host"].permissions };
const GUEST_OK_ON_CF = { id: "p-guest", name: "tma-class-guest", permissions: PRESET_BODIES["tma-class-guest"].permissions };
const GUEST_FILES_ON = { id: "p-guest", name: "tma-class-guest", permissions: { chat: { public: { can_send: true, text: true, files: true }, private: { can_send: true, can_receive: true, text: true, files: false } } } };

Deno.test("the TS bodies are the committed JSON files, verbatim — Academy and HT", async () => {
  for (const name of ["tma-class-host", "tma-class-guest", "ht-class-host", "ht-class-guest"] as const) {
    const json = JSON.parse(await Deno.readTextFile(new URL(`../../../scripts/rtk-presets/${name}.json`, import.meta.url)));
    assertEquals(PRESET_BODIES[name], json);
  }
});

Deno.test("both missing → POST both bodies, in order", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=missing");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [] } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "POST", path: "/presets", body: PRESET_BODIES["tma-class-host"] },
    { method: "POST", path: "/presets", body: PRESET_BODIES["tma-class-guest"] },
  ]);
});

Deno.test("404 from the list means 'none yet' → POST both", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=404");
  const cf = fakeCf((m) => (m === "GET" ? { ok: false, status: 404, data: {} } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "POST /presets", "POST /presets"]);
});

Deno.test("guest present with files on → PATCH the guest by id, host untouched", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=patch");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_FILES_ON] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-guest", body: PRESET_BODIES["tma-class-guest"] },
  ]);
});

Deno.test("only the host missing → one POST", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=hostonly");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [GUEST_OK_ON_CF] } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "POST /presets"]);
  assertEquals((cf.calls[1].body as { name: string }).name, "tma-class-host");
});

Deno.test("all good → nothing but the list; and the second call is served from the cache", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=good");
  const cf = fakeCf(() => ({ ok: true, status: 200, data: { data: [HOST_ON_CF, GUEST_OK_ON_CF] } }));   /* the nested {data:[…]} shape */
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.length, 1);
});

Deno.test("a failed list or create never throws and is not cached — the next join tries again", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=fail");
  const cf = fakeCf((m) => (m === "GET" ? { ok: false, status: 500, data: {} } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.length, 1);   /* no POST after a failed list */
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.length, 2);   /* tried the list again */
  const cf2 = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [] } : { ok: false, status: 403, data: {} }));
  await ensurePresets(cf2, TMA_NAMES);
  await ensurePresets(cf2, TMA_NAMES);
  assertEquals(cf2.calls.filter((c) => c.method === "GET").length, 2);   /* a failed create is not cached either */
  const boom = (async () => { throw new Error("network down"); }) as unknown as JoinDeps["cf"];
  await ensurePresets(boom, TMA_NAMES);   /* resolves, does not reject */
});

Deno.test("HT names are ensured independently of the Academy pair (a Set, not one boolean) — and a mix reuses what is already known good", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=ht-independent");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: { data: [HOST_ON_CF, GUEST_OK_ON_CF] } } : { ok: true, status: 200, data: { id: "p-new" } }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);   /* Academy already good */
  await ensurePresets(cf, ["ht-class-host", "ht-class-guest"]);
  assertEquals(cf.calls.slice(1), [
    { method: "GET", path: "/presets", body: undefined },
    { method: "POST", path: "/presets", body: PRESET_BODIES["ht-class-host"] },
    { method: "POST", path: "/presets", body: PRESET_BODIES["ht-class-guest"] },
  ]);
  /* both pairs are now cached: a call naming one of each touches nothing */
  await ensurePresets(cf, ["tma-class-host", "ht-class-guest"]);
  assertEquals(cf.calls.length, 4);
});

Deno.test("an unknown preset name throws, before any network call", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=unknown");
  const cf = fakeCf(() => ({ ok: true, status: 200, data: [] }));
  await assertRejects(() => ensurePresets(cf, ["not-a-real-preset"]));
  assertEquals(cf.calls.length, 0);
});
