// deno test supabase/functions/ea-rtk-join/
// The OPIL branch, ported from the one-file function of 9/11–9/14. These tests are the proof that
// the OPIL class room did not move when the Academy room branch and the hardening landed.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleJoin, type Caller, type JoinDeps, OPEN_WINDOW_MS, PRESETS } from "./handler.ts";

const base = { academyAdmin: false, ip: "203.0.113.9" };
const COORD: Caller = { ...base, user: { id: "u-coord", email: "coord@x" }, role: { admin: true, judge: false, facilitator_sessions: [] } };
const FAC7: Caller = { ...base, user: { id: "u-fac", email: "fac@x" }, role: { admin: false, judge: false, facilitator_sessions: [7] } };
const JUDGE: Caller = { ...base, user: { id: "u-judge", email: "judge@x" }, role: { admin: false, judge: true, facilitator_sessions: [] } };
const STUDENT: Caller = { ...base, user: { id: "u-stu", email: "stu@x" }, role: { admin: false, judge: false, facilitator_sessions: [] } };
const A_UUID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";

/* Sessions: 6 and 7 have a stored meeting; 8 has none yet; 9's stored meeting is the Academy room's.
   Every dep is wrapped so `touched` lists what the handler reached for, in order — overrides included. */
function deps(over: Partial<JoinDeps> = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const touched: string[] = [];
  const raw: JoinDeps = {
    cf: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      return { ok: true, status: 200, data: { token: "tok-" + path.split("/")[2] } };
    },
    rateCheck: async () => true,
    getSession: async (no) =>
      no === 6 ? { no: 6, title: "Intro", stream_url: "rtk:meet-6", is_live: true }
      : no === 7 ? { no: 7, title: "Agents 101", stream_url: "rtk:meet-7", is_live: true }
      : no === 8 ? { no: 8, title: "No room", stream_url: null, is_live: false }
      : no === 9 ? { no: 9, title: "Pointed at the room", stream_url: "rtk:meet-room", is_live: true }
      : null,
    inCohort: async () => false,
    isMember: async () => false,
    getRoom: async () => null,
    setRoomMeeting: async () => {},
    roomMeetingIds: async () => new Set(["meet-room"]),
    upsertMember: async () => {},
    displayName: async () => null,
    ensurePresets: async () => {},
    ensureOpilPresets: async () => {},
    now: () => new Date("2026-09-16T19:05:00-05:00"),
    ...over,
  };
  const d = { calls, touched } as JoinDeps & { calls: typeof calls; touched: typeof touched };
  for (const k of Object.keys(raw) as (keyof JoinDeps)[]) {
    const fn = raw[k] as (...a: unknown[]) => unknown;
    (d as unknown as Record<string, unknown>)[k] = k === "now" ? fn : (...a: unknown[]) => { touched.push(k); return fn(...a); };
  }
  return d;
}
const participantPosts = (d: { calls: { method: string; path: string }[] }) => d.calls.filter((c) => c.method === "POST" && c.path.endsWith("/participants"));
const err = (r: { body: unknown }) => (r.body as { error: string }).error;

Deno.test("the constants later tasks rely on", () => {
  assertEquals([...PRESETS], ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest", "ht-class-host", "ht-class-guest"]);
  assertEquals(OPEN_WINDOW_MS, 14400000);
});

Deno.test("a coordinator gets opil-host on any session, with the stored meeting", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-host", host: true, name: "coord" });
  assertEquals(d.calls, [{ method: "POST", path: "/meetings/meet-7/participants", body: { custom_participant_id: "u-coord", preset_name: "opil-host", name: "coord" } }]);
});

Deno.test("the facilitator of THIS session is a host; of another session, a student at most", async () => {
  const mine = await handleJoin({ session_no: 7 }, FAC7, deps());
  assertEquals(mine.status, 200); assertEquals((mine.body as { preset: string; host: boolean }).preset, "opil-host"); assertEquals((mine.body as { host: boolean }).host, true);
  const other = await handleJoin({ session_no: 6 }, FAC7, deps({ inCohort: async () => true }));
  assertEquals(other.status, 200); assertEquals((other.body as { preset: string }).preset, "opil-student"); assertEquals((other.body as { host: boolean }).host, false);
  const outsider = await handleJoin({ session_no: 6 }, FAC7, deps());
  assertEquals(outsider.status, 403); assertEquals(err(outsider), "not_allowed");
});

