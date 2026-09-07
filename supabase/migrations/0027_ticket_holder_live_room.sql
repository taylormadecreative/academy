-- 0027_ticket_holder_live_room.sql
-- A workshop ticket opens the live room. Until now only Academy members (ea_is_member)
-- could read ea_live.stream_url or use the room chat; the public workshop sells tickets to
-- people who are not members. This links a broadcast to an ea_events row and lets a valid
-- ticket holder for that event read the broadcast and chat, on /agent/live/.
--
-- Access rule: signed in AND (holder_email = the signed-in email OR the ticket was claimed
-- with its seat code). Members and admins keep everything they had.
-- Also: ea_orders.source so seats sold on Eventbrite can be imported and issued codes.

-- ---------------------------------------------------------------- schema
alter table public.ea_live
  add column if not exists event_id uuid references public.ea_events(id) on delete set null;
create index if not exists ea_live_event_idx on public.ea_live (event_id);

alter table public.ea_tickets
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz;
create index if not exists ea_tickets_holder_email_idx on public.ea_tickets (lower(holder_email));
create index if not exists ea_tickets_user_idx on public.ea_tickets (user_id);

alter table public.ea_orders
  add column if not exists source text not null default 'academy'
    check (source in ('academy','eventbrite','comp'));

-- ---------------------------------------------------------------- who holds a ticket
-- STABLE + security definer: runs inside RLS policies on ea_live / ea_live_chat, so it
-- must not itself be blocked by RLS on ea_tickets. The email comes from the JWT, not from
-- a column anyone can edit.
create or replace function public.ea_has_ticket(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from ea_tickets t
     where t.event_id = p_event
       and t.status = 'valid'
       and (t.user_id = auth.uid()
            or lower(t.holder_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;
revoke all on function public.ea_has_ticket(uuid) from public, anon;
grant execute on function public.ea_has_ticket(uuid) to authenticated;

-- The events the signed-in person may enter. Admins see every upcoming event so the
-- broadcast control on the room page can pick one.
create or replace function public.ea_my_ticket_events() returns table (
  id uuid, title text, starts_at timestamptz, ends_at timestamptz, tz text, status text, is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.starts_at, e.ends_at, e.tz, e.status, public.ea_is_admin()
    from ea_events e
   where (public.ea_is_admin() and e.status <> 'canceled' and e.starts_at > now() - interval '30 days')
      or public.ea_has_ticket(e.id)
   order by e.starts_at asc;
$$;
revoke all on function public.ea_my_ticket_events() from public, anon;
grant execute on function public.ea_my_ticket_events() to authenticated;

-- A buyer who signed in with a different email pastes the seat code once. A code can be
-- claimed by exactly one account; the holder email keeps working alongside it.
create or replace function public.ea_claim_ticket(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9-]', '', 'g'));
  v_t    record;
begin
  if auth.uid() is null then return json_build_object('error', 'sign_in'); end if;
  if v_code !~ '^TMA-[A-Z0-9]{6}$' then return json_build_object('error', 'bad_code'); end if;

  select t.*, e.title into v_t
    from ea_tickets t join ea_events e on e.id = t.event_id
   where t.code = v_code for update of t;
  if not found then return json_build_object('error', 'not_found'); end if;
  if v_t.status <> 'valid' then return json_build_object('error', 'void'); end if;
  if v_t.user_id is not null and v_t.user_id <> auth.uid() then
    return json_build_object('error', 'already_claimed');
  end if;

  update ea_tickets set user_id = auth.uid(), claimed_at = coalesce(claimed_at, now())
   where id = v_t.id;
  return json_build_object('ok', true, 'event_id', v_t.event_id, 'title', v_t.title);
end $$;
revoke all on function public.ea_claim_ticket(text) from public, anon;
grant execute on function public.ea_claim_ticket(text) to authenticated;

-- ---------------------------------------------------------------- policies
-- ea_live: members as before, plus a ticket for the linked event.
drop policy if exists ea_live_member_read on public.ea_live;
create policy ea_live_member_read on public.ea_live
  for select to authenticated
  using (access = 'public'
         or public.ea_is_member()
         or (event_id is not null and public.ea_has_ticket(event_id)));

-- ea_live_chat: same rule, resolved through the broadcast row. The subquery on ea_live
-- runs under ea_live's own policy, which is exactly the check we want.
drop policy if exists ea_live_chat_read on public.ea_live_chat;
create policy ea_live_chat_read on public.ea_live_chat
  for select to authenticated
  using (public.ea_is_member()
         or exists (select 1 from public.ea_live l
                     where l.id = ea_live_chat.live_id
                       and l.event_id is not null
                       and public.ea_has_ticket(l.event_id)));

drop policy if exists ea_live_chat_write on public.ea_live_chat;
create policy ea_live_chat_write on public.ea_live_chat
  for insert to authenticated
  with check (user_id = auth.uid()
              and (public.ea_is_member()
                   or exists (select 1 from public.ea_live l
                               where l.id = ea_live_chat.live_id
                                 and l.event_id is not null
                                 and public.ea_has_ticket(l.event_id))));

-- The teaser view gains event_id so the room can find its broadcast while off air.
drop view if exists public.ea_live_upcoming;
create view public.ea_live_upcoming as
  select id, title, blurb, is_live, starts_at, event_id
    from public.ea_live
   where is_live = true or starts_at is null or starts_at > (now() - interval '3 hours')
  offset 0;
revoke insert, update, delete, truncate, references, trigger
  on public.ea_live_upcoming from anon, authenticated, public;
grant select on public.ea_live_upcoming to anon, authenticated;

select 'ticket holders can enter the live room' as status;
