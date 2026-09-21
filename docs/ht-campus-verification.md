# HT campus upgrade verification — September 21, 2026

Development branch: `codex/ht-campus-hub`. Implementation is isolated from the original Academy checkout. No production database migration or website deployment was performed.

## Automated results

| Suite | Result | What it exercises |
| --- | --- | --- |
| PostgreSQL/RLS | 146 checks passed | 83 campus checks plus 63 classroom checks: unique rooms, membership/instructor scope, wrong-cohort denial, legacy permission bypasses, protected records/files, replay publication and revocation |
| Campus store | 75 checks passed | 41 campus checks plus 34 classroom checks: demo persistence, roster/scheduling commands, separate room records, live RPC dispatch, error behavior and identity changes |
| Student/calendar/classroom views and routing | 34 tests passed | Escaping, URL handling, module locks, calendar source preservation, classroom/replay authorization, draft identities, role controls and unique session routes |
| Full browser application | 13 groups passed | Student→staff→student support; community and staff drafts; role navigation; ten routes at 1440, 390 and 320 pixels; initial-load sign-out; back/forward snapshot restoration |
| Staff browser module | Passed | Authoring, scheduling, knowledge-check validation, project review, settings, support handling, CSV privacy, keyboard tabs and failed-save preservation |
| Classroom browser workflow | 11 groups passed | Create cohort, enroll student, schedule session, reject invalid times, preserve drafts per cohort, restore keyboard focus after save, practice join/leave, leadership denial, revoke old links, four classroom views at 1440/390/320 pixels |
| Managed meeting/replay adapters | 7 groups passed | Unique room targets, scoped recording/materials, denied/missing/mismatched authorization, no legacy key/admin fallback, sign-in destination preservation and malformed-route denial |
| Edge join/record/summary handlers | 134 tests passed | Legacy OPIL/team behavior, managed membership/host gates, exact meeting isolation, unavailable-service denial, replay-room matching and concurrent instructor starts |
| Existing HT live/replay/OPIL harness | 176 checks passed | Existing joins, host actions, recording lifecycle, replay permissions and files, real room-module scenarios using a fake meeting client, mobile layout |

Browser tests used Chrome, fresh browser contexts and fictional data/stubbed services. The new application integration suite blocks external requests. No test created a real student record or contacted a production meeting.

## Visual review

Desktop Today, staff authoring and leadership views were inspected, along with phone learning, support, events and Today views. Classroom review covers the directory, cohort schedule, instructor editor and rehearsal on desktop and phones. Final polish addressed directory density, narrow header wrapping, phone date/time inputs, minimum button targets, footer contrast, keyboard focus after saving and drafts that stay with their own cohort. Manual browser interaction confirmed that a successful knowledge check updates progress and unlocks the next module.

The HTML build completes successfully, `git diff --check` is clean, and all three changed Edge entry points pass Deno type checks. Reproduce the checks with the scripts in `tools/ht-campus-tests/package.json`, `deno test --cached-only supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-class-summary/`, and `HT_TEST_BASE_URL=http://127.0.0.1:8871 node tests/ht/harness/ht-room.mjs`.

## Boundaries of this verification

This is local verification, not a hosted deployment certification. Staging PostgREST/Auth, simultaneous real accounts, actual conferencing/recording, Ada video hosting/playback, a physical iPhone, screen-reader usability, production load and institutional security/data handling still require validation. Existing session-entry attendance records are created when a meeting token is issued; they do not prove completed media connection or time attended. Revoking membership blocks new access but does not expel an already connected video participant or recall previously issued media URLs. See [activation and setup](ht-campus-setup.md) and [the presidential demo guide](ht-campus-demo-guide.md).