Deno.test("an OPIL host join brings the presets in line first (9/15: students and judges transcribed); a student join never does", async () => {
  let presets = 0;
  const d = deps({ ensureOpilPresets: async () => { presets++; } });
  const host = await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(host.status, 200); assertEquals(presets, 1);
  const stu = await handleJoin({ session_no: 7 }, STUDENT, deps({ inCohort: async () => true, ensureOpilPresets: async () => { presets++; } }));
  assertEquals(stu.status, 200); assertEquals(presets, 1);
});

Deno.test("a judge gets opil-judge without a cohort check", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, JUDGE, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-judge", host: false, name: "judge" });
  assertEquals(d.touched.includes("inCohort"), false);
});

Deno.test("a cohort member gets opil-student", async () => {
  const r = await handleJoin({ session_no: 7 }, STUDENT, deps({ inCohort: async () => true }));
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-7", meeting_id: "meet-7", preset: "opil-student", host: false, name: "stu" });
});

Deno.test("a stranger is refused before the session is even read", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 7 }, STUDENT, d);
  assertEquals(r.status, 403); assertEquals(err(r), "not_allowed");
  assertEquals(d.calls.length, 0);
  assertEquals(d.touched, ["inCohort"]);
});

Deno.test("the side door is shut: a student on a session with no stored meeting gets 409 not_open EVEN WITH a meeting_id in the body", async () => {
  const d = deps({ inCohort: async () => true });
  const r = await handleJoin({ session_no: 8, meeting_id: A_UUID }, STUDENT, d);
  assertEquals(r.status, 409); assertEquals(err(r), "not_open");
  assertEquals(d.calls.length, 0);
  const plain = await handleJoin({ session_no: 8 }, STUDENT, deps({ inCohort: async () => true }));
  assertEquals(plain.status, 409); assertEquals(err(plain), "not_open");
});

Deno.test("a client meeting_id never wins over the stored one", async () => {
  const d = deps({ inCohort: async () => true });
  const r = await handleJoin({ session_no: 7, meeting_id: A_UUID }, STUDENT, d);
  assertEquals(r.status, 200); assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-7");
  assertEquals(d.calls.map((c) => c.path), ["/meetings/meet-7/participants"]);
  const h = deps();
  await handleJoin({ session_no: 7, meeting_id: A_UUID }, COORD, h);
  assertEquals(h.calls.map((c) => c.path), ["/meetings/meet-7/participants"]);
});

