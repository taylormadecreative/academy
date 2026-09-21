# HT classrooms implementation contract

User authorized implementation on 2026-09-21: replace the one-campus-room presentation with cohort classrooms, scheduled sessions and separate campus live events. Work in this development clone; no production changes.

## Division of work

- Backend: `campus-store.js`, additive migration, database/store tests, setup notes. Own cohorts/sessions data, commands, RLS and existing SQL room-helper integration.
- UI: new `campus-classrooms.js` exports `renderClassrooms(view,ctx)` and `bindClassrooms(view,root,ctx)`. Own directory, cohort/session detail, rehearsal and management views. No shell/CSS changes.
- Meeting adapter: existing room/replay JS, join/record Edge handlers and their tests, new shared pure context helper if useful. Own safe managed-room routing and meeting token/record authorization.
- Root: shell, routes, CSS, Today/Learning links, build, integration tests and final review.

## Routes and mounting

- `/ht/hub/live/` is the directory, view `live`, page title `Classrooms & live sessions`.
- `/ht/hub/live/?cohort=<uuid>` shows that cohort's schedule, instructor, roster (instructor/admin only), related learning link and recordings.
- `/ht/hub/live/?manage=1` is cohort/session administration for staff/admin (backend limits owners).
- `/ht/hub/session/?room=htc-<24 lowercase hex>` mounts the existing real meeting engine scoped to one scheduled session. No room key invitation grants access.
- `/ht/hub/replay/?room=htc-<24 lowercase hex>` scopes the existing replay engine to that session.
- Explicit demo links go to `/ht/hub/live/?session=<uuid>&demo=<role>` for a labeled rehearsal (no fake video call or actual camera request). This can simulate join/leave and show session agenda/materials/attendance without claiming conferencing is running.
- Preserve old shared-room runtime at `/ht/hub/legacy-live/`; old `/live/?k=...` invitations may enter that compatibility route. Do not promote it as the cohort classroom.

## State additions

Append `cohorts`, `cohort_members`, `class_sessions`, `session_attendance` to the campus state. Existing student/staff/leadership roles retain their current meaning; assigned instructors and campus admins manage their classroom. Staff may create a cohort with themselves as instructor. Admin may assign an active staff/admin instructor. Leadership does not gain classroom roster/content access from its role.

- `cohorts`: `{id,title,description,course_id:null|uuid,instructor_id,status:'active'|'archived',created_at}`. Students see active cohorts where their active membership exists. Staff see assigned cohorts; admin all; guest sample read-only.
- `cohort_members`: `{cohort_id,user_id,active,joined_at}`. Students only their own membership; instructor/admin roster of authorized cohorts. Cohort enrollment is explicit; enrolling in an open learning pathway does not grant classroom access.
- `class_sessions`: `{id,cohort_id:null|uuid,event_id:null|uuid,title,description,starts_at,ends_at,status:'scheduled'|'cancelled',audience:'cohort'|'campus',instructor_id,room_id,room_slug,is_live:boolean,recording_url:null|string,replay_published:boolean}`. For cohort audience cohort_id required; campus audience cohort_id null, requires active campus membership. Every session has a dedicated `ea_rooms` row with slug `htc-` + 24 hex characters, `open_door=false`, HT presets, no guest key authorization. Only authorized session records are returned. Unpublished recording URL never returned to students. Core agenda is description; session resources use existing room-scoped engine.
- `session_attendance`: `{session_id,user_id,first_joined_at,last_joined_at,joins}` derived from actual `ea_room_members` on the unique session room; students own rows, instructor/admin authorized roster. Demo may simulate this with clear labeling. Do not claim manual preview attendance as actual participation.

## Commands

Extend existing `ht_campus_command`/store dispatch:
- `saveCohort` `{id?,title,description,course_id?,instructor_id?,status}`.
- `setCohortMember` `{cohort_id,user_id,active}`. Requires active existing HT student/staff member; instructor/admin only; no student self-enrollment.
- `saveClassSession` `{id?,cohort_id?,event_id?,title,description,starts_at,ends_at,status,audience,instructor_id?}`. Cohort instructor inherited, assigned instructor or admin only; campus event session staff creator/admin. Reject end<=start and illegal reassignment of existing room/class identity; editing locked fields once room has activity is safe default. Distinct sessions can run concurrently; never reuse room IDs.
- `demoJoinSession` `{session_id}` and `demoLeaveSession` `{session_id}` only for demo store; reject in live RPC. Respect demo roster and cancelled sessions. Rehearsal UI describes that no live audio/video meeting is being started.

## Authorization bridge

Public invoker RPC `ht_classroom_access(p_slug text)` returns `{managed:boolean,can_join:boolean,is_host:boolean,room_id:null|uuid}` for current Auth user. Any `htc-` slug is managed, including unknown ones: missing mapping/membership/database error fails closed. `can_join` requires active HT membership, a noncancelled session, active cohort and roster where relevant; host is assigned instructor or active HT admin only. No Academy-wide admin/email/link key bypass for managed rooms. Backend and Edge agent coordinate this exact RPC.

SQL room helpers (`ea_room_state`, `ea_room_is_host`, `ea_class_can`, `ea_class_is_host`, `ea_room_reader`, relevant `ea_room_in_session`) must branch for managed rooms and preserve legacy behavior otherwise. Published replay access can be granted to current authorized cohort members for missed-class review; it must never spill into another session/cohort. Attendance is still per actual session join. Remove access on cohort/member deactivation. Avoid changing legacy underlying meeting code for unrelated Academy/OPIL rooms.

Edge join and record handlers MUST check the caller-scoped bridge for managed slugs before granting tokens, host controls or record/end operations. Never allow the existing open_door/link/email/Academy admin logic to override it. Existing room-side SQL RPCs and grants must also honor the bridge. Surface actual backend unavailability; no fallback to the old shared HT room or to demo on error.

## UI and verification

Use existing `ctx` helpers and campus styling. `ctx.run(name,payload,message,form)` clears only a successful submitted draft. Call `ctx.restoreDrafts?.()` after local repaint; `ctx.discardDraft?.(form)` on explicit cancel. Never reset forms on failure. Instructor management accessible from directory without hiding the roster/session workflow in SQL instructions. Preserve demo role on every generated URL. Escape names/content, validate HTTPS media, one h1 from root, accessible labels, useful empty/denied/cancelled states.

Test multiple cohorts + simultaneous sessions, wrong-cohort and nonmember denial, no link-key/Academy-admin bypass, instructor scoping, deactivation, published vs draft replay, no session material cross-read, unique room creation, live demo rejection, existing campus and OPIL regressions. Keep public production unaffected.
