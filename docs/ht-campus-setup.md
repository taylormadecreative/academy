# HT campus data setup and verification

The development upgrade is implemented locally. **The new database migrations have not been applied to the live Academy project.** Until activation, authenticated users see an explicit unavailable message rather than simulated success. `?demo=student`, `?demo=staff`, and `?demo=leadership` run isolated fictional data in the browser; these switches never grant database permissions.

Product direction: build Taylormade Academy / HT Hub into a standalone LMS and campus hub. Canvas integration is not planned. Current capabilities and future native academic work are distinguished in the [standalone LMS roadmap](ht-standalone-lms-roadmap.md).

## What is implemented

- Cohort classrooms with instructor-managed rosters, separately scheduled session rooms, campus live events, scoped recording access and session entry records.
- Active institutional membership with student, staff, administrator and leadership roles. Existing Academy accounts receive no automatic campus membership.
- Shared records for learning, assignments and feedback; event RSVP and check-in; support cases and replies; announcements; community posts, replies and likes; private member messages; personal in-app notifications; and separately supplied Ada video configuration.
- Staff publication of drafts and scheduled announcements. A scheduled announcement becomes readable once its persisted `publish_at` arrives; no email or push scheduler is implied.
- Server-enforced enrollment, module order, correct knowledge-check answers and staff approval. A credential UUID and completion timestamp are issued only after every requirement is complete. Withdrawing approval clears that completion and dependent progress, and permits dependent assignments to be revised and resubmitted.
- Leadership receives aggregate counts. The leadership role does not confer access to other students' individual support cases, submissions, attendance, enrollments or messages.
- Server audit metadata for each successful command, without copying private message or request bodies into the log.
- Native course sections reuse classroom rosters and assigned instructors. Section assignments support availability/due/close dates, extensions, submission attempts, instructor-only draft feedback, published grades and explicit excused work. Course grades are independent of pathway completion records.

## Files

- `supabase/migrations/20260921180637_ht_campus_hub.sql`: additive tables, RLS, read/state API and validated command API.
- `supabase/migrations/20260921193229_ht_cohort_classrooms.sql`: cohorts, rosters, individual session rooms and managed-room authorization.
- `supabase/migrations/20260921200136_ht_community_messages.sql`: recipient-only inbox read state and direct conversation links in new message notifications.
- `supabase/migrations/20260921221338_ht_native_coursework.sql`: section coursework, submission history, grade revisions and student-specific deadline extensions.
- `supabase/seeds/ht-campus-ai-literacy.sql`: optional real three-activity learning pathway. No fictional users, activity, events or requests are inserted.
- `ht/hub/campus-store.js`: production adapter and explicitly selected demo behavior.
- `tools/ht-campus-tests/`: pinned local PostgreSQL/PGlite verification and store integration tests.

The new public RPCs are `ht_campus_state()` and `ht_campus_command(p_name text, p_payload jsonb)`. All `ht_*` tables enable RLS and grant clients only the needed read access. Direct client insert/update/delete grants are revoked. The command's privileged implementation is in `ht_private`, with a fixed empty search path, active database membership checks, explicit field lists, role checks and ownership checks. Never expose `ht_private` through the Data API.

Answer keys, event codes, knowledge-check records and audit records are stored in private tables. Live student state does not include answer keys or check-in codes. Staff state includes answer keys for editing but never returns check-in codes; staff can set or replace a code in the event editor.

## Local verification

From the repository root:

```sh
npm ci --prefix tools/ht-campus-tests
npm test --prefix tools/ht-campus-tests
npm run test:views --prefix tools/ht-campus-tests
```

The browser suites use the pinned Playwright package and a locally installed Google Chrome. Start `python3 -m http.server 8871 --bind 127.0.0.1` from the repository root, then run `npm run test:browser --prefix tools/ht-campus-tests`. Set `HT_CAMPUS_BASE` if using a different local port. The real-app suite uses a fresh browser context, blocks external requests, and exercises only explicitly selected demo records. Screenshots and its JSON report go to `/tmp/ht-campus-review`, or `HT_CAMPUS_SCREENSHOTS` when set.

