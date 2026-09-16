// ea-rtk-join — the pure decisions behind "hand this signed-in person a token for the meeting".
// No network, no env, no supabase here: index.ts injects `deps`, handler_test.ts stubs them.
//
// OPIL branch (body.room is absent/false-ish) — the one-file function of 9/11–9/14, ported line
// for line, with two hardenings the critique of the Academy room asked for:
//   · a client-supplied meeting_id is IGNORED. The meeting is the session's stored "rtk:" id or
//     one a host creates here; a student on a session with no stored id gets 409 not_open.
//   · a session whose meeting is the Academy room's (ea_rooms.meeting_id, or any
//     ea_room_replays.meeting_id) is refused with 403 not_allowed before a participant is minted.
//   coordinator (role.admin) or facilitator of this session  -> opil-host
//   judge (role.judge)                                       -> opil-judge   (every tool too, since 9/15)
//   cohort member (ea_opil_in_cohort)                        -> opil-student
//   anyone else                                              -> 403 not_allowed
//
// Room branch (body.room === true, or a slug string): one room per slug — the Academy room
// (`body.room === true` is shorthand for slug "academy") or another institution's room (HT: "ht").
// joinRoom, at the end of this file, resolves the row by slug and decides the rest: host = the
// Academy admin OR an email listed on that room's row (row.host_emails); an Academy membership
// only opens the Academy room — every other room is hosts + whoever holds the current link key.
// Presets and the meeting title come from the row, not a hardcoded pair. Nothing on the OPIL path
// runs for a room body.

export type Role = { admin: boolean; judge: boolean; facilitator_sessions: number[] };
export type JoinBody = { room?: boolean | string; key?: string | null; session_no?: number; meeting_id?: string };
export type Caller = { user: { id: string; email?: string | null }; role: Role; academyAdmin: boolean; ip: string };
export type SessionRow = { no: number; title: string | null; stream_url: string | null; is_live: boolean };
export type RoomRow = {
  id: string; slug: string; title: string; host_name: string; host_emails: string[]; host_preset: string; guest_preset: string;
  link_key: string; is_live: boolean; live_since: string | null; meeting_id: string | null; max_participants: number;
  open_door?: boolean;   /* 0038: any signed-in account may enter while the class runs (ht); the key is not the gate */
};
export type CfResult = { ok: boolean; status: number; data: unknown };
export type JoinDeps = {
  cf: (method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) => Promise<CfResult>;
  rateCheck: (key: string, max: number, windowSecs: number) => Promise<boolean | null>;   /* null = limiter unavailable → treat as allowed */
  getSession: (no: number) => Promise<SessionRow | null>;      /* OPIL row, service role */
  inCohort: () => Promise<boolean>;                             /* rpc ea_opil_in_cohort AS CALLER */
  isMember: () => Promise<boolean>;                             /* rpc ea_is_member AS CALLER */
  getRoom: (slug: string) => Promise<RoomRow | null>;           /* by slug, service role */
  setRoomMeeting: (roomId: string, meetingId: string) => Promise<void>;   /* service role update */
  roomMeetingIds: () => Promise<Set<string>>;                   /* ea_rooms.meeting_id ∪ ea_room_replays.meeting_id (non-null) */
  upsertMember: (roomId: string, userId: string) => Promise<void>;
  displayName: (userId: string) => Promise<string | null>;      /* ea_profiles.display_name */
  ensurePresets: (hostPreset: string, guestPreset: string) => Promise<void>;
  ensureOpilPresets: () => Promise<void>;   /* 9/15: opil-student / opil-judge transcribe; checked on an OPIL host join */
  now: () => Date;
};
export type Reply = { status: number; body: unknown };
export const PRESETS = ["opil-host", "opil-student", "opil-judge", "tma-class-host", "tma-class-guest", "ht-class-host", "ht-class-guest"] as const;
export const OPEN_WINDOW_MS = 4 * 3600 * 1000;   /* a room left live by a dead tab admits guests for this long */

const RTK_PREFIX = "rtk:";
const SLUG_RX = /^[a-z][a-z0-9-]{1,31}$/;

export async function handleJoin(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const slug = body.room === true ? "academy" : (typeof body.room === "string" && SLUG_RX.test(body.room) ? body.room : null);
  if (slug) return joinRoom(slug, body, ctx, deps);
  if (body.room != null) return { status: 400, body: { error: "bad_room" } };
  return joinOpil(body, ctx, deps);
}

