// deno test supabase/functions/ea-rtk-join/team_test.ts
// The team branch: who gets into a team's standing room, who mints its meeting, what comes back.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Caller } from "./handler.ts";
import { DEAD_MEETING_STATUSES, handleTeamJoin, isProgramTeam, meetingIsGone, TEAM_PRESET, type TeamDeps, teamTitle } from "./team.ts";

const base = { academyAdmin: false, ip: "203.0.113.9" };
const MEMBER: Caller = { ...base, user: { id: "u-mem", email: "kiara@famu.edu" }, role: { admin: false, judge: false, facilitator_sessions: [] } };
const STRANGER: Caller = { ...base, user: { id: "u-str", email: "who@x" }, role: { admin: false, judge: false, facilitator_sessions: [] } };
const COORD: Caller = { ...base, user: { id: "u-coord", email: "jamal@auc" }, role: { admin: true, judge: false, facilitator_sessions: [] } };
const JUDGE: Caller = { ...base, user: { id: "u-judge", email: "judge@x" }, role: { admin: false, judge: true, facilitator_sessions: [] } };
const FAC: Caller = { ...base, user: { id: "u-fac", email: "fac@x" }, role: { admin: false, judge: false, facilitator_sessions: [3] } };
const NELSON: Caller = { ...base, academyAdmin: true, user: { id: "u-nelson", email: "n@x" }, role: { admin: false, judge: false, facilitator_sessions: [] } };
const T_NEW = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";   /* no meeting yet */
const T_OLD = "2c5f39cb-3fb2-22e3-994f-1127e4ddb538";   /* meeting stored */
const T_TEAM = "3d6a4adc-4ac3-33f4-aa5a-2238f5eec649";  /* already named "Team Aeero" */

function deps(over: Partial<TeamDeps> = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const stored: { teamId: string; meetingId: string; expectPrev: string | null }[] = [];
  const touched: string[] = [];
  let mints = 0;
  const raw: TeamDeps = {
    cf: async (method, path, body) => {
      calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-new-" + (++mints) } };
      if (method === "GET") return { ok: true, status: 200, data: { id: path.split("/")[2], status: "ACTIVE" } };
      return { ok: true, status: 200, data: { token: "tok-" + path.split("/")[2] } };
    },
    rateCheck: async () => true,
    getTeam: async (id) =>
      id === T_NEW ? { id, name: "The Rattlers", meeting_id: null, room_open_since: null }
      : id === T_OLD ? { id, name: "Tech Mongers", meeting_id: "meet-old", room_open_since: "2026-09-10T20:00:00Z" }
      : id === T_TEAM ? { id, name: "Team Aeero", meeting_id: null, room_open_since: null }
      : null,
    isMember: async (id) => id !== "nope" && false,
    roomMeetingIds: async () => new Set(),
    setTeamMeeting: async (teamId, meetingId, expectPrev) => { stored.push({ teamId, meetingId, expectPrev }); return meetingId; },
    displayName: async () => null,
    ensureOpilPresets: async () => {},
    now: () => new Date("2026-09-16T19:05:00-05:00"),
    ...over,
  };
  const d = { calls, stored, touched } as TeamDeps & { calls: typeof calls; stored: typeof stored; touched: typeof touched };
  for (const k of Object.keys(raw) as (keyof TeamDeps)[]) {
    const fn = raw[k] as (...a: unknown[]) => unknown;
    (d as unknown as Record<string, unknown>)[k] = k === "now" ? fn : (...a: unknown[]) => { touched.push(k); return fn(...a); };
  }
  return d;
}
const member = (over: Partial<TeamDeps> = {}) => deps({ isMember: async (id) => id === T_NEW || id === T_OLD || id === T_TEAM, ...over });
const err = (r: { body: unknown }) => (r.body as { error: string }).error;
const participantPosts = (d: { calls: { method: string; path: string }[] }) => d.calls.filter((c) => c.method === "POST" && c.path.endsWith("/participants"));

