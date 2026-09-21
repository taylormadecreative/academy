-- Dedicated HT cohort and campus-event classrooms. Additive, deploy only with reviewed Edge adapters.
-- Requires the campus migration and the existing room/class feature migrations through 0054.
begin;
create table public.ht_cohorts (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '', course_id uuid references public.ht_courses(id),
 instructor_id uuid not null references public.ht_members(user_id),
 status text not null default 'active' check(status in ('active','archived')), created_at timestamptz not null default now()
);
create table public.ht_cohort_members (
 cohort_id uuid references public.ht_cohorts(id) on delete cascade, user_id uuid references public.ht_members(user_id) on delete cascade,
 active boolean not null default true, joined_at timestamptz not null default now(), primary key(cohort_id,user_id)
);
create table public.ht_class_sessions (
 id uuid primary key default gen_random_uuid(), cohort_id uuid references public.ht_cohorts(id), event_id uuid references public.ht_events(id),
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '',
 starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 audience text not null check(audience in ('cohort','campus')), instructor_id uuid not null references public.ht_members(user_id),
 room_id uuid not null unique references public.ea_rooms(id), room_slug text not null unique check(room_slug ~ '^htc-[0-9a-f]{24}$'),
 check(ends_at>starts_at), check((audience='cohort' and cohort_id is not null) or (audience='campus' and cohort_id is null))
);
create index ht_cohorts_instructor on public.ht_cohorts(instructor_id);
create index ht_cohort_members_user on public.ht_cohort_members(user_id);
create index ht_class_sessions_cohort on public.ht_class_sessions(cohort_id,starts_at);
create index ht_class_sessions_instructor on public.ht_class_sessions(instructor_id);

