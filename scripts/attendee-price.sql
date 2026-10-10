-- The AI 101 class price, Oct 9 2026 (needs 0060). Nelson after class: "only for those who attended the workshop today
-- and make it 72hrs". Part 1 fills the $65 tier's list from the Academy room's attendance that night (anyone who
-- joined between 6 and 10 PM CT); no email lives in this file. Part 2 opens the tier to that list now, until
-- Monday, Oct 12 at 9 PM CT. Safe to re-run. To add someone by hand (signed in with another email):
--   insert into public.ea_tier_allowlist (tier_id, email, note) values ('59aaee15-59a6-46ba-92a0-dd15f30827ab', lower('<email>'), 'added by Nelson');
begin;

insert into public.ea_tier_allowlist (tier_id, email, note)
select '59aaee15-59a6-46ba-92a0-dd15f30827ab', lower(btrim(u.email)), 'AI 101 room, Oct 9'
  from public.ea_room_members m
  join auth.users u on u.id = m.user_id
 where m.room_id = 'e9666335-5d27-47f1-803f-7ef81c81e9f9'
   and m.last_joined_at >= '2026-10-09 23:00:00+00' and m.last_joined_at < '2026-10-10 03:00:00+00'
   and u.email is not null
on conflict do nothing;

-- Part 2 (run after the page that understands 'attendees' is live)
-- update public.ea_ticket_tiers
--    set access = 'attendees', sales_start = least(sales_start, now()), sales_end = '2026-10-13 02:00:00+00',
--        description = 'For people in the AI 101 room on Oct 9. Use the email you signed in with that night. Ends Monday, Oct 12 at 9 PM CT.'
--  where id = '59aaee15-59a6-46ba-92a0-dd15f30827ab';

commit;
