// deno test supabase/functions/ea-rtk-webhook/
// _shared/replay_deps.ts against an in-memory stand-in for the supabase client: the meeting lookup
// (room FIRST, OPIL last), which table each kind writes to, and markFailed's two-table fallback.
// What this cannot prove — PostgREST's real answer to update().select("id") — is Task 10's real run.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replayDeps, markFailed } from "../_shared/replay_deps.ts";

type Row = Record<string, unknown>;
type Call = { op: "select" | "update" | "upsert"; table: string; eq: [string, unknown][] };

/* Just enough of supabase-js's builder for replay_deps.ts: from().select().eq().order().limit().maybeSingle(),
   from().update().eq()[.select()], from().upsert(). A table missing from `tables` answers the way PostgREST
   does for an unknown relation — { data: null, error } — never a throw. */
function fakeAdmin(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  const missing = (table: string) => ({ data: null, error: { code: "42P01", message: `relation "public.${table}" does not exist` } });
  const from = (table: string) => {
    const build = (op: "select" | "update", patch?: Row) => {
      const eq: [string, unknown][] = [];
      let orderBy = "", desc = false, take = Infinity, returning = false;
      const run = () => {
        calls.push({ op, table, eq });
        const rows = tables[table];
        if (!rows) return missing(table);
        let hit = rows.filter((r) => eq.every(([k, v]) => r[k] === v));
        if (op === "update") { hit.forEach((r) => Object.assign(r, patch)); return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null }; }
        if (orderBy) hit = [...hit].sort((a, b) => (String(a[orderBy]) < String(b[orderBy]) ? -1 : 1) * (desc ? -1 : 1));
        return { data: hit.slice(0, take), error: null };
      };
      const q = {
        eq(k: string, v: unknown) { eq.push([k, v]); return q; },
        order(k: string, o: { ascending: boolean }) { orderBy = k; desc = !o.ascending; return q; },
        limit(n: number) { take = n; return q; },
        select(_cols: string) { returning = true; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: r.error }); },
        then(onOk: (v: { data: unknown; error: unknown }) => unknown, onErr?: (e: unknown) => unknown) { return Promise.resolve(run()).then(onOk, onErr); },
      };
      return q;
    };
    return {
      select: (_cols: string) => build("select"),
      update: (patch: Row) => build("update", patch),
      upsert(row: Row, opts: { onConflict: string }) {
        calls.push({ op: "upsert", table, eq: [[opts.onConflict, row[opts.onConflict]]] });
        const rows = tables[table];
        if (!rows) return Promise.resolve(missing(table));
        const i = rows.findIndex((r) => r[opts.onConflict] === row[opts.onConflict]);
        if (i >= 0) Object.assign(rows[i], row); else rows.push({ ...row });
        return Promise.resolve({ data: null, error: null });
      },
    };
  };
  return { admin: { from } as unknown as SupabaseClient, calls, tables };
}

/* Nelson's room is on meeting "meet-r" now; "meet-old" was a previous Start class whose recording is
   still uploading; OPIL session 7 lives on "meet-7". */
