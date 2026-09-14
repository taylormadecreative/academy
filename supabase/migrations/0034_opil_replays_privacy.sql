-- 0034: who may read a draft replay. 0033 let the whole program team (judges included) read every
-- row of ea_opil_replays, including the presigned raw-file download link. Narrow it to the same
-- people who may publish — a coordinator, or that session's facilitator — and keep the raw
-- download link server-only: browsers get the Stream watch page, never the R2 file.
-- Column-level grants: a table-level SELECT cannot be trimmed per column, so revoke the table
-- grant and re-grant every column except the two links. Pages must select explicit columns
-- (select('*') now fails for authenticated — by design). Safe to re-run.
drop policy if exists replays_program_read on public.ea_opil_replays;
drop policy if exists replays_host_read on public.ea_opil_replays;
create policy replays_host_read on public.ea_opil_replays for select to authenticated
  using (public.ea_opil_is_admin(auth.uid()) or session_no = any(public.ea_opil_fac_sessions(auth.uid())));
revoke select on public.ea_opil_replays from authenticated, anon;
grant select (id, session_no, meeting_id, recording_id, status, stream_uid, watch_url, duration_s, file_size, error, published, created_at, updated_at)
  on public.ea_opil_replays to authenticated;
select 'opil replays privacy ready' as status;