async function joinOpil(body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const no = Number(body.session_no);
  if (!Number.isInteger(no)) return { status: 400, body: { error: "bad_session" } };

  // Role check ran AS THE CALLER in resolveCaller (ea_opil_my_role); the cohort check runs here,
  // only when the cheaper answers said no — exactly the order the one-file function used.
  const isHost = ctx.role.admin === true || ctx.role.facilitator_sessions.includes(no);
  let preset: typeof PRESETS[number] | null = null;
  if (isHost) preset = "opil-host";
  else if (ctx.role.judge === true) preset = "opil-judge";
  else if (await deps.inCohort()) preset = "opil-student";
  if (!preset || !PRESETS.includes(preset)) return { status: 403, body: { error: "not_allowed" } };

  // The session row is the shared source of truth for which meeting this is. Read with the
  // service role so a student who cannot yet see the row still gets the right meeting.
  const row = await deps.getSession(no);
  if (!row) return { status: 404, body: { error: "not_found" } };
  const stored = typeof row.stream_url === "string" && row.stream_url.startsWith(RTK_PREFIX) ? row.stream_url.slice(RTK_PREFIX.length) : null;

  let meetingId = stored;
  if (!meetingId) {
    // Only a host opens a room. A student arriving before the facilitator gets a plain 409 so the
    // page can say "the room opens when your facilitator starts it" instead of spending minutes.
    if (!isHost) return { status: 409, body: { error: "not_open" } };
    const made = await deps.cf("POST", "/meetings", { title: `OPIL ${no} — ${String(row.title || "session").slice(0, 80)}`, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    meetingId = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!meetingId) return { status: 502, body: { error: "cloudflare_no_id" } };
  }

  // The Academy room's meeting is never an OPIL class: a facilitator who points a session's
  // stream_url at it gets nothing, whatever their OPIL role.
  if ((await deps.roomMeetingIds()).has(meetingId)) return { status: 403, body: { error: "not_allowed" } };

  // A host join is the moment to make sure Cloudflare's OPIL presets match the committed ones
  // (9/15: opil-student / opil-judge transcribe now). Never throws, cached once right — rtk_presets.ts.
  if (isHost) await deps.ensureOpilPresets();

  // One participant per person per meeting. custom_participant_id is the Supabase uid — never an email.
  const name = String((await deps.displayName(ctx.user.id)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: ctx.user.id, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;

  return { status: 200, body: { token, meeting_id: meetingId, preset, host: isHost, name } };
}

/* ───────────── a room (body.room === true, or a slug string) ─────────────
   One room per slug, one link each. The Academy admin is the host of every room; a room can also
   name its own hosts by email (row.host_emails — Dr. Gray on "ht", say). A person gets in with the
   current link key, or (the Academy room only) an Academy membership — never a member for another
   institution's room, only while the room is live (and for at most 4 h after it started, the
   recording cap — a tab that died leaves is_live true). A Start class on a room that is OFF AIR is a
   fresh Cloudflare meeting and the previous one is set INACTIVE, so a token from last time opens
   nothing; a host joining a row that is LIVE always gets the meeting the room already has, however
   long it has run (9/15: past 4 h every host re-entry minted a new meeting and threw the guests out
   of the old one). People are never told the meeting id; a client-supplied meeting_id is never read. */

const KEY_RX = /^[A-Za-z0-9_-]{22}$/;
/* YYYY-MM-DD in America/Chicago (en-CA prints ISO order) — the meeting title people see in the dashboard */
const CHICAGO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });

async function joinRoom(slug: string, body: JoinBody, ctx: Caller, deps: JoinDeps): Promise<Reply> {
  const uid = ctx.user.id;
  /* 1 — rate limit, fail-open (null = the limiter is down → allowed), before any Cloudflare call */
  if ((await deps.rateCheck("rtk-join:u:" + uid, 30, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  if ((await deps.rateCheck("rtk-join:ip:" + ctx.ip, 90, 600)) === false) return { status: 429, body: { error: "slow_down" } };
  /* 2 — the room */
  const room = await deps.getRoom(slug);
  if (!room) return { status: 503, body: { error: "rtk_not_configured" } };
  /* 3 — who is this: the Academy admin, a listed host, a member (Academy room only), or someone holding the current link */
  const email = (ctx.user.email || "").trim().toLowerCase();
  const isHost = ctx.academyAdmin || (email !== "" && (room.host_emails || []).some((e) => String(e || "").trim().toLowerCase() === email));
  const key = typeof body.key === "string" ? body.key : "";
  const keyGiven = key.trim() !== "";
  /* a malformed key (wrong length/charset — e.g. a truncated paste) is still a dead link, not "no key" */
  const keyOk = keyGiven && KEY_RX.test(key) && key === room.link_key;
  if (!isHost) {
    /* an open-door room (ht, 0038) admits any signed-in account — the link is how they found the
       page, not the gate (Nelson, 9/15: "anyone should be able to enter the room once signed in");
       a wrong key on such a room is not a dead link either. The Academy room keeps open_door false. */
    const allowed = room.open_door === true || (slug === "academy" && (await deps.isMember())) || keyOk;
    if (!allowed) return keyGiven ? { status: 404, body: { error: "bad_link" } } : { status: 403, body: { error: "not_allowed" } };
  }
  /* 4 — is the room open to PEOPLE: live, and started less than 4 h ago (the recording cap; a tab that died
     leaves is_live true, and that must not admit guests for a day) */
  const open = room.is_live && !!room.live_since && (deps.now().getTime() - Date.parse(room.live_since)) < OPEN_WINDOW_MS;
  if (!isHost && !open) return { status: 409, body: { error: "not_open" } };
  /* 5 — the meeting. A host on a row that is OFF AIR (or live with no meeting yet) opens a fresh one. A host on a
     row that is LIVE always reuses its meeting — whatever the clock says: Rejoin after Leave, "Enter the running
     session", a reload, the module's own rejoin after a drop must never mint a second meeting while one runs, and
     never INACTIVATE the one the guests are still in (that is what happened past 4 h before 9/15). The two
     meanings of "open" are split on purpose: the window gates admission, not the host's meeting.
     The row is NOT flipped live here: that waits until the host's own participant POST succeeds (step 9), so a
     Cloudflare failure on the second call leaves the room off air instead of open with nobody hosting it. */
  let meetingId: string | null = room.meeting_id;
  let fresh = false;
  if (isHost && (!room.is_live || !meetingId)) {
    /* the title people see in the dashboard: room.title is cut first so the date always survives the 80-char cap */
    const prefix = (slug === "academy" ? "Academy" : slug.toUpperCase()) + " · ", suffix = " · " + CHICAGO_DAY.format(deps.now());
    const title = prefix + String(room.title || "").slice(0, 80 - prefix.length - suffix.length) + suffix;
    const made = await deps.cf("POST", "/meetings", { title, persist_chat: false });
    if (!made.ok) return { status: 502, body: { error: "cloudflare_" + made.status } };
    const id = String(((made.data || {}) as Record<string, unknown>).id || "");
    if (!id) return { status: 502, body: { error: "cloudflare_no_id" } };
    meetingId = id;
    fresh = true;
  }
  if (!meetingId) return { status: 409, body: { error: "not_open" } };
  /* 6 — the host makes sure this room's two presets exist on Cloudflare (cached; never throws) */
  if (isHost) await deps.ensurePresets(room.host_preset, room.guest_preset);
  /* 7 — the cap, people only; Cloudflare counts the host too ("Max people (you included)"); 404 = no session yet.
     Any other failure fails OPEN (a Cloudflare blip must not lock people out) and says so in the logs. */
  if (!isHost) {
    const r = await deps.cf("GET", `/meetings/${meetingId}/active-session`);
    if (r.status !== 404 && !r.ok) console.warn("[ea-rtk-join] active-session " + r.status + " — cap not enforced this join");
    const live = r.status === 404 ? 0 : Number(((r.data || {}) as Record<string, unknown>).live_participants ?? 0);
    if (live >= room.max_participants) return { status: 429, body: { error: "room_full" } };
  }
  /* 8 — one participant per person; custom_participant_id is the Supabase uid, never an email */
  const name = String((await deps.displayName(uid)) || (ctx.user.email || "Member").split("@")[0]).slice(0, 60);
  const preset = isHost ? room.host_preset : room.guest_preset;
  const added = await deps.cf("POST", `/meetings/${meetingId}/participants`, { custom_participant_id: uid, preset_name: preset, name });
  if (!added.ok) return { status: 502, body: { error: "cloudflare_" + added.status } };
  const token = ((added.data || {}) as Record<string, unknown>).token;
  /* 9 — Nelson is in: NOW the row goes live (meeting_id, is_live, live_since — server time), and the previous
     meeting closes so a token from last time opens nothing, not even an empty billable session. The PATCH
     is best effort but never silent: T10 reads this log line to confirm invariant 10 on prod. */
  if (fresh) {
    await deps.setRoomMeeting(room.id, meetingId);
    if (room.meeting_id) {
      const off = await deps.cf("PATCH", `/meetings/${room.meeting_id}`, { status: "INACTIVE" }).catch((e) => ({ ok: false, status: 0, data: String(e) }));
      if (!off.ok) console.warn("[ea-rtk-join] previous meeting not inactivated", room.meeting_id, off.status);
    }
  }
  /* who joined (the Your room card on /live/ reads it) — a failed bookkeeping write never costs anyone the token */
  try { await deps.upsertMember(room.id, uid); } catch (e) { console.warn("[ea-rtk-join] upsertMember", room.id, uid, String(e)); }
  /* 10 — only Nelson learns the meeting id */
  return { status: 200, body: isHost ? { token, meeting_id: meetingId, preset, host: true, name } : { token, preset, host: false, name } };
}