Deno.test("a host on a session with no meeting creates one and the reply carries its id", async () => {
  const d = deps();
  const r = await handleJoin({ session_no: 8 }, COORD, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-new", meeting_id: "meet-new", preset: "opil-host", host: true, name: "coord" });
  assertEquals(d.calls, [
    { method: "POST", path: "/meetings", body: { title: "OPIL 8 — No room", persist_chat: false } },
    { method: "POST", path: "/meetings/meet-new/participants", body: { custom_participant_id: "u-coord", preset_name: "opil-host", name: "coord" } },
  ]);
});

Deno.test("a session pointed at the Academy room's meeting is refused for every role, with zero participant POSTs", async () => {
  const FAC9: Caller = { ...FAC7, role: { admin: false, judge: false, facilitator_sessions: [9] } };
  for (const [who, over] of [[COORD, {}], [FAC9, {}], [JUDGE, {}], [STUDENT, { inCohort: async () => true }]] as [Caller, Partial<JoinDeps>][]) {
    const d = deps(over);
    const r = await handleJoin({ session_no: 9 }, who, d);
    assertEquals(r.status, 403, who.user.id); assertEquals(err(r), "not_allowed", who.user.id);
    assertEquals(participantPosts(d).length, 0, who.user.id);
    assertEquals(d.touched.includes("roomMeetingIds"), true, who.user.id);
  }
});

Deno.test("bad session_no → 400 bad_session; unknown session → 404 not_found", async () => {
  assertEquals(err(await handleJoin({}, COORD, deps())), "bad_session");
  assertEquals((await handleJoin({}, COORD, deps())).status, 400);
  assertEquals((await handleJoin({ session_no: 1.5 }, COORD, deps())).status, 400);
  assertEquals((await handleJoin({ session_no: "7" as unknown as number }, COORD, deps())).status, 200);   /* the page sends a number; a numeric string still parses, as today */
  const gone = await handleJoin({ session_no: 99 }, COORD, deps());
  assertEquals(gone.status, 404); assertEquals(err(gone), "not_found");
});

Deno.test("the name is ea_profiles.display_name, else the email prefix, else 'Member', cut to 60", async () => {
  const named = await handleJoin({ session_no: 7 }, COORD, deps({ displayName: async () => "Nelson Taylor" }));
  assertEquals((named.body as { name: string }).name, "Nelson Taylor");
  const long = await handleJoin({ session_no: 7 }, COORD, deps({ displayName: async () => "x".repeat(70) }));
  assertEquals((long.body as { name: string }).name.length, 60);
  const noEmail = await handleJoin({ session_no: 7 }, { ...COORD, user: { id: "u-coord", email: null } }, deps());
  assertEquals((noEmail.body as { name: string }).name, "Member");
});

Deno.test("Cloudflare failures surface as 502 cloudflare_<status>", async () => {
  const p = await handleJoin({ session_no: 7 }, COORD, deps({ cf: async () => ({ ok: false, status: 403, data: {} }) }));
  assertEquals(p.status, 502); assertEquals(err(p), "cloudflare_403");
  const m = await handleJoin({ session_no: 8 }, COORD, deps({ cf: async () => ({ ok: false, status: 500, data: {} }) }));
  assertEquals(m.status, 502); assertEquals(err(m), "cloudflare_500");
  const noId = await handleJoin({ session_no: 8 }, COORD, deps({ cf: async () => ({ ok: true, status: 200, data: {} }) }));
  assertEquals(noId.status, 502); assertEquals(err(noId), "cloudflare_no_id");
});

Deno.test("the OPIL branch never touches the room plumbing except the room-meeting check (and, for a host, its own preset check)", async () => {
  const d = deps();
  await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(d.touched, ["getSession", "roomMeetingIds", "ensureOpilPresets", "displayName", "cf"]);
  const s = deps({ inCohort: async () => true });
  await handleJoin({ session_no: 7 }, STUDENT, s);
  assertEquals(s.touched, ["inCohort", "getSession", "roomMeetingIds", "displayName", "cf"]);
});

Deno.test("body.room === true never enters the OPIL path", async () => {
  const d = deps();   /* getRoom → null: the room branch stops at 503 before any OPIL dep is reached */
  const r = await handleJoin({ room: true, key: "k".repeat(22) }, COORD, d);
  assertEquals(r.status, 503); assertEquals(err(r), "rtk_not_configured");
  assertEquals(d.touched, ["rateCheck", "rateCheck", "getRoom"]); assertEquals(d.calls.length, 0);
});

/* ───────────── the room branch (body.room === true) — Academy room, Task 4 ───────────── */
import type { RoomRow } from "./handler.ts";

/* Nelson is ea_is_admin() on the Academy and NOT an OPIL coordinator: the room keys on academyAdmin alone */
const NELSON = { user: { id: "u-nelson", email: "nelson@x" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: true, ip: "9.9.9.9" };
const PERSON = { user: { id: "u-guest", email: "sam@example.com" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: false, ip: "5.5.5.5" };
const KEY = "AbCdEfGhIjKlMnOpQrStUv";          /* 22 chars of [A-Za-z0-9_-], what ea_room_new_key() mints */
const WRONG = "ZzZzZzZzZzZzZzZzZzZzZz";
const NOW = new Date("2026-09-14T20:00:00Z");   /* 15:00 in Chicago */
const LIVE_ROOM: RoomRow = { id: "room-1", slug: "academy", title: "Taylormade Academy Live", host_name: "Nelson Taylor", host_emails: [], host_preset: "tma-class-host", guest_preset: "tma-class-guest", link_key: KEY, is_live: true, live_since: "2026-09-14T19:30:00Z", meeting_id: "meet-live", max_participants: 50 };
const OFF_ROOM = { ...LIVE_ROOM, is_live: false, live_since: "2026-09-13T19:00:00Z", meeting_id: "meet-old" };
const STALE_ROOM = { ...LIVE_ROOM, live_since: "2026-09-14T15:00:00Z" };   /* 5 h ago: the tab died, the row still says live */

function roomDeps(over: Partial<JoinDeps> = {}, room: RoomRow = LIVE_ROOM) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const meetingSet: [string, string][] = [];
  const members: [string, string][] = [];
  const rates: string[] = [];
  let presets = 0;
  const d: JoinDeps & { calls: typeof calls; meetingSet: typeof meetingSet; members: typeof members; rates: typeof rates; presets: () => number } = {
    calls, meetingSet, members, rates, presets: () => presets,
    cf: async (method, path, body) => {
      calls.push({ method, path, body });
      if (method === "GET" && path.endsWith("/active-session")) return { ok: false, status: 404, data: {} };
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      if (method === "POST" && path.endsWith("/participants")) return { ok: true, status: 200, data: { token: "tok-1" } };
      return { ok: true, status: 200, data: {} };
    },
    rateCheck: async (key) => { rates.push(key); return true; },
    getSession: async () => null,
    inCohort: async () => false,
    isMember: async () => false,
    getRoom: async () => room,
    setRoomMeeting: async (roomId, meetingId) => { meetingSet.push([roomId, meetingId]); },
    roomMeetingIds: async () => new Set<string>(),
    upsertMember: async (roomId, userId) => { members.push([roomId, userId]); },
    displayName: async (id) => (id === "u-nelson" ? "Nelson Taylor" : null),
    ensurePresets: async () => { presets++; },
    ensureOpilPresets: async () => {},
    now: () => NOW,
    ...over,
  };
  return d;
}
const paths = (d: { calls: { method: string; path: string }[] }) => d.calls.map((c) => c.method + " " + c.path);

Deno.test("room: a person with the right key while live gets a guest token and never the meeting id", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true, key: KEY }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-1", preset: "tma-class-guest", host: false, name: "sam" });
  assertEquals("meeting_id" in (r.body as Record<string, unknown>), false);
  assertEquals(paths(d), ["GET /meetings/meet-live/active-session", "POST /meetings/meet-live/participants"]);
  assertEquals(d.calls[1].body, { custom_participant_id: "u-guest", preset_name: "tma-class-guest", name: "sam" });
  assertEquals(d.members, [["room-1", "u-guest"]]);
  assertEquals(d.presets(), 0);
});

