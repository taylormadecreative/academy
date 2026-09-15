// deno test --allow-read=scripts/rtk-presets supabase/functions/_shared/rtk_presets_test.ts
// ensurePresets caches success per preset name in a module-level Set, so every test imports its own
// copy of the module (a different query string = a fresh instance in Deno) instead of sharing one cache.
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PRESET_BODIES, TOOL_FLAGS, needsPatch, toolFlagMismatch } from "./rtk_presets.ts";
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
/* a body with one permission changed (deep copy; `path` is under permissions) */
function withFlag(body: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const c = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  const parts = path.split("."); let cur = c.permissions as Record<string, unknown>;
  for (const k of parts.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[parts[parts.length - 1]] = value;
  return c;
}
/* the shape Cloudflare held before 9/15: a guest with files off, no polls, no pin, no small groups */
const GUEST_OLD_SHAPE = { id: "p-guest", name: "tma-class-guest", permissions: withFlag(withFlag(withFlag(withFlag(PRESET_BODIES["tma-class-guest"], "chat.public.files", false), "chat.private.files", false), "polls.can_create", false), "pin_participant", false).permissions };

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

Deno.test("guest present in the pre-9/15 shape (files off, no polls, no pin) → PATCH the guest by id, host untouched", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=patch");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_OLD_SHAPE] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-guest", body: PRESET_BODIES["tma-class-guest"] },
  ]);
});

/* ── every tool for every role (9/15): the bodies, and needsPatch on each flag ── */
Deno.test("every preset body ALLOWS screen share, polls create + vote, chat text + files, pin, small groups; kick stays host-only", () => {
  for (const name of ["tma-class-host", "tma-class-guest", "ht-class-host", "ht-class-guest"] as const) {
    const p = PRESET_BODIES[name] as Record<string, unknown>;
    const perms = p.permissions as Record<string, unknown>;
    const media = perms.media as Record<string, Record<string, string>>;
    const chat = perms.chat as Record<string, Record<string, boolean>>;
    const polls = perms.polls as Record<string, boolean>;
    const cm = perms.connected_meetings as Record<string, boolean>;
    assertEquals(media.audio.can_produce, "ALLOWED", name); assertEquals(media.video.can_produce, "ALLOWED", name); assertEquals(media.screenshare.can_produce, "ALLOWED", name);
    assertEquals(polls.can_create, true, name); assertEquals(polls.can_vote, true, name); assertEquals(polls.can_view, true, name);
    assertEquals(chat.public.text, true, name); assertEquals(chat.public.files, true, name); assertEquals(chat.private.text, true, name); assertEquals(chat.private.files, true, name); assertEquals(chat.private.can_send, true, name);
    assertEquals(perms.pin_participant, true, name);
    assertEquals(cm.can_alter_connected_meetings, true, name);
    assertEquals(perms.kick_participant, name.endsWith("-host"), name);
  }
});

Deno.test("needsPatch: the body itself, or a copy that differs only on a non-tool flag (kick), needs nothing; a copy that differs on ANY tool flag does", () => {
  for (const name of ["tma-class-host", "tma-class-guest", "ht-class-host", "ht-class-guest"] as const) {
    const body = PRESET_BODIES[name];
    assertEquals(needsPatch(name, body), false, name);
    assertEquals(needsPatch(name, withFlag(body, "kick_participant", !((body.permissions as Record<string, unknown>).kick_participant))), false, name + " kick is not a tool");
    for (const f of TOOL_FLAGS) {
      const cur = ((): unknown => { let c: unknown = body.permissions; for (const k of f.split(".")) c = (c as Record<string, unknown>)[k]; return c; })();
      const flipped = typeof cur === "boolean" ? !cur : cur === "ALLOWED" ? "NOT_ALLOWED" : "ALLOWED";
      const live = withFlag(body, f, flipped);
      assertEquals(needsPatch(name, live), true, name + " " + f);
      assertEquals(toolFlagMismatch(body, live), f, name + " " + f);
    }
    /* a live copy missing the flag altogether (an older API shape) is a mismatch too */
    assertEquals(needsPatch(name, { permissions: {} }), true, name + " empty");
  }
  assertEquals(TOOL_FLAGS.includes("media.screenshare.can_produce"), true);
  assertEquals(TOOL_FLAGS.includes("polls.can_create"), true);
  assertEquals(TOOL_FLAGS.includes("chat.public.files"), true);
  assertEquals(TOOL_FLAGS.includes("chat.private.files"), true);
  assertEquals(TOOL_FLAGS.includes("pin_participant"), true);
  assertEquals(TOOL_FLAGS.includes("connected_meetings.can_alter_connected_meetings"), true);
  assertEquals(TOOL_FLAGS.includes("transcription_enabled"), true);
});