const world = () => ({
  ea_rooms: [{ id: "room-1", slug: "academy", title: "Taylormade Academy Live", meeting_id: "meet-r", live_since: "2026-09-15T01:00:00.000Z" }],
  ea_room_replays: [
    { id: "rr-1", room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-old", status: "uploading", created_at: "2026-09-12T18:05:00.000Z" },
    { id: "rr-0", room_id: "room-1", meeting_id: "meet-old", recording_id: "rec-older", status: "error", created_at: "2026-09-12T17:00:00.000Z" },
  ],
  ea_opil_replays: [{ id: "or-1", session_no: 7, meeting_id: "meet-7", recording_id: "rec-7", status: "recording", created_at: "2026-09-10T00:00:00.000Z" }],
  ea_opil_sessions: [{ no: 7, title: "Agents 101", kind: "thread", stream_url: "rtk:meet-7" }],
});
const tablesAsked = (calls: Call[], op: Call["op"]) => calls.filter((c) => c.op === op).map((c) => c.table);

Deno.test("targetByMeeting: the room's current meeting → room, startedAt = live_since, and OPIL is never asked", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-r");
  assertEquals(t, { kind: "room", room: { id: "room-1", slug: "academy", title: "Taylormade Academy Live", startedAt: "2026-09-15T01:00:00.000Z" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms"]);
});

Deno.test("targetByMeeting: an OPIL session pointed at the room's meeting still loses — rooms resolve first", async () => {
  const w = world();
  w.ea_opil_sessions.push({ no: 9, title: "Hijack", kind: "thread", stream_url: "rtk:meet-r" });
  const { admin } = fakeAdmin(w);
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-r");
  assertEquals(t?.kind, "room");
});

Deno.test("targetByMeeting: a meeting the room has moved on from → room via its latest ea_room_replays row; startedAt = that row's created_at; title from ea_rooms", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-old");
  assertEquals(t, { kind: "room", room: { id: "room-1", slug: "academy", title: "Taylormade Academy Live", startedAt: "2026-09-12T18:05:00.000Z" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms", "ea_room_replays", "ea_rooms"]);
});

Deno.test("targetByMeeting: an OPIL session's meeting → opil with { no, title, kind }, asked last", async () => {
  const { admin, calls } = fakeAdmin(world());
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-7");
  assertEquals(t, { kind: "opil", session: { no: 7, title: "Agents 101", kind: "thread" } });
  assertEquals(tablesAsked(calls, "select"), ["ea_rooms", "ea_room_replays", "ea_opil_sessions"]);
});

Deno.test("targetByMeeting: a non-Academy room's slug comes through on the target", async () => {
  const w = world();
  w.ea_rooms.push({ id: "room-ht", slug: "ht", title: "HT Live", meeting_id: "meet-ht", live_since: "2026-09-17T15:00:00.000Z" });
  const { admin } = fakeAdmin(w);
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-ht");
  assertEquals(t, { kind: "room", room: { id: "room-ht", slug: "ht", title: "HT Live", startedAt: "2026-09-17T15:00:00.000Z" } });
});

Deno.test("targetByMeeting: nobody's meeting → null", async () => {
  const { admin } = fakeAdmin(world());
  assertEquals(await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-x"), null);
});

Deno.test("targetByMeeting: with the room tables not there yet (0036 unapplied) an OPIL meeting still resolves", async () => {
  const { admin } = fakeAdmin({ ea_opil_sessions: world().ea_opil_sessions });
  const t = await replayDeps(admin, { dedupe: false }).targetByMeeting("meet-7");
  assertEquals(t, { kind: "opil", session: { no: 7, title: "Agents 101", kind: "thread" } });
});

Deno.test("upsertReplay: a room row lands in ea_room_replays, an OPIL row in ea_opil_replays, both with updated_at", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  const d = replayDeps(admin, { dedupe: false });
  await d.upsertReplay({ room_id: "room-1", meeting_id: "meet-r", recording_id: "rec-new", status: "recording" }, { kind: "room", room: { id: "room-1", slug: "academy", title: null, startedAt: null } });
  await d.upsertReplay({ session_no: 7, meeting_id: "meet-7", recording_id: "rec-7", status: "uploading" }, { kind: "opil", session: { no: 7, title: null, kind: null } });
  assertEquals(tablesAsked(calls, "upsert"), ["ea_room_replays", "ea_opil_replays"]);
  const roomRow = tables.ea_room_replays.find((r) => r.recording_id === "rec-new")!;
  assertEquals(roomRow.room_id, "room-1"); assert(typeof roomRow.updated_at === "string");
  assertEquals(tables.ea_opil_replays[0].status, "uploading"); assertEquals(tables.ea_opil_replays.length, 1);
  assertEquals(tables.ea_room_replays.length, 3);
});

Deno.test("upsertReplay: a database error becomes a throw (the handler's catch → markFailed)", async () => {
  const { admin } = fakeAdmin({});
  const d = replayDeps(admin, { dedupe: false });
  let threw = "";
  try { await d.upsertReplay({ room_id: "room-1", meeting_id: "m", recording_id: "r", status: "recording" }, { kind: "room", room: { id: "room-1", slug: "academy", title: null, startedAt: null } }); }
  catch (e) { threw = String((e as Error).message); }
  assert(threw.includes("ea_room_replays"));
});

Deno.test("currentStatus reads the table of the target's kind", async () => {
  const { admin } = fakeAdmin(world());
  const d = replayDeps(admin, { dedupe: false });
  const room = { kind: "room", room: { id: "room-1", slug: "academy", title: null, startedAt: null } } as const;
  const opil = { kind: "opil", session: { no: 7, title: null, kind: null } } as const;
  assertEquals(await d.currentStatus("rec-old", room), "uploading");
  assertEquals(await d.currentStatus("rec-7", opil), "recording");
  assertEquals(await d.currentStatus("rec-7", room), null);   /* an OPIL recording is not in the room table */
});

const FAIL = (recordingId: string) => ({ event: "recording.statusUpdate", recording: { id: recordingId, status: "UPLOADED" } });

Deno.test("markFailed: a room recording → ea_room_replays marked error; ea_opil_replays never touched", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-old"), "boom: bad column");
  assertEquals(tablesAsked(calls, "update"), ["ea_room_replays"]);
  const row = tables.ea_room_replays.find((r) => r.recording_id === "rec-old")!;
  assertEquals(row.status, "error"); assertEquals(row.error, "boom: bad column"); assert(typeof row.updated_at === "string");
  assertEquals(tables.ea_opil_replays[0].status, "recording");
});

Deno.test("markFailed: an OPIL recording → the room table matched nothing, so ea_opil_replays is marked", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-7"), "boom");
  assertEquals(tablesAsked(calls, "update"), ["ea_room_replays", "ea_opil_replays"]);
  assertEquals(tables.ea_opil_replays[0].status, "error"); assertEquals(tables.ea_opil_replays[0].error, "boom");
  assertEquals(tables.ea_room_replays.map((r) => r.status), ["uploading", "error"]);   /* untouched */
});

Deno.test("markFailed: no room table yet (0036 unapplied) → OPIL row still marked, exactly as today", async () => {
  const { admin, tables } = fakeAdmin({ ea_opil_replays: world().ea_opil_replays });
  await markFailed(admin, FAIL("rec-7"), "boom");
  assertEquals(tables.ea_opil_replays[0].status, "error");
});

Deno.test("markFailed: the message is cut at 500; no recording id → no write; a throwing client is swallowed", async () => {
  const { admin, calls, tables } = fakeAdmin(world());
  await markFailed(admin, FAIL("rec-old"), "x".repeat(900));
  assertEquals(String(tables.ea_room_replays[0].error).length, 500);
  await markFailed(admin, { event: "recording.statusUpdate", recording: {} }, "boom");
  assertEquals(tablesAsked(calls, "update").length, 1);
  const bad = { from: () => { throw new Error("db down"); } } as unknown as SupabaseClient;
  await markFailed(bad, FAIL("rec-old"), "boom");   /* resolves, does not throw */
});
