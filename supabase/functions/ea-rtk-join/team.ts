// ea-rtk-join — the team branch (spec 2026-09-16-class-features-design.md §3): a team's standing room.
// Body { team: <uuid> }. Pure: no network, no env, no supabase — index.ts injects `deps`,
// team_test.ts stubs them. index.ts routes here BEFORE handleJoin when body.team is present.
//
//   who may enter     a member of that team (deps.isMember, service role) or the program team
//                     (coordinator / judge / facilitator — the same three ea_opil_is_program_team
//                     names) or the Academy admin. Everyone else: 403 not_allowed, no Cloudflare call.
//   the meeting       ea_opil_teams.meeting_id. The FIRST person in mints it (POST /meetings, title
//                     "Team <name>", persist_chat: true — the kit chat survives between visits) and
//                     stores it with room_open_since; everyone after reuses it. Two teammates who
//                     walk into an empty room in the same second both mint, but only ONE write
//                     lands: deps.setTeamMeeting is conditional (meeting_id is null / still the old
//                     id) and answers with the id the row holds now, so the loser joins the
//                     winner's meeting and the team is never split. A stored meeting Cloudflare no
//                     longer knows — a 4xx on the participant call AND a GET /meetings/{id} that
//                     says 404 or INACTIVE — is replaced once, so a team is never locked out of its
//                     own room by a dead id; any other 4xx is a 502 and the stored id stays.
//   the preset        opil-student for every entrant — every tool, nobody is the host. host:false.
//   the reply         { token, meeting_id, preset, host: false, name }. meeting_id is handed back
//                     because the room's rtk-room-v2 branch reads it like the OPIL path does.
import type { Caller, CfResult, Reply } from "./handler.ts";

export type TeamBody = { team?: unknown };
export type TeamRow = { id: string; name: string | null; meeting_id: string | null; room_open_since: string | null; is_staff?: boolean | null };
export type TeamDeps = {
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;   /* null = limiter unavailable → allowed */
  getTeam: (teamId: string) => Promise<TeamRow | null>;                  /* service role */
  isMember: (teamId: string) => Promise<boolean>;                         /* this caller sits in ea_opil_team_members for that team */
  roomMeetingIds: (meetingId: string) => Promise<Set<string>>;            /* exact meeting lookup; any room meeting is never a team meeting */
  /* store meeting_id + room_open_since = now() ONLY IF the row still holds expectPrev (null = no meeting yet);
     answers with the id the row holds after the call — ours when the write landed, the other person's when
     they got there first (index.ts re-reads the row on a no-row update). Service role. */
  setTeamMeeting: (teamId: string, meetingId: string, expectPrev: string | null) => Promise<string | null>;
  displayName: (userId: string) => Promise<string | null>;
  ensureOpilPresets?: () => Promise<void>;   /* opil-student must exist on Cloudflare before the first participant; cached, never throws */
  now: () => Date;
};

export const TEAM_PRESET = "opil-student";
export const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* a participant call with one of these makes us ASK whether the stored meeting is gone (never a 5xx: a
   Cloudflare blip is not a dead room); the answer is GET /meetings/{id} — 404, or a status of INACTIVE */
export const DEAD_MEETING_STATUSES = [400, 404, 409, 410] as const;
export function meetingIsGone(got: CfResult): boolean {
  if (!got.ok) return got.status === 404;
  const st = String(((got.data || {}) as Record<string, unknown>).status || "").toUpperCase();
  return st === "INACTIVE";
}

/* "Team The Rattlers" — unless the team already calls itself Team Something (mirrors js/rtk-teamroom-words.js) */
export function teamTitle(name: unknown): string {
  const n = String(name ?? "").trim();
  if (!n) return "Team room";
  return /^team\b/i.test(n) ? n : "Team " + n;
}

/* the program team, as ea_opil_is_program_team counts it: coordinator, judge, or a facilitator of any session */
export function isProgramTeam(role: Caller["role"]): boolean {
  return role.admin === true || role.judge === true || (Array.isArray(role.facilitator_sessions) && role.facilitator_sessions.length > 0);
}

