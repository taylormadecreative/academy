-- 0049 — warm-ups on the waiting screen (spec 2026-09-16-class-features-design.md §8).
-- The coordinator (or the host, from the room) types a Question of the day on the session; the getting-in
-- screen shows it with a one-line answer and "Where are you joining from?"; the cities line and the
-- Already-here list come from ea_class_warmups + ea_class_presence (0043). Once the class starts the host's
-- Questions tab lists every answer with the name and city, to read out. One row per person per class;
-- anyone who may take part reads the class's rows (the cities line is for everyone), and writes their own.
-- Rooms (room:<id>) carry no stored question yet — the module shows a default one, and the answers still land.

alter table public.ea_opil_sessions add column if not exists warmup_q text
  check (warmup_q is null or char_length(warmup_q) <= 200);
comment on column public.ea_opil_sessions.warmup_q is 'Question of the day for the waiting screen; null = the default question';

create table if not exists public.ea_class_warmups (
  room_key text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answer text check (answer is null or char_length(answer) <= 280),
  city text check (city is null or char_length(city) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_key, user_id)
);
create index if not exists ea_class_warmups_room_idx on public.ea_class_warmups (room_key, created_at);
alter table public.ea_class_warmups enable row level security;

drop policy if exists class_warmups_read on public.ea_class_warmups;
create policy class_warmups_read on public.ea_class_warmups for select to authenticated
  using (public.ea_class_can(room_key));
drop policy if exists class_warmups_insert on public.ea_class_warmups;
create policy class_warmups_insert on public.ea_class_warmups for insert to authenticated
  with check (user_id = auth.uid() and public.ea_class_can(room_key));
drop policy if exists class_warmups_update on public.ea_class_warmups;
create policy class_warmups_update on public.ea_class_warmups for update to authenticated
  using (user_id = auth.uid() and public.ea_class_can(room_key))
  with check (user_id = auth.uid() and public.ea_class_can(room_key));
drop policy if exists class_warmups_delete on public.ea_class_warmups;
create policy class_warmups_delete on public.ea_class_warmups for delete to authenticated
  using (user_id = auth.uid() or public.ea_class_is_host(room_key));   /* the host can clear a stray answer */
grant select, insert, update, delete on public.ea_class_warmups to authenticated;
revoke all on public.ea_class_warmups from anon;

/* updated_at follows every edit so the host's list keeps the latest wording */
create or replace function public.ea_class_warmups_touch() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists ea_class_warmups_touch on public.ea_class_warmups;
create trigger ea_class_warmups_touch before update on public.ea_class_warmups
  for each row execute function public.ea_class_warmups_touch();

/* Names for the Already-here list and the host's answers: everyone with a presence or warm-up row for the
   class. A third of the cohort never filled a profile, so: the profile name, else the registration name,
   else the part of the email before @ — the same fallback the roster cards (0052) and attendance (0043)
   use. Anyone who may take part may read (the waiting screen is for everyone); nobody outside. */
create or replace function public.ea_class_names(p_key text)
returns table (user_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select ids.user_id,
         coalesce(nullif(trim(pr.display_name), ''), nullif(trim(r.full_name), ''), split_part(u.email, '@', 1)) as name
  from (
    select p.user_id from public.ea_class_presence p where p.room_key = p_key
    union
    select w.user_id from public.ea_class_warmups w where w.room_key = p_key
  ) ids
  join auth.users u on u.id = ids.user_id
  left join public.ea_profiles pr on pr.user_id = ids.user_id
  left join public.ea_opil_registrations r on lower(r.email) = lower(u.email)
  where public.ea_class_can(p_key)
$$;
revoke all on function public.ea_class_names(text) from public, anon;
grant execute on function public.ea_class_names(text) to authenticated;

/* the waiting screen and the host's list redraw as answers land */
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ea_class_warmups') then
    alter publication supabase_realtime add table public.ea_class_warmups;
  end if;
end $$;

select 'warm-ups ready' as status;