Deno.test("ht-class-guest live without screen share → PATCH; the same for polls.can_create off and chat.private.files off", async () => {
  for (const [tag, f, v] of [["share", "media.screenshare.can_produce", "NOT_ALLOWED"], ["polls", "polls.can_create", false], ["files", "chat.private.files", false]] as const) {
    const { ensurePresets } = await import("./rtk_presets.ts?t=ht-flag-" + tag);
    const live = { id: "p-htguest", name: "ht-class-guest", permissions: withFlag(PRESET_BODIES["ht-class-guest"], f, v).permissions };
    const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [{ id: "p-hthost", name: "ht-class-host", permissions: PRESET_BODIES["ht-class-host"].permissions }, live] } : { ok: true, status: 200, data: {} }));
    await ensurePresets(cf, ["ht-class-host", "ht-class-guest"]);
    assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "PATCH /presets/p-htguest"], tag);
    assertEquals(cf.calls[1].body, PRESET_BODIES["ht-class-guest"], tag);
  }
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

/* ── transcription (9/15): HT guests are captioned, so a live ht-class-guest that still says false is re-sent ── */
const HT_NAMES = ["ht-class-host", "ht-class-guest"];
const HT_HOST_ON_CF = { id: "p-hthost", name: "ht-class-host", permissions: PRESET_BODIES["ht-class-host"].permissions };
const HT_GUEST_OK_ON_CF = { id: "p-htguest", name: "ht-class-guest", permissions: PRESET_BODIES["ht-class-guest"].permissions };
/* the shape Cloudflare holds from before 9/15: files already off, transcription still off */
const HT_GUEST_NO_TRANSCRIPT = { id: "p-htguest", name: "ht-class-guest", permissions: { ...(PRESET_BODIES["ht-class-guest"].permissions as Record<string, unknown>), transcription_enabled: false } };
/* an Academy guest copy that matches the body on every tool flag (transcription false IS the body's value) */
const TMA_GUEST_NO_TRANSCRIPT = { id: "p-guest", name: "tma-class-guest", permissions: withFlag(PRESET_BODIES["tma-class-guest"], "kick_participant", false).permissions };

Deno.test("the HT guest body says transcription on; the Academy guest body still says off", () => {
  assertEquals((PRESET_BODIES["ht-class-guest"].permissions as Record<string, unknown>).transcription_enabled, true);
  assertEquals((PRESET_BODIES["tma-class-guest"].permissions as Record<string, unknown>).transcription_enabled, false);
});

Deno.test("ht-class-guest live with transcription off (files already off) → one PATCH with the body; the host untouched", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=ht-transcribe");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HT_HOST_ON_CF, HT_GUEST_NO_TRANSCRIPT] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, HT_NAMES);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-htguest", body: PRESET_BODIES["ht-class-guest"] },
  ]);
});

Deno.test("ht-class-guest live and matching → nothing but the list", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=ht-matching");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HT_HOST_ON_CF, HT_GUEST_OK_ON_CF] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, HT_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);
});

Deno.test("tma-class-guest live with transcription off → no PATCH (the Academy guest body says off too)", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=tma-no-transcribe");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, TMA_GUEST_NO_TRANSCRIPT] } : { ok: true, status: 200, data: {} }));
  await ensurePresets(cf, TMA_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);
});

Deno.test("a transcription PATCH that fails is not cached as ok — the next join lists and tries again", async () => {
  const { ensurePresets } = await import("./rtk_presets.ts?t=ht-patchfail");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HT_HOST_ON_CF, HT_GUEST_NO_TRANSCRIPT] } : { ok: false, status: 500, data: {} }));
  await ensurePresets(cf, HT_NAMES);
  await ensurePresets(cf, HT_NAMES);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets", "PATCH /presets/p-htguest", "GET /presets", "PATCH /presets/p-htguest"]);
});

