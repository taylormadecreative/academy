-- HT Hub: additive campus workflows. No existing Academy/OPIL data is changed.
-- Apply this migration alone after staging review. Do not bulk-push historic migrations.
begin;
create schema if not exists ht_private;
revoke all on schema ht_private from public, anon, authenticated;
grant usage on schema ht_private to authenticated;

create table public.ht_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 1 and 100),
 role text not null check(role in ('student','staff','admin','leadership')),
 active boolean not null default true
);
create table public.ht_announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 160),
 body text not null check(length(btrim(body)) between 1 and 10000), office text not null default 'Campus',
 audience text not null check(audience in ('campus','students','staff')), status text not null check(status in ('draft','published')),
 publish_at timestamptz not null default now(), created_at timestamptz not null default now(), author_id uuid not null references public.ht_members(user_id)
);
create table public.ht_events (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '', office text not null default 'Campus', location text not null default '',
 starts_at timestamptz not null, ends_at timestamptz not null, capacity integer check(capacity>0),
 status text not null check(status in ('draft','published','cancelled')), join_url text,
 check(ends_at>starts_at), check(join_url is null or join_url ~ '^https://')
);
create table ht_private.event_codes(event_id uuid primary key references public.ht_events(id) on delete cascade, code text not null);
create table public.ht_rsvps (
 event_id uuid references public.ht_events(id) on delete cascade, user_id uuid references public.ht_members(user_id) on delete cascade,
 status text not null check(status in ('going','cancelled')), created_at timestamptz not null default now(), primary key(event_id,user_id)
);
create table public.ht_attendance (
 event_id uuid references public.ht_events(id) on delete cascade, user_id uuid references public.ht_members(user_id) on delete cascade,
 checked_in_at timestamptz not null default now(), primary key(event_id,user_id)
);
create table public.ht_courses (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '', category text not null default 'Learning', status text not null check(status in ('draft','published')),
 image_url text check(image_url is null or image_url ~ '^https://')
);
create table public.ht_modules (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.ht_courses(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160), body text not null check(length(btrim(body)) between 1 and 20000),
 position integer not null check(position>0), resource_url text check(resource_url is null or resource_url ~ '^https://'),
 question text, options jsonb not null default '[]', assignment_prompt text,
 unique(course_id,position), check(jsonb_typeof(options)='array'), check(jsonb_array_length(options)<=8)
);
create table ht_private.answer_keys(module_id uuid primary key references public.ht_modules(id) on delete cascade, answer_index integer not null check(answer_index>=0));
create table ht_private.module_checks(module_id uuid references public.ht_modules(id) on delete cascade, user_id uuid references public.ht_members(user_id) on delete cascade, primary key(module_id,user_id));
create table public.ht_enrollments (
 course_id uuid references public.ht_courses(id), user_id uuid references public.ht_members(user_id) on delete cascade,
 enrolled_at timestamptz not null default now(), completed_at timestamptz, credential_id uuid unique,
 primary key(course_id,user_id), check((completed_at is null)=(credential_id is null))
);
create table public.ht_progress (
 module_id uuid references public.ht_modules(id), user_id uuid references public.ht_members(user_id) on delete cascade,
 completed_at timestamptz not null default now(), primary key(module_id,user_id)
);
create table public.ht_submissions (
 id uuid primary key default gen_random_uuid(), module_id uuid not null references public.ht_modules(id),
 user_id uuid not null references public.ht_members(user_id) on delete cascade, body text not null check(length(btrim(body)) between 1 and 20000),
 link_url text check(link_url is null or link_url ~ '^https://'), status text not null check(status in ('submitted','revision','approved')),
 feedback text, submitted_at timestamptz not null default now(), reviewed_at timestamptz, unique(module_id,user_id)
);
create table public.ht_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.ht_members(user_id) on delete cascade,
 category text not null check(category in ('Learning','Career','Technology','Campus life')),
 subject text not null check(length(btrim(subject)) between 1 and 160), body text not null check(length(btrim(body)) between 1 and 10000),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 assigned_to uuid references public.ht_members(user_id), created_at timestamptz not null default now()
);
create table public.ht_responses (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.ht_requests(id) on delete cascade,
 author_id uuid not null references public.ht_members(user_id), body text not null check(length(btrim(body)) between 1 and 10000), created_at timestamptz not null default now()
);
create table public.ht_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.ht_members(user_id),
 channel text not null check(length(btrim(channel)) between 1 and 60), body text not null check(length(btrim(body)) between 1 and 5000), created_at timestamptz not null default now()
);
create table public.ht_replies (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.ht_posts(id) on delete cascade,
 author_id uuid not null references public.ht_members(user_id), body text not null check(length(btrim(body)) between 1 and 5000), created_at timestamptz not null default now()
);
create table public.ht_likes(post_id uuid references public.ht_posts(id) on delete cascade,user_id uuid references public.ht_members(user_id) on delete cascade,primary key(post_id,user_id));
create table public.ht_messages (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.ht_members(user_id),recipient_id uuid not null references public.ht_members(user_id),
 body text not null check(length(btrim(body)) between 1 and 5000), created_at timestamptz not null default now(), read_at timestamptz, check(sender_id<>recipient_id)
);
create table public.ht_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.ht_members(user_id) on delete cascade,
 title text not null, body text not null default '', href text not null default '/ht/hub/', read_at timestamptz, created_at timestamptz not null default now()
);
create table public.ht_settings (
 id boolean primary key default true check(id), ada_video_url text not null default '', ada_video_poster text not null default '',
 ada_video_transcript text not null default '', support_email text not null default '',
 check(ada_video_url='' or ada_video_url ~ '^https://'), check(ada_video_poster='' or ada_video_poster ~ '^https://')
);
insert into public.ht_settings(id) values(true);
create table ht_private.audit_log(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id),action text not null,target_id uuid,created_at timestamptz not null default now());

