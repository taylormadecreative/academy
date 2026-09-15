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
  assertEquals([...PRESETS], ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest"]);
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

Deno.test("the OPIL branch never touches the room plumbing except the room-meeting check", async () => {
  const d = deps();
  await handleJoin({ session_no: 7 }, COORD, d);
  assertEquals(d.touched, ["getSession", "roomMeetingIds", "displayName", "cf"]);
  const s = deps({ inCohort: async () => true });
  await handleJoin({ session_no: 7 }, STUDENT, s);
  assertEquals(s.touched, ["inCohort", "getSession", "roomMeetingIds", "displayName", "cf"]);
});

Deno.test("body.room === true answers 404 not_found and never enters the OPIL path", async () => {
  const d = deps();
  const r = await handleJoin({ room: true, key: "k".repeat(22) }, COORD, d);
  assertEquals(r.status, 404); assertEquals(err(r), "not_found");
  assertEquals(d.touched, []); assertEquals(d.calls.length, 0);
});
