-- Native section coursework. Requires the HT campus, classroom and messaging milestones.
-- Append-only submissions and grade revisions; all client mutations use checked commands.
begin;
create table public.ht_assignments (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.ht_cohorts(id),
 title text not null check(length(btrim(title)) between 1 and 160), instructions text not null default '' check(length(instructions)<=12000),
 points_possible numeric not null check(points_possible>0 and points_possible<=10000),
 opens_at timestamptz, due_at timestamptz, closes_at timestamptz,
 max_attempts integer not null default 1 check(max_attempts between 1 and 10),
 status text not null default 'draft' check(status in ('draft','published')),
 created_by uuid not null references public.ht_members(user_id), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(opens_at is null or isfinite(opens_at)),check(due_at is null or isfinite(due_at)),check(closes_at is null or isfinite(closes_at)),
 check(opens_at is null or due_at is null or opens_at<=due_at),
 check(due_at is null or closes_at is null or due_at<=closes_at),
 check(opens_at is null or closes_at is null or opens_at<=closes_at)
);
create table public.ht_assignment_extensions (
 assignment_id uuid not null references public.ht_assignments(id), user_id uuid not null references public.ht_members(user_id),
 due_at timestamptz,closes_at timestamptz,updated_at timestamptz not null default now(),primary key(assignment_id,user_id),check(due_at is null or isfinite(due_at)),check(closes_at is null or isfinite(closes_at))
);
create table public.ht_assignment_attempts (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.ht_assignments(id),user_id uuid not null references public.ht_members(user_id),
 attempt_no integer not null check(attempt_no between 1 and 10),body text not null default '' check(length(body)<=12000),link_url text,
 submitted_at timestamptz not null default now(),unique(assignment_id,user_id,attempt_no),unique(id,assignment_id,user_id),
 check(length(btrim(body))>0 or link_url is not null),check(link_url is null or (length(link_url)<=2000 and link_url ~ '^https://'))
);
create table public.ht_assignment_grades (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.ht_assignments(id),user_id uuid not null references public.ht_members(user_id),
 attempt_id uuid,score numeric,feedback text not null default '' check(length(feedback)<=12000),
 disposition text not null check(disposition in ('graded','excused')),status text not null check(status in ('draft','published')),
 revision integer not null check(revision>0),graded_by uuid not null references public.ht_members(user_id),
 created_at timestamptz not null default now(),published_at timestamptz,
 unique(assignment_id,user_id,revision),foreign key(attempt_id,assignment_id,user_id) references public.ht_assignment_attempts(id,assignment_id,user_id),
 check((disposition='excused' and score is null) or (disposition='graded' and score is not null and score>=0 and score<=10000)),
 check((status='published' and published_at is not null) or (status='draft' and published_at is null))
);
create index ht_assignments_section on public.ht_assignments(cohort_id,status,due_at);
create index ht_assignment_attempts_user on public.ht_assignment_attempts(user_id,assignment_id,attempt_no desc);
create index ht_assignment_grades_user on public.ht_assignment_grades(user_id,assignment_id,revision desc);
create index ht_assignment_extensions_user on public.ht_assignment_extensions(user_id);

