-- scripts/verify-0037.sql — proves migration 0037 on prod and KEEPS NOTHING (begin … rollback).
-- Same harness as verify-0036.sql: each check appends OK/FAIL/SKIP/INFO to a temp table, the select
-- before the rollback is what the Management API returns. Impersonation sets request.jwt.claims
-- (json, with email) AND request.jwt.claim.sub / .email (plain) so auth.uid() and ea_jwt_email()
-- both see the fake user. Run by scripts/apply-0037.sh.
begin;
create temp table verify_out (n serial primary key, line text not null) on commit drop;

do $v$
declare
  v_ht uuid; v_ac uuid; v_ht_key text; v_ac_key text;
  v_guest uuid := '00000000-0000-4000-8000-000000000037';
  v_email text := 'zz-test-0037@example.com';
  v_claims text; v_state jsonb; v_n bigint; v_t text; v_arr text[];
  v_rep_ht uuid; v_rep_ac uuid; v_adm uuid; v_adm_claims text;
begin
  -- 0. a throwaway account with an email (the members FK and ea_jwt_email need a real row); if this
  --    project refuses inserts into auth.users, fall back to an existing account that is neither admin
  --    nor member and use ITS email — the same fallback verify-0036 uses (all of it rolled back).
  begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_guest, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            v_email, '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into verify_out(line) values ('INFO guest = throwaway auth.users row (rolled back)');
  exception when others then
    v_guest := null;
    for v_adm in select u.id from auth.users u where u.email is not null order by u.created_at limit 50 loop
      perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_adm), true), set_config('request.jwt.claim.sub', v_adm::text, true);
      if not public.ea_is_admin() and not public.ea_is_member() then v_guest := v_adm; exit; end if;
    end loop;
    perform set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true);
    v_adm := null;
    if v_guest is null then
      insert into verify_out(line) values ('FAIL no guest account to test with (auth.users insert refused: ' || sqlstate || '; no non-admin, non-member account found)');
      return;
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = v_guest;
    insert into verify_out(line) values ('INFO guest = existing account ' || v_guest || ' (auth.users insert refused: ' || sqlstate || ')');
  end;
  v_claims := format('{"sub":"%s","role":"authenticated","email":"%s"}', v_guest, v_email);

  -- 1. two rows, the right slugs and presets, the single-row index gone
  select id, link_key into v_ht, v_ht_key from public.ea_rooms where slug = 'ht';
  select id, link_key into v_ac, v_ac_key from public.ea_rooms where slug = 'academy';
  insert into verify_out(line) values (case when v_ht is not null and v_ac is not null then 'OK ' else 'FAIL ' end || 'rows academy + ht exist');
  if v_ht is null or v_ac is null then return; end if;
  select host_preset || '/' || guest_preset || '/' || title || '/' || host_name into v_t from public.ea_rooms where id = v_ht;
  insert into verify_out(line) values (case when v_t = 'ht-class-host/ht-class-guest/HT Live/Nelson Taylor' then 'OK ' else 'FAIL ' end || 'ht row defaults · ' || v_t);
  select host_preset || '/' || guest_preset into v_t from public.ea_rooms where id = v_ac;
  insert into verify_out(line) values (case when v_t = 'tma-class-host/tma-class-guest' then 'OK ' else 'FAIL ' end || 'academy row keeps the Academy presets · ' || v_t);
  insert into verify_out(line) values (case when not exists (select 1 from pg_indexes where indexname = 'ea_rooms_single') then 'OK ' else 'FAIL ' end || 'ea_rooms_single is gone');
  insert into verify_out(line) values (case when exists (select 1 from pg_indexes where indexname = 'ea_rooms_slug') then 'OK ' else 'FAIL ' end || 'ea_rooms_slug unique index exists');
  begin
    insert into public.ea_rooms (slug) values ('ht');
    insert into verify_out(line) values ('FAIL a second ht row was accepted');
  exception when unique_violation then
    insert into verify_out(line) values ('OK a second ht row is refused (23505)');
  end;

  -- 2. anon: the HT shape, a bad key, the real key
  begin
    set local role anon;
    select public.ea_room_state(null, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'slug' = 'ht' and v_state->>'signed_in' = 'false' and v_state->>'is_host' = 'false'
        and v_state->>'can_join' = 'false' and v_state->>'bad_link' = 'false' and v_state->>'host_name' = 'Nelson Taylor'
        and not (v_state ? 'link_key') and not (v_state ? 'meeting_id') and not (v_state ? 'host_emails')
        and v_state->'recording_url' = 'null'::jsonb and v_state->'people' = 'null'::jsonb
      then 'OK ' else 'FAIL ' end || 'anon ea_room_state(null, ht) shape, no secrets · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state('nope', 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'anon bad key on ht = {"bad_link":true} · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state(v_ht_key, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'can_join' = 'true' and v_state->>'signed_in' = 'false' then 'OK ' else 'FAIL ' end || 'anon with the real key: can_join true, signed_in false · ' || coalesce(v_state::text, 'null'));
    set local role anon;
    select public.ea_room_state(null, 'nope') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state is null then 'OK ' else 'FAIL ' end || 'unknown slug → null');
    set local role anon;
    select public.ea_room_state('nope') into v_state;   -- the Academy page's one-arg call still resolves
    reset role;
    insert into verify_out(line) values (case when v_state = '{"bad_link":true}'::jsonb then 'OK ' else 'FAIL ' end || 'one-argument ea_room_state(key) still resolves (defaults to academy) · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL anon ea_room_state raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 3. a signed-in stranger: not a host, reads no room, no replay; after joining once, sees the replay
  update public.ea_rooms set recording_url = 'https://example.invalid/r/watch' where id = v_ht;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'false' and v_state->>'can_join' = 'false' and v_state->'recording_url' = 'null'::jsonb then 'OK ' else 'FAIL ' end || 'stranger: not host, cannot join, no replay · ' || coalesce(v_state::text, 'null'));
    insert into verify_out(line) values (case when v_n = 0 then 'OK ' else 'FAIL ' end || 'stranger reads 0 rows of ea_rooms · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL stranger checks raised ' || sqlstate || ' ' || sqlerrm);
  end;
  insert into public.ea_room_members (room_id, user_id) values (v_ht, v_guest);   -- as the join function would (service role)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'recording_url' = 'https://example.invalid/r/watch' and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'someone who joined before sees the replay, still cannot join without the key · ' || coalesce(v_state::text, 'null'));
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'academy') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->'recording_url' = 'null'::jsonb and v_state->>'can_join' = 'false' then 'OK ' else 'FAIL ' end || 'an HT joiner gets nothing on the Academy row · ' || coalesce(v_state::text, 'null'));
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL joiner checks raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 4. ea_room_set_hosts: refused for the stranger; as postgres it normalises the list
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_set_hosts(v_ht, array[v_email]);
    reset role;
    insert into verify_out(line) values ('FAIL a non-admin could set hosts');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK ea_room_set_hosts refuses a non-admin (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL ea_room_set_hosts raised ' || sqlstate || ' ' || sqlerrm);
  end;
  -- (as the migration owner, bypassing the admin check is not possible: call the update directly to stage the host list)
  select coalesce(array_agg(distinct e order by e), '{}'::text[]) into v_arr
    from (select lower(trim(x)) as e from unnest(array['  ZZ-Test-0037@Example.com ', v_email, '', 'not-an-email']) as x) s
    where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  insert into verify_out(line) values (case when v_arr = array[v_email] then 'OK ' else 'FAIL ' end || 'host list normalises (lower, trim, dedupe, drop junk) · ' || v_arr::text);
  update public.ea_rooms set host_emails = array[v_email] where id = v_ht;

  -- 5. the listed email is now a host of ht — and of nothing else
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'ht') into v_state;
    select count(*) into v_n from public.ea_rooms;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'true' and v_state->>'can_join' = 'true' and (v_state->>'people')::int = 1 then 'OK ' else 'FAIL ' end || 'listed email: is_host, can_join, people=1 on ht · ' || coalesce(v_state::text, 'null'));
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'listed email reads exactly its own room row (ht, not academy) · ' || v_n);
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_state(null, 'academy') into v_state;
    reset role;
    insert into verify_out(line) values (case when v_state->>'is_host' = 'false' then 'OK ' else 'FAIL ' end || 'listed email is NOT a host of academy · ' || coalesce(v_state::text, 'null'));
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    update public.ea_rooms set title = 'zz-test title', host_name = 'Dr. Test' where id = v_ht;
    get diagnostics v_n = row_count;
    reset role;
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'host updates title + host_name on its room · ' || v_n || ' row');
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select public.ea_room_rotate_link(v_ht) into v_t;
    reset role;
    insert into verify_out(line) values (case when v_t ~ '^[A-Za-z0-9_-]{22}$' and v_t <> v_ht_key then 'OK ' else 'FAIL ' end || 'host rotates its own link');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL host checks raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_rotate_link(v_ac);
    reset role;
    insert into verify_out(line) values ('FAIL an HT host rotated the Academy link');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK an HT host cannot rotate the Academy link (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL rotate(academy) as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    update public.ea_rooms set host_emails = '{}' where id = v_ht;
    reset role;
    insert into verify_out(line) values ('FAIL a host could update host_emails (column grant missing)');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK host_emails has no update grant for authenticated (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL host_emails update raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 6. publish is scoped to the room: publishing ht's replay leaves academy's published
  insert into public.ea_room_replays (room_id, meeting_id, recording_id, status, watch_url, published)
    values (v_ac, 'zz-meet-ac', 'zz-rec-ac', 'ready', 'https://example.invalid/ac/watch', true) returning id into v_rep_ac;
  insert into public.ea_room_replays (room_id, meeting_id, recording_id, status, watch_url)
    values (v_ht, 'zz-meet-ht', 'zz-rec-ht', 'ready', 'https://example.invalid/ht/watch') returning id into v_rep_ht;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_publish_replay(v_rep_ht, true);
    reset role;
    select count(*) into v_n from public.ea_room_replays where id = v_rep_ac and published;
    select recording_url into v_t from public.ea_rooms where id = v_ht;
    insert into verify_out(line) values (case when v_n = 1 and v_t = 'https://example.invalid/ht/watch' then 'OK ' else 'FAIL ' end || 'publish ht → ht.recording_url set, academy replay still published');
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL publish as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    perform public.ea_room_publish_replay(v_rep_ac, false);
    reset role;
    insert into verify_out(line) values ('FAIL an HT host unpublished an Academy replay');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK an HT host cannot touch an Academy replay (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('FAIL unpublish(academy) as HT host raised ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    select count(*) into v_n from public.ea_room_replays;
    reset role;
    insert into verify_out(line) values (case when v_n = 1 then 'OK ' else 'FAIL ' end || 'HT host reads only HT replays · ' || v_n);
  exception when others then
    reset role;
    insert into verify_out(line) values ('FAIL replay read raised ' || sqlstate || ' ' || sqlerrm);
  end;

  -- 7. Nelson still hosts both rooms
  select p.id into v_adm from public.profiles p where p.role = 'admin' order by p.id limit 1;
  if v_adm is null then
    insert into verify_out(line) values ('SKIP admin checks — no profiles row with role = admin');
  else
    v_adm_claims := format('{"sub":"%s","role":"authenticated"}', v_adm);
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims', v_adm_claims, true), set_config('request.jwt.claim.sub', v_adm::text, true), set_config('request.jwt.claim.email', '', true);
      select (public.ea_room_state(null, 'ht')->>'is_host') || '/' || (public.ea_room_state(null, 'academy')->>'is_host') into v_t;
      select count(*) into v_n from public.ea_rooms;
      reset role;
      insert into verify_out(line) values (case when v_t = 'true/true' and v_n = 2 then 'OK ' else 'FAIL ' end || 'admin hosts both rooms and reads both rows · ' || v_t || ' · ' || v_n);
    exception when others then
      reset role;
      insert into verify_out(line) values ('FAIL admin checks raised ' || sqlstate || ' ' || sqlerrm);
    end;
  end if;

  -- 8. the hands column grant still holds (inherited from 0036)
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', v_claims, true), set_config('request.jwt.claim.sub', v_guest::text, true), set_config('request.jwt.claim.email', v_email, true);
    insert into public.ea_room_hands (room_id, user_id, kind, staged_at) values (v_ht, v_guest, 'question', now());
    reset role;
    insert into verify_out(line) values ('FAIL a hand with staged_at was accepted');
  exception when insufficient_privilege then
    reset role;
    insert into verify_out(line) values ('OK a hand cannot be inserted with staged_at (42501)');
  when others then
    reset role;
    insert into verify_out(line) values ('OK a hand with staged_at is refused (' || sqlstate || ')');
  end;
end $v$;

select line from verify_out order by n;
rollback;
