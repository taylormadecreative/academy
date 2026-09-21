-- Dedicated inbox read state. No direct message table writes are granted to clients.
-- Preserve the prior campus/classroom command implementation and its public OID.
begin;

do $copy$
declare definition text; prior regprocedure:=to_regprocedure('public.ht_campus_command(text,jsonb)');
begin
 if prior is null or to_regprocedure('ht_private.classroom_command(text,jsonb)') is null then
  raise exception 'Apply the HT campus and cohort classroom migrations first.';
 end if;
 definition:=pg_get_functiondef(prior);
 definition:=replace(definition,'FUNCTION public.ht_campus_command(','FUNCTION ht_private.pre_messages_campus_command(');
 execute definition;
end $copy$;

create function ht_private.message_command(p_name text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); r text:=ht_private.member_role(); p jsonb:=coalesce(p_payload,'{}');
 ids uuid[]; target uuid;
begin
 if u is null or r is null then
  raise exception 'An active HT Hub membership is required.' using errcode='42501';
 end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>100000 then raise exception 'Invalid request.'; end if;

 case p_name
 when 'readMessages' then
  if jsonb_typeof(p->'message_ids') is distinct from 'array' then
   raise exception 'Choose up to 200 valid message IDs.';
  end if;
  if jsonb_array_length(p->'message_ids')>200 or exists(
   select 1 from jsonb_array_elements(p->'message_ids') as e(value)
   where jsonb_typeof(value)<>'string' or value#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  ) then raise exception 'Choose up to 200 valid message IDs.'; end if;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into ids
   from jsonb_array_elements_text(p->'message_ids') as e(value);
  -- Validate the complete set before writing. An invented ID cannot partially
  -- mark the rest of a batch, and staff/admin have no extra inbox permissions.
  if (select count(*) from public.ht_messages where id=any(ids) and recipient_id=u)<>cardinality(ids) then
   raise exception 'Only messages addressed to you can be marked as read.' using errcode='42501';
  end if;
  update public.ht_messages set read_at=now()
   where id=any(ids) and recipient_id=u and read_at is null;
 when 'sendMessage' then
  target:=(p->>'recipient_id')::uuid;
  if not exists(select 1 from public.ht_members where user_id=target and active) or target=u then
   raise exception 'Choose another active campus member.';
  end if;
  insert into public.ht_messages(sender_id,recipient_id,body) values(u,target,btrim(p->>'body'));
  perform ht_private.notify(target,'A new campus message','Open your campus messages to read it.','/ht/hub/messages/?person='||u::text);
 else raise exception 'Unknown message action.';
 end case;
 insert into ht_private.audit_log(actor_id,action,target_id) values(u,p_name,target);
 return jsonb_build_object('ok',true,'id',null);
end $$;

create or replace function public.ht_campus_command(p_name text,p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
 select case when p_name in ('readMessages','sendMessage')
  then ht_private.message_command(p_name,p_payload)
  else ht_private.pre_messages_campus_command(p_name,p_payload) end
$$;

revoke all on function ht_private.message_command(text,jsonb),ht_private.pre_messages_campus_command(text,jsonb) from public,anon,authenticated;
grant execute on function ht_private.message_command(text,jsonb),ht_private.pre_messages_campus_command(text,jsonb) to authenticated;
revoke all on function public.ht_campus_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.ht_campus_command(text,jsonb) to authenticated;

comment on function ht_private.message_command(text,jsonb) is 'Caller-checked campus messages: explicit incoming IDs only; idempotent private inbox state, not proof of reading or delivery.';
commit;