create function ht_private.academic_manage(p_assignment uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(exists(select 1 from public.ht_assignments a where a.id=p_assignment and ht_private.cohort_manage(a.cohort_id)),false)
$$;
create function ht_private.academic_learner(p_assignment uuid) returns boolean language sql stable security definer set search_path='' as $$
 select ht_private.member_role() in ('student','staff') and exists(select 1 from public.ht_assignments a join public.ht_cohorts c on c.id=a.cohort_id join public.ht_cohort_members m on m.cohort_id=c.id where a.id=p_assignment and a.status='published' and c.status='active' and m.user_id=auth.uid() and m.active)
$$;
create function ht_private.academic_dates(p_open timestamptz,p_due timestamptz,p_close timestamptz) returns boolean language sql immutable set search_path='' as $$
 select (p_open is null or isfinite(p_open)) and (p_due is null or isfinite(p_due)) and (p_close is null or isfinite(p_close)) and (p_open is null or p_due is null or p_open<=p_due) and (p_due is null or p_close is null or p_due<=p_close) and (p_open is null or p_close is null or p_open<=p_close)
$$;
create function ht_private.academic_extension_valid(p_open timestamptz,p_due timestamptz,p_close timestamptz,x_due timestamptz,x_close timestamptz) returns boolean language sql immutable set search_path='' as $$
 select (x_due is null or (p_due is not null and x_due>=p_due)) and (x_close is null or (p_close is not null and x_close>=p_close)) and ht_private.academic_dates(p_open,coalesce(x_due,p_due),coalesce(x_close,p_close))
$$;
create function ht_private.academic_link(p_link text) returns text language plpgsql immutable set search_path='' as $$
declare result text:=nullif(btrim(p_link),'');authority text;host text;port text;
begin
 if result is null then return null;end if;
 if length(result)>2000 or result !~* '^https://' or result ~ '[[:space:][:cntrl:]]' or strpos(result,E'\\')>0 then raise exception 'Use an HTTPS submission link without credentials or control characters.';end if;
 authority:=split_part(split_part(split_part(substring(result from 9),'/',1),'?',1),'#',1);
 if authority='' or authority ~ '[@%]' or authority !~ '^(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9._-]+)(:[0-9]{1,5})?$' then raise exception 'Use an HTTPS submission link without credentials or control characters.';end if;
 if authority like '[%' then
  host:=split_part(substring(authority from 2),']',1);
  if strpos(host,':')=0 then raise exception 'Use a valid HTTPS submission link.';end if;
  begin perform host::inet;exception when invalid_text_representation then raise exception 'Use a valid HTTPS submission link.';end;
  port:=nullif(substring(authority from '\]:([0-9]+)$'),'');
 else port:=nullif(split_part(authority,':',2),'');end if;
 if port is not null and port::integer>65535 then raise exception 'Use a valid HTTPS submission link.';end if;
 -- Normalize the scheme only; path/query casing is significant.
 return 'https://'||substring(result from 9);
end $$;

alter table public.ht_assignments enable row level security;
alter table public.ht_assignment_extensions enable row level security;
alter table public.ht_assignment_attempts enable row level security;
alter table public.ht_assignment_grades enable row level security;
revoke all on public.ht_assignments,public.ht_assignment_extensions,public.ht_assignment_attempts,public.ht_assignment_grades from public,anon,authenticated;
grant select on public.ht_assignments,public.ht_assignment_extensions,public.ht_assignment_attempts,public.ht_assignment_grades to authenticated;
create policy academic_assignments_read on public.ht_assignments for select to authenticated using(ht_private.academic_manage(id) or ht_private.academic_learner(id));
create policy academic_extensions_read on public.ht_assignment_extensions for select to authenticated using(ht_private.academic_manage(assignment_id) or (user_id=auth.uid() and ht_private.academic_learner(assignment_id)));
create policy academic_attempts_read on public.ht_assignment_attempts for select to authenticated using(ht_private.academic_manage(assignment_id) or (user_id=auth.uid() and ht_private.academic_learner(assignment_id)));
create policy academic_grades_read on public.ht_assignment_grades for select to authenticated using(ht_private.academic_manage(assignment_id) or (user_id=auth.uid() and status='published' and ht_private.academic_learner(assignment_id)));

-- Copy the current wrappers, then replace originals without changing their OIDs.
do $copy$
declare fn text; prior regprocedure; definition text;
begin
 foreach fn in array array['ht_campus_command','ht_campus_state'] loop
  prior:=to_regprocedure('public.'||fn||case when fn='ht_campus_command' then '(text,jsonb)' else '()' end);
  if prior is null then raise exception 'Missing coursework prerequisite: %',fn;end if;
  definition:=pg_get_functiondef(prior);
  execute replace(definition,'FUNCTION public.'||fn||'(','FUNCTION ht_private.pre_academics_'||fn||'(');
 end loop;
end $copy$;

create function ht_private.academic_command(p_name text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r text:=ht_private.member_role();v_id uuid;aid uuid;recipient uuid;
 a public.ht_assignments;c public.ht_cohorts;ext public.ht_assignment_extensions;latest public.ht_assignment_attempts;
 title text;instructions text;points numeric;attempts integer;state text;op timestamptz;due timestamptz;closing timestamptz;
 body text;link text;counted integer;attempt_ref uuid;score numeric;feedback text;disposition text;revision integer;expected integer;
begin
 if u is null or r is null then raise exception 'An active HT Hub membership is required.' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>100000 then raise exception 'Invalid coursework request.';end if;
 if p_name='saveAssignment' then
  v_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  perform pg_advisory_xact_lock(hashtextextended('ht-assignment:'||v_id::text,0));
  select * into a from public.ht_assignments where id=v_id for update;
  if a.id is not null and a.cohort_id is distinct from nullif(p->>'cohort_id','')::uuid then raise exception 'An assignment cannot move between sections.';end if;
  select * into c from public.ht_cohorts where id=nullif(p->>'cohort_id','')::uuid for share;
  if not found or not ht_private.cohort_manage(c.id) then raise exception 'Only this section instructor or a campus administrator can manage coursework.' using errcode='42501';end if;
  if c.status<>'active' then raise exception 'Archived sections cannot accept coursework changes.';end if;
  title:=btrim(p->>'title');instructions:=coalesce(p->>'instructions','');points:=(p->>'points_possible')::numeric;attempts:=coalesce((p->>'max_attempts')::integer,1);state:=coalesce(p->>'status','draft');
  op:=nullif(p->>'opens_at','')::timestamptz;due:=nullif(p->>'due_at','')::timestamptz;closing:=nullif(p->>'closes_at','')::timestamptz;
  if not ht_private.academic_dates(op,due,closing) then raise exception 'Use dates in open, due, close order.';end if;
  if a.id is not null and (a.points_possible is distinct from points or a.status is distinct from state) and (exists(select 1 from public.ht_assignment_attempts where assignment_id=v_id) or exists(select 1 from public.ht_assignment_grades where assignment_id=v_id)) then raise exception 'Points and publication are locked after submissions or grades exist.';end if;
  if attempts<coalesce((select max(n) from (select count(*)::integer n from public.ht_assignment_attempts where assignment_id=v_id group by user_id) x),0) then raise exception 'The attempt limit cannot be below existing submission history.';end if;
  if exists(select 1 from public.ht_assignment_extensions x where x.assignment_id=v_id and not ht_private.academic_extension_valid(op,due,closing,x.due_at,x.closes_at)) then raise exception 'These dates conflict with an existing extension. Update or clear that extension first.';end if;
  insert into public.ht_assignments(id,cohort_id,title,instructions,points_possible,opens_at,due_at,closes_at,max_attempts,status,created_by) values(v_id,c.id,title,instructions,points,op,due,closing,attempts,state,u)
   on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,points_possible=excluded.points_possible,opens_at=excluded.opens_at,due_at=excluded.due_at,closes_at=excluded.closes_at,max_attempts=excluded.max_attempts,status=excluded.status,updated_at=now();
 else
  aid:=nullif(p->>'assignment_id','')::uuid;
  -- Every attempt, extension and grade serializes on the assignment. A grade cannot silently
  -- approve a stale attempt, and two submissions cannot both claim the remaining attempt slot.
  select * into a from public.ht_assignments where id=aid for update;
  if not found then raise exception 'This assignment is not available.' using errcode='42501';end if;
  select * into c from public.ht_cohorts where id=a.cohort_id for share;
  if c.status<>'active' then raise exception 'Archived sections cannot accept coursework changes.';end if;
  if p_name='submitAssignment' then
   if not ht_private.academic_learner(aid) then raise exception 'Active section enrollment and a published assignment are required.' using errcode='42501';end if;
   if c.instructor_id=u then raise exception 'The assigned instructor cannot submit their own assignment.' using errcode='42501';end if;
   perform 1 from public.ht_cohort_members where cohort_id=c.id and user_id=u and active for share;
   if not found then raise exception 'Active section enrollment is required.' using errcode='42501';end if;
   select * into ext from public.ht_assignment_extensions where assignment_id=aid and user_id=u;
   if a.opens_at is not null and now()<a.opens_at then raise exception 'This assignment is not open yet.';end if;
   if coalesce(ext.closes_at,a.closes_at) is not null and now()>coalesce(ext.closes_at,a.closes_at) then raise exception 'This assignment is closed. Ask your instructor about an extension.';end if;
   select count(*) into counted from public.ht_assignment_attempts where assignment_id=aid and user_id=u;
   if counted>=a.max_attempts then raise exception 'The submission attempt limit has been reached.';end if;
   body:=coalesce(p->>'body','');link:=ht_private.academic_link(p->>'link_url');v_id:=gen_random_uuid();
   insert into public.ht_assignment_attempts(id,assignment_id,user_id,attempt_no,body,link_url) values(v_id,aid,u,counted+1,body,link);
  elsif p_name in ('gradeAssignment','setAssignmentExtension') then
   if not ht_private.cohort_manage(c.id) then raise exception 'Only this section instructor or a campus administrator can manage coursework.' using errcode='42501';end if;
   recipient:=nullif(p->>'user_id','')::uuid;
   perform 1 from public.ht_members m join public.ht_cohort_members cm on cm.user_id=m.user_id where m.user_id=recipient and m.active and m.role in ('student','staff') and cm.cohort_id=c.id and cm.active for share of m,cm;
   if not found then raise exception 'Choose an active enrolled student or staff learner.' using errcode='42501';end if;
   if p_name='setAssignmentExtension' then
    if a.status<>'published' then raise exception 'Publish this assignment before granting an extension.';end if;
    if coalesce((p->>'clear')::boolean,false) then delete from public.ht_assignment_extensions where assignment_id=aid and user_id=recipient;
    else
     due:=nullif(p->>'due_at','')::timestamptz;closing:=nullif(p->>'closes_at','')::timestamptz;
     if not ht_private.academic_extension_valid(a.opens_at,a.due_at,a.closes_at,due,closing) then raise exception 'An extension must preserve open/due/close order and cannot shorten an original deadline or add a deadline where none exists.';end if;
     insert into public.ht_assignment_extensions(assignment_id,user_id,due_at,closes_at) values(aid,recipient,due,closing) on conflict(assignment_id,user_id) do update set due_at=excluded.due_at,closes_at=excluded.closes_at,updated_at=now();
    end if;v_id:=aid;
   else
    if recipient=u then raise exception 'You cannot grade your own coursework.' using errcode='42501';end if;
    if a.status<>'published' then raise exception 'Publish this assignment before grading.';end if;
    select * into latest from public.ht_assignment_attempts where assignment_id=aid and user_id=recipient order by attempt_no desc limit 1;
    attempt_ref:=nullif(p->>'attempt_id','')::uuid;
    if attempt_ref is distinct from latest.id then raise exception 'Review the latest submission before saving a grade.';end if;
    select coalesce(max(g.revision),0) into revision from public.ht_assignment_grades g where assignment_id=aid and user_id=recipient;
    expected:=(p->>'expected_revision')::integer;
    if expected is null or expected<>revision then raise exception 'This grade changed. Reload the latest grade before saving.' using errcode='40001';end if;
    score:=nullif(p->>'score','')::numeric;feedback:=coalesce(p->>'feedback','');disposition:=p->>'disposition';state:=p->>'status';
    if disposition='graded' and (score is null or score<0 or score>a.points_possible) then raise exception 'Enter a score between zero and the assignment points possible.';end if;
    if disposition='excused' and score is not null then raise exception 'An excused grade must not include a score.';end if;
    if latest.id is null and disposition<>'excused' and (score is distinct from 0 or length(btrim(feedback))=0) then raise exception 'Without a submission, publish or draft an excusal or an explicit zero with explanatory feedback.';end if;
    v_id:=gen_random_uuid();
    insert into public.ht_assignment_grades(id,assignment_id,user_id,attempt_id,score,feedback,disposition,status,revision,graded_by,published_at) values(v_id,aid,recipient,attempt_ref,score,feedback,disposition,state,revision+1,u,case when state='published' then now() else null end);
    if state='published' then insert into public.ht_notifications(user_id,title,body,href) values(recipient,'Coursework feedback is available',a.title,'/ht/hub/courses/?cohort='||c.id::text||'&tab=grades');end if;
   end if;
  else raise exception 'Unknown coursework action.';end if;
 end if;
 insert into ht_private.audit_log(actor_id,action,target_id) values(u,p_name,v_id);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;

create function ht_private.academic_state() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or ht_private.member_role() is null then raise exception 'An active HT Hub membership is required.' using errcode='42501';end if;
 -- SECURITY INVOKER deliberately applies the same RLS as direct Data API table reads.
 return jsonb_build_object(
 'assignments',coalesce((select jsonb_agg(a order by a.created_at,a.id) from public.ht_assignments a),'[]'),
 'assignment_extensions',coalesce((select jsonb_agg(x) from public.ht_assignment_extensions x),'[]'),
 'assignment_attempts',coalesce((select jsonb_agg(x order by x.attempt_no) from public.ht_assignment_attempts x),'[]'),
 'assignment_grades',coalesce((select jsonb_agg(x order by x.revision) from public.ht_assignment_grades x),'[]'));
end $$;
create or replace function public.ht_campus_command(p_name text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select case when p_name in ('saveAssignment','submitAssignment','gradeAssignment','setAssignmentExtension') then ht_private.academic_command(p_name,coalesce(p_payload,'{}')) else ht_private.pre_academics_ht_campus_command(p_name,p_payload) end
$$;
create or replace function public.ht_campus_state() returns jsonb language sql stable security invoker set search_path='' as $$select ht_private.pre_academics_ht_campus_state()||ht_private.academic_state()$$;
revoke all on function ht_private.academic_manage(uuid),ht_private.academic_learner(uuid),ht_private.academic_dates(timestamptz,timestamptz,timestamptz),ht_private.academic_extension_valid(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz),ht_private.academic_link(text),ht_private.academic_command(text,jsonb),ht_private.academic_state(),ht_private.pre_academics_ht_campus_command(text,jsonb),ht_private.pre_academics_ht_campus_state() from public,anon,authenticated;
grant execute on function ht_private.academic_manage(uuid),ht_private.academic_learner(uuid),ht_private.academic_command(text,jsonb),ht_private.academic_state(),ht_private.pre_academics_ht_campus_command(text,jsonb),ht_private.pre_academics_ht_campus_state() to authenticated;
revoke all on function public.ht_campus_command(text,jsonb),public.ht_campus_state() from public,anon,authenticated;
grant execute on function public.ht_campus_command(text,jsonb),public.ht_campus_state() to authenticated;
commit;