Deno.test("room: the wrong key → 404 bad_link; no key and not a member → 403 not_allowed; a malformed key is also a dead link, not \"no key\"", async () => {
  const wrong = await handleJoin({ room: true, key: WRONG }, PERSON, roomDeps());
  assertEquals(wrong.status, 404); assertEquals(wrong.body, { error: "bad_link" });
  const none = await handleJoin({ room: true }, PERSON, roomDeps());
  assertEquals(none.status, 403); assertEquals(none.body, { error: "not_allowed" });
  const d = roomDeps();
  const short = await handleJoin({ room: true, key: "short" }, PERSON, d);
  assertEquals(short.status, 404); assertEquals(short.body, { error: "bad_link" });
  assertEquals(d.calls.length, 0);   /* refused before any Cloudflare call */
  const wrongCalls = roomDeps();
  await handleJoin({ room: true, key: WRONG }, PERSON, wrongCalls);
  assertEquals(wrongCalls.calls.length, 0);   /* refused before any Cloudflare call */
});

Deno.test("room: a member without a key is in; a member with a stale OR malformed key is in too", async () => {
  const d = roomDeps({ isMember: async () => true });
  const r = await handleJoin({ room: true }, PERSON, d);
  assertEquals(r.status, 200); assertEquals((r.body as { preset: string }).preset, "tma-class-guest");
  const stale = await handleJoin({ room: true, key: WRONG }, PERSON, roomDeps({ isMember: async () => true }));
  assertEquals(stale.status, 200);
  const malformed = await handleJoin({ room: true, key: "short" }, PERSON, roomDeps({ isMember: async () => true }));
  assertEquals(malformed.status, 200); assertEquals((malformed.body as { preset: string }).preset, "tma-class-guest");
});

