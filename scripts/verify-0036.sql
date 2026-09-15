-- scripts/verify-0036.sql — proves migration 0036 on prod and KEEPS NOTHING.
-- Everything between begin and rollback is thrown away: the throwaway guest account, the
-- members row, the hands, the live flag, the OPIL session flip. Each check appends one line
-- (OK … / FAIL … / SKIP … / INFO …) to a temp table and the final select returns them all —
-- the Management API answers with the rows of the LAST statement that produced any
-- (postgres-meta: res.reverse().find(x => x.rows.length !== 0)), so the select before the
-- rollback is what comes back. Impersonation sets BOTH request.jwt.claims (json) and
-- request.jwt.claim.sub (plain) so either version of auth.uid() sees the fake user; clearing
-- writes '{}' / '' — never '' into the json one, because ''::jsonb throws inside auth.uid().
-- Run by scripts/apply-0036.sh. Never paste this anywhere without the rollback at the end.
begin;
create temp table verify_out (n serial primary key, line text not null) on commit drop;

do $v$
declare
  v_room       uuid;
  v_key        text;
  v_state      jsonb;
  v_n          bigint;
  v_guest      uuid := '00000000-0000-4000-8000-000000000001';
  v_cand       uuid;
  v_claims     text;
  v_adm_claims text;
  v_how        text := 'throwaway auth.users row (rolled back)';
  v_opil_uid   uuid;
  v_opil_sno   int;
  v_opil_how   text;
  v_new_key    text;
