-- 0038 — anyone in the class room can get in the question line (Nelson, 2026-09-15:
-- "make it to where jamal can or anybody can ask question").
--
-- Before: hands_read / hands_insert admitted cohort members and the program team. A judge
-- (opil-judge preset: watch + chat) saw the Ask a question button and got "new row violates
-- row-level security" when they pressed it. The page hid the button from hosts entirely.
--
-- ea-rtk-join only hands a token to cohort, program team, or judges, so "anyone in the room"
-- is exactly those three. Everything else about the row stays as 0035 set it: you can only
-- raise your own hand, only while that session is live; only the session's host stages or
-- clears a hand; you can drop your own.

drop policy if exists hands_read on public.ea_opil_hands;
create policy hands_read on public.ea_opil_hands for select to authenticated
  using (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()) or public.ea_opil_is_judge(auth.uid()));

drop policy if exists hands_insert on public.ea_opil_hands;
create policy hands_insert on public.ea_opil_hands for insert to authenticated
  with check (user_id = auth.uid()
              and (public.ea_opil_in_cohort() or public.ea_opil_is_program_team(auth.uid()) or public.ea_opil_is_judge(auth.uid()))
              and exists (select 1 from public.ea_opil_sessions s where s.no = ea_opil_hands.session_no and s.is_live));

select 'anyone in the room can ask' as status;