-- Current database membership is authoritative: no editable JWT/user metadata roles.
create function ht_private.member_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.ht_members where user_id=(select auth.uid()) and active and auth.uid() is not null
$$;
create function ht_private.is_staff() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(ht_private.member_role() in ('staff','admin'),false)
$$;
revoke all on function ht_private.member_role(), ht_private.is_staff() from public,anon,authenticated;
grant execute on function ht_private.member_role(), ht_private.is_staff() to authenticated;

-- Clients may only SELECT permitted rows; all writes go through the validated command.
do $$ declare t text; begin
 foreach t in array array['members','announcements','events','rsvps','attendance','courses','modules','enrollments','progress','submissions','requests','responses','posts','replies','likes','messages','notifications','settings'] loop
 execute format('alter table public.ht_%I enable row level security',t);
 execute format('revoke all on table public.ht_%I from public,anon,authenticated',t);
 execute format('grant select on table public.ht_%I to authenticated',t);
 end loop;
end $$;
alter table ht_private.event_codes enable row level security;
alter table ht_private.answer_keys enable row level security;
alter table ht_private.module_checks enable row level security;
alter table ht_private.audit_log enable row level security;
revoke all on all tables in schema ht_private from public,anon,authenticated;
create policy ht_member_directory on public.ht_members for select to authenticated using(active and (select ht_private.member_role()) is not null);
create policy ht_announcements_read on public.ht_announcements for select to authenticated using((select ht_private.member_role()) is not null and ((select ht_private.is_staff()) or (status='published' and publish_at<=now() and (audience='campus' or (audience='students' and (select ht_private.member_role())='student') or (audience='staff' and (select ht_private.member_role())='leadership')))));
create policy ht_events_read on public.ht_events for select to authenticated using((select ht_private.member_role()) is not null and (status<>'draft' or (select ht_private.is_staff())));
create policy ht_courses_read on public.ht_courses for select to authenticated using((select ht_private.member_role()) is not null and (status='published' or (select ht_private.is_staff())));
create policy ht_modules_read on public.ht_modules for select to authenticated using(exists(select 1 from public.ht_courses c where c.id=course_id));
do $$ declare t text; begin
 foreach t in array array['rsvps','attendance','enrollments','progress','submissions','requests'] loop
 execute format('create policy ht_%I_read on public.ht_%I for select to authenticated using ((select ht_private.member_role()) is not null and (user_id=(select auth.uid()) or (select ht_private.is_staff())))',t,t);
 end loop;
 foreach t in array array['posts','replies','likes','settings'] loop
 execute format('create policy ht_%I_read on public.ht_%I for select to authenticated using ((select ht_private.member_role()) is not null)',t,t);
 end loop;
