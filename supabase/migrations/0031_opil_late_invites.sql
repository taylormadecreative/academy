-- 0031: one-time invite links for late registrants.
-- Applications closed Sep 9 (0028 D) and the only late path was seating a row by hand, which
-- loses every answer the coordinator reads at /opil/hub/admin/. Now a coordinator mints a link
-- there; /opil/register/?invite=<token> opens the full form for that one use; the row carries
-- the token, a BEFORE INSERT trigger burns it, and the insert policy lets the row through only
-- if a token is present. The row lands PENDING like every other application: the coordinator's
-- Approve button stays the review step (approved=true is the sole gate in ea_opil_claim_team,
-- so an auto-approved invitee could seat themselves into any team by typing its name).
-- The trigger is the gate: WITH CHECK runs after BEFORE ROW triggers, so a policy that
-- re-checked the token would see it already burned and refuse the very insert it just allowed.
-- This file OWNS the opil_register_insert policy from here on. 0028 (D) used to create it
-- without the invite branch; re-pasting that block would silently kill invite links, so its
-- policy statements were removed there. Extending the deadline is still one edit to
-- ea_opil_registration_open() in 0028. Safe to re-run.

create table if not exists public.ea_opil_invites (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  label      text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- through the end of the 14th day, Central: the card shows a date, so the date must be honest
  expires_at timestamptz not null default (((now() at time zone 'America/Chicago')::date + 15)::timestamp at time zone 'America/Chicago'),
  used_at    timestamptz,
  used_email text
);
alter table public.ea_opil_invites alter column expires_at
  set default (((now() at time zone 'America/Chicago')::date + 15)::timestamp at time zone 'America/Chicago');
alter table public.ea_opil_invites enable row level security;
-- coordinators manage invites; students never touch this table (the check RPC below is definer)
drop policy if exists inv_admin_read on public.ea_opil_invites;
create policy inv_admin_read on public.ea_opil_invites for select to authenticated
  using (public.ea_opil_is_admin(auth.uid()));
drop policy if exists inv_admin_insert on public.ea_opil_invites;
create policy inv_admin_insert on public.ea_opil_invites for insert to authenticated
  with check (public.ea_opil_is_admin(auth.uid()) and created_by = auth.uid());
-- an unused link can be withdrawn; a used one stays as the record of who came in on it
drop policy if exists inv_admin_delete on public.ea_opil_invites;
create policy inv_admin_delete on public.ea_opil_invites for delete to authenticated
  using (public.ea_opil_is_admin(auth.uid()) and used_at is null);
grant select, insert, delete on public.ea_opil_invites to authenticated;

alter table public.ea_opil_registrations add column if not exists invite_token text;

-- the register page asks this before it shows the form, so a dead link says so up front
create or replace function public.ea_opil_invite_valid(t text) returns boolean
language sql stable security definer set search_path = public as
$$ select t is not null and exists (select 1 from ea_opil_invites i
                                    where i.token = t and i.used_at is null and i.expires_at > now()) $$;
revoke all on function public.ea_opil_invite_valid(text) from public;
grant execute on function public.ea_opil_invite_valid(text) to anon, authenticated;

create or replace function public.ea_opil_burn_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invite_token is null then return new; end if;
  update ea_opil_invites set used_at = now(), used_email = new.email
   where token = new.invite_token and used_at is null and expires_at > now();
  if not found then
    -- same code the deadline policy raises, so the page's closed handling covers both
    raise exception 'invite link already used or expired' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists opil_burn_invite on public.ea_opil_registrations;
create trigger opil_burn_invite before insert on public.ea_opil_registrations
  for each row execute function public.ea_opil_burn_invite();

drop policy if exists "opil_register_insert" on public.ea_opil_registrations;
-- approved = false closes a latent hole: nothing revokes column privileges on this table, so a
-- client could otherwise post approved:true whenever the deadline is open
create policy "opil_register_insert" on public.ea_opil_registrations
  for insert to anon, authenticated
  with check (approved = false and (public.ea_opil_registration_open() or invite_token is not null));

select 'opil late invites applied' as status;