The dependencies are confined to this test folder and pinned in its lockfile. Tests create an in-memory PostgreSQL database, bootstrap a minimal Supabase Auth schema, execute the exact migration and run queries as `anon` and `authenticated` roles. They do not contact or alter Supabase. The test package uses PGlite 0.3.14 and was run with Node 25.8.2; modern Node with `crypto.randomUUID` is required.

The database suite checks real policy/privilege denial, not just SQL text patterns. It covers anonymous access, nonmember denial, self-promotion attempts, direct completion forgery, student isolation, private messages, leadership privacy, scheduling, capacity, event code and time validation, learning order, wrong answers, approval/completion/revocation, dependent assignment recovery, member deactivation, and idempotent content seeding. Store tests cover the same core demo flows and production RPC dispatch/error behavior. The separate classroom database suite loads actual legacy room/helper function bodies from the checked-in migrations over a minimal local fixture, then applies the exact new migration. It checks cross-cohort denial, instructor scoping, anonymous/Academy-admin/key bypass attempts, revocation, unpublished/published replay, protected materials/storage, help/attendance reporting, unique room allocation, session identity locking and legacy compatibility. Classroom store tests exercise matching isolated rehearsal behavior. These fixtures are test-only and must never be applied as a production schema.

This verifies PostgreSQL behavior locally. It does not replace a staging test of the hosted PostgREST API, Auth sessions, network failure handling and simultaneous clients.

## Activate in a separate staging project first

1. Configure staging Supabase Auth and the frontend's existing `BM_CONFIG` with that staging URL and publishable key. Never put a service role key in frontend configuration.
2. Apply **only** `20260921180637_ht_campus_hub.sql` using the staging SQL editor or a reviewed SQL execution tool. Existing repository migrations contain historical numbering and are not guaranteed to match production history; do not bulk-push them to an existing project.
3. Keep `ht_private` out of exposed schemas. The migration grants exact RPC/read access explicitly and requires no Realtime publication or storage bucket changes.
4. Bootstrap the first administrator using the trusted staging SQL editor after that person has signed in once and has a confirmed `auth.users.id`. Membership is not inferred from email domain or user-editable metadata.

   Review the selected user first:

   ```sql
   select id, email from auth.users where lower(email) = lower('CONFIRMED_OWNER_EMAIL');
   ```

   Then use the confirmed UUID (the example placeholder must be replaced):

   ```sql
   insert into public.ht_members(user_id, display_name, role, active)
   values ('CONFIRMED_OWNER_UUID'::uuid, 'Nelson Taylor', 'admin', true);
   ```

   This is an operator-only bootstrap. It is deliberately unavailable to public clients. Do not assign production roles to sample identities.
5. Provision additional users through an authenticated administrator's `ht_campus_command('setMember', ...)`. The recipient must already exist in Auth. The operation is admin-checked and audited. The current UI does not include a membership-management screen.

   ```js
   await supabase.rpc('ht_campus_command', {
     p_name: 'setMember',
     p_payload: {
       user_id: confirmedUserId,
       display_name: 'Confirmed member name',
       role: 'student',
       active: true
     }
   });
   ```

   To revoke access, use the same command with `active: false`. The command rechecks database membership on every request; existing signed-in sessions do not retain campus access after deactivation. Administrators cannot downgrade or deactivate their own administrator membership through this operation.
6. Optionally seed the real AI Literacy pathway. The seed expects an active administrator identity and is idempotent. In a trusted SQL editor, execute it inside one transaction after setting the transaction-local identity to the confirmed administrator UUID:

   ```sql
   begin;
   select set_config('request.jwt.claim.sub', 'CONFIRMED_OWNER_UUID', true);
   -- Paste supabase/seeds/ht-campus-ai-literacy.sql here.
   commit;
   ```

   The transaction-local identity is needed because a privileged SQL editor does not carry a normal user's Auth JWT. Never expose this operator technique to a client endpoint. The seed checks that the selected existing member is active and an administrator, uses the same validated command API as staff authoring, and creates only real curriculum content. If the fixed course ID already exists it makes no changes.