end $$;
create policy ht_responses_read on public.ht_responses for select to authenticated using(exists(select 1 from public.ht_requests r where r.id=request_id));
create policy ht_messages_read on public.ht_messages for select to authenticated using((select ht_private.member_role()) is not null and ((select auth.uid())=sender_id or (select auth.uid())=recipient_id));
create policy ht_notifications_read on public.ht_notifications for select to authenticated using((select ht_private.member_role()) is not null and user_id=(select auth.uid()));
create index ht_announcements_schedule on public.ht_announcements(status,publish_at);
create index ht_events_schedule on public.ht_events(status,starts_at);
create index ht_rsvps_user on public.ht_rsvps(user_id);
create index ht_attendance_user on public.ht_attendance(user_id);
create index ht_enrollments_user on public.ht_enrollments(user_id);
create index ht_progress_user on public.ht_progress(user_id);
create index ht_submissions_user on public.ht_submissions(user_id);
create index ht_requests_user on public.ht_requests(user_id);
create index ht_requests_owner on public.ht_requests(assigned_to);
create index ht_responses_request on public.ht_responses(request_id);
create index ht_replies_post on public.ht_replies(post_id);
create index ht_messages_sender on public.ht_messages(sender_id,created_at);
create index ht_messages_recipient on public.ht_messages(recipient_id,created_at);
create index ht_notifications_user on public.ht_notifications(user_id,created_at);

-- Internal helpers are never granted to the client.
create function ht_private.finish_course(v_course uuid,v_user uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.ht_modules where course_id=v_course) and not exists(
 select 1 from public.ht_modules m where m.course_id=v_course and not exists(select 1 from public.ht_progress p where p.module_id=m.id and p.user_id=v_user)) then
 update public.ht_enrollments set completed_at=coalesce(completed_at,now()),credential_id=coalesce(credential_id,gen_random_uuid()) where course_id=v_course and user_id=v_user;
 else
 update public.ht_enrollments set completed_at=null,credential_id=null where course_id=v_course and user_id=v_user;
 end if;
end $$;
create function ht_private.require_learning(v_module uuid,v_user uuid) returns public.ht_modules language plpgsql security invoker set search_path='' as $$
declare m public.ht_modules;
begin
 select * into m from public.ht_modules where id=v_module;
 if not found then raise exception 'Learning activity not found.'; end if;
 perform 1 from public.ht_enrollments where course_id=m.course_id and user_id=v_user for update;
 if not found then raise exception 'Enroll in this pathway first.'; end if;
 if exists(select 1 from public.ht_modules x where x.course_id=m.course_id and x.position<m.position and not exists(select 1 from public.ht_progress p where p.module_id=x.id and p.user_id=v_user)) then raise exception 'Complete the earlier activities first.'; end if;
 return m;
end $$;
create function ht_private.notify(v_user uuid,v_title text,v_body text,v_href text) returns void language sql security invoker set search_path='' as $$
 insert into public.ht_notifications(user_id,title,body,href) values(v_user,v_title,v_body,v_href)
$$;

