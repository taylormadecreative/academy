# HT Hub presidential demo

This build is a working campus-hub pilot: cohort classrooms, learning, events, student support and community in one place. It complements the university's academic LMS. The new backend is implemented and locally tested, but has not been activated on the live site.

## Open the local demonstration

Start the repository server if it is not already running:

```sh
python3 -m http.server 8871 --bind 127.0.0.1
```

Open `http://127.0.0.1:8871/ht/hub/?demo=student`.

The **View as** selector switches between Student, Staff and Leadership. All three share fictional records in this browser only. The banner stays visible so sample activity cannot be confused with university results. These roles do not grant real account access.

## A seven-minute walkthrough

1. **Today — 45 seconds.** Start with Jordan's personalized workspace. Show the next learning step, upcoming campus event, progress and support. Explain the aim: students should know what to do next and where to get help.
2. **Learning — 90 seconds.** Open the AI Literacy pathway. Answer a knowledge check; the next module unlocks. Show the project submission and explain that staff feedback and approval are required before completion. Completion records are issued by the Hub; they are not a promise of academic credit or an institutional certification.
3. **Classrooms — 60 seconds.** Open Classrooms in the navigation, then Jordan's AI Literacy cohort. Show the next session, agenda, connected learning pathway and instructor. Open a rehearsal and record a practice join. Explain that a real scheduled session uses the existing video-classroom tools, with its own room and records; this clearly labeled rehearsal does not start conferencing. Campus live events appear separately. Staff can create classrooms, manage enrollment and schedule sessions from **Manage classrooms**.
4. **Events — 45 seconds.** RSVP to a sample event, download its labeled calendar file, and demonstrate attendance check-in for the current sample session with `HT2026`. Use the Academic calendar link to show the existing published university dates and source PDF separately.
5. **Get help — 90 seconds.** Submit a fictional career or technology question as Student. Change **View as** to Staff, open the same request, assign it and reply. Return to Student and show that the response is waiting. This is the strongest cross-role workflow to rehearse.
6. **Staff — 45 seconds.** Show announcement scheduling, event creation, learning authoring and project review. Under Settings, show where Ada's finished video URL, poster and transcript can be added.
7. **Leadership — 45 seconds.** Switch to Leadership and open Insights. Show participation, learning completion and unresolved requests. The sample overview and CSV are labeled. These are lifetime participation counts, not proven retention or academic outcome measures. Leadership access does not reveal private cohort rosters or class content.

End with a proposed small pilot, a university owner, a defined student group, and agreed measures of success. Avoid presenting a campus-wide implementation as already approved.

## Ada's media

Create Ada's videos separately in your normal workflow. The Hub accepts a directly playable HTTPS video file, an optional HTTPS poster image and a written transcript in **Staff → Settings**. A HeyGen project/editor/share-page URL is not necessarily a playable media URL. Export and host the video, then test playback on the actual presentation device. The Hub does not generate new Ada footage or claim a live conversational assistant.

## Rehearsal checklist

- Use one browser for the cross-role demonstration. Different browser profiles and devices have separate sample records.
- Start with fresh demo data before rehearsal on another day. Remove only `ht-campus-demo-v2` from this origin's local storage to reset fictional events and records. Never clear unrelated Academy storage. The earlier v1 sample is left untouched.
- Have a student request, a staff response and a completed learning example ready. Keep all rehearsal text fictional.
- Test the actual laptop, projector and internet connection. The local preview is available on this computer; it is not a shareable public website.
- Keep an exported screen recording or screenshots as a backup. The new Classrooms directory is the presentation entry point. The old shared HT room is preserved under `/ht/hub/legacy-live/` for compatibility and retains its previous access behavior.

## What is still needed for real campus use

Follow [the activation guide](ht-campus-setup.md) for staging, membership provisioning, the classroom migration and Edge-function deployment. Hosted multi-user classroom testing, the real Ada media, campus access arrangements, accessibility review and the university's data-handling decisions remain release work. Canvas/SSO integration and email/push notifications are separate integrations, not included in this pilot.

## Classroom setup rehearsal

At `/ht/hub/live/?demo=staff`, choose **Manage classrooms**. Create a classroom, select it in the left list, and use **Enrollment** to add Jordan. In **Sessions**, enter a title, agenda, start and end time, and save. Return to Student: the new cohort and its schedule appear. Removing Jordan's classroom access as Staff makes both the old cohort link and its session links unavailable to Jordan.

Each real scheduled session receives a separate protected room. Learning-pathway enrollment does not grant cohort membership. Recordings are shown only after publication and for current authorized classroom members. Demo recording previews contain explanatory details, not invented video footage.

The UI is intentionally calmer and easier to navigate: five main destinations, a mobile bottom bar, clear student/staff/leadership workspaces, and readable HT academic branding. Enterprise quality will also depend on actual student usability sessions and dependable operation after activation.