7. Create a real campus event through the staff editor; set the actual date, location, capacity and a check-in code. Publish an announcement and configure Ada's independently produced HTTPS video URL, poster and transcript. Video hosting/CORS and the actual media file must be tested separately.
8. Rehearse with two distinct test accounts on different devices. Verify student writes appear in staff views, only the recipient sees a message, leadership sees aggregates, deactivated/nonmember users are denied, drafts stay private, a wrong code fails, and a submitted project remains incomplete until approval. Run Supabase's security/performance advisors against the staging project and inspect any new findings before production activation.

## Demo behavior and operational details

The demo contains fictional Jordan R., Morgan T., Avery W., Cameron L. and Riley S. Every role shares only the `ht-campus-demo-v2` localStorage record on that browser origin. Clearing this key resets the demonstration. It does not clear or alter live records. Demo event times are relative to the first fixture creation; a saved demo retains its dates. Reset this sample record before rehearsing on another day. The sample current-session check-in code is `HT2026`.

Real events always use stored timestamps. RSVP capacity is guarded by a database row lock. Check-in requires a valid code, a current RSVP, and a time between 30 minutes before the start and two hours after the end. It does not prove physical location or prevent a participant from sharing a code.

The live client refreshes on focus and approximately every 15 seconds while visible. This is polling, not instant push delivery. The shell should defer noncritical refresh while a form is dirty and force an identity refresh on actual sign-out/account change. Store auth events include `{ reason: 'auth', event, user_id }` for that purpose; the same-identity `SIGNED_IN` event can occur on refocus and should not discard a draft.

Learning content is locked once anyone enrolls. Create a new pathway version for changed requirements; this prevents editing a course out from under issued completion records. Course metadata and publication state can still be edited. Knowledge checks provide correct/incorrect feedback rather than revealing the answer in a live student response.

### Activate the dedicated inbox

Apply `20260921200136_ht_community_messages.sql` after both HT campus and classroom migrations in reviewed staging, then deploy the matching frontend. This additive migration preserves the existing public command function's OID and delegates existing campus/classroom commands through the prior implementation. It grants no direct client message writes and introduces no email, push, online status or delivery receipts.

`ht_campus_command('readMessages', { message_ids: [...] })` accepts at most 200 explicit message UUIDs. The client should pass only incoming messages displayed in the conversation it opened. An active member may mark only messages addressed to their own Auth identity; staff, administrators and leadership receive no privilege over another inbox. An unknown, outgoing or unrelated ID rejects the entire batch. Empty batches and repeated IDs are valid, and a previously stored `read_at` remains unchanged. A newer message outside that displayed ID set remains unread. This timestamp is personal inbox state, not evidence that a person read or understood a message.

New message notifications link to `/ht/hub/messages/?person=<sender UUID>`. Message body validation, membership checks, message privacy policies and body-free audit logging remain in force. The same command behavior and notification links are available in the existing fictional `ht-campus-demo-v2` data; upgrading does not reset a saved rehearsal. Staging verification should open two independent accounts, send in both directions, open one conversation, confirm its unread count updates, and verify an unrelated member and a deactivated account cannot read or mark its messages. The focused local checks are `tools/ht-campus-tests/messages.test.mjs` and `tools/ht-campus-tests/messages-store.test.mjs`.

## Limits to address before a broad campus rollout

- No SSO, student-information-system synchronization, cross-institution tenancy, public credential verification endpoint, transcript export standard or production deployment is claimed. Credential records are currently verified inside the authenticated campus/staff experience or database.
- No email/push notifications, automatic calendar invitations, appointment booking, secure file-upload workflow, content moderation console or AI model/chat service is included. Assignment links and text are supported. Ada is a supplied video plus transcript and useful navigation, not a synthesized live assistant.
- One HT institution is supported. The `ht_` namespace is separated from Academy/OPIL tables, but it is not a multi-university tenant schema.
- Staff/admin have access to campus support and submitted work. This pilot supports general learning/career/technology/campus-life requests; narrower office permissions and university-approved handling are needed before placing counseling, disability, health or similarly restricted records here.
- State loading currently returns the user's full permitted dataset. Add pagination, incremental synchronization, query/load budgets, retention policies and operational monitoring before large-scale use. The current leadership metrics are lifetime counts; `active_learners` means distinct enrolled members, not activity within a specified time window.
- Add service-side abuse controls/rate limits and check-in attempt limits before public-scale use. The RPC validates membership, ownership, payload size and requirements, but it is not an anti-spam system.
- Production backup/restore verification, institutional data governance, security review, accessibility testing and iPhone/live-session rehearsal remain release tasks. No compliance certification is asserted by these local checks.

