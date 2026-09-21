# Native coursework implementation contract

This milestone adds a course workspace at `/ht/hub/courses/`, using existing cohorts as course sections and their `course_id` as the optional reusable learning curriculum. Cohort enrollment grants section coursework access; open-pathway enrollment alone does not. Existing pathway completion stays independent of numeric coursework grades.

## State and records

Extend `ht_campus_state()` and the demo store with four arrays:

- `assignments`: `{id,cohort_id,title,instructions,points_possible,opens_at,due_at,closes_at,max_attempts,status,created_by,created_at,updated_at}`. Points positive <=10000, max_attempts 1..10, status draft/published. Dates nullable; when present open <= due <= close, with open <= close if due absent.
- `assignment_extensions`: `{assignment_id,user_id,due_at,closes_at,updated_at}`. Optional student-specific replacement due/close dates; replacements can extend but not shorten original deadlines. Null means use original. Clearing an extension is explicit.
- `assignment_attempts`: `{id,assignment_id,user_id,attempt_no,body,link_url,submitted_at}`. Append-only submission history. At least a body or HTTPS link, body <=12000, link <=2000, no executable/credential URLs. Attempt number allocated server-side under serialization.
- `assignment_grades`: `{id,assignment_id,user_id,attempt_id,score,feedback,disposition,status,revision,graded_by,created_at,published_at}`. Append-only grade revisions, disposition graded/excused, status draft/published, score 0..points_possible for graded and null for excused. Revision allocated per assignment/student. Student state excludes all draft grade revisions, including their feedback. Staff sees revisions only for sections they manage. Grade review uses the latest attempt.

Existing `cohorts`, `cohort_members`, `courses`, `modules`, `members`, `class_sessions` remain unchanged. Students' People tab can show their instructor and own membership; it must not invent an exposed classmates roster.

## Commands through ht_campus_command

1. `saveAssignment({id?,cohort_id,title,instructions,points_possible,opens_at,due_at,closes_at,max_attempts,status})`. Section instructor or campus admin only. Section identity immutable. Points and publication cannot be changed after submissions or grades exist; max_attempts cannot drop below an existing attempt count. Bound title 160/instructions12000. Reject edits/writes for archived sections.
2. `submitAssignment({assignment_id,body,link_url})`. Current active roster member, published assignment, active section, within effective open/close window, below attempt limit. Self-instructor submissions are rejected. Due date affects late indication; close date prevents submission. Keep all earlier attempts. Do not trust client timestamps or user_id.
3. `gradeAssignment({assignment_id,user_id,attempt_id,score,feedback,disposition,status,expected_revision})`. Published assignment only; assigned instructor/admin; active roster recipient; no self-grading. Must reference latest attempt when one exists. Without an attempt, allow excused or an explicit zero with explanatory feedback. `expected_revision` must equal latest revision (0 initially), preventing silent overwrite. Feedback <=12000. Published grades notify the student and link to their course Grades tab; drafts remain private. Later submissions preserve earlier grade history but require fresh grading of the latest attempt.
4. `setAssignmentExtension({assignment_id,user_id,due_at,closes_at,clear?})`. Assigned instructor/admin only, active enrolled recipient, validated effective dates; no extension of an unpublished assignment. No grades or credentials altered.

## Authorization and totals

- An active member is required. Assigned section staff and campus admins manage; unrelated staff, leadership, unenrolled users and guests get no academic records for that section.
- Learners see only published assignments in their active sections, own attempts/extensions and own published grade revisions. An unassigned staff member enrolled as a learner follows learner permissions.
- Direct writes denied; explicit select grants plus RLS protect exposed tables; private checked commands with fixed search paths follow existing app conventions. Permission checks cover direct SQL reads, RPC snapshots and writes.
- Lock assignment/grade targets for mutation consistency. Successful commands write body-free audit metadata. No production migration execution in this task.
- Current grade is sum of eligible latest published scores divided by their points possible. Excused items excluded. Unsubmitted, ungraded, or resubmitted-awaiting-review items are pending, never silently zero. A zero is counted only when explicitly published.
- A final points total is shown only when every published assignment is graded for the latest attempt or explicitly excused; empty/all-excused courses show no numeric grade. Label numerator/denominator and pending count. This does not issue a pathway completion credential.

## UI contract

`campus-academics.js` exports `renderAcademics(view,ctx)` and `bindAcademics(view,root,ctx)` matching existing modules; `view='courses'`. URL uses `?cohort=<id>&tab=overview|modules|assignments|grades|people`, plus `assignment=<id>` for detail/editor. Use ordinary links or local navigation that preserves drafts through ctx.refresh. Instructor editor can use `?cohort=<id>&tab=assignments&new=1`.

Course landing lists visible active sections. Section tabs: Overview, Modules, Assignments, Grades, People; Classroom is a working link to the existing section classroom. Overview explains learning and grading. Modules show connected published curriculum with a link to current pathway activities (do not claim their completion equals a numeric grade). Staff creates sections/enrollment through a clear link to existing Manage classrooms.

Use forms with `data-academic-form` and stable section/assignment/user identifiers. Root capture/restore already preserves all forms, and ctx.run(name,payload,success,form) handles successful draft discard and errors. Never put another student's submission text into a compose field. Include drafts/loading/error/denied/empty states, accessible labels, formatted local times, usable phone layout. Keep HT brand styling; root owns CSS and shell integration.

## Demo and tests

Extend existing demo-v2 data additively using a marker, never reset prior records. Seed a published future-due assignment for Jordan's Morgan-led cohort, a draft assignment visible only to Morgan, and an assignment for the other cohort to test isolation. Include no actual student data. Preserve old commands and tests.

Test the instructor-publish/student-submit/draft-grade/publish/student-view loop; late and closed work; extensions; resubmission limits and stale grades; zero versus excused versus ungraded; archived/removed/foreign-section denial; draft feedback isolation; old learning/room/message regressions; browser drafts and mobile rendering.