Deno.test("room: a person while off air → 409 not_open; when live_since is 5 h old → 409 not_open", async () => {
  const off = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, OFF_ROOM));
  assertEquals(off.status, 409); assertEquals(off.body, { error: "not_open" });
  const stale = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, STALE_ROOM));
  assertEquals(stale.status, 409); assertEquals(stale.body, { error: "not_open" });
  const noMeeting = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps({}, { ...LIVE_ROOM, meeting_id: null }));
  assertEquals(noMeeting.status, 409); assertEquals(noMeeting.body, { error: "not_open" });
});

Deno.test("room: Nelson off air → a fresh meeting; the row goes live only AFTER his participant POST, then the previous meeting is set INACTIVE", async () => {
  const seq: string[] = [];
  const d = roomDeps({}, OFF_ROOM);
  const cf = d.cf, set = d.setRoomMeeting, up = d.upsertMember, pre = d.ensurePresets;
  d.cf = async (m, path, body) => { seq.push(m + " " + path); return cf(m, path, body); };
  d.setRoomMeeting = async (a, b) => { seq.push("setRoomMeeting"); return set(a, b); };
  d.upsertMember = async (a, b) => { seq.push("upsertMember"); return up(a, b); };
  d.ensurePresets = async (h, g) => { seq.push("ensurePresets"); return pre(h, g); };
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-1", meeting_id: "meet-new", preset: "tma-class-host", host: true, name: "Nelson Taylor" });
  assertEquals(seq, ["POST /meetings", "ensurePresets", "POST /meetings/meet-new/participants", "setRoomMeeting", "PATCH /meetings/meet-old", "upsertMember"]);
  assertEquals(d.calls[0].body, { title: "Academy · Taylormade Academy Live · 2026-09-14", persist_chat: false });
  assertEquals(d.calls[2].body, { status: "INACTIVE" });
  assertEquals(d.meetingSet, [["room-1", "meet-new"]]);
  assertEquals(d.members, [["room-1", "u-nelson"]]);
  assertEquals(d.presets(), 1);
});

Deno.test("room: Cloudflare refusing Nelson's participant → 502 and the row stays OFF AIR (no setRoomMeeting, no INACTIVE, no member row)", async () => {
  const d = roomDeps({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      if (method === "POST" && path.endsWith("/participants")) return { ok: false, status: 502, data: {} };
      return { ok: true, status: 200, data: {} };
    },
  }, OFF_ROOM);
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 502); assertEquals(r.body, { error: "cloudflare_502" });
  assertEquals(paths(d), ["POST /meetings", "POST /meetings/meet-new/participants"]);
  assertEquals(d.meetingSet, []); assertEquals(d.members, []);
});

Deno.test("room: Nelson while live (reload, second device) reuses the meeting — no POST /meetings, no cap check", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-live");
  assertEquals(paths(d), ["POST /meetings/meet-live/participants"]);
  assertEquals(d.meetingSet, []);
  assertEquals(d.presets(), 1);
});

/* console.warn captured for the tests that pin a log line (T10 greps the function logs for these) */
async function withWarn(fn: () => Promise<void>): Promise<string[]> {
  const orig = console.warn, lines: string[] = [];
  console.warn = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  try { await fn(); } finally { console.warn = orig; }
  return lines;
}

