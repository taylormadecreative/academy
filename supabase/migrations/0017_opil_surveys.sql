-- pre/post competency surveys: the grant's outcome #1 instrument
create table if not exists public.ea_opil_survey_responses (
  survey_key text not null check (survey_key in ('baseline','post')),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 8000),
  created_at timestamptz not null default now(),
  primary key (survey_key, user_id)
);
alter table public.ea_opil_survey_responses enable row level security;
drop policy if exists svy_insert on public.ea_opil_survey_responses;
create policy svy_insert on public.ea_opil_survey_responses for insert to authenticated
  with check (user_id = auth.uid() and (public.ea_opil_in_cohort() or public.ea_opil_is_admin(auth.uid())));
drop policy if exists svy_read_own on public.ea_opil_survey_responses;
create policy svy_read_own on public.ea_opil_survey_responses for select to authenticated
  using (user_id = auth.uid() or public.ea_opil_is_admin(auth.uid()));
select 'surveys ready' as status;