create function ht_private.cohort_manage(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(ht_private.member_role()='admin' or (ht_private.member_role()='staff' and exists(select 1 from public.ht_cohorts where id=p_id and instructor_id=auth.uid())),false)
$$;
create function ht_private.cohort_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select ht_private.cohort_manage(p_id) or (ht_private.member_role() in ('student','staff') and exists(select 1 from public.ht_cohorts c join public.ht_cohort_members m on m.cohort_id=c.id where c.id=p_id and c.status='active' and m.user_id=auth.uid() and m.active))
$$;
create function ht_private.session_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select ht_private.member_role() is not null and exists(select 1 from public.ht_class_sessions s where s.id=p_id and (s.audience='campus' or ht_private.cohort_visible(s.cohort_id)))
$$;
create function ht_private.classroom_access(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ht_class_sessions; r text:=ht_private.member_role(); allowed boolean:=false; host boolean:=false;
begin
 if coalesce(p_slug,'') not like 'htc-%' then return jsonb_build_object('managed',false,'can_join',false,'is_host',false,'room_id',null); end if;
 select * into s from public.ht_class_sessions where room_slug=p_slug;
 if found and auth.uid() is not null and r is not null and s.status='scheduled' and exists(select 1 from public.ea_rooms where id=s.room_id and slug=p_slug and not open_door) then
  host:=r='admin' or (r='staff' and s.instructor_id=auth.uid());
  if s.audience='campus' then allowed:=true;
  elsif exists(select 1 from public.ht_cohorts where id=s.cohort_id and status='active') then
   allowed:=host or (r in ('student','staff') and exists(select 1 from public.ht_cohort_members where cohort_id=s.cohort_id and user_id=auth.uid() and active));
  end if;
 end if;
 return jsonb_build_object('managed',true,'can_join',allowed,'is_host',allowed and host,'room_id',case when allowed then s.room_id else null end);
end $$;
create function public.ht_classroom_access(p_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select ht_private.classroom_access(p_slug)$$;
revoke all on function public.ht_classroom_access(text) from public,anon,authenticated;
grant execute on function public.ht_classroom_access(text) to authenticated;

-- Treat a known room with any htc- prefix as managed, even without a session mapping.
create function ht_private.managed_room(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ea_rooms where id=p_room and slug like 'htc-%')
$$;
create function ht_private.room_slug(p_room uuid) returns text language sql stable security definer set search_path='' as $$select slug from public.ea_rooms where id=p_room$$;
create function ht_private.key_room(p_key text) returns uuid language plpgsql immutable security invoker set search_path='' as $$
begin if p_key ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return split_part(p_key,':',2)::uuid; end if;return null;end $$;
create function ht_private.managed_key(p_key text) returns boolean language sql stable security definer set search_path='' as $$select ht_private.managed_room(ht_private.key_room(p_key))$$;
create function ht_private.session_host(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce((ht_private.classroom_access(ht_private.room_slug(p_room))->>'is_host')::boolean,false)$$;
create function ht_private.session_allowed(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce((ht_private.classroom_access(ht_private.room_slug(p_room))->>'can_join')::boolean,false)$$;

alter table public.ht_cohorts enable row level security;
alter table public.ht_cohort_members enable row level security;
alter table public.ht_class_sessions enable row level security;
revoke all on public.ht_cohorts,public.ht_cohort_members,public.ht_class_sessions from public,anon,authenticated;
grant select on public.ht_cohorts,public.ht_cohort_members,public.ht_class_sessions to authenticated;
create policy ht_cohorts_read on public.ht_cohorts for select to authenticated using(ht_private.cohort_visible(id));
create policy ht_cohort_members_read on public.ht_cohort_members for select to authenticated using(ht_private.cohort_manage(cohort_id) or (user_id=auth.uid() and active and ht_private.cohort_visible(cohort_id)));
create policy ht_class_sessions_read on public.ht_class_sessions for select to authenticated using(ht_private.session_visible(id));

-- Preserve original implementations in a private schema, then REPLACE originals in place.
-- Replacing keeps OIDs: policies already depending on a helper cannot retain a bypassing old OID.
do $copy$
declare signature text; fn_oid regprocedure; definition text; fn text;
begin
 foreach signature in array array['public.ea_room_is_host(uuid)','public.ea_room_state(text,text)','public.ea_class_can(text)','public.ea_class_is_host(text)','public.ea_room_reader(text)','public.ea_room_in_session(uuid)','public.ea_room_rotate_link(uuid)','public.ea_room_set_hosts(uuid,text[])','public.ea_class_attendance_rows(text)','public.ea_class_help_queue()','public.ea_class_help_may_ask(text)','public.ea_class_names(text)','public.ht_campus_command(text,jsonb)','public.ht_campus_state()'] loop
  fn_oid:=to_regprocedure(signature);if fn_oid is null then raise exception 'Missing classroom prerequisite: %',signature;end if;
  select proname into fn from pg_proc where pg_proc.oid=fn_oid;
  definition:=pg_get_functiondef(fn_oid);
  definition:=replace(definition,'FUNCTION public.'||fn||'(','FUNCTION ht_private.legacy_'||fn||'(');
  execute definition;
 end loop;
end $copy$;

create or replace function public.ea_room_is_host(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when ht_private.managed_room(p_room) then ht_private.session_host(p_room) else ht_private.legacy_ea_room_is_host(p_room) end
$$;
create or replace function public.ea_class_can(p_key text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare room uuid:=ht_private.key_room(p_key);
begin
 if p_key like 'room:%' and (room is null or ht_private.room_slug(room) is null) then return false; end if;
 if ht_private.managed_room(room) then return ht_private.session_allowed(room);end if;
 return ht_private.legacy_ea_class_can(p_key);
end $$;
create or replace function public.ea_class_is_host(p_key text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare room uuid:=ht_private.key_room(p_key);
begin
 if p_key like 'room:%' and (room is null or ht_private.room_slug(room) is null) then return false; end if;
 if ht_private.managed_room(room) then return ht_private.session_host(room);end if;
 return ht_private.legacy_ea_class_is_host(p_key);
end $$;
create or replace function public.ea_room_in_session(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when ht_private.managed_room(p_room) then ht_private.session_allowed(p_room) and exists(select 1 from public.ea_room_members m join public.ea_rooms r on r.id=m.room_id where m.room_id=p_room and m.user_id=auth.uid() and r.is_live and m.last_joined_at>=r.live_since) else ht_private.legacy_ea_room_in_session(p_room) end
$$;
create or replace function public.ea_room_reader(p_key text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare room uuid:=ht_private.key_room(p_key);
begin
 if ht_private.managed_room(room) then
  return ht_private.session_allowed(room) and (ht_private.session_host(room) or public.ea_room_in_session(room) or exists(select 1 from public.ea_room_replays where room_id=room and published and status='ready' and watch_url is not null));
 end if;
 return ht_private.legacy_ea_room_reader(p_key);
end $$;
create or replace function public.ea_room_state(p_key text default null,p_slug text default 'academy') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb; r public.ea_rooms; replay public.ea_room_replays; s public.ht_class_sessions;
begin
 if coalesce(p_slug,'') not like 'htc-%' then return ht_private.legacy_ea_room_state(p_key,p_slug);end if;
 a:=ht_private.classroom_access(p_slug);
 if not coalesce((a->>'can_join')::boolean,false) then return jsonb_build_object('managed',true,'signed_in',auth.uid() is not null,'can_join',false,'is_host',false,'bad_link',false,'recording_url',null,'id',null);end if;
 select * into r from public.ea_rooms where id=(a->>'room_id')::uuid;
 select * into s from public.ht_class_sessions where room_id=r.id;
 select * into replay from public.ea_room_replays where room_id=r.id and published and status='ready' and watch_url is not null order by created_at desc limit 1;
 return jsonb_build_object('managed',true,'id',r.id,'slug',r.slug,'title',s.title,'is_live',r.is_live,'host_name',(select display_name from public.ht_members where user_id=s.instructor_id),'signed_in',true,'is_host',(a->>'is_host')::boolean,'can_join',true,'open_door',false,'bad_link',false,'recording_url',replay.watch_url,'replay_started_at',replay.created_at,'replay_duration_s',replay.duration_s,'warmup_q',r.warmup_q,'next_title',s.title,'next_at',s.starts_at,'people',case when (a->>'is_host')::boolean then(select count(*) from public.ea_room_members where room_id=r.id) else null end);
end $$;
create or replace function public.ea_room_rotate_link(p_room uuid) returns text language plpgsql volatile security definer set search_path='' as $$
begin if ht_private.managed_room(p_room) then raise exception 'Classroom access is managed by the cohort roster, not invitation keys.' using errcode='42501';end if;return ht_private.legacy_ea_room_rotate_link(p_room);end $$;
create or replace function public.ea_room_set_hosts(p_room uuid,p_emails text[]) returns text[] language plpgsql volatile security definer set search_path='' as $$
begin if ht_private.managed_room(p_room) then raise exception 'Assign classroom instructors in the campus workspace.' using errcode='42501';end if;return ht_private.legacy_ea_room_set_hosts(p_room,p_emails);end $$;

create or replace function public.ea_class_help_may_ask(p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select case when ht_private.managed_key(p_key) then public.ea_class_can(p_key) else ht_private.legacy_ea_class_help_may_ask(p_key) end
$$;
create or replace function public.ea_class_names(p_key text) returns table(user_id uuid,name text) language sql stable security definer set search_path='' as $$
 select x.* from ht_private.legacy_ea_class_names(p_key) x where not ht_private.managed_key(p_key)
 union all
 select m.user_id,m.display_name from public.ht_members m
 where ht_private.managed_key(p_key) and public.ea_class_can(p_key)
 and (exists(select 1 from public.ea_class_presence p where p.room_key=p_key and p.user_id=m.user_id) or exists(select 1 from public.ea_class_warmups w where w.room_key=p_key and w.user_id=m.user_id))
$$;

-- Protect room identity from the legacy column UPDATE grants. Controlled commands run as owner;
-- direct authenticated updates can still set live/end state, capacity and the warm-up question.
create function ht_private.guard_room_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.slug like 'htc-%' and current_user in ('anon','authenticated') and (new.title,new.host_name,new.host_emails,new.slug,new.link_key,new.open_door,new.host_preset,new.guest_preset,new.next_title,new.next_at) is distinct from (old.title,old.host_name,old.host_emails,old.slug,old.link_key,old.open_door,old.host_preset,old.guest_preset,old.next_title,old.next_at) then raise exception 'Edit classroom details in the campus workspace.' using errcode='42501';end if;
 return new;
end $$;
create trigger ht_managed_room_identity before update on public.ea_rooms for each row execute function ht_private.guard_room_identity();

create function ht_private.classroom_command(p_name text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r text:=ht_private.member_role(); v_id uuid; cid uuid; instructor uuid; room uuid; slug text; c public.ht_cohorts; s public.ht_class_sessions; old_room public.ea_rooms; audience text; status text; starts timestamptz; ends timestamptz;
begin
 if r is null or u is null then raise exception 'An active HT Hub membership is required.' using errcode='42501';end if;
 if p_name in ('demoJoinSession','demoLeaveSession') then raise exception 'Rehearsal actions are only available in the explicit demo.' using errcode='42501';end if;
 if r not in ('staff','admin') then raise exception 'An assigned instructor or campus administrator is required.' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>100000 then raise exception 'Invalid request.';end if;
 v_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 -- Serialize duplicate create/update requests before allocating their room.
 perform pg_advisory_xact_lock(hashtextextended('ht-classroom:'||v_id::text,0));
 case p_name
 when 'saveCohort' then
  select * into c from public.ht_cohorts where ht_cohorts.id=v_id for update;
  if found and not ht_private.cohort_manage(v_id) then raise exception 'You do not manage this cohort.' using errcode='42501';end if;
  instructor:=coalesce(nullif(p->>'instructor_id','')::uuid,c.instructor_id,u);
  if r<>'admin' and instructor<>u then raise exception 'Only a campus administrator can assign another instructor.' using errcode='42501';end if;
  if not exists(select 1 from public.ht_members where user_id=instructor and active and role in ('staff','admin')) then raise exception 'Choose an active staff instructor.';end if;
  if c.id is not null and c.instructor_id<>instructor and exists(select 1 from public.ht_class_sessions where cohort_id=v_id) then raise exception 'The instructor is locked after sessions are scheduled. Create a new cohort for a different instructor.';end if;
  status:=coalesce(p->>'status','active');
  if status='archived' and exists(select 1 from public.ht_class_sessions x join public.ea_rooms e on e.id=x.room_id where x.cohort_id=v_id and e.is_live) then raise exception 'End the live classroom before archiving this cohort.';end if;
  insert into public.ht_cohorts(id,title,description,course_id,instructor_id,status) values(v_id,btrim(p->>'title'),coalesce(p->>'description',''),nullif(p->>'course_id','')::uuid,instructor,status)
   on conflict(id) do update set title=excluded.title,description=excluded.description,course_id=excluded.course_id,instructor_id=excluded.instructor_id,status=excluded.status;
 when 'setCohortMember' then
  cid:=(p->>'cohort_id')::uuid;
  if not ht_private.cohort_manage(cid) or not exists(select 1 from public.ht_cohorts where ht_cohorts.id=cid) then raise exception 'You do not manage this cohort.' using errcode='42501';end if;
  if not exists(select 1 from public.ht_members where user_id=(p->>'user_id')::uuid and active and role in ('student','staff')) then raise exception 'Choose an active campus student or staff member.';end if;
  insert into public.ht_cohort_members(cohort_id,user_id,active) values(cid,(p->>'user_id')::uuid,coalesce((p->>'active')::boolean,true)) on conflict(cohort_id,user_id) do update set active=excluded.active;
  v_id:=cid;
 when 'saveClassSession' then
  select * into s from public.ht_class_sessions where ht_class_sessions.id=v_id for update;
  if found and not (r='admin' or s.instructor_id=u) then raise exception 'You do not manage this session.' using errcode='42501';end if;
  audience:=p->>'audience';cid:=nullif(p->>'cohort_id','')::uuid;
  if audience='cohort' then
   select * into c from public.ht_cohorts where ht_cohorts.id=cid for update;
   if not found or c.status<>'active' or not ht_private.cohort_manage(cid) then raise exception 'Choose an active cohort you manage.' using errcode='42501';end if;
   instructor:=c.instructor_id;
  elsif audience='campus' then
   if cid is not null then raise exception 'A campus session cannot also belong to a cohort.';end if;
   instructor:=coalesce(nullif(p->>'instructor_id','')::uuid,s.instructor_id,u);
   if r<>'admin' and instructor<>u then raise exception 'Only an administrator can assign another instructor.' using errcode='42501';end if;
  else raise exception 'Choose a cohort or campus audience.';end if;
  if not exists(select 1 from public.ht_members where user_id=instructor and active and role in ('staff','admin')) then raise exception 'Choose an active staff instructor.';end if;
  if s.id is not null and (s.cohort_id,s.event_id,s.instructor_id,s.audience) is distinct from (cid,nullif(p->>'event_id','')::uuid,instructor,audience) then raise exception 'A scheduled session cannot change its cohort, event, instructor or audience. Create a separate session.';end if;
  starts:=(p->>'starts_at')::timestamptz;ends:=(p->>'ends_at')::timestamptz;status:=coalesce(p->>'status','scheduled');
  if ends<=starts then raise exception 'The end time must be after the start time.';end if;
  if s.id is null then
   room:=gen_random_uuid();slug:='htc-'||substr(replace(gen_random_uuid()::text,'-',''),1,24);
   insert into public.ea_rooms(id,slug,title,host_name,host_emails,host_preset,guest_preset,open_door,next_title,next_at) values(room,slug,btrim(p->>'title'),(select left(display_name,80) from public.ht_members where user_id=instructor),'{}','ht-class-host','ht-class-guest',false,btrim(p->>'title'),starts);
  else
   room:=s.room_id;slug:=s.room_slug;select * into old_room from public.ea_rooms where ea_rooms.id=room for update;
   if status='cancelled' and old_room.is_live then raise exception 'End the live classroom before cancelling the session.';end if;
   if (starts,ends) is distinct from (s.starts_at,s.ends_at) and (old_room.live_since is not null or exists(select 1 from public.ea_room_members where room_id=room)) then raise exception 'Session dates are locked after meeting activity begins. Create a new session.';end if;
   update public.ea_rooms set title=btrim(p->>'title'),next_title=btrim(p->>'title'),next_at=starts,updated_at=now() where ea_rooms.id=room;
  end if;
  insert into public.ht_class_sessions(id,cohort_id,event_id,title,description,starts_at,ends_at,status,audience,instructor_id,room_id,room_slug) values(v_id,cid,nullif(p->>'event_id','')::uuid,btrim(p->>'title'),coalesce(p->>'description',''),starts,ends,status,audience,instructor,room,slug)
   on conflict(id) do update set title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status;
 else raise exception 'Unknown classroom action.';
 end case;
 insert into ht_private.audit_log(actor_id,action,target_id) values(u,p_name,v_id);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
create or replace function public.ht_campus_command(p_name text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select case when p_name in ('saveCohort','setCohortMember','saveClassSession','demoJoinSession','demoLeaveSession') then ht_private.classroom_command(p_name,coalesce(p_payload,'{}')) else ht_private.legacy_ht_campus_command(p_name,p_payload) end
$$;
create function ht_private.classroom_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or ht_private.member_role() is null then raise exception 'An active HT membership is required.' using errcode='42501';end if;
 return jsonb_build_object(
  'cohorts',coalesce((select jsonb_agg(c order by c.title) from public.ht_cohorts c where ht_private.cohort_visible(c.id)),'[]'),
  'cohort_members',coalesce((select jsonb_agg(m) from public.ht_cohort_members m where ht_private.cohort_manage(m.cohort_id) or (m.user_id=auth.uid() and m.active and ht_private.cohort_visible(m.cohort_id))),'[]'),
  'class_sessions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('is_live',r.is_live,'recording_url',case when ht_private.session_allowed(r.id) then replay.watch_url else null end,'replay_published',ht_private.session_allowed(r.id) and replay.watch_url is not null) order by s.starts_at) from public.ht_class_sessions s join public.ea_rooms r on r.id=s.room_id left join lateral(select watch_url from public.ea_room_replays where room_id=r.id and published and status='ready' and watch_url is not null order by created_at desc limit 1) replay on true where ht_private.session_visible(s.id)),'[]'),
  'session_attendance',coalesce((select jsonb_agg(jsonb_build_object('session_id',s.id,'user_id',m.user_id,'first_joined_at',m.first_joined_at,'last_joined_at',m.last_joined_at,'joins',m.joins)) from public.ht_class_sessions s join public.ea_room_members m on m.room_id=s.room_id where ht_private.session_visible(s.id) and (ht_private.member_role()='admin' or (ht_private.member_role()='staff' and s.instructor_id=auth.uid()) or m.user_id=auth.uid())),'[]'));
end $$;
create or replace function public.ht_campus_state() returns jsonb language sql stable security invoker set search_path='' as $$select ht_private.legacy_ht_campus_state()||ht_private.classroom_state()$$;

-- Restrictive policies close legacy permissive OR branches (notably OPIL program-team and
-- uploader policies). Legacy rows return true here and retain their original policies.
do $policies$
declare t text; predicate text; op text;
begin
 foreach t in array array['ea_class_events','ea_class_summaries','ea_class_transcripts','ea_class_presence','ea_class_board_ops','ea_class_warmups','ea_class_scores','ea_class_help','ea_class_reminders','ea_opil_materials'] loop
  if to_regclass('public.'||t) is null then continue;end if;
  predicate:='not ht_private.managed_key(room_key) or public.ea_class_can(room_key)';
  if t in ('ea_class_events','ea_class_summaries','ea_class_transcripts','ea_opil_materials') then predicate:='not ht_private.managed_key(room_key) or public.ea_room_reader(room_key)';end if;
  if t in ('ea_class_scores','ea_class_reminders') then predicate:='not ht_private.managed_key(room_key) or public.ea_class_is_host(room_key)';end if;
  if t='ea_class_help' then predicate:='not ht_private.managed_key(room_key) or (public.ea_class_can(room_key) and (user_id=auth.uid() or public.ea_class_is_host(room_key)))';end if;
  execute format('create policy ht_managed_read on public.%I as restrictive for select to authenticated using (%s)',t,predicate);
  foreach op in array array['insert','update','delete'] loop
   predicate:='not ht_private.managed_key(room_key) or public.ea_class_can(room_key)';
   if t in ('ea_class_scores','ea_class_reminders','ea_opil_materials') or (t='ea_class_help' and op<>'insert') then predicate:='not ht_private.managed_key(room_key) or public.ea_class_is_host(room_key)';end if;
   execute format('create policy ht_managed_%s on public.%I as restrictive for %s to authenticated %s',op,t,op,case when op='insert' then 'with check ('||predicate||')' when op='delete' then 'using ('||predicate||')' else 'using ('||predicate||') with check ('||predicate||')' end);
  end loop;
 end loop;
 -- Original hands DELETE allowed former users to delete their own rows after revocation.
 create policy ht_managed_hands on public.ea_room_hands as restrictive for all to authenticated using(not ht_private.managed_room(room_id) or ht_private.session_allowed(room_id)) with check(not ht_private.managed_room(room_id) or ht_private.session_allowed(room_id));
 if to_regclass('storage.objects') is not null then
  create policy ht_managed_file_read on storage.objects as restrictive for select to authenticated using(not(bucket_id='opil-files' and split_part(name,'/',1)='materials' and split_part(name,'/',3)='room' and ht_private.managed_key('room:'||split_part(name,'/',4))) or public.ea_room_reader('room:'||split_part(name,'/',4)));
  create policy ht_managed_file_write on storage.objects as restrictive for insert to authenticated with check(not(bucket_id='opil-files' and split_part(name,'/',1)='materials' and split_part(name,'/',3)='room' and ht_private.managed_key('room:'||split_part(name,'/',4))) or public.ea_class_is_host('room:'||split_part(name,'/',4)));
  create policy ht_managed_file_update on storage.objects as restrictive for update to authenticated using(not(bucket_id='opil-files' and split_part(name,'/',1)='materials' and split_part(name,'/',3)='room' and ht_private.managed_key('room:'||split_part(name,'/',4))) or public.ea_class_is_host('room:'||split_part(name,'/',4))) with check(not(bucket_id='opil-files' and split_part(name,'/',1)='materials' and split_part(name,'/',3)='room' and ht_private.managed_key('room:'||split_part(name,'/',4))) or public.ea_class_is_host('room:'||split_part(name,'/',4)));
  create policy ht_managed_file_delete on storage.objects as restrictive for delete to authenticated using(not(bucket_id='opil-files' and split_part(name,'/',1)='materials' and split_part(name,'/',3)='room' and ht_private.managed_key('room:'||split_part(name,'/',4))) or public.ea_class_is_host('room:'||split_part(name,'/',4)));
 end if;
end $policies$;

-- Definer reporting RPCs bypass table RLS, so filter their legacy result explicitly.
-- Retain their exact return signatures without duplicating or changing legacy row contracts.
do $reports$
declare fn text; sig text; def text; body text;
begin
 foreach fn in array array['ea_class_attendance_rows','ea_class_help_queue'] loop
  sig:='public.'||fn||case when fn='ea_class_help_queue' then '()' else '(text)' end;
  def:=pg_get_functiondef(to_regprocedure(sig));
  if fn='ea_class_help_queue' then body:=$body$
   select x.* from ht_private.legacy_ea_class_help_queue() x where not ht_private.managed_key(x.room_key)
   union all
   select h.id,h.room_key,h.user_id,h.track,h.text,h.status,h.claimed_by,h.claimed_name,h.answer,h.pinged_at,h.answered_at,h.answer_sent_at,h.created_at,h.updated_at,
    m.display_name,''::text,''::text,null::uuid,''::text
   from public.ea_class_help h join public.ht_members m on m.user_id=h.user_id
   where ht_private.managed_key(h.room_key) and public.ea_class_is_host(h.room_key)
  $body$;
  else body:=$body$
   select x.* from ht_private.legacy_ea_class_attendance_rows(p_key) x where not ht_private.managed_key(p_key)
   union all
   select p.user_id,m.display_name,''::text,''::text,p.state,p.first_seen,p.last_seen,p.seconds,p.waited_s
   from public.ea_class_presence p join public.ht_members m on m.user_id=p.user_id
   where p.room_key=p_key and ht_private.managed_key(p_key) and public.ea_class_is_host(p_key)
  $body$;end if;
  execute split_part(def,'AS $function$',1)||'AS $function$ '||body||' $function$;';
  execute 'alter function '||sig||' set search_path = ''''';
 end loop;
end $reports$;
-- All copied legacy functions remain unreachable from client API calls. The invoker campus
-- wrappers require the two copied campus functions; both still enforce their original access.
revoke all on all functions in schema ht_private from public,anon,authenticated;
grant execute on function ht_private.member_role(),ht_private.is_staff(),ht_private.command(text,jsonb),ht_private.staff_answers(),ht_private.metrics(),ht_private.cohort_manage(uuid),ht_private.cohort_visible(uuid),ht_private.session_visible(uuid),ht_private.classroom_access(text),ht_private.managed_key(text),ht_private.managed_room(uuid),ht_private.session_allowed(uuid),ht_private.classroom_command(text,jsonb),ht_private.classroom_state(),ht_private.legacy_ht_campus_command(text,jsonb),ht_private.legacy_ht_campus_state() to authenticated;
-- Existing public functions retain their prior EXECUTE grants because CREATE OR REPLACE keeps them.
commit;
