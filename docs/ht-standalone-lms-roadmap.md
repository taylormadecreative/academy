# Taylormade Academy / HT Hub: standalone LMS roadmap

Product direction confirmed by Nelson Taylor on September 21, 2026.

## Product goal

Taylormade Academy will own the learning experience: courses, enrollment, assignments, assessment, grades, live teaching, feedback and completion records. HT Hub brings that academic experience together with university community, communication, events and student support.

Canvas integration is not part of this plan. Essential academic workflows must work entirely inside this platform. The current build is an early implementation; this roadmap does not claim that a complete institutional LMS or a production rollout already exists.

Success means students can find their next task and get help quickly, instructors can run a course without duplicate work, and campus staff can operate the system reliably. Compare those outcomes in observed student and instructor sessions before claiming the platform is better than established alternatives.

## Existing foundation

- Published learning pathways with ordered modules, knowledge checks, project responses, instructor feedback and approval-based completion records.
- Cohort classrooms, scoped rosters, scheduled sessions, dedicated room authorization and published replay access.
- Campus events, RSVP/check-in, support requests, staff announcements and aggregate leadership counts.
- Community posts and replies, one-to-one text messages, unread counts, member search and phone navigation.

The current learning enrollment and classroom membership models are separate. Legacy pathway reviews retain their existing campus-staff scope; new section assignments and grades use assigned-instructor scope. The first native coursework milestone adds section assignments with deadlines, attempts, extensions and published/draft points-based grading. Weighted grading, a rich quiz engine and general secure assignment uploads remain native product work.

The backend has been tested locally. Hosted activation and real multi-account verification remain required; sample-browser behavior is not evidence of a production deployment.

## Build sequence

### 1. Complete one native course from enrollment to final grade

Implemented locally in the first milestone; hosted activation and real-account verification remain pending. The course workspace includes **Overview, Modules, Assignments, Grades, People and Classroom**, with controls appropriate to the viewer's role.

- Establish course sections, assigned instructors and enrollments. Define how each section connects to a cohort classroom. A student joining a learning pathway must not silently acquire access to a private classroom or another section's records.
- Add published assignments with instructions, points possible, availability/due/close dates, student-specific extensions and submission attempts. Start with text and links; add protected file submissions as a separately verified capability.
- Add instructor grading with points, feedback and explicit grade publication. Student grades show only that student's work and published feedback.
- Preserve distinct states for not submitted, submitted, late, graded and excused. An ungraded assignment is not silently treated as a zero. Publish clear grading rules and calculation behavior before introducing weighted categories.
- Separate numeric academic grades from the existing pathway completion/approval rules. Changing one must not silently issue or revoke the other.
- Give instructors a submission queue and section gradebook. Changes record who made them and when. Students can see what was submitted, what is due and what feedback needs action.

Acceptance: an instructor creates and publishes an assignment; an enrolled student submits; the instructor grades and publishes feedback; the student sees the correct result and next step. An unrelated student or instructor cannot open the submission or grades. A failed save preserves the draft. The entire workflow works by keyboard and on a phone.

### 2. Give instructors a complete teaching toolkit

- Reusable grading rubrics, weighted assignment categories and an explained final-grade calculation.
- Question banks, multiple question types, attempts, quiz timing and individual adjustments. Keep scoring and answer access enforced by the backend.
- Course copying, reusable templates, publication previews and content versioning that preserves completed work.
- Protected assignment uploads, feedback on submitted files, and accessible learning materials.
- Instructor-managed group work and peer review with explicit access boundaries.

Acceptance: an instructor can run a second section from a reusable course template, assess varied work and explain every student's grade without a separate spreadsheet.

### 3. Connect academic work with everyday campus life

- Persistent membership-based spaces for classes, clubs, study groups and mentoring; shared resources and group conversations continue between live sessions.
- Message/reply notifications, optional push/email, attachments and personal notification controls. Include report, block, mute and a staff moderation workflow.
- **My Week** combines native assignment deadlines, class sessions, campus events, appointments and personal tasks, with direct actions for each item.
- Appointment booking for tutoring, academic advising, instructor office hours and career support.
- Permission-scoped search and saved resources across the Hub.

Acceptance: a student can find a deadline, ask their class a question, join the scheduled session and arrange help without losing the context of their course.

### 4. Add distinctive learning and career value

- Ada text assistance grounded in approved course/campus resources, with source links and a clear handoff to a person. Nelson's independently produced HeyGen videos remain separate media. Assistance must respect published course materials and assessment restrictions.
- Student-controlled portfolios containing projects, approved skills, leadership and service experiences.
- Verifiable achievement records with clear issuer and criteria; distinguish these from university credit and official transcripts.
- Useful progress insights for students and assigned instructors, and aggregate trend reporting for leadership. Measure actual usage, response times, completion and student feedback; do not present activity counts as proof of retention impact.

## Quality and operating requirements throughout

- Accessible navigation, captions/transcripts, readable content and tested keyboard/screen-reader workflows.
- Clear student, instructor, office and administrator permissions, including a usable membership-management screen.
- Reliable saved work, visible error recovery, efficient loading as records grow, and a tested backup/restore process.
- Real-device and simultaneous-account testing for teaching, messaging, grades and video sessions.
- A small, observed pilot before broader release. Students and instructors should be able to complete common tasks without Nelson explaining the interface.

## Presidential demonstration

Present the vision as **a standalone learning and campus platform built around the student journey**. Demonstrate only completed behavior, using clearly labeled sample records. Show one coherent academic workflow alongside community and support; identify planned capabilities explicitly.

The native course/assignment/gradebook workflow is implemented locally. Instructor tools such as rubrics and weighted grading, then group spaces and My Week, build on that academic foundation. The long-term ambition does not depend on another LMS.
