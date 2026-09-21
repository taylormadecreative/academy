# HT campus upgrade verification — September 21, 2026

Development branch: `codex/ht-campus-hub`. Implementation is isolated from the original Academy checkout. No production database migration or website deployment was performed.

## Automated results

| Suite | Result | What it exercises |
| --- | --- | --- |
| PostgreSQL/RLS | 83 checks passed | Exact migration in local PGlite; real role/privilege denial, ownership, enrollment order, answers, reviews, event capacity, check-in, leadership privacy and content seeding |
| Campus store | 41 checks passed | Demo persistence, live RPC dispatch, error behavior, sign-out races and account-switch write protection |
| Student/calendar views | 13 tests passed | Escaping, URL handling, module locks, completion rendering, calendar export, original academic dates and source preservation |
| Full browser application | 13 groups passed | Student→staff→student support; community and staff drafts; role navigation; nine routes at 1440, 390 and 320 pixels; initial-load sign-out; back/forward snapshot restoration |
| Staff browser module | Passed | Authoring, scheduling, knowledge-check validation, project review, settings, support handling, CSV privacy, keyboard tabs and failed-save preservation |
| Existing HT live/replay/OPIL harness | 176 checks passed | Existing joins, host actions, recording lifecycle, replay permissions and files, real room-module scenarios using a fake meeting client, mobile layout |

Browser tests used Chrome, fresh browser contexts and fictional data/stubbed services. The new application integration suite blocks external requests. No test created a real student record or contacted a production meeting.

## Visual review

Desktop Today, staff authoring and leadership views were inspected, along with phone learning, support, events and Today views. Final polish addressed narrow header wrapping, minimum button targets, duplicate disclosure icons, module-status spacing, footer contrast and persistent form drafts. Manual browser interaction confirmed that a successful knowledge check updates progress and unlocks the next module.

## Boundaries of this verification

This is local verification, not a hosted deployment certification. Staging PostgREST/Auth, simultaneous real accounts, actual Ada video hosting/playback, a physical iPhone, screen-reader usability, production load and institutional security/data handling still require validation. See [activation and setup](ht-campus-setup.md) and [the presidential demo guide](ht-campus-demo-guide.md).
