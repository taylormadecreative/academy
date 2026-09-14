-- 0032: parallel class rooms.
-- 0023 pinned the program to ONE live session (ea_opil_sessions_one_live) because the live
-- page had one room and the one-way broadcast has one Cloudflare Stream input. Class mode
-- (ea-rtk-join, shipped 2026-09-11) opens a separate RealtimeKit meeting per session, so
-- nothing physical stops three facilitators teaching at once — only that index. Replace it
-- with a one-STREAM index: any number of rows may be live with an "rtk:<id>" stream_url (a
-- class room), but at most one may be live with anything else (the shared camera input, a
-- YouTube URL, the rehearsal clip). Chat (0019/0028) and ea-rtk-join were already keyed per
-- session and need nothing. The Academy's own ea_live_one_live is untouched. Safe to re-run.
drop index if exists public.ea_opil_sessions_one_live;
create unique index if not exists ea_opil_sessions_one_stream
  on public.ea_opil_sessions ((is_live))
  where is_live and coalesce(stream_url, '') not like 'rtk:%';
select 'opil parallel live ready' as status;