Deno.test("team participant tokens never enter protected room meetings for any team or admin role", async () => {
  for (const who of [MEMBER, COORD, JUDGE, FAC, NELSON]) {
    const d = member({roomMeetingIds: async () => new Set(["meet-old"])});
    assertEquals((await handleTeamJoin({team:T_OLD},who,d)).status,403);
    assertEquals(d.calls,[]);
  }
});
Deno.test("team room isolation fails closed when the lookup throws or is missing", async () => {
  for (const lookup of [async () => {throw new Error("database unavailable");},undefined]) {
    const d = member();
    (d as unknown as {roomMeetingIds:unknown}).roomMeetingIds=lookup;
    assertEquals((await handleTeamJoin({team:T_OLD},MEMBER,d)).status,503);
    assertEquals(d.calls,[]);
  }
});
Deno.test("a new team meeting cannot use a protected concurrent-store winner", async () => {
  const lookedUp:string[]=[];
  const d = member({roomMeetingIds: async id => {lookedUp.push(id);return new Set(["protected"]);},setTeamMeeting:async()=>"protected"});
  assertEquals((await handleTeamJoin({team:T_NEW},MEMBER,d)).status,403);
  assertEquals(participantPosts(d),[]);assertEquals(lookedUp,["protected"]);
});
Deno.test("a replacement team meeting rechecks a protected concurrent-store winner before another token", async () => {
  const d = member({
    roomMeetingIds:async()=>new Set(["protected"]),setTeamMeeting:async()=>"protected",
    cf:async(method,path,body)=>{
      d.calls.push({method,path,body});
      if(path==="/meetings")return {ok:true,status:200,data:{id:"minted"}};
      return {ok:false,status:404,data:{}};
    },
  });
  assertEquals((await handleTeamJoin({team:T_OLD},MEMBER,d)).status,403);
  assertEquals(participantPosts(d).map(x=>x.path),["/meetings/meet-old/participants"]);
});

Deno.test("the constants the room relies on", () => {
  assertEquals(TEAM_PRESET, "opil-student");
  assertEquals([...DEAD_MEETING_STATUSES], [400, 404, 409, 410]);
});

Deno.test("teamTitle: Team <name>, never Team Team", () => {
  assertEquals(teamTitle("The Rattlers"), "Team The Rattlers");
  assertEquals(teamTitle("Team Aeero"), "Team Aeero");
  assertEquals(teamTitle("  TEAM KIMT "), "TEAM KIMT");
  assertEquals(teamTitle("Teamwork Inc"), "Team Teamwork Inc");   /* \b: "Teamwork" is not "Team" */
  assertEquals(teamTitle(""), "Team room");
  assertEquals(teamTitle(null), "Team room");
});

Deno.test("isProgramTeam is the three names ea_opil_is_program_team counts", () => {
  assertEquals(isProgramTeam(COORD.role), true);
  assertEquals(isProgramTeam(JUDGE.role), true);
  assertEquals(isProgramTeam(FAC.role), true);
  assertEquals(isProgramTeam(MEMBER.role), false);
});

Deno.test("a body without a real uuid is refused before anything is read", async () => {
  for (const team of [undefined, "", "1", "not-a-uuid", 42, { id: T_NEW }]) {
    const d = member();
    const r = await handleTeamJoin({ team: team as unknown }, MEMBER, d);
    assertEquals(r.status, 400); assertEquals(err(r), "bad_team");
    assertEquals(d.touched, []);
  }
});

Deno.test("a stranger is refused after the team is read, with no Cloudflare call and no membership write", async () => {
  const d = deps();
  const r = await handleTeamJoin({ team: T_OLD }, STRANGER, d);
  assertEquals(r.status, 403); assertEquals(err(r), "not_allowed");
  assertEquals(d.calls.length, 0);
  assertEquals(d.stored.length, 0);
  assertEquals(d.touched.includes("isMember"), true);
});

Deno.test("a team nobody has: 404 not_found", async () => {
  const r = await handleTeamJoin({ team: "9d6a4adc-4ac3-33f4-aa5a-2238f5eec649" }, MEMBER, member());
  assertEquals(r.status, 404); assertEquals(err(r), "not_found");
});