/* ── the OPIL presets: ensureOpilPresets, its own cache (9/15: students and judges are transcribed too, and get every tool) ── */
import { OPIL_BODIES as OPIL } from "./rtk_presets.ts";
const OPIL_STUDENT_OFF = { id: "p-stu", name: "opil-student", permissions: withFlag(OPIL["opil-student"] as unknown as Record<string, unknown>, "transcription_enabled", false).permissions };
const OPIL_JUDGE_OFF = { id: "p-jud", name: "opil-judge", permissions: withFlag(OPIL["opil-judge"] as unknown as Record<string, unknown>, "transcription_enabled", false).permissions };
const OPIL_STUDENT_ON = { id: "p-stu", name: "opil-student", permissions: OPIL["opil-student"].permissions };
/* the judge as it was: watch + chat, no media, no screen share, no polls — every flag a tool now */
const OPIL_JUDGE_OLD = { id: "p-jud", name: "opil-judge", permissions: withFlag(withFlag(withFlag(OPIL["opil-judge"] as unknown as Record<string, unknown>, "media.screenshare.can_produce", "NOT_ALLOWED"), "media.audio.can_produce", "NOT_ALLOWED"), "polls.can_create", false).permissions };

Deno.test("the OPIL copies the function ships are the committed JSON files, verbatim — transcribed, and every tool on", async () => {
  const { OPIL_BODIES } = await import("./rtk_presets.ts?t=opilcopy");
  for (const name of ["opil-student", "opil-judge"] as const) {
    const json = JSON.parse(await Deno.readTextFile(new URL(`../../../scripts/rtk-presets/${name}.json`, import.meta.url)));
    assertEquals(OPIL_BODIES[name], json);
    const perms = OPIL_BODIES[name].permissions as unknown as Record<string, unknown>;
    assertEquals(perms.transcription_enabled, true);
    assertEquals((perms.media as Record<string, Record<string, string>>).screenshare.can_produce, "ALLOWED", name);
    assertEquals((perms.media as Record<string, Record<string, string>>).audio.can_produce, "ALLOWED", name);
    assertEquals((perms.polls as Record<string, boolean>).can_create, true, name);
    assertEquals((perms.chat as Record<string, Record<string, boolean>>).private.files, true, name);
    assertEquals(perms.pin_participant, true, name);
    assertEquals((perms.connected_meetings as Record<string, boolean>).can_alter_connected_meetings, true, name);
    assertEquals(perms.kick_participant, false, name);
  }
});

Deno.test("an OPIL judge in the old shape (no media, no screen share, no polls) → PATCH with the committed body", async () => {
  const { ensureOpilPresets, OPIL_BODIES } = await import("./rtk_presets.ts?t=opiljudge");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [OPIL_STUDENT_ON, OPIL_JUDGE_OLD] } : { ok: true, status: 200, data: {} }));
  await ensureOpilPresets(cf);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-jud", body: OPIL_BODIES["opil-judge"] },
  ]);
});

Deno.test("OPIL presets with transcription off → PATCH each by id with the committed body; the Academy/HT pairs are not its business", async () => {
  const { ensureOpilPresets, OPIL_BODIES } = await import("./rtk_presets.ts?t=opilpatch");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_OK_ON_CF, OPIL_STUDENT_OFF, OPIL_JUDGE_OFF] } : { ok: true, status: 200, data: {} }));
  await ensureOpilPresets(cf);
  assertEquals(cf.calls, [
    { method: "GET", path: "/presets", body: undefined },
    { method: "PATCH", path: "/presets/p-stu", body: OPIL_BODIES["opil-student"] },
    { method: "PATCH", path: "/presets/p-jud", body: OPIL_BODIES["opil-judge"] },
  ]);
});

Deno.test("OPIL presets already transcribing → nothing but the list; a missing OPIL preset is never created here", async () => {
  const { ensureOpilPresets } = await import("./rtk_presets.ts?t=opilok");
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_OK_ON_CF, OPIL_STUDENT_ON] } : { ok: true, status: 200, data: {} }));
  await ensureOpilPresets(cf);
  assertEquals(cf.calls.map((c) => c.method + " " + c.path), ["GET /presets"]);
});

Deno.test("an OPIL PATCH that fails is not cached — the next host join tries again", async () => {
  const { ensureOpilPresets } = await import("./rtk_presets.ts?t=opilfail");
  let n = 0;
  const cf = fakeCf((m) => (m === "GET" ? { ok: true, status: 200, data: [HOST_ON_CF, GUEST_OK_ON_CF, OPIL_JUDGE_OFF] } : { ok: false, status: 500, data: {} }));
  await ensureOpilPresets(cf); await ensureOpilPresets(cf);
  n = cf.calls.filter((c) => c.method === "GET").length;
  assertEquals(n, 2);
});