Deno.test("room: Nelson on a stale live row (5 h) starts a fresh meeting like off air; a failed INACTIVE is ignored but LOGGED", async () => {
  const d = roomDeps({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (method === "PATCH") return { ok: false, status: 500, data: {} };
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      return { ok: true, status: 200, data: { token: "tok-1" } };
    },
  }, STALE_ROOM);
  let r: Awaited<ReturnType<typeof handleJoin>> | null = null;
  const warned = await withWarn(async () => { r = await handleJoin({ room: true }, NELSON, d); });
  assertEquals(r!.status, 200);
  assertEquals(paths(d), ["POST /meetings", "POST /meetings/meet-new/participants", "PATCH /meetings/meet-live"]);
  assertEquals(d.meetingSet, [["room-1", "meet-new"]]);
  assertEquals(warned, ["[ea-rtk-join] previous meeting not inactivated meet-live 500"]);
  /* a PATCH that throws (network) is the same: caught, logged with status 0, the join still succeeds */
  const t = roomDeps({
    cf: async (method, path, body) => {
      t.calls.push({ method, path, body });
      if (method === "PATCH") throw new Error("socket hang up");
      if (method === "POST" && path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new" } };
      return { ok: true, status: 200, data: { token: "tok-1" } };
    },
  }, STALE_ROOM);
  const warned2 = await withWarn(async () => { assertEquals((await handleJoin({ room: true }, NELSON, t)).status, 200); });
  assertEquals(warned2, ["[ea-rtk-join] previous meeting not inactivated meet-live 0"]);
  /* and a clean INACTIVE logs nothing */
  const clean = await withWarn(async () => { assertEquals((await handleJoin({ room: true }, NELSON, roomDeps({}, OFF_ROOM))).status, 200); });
  assertEquals(clean, []);
});

Deno.test("room: a failed ea_room_members write is logged and never costs the person the token", async () => {
  const d = roomDeps({ upsertMember: async () => { throw new Error("db down"); } });
  let r: Awaited<ReturnType<typeof handleJoin>> | null = null;
  const warned = await withWarn(async () => { r = await handleJoin({ room: true, key: KEY }, PERSON, d); });
  assertEquals(r!.status, 200);
  assertEquals((r!.body as { token: string }).token, "tok-1");
  assertEquals(warned, ["[ea-rtk-join] upsertMember room-1 u-guest Error: db down"]);
});

Deno.test("room: Cloudflare refusing the meeting → 502 cloudflare_<status>, nothing saved", async () => {
  const d = roomDeps({ cf: async (method, path, body) => { d.calls.push({ method, path, body }); return { ok: false, status: 429, data: {} }; } }, OFF_ROOM);
  const r = await handleJoin({ room: true }, NELSON, d);
  assertEquals(r.status, 502); assertEquals(r.body, { error: "cloudflare_429" });
  assertEquals(d.meetingSet, []); assertEquals(d.members, []);
});

Deno.test("room: the cap — 50 in with max 50 → 429 room_full; 404 from active-session means nobody yet", async () => {
  const full = roomDeps({ cf: async (method, path, body) => { full.calls.push({ method, path, body }); return path.endsWith("/active-session") ? { ok: true, status: 200, data: { live_participants: 50 } } : { ok: true, status: 200, data: { token: "tok-1" } }; } });
  const r = await handleJoin({ room: true, key: KEY }, PERSON, full);
  assertEquals(r.status, 429); assertEquals(r.body, { error: "room_full" });
  assertEquals(paths(full), ["GET /meetings/meet-live/active-session"]);
  assertEquals(full.members, []);
  const room = await handleJoin({ room: true, key: KEY }, PERSON, roomDeps());   /* default fake: 404 */
  assertEquals(room.status, 200);
  const under = roomDeps({ cf: async (method, path, body) => { under.calls.push({ method, path, body }); return path.endsWith("/active-session") ? { ok: true, status: 200, data: { live_participants: 49 } } : { ok: true, status: 200, data: { token: "tok-1" } }; } });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, under)).status, 200);
});

Deno.test("room: the cap fails OPEN on a Cloudflare error (503 from active-session → admitted) and says so in the logs; a 404 logs nothing", async () => {
  const blip = roomDeps({ cf: async (method, path, body) => { blip.calls.push({ method, path, body }); return path.endsWith("/active-session") ? { ok: false, status: 503, data: {} } : { ok: true, status: 200, data: { token: "tok-1" } }; } }, { ...LIVE_ROOM, max_participants: 2 });
  let r: Awaited<ReturnType<typeof handleJoin>> | null = null;
  const warned = await withWarn(async () => { r = await handleJoin({ room: true, key: KEY }, PERSON, blip); });
  assertEquals(r!.status, 200);
  assertEquals(paths(blip), ["GET /meetings/meet-live/active-session", "POST /meetings/meet-live/participants"]);
  assertEquals(warned, ["[ea-rtk-join] active-session 503 — cap not enforced this join"]);
  const quiet = await withWarn(async () => { assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, roomDeps())).status, 200); });
  assertEquals(quiet, []);
});