Deno.test("the first member in mints the meeting — Team <name>, chat kept — stores it, and joins as opil-student", async () => {
  const d = member();
  const r = await handleTeamJoin({ team: T_NEW }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-meet-new-1", meeting_id: "meet-new-1", preset: "opil-student", host: false, name: "kiara" });
  assertEquals(d.calls, [
    { method: "POST", path: "/meetings", body: { title: "Team The Rattlers", persist_chat: true } },
    { method: "POST", path: "/meetings/meet-new-1/participants", body: { custom_participant_id: "u-mem", preset_name: "opil-student", name: "kiara" } },
  ]);
  assertEquals(d.stored, [{ teamId: T_NEW, meetingId: "meet-new-1", expectPrev: null }]);   /* stored only while the row still says "no meeting" */
  assertEquals(d.touched.includes("ensureOpilPresets"), true);   /* the preset must exist before the first participant */
});

Deno.test("two teammates mint in the same second: the one whose store lost joins the OTHER one's meeting — the team is never split", async () => {
  const d = member({ setTeamMeeting: async (teamId, meetingId, expectPrev) => { d.stored.push({ teamId, meetingId, expectPrev }); return "meet-other"; } });
  const r = await handleTeamJoin({ team: T_NEW }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-other");
  assertEquals(participantPosts(d).map((c) => c.path), ["/meetings/meet-other/participants"]);
  assertEquals(d.calls.filter((c) => c.path === "/meetings").length, 1);   /* we minted once; the orphan is simply not used */
  assertEquals(d.calls.filter((c) => c.method === "PATCH").length, 0);
});

Deno.test("a store that answers nothing (an old index.ts) falls back to the id just minted", async () => {
  const d = member({ setTeamMeeting: async (teamId, meetingId, expectPrev) => { d.stored.push({ teamId, meetingId, expectPrev }); return null; } });
  const r = await handleTeamJoin({ team: T_NEW }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-new-1");
});

Deno.test("everyone after the first reuses the stored meeting — nothing is minted, nothing is stored", async () => {
  const d = member();
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-old");
  assertEquals(d.calls.map((c) => c.path), ["/meetings/meet-old/participants"]);
  assertEquals(d.stored, []);
  assertEquals(d.touched.includes("ensureOpilPresets"), false);
});

Deno.test("a team already called Team Something is not doubled", async () => {
  const d = member();
  await handleTeamJoin({ team: T_TEAM }, MEMBER, d);
  assertEquals(d.calls[0], { method: "POST", path: "/meetings", body: { title: "Team Aeero", persist_chat: true } });
});

Deno.test("the program team and the Academy admin enter any team's room without a membership read; still opil-student, still not host", async () => {
  for (const who of [COORD, JUDGE, FAC, NELSON]) {
    const d = deps();
    const r = await handleTeamJoin({ team: T_OLD }, who, d);
    assertEquals(r.status, 200, who.user.id);
    assertEquals((r.body as { preset: string }).preset, "opil-student");
    assertEquals((r.body as { host: boolean }).host, false);
    assertEquals(d.touched.includes("isMember"), false, who.user.id);
  }
});

Deno.test("a stored meeting Cloudflare no longer knows (participant 404, GET 404) is replaced once, and the person still gets in", async () => {
  const d = member({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-fresh" } };
      if (path === "/meetings/meet-old/participants") return { ok: false, status: 404, data: {} };
      if (method === "GET" && path === "/meetings/meet-old") return { ok: false, status: 404, data: {} };
      return { ok: true, status: 200, data: { token: "tok-fresh" } };
    },
  });
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals(r.body, { token: "tok-fresh", meeting_id: "meet-fresh", preset: "opil-student", host: false, name: "kiara" });
  assertEquals(d.calls.map((c) => c.method + " " + c.path), ["POST /meetings/meet-old/participants", "GET /meetings/meet-old", "POST /meetings", "POST /meetings/meet-fresh/participants"]);
  assertEquals(d.stored, [{ teamId: T_OLD, meetingId: "meet-fresh", expectPrev: "meet-old" }]);   /* replaced only while the row still holds the dead id */
});

Deno.test("a meeting Cloudflare reports INACTIVE is gone too", async () => {
  const d = member({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-fresh" } };
      if (path === "/meetings/meet-old/participants") return { ok: false, status: 400, data: {} };
      if (method === "GET") return { ok: true, status: 200, data: { id: "meet-old", status: "INACTIVE" } };
      return { ok: true, status: 200, data: { token: "tok-fresh" } };
    },
  });
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals((r.body as { meeting_id: string }).meeting_id, "meet-fresh");
});

Deno.test("a 400 on the participant call while the meeting is alive (GET 200 ACTIVE) is NOT a dead room: 502, nothing minted, nothing stored", async () => {
  const d = member({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (path === "/meetings/meet-old/participants") return { ok: false, status: 400, data: {} };
      if (method === "GET") return { ok: true, status: 200, data: { id: "meet-old", status: "ACTIVE" } };
      return { ok: true, status: 200, data: { id: "meet-fresh" } };
    },
  });
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, d);
  assertEquals(r.status, 502); assertEquals(err(r), "cloudflare_400");
  assertEquals(d.calls.filter((c) => c.path === "/meetings").length, 0);
  assertEquals(d.stored, []);
});

