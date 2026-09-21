# HT campus implementation contract

User-authorized campus hub upgrade, September 21, 2026. Existing HTML/vanilla JS/CSS stack. Preserve shared Academy/OPIL code and existing HT live/replay modules. Ada video is supplied separately by Nelson; no generated likeness or fake AI service.

## Module boundaries

- `ht/hub/campus-store.js`: backend/data agent. ES module exports `createCampusStore()` returning `{load, command, subscribe, destroy}`. `load()` returns state below. `command(name, payload)` performs authorized operation; resolves on success, rejects with a human-readable Error on failure. `subscribe(fn)` notifies refresh listeners and returns unsubscribe. Only explicit `?demo=student|staff|leadership` uses isolated demo data; never silently downgrade real failures to a demo. Guest can read illustrative fixtures but cannot mutate them. Database tables are prefixed `ht_` with institutional membership and RLS. Supabase client uses existing BM_CONFIG and session. No public secrets.
- `ht/hub/campus-student.js`: student UI agent. Exports `renderStudent(view, ctx)` -> HTML string and `bindStudent(view, root, ctx)` -> cleanup function optional. Owns Today (`home`), `learn`, `events`, `community`, `people`. Parent owns shared shell, helpers and CSS.
- `ht/hub/campus-staff.js`: staff UI agent. Exports `renderStaff(view, ctx)` and `bindStaff(view, root, ctx)`. Owns `staff`, `insights`, `support`. Support available to all members. Parent owns shared shell and CSS.
- Parent owns `campus-app.js`, `campus.css`, `_shell.tpl`, `ht.js`, build script, new generated pages, integration/browser tests, review/release notes.

## UI context

`ctx = {state, api, esc, icon, href, notify, refresh, run, formatDate, formatTime}`.
`api` is store. `run(name,payload,successMessage)` handles busy/error/success status and refresh, returns promise<boolean>. Bindings should disable their submitting button during await to prevent duplicates, preserve entered data on failure, and use labeled native form controls. `href(view, query?)` produces /ht/hub/{view}/ and preserves explicit demo; home omits view. `icon(name)` inline decorative SVG. `formatDate(iso)` human-friendly month/day; `formatTime(iso)` human-friendly local time. `notify(message,type='success')` live status. `refresh()` reloads state/renders current view. HTML must escape all dynamic values. No outer main/h1 (parent supplies page heading), no injected inline styles, no untrusted HTML. Semantic CSS classes prefixed `campus-`; parent will style all. Use buttons with `campus-button`, secondary modifier `campus-button-secondary`, small modifier `campus-button-small`. Sections `campus-panel`, headers `campus-section-head`, muted text `campus-muted`, input field wrapper `campus-field`, list `campus-list`, row `campus-row`, grid `campus-grid`, empty `campus-empty`, badges `campus-label`, error `campus-error`. Further meaningful prefixed classes allowed; report them to parent.

## State

`{mode:'live'|'demo'|'guest'|'unavailable', user:{id,email}|null, member:{user_id,display_name,role:'student'|'staff'|'admin'|'leadership'}|null, error:null|string, announcements:[], events:[], rsvps:[], attendance:[], courses:[], modules:[], enrollments:[], progress:[], submissions:[], requests:[], responses:[], posts:[], replies:[], likes:[], members:[], messages:[], notifications:[], settings:{ada_video_url:'',ada_video_poster:'',ada_video_transcript:'',support_email:''}, metrics:null|object}`.

All persisted entities use UUID IDs. Field definitions:
- announcements: id,title,body,office,audience ('campus'|'students'|'staff'),status ('draft'|'published'),publish_at,created_at,author_id.
- events: id,title,description,office,location,starts_at,ends_at,capacity|null,status ('draft'|'published'|'cancelled'),join_url|null. No public check-in codes in event records; staff-only separate storage/RPC.
- rsvps: event_id,user_id,status ('going'|'cancelled'),created_at.
- attendance: event_id,user_id,checked_in_at.
- courses: id,title,description,category,status ('draft'|'published'),image_url|null.
- modules: id,course_id,title,body,position,resource_url|null,question|null,options:array of strings,answer_index (only demo or staff state, never real student client),assignment_prompt|null.
- enrollments: course_id,user_id,enrolled_at,completed_at|null,credential_id|null.
- progress: module_id,user_id,completed_at.
- submissions: id,module_id,user_id,body,link_url|null,status ('submitted'|'revision'|'approved'),feedback|null,submitted_at,reviewed_at|null.
- requests: id,user_id,category ('Learning'|'Career'|'Technology'|'Campus life'),subject,body,status ('open'|'in_progress'|'resolved'),assigned_to|null,created_at.
- responses: id,request_id,author_id,body,created_at.
- posts: id,author_id,channel,body,created_at.
- replies: id,post_id,author_id,body,created_at.
- likes: post_id,user_id.
- members: user_id,display_name,role (only active members, no private email or records in directory).
- messages: id,sender_id,recipient_id,body,created_at,read_at|null.
- notifications: id,user_id,title,body,href,read_at|null,created_at.
- metrics: members,active_learners,enrollments,completions,rsvps,checkins,open_requests,unanswered_requests,announcements. Aggregates only; leadership must not receive individual private student requests/submissions.

## Commands

- `rsvp` {event_id,status}; `checkin` {event_id,code}; `undoCheckin` {event_id}
- `enroll` {course_id}; `completeModule` {module_id,answer_index?} validates any knowledge check server-side and order; modules with assignment complete only on staff approval.
- `submitWork` {module_id,body,link_url?}; `reviewWork` {id,status,feedback}; completion credentials generated only when all requirements actually complete.
- `createRequest` {category,subject,body}; `updateRequest` {id,status,assigned_to?}; `replyRequest` {request_id,body}
- `post` {channel,body}; `reply` {post_id,body}; `like` {post_id,liked:boolean}
- `sendMessage` {recipient_id,body}; `readNotification` {id}
- `saveAnnouncement` {id?,title,body,office,audience,status,publish_at?}
- `saveEvent` {id?,title,description,office,location,starts_at,ends_at,capacity?,status,join_url?,checkin_code?}
- `saveCourse` {id?,title,description,category,status,image_url?}
- `saveModule` {id?,course_id,title,body,position,resource_url?,question?,options?,answer_index?,assignment_prompt?}
- `saveSettings` {ada_video_url,ada_video_poster,ada_video_transcript,support_email}

Staff/admin can author and review, leadership reads aggregate metrics but cannot see private cases by that role alone. Membership provisioning must use an admin-checked operation; no self-assigned roles and no automatic campus membership for all Academy accounts. SQL tests must cover unauthorized writes, private record isolation, course completion integrity, check-in validation and anonymous denial. No destructive changes to existing production tables.

Demo fixtures must explicitly label sample data and use fictional first names/last initials. A demo role switch cannot grant backend permissions. Use meaningful training content for one AI Literacy course. Calendar examples relative to current date only in demo; live events always persisted actual timestamps. Staff editors should work without any deployment. No claims of SSO, live AI chatbot, scheduled email/push, or verified WCAG conformance until implemented and tested.