export async function handleTeamJoin(body: TeamBody, ctx: Caller, deps: TeamDeps): Promise<Reply> {
  const teamId = typeof body.team === "string" && UUID_RX.test(body.team) ? body.team.toLowerCase() : null;
  if (!teamId) return { status: 400, body: { error: "bad_team" } };
  const uid = ctx.user.id;
  /* 1 — rate limit, fail-open, the same budget as every other join */
  if ((await deps.rateCheck("rtk-join:u:" + uid, 30, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  if ((await deps.rateCheck("rtk-join:ip:" + ctx.ip, 90, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  /* 2 — the team */
  const team = await deps.getTeam(teamId);
  if (!team) return { status: 404, body: { error: "not_found" } };
  /* 3 — a member, or the program team; the cheap answers first, the membership read only when they say no */
  const allowed = isProgramTeam(ctx.role) || ctx.academyAdmin === true || (await deps.isMember(teamId));
  if (!allowed) return { status: 403, body: { error: "not_allowed" } };
  /* 4 — the meeting: stored, or minted now by whoever is first. The store is conditional on what the
     row held when we read it; when someone else stored first, theirs is the team's room and ours is
     left unused (an empty meeting costs nothing and one more Cloudflare call here could fail the join). */
  const mint = async (expectPrev: string | null): Promise<Reply | string> => {
    const made = await deps.cf("POST", "/meetings", { title: teamTitle(team.name).slice(0, 80), persist_chat: true });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    const id = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!id) return { status: 502, body: { error: "cloudflare_no_id" } };
    if (deps.ensureOpilPresets) await deps.ensureOpilPresets();
    const stored = await deps.setTeamMeeting(teamId, id, expectPrev);
    if (stored && stored !== id) console.warn("[ea-rtk-join] team meeting minted twice; joining the stored one", teamId, id, stored);
    return stored || id;
  };
  let meetingId: string | null = typeof team.meeting_id === "string" && team.meeting_id ? team.meeting_id : null;
  let fresh = false;
  if (!meetingId) { const r = await mint(null); if (typeof r !== "string") return r; meetingId = r; fresh = true; }
  /* A team row, including a concurrent store's winning value, cannot grant entry to a
     protected classroom. Recheck the exact target before each participant token request. */
  const isolationError = async (): Promise<Reply | null> => {
    try { return (await deps.roomMeetingIds(meetingId!)).has(meetingId!) ? { status: 403, body: { error: "not_allowed" } } : null; }
    catch { return { status: 503, body: { error: "classroom_unavailable" } }; }
  };
  let denied = await isolationError();
  if (denied) return denied;
  /* 5 — one participant per person; custom_participant_id is the Supabase uid, never an email */
  const name = String((await deps.displayName(uid)) || (ctx.user.email || "Teammate").split("@")[0]).slice(0, 60);
  const add = () => deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: uid, preset_name: TEAM_PRESET, name });
  let added = await add();
  /* a stored meeting Cloudflare no longer has: confirm it is really gone (a 400/409 for any other reason —
     a preset missing, a bad name — must not throw away the team's chat history), replace it once, try again */
  if (!added.ok && !fresh && (DEAD_MEETING_STATUSES as readonly number[]).includes(added.status)) {
    const got = await deps.cf("GET", `/meetings/${meetingId}`);
    if (!meetingIsGone(got)) return { status: 502, body: { error: "cloudflare_" + added.status } };
    console.warn("[ea-rtk-join] team meeting gone, minting a new one", teamId, meetingId, added.status);
    const r = await mint(meetingId); if (typeof r !== "string") return r; meetingId = r; fresh = true;
    denied = await isolationError();
    if (denied) return denied;
    added = await add();
  }
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;
  return { status: 200, body: { token, meeting_id: meetingId, preset: TEAM_PRESET, host: false, name } };
}