## Activate native courses and grading in staging

Apply `20260921221338_ht_native_coursework.sql` after the three HT campus, classroom and messaging migrations. Deploy the matching course workspace and store together. No production schema was changed while developing this feature.

Open **Learning → My courses** at `/ht/hub/courses/`. Existing cohorts are the sections for native coursework: their assigned instructor manages assignments and grades, and their active classroom roster determines who can submit. Create sections and enroll members through **Manage classrooms**. Connecting an optional learning pathway supplies reusable lessons; pathway enrollment alone does not grant section coursework access.

The new arrays are `assignments`, `assignment_extensions`, `assignment_attempts` and `assignment_grades`. Writes use checked commands through `ht_campus_command`; direct client writes are denied. New records are restricted to the section instructor/campus administrator and the enrolled student as appropriate. Leadership and unrelated staff cannot see private section work. Historical grade revisions do not expose draft feedback to students.

Points-based course grades use published grades for the latest attempt. Ungraded or resubmitted work remains pending, and excused assignments are excluded. An explicit published zero is different from missing/ungraded work. A final points total is available only after all published assignments are resolved; an empty or entirely excused set has no numeric grade. Publishing or changing these grades does not issue or revoke a learning-pathway completion record.

Grade saves check the expected revision and latest attempt so a stale grading screen cannot silently overwrite newer work. A rejected draft stays intact; **Discard draft & load latest review** explicitly replaces it with the current submission and grade before further review. Assignment points/publication lock once work or grades exist. Availability and closing times are enforced server-side; due dates determine lateness. Student-specific extensions use validated effective deadlines. Times display in the user's local zone and are stored as instants.

Use two real staging accounts to complete the publish → submit → draft grade → publish grade workflow. Verify drafts remain invisible to the learner, timestamps/late work/attempt limits match the rules, extensions reopen eligible work, revoked enrollment blocks old links, and an unrelated instructor cannot read or grade the submission. Local tests exercise these policies, but do not replace hosted Auth/PostgREST verification.

The demo adds native-coursework fixtures to `ht-campus-demo-v2` once, preserving earlier rehearsal activity. Jordan's section starts with a published “Responsible AI project brief”; Morgan also has an unpublished assignment. No completed submission or grade is invented for this demonstration. Reset only that demo key when a fresh rehearsal is needed.

This milestone supports text and HTTPS-link submissions and a points-based gradebook. Weighted categories, reusable rubrics, rich quizzes/question banks, file uploads, formal transcript issuance and course cloning remain roadmap work. See [the academic contract](ht-academic-contract.md) for exact fields and command rules.


## Activate cohort classrooms in staging

Apply the campus migration first. The classroom migration additionally requires the existing Academy/HT room and class features through `0054_ht_room_features.sql` (including room replays, presence, help, warm-ups, materials and the associated storage bucket). On an existing project, inspect the actual schema and function signatures before applying **only** `20260921193229_ht_cohort_classrooms.sql`; do not bulk-push historical repository migrations. A missing prerequisite causes the transaction to fail, rather than partially opening rooms. A clean staging project must first receive its reviewed legacy prerequisites.

Deploy the updated `ea-rtk-join`, `ea-rtk-record` and `ea-class-summary` Edge Functions with the classroom SQL change, then deploy the matching frontend. The database bridge is `ht_classroom_access(p_slug text)` and returns `{ managed, can_join, is_host, room_id }` for the caller's Auth identity. The service-role Edge adapters must evaluate this bridge with the original caller's JWT. A service-role lookup or Academy-wide administrator flag cannot substitute for caller authorization. Missing or unavailable authorization denies managed access.