Deno.test("meetingIsGone reads the GET the way Cloudflare answers it", () => {
  assertEquals(meetingIsGone({ ok: false, status: 404, data: {} }), true);
  assertEquals(meetingIsGone({ ok: true, status: 200, data: { status: "INACTIVE" } }), true);
  assertEquals(meetingIsGone({ ok: true, status: 200, data: { status: "inactive" } }), true);
  assertEquals(meetingIsGone({ ok: true, status: 200, data: { status: "ACTIVE" } }), false);
  assertEquals(meetingIsGone({ ok: true, status: 200, data: {} }), false);   /* no status field: not proof it is gone */
  assertEquals(meetingIsGone({ ok: false, status: 500, data: {} }), false);   /* a blip on the GET is not a dead room */
  assertEquals(meetingIsGone({ ok: false, status: 403, data: {} }), false);
});

Deno.test("a Cloudflare blip (5xx) on the stored meeting is NOT a dead room: no re-mint, 502 to the page", async () => {
  const d = member({ cf: async (method, path, body) => { d.calls.push({ method, path, body }); return { ok: false, status: 503, data: {} }; } });
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, d);
  assertEquals(r.status, 502); assertEquals(err(r), "cloudflare_503");
  assertEquals(d.calls.length, 1);
  assertEquals(d.stored, []);
});

Deno.test("a fresh meeting whose participant call fails is not minted twice", async () => {
  const d = member({
    cf: async (method, path, body) => {
      d.calls.push({ method, path, body });
      if (path === "/meetings") return { ok: true, status: 200, data: { id: "meet-x" } };
      return { ok: false, status: 400, data: {} };
    },
  });
  const r = await handleTeamJoin({ team: T_NEW }, MEMBER, d);
  assertEquals(r.status, 502); assertEquals(err(r), "cloudflare_400");
  assertEquals(d.calls.filter((c) => c.path === "/meetings").length, 1);
});

Deno.test("minting fails: 502 with the status; nothing stored", async () => {
  const d = member({ cf: async () => ({ ok: false, status: 500, data: {} }) });
  const r = await handleTeamJoin({ team: T_NEW }, MEMBER, d);
  assertEquals(r.status, 502); assertEquals(err(r), "cloudflare_500");
  assertEquals(d.stored, []);
  const noId = member({ cf: async () => ({ ok: true, status: 200, data: {} }) });
  const r2 = await handleTeamJoin({ team: T_NEW }, MEMBER, noId);
  assertEquals(r2.status, 502); assertEquals(err(r2), "cloudflare_no_id");
});

Deno.test("rate limit: an explicit false is 429 before the team is read; null (limiter down) lets people in", async () => {
  const shut = member({ rateCheck: async () => false });
  const r = await handleTeamJoin({ team: T_OLD }, MEMBER, shut);
  assertEquals(r.status, 429); assertEquals(err(r), "slow_down");
  assertEquals(shut.touched.includes("getTeam"), false);
  const down = member({ rateCheck: async () => null });
  assertEquals((await handleTeamJoin({ team: T_OLD }, MEMBER, down)).status, 200);
});

Deno.test("the name: the profile's display name, else the email's front, else Teammate; never longer than 60", async () => {
  const named = await handleTeamJoin({ team: T_OLD }, MEMBER, member({ displayName: async () => "Kiara Pee" }));
  assertEquals((named.body as { name: string }).name, "Kiara Pee");
  const long = await handleTeamJoin({ team: T_OLD }, MEMBER, member({ displayName: async () => "x".repeat(90) }));
  assertEquals((long.body as { name: string }).name.length, 60);
  const noEmail: Caller = { ...MEMBER, user: { id: "u-mem", email: null } };
  const fallback = await handleTeamJoin({ team: T_OLD }, noEmail, member());
  assertEquals((fallback.body as { name: string }).name, "Teammate");
});

Deno.test("an upper-case uuid is the same team", async () => {
  const d = member();
  const r = await handleTeamJoin({ team: T_OLD.toUpperCase() }, MEMBER, d);
  assertEquals(r.status, 200);
  assertEquals(participantPosts(d).length, 1);
});