Deno.test("room: rate limit — false → 429 slow_down before any Cloudflare call; null (limiter down) → allowed", async () => {
  const d = roomDeps({ rateCheck: async (key) => { d.rates.push(key); return key.startsWith("rtk-join:u:") ? false : true; } });
  const r = await handleJoin({ room: true, key: KEY }, PERSON, d);
  assertEquals(r.status, 429); assertEquals(r.body, { error: "slow_down" });
  assertEquals(d.calls.length, 0);
  const ip = roomDeps({ rateCheck: async (key) => key.startsWith("rtk-join:ip:") ? false : true });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, ip)).status, 429);
  const down = roomDeps({ rateCheck: async () => null });
  assertEquals((await handleJoin({ room: true, key: KEY }, PERSON, down)).status, 200);
  const keys = roomDeps();
  await handleJoin({ room: true, key: KEY }, PERSON, keys);
  assertEquals(keys.rates, ["rtk-join:u:u-guest", "rtk-join:ip:5.5.5.5"]);
});

Deno.test("room: a client-supplied meeting_id in a room body is ignored", async () => {
  const d = roomDeps();
  const r = await handleJoin({ room: true, key: KEY, meeting_id: "meet-evil" }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals(paths(d), ["GET /meetings/meet-live/active-session", "POST /meetings/meet-live/participants"]);
  const h = roomDeps();
  await handleJoin({ room: true, meeting_id: "meet-evil" }, NELSON, h);
  assertEquals(paths(h), ["POST /meetings/meet-live/participants"]);
});

Deno.test("room: no room row → 503 rtk_not_configured; a long title is cut at 80 for Cloudflare", async () => {
  const none = await handleJoin({ room: true }, NELSON, roomDeps({ getRoom: async () => null }));
  assertEquals(none.status, 503); assertEquals(none.body, { error: "rtk_not_configured" });
  const d = roomDeps({}, { ...OFF_ROOM, title: "T".repeat(100) });
  await handleJoin({ room: true }, NELSON, d);
  const title = String((d.calls[0].body as { title: string }).title);
  assertEquals(title.length, 80);
  assertEquals(title, "Academy · " + "T".repeat(57) + " · 2026-09-14");   /* the title is cut, never the date */
});

/* ───────────── another institution's room, by slug (Task 8) — HT ───────────── */

const htRow = (over: Partial<RoomRow> = {}): RoomRow => ({
  id: "r-ht", slug: "ht", title: "HT Live", host_name: "Dr. Gray", host_emails: ["dgray@htu.edu"],
  host_preset: "ht-class-host", guest_preset: "ht-class-guest", link_key: "AbC123_-xyzXYZ0987ab-_",
  is_live: true, live_since: NOW.toISOString(), meeting_id: "m-ht", max_participants: 50, ...over,
});
const HT_HOST = { user: { id: "u-gray", email: "DGray@HTU.edu" }, role: { admin: false, judge: false, facilitator_sessions: [] }, academyAdmin: false, ip: "8.8.8.8" };

Deno.test("room:'ht' — a listed email is the host and gets ht-class-host", async () => {
  const calls: string[] = [];
  const d = roomDeps({ ensurePresets: async (h, g) => { calls.push("presets:" + h + "," + g); } }, htRow({ is_live: false, meeting_id: null }));
  const r = await handleJoin({ room: "ht" }, HT_HOST, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { preset: string }).preset, "ht-class-host");
  assertEquals((r.body as { host: boolean }).host, true);
  assertEquals(calls, ["presets:ht-class-host,ht-class-guest"]);
});

/* nobody ends a class by accident (9/15): a host who left, dropped, reloaded or opened a second tab comes back into
   the SAME meeting — while the row is live the join never creates one, for any room, for a guest either */
