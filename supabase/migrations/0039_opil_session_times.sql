-- 0039 — a start and end time per OPIL session (Atlanta wall time), so the join screen can say
-- "Class time · 6:30 – 7:30 PM ET" (and "5:30 – 6:30 PM CT" to a student in Dallas) instead of the
-- page's old guess of 7:00 PM for every session. Null = not announced yet: the screen then says
-- "starts when <facilitator> opens the room". Kickoff (session 1) is 6:30–7:30 PM ET per Jamal's
-- welcome email of 2026-09-15. Read access follows the table's sess_read policy (columns inherit).
alter table public.ea_opil_sessions
  add column if not exists start_time time,
  add column if not exists end_time time;
comment on column public.ea_opil_sessions.start_time is 'class start, America/New_York wall time; null = not announced';
comment on column public.ea_opil_sessions.end_time is 'class end, America/New_York wall time; null = not announced';

update public.ea_opil_sessions set start_time = '18:30', end_time = '19:30' where no = 1 and start_time is null;