Create actual cohorts in **Classrooms → Manage classrooms**, using an active staff account or HT administrator. Staff create and manage their own cohorts; campus administrators can assign a different active instructor. Add already provisioned campus students/staff to that cohort's roster. Open-learning enrollment does not grant a classroom seat. Schedule a cohort session or a separate campus live event: each receives a unique `ea_rooms` row, immutable audience/roster identity, `open_door=false`, and a reserved `htc-` slug. Repeated saves preserve the room. Session allocation is serialized for the same session ID; unique constraints protect the mappings. Dates lock once meeting entry records exist. End a live call before cancelling its session or archiving its cohort. The existing shared HT room remains a legacy compatibility route and is not a cohort classroom.

Test these paths with two independent student accounts, two instructors and a campus administrator:

1. Put the students in different cohorts, schedule simultaneous sessions, and confirm each user receives only their assigned classroom and the separate campus sessions. The second instructor must be unable to edit the first instructor's roster or session.
2. Start the real provider meeting as its assigned instructor; join as the assigned student. Confirm camera, microphone, screen sharing, chat, hand raising, class resources, presence, recording and replay on the hosted deployment. Local tests do not mint provider tokens or prove this integration.
3. Try the other cohort's managed URL with a student, an Academy-only administrator, a signed-out browser, an unknown `htc-` slug and an old invitation key. Each must remain denied. Leadership role alone does not open private cohort classes.
4. Remove the student's cohort membership and verify subsequent state/record/material reads and new meeting tokens fail. **Access revocation does not itself expel a participant already connected to the video provider.** Use the host's remove/end controls for an active call; automatic provider eviction is a separate operational integration. Previously downloaded files or issued media URLs also cannot be recalled by database RLS.
5. Verify an unpublished recording stays private. After the instructor publishes it, current authorized cohort members can review it even if they missed the class. Cross-cohort and revoked members cannot obtain the recording through the application. Provider media URLs require suitable hosting/access controls if revocation must invalidate previously issued links.

Session attendance is derived from `ea_room_members` on the dedicated room. The existing Edge join service writes this record when it issues a meeting participant token; it is evidence of authorized session entry, not proof of a completed media connection, physical presence or time attended. Presence duration is separately reported by the existing room heartbeat. A published replay or an ordinary page view does not create session attendance. In `?demo=...`, only an explicitly labeled rehearsal action simulates attendance, stored in localStorage; it never starts conferencing or modifies live attendance.

The sample storage key changed to `ht-campus-demo-v2` for the new classroom schema. Jordan belongs to Morgan's AI Literacy cohort; Cameron belongs to Riley's separate Digital Storytelling cohort. Sample schedules include parallel cohort sessions, a follow-up, a campus gathering and a recording-details preview without an actual media file. These sample schedules never set a room live merely because its scheduled time arrives.

### Room authorization audit

The classroom migration replaces public permission functions in place, retaining their OIDs so existing policies use the new checks. Original behavior is copied into an unexposed private schema for nonmanaged rooms. Any stored room with the `htc-` prefix is managed, even when its session mapping is missing. Authorized identity is an active database HT member plus the active cohort roster, assigned instructor or HT administrator; Academy administrator status, stored host emails and invitation keys grant no managed access.

The guarded surface includes `ea_room_state`, `ea_room_is_host`, `ea_room_in_session`, `ea_class_can`, `ea_class_is_host`, `ea_room_reader`, host-email editing and link rotation. Existing publish-replay, transcript-write, presence-heartbeat, scoring and realtime-channel checks delegate to those replaced permission helpers. Direct room identity edits are blocked for managed rooms; normal host live/end, capacity and warm-up controls remain available. Restrictive RLS policies close older permissive OPIL program-team/uploader branches on class records, hands, materials and their room-prefixed storage objects. Help and attendance reporting RPCs explicitly filter their definer results; managed names use the campus directory and do not expose OPIL registration fields or Auth email addresses. The OPIL-only external help-email handler remains OPIL-only.

Keep `ht_private` outside exposed schemas. Review any future room helper, service-role endpoint, table policy or storage-prefix change against this managed-room boundary. The database tests use deliberately permissive legacy fixtures as well as real function bodies to catch bypasses, but hosted security advisors and real provider rehearsal remain required before production activation.