-- One transaction per command. This deliberately elevated internal function checks
-- actor and ownership itself, with explicit field lists and no dynamic client SQL.
create function ht_private.command(p_name text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); r text:=ht_private.member_role(); p jsonb:=coalesce(p_payload,'{}');
 eid uuid; cid uuid; mid uuid; rid uuid; target uuid; new_id uuid; v_status text;
 e public.ht_events; m public.ht_modules; s public.ht_submissions; req public.ht_requests;
 v_answer integer; opts jsonb; v_question text; v_code text; v_role text;
begin
 if u is null or r is null then raise exception 'An active HT Hub membership is required.' using errcode='42501'; end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>100000 then raise exception 'Invalid request.'; end if;
 if p_name in ('saveAnnouncement','saveEvent','saveCourse','saveModule','saveSettings','reviewWork','updateRequest') and r not in ('staff','admin') then raise exception 'Staff access is required.' using errcode='42501'; end if;
 case p_name
 when 'rsvp' then
  eid:=(p->>'event_id')::uuid; v_status:=coalesce(p->>'status','going');
  if v_status not in ('going','cancelled') then raise exception 'Choose going or cancelled.'; end if;
  select * into e from public.ht_events where id=eid for update;
  if not found or e.status<>'published' then raise exception 'This event is not available.'; end if;
  if v_status='going' and e.ends_at<now() then raise exception 'This event has ended.'; end if;
  if v_status='going' and e.capacity is not null and not exists(select 1 from public.ht_rsvps where event_id=eid and user_id=u and status='going') and (select count(*) from public.ht_rsvps where event_id=eid and status='going')>=e.capacity then raise exception 'This event is full.'; end if;
  insert into public.ht_rsvps(event_id,user_id,status) values(eid,u,v_status) on conflict(event_id,user_id) do update set status=excluded.status;
 when 'checkin' then
  eid:=(p->>'event_id')::uuid;
  select * into e from public.ht_events where id=eid for update;
  if not found or e.status<>'published' then raise exception 'This event is not available.'; end if;
  if now()<e.starts_at-interval '30 minutes' or now()>e.ends_at+interval '2 hours' then raise exception 'Check-in opens 30 minutes before the event and closes two hours after it ends.'; end if;
  if not exists(select 1 from ht_private.event_codes where event_id=eid and code=upper(btrim(p->>'code'))) then raise exception 'That check-in code is not correct. Ask your host for the code.'; end if;
  if not exists(select 1 from public.ht_rsvps where event_id=eid and user_id=u and status='going') then raise exception 'RSVP before checking in.'; end if;
  insert into public.ht_attendance(event_id,user_id) values(eid,u) on conflict do nothing;
 when 'undoCheckin' then
  delete from public.ht_attendance where event_id=(p->>'event_id')::uuid and user_id=u;
 when 'enroll' then
  cid:=(p->>'course_id')::uuid;
  perform 1 from public.ht_courses where id=cid and status='published' for update;
  if not found or not exists(select 1 from public.ht_modules where course_id=cid) then raise exception 'This pathway is not available for enrollment.'; end if;
  insert into public.ht_enrollments(course_id,user_id) values(cid,u) on conflict do nothing;
 when 'completeModule' then
  mid:=(p->>'module_id')::uuid; m:=ht_private.require_learning(mid,u);
  if m.question is not null then
   select answer_index into v_answer from ht_private.answer_keys where module_id=mid;
   if v_answer is null or nullif(p->>'answer_index','')::integer is distinct from v_answer then raise exception 'Review the lesson and try the knowledge check again.'; end if;
   insert into ht_private.module_checks(module_id,user_id) values(mid,u) on conflict do nothing;
  end if;
  if m.assignment_prompt is null then
   insert into public.ht_progress(module_id,user_id) values(mid,u) on conflict do nothing;
   perform ht_private.finish_course(m.course_id,u);
  end if;
 when 'submitWork' then
  mid:=(p->>'module_id')::uuid; m:=ht_private.require_learning(mid,u);
  if m.assignment_prompt is null then raise exception 'This activity does not have an assignment.'; end if;
  if m.question is not null and not exists(select 1 from ht_private.module_checks where module_id=mid and user_id=u) then raise exception 'Pass the knowledge check before submitting work.'; end if;
  if exists(select 1 from public.ht_submissions where module_id=mid and user_id=u and status='approved') then raise exception 'This work is already approved.'; end if;
  insert into public.ht_submissions(module_id,user_id,body,link_url,status) values(mid,u,btrim(p->>'body'),nullif(btrim(p->>'link_url'),''),'submitted')
   on conflict(module_id,user_id) do update set body=excluded.body,link_url=excluded.link_url,status='submitted',submitted_at=now(),reviewed_at=null;
 when 'reviewWork' then
  select * into s from public.ht_submissions where id=(p->>'id')::uuid for update;
  if not found then raise exception 'Submission not found.'; end if;
  v_status:=p->>'status';
  if v_status not in ('approved','revision') then raise exception 'Choose approved or revision.'; end if;
  if nullif(btrim(p->>'feedback'),'') is null then raise exception 'Add feedback for the learner.'; end if;
  m:=ht_private.require_learning(s.module_id,s.user_id);
  if v_status='approved' then
   if m.question is not null and not exists(select 1 from ht_private.module_checks where module_id=m.id and user_id=s.user_id) then raise exception 'The knowledge check must be completed first.'; end if;
   insert into public.ht_progress(module_id,user_id) values(s.module_id,s.user_id) on conflict do nothing;
  else
   -- Invalidate dependent later progress too if an approval is withdrawn.
   delete from public.ht_progress where user_id=s.user_id and module_id in(select id from public.ht_modules where course_id=m.course_id and position>=m.position);
   delete from ht_private.module_checks where user_id=s.user_id and module_id in(select id from public.ht_modules where course_id=m.course_id and position>=m.position);
   update public.ht_submissions set status='revision',feedback='An earlier activity needs revision. Complete it, then review and resubmit this work.',reviewed_at=now() where user_id=s.user_id and module_id in(select id from public.ht_modules where course_id=m.course_id and position>m.position);
  end if;
  update public.ht_submissions set status=v_status,feedback=btrim(p->>'feedback'),reviewed_at=now() where id=s.id;
  perform ht_private.finish_course(m.course_id,s.user_id);
  perform ht_private.notify(s.user_id,'Feedback on your work',btrim(p->>'feedback'),'/ht/hub/learn/');
 when 'createRequest' then
  insert into public.ht_requests(user_id,category,subject,body) values(u,p->>'category',btrim(p->>'subject'),btrim(p->>'body')) returning id into new_id;
  perform ht_private.notify(u,'Your request was received','You can follow the response in Student support.','/ht/hub/support/');
 when 'updateRequest' then
  rid:=(p->>'id')::uuid;
  select * into req from public.ht_requests where id=rid for update;
  if not found then raise exception 'Support request not found.'; end if;
  target:=case when p ? 'assigned_to' then nullif(p->>'assigned_to','')::uuid else req.assigned_to end;
  if target is not null and not exists(select 1 from public.ht_members where user_id=target and active and role in ('staff','admin')) then raise exception 'Choose an active staff member.'; end if;
  update public.ht_requests set status=p->>'status',assigned_to=target where id=rid;
  perform ht_private.notify(req.user_id,'Your support request was updated',req.subject,'/ht/hub/support/');
 when 'replyRequest' then
  rid:=(p->>'request_id')::uuid;
  select * into req from public.ht_requests where id=rid;
  if not found or (req.user_id<>u and r not in ('staff','admin')) then raise exception 'This support request is not available to you.' using errcode='42501'; end if;
  insert into public.ht_responses(request_id,author_id,body) values(rid,u,btrim(p->>'body'));
  if req.user_id<>u then perform ht_private.notify(req.user_id,'A reply to your support request',req.subject,'/ht/hub/support/');
  elsif req.assigned_to is not null then perform ht_private.notify(req.assigned_to,'A student replied',req.subject,'/ht/hub/support/'); end if;
 when 'post' then
  insert into public.ht_posts(author_id,channel,body) values(u,btrim(p->>'channel'),btrim(p->>'body')) returning id into new_id;
 when 'reply' then
  rid:=(p->>'post_id')::uuid;
  if not exists(select 1 from public.ht_posts where id=rid) then raise exception 'Post not found.'; end if;
  insert into public.ht_replies(post_id,author_id,body) values(rid,u,btrim(p->>'body'));
 when 'like' then
  rid:=(p->>'post_id')::uuid;
  if coalesce((p->>'liked')::boolean,false) then insert into public.ht_likes(post_id,user_id) values(rid,u) on conflict do nothing;
  else delete from public.ht_likes where post_id=rid and user_id=u; end if;
 when 'sendMessage' then
  target:=(p->>'recipient_id')::uuid;
  if not exists(select 1 from public.ht_members where user_id=target and active) or target=u then raise exception 'Choose another active campus member.'; end if;
  insert into public.ht_messages(sender_id,recipient_id,body) values(u,target,btrim(p->>'body'));
  perform ht_private.notify(target,'A new campus message','Open your campus messages to read it.','/ht/hub/people/');
 when 'readNotification' then
  update public.ht_notifications set read_at=coalesce(read_at,now()) where id=(p->>'id')::uuid and user_id=u;
 when 'saveAnnouncement' then
  new_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  insert into public.ht_announcements(id,title,body,office,audience,status,publish_at,author_id)
   values(new_id,btrim(p->>'title'),btrim(p->>'body'),coalesce(p->>'office','Campus'),coalesce(p->>'audience','campus'),coalesce(p->>'status','draft'),coalesce(nullif(p->>'publish_at','')::timestamptz,now()),u)
   on conflict(id) do update set title=excluded.title,body=excluded.body,office=excluded.office,audience=excluded.audience,status=excluded.status,publish_at=excluded.publish_at;
 when 'saveEvent' then
  new_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  perform 1 from public.ht_events where id=new_id for update;
  if nullif(p->>'capacity','')::integer<(select count(*) from public.ht_rsvps where event_id=new_id and status='going') then raise exception 'Capacity cannot be below the current RSVP count.'; end if;
  insert into public.ht_events(id,title,description,office,location,starts_at,ends_at,capacity,status,join_url)
   values(new_id,btrim(p->>'title'),coalesce(p->>'description',''),coalesce(p->>'office','Campus'),coalesce(p->>'location',''),(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,nullif(p->>'capacity','')::integer,coalesce(p->>'status','draft'),nullif(btrim(p->>'join_url'),''))
   on conflict(id) do update set title=excluded.title,description=excluded.description,office=excluded.office,location=excluded.location,starts_at=excluded.starts_at,ends_at=excluded.ends_at,capacity=excluded.capacity,status=excluded.status,join_url=excluded.join_url;
  v_code:=upper(nullif(btrim(p->>'checkin_code'),''));
  if v_code is not null then
   if length(v_code) not between 4 and 40 then raise exception 'Use a check-in code of 4–40 characters.'; end if;
   insert into ht_private.event_codes(event_id,code) values(new_id,v_code) on conflict(event_id) do update set code=excluded.code;
  end if;
 when 'saveCourse' then
  new_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  perform 1 from public.ht_courses where id=new_id for update;
  if p->>'status'='published' and not exists(select 1 from public.ht_modules where course_id=new_id) then raise exception 'Save a draft, add an activity, then publish the pathway.'; end if;
  insert into public.ht_courses(id,title,description,category,status,image_url)
   values(new_id,btrim(p->>'title'),coalesce(p->>'description',''),coalesce(p->>'category','Learning'),coalesce(p->>'status','draft'),nullif(btrim(p->>'image_url'),''))
   on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,status=excluded.status,image_url=excluded.image_url;
 when 'saveModule' then
  cid:=(p->>'course_id')::uuid; new_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  perform 1 from public.ht_courses where id=cid for update;
  if not found then raise exception 'Pathway not found.'; end if;
  if exists(select 1 from public.ht_modules where id=new_id and course_id<>cid) then raise exception 'An activity cannot be moved between pathways.'; end if;
  if exists(select 1 from public.ht_enrollments where course_id=cid) then raise exception 'Learning requirements are locked after enrollment. Create a new pathway version to change them.'; end if;
  opts:=coalesce(p->'options','[]'::jsonb); v_question:=nullif(btrim(p->>'question'),'');
  if jsonb_typeof(opts)<>'array' then raise exception 'Answer options must be a list.'; end if;
  if exists(select 1 from jsonb_array_elements(opts) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}'))=0) then raise exception 'Each answer option needs text.'; end if;
  v_answer:=nullif(p->>'answer_index','')::integer;
  if v_question is not null and (jsonb_array_length(opts)<2 or jsonb_array_length(opts)>8 or v_answer is null or v_answer<0 or v_answer>=jsonb_array_length(opts)) then raise exception 'Add 2–8 answers and select the correct answer.'; end if;
  insert into public.ht_modules(id,course_id,title,body,position,resource_url,question,options,assignment_prompt)
   values(new_id,cid,btrim(p->>'title'),btrim(p->>'body'),(p->>'position')::integer,nullif(btrim(p->>'resource_url'),''),v_question,case when v_question is null then '[]'::jsonb else opts end,nullif(btrim(p->>'assignment_prompt'),''))
   on conflict(id) do update set title=excluded.title,body=excluded.body,position=excluded.position,resource_url=excluded.resource_url,question=excluded.question,options=excluded.options,assignment_prompt=excluded.assignment_prompt;
  delete from ht_private.answer_keys where module_id=new_id;
  if v_question is not null then insert into ht_private.answer_keys(module_id,answer_index) values(new_id,v_answer); end if;
 when 'saveSettings' then
  update public.ht_settings set ada_video_url=coalesce(btrim(p->>'ada_video_url'),''),ada_video_poster=coalesce(btrim(p->>'ada_video_poster'),''),ada_video_transcript=coalesce(p->>'ada_video_transcript',''),support_email=coalesce(btrim(p->>'support_email'),'') where id;
 when 'setMember' then
  if r<>'admin' then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  target:=(p->>'user_id')::uuid; v_role:=p->>'role';
  if target=u and (v_role<>'admin' or not coalesce((p->>'active')::boolean,true)) then raise exception 'Ask another administrator to change your own administrator access.'; end if;
  insert into public.ht_members(user_id,display_name,role,active) values(target,btrim(p->>'display_name'),v_role,coalesce((p->>'active')::boolean,true))
   on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
 else raise exception 'Unknown campus action.';
 end case;
 insert into ht_private.audit_log(actor_id,action,target_id) values(u,p_name,coalesce(new_id,rid,mid,eid,cid,target));
 return jsonb_build_object('ok',true,'id',new_id);
end $$;

create function ht_private.staff_answers() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not ht_private.is_staff() then return '{}'::jsonb; end if;
 return coalesce((select jsonb_object_agg(module_id,answer_index) from ht_private.answer_keys),'{}'::jsonb);
end $$;
create function ht_private.metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or ht_private.member_role() not in ('staff','admin','leadership') or ht_private.member_role() is null then return null; end if;
 return jsonb_build_object(
  'members',(select count(*) from public.ht_members where active),
  'active_learners',(select count(distinct user_id) from public.ht_enrollments),
  'enrollments',(select count(*) from public.ht_enrollments),
  'completions',(select count(*) from public.ht_enrollments where completed_at is not null),
  'rsvps',(select count(*) from public.ht_rsvps where status='going'),
  'checkins',(select count(*) from public.ht_attendance),
  'open_requests',(select count(*) from public.ht_requests where status<>'resolved'),
  'unanswered_requests',(select count(*) from public.ht_requests r where r.status<>'resolved' and not exists(select 1 from public.ht_responses a join public.ht_members m on m.user_id=a.author_id where a.request_id=r.id and m.role in ('staff','admin'))),
  'announcements',(select count(*) from public.ht_announcements where status='published' and publish_at<=now()));
end $$;
create function public.ht_campus_command(p_name text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select ht_private.command(p_name,p_payload)
$$;
-- This state reader is SECURITY INVOKER: row policies still apply to every table.
create function public.ht_campus_state() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; answers jsonb;
begin
 if auth.uid() is null or ht_private.member_role() is null then raise exception 'Your account does not yet have an active HT Hub membership.' using errcode='42501'; end if;
 answers:=ht_private.staff_answers();
 select jsonb_build_object(
  'member',(select to_jsonb(m)-'active' from public.ht_members m where user_id=auth.uid()),
  'announcements',coalesce((select jsonb_agg(a order by a.publish_at desc) from public.ht_announcements a),'[]'),
  'events',coalesce((select jsonb_agg(e order by e.starts_at) from public.ht_events e),'[]'),
  'rsvps',coalesce((select jsonb_agg(x) from public.ht_rsvps x),'[]'),
  'attendance',coalesce((select jsonb_agg(x) from public.ht_attendance x),'[]'),
  'courses',coalesce((select jsonb_agg(x order by x.title) from public.ht_courses x),'[]'),
  'modules',coalesce((select jsonb_agg(to_jsonb(x)||case when answers ? x.id::text then jsonb_build_object('answer_index',answers->x.id::text) else '{}'::jsonb end order by x.position) from public.ht_modules x),'[]'),
  'enrollments',coalesce((select jsonb_agg(x) from public.ht_enrollments x),'[]'),
  'progress',coalesce((select jsonb_agg(x) from public.ht_progress x),'[]'),
  'submissions',coalesce((select jsonb_agg(x order by x.submitted_at desc) from public.ht_submissions x),'[]'),
  'requests',coalesce((select jsonb_agg(x order by x.created_at desc) from public.ht_requests x),'[]'),
  'responses',coalesce((select jsonb_agg(x order by x.created_at) from public.ht_responses x),'[]'),
  'posts',coalesce((select jsonb_agg(x order by x.created_at desc) from public.ht_posts x),'[]'),
  'replies',coalesce((select jsonb_agg(x order by x.created_at) from public.ht_replies x),'[]'),
  'likes',coalesce((select jsonb_agg(x) from public.ht_likes x),'[]'),
  'members',coalesce((select jsonb_agg(to_jsonb(x)-'active' order by x.display_name) from public.ht_members x),'[]'),
  'messages',coalesce((select jsonb_agg(x order by x.created_at) from public.ht_messages x),'[]'),
  'notifications',coalesce((select jsonb_agg(x order by x.created_at desc) from public.ht_notifications x),'[]'),
  'settings',(select to_jsonb(x)-'id' from public.ht_settings x where id),
  'metrics',ht_private.metrics()) into result;
 return result;
end $$;
-- Revoke PostgreSQL's default PUBLIC function execution, including internals.
revoke all on all functions in schema ht_private from public,anon,authenticated;
grant execute on function ht_private.member_role(),ht_private.is_staff(),ht_private.command(text,jsonb),ht_private.staff_answers(),ht_private.metrics() to authenticated;
revoke all on function public.ht_campus_state(),public.ht_campus_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.ht_campus_state(),public.ht_campus_command(text,jsonb) to authenticated;
commit;