Deno.test("room:'ht' — the host while live (Rejoin, reload, second tab) gets the SAME meeting id — no POST /meetings, no row write, no INACTIVE", async () => {
  const d = roomDeps({}, htRow());
  const r = await handleJoin({ room: "ht" }, HT_HOST, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "m-ht");
  assertEquals((r.body as { host: boolean }).host, true);
  assertEquals(paths(d), ["POST /meetings/m-ht/participants"]);
  assertEquals(d.meetingSet, []);
  /* a second join a minute later — the same again */
  const again = await handleJoin({ room: "ht" }, HT_HOST, roomDeps({ now: () => new Date(NOW.getTime() + 60000) }, htRow()));
  assertEquals((again.body as { meeting_id: string }).meeting_id, "m-ht");
  /* and a guest rejoining after a drop lands in that meeting too */
  const g = roomDeps({}, htRow());
  const gr = await handleJoin({ room: "ht", key: "AbC123_-xyzXYZ0987ab-_" }, PERSON, g);
  assertEquals(gr.status, 200);
  assertEquals(paths(g), ["GET /meetings/m-ht/active-session", "POST /meetings/m-ht/participants"]);
});

Deno.test("OPIL — a host rejoining a live session gets the stored meeting, never a new one", async () => {
  const d = deps();
  for (const who of [COORD, FAC7]) {
    const r = await handleJoin({ session_no: 7 }, who, d);
    assertEquals(r.status, 200);
    assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-7");
  }
  assertEquals(d.calls.filter((c) => c.method === "POST" && c.path === "/meetings").length, 0);
});

Deno.test("room:'ht' — an Academy member without the key is refused (membership opens the Academy room only)", async () => {
  const d = roomDeps({ isMember: async () => true }, htRow());
  const r = await handleJoin({ room: "ht" }, PERSON, d);
  assertEquals(r.status, 403); assertEquals(r.body, { error: "not_allowed" });
});

/* 0038 — the open door: on an open_door room any signed-in account walks in while the class runs;
   a wrong key is not a dead link there; the Academy room (open_door false) is unchanged */
Deno.test("room:'ht' open_door — a signed-in stranger with NO key is admitted as ht-class-guest", async () => {
  const d = roomDeps({}, htRow({ open_door: true }));
  const r = await handleJoin({ room: "ht" }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { preset: string }).preset, "ht-class-guest");
  assertEquals((r.body as { meeting_id?: string }).meeting_id, undefined);
});
Deno.test("room:'ht' open_door — a wrong key still gets in (the key is not the gate)", async () => {
  const d = roomDeps({}, htRow({ open_door: true }));
  const r = await handleJoin({ room: "ht", key: "ZZZZZZZZZZZZZZZZZZZZZZ" }, PERSON, d);
  assertEquals(r.status, 200);
});
Deno.test("room:'ht' open_door — still refused while the class is not running (not_open)", async () => {
  const d = roomDeps({}, htRow({ open_door: true, is_live: false, meeting_id: null }));
  const r = await handleJoin({ room: "ht" }, PERSON, d);
  assertEquals(r.status, 409); assertEquals(r.body, { error: "not_open" });
});
Deno.test("room:'ht' with open_door false — a stranger without the key is still refused", async () => {
  const d = roomDeps({}, htRow({ open_door: false }));
  const r = await handleJoin({ room: "ht" }, PERSON, d);
  assertEquals(r.status, 403); assertEquals(r.body, { error: "not_allowed" });
});

Deno.test("room:'ht' — the key admits a guest with ht-class-guest and no meeting id", async () => {
  const d = roomDeps({}, htRow());
  const r = await handleJoin({ room: "ht", key: "AbC123_-xyzXYZ0987ab-_" }, PERSON, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { preset: string }).preset, "ht-class-guest");
  assertEquals((r.body as { meeting_id?: string }).meeting_id, undefined);
});

Deno.test("room:true still means the Academy room", async () => {
  const seen: string[] = [];
  const d = deps({ getRoom: async (s) => { seen.push(s as string); return null; } });
  await handleJoin({ room: true }, COORD, d);
  assertEquals(seen, ["academy"]);
});

Deno.test("room:'Bad Slug!' is a 400", async () => {
  const r = await handleJoin({ room: "Bad Slug!" }, COORD, deps());
  assertEquals(r.status, 400);
});