begin
  -- 0. the guest: a throwaway auth.users row so the ea_room_members foreign key can be satisfied;
  --    if this project refuses inserts into auth.users, fall back to a real account that is
  --    neither admin nor member (checked through the same functions the RPC uses).
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zz-test-0036@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
            '', '', '', '');
  exception when others then
    v_how := 'existing account (auth.users insert refused: ' || sqlstate || ')';
    v_guest := null;
    for v_cand in select u.id from auth.users u order by u.created_at limit 50 loop
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_cand), true),
              set_config('request.jwt.claim.sub', v_cand::text, true);
      if not public.ea_is_admin() and not public.ea_is_member() then v_guest := v_cand; exit; end if;
    end loop;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
  end;
  if v_guest is null then
    insert into verify_out(line) values ('FAIL no guest account to test with (auth.users insert refused and no non-admin, non-member account found)');
    return;
  end if;
  v_claims := format('{"sub":"%s","role":"authenticated"}', v_guest);
  insert into verify_out(line) values ('INFO guest = ' || v_guest || ' · ' || v_how);

  -- 1. the room row exists and its key has the right shape
  select id, link_key into v_room, v_key from public.ea_rooms order by created_at limit 1;
  if v_room is null then
    insert into verify_out(line) values ('FAIL the room row exists (ea_rooms is empty — the seed did not run)');
    return;
  end if;
  insert into verify_out(line) values ('OK the room row exists (ea_rooms has one row)');
  insert into verify_out(line) values (case when v_key ~ '^[A-Za-z0-9_-]{22}$' then 'OK ' else 'FAIL ' end || 'the seeded link_key is 22 url-safe chars');
  insert into verify_out(line) values (case when public.ea_room_new_key() ~ '^[A-Za-z0-9_-]{22}$' then 'OK ' else 'FAIL ' end || 'ea_room_new_key() returns 22 url-safe chars');
  insert into verify_out(line) values (case when (select count(*) from public.ea_rooms) = 1 then 'OK ' else 'FAIL ' end || 'exactly one room (ea_rooms_single index)');

  -- 2. anon with a bad key gets exactly {"bad_link": true}
  begin
    set local role anon;
    select public.ea_room_state('nope') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'anon ea_room_state(bad key) = {"bad_link":true} · got ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state(bad key) raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 3. anon with no key: the public shape, no secrets
  begin
    set local role anon;
    select public.ea_room_state() into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'signed_in' = 'false' and v_state->>'is_host' = 'false'
        and v_state->>'can_join' = 'false' and v_state->>'bad_link' = 'false' and v_state->>'host_name' = 'Nelson Taylor'
        and (v_state ? 'id') and (v_state ? 'title') and (v_state ? 'is_live')
        and not (v_state ? 'link_key') and not (v_state ? 'meeting_id')
        and v_state->'recording_url' = 'null'::jsonb and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'anon ea_room_state() shape: signed_in/is_host/can_join/bad_link false, no link_key or meeting_id, recording_url and people null · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 4. anon reads nothing from the room tables (0 rows through RLS, or no select grant at all)
  begin
    set local role anon;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_rooms · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_rooms · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_rooms raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_members;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_room_members · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_room_members · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_members raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_hands;
    reset role;
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'anon sees 0 rows of ea_room_hands · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon sees 0 rows of ea_room_hands · permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role anon;
    select count(*) into v_n from public.ea_room_replays;
    reset role;
    insert into verify_out(line) values ('FAIL anon can select from ea_room_replays (select grant should be revoked) · ' || v_n);
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK anon select from ea_room_replays → 42501 permission denied');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon select ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 5. a signed-in guest with no key: signed in, cannot join, not the host
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state() into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'signed_in' = 'true' and v_state->>'can_join' = 'false'
        and v_state->>'is_host' = 'false' and v_state->>'bad_link' = 'false' and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'guest, no key: signed_in true, can_join false, is_host false, people null · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 6. the same guest with the real key can join; with a wrong 22-char key gets bad_link
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state(v_key) into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'can_join' = 'true' and v_state->>'bad_link' = 'false' and v_state->>'is_host' = 'false'
      then 'OK ' else 'FAIL ' end || 'guest with the real key: can_join true, is_host false · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state(real key) raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state('AAAAAAAAAAAAAAAAAAAAAA') into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'guest with a wrong key = {"bad_link":true} (no title leaks) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state(wrong key) raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 7. guest cannot insert into ea_rooms
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_rooms default values;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest insert into ea_rooms was ALLOWED');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK guest insert into ea_rooms → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest insert into ea_rooms raised ' || sqlstate || ' (expected 42501) ' || sqlerrm);
  end;

  -- 8. guest cannot write meeting_id or link_key (column-level: permission denied, not just 0 rows)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set meeting_id = 'x' where id = v_room;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest update ea_rooms.meeting_id was ALLOWED (no column-level revoke)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.meeting_id → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.meeting_id raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set link_key = 'AAAAAAAAAAAAAAAAAAAAAA' where id = v_room;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL guest update ea_rooms.link_key was ALLOWED (no column-level revoke)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.link_key → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.link_key raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- an allowed column is gated by RLS instead: the update runs and touches 0 rows for a non-admin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_rooms set title = 'hacked' where id = v_room;
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'guest update ea_rooms.title touches 0 rows (admin-only RLS) · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update ea_rooms.title raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 9. the raw download link never reaches a browser; the allowed columns do (0 rows for a guest)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(download_url) into v_n from public.ea_room_replays;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL authenticated can select ea_room_replays.download_url');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK select download_url from ea_room_replays → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL select download_url from ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(id) into v_n from public.ea_room_replays;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'guest select id from ea_room_replays runs and sees 0 rows · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest select id from ea_room_replays raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 10. hands: staged_at is not insertable (column grant), and no hand without a join in THIS session (RLS)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind, staged_at) values (v_room, v_guest, 'question', now());
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL hand insert with staged_at was ALLOWED (column grant missing)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'permission denied%' then 'OK ' else 'FAIL ' end || 'hand insert with staged_at → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert with staged_at raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind) values (v_room, v_guest, 'question');
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL hand insert while NOT in session was ALLOWED');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values (case when sqlerrm like 'new row violates row-level security%' then 'OK ' else 'FAIL ' end || 'hand insert while not in session → 42501 ' || sqlerrm);
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert while not in session raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 11. as the owner: the guest joins the current session (the exact upsert the join function
  --     will do with the service role), and the room goes live. Every count below is scoped to
  --     the guest's own rows, so a --verify-only re-run after real sessions still passes.
  insert into public.ea_room_members (room_id, user_id) values (v_room, v_guest)
    on conflict (room_id, user_id) do update set last_joined_at = now(), joins = public.ea_room_members.joins + 1;
  update public.ea_rooms set is_live = true, live_since = now() where id = v_room;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    insert into public.ea_room_hands (room_id, user_id, kind) values (v_room, v_guest, 'question');
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'hand insert (room_id, user_id, kind) while in session succeeds · ' || v_n || ' row');
  exception when unique_violation then
    reset role;
    insert into verify_out(line) values ('OK hand insert (room_id, user_id, kind) while in session passed the grant and the policy (stopped only by the one-open index, 23505)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL hand insert while in session raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select count(*) into v_n from public.ea_room_hands where room_id = v_room and user_id = v_guest;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'a person in the session reads the queue (room_hands_read) · ' || v_n || ' row');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest read of ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    update public.ea_room_hands set staged_at = now() where room_id = v_room and user_id = v_guest;
    get diagnostics v_n = row_count;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'a person cannot stage their own hand (update is admin-only) · ' || v_n || ' rows');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest update of ea_room_hands raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    select public.ea_room_state() into v_state;
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values (case when v_state->>'is_live' = 'true' and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'a members row admits nothing by itself (is_live true, can_join still false without the key) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL guest ea_room_state() while live raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 12. the admin RPCs refuse a guest
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    perform public.ea_room_rotate_link();
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL ea_room_rotate_link() ran for a guest');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_rotate_link() for a guest → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_rotate_link() for a guest raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true);
    perform public.ea_room_publish_replay(gen_random_uuid(), true);
    reset role;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    insert into verify_out(line) values ('FAIL ea_room_publish_replay() ran for a guest');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_publish_replay() for a guest → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_publish_replay() for a guest raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- ea_room_new_key is server-only
  begin
    set local role authenticated;
    perform public.ea_room_new_key();
    reset role;
    insert into verify_out(line) values ('FAIL authenticated can call ea_room_new_key()');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_new_key() is revoked from authenticated → 42501');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_new_key() as authenticated raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 12b. as Nelson (the first admin in public.profiles): host, sees people, reads the tables, rotates the link
  select p.id into v_cand from public.profiles p where p.role = 'admin' order by p.id limit 1;
  if v_cand is null then
    insert into verify_out(line) values ('SKIP admin checks — no profiles row with role = admin');
  else
    v_adm_claims := format('{"sub":"%s","role":"authenticated"}', v_cand);
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_state() into v_state;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_state->>'is_host' = 'true' and v_state->>'can_join' = 'true'
          and v_state->>'bad_link' = 'false' and (v_state->>'people')::int = 1 and (v_state ? 'recording_url')
        then 'OK ' else 'FAIL ' end || 'admin ea_room_state(): is_host true, can_join true, people = 1 (the seeded join) · ' || coalesce(v_state::text, 'null'));
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_state() raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_state('AAAAAAAAAAAAAAAAAAAAAA') into v_state;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_state->>'bad_link' = 'false' and v_state->>'can_join' = 'true'
        then 'OK ' else 'FAIL ' end || 'admin with a stale key is never told bad_link (privilege admits) · ' || coalesce(v_state::text, 'null'));
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_state(stale key) raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select count(*) into v_n from public.ea_rooms;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin reads ea_rooms directly (rooms_admin_read) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin select ea_rooms raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select count(*) into v_n from public.ea_room_members where room_id = v_room and user_id = v_guest;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin reads ea_room_members (room_members_admin_read) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin select ea_room_members raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      update public.ea_rooms set title = 'verify title', updated_at = now() where id = v_room;
      get diagnostics v_n = row_count;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'admin updates ea_rooms.title (rooms_admin_update + column grant) · ' || v_n || ' row');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin update ea_rooms.title raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      select public.ea_room_rotate_link() into v_new_key;
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values (case when v_new_key ~ '^[A-Za-z0-9_-]{22}$' and v_new_key <> v_key then 'OK ' else 'FAIL ' end || 'admin ea_room_rotate_link() returns a fresh 22-char key');
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_rotate_link() raised ' || sqlstate || ' ' || sqlerrm);
    end;
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_cand::text, true);
      perform public.ea_room_publish_replay(gen_random_uuid(), true);
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values ('FAIL admin ea_room_publish_replay(unknown id) did not raise');
    exception when no_data_found then
      reset role;
      insert into verify_out(line) values ('OK admin ea_room_publish_replay(unknown id) → P0002 (not ready)');
    when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin ea_room_publish_replay(unknown id) raised ' || sqlstate || ' (expected P0002) ' || sqlerrm);
    end;
  end if;

  -- 13. the column grants, both tables (the OPIL rider is the OPIL-facing change in this migration)
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_opil_hands', 'staged_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'created_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'done_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'session_no', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'user_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'kind', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_opil_hands', 'note', 'INSERT')
    then 'OK ' else 'FAIL ' end || 'rider: authenticated may insert ea_opil_hands (session_no, user_id, kind, note) and not staged_at / created_at / done_at');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_room_hands', 'staged_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'created_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'done_at', 'INSERT') = false
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'room_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'user_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'kind', 'INSERT')
    and has_column_privilege('authenticated', 'public.ea_room_hands', 'note', 'INSERT')
    then 'OK ' else 'FAIL ' end || 'authenticated may insert ea_room_hands (room_id, user_id, kind, note) and not staged_at / created_at / done_at');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_rooms', 'meeting_id', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'link_key', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'recording_url', 'UPDATE') = false
    and has_column_privilege('authenticated', 'public.ea_rooms', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'is_live', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'max_participants', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'live_since', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'ended_at', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ea_rooms', 'updated_at', 'UPDATE')
    and has_table_privilege('authenticated', 'public.ea_rooms', 'INSERT') = false
    and has_table_privilege('authenticated', 'public.ea_rooms', 'DELETE') = false
    then 'OK ' else 'FAIL ' end || 'ea_rooms grants: update only title/is_live/max_participants/live_since/ended_at/updated_at; no insert/delete');
  insert into verify_out(line) values (case when
        has_column_privilege('authenticated', 'public.ea_room_replays', 'download_url', 'SELECT') = false
    and has_column_privilege('authenticated', 'public.ea_room_replays', 'download_expires_at', 'SELECT') = false
    and has_column_privilege('authenticated', 'public.ea_room_replays', 'watch_url', 'SELECT')
    and has_column_privilege('anon', 'public.ea_room_replays', 'id', 'SELECT') = false
    then 'OK ' else 'FAIL ' end || 'ea_room_replays grants: no download_url / download_expires_at for authenticated, nothing for anon');
  insert into verify_out(line) values (case when
        exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ea_room_hands')
    then 'OK ' else 'FAIL ' end || 'ea_room_hands is in the supabase_realtime publication');

  -- 14. an OPIL-shaped hand insert (session_no, user_id, kind) still works after the rider — spec
  --     §10 rollout step 1. Subject: a cohort member (ea_opil_team_members) if one exists; else an
  --     OPIL coordinator — hands_insert (0035:30-33) also admits ea_opil_is_program_team(), and
  --     ea_opil_is_admin(uid) (0016:15-20) is true for an ea_opil_admins row OR an allowlisted
  --     email, so Nelson/Jamal always qualify. Both missing is a FAIL, never a SKIP. Uses a live
  --     session if there is one, else flips the lowest-numbered session live INSIDE this
  --     rolled-back transaction.
  select tm.user_id into v_opil_uid from public.ea_opil_team_members tm order by tm.created_at limit 1;
  v_opil_how := 'cohort member';
  if v_opil_uid is null then
    select u.id into v_opil_uid from auth.users u where public.ea_opil_is_admin(u.id) order by u.created_at limit 1;
    v_opil_how := 'OPIL coordinator (ea_opil_team_members is empty — no student has claimed a team yet)';
  end if;
  select s.no into v_opil_sno from public.ea_opil_sessions s where s.is_live order by s.no limit 1;
  if v_opil_sno is null then
    select min(s.no) into v_opil_sno from public.ea_opil_sessions s;
    if v_opil_sno is not null then
      update public.ea_opil_sessions set is_live = true where no = v_opil_sno;   -- rolled back below
    end if;
  end if;
  if v_opil_uid is null or v_opil_sno is null then
    insert into verify_out(line) values ('FAIL OPIL-shaped ea_opil_hands insert — no cohort member and no OPIL coordinator account, or no OPIL session');
  else
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_opil_uid), true),
              set_config('request.jwt.claim.sub', v_opil_uid::text, true);
      insert into public.ea_opil_hands (session_no, user_id, kind) values (v_opil_sno, v_opil_uid, 'question');
      reset role;
      perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
      insert into verify_out(line) values ('OK OPIL-shaped ea_opil_hands insert (session_no, user_id, kind) still works · as ' || v_opil_how || ' · session ' || v_opil_sno);
    exception when unique_violation then
      reset role;
      insert into verify_out(line) values ('OK OPIL-shaped ea_opil_hands insert passed the grant and the policy (stopped only by the one-open index, 23505) · as ' || v_opil_how || ' · session ' || v_opil_sno);
    when others then
      reset role;
      insert into verify_out(line) values ('FAIL OPIL-shaped ea_opil_hands insert raised ' || sqlstate || ' ' || sqlerrm || ' · as ' || v_opil_how);
    end;
  end if;
end $v$;

select line from verify_out order by n;
rollback;
