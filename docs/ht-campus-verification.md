# HT campus upgrade verification — September 21, 2026

Development branch: `codex/ht-campus-hub`. Implementation is isolated from the original Academy checkout. No production database migration or website deployment was performed.

## Automated results

| Suite | Result | What it exercises |
| --- | --- | --- |
| PostgreSQL/RLS | 308 checks passed | 83 campus, 63 classroom, 41 messaging and 121 academic checks: unique rooms, membership/instructor scope, wrong-cohort denial, legacy permission bypasses, protected records/files, replay publication, recipient-only read acknowledgement, atomic message validation, section coursework permissions, finite deadlines, extensions, attempt limits, grade revisions and draft privacy |
| Campus store | 204 checks passed | 41 campus, 34 classroom, 28 messaging and 101 academic checks: demo persistence, roster/scheduling commands, separate room records, live RPC dispatch, error behavior, identity changes, read timestamps, conversation notification links, additive demo upgrades and academic command parity |
| Student/calendar/classroom/course/onboarding views, routing and local progress | 83 tests passed | Escaping, URL handling, module locks, calendar source preservation, classroom/replay authorization, draft identities, role controls, unique session routes, own-message previews, unavailable-member history, failed-read recovery, grade calculations, extended deadlines and explicit stale-review recovery, 11 onboarding progress groups and 16 onboarding renderer/binding groups |
| Full browser application | 13 groups passed | Student→staff→student support; community and staff drafts; role navigation; ten routes at 1440, 390 and 320 pixels; initial-load sign-out; back/forward snapshot restoration |
| Staff browser module | Passed | Authoring, scheduling, knowledge-check validation, project review, settings, support handling, CSV privacy, keyboard tabs and failed-save preservation |
| Classroom browser workflow | 11 groups passed | Create cohort, enroll student, schedule session, reject invalid times, preserve drafts per cohort, restore keyboard focus after save, practice join/leave, leadership denial, revoke old links, four classroom views at 1440/390/320 pixels |
| Managed meeting/replay adapters | 7 groups passed | Unique room targets, scoped recording/materials, denied/missing/mismatched authorization, no legacy key/admin fallback, sign-in destination preservation and malformed-route denial |
| Community and messages browser workflow | 12 groups passed | Permanent navigation, unread counts, explicit thread read acknowledgement, people search, per-recipient drafts, Student→Staff→Student messages, notification links, community filters, author messaging, failed-send recovery and 1440/390/320-pixel layouts |
| Native coursework browser workflow | 13 groups passed | Publish assignment, student submission, private draft grading, published feedback, resubmission history, draft preservation, stale-grade rejection and explicit recovery, personal extension/clear, unauthorized links and eight views at 1440/390/320 pixels |
| Student and staff onboarding browser workflow | 12 groups passed | First-visit invitation, skip/resume/restart, role separation, whole-site search, real guided visits, explicit completion, draft preservation, office return links, keyboard use and 1440/390/320-pixel layouts |
| Edge join/record/summary handlers | 134 tests passed | Legacy OPIL/team behavior, managed membership/host gates, exact meeting isolation, unavailable-service denial, replay-room matching and concurrent instructor starts |
| Existing HT live/replay/OPIL harness | 176 checks passed | Existing joins, host actions, recording lifecycle, replay permissions and files, real room-module scenarios using a fake meeting client, mobile layout |

View/local-progress and all application browser suites were rerun for onboarding. Database and store results are retained from the preceding coursework milestone; onboarding changes no database or campus command logic. Edge and legacy-harness results are retained from the preceding classroom verification; their implementations are unchanged.

Browser tests used Chrome, fresh browser contexts and fictional data/stubbed services. The new application integration suite blocks external requests. No test created a real student record or contacted a production meeting.

## Visual review

Desktop Today, staff authoring and leadership views were inspected, along with phone learning, support, events and Today views. Classroom review covers the directory, cohort schedule, instructor editor and rehearsal on desktop and phones. Final polish addressed directory density, narrow header wrapping, phone date/time inputs, minimum button targets, footer contrast, keyboard focus after saving and drafts that stay with their own cohort. Manual browser interaction confirmed that a successful knowledge check updates progress and unlocks the next module.

Communication review covers desktop Community, phone inbox and open conversations. The phone composer and Send button stay above the fixed navigation at the tested viewport sizes. An inbox preview does not mark messages read; opening the conversation acknowledges only its displayed incoming messages. Drafts remain attached to their recipient. Existing private history remains readable when a counterpart leaves the active directory, while further sending is disabled.

Coursework visual review covers the course directory, overview, modules, student submission, grades, assignment editor, instructor review and gradebook. Existing assignment settings are collapsed; the latest submitted work appears before grading. The course header is compact, and forms and horizontally scrollable gradebooks fit the tested phone widths.

Onboarding visual review covers student and staff guides, contextual course guidance, the searchable site map and the permanent Guide link on phones. The invitation does not block the requested page. Closing guidance preserves ordinary form drafts, and the checklist labels page exploration separately from academic completion.

The HTML build completes successfully and `git diff --check` is clean. The three Edge entry points passed Deno type checks in the preceding classroom verification. Reproduce the checks with the scripts in `tools/ht-campus-tests/package.json`, `deno test --cached-only supabase/functions/ea-rtk-join/ supabase/functions/ea-rtk-record/ supabase/functions/ea-class-summary/`, and `HT_TEST_BASE_URL=http://127.0.0.1:8871 node tests/ht/harness/ht-room.mjs`.

## Boundaries of this verification

This is local verification, not a hosted deployment certification. The PGlite checks use a single database connection; they do not certify multi-connection transaction contention. Staging PostgREST/Auth, simultaneous real accounts, actual conferencing/recording, Ada video hosting/playback, a physical iPhone, screen-reader usability, production load and institutional security/data handling still require validation. Existing session-entry attendance records are created when a meeting token is issued; they do not prove completed media connection or time attended. Revoking membership blocks new access but does not expel an already connected video participant or recall previously issued media URLs. See [activation and setup](ht-campus-setup.md) and [the presidential demo guide](ht-campus-demo-guide.md).
