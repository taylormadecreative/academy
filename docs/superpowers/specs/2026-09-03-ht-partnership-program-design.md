# Huston-Tillotson × Taylormade Academy — campus partnership program (design of record)

Date: 2026-09-03. For the Fri Sep 4, 10:00 AM CT call with Linda Y. Jackson (VP, Institutional Advancement).
Status: DEMO SLICE for the meeting. The production program (own tables, real cohorts, per-office admin) is
specced after Linda says which offices care.

## Why
HT can run the jobs that usually live on separate rented subscriptions (event app, live seminars, community,
cohort programs, showcase, newsletters, sponsored seats, a phone app) on one HT-branded platform, in partnership
with Taylormade Academy, the way the AUC Open Payments Innovation Lab already does at /opil/. White-label is a
later option (theme switch), not the shape of the deal.

## What is real vs. sample (say it on the call)
- REAL: Academy accounts and sign-in, the branded live player (demo stream, $0), the pattern already running for AUC
  (registration, hub, sessions, check-in, materials, surveys, messages, judging, showcase, admin).
- SAMPLE (labeled on every page): all HT content, names, events, figures. No HT tables in the production database.
- ROADMAP (never promised as built): certificates, ticketing/RSVP with QR, push notifications, online giving.
- NEVER: replace Canvas/Blackboard. This is everything around the classroom.

## Information architecture (all under taylormadeacademy.com/ht/, all `noindex`, not in sitemap)
Public
- `/ht/`            Program page. Lockup "Huston-Tillotson × Taylormade Academy". Offices-and-uses map. Ada as host.
- `/ht/fund/`       Fund a cohort (mirrors /sponsor/): seat blocks, one invoice, no student pays. NO prices.
The HT Hub (renders for everyone as a preview; greets by name when signed in)
- `/ht/hub/`             Home: Ada announcement, this week, spaces grid.
- `/ht/hub/advancement/` Donor pages (links to the ht-advancement mockups), President's donor briefing, donor
                         weekend, fund-a-cohort, alumni giving. Linda's home base; first in the grid.
- `/ht/hub/president/`   Town halls live + replay, Ada campus announcements, President's messages.
- `/ht/hub/events/`      Event app: Donor Appreciation Weekend (sample), Homecoming 2027, Orientation Week,
                         Founders' Day. Agenda, speakers, announcements, check-in code, attendees + messages, .ics.
- `/ht/hub/live/`        Live room on the demo stream + replay shelf (briefing, town hall, faculty dev, guest lecture).
- `/ht/hub/learn/`       Co-curricular tracks: AI Literacy, Entrepreneurship, Financial Literacy. Sessions, materials,
                         progress, "certificate issued by HT" shown as a sample state.
- `/ht/hub/community/`   Channels, feed, DMs, leaderboard (local sample).
- `/ht/hub/showcase/`    Student projects + undergraduate research showcase with judges' scoring.
- `/ht/hub/students/`    Student Affairs: orientation week schedule + check-in, student orgs, leadership programs,
                         seminar series with attendance.
- `/ht/hub/career/`      Career Services: employer showcase, portfolio/resume directory, mock-interview seminars.
- `/ht/hub/alumni/`      Alumni Relations: chapter hubs (Austin, DFW, Houston), reunion, mentorship, lifelong learning.
- `/ht/hub/admissions/`  Admitted-student community, yield events live, parent sessions.
- `/ht/hub/outreach/`    Community outreach: public education series, partner programs, summer bridge.
- `/ht/hub/board/`       Board of Trustees + Foundation portal: meeting materials, agenda, check-in, announcements.
Phone app
- `/ht/manifest.webmanifest` scope `/ht/`, start_url `/ht/hub/`, name "HT Hub", theme #660100, HT icons; every HT
  page carries the manifest link, `apple-touch-icon`, and `apple-mobile-web-app-title`. Root sw.js already covers /ht/.

## Brand
Academy frame (header, footer, Space Grotesk + Inter, build-mode.css tokens) + HT accent pair inside the program:
maroon #660100, gold #FFCC00, ember #F7E3B8, sand #FFFAEB, mahogany #3B0000. HT academic wordmark + monogram only.
No Ram head, no Rams wordmark, no Presidential Seal. HT's own photography and the campaign renderings. Ada from the
donor deck assets. Never a real student's face beside a sample name: people are initials, project art is campus imagery.

## Architecture (files)
- `ht/ht.css`          program + hub styles on Academy tokens (loads after build-mode.css)
- `ht/hub/data.js`     ONE sample-content object `HT` for every space (blocks per page)
- `ht/hub/ht.js`       runtime: optional-session boot, block renderers, local check-in/chat/DM/.ics/print, PWA head
- `ht/hub/<space>/index.html`  thin shells: head + Academy header + `<main data-space="…">` + scripts
- `ht/index.html`, `ht/fund/index.html`  public pages, hand-written
- `ht/img/`            staged assets (done), icons generated with PIL
Block types the renderer supports: intro, stats, cards, agenda, people, announcements, materials, tracks, feed,
chat, checkin, replays, player, directory, timeline, calendar, cta. A space = ordered list of blocks + tabs.

## Interactions that must work on the call
Sign in with Nelson's account greets him by name. Check-in code accepts the sample code. Live room plays the demo
stream. Chat/DM post locally. .ics downloads. 390px phone view is first-class. Print gives a clean agenda.

## Deploy + verify
Commit on `domain-migration`, `git push origin domain-migration:main` (Pages serves main). Verify live with
Playwright at 1440 and 390, every space, console clean, manifest 200, all images 200. 4-agent review before the
link goes to Nelson (web dev, art director, advancement/marketing, UX). Then PREP.md §11 (the reveal, lane
framing, never-say), stewardship mockup gets one line tying the gift to a named HT cohort, PDFs regenerated.

## Build order
1 foundation (css, data schema, runtime, hub home, advancement space as exemplar) → 2 fan-out spaces in parallel
(events+live+president · learn+showcase+career · students+admissions+outreach · alumni+board+community) →
3 public program page + fund page + manifest/icons → 4 review panel → 5 deploy + live verify → 6 PREP + stewardship
line + memory.
