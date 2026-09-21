# HT Hub student and staff onboarding

The optional guide is available from **Guide** in the header and **Find your way** at the bottom of the campus workspace. Office preview pages also link back to it. The local demonstration is at `http://127.0.0.1:8871/ht/hub/welcome/?demo=student`; use the View as selector to compare Student and Staff.

## First useful task

For a student, the first-session goal is to find their enrolled course and its next assignment. For an instructor, it is to find a section they teach and the assignment/review tools. Staff without teaching assignments can continue to publishing, communication and support tools. The guide never assigns a course or changes someone’s campus role.

A first visit offers a small invitation without hiding the requested page. **Not now** dismisses it. The guide’s main action opens the first suggested destination; a short contextual panel explains what to do there and links to the next stop. The guide can be closed at any time and reopened from the header. **Explore on my own** saves that choice and opens Today.

## Role-specific stops

| Student | Staff |
| --- | --- |
| My courses | Teaching workspace |
| Classrooms | Classroom organization |
| Community | Publishing tools |
| Messages | Community |
| Events | Messages |
| Get help | Student support |
| Around campus | Campus insights |

Leadership receives a smaller guide for insights, community and campus resources. Signed-out, unavailable or inactive accounts receive a general site map without personal progress or staff controls. Guide links never replace the destination’s membership and section permissions.

## Whole-site navigation

**Find any page** jumps directly to a searchable map of Today, courses, learning pathways, classrooms, community, messages, events, the academic calendar, support and campus offices. Staff and leadership receive additional destinations appropriate to their roles. Office pages remain labeled previews. On phones, guidance stays out of an open conversation so the composer remains visible; Guide remains available in the header. Search supports practical terms such as assignments, DM, academic, career and settings, and explains an empty result.

The written help covers phone navigation, missing courses, courses versus pathways, privacy and sign-in. Ada’s recorded welcome can be opened from Today when a video is configured; the written guide works without a video.

## Progress and privacy

Progress means **places explored**, not submitted work or completed academic tasks. Opening a valid guided destination records a visit. Completing the guide requires visiting all its stops and choosing **Finish my guide**. Closing it preserves progress; restarting clears only that guide.

Progress is stored in this browser, separately for the actual account, membership role and demo/live mode. The storage key begins `ht-hub-onboarding:v1:`. The value contains only its version, status, known visited step IDs and current step. It does not synchronize between devices. Blocked or corrupt storage falls back to an in-memory guide with an explanatory message. Search text is kept only in page memory and stays scoped to the account and role.

The guide itself does not send messages, publish posts, submit assignments, grade work, enroll students or RSVP. Normal destination behavior still applies: for example, opening a conversation may acknowledge its displayed messages as read.

This is a frontend addition and requires no new database migration. Deploy the generated welcome page, updated campus modules and shell styles together. The existing live campus backend must already be activated for actual member workflows.

## Rehearsal and validation

1. Open Today as Student in a fresh browser context. Use Start guide, or dismiss the invitation and reopen Guide.
2. Choose Find my courses. Open the course and assignment, then close the guide while a response is in progress; the response remains in place.
3. Reopen Guide and follow its remaining stops. Finish the guide, reload, then restart it to confirm the choice persists.
4. Switch to Staff and show the separate teaching, publishing and support instructions.
5. Search for messages, academic calendar and a campus office. Check that returning from the office preserves the demo role.
6. Repeat the main flow with a keyboard and at phone width.

Automated checks cover progress isolation and storage failures, role-aware rendering, search, skip/resume/restart, truthful completion, draft preservation, valid destinations, keyboard interaction and 1440/390/320-pixel layouts. Physical-device and screen-reader sessions remain useful follow-up validation.

To evaluate onboarding with students and staff, observe whether each person finds their first relevant course or staff task, how long that takes, and where they need help. Compare those outcomes with guide start and completion rates only after an institution-approved analytics design exists. The current build does not send onboarding analytics or automated emails.
