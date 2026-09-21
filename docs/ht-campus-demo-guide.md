# HT Hub presidential demo

Taylormade Academy / HT Hub is being developed as a standalone learning and campus platform. This pilot brings cohort classrooms, learning, events, student support and community together; native section assignments, submission attempts and a points-based gradebook are now implemented locally. Rich quizzes, rubrics, weighted grading and file submissions remain roadmap work. Canvas integration is not planned. See the [standalone LMS roadmap](ht-standalone-lms-roadmap.md). The new backend is implemented and locally tested, but has not been activated on the live site.

## Open the local demonstration

Start the repository server if it is not already running:

```sh
python3 -m http.server 8871 --bind 127.0.0.1
```

Open `http://127.0.0.1:8871/ht/hub/?demo=student`.

The **View as** selector switches between Student, Staff and Leadership. All three share fictional records in this browser only. The banner stays visible so sample activity cannot be confused with university results. These roles do not grant real account access.

## A nine-minute walkthrough

1. **Today — 45 seconds.** Start with Jordan's personalized workspace. Show the next learning step, upcoming campus event, progress and support. Explain the aim: students should know what to do next and where to get help.
2. **Community and Messages — 60 seconds.** Show Community and Messages in the main navigation and phone bottom bar. In Community, filter conversations or use **Message author** to open a private conversation. In Messages, choose **New message**, find Morgan, and send a fictional project question. Switch **View as** to Staff, open Jordan's conversation and reply; switch back to Student to show the unread count and response. Opening the conversation clears its unread badge. Point out the conversation previews on Today.
3. **Courses and grading — 120 seconds.** Open Learning, then Jordan’s AI Literacy section. Show Overview, Modules, Assignments and Grades together. Open “Responsible AI project brief” and submit a fictional response. Switch to Staff, open the same section’s assignment and review Jordan’s submission. Save a draft score and feedback; explain that draft grading is private. Publish the grade, switch back to Student, and show the result and feedback in Grades. Explain that ungraded work stays pending, an excused assignment is excluded, and a zero must be explicitly graded. The Classroom link opens the section’s existing live classroom. Learning pathways remain available from the Learning navigation and retain their separate knowledge checks and approval-based completion records; those records are not a promise of academic credit.
4. **Classrooms — 60 seconds.** Open Classrooms in the navigation, then Jordan's AI Literacy cohort. Show the next session, agenda, connected learning pathway and instructor. Open a rehearsal and record a practice join. Explain that a real scheduled session uses the existing video-classroom tools, with its own room and records; this clearly labeled rehearsal does not start conferencing. Campus live events appear separately. Staff can create classrooms, manage enrollment and schedule sessions from **Manage classrooms**.
5. **Events — 45 seconds.** RSVP to a sample event, download its labeled calendar file, and demonstrate attendance check-in for the current sample session with `HT2026`. Use the Academic calendar link to show the existing published university dates and source PDF separately.
6. **Get help — 90 seconds.** Submit a fictional career or technology question as Student. Change **View as** to Staff, open the same request, assign it and reply. Return to Student and show that the response is waiting. Rehearse this alongside the private message workflow.
7. **Staff — 45 seconds.** Show announcement scheduling, event creation, learning authoring and project review. Under Settings, show where Ada's finished video URL, poster and transcript can be added.
8. **Leadership — 45 seconds.** Switch to Leadership and open Insights. Show participation, learning completion and unresolved requests. The sample overview and CSV are labeled. These are lifetime participation counts, not proven retention or academic outcome measures. Leadership access does not reveal private cohort rosters or class content.

End with a proposed small pilot, a university owner, a defined student group, and agreed measures of success. Avoid presenting a campus-wide implementation as already approved.

## Ada's media

Create Ada's videos separately in your normal workflow. The Hub accepts a directly playable HTTPS video file, an optional HTTPS poster image and a written transcript in **Staff → Settings**. A HeyGen project/editor/share-page URL is not necessarily a playable media URL. Export and host the video, then test playback on the actual presentation device. The Hub does not generate new Ada footage or claim a live conversational assistant.

## Rehearsal checklist

- Use one browser for the cross-role demonstration. Different browser profiles and devices have separate sample records.
- Start with fresh demo data before rehearsal on another day. Remove only `ht-campus-demo-v2` from this origin's local storage to reset fictional events and records. Never clear unrelated Academy storage. The earlier v1 sample is left untouched.
- Have a student request, a staff response and a submitted coursework example ready. Rehearse saving draft feedback and then publishing it. Keep all rehearsal text fictional.
- Test the actual laptop, projector and internet connection. The local preview is available on this computer; it is not a shareable public website.
- Keep an exported screen recording or screenshots as a backup. The new Classrooms directory is the presentation entry point. The old shared HT room is preserved under `/ht/hub/legacy-live/` for compatibility and retains its previous access behavior.

## What is still needed for real campus use

Follow [the activation guide](ht-campus-setup.md) for staging, membership provisioning, the classroom, messaging and coursework migrations and Edge-function deployment. Hosted multi-user coursework, classroom and messaging testing, the real Ada media, campus access arrangements, accessibility review and the university's data-handling decisions remain release work. Messages refresh on focus and the existing polling cycle; instant delivery, typing indicators and read receipts are not claimed. Institutional single sign-on and email/push notifications are not included in this pilot. The [standalone LMS roadmap](ht-standalone-lms-roadmap.md) defines the native academic features needed for a full LMS.

## Native course setup rehearsal

Use **Classrooms → Manage classrooms** to create a section and enroll Jordan. Optionally connect an existing learning pathway to supply lessons. Open the same section under **Learning → My courses**, choose Assignments, and create an assignment with points and dates. Save a draft, then publish it when ready. Return to Student to submit text or an HTTPS project link. As the section’s instructor, review the submission, save private draft grading or publish it, and check the section gradebook. Deadline extensions are per student. No real academic record is created in demo mode.

## Classroom setup rehearsal

At `/ht/hub/live/?demo=staff`, choose **Manage classrooms**. Create a classroom, select it in the left list, and use **Enrollment** to add Jordan. In **Sessions**, enter a title, agenda, start and end time, and save. Return to Student: the new cohort and its schedule appear. Removing Jordan's classroom access as Staff makes both the old cohort link and its session links unavailable to Jordan.

Each real scheduled session receives a separate protected room. Learning-pathway enrollment does not grant cohort membership. Recordings are shown only after publication and for current authorized classroom members. Demo recording previews contain explanatory details, not invented video footage.

The UI is intentionally calmer and easier to navigate: five main destinations, a mobile bottom bar, clear student/staff/leadership workspaces, and readable HT academic branding. Enterprise quality will also depend on actual student usability sessions and dependable operation after activation.
