# HT campus data setup and verification

The development upgrade is implemented locally. **The new database migration has not been applied to the live Academy project.** Until activation, authenticated users see an explicit unavailable message rather than simulated success. `?demo=student`, `?demo=staff`, and `?demo=leadership` run isolated fictional data in the browser; these switches never grant database permissions.

## What is implemented

- Active institutional membership with student, staff, administrator and leadership roles. Existing Academy accounts receive no automatic campus membership.
- Shared records for learning, assignments and feedback; event RSVP and check-in; support cases and replies; announcements; community posts, replies and likes; private member messages; personal in-app notifications; and separately supplied Ada video configuration.
- Staff publication of drafts and scheduled announcements. A scheduled announcement becomes readable once its persisted `publish_at` arrives; no email or push scheduler is implied.
- Server-enforced enrollment, module order, correct knowledge-check answers and staff approval. A credential UUID and completion timestamp are issued only after every requirement is complete. Withdrawing approval clears that completion and dependent progress, and permits dependent assignments to be revised and resubmitted.
- Leadership receives aggregate counts. The leadership role does not confer access to other students' individual support cases, submissions, attendance, enrollments or messages.
- Server audit metadata for each successful command, without copying private message or request bodies into the log.

## Files

- `supabase/migrations/20260921180637_ht_campus_hub.sql`: additive tables, RLS, read/state API and validated command API.
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

The database suite checks real policy/privilege denial, not just SQL text patterns. It covers anonymous access, nonmember denial, self-promotion attempts, direct completion forgery, student isolation, private messages, leadership privacy, scheduling, capacity, event code and time validation, learning order, wrong answers, approval/completion/revocation, dependent assignment recovery, member deactivation, and idempotent content seeding. Store tests cover the same core demo flows and production RPC dispatch/error behavior.

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

The demo contains fictional Jordan R., Morgan T., Avery W. and Cameron L. Every role shares only the `ht-campus-demo-v1` localStorage record on that browser origin. Clearing this key resets the demonstration. It does not clear or alter live records. Demo event times are relative to the first fixture creation; a saved demo retains its dates. Reset this sample record before rehearsing on another day. The sample current-session check-in code is `HT2026`.

Real events always use stored timestamps. RSVP capacity is guarded by a database row lock. Check-in requires a valid code, a current RSVP, and a time between 30 minutes before the start and two hours after the end. It does not prove physical location or prevent a participant from sharing a code.

The live client refreshes on focus and approximately every 15 seconds while visible. This is polling, not instant push delivery. The shell should defer noncritical refresh while a form is dirty and force an identity refresh on actual sign-out/account change. Store auth events include `{ reason: 'auth', event, user_id }` for that purpose; the same-identity `SIGNED_IN` event can occur on refocus and should not discard a draft.

Learning content is locked once anyone enrolls. Create a new pathway version for changed requirements; this prevents editing a course out from under issued completion records. Course metadata and publication state can still be edited. Knowledge checks provide correct/incorrect feedback rather than revealing the answer in a live student response.

## Limits to address before a broad campus rollout

- No SSO, SIS/Canvas/LTI synchronization, cross-institution tenancy, public credential verification endpoint, transcript export standard or production deployment is claimed. Credential records are currently verified inside the authenticated campus/staff experience or database.
- No email/push notifications, automatic calendar invitations, appointment booking, secure file-upload workflow, content moderation console or AI model/chat service is included. Assignment links and text are supported. Ada is a supplied video plus transcript and useful navigation, not a synthesized live assistant.
- One HT institution is supported. The `ht_` namespace is separated from Academy/OPIL tables, but it is not a multi-university tenant schema.
- Staff/admin have access to campus support and submitted work. This pilot supports general learning/career/technology/campus-life requests; narrower office permissions and university-approved handling are needed before placing counseling, disability, health or similarly restricted records here.
- State loading currently returns the user's full permitted dataset. Add pagination, incremental synchronization, query/load budgets, retention policies and operational monitoring before large-scale use. The current leadership metrics are lifetime counts; `active_learners` means distinct enrolled members, not activity within a specified time window.
- Add service-side abuse controls/rate limits and check-in attempt limits before public-scale use. The RPC validates membership, ownership, payload size and requirements, but it is not an anti-spam system.
- Production backup/restore verification, institutional data governance, security review, accessibility testing and iPhone/live-session rehearsal remain release tasks. No compliance certification is asserted by these local checks.
