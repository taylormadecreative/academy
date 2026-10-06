// tests/academy/rls-0059.pglite.mjs — 0059 in real Postgres (PGlite), every role.
// Setup once:  mkdir -p "$TMPDIR/pg0059" && (cd "$TMPDIR/pg0059" && npm i @electric-sql/pglite)
// Run:         PGLITE="$TMPDIR/pg0059/node_modules/@electric-sql/pglite/dist/index.js" node --test tests/academy/rls-0059.pglite.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { PGlite } = await import(process.env.PGLITE || '@electric-sql/pglite');
const MIG = fs.readFileSync(new URL('../../supabase/migrations/0059_ai101_class_kit.sql', import.meta.url), 'utf8');
const RATE = fs.readFileSync(new URL('../../supabase/migrations/0004_rate_limit.sql', import.meta.url), 'utf8'); // ea_rate_check
const db = new PGlite();
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', N = '00000000-0000-0000-0000-00000000000c';
const C = '00000000-0000-0000-0000-00000000000d', D = '00000000-0000-0000-0000-00000000000e'; // C: email never confirmed; D: rate limits
const EV = '11111111-1111-1111-1111-111111111111';
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    -- what Supabase does: every new table and function in public is granted to anon and authenticated by default,
    -- so a migration that only revokes from PUBLIC still leaves anon able to call it. The tests must see that.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    create schema auth; grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.profiles (id uuid primary key, role text);
    create function public.ea_is_admin() returns boolean language sql security definer stable set search_path = public as
      $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
    grant execute on function public.ea_is_admin() to anon, authenticated;
    create table public.ea_events (id uuid primary key, workshop_slug text, starts_at timestamptz not null default now(), ends_at timestamptz,
      status text not null default 'on_sale');
    create table public.ea_orders (id uuid primary key default gen_random_uuid(), event_id uuid references public.ea_events(id), email text not null, status text not null, user_id uuid);
    create table public.ea_rooms (id uuid primary key default gen_random_uuid(), slug text, link_key text);
    insert into auth.users values ('${A}','a@x.com',now()), ('${B}','b@x.com',now()), ('${N}','n@x.com',now()), ('${C}','c@x.com',null), ('${D}','d@x.com',now());
    insert into public.profiles values ('${N}','admin');
    insert into public.ea_events (id, workshop_slug, starts_at) values ('${EV}','ai101', now() - interval '10 minutes'); -- class just started
    insert into public.ea_events (id, workshop_slug, status) values ('22222222-2222-2222-2222-222222222222','drafty','draft');
    insert into public.ea_orders (event_id, email, status, user_id) values ('${EV}','A@X.com','paid',null), ('${EV}','b@x.com','refunded','${B}'),
      ('${EV}','c@x.com','paid',null);
    insert into public.ea_rooms (slug, link_key) values ('academy','KEY123');`);
  await db.exec(RATE);
  await db.exec(MIG);
});
const setEvent = (starts, status = 'on_sale') => db.exec(`update public.ea_events set starts_at = now() + interval '${starts}', ends_at = null, status = '${status}' where id = '${EV}'`);
async function as(uid, sql, params = []) {
  await db.exec(uid ? `set t.uid = '${uid}'; set role authenticated;` : `set t.uid = ''; set role anon;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
const one = async (uid, sql, params) => (await as(uid, sql, params)).rows[0];

test('anon can neither save a score nor get a room link', async () => {
  await assert.rejects(as(null, `select public.ea_pulse_save('ai101','before',3)`), /permission denied/);
  await assert.rejects(as(null, `select public.ea_ai101_room_link()`), /permission denied/);
});
test('a score saves once per moment and can be changed; nobody reads anyone else\'s', async () => {
  await as(A, `select public.ea_pulse_save('ai101','before',2)`);
  await as(A, `select public.ea_pulse_save('ai101','before',4)`);
  assert.deepEqual((await as(A, `select kind, score from public.ea_class_pulse`)).rows, [{ kind: 'before', score: 4 }]);
  assert.equal((await one(B, `select count(*)::int n from public.ea_class_pulse`)).n, 0);
  assert.equal((await one(N, `select count(*)::int n from public.ea_class_pulse`)).n, 1, 'the founder sees all');
  await assert.rejects(as(A, `select public.ea_pulse_save('ai101','before',9)`), /check/);
  await assert.rejects(as(A, `select public.ea_pulse_save('ai101','during',3)`), /check/);
  await assert.rejects(as(A, `insert into public.ea_class_pulse (user_id, workshop_slug, kind, score) values ('${A}','ai101','after',5)`), /permission denied/);
});
test('reviews: verified by seat (email match, any case); a refunded seat is not; pending until approved', async () => {
  const ra = await one(A, `select public.ea_review_save('ai101', 5, 'I finally get how to ask it for things.', 'Retired teacher, Dallas', 'nelson elliott taylor') j`);
  assert.deepEqual(ra.j, { verified: true, status: 'pending' });
  const rb = await one(B, `select public.ea_review_save('ai101', 4, 'Clear and simple, thank you.', null, 'Bea')  j`);
  assert.equal(rb.j.verified, false);
  assert.equal((await one(A, `select display_name from public.ea_reviews`)).display_name, 'Nelson T.');
  assert.equal((await one(null, `select public.ea_reviews_public('ai101') j`)).j.count, 0, 'nothing public before approval');
});
test('only the founder approves; the public sees display fields only; avg needs 3', async () => {
  const r = await as(B, `update public.ea_reviews set status = 'approved'`);
  assert.equal(r.affectedRows || 0, 0, 'a member cannot approve');
  await as(N, `update public.ea_reviews set status = 'approved', approved_at = now() where user_id = $1`, [A]);
  const pub = (await one(null, `select public.ea_reviews_public('ai101') j`)).j;
  assert.equal(pub.count, 1); assert.equal(pub.avg, null);
  assert.deepEqual(Object.keys(pub.items[0]).sort(), ['body', 'created_at', 'display_name', 'stars', 'verified', 'who_line']);
  assert.equal(pub.items[0].display_name, 'Nelson T.');
});
test('an edit goes back to pending', async () => {
  await as(A, `select public.ea_review_save('ai101', 4, 'Edited: still great, a little fast.', null, 'Nelson Taylor')`);
  assert.equal((await one(N, `select status from public.ea_reviews where user_id = $1`, [A])).status, 'pending');
  assert.equal((await one(null, `select public.ea_reviews_public('ai101') j`)).j.count, 0);
});
test('length and rating guards', async () => {
  await assert.rejects(as(A, `select public.ea_review_save('ai101', 5, 'short', null, 'Al')`), /check/);
  await assert.rejects(as(A, `select public.ea_review_save('ai101', 5, repeat('x', 5000), null, 'Al')`), /check/);
  await assert.rejects(as(A, `select public.ea_review_save('ai101', 6, 'A perfectly fine review body.', null, 'Al')`), /check/);
  await assert.rejects(as(A, `select public.ea_review_save('ai101', 5, 'A perfectly fine review body.', repeat('w', 81), 'Al')`), /check/);
});
test('room link: seat holder by email yes, no seat no, founder yes', async () => {
  assert.equal((await one(A, `select public.ea_ai101_room_link() l`)).l, '/room/?k=KEY123');
  assert.equal((await one(B, `select public.ea_ai101_room_link() l`)).l, null);
  assert.equal((await one(N, `select public.ea_ai101_room_link() l`)).l, '/room/?k=KEY123');
});

// ---- final-review fixes (10/6) ----
test('anon can run none of 0059 except the public review read; the helpers stay private to everyone', async () => {
  for (const f of [`public.ea_pulse_save('ai101','before',3)`, `public.ea_review_save('ai101',5,'A perfectly fine review body.',null,'Al')`,
    `public.ea_ai101_room_link()`, `public.ea_holds_seat('ai101')`, `public.ea_review_display_name('x')`])
    await assert.rejects(as(null, `select ${f}`), /permission denied/, f);
  await assert.rejects(as(A, `select public.ea_holds_seat('ai101')`), /permission denied/);
  await assert.rejects(as(A, `select public.ea_review_display_name('x')`), /permission denied/);
  assert.equal((await one(null, `select public.ea_reviews_public('ai101') j`)).j.count >= 0, true, 'the public read still works');
});
test('room link: only from 3 hours before to 30 minutes after the class, never for a canceled date; the founder any time', async () => {
  const link = async (u) => (await one(u, `select public.ea_ai101_room_link() l`)).l;
  await setEvent('5 hours');
  assert.equal(await link(A), null, 'too early'); assert.equal(await link(N), '/room/?k=KEY123', 'the founder rehearses any time');
  await setEvent('2 hours');
  assert.equal(await link(A), '/room/?k=KEY123', 'the evening of');
  await setEvent('-2 hours');
  assert.equal(await link(A), null, 'class over');
  await setEvent('1 hour', 'canceled');
  assert.equal(await link(A), null, 'canceled');
  await setEvent('-10 minutes');
});
test('a seat matched by email needs a confirmed email', async () => {
  assert.equal((await one(C, `select public.ea_ai101_room_link() l`)).l, null);
  assert.equal((await one(C, `select public.ea_review_save('ai101', 5, 'Signed up with an email I never confirmed.', null, 'Cee') j`)).j.verified, false);
});
test('scores and reviews only for a real, published workshop', async () => {
  await assert.rejects(as(A, `select public.ea_pulse_save('nope','before',3)`), /unknown workshop/);
  await assert.rejects(as(A, `select public.ea_review_save('nope', 5, 'A perfectly fine review body.', null, 'Al')`), /unknown workshop/);
  await assert.rejects(as(A, `select public.ea_pulse_save('drafty','before',3)`), /unknown workshop/);
});
test('rate limits: 30 taps and 10 review saves an hour per person', async () => {
  for (let i = 0; i < 30; i++) await as(D, `select public.ea_pulse_save('ai101','after',${(i % 5) + 1})`);
  await assert.rejects(as(D, `select public.ea_pulse_save('ai101','after',3)`), /slow down/);
  for (let i = 0; i < 10; i++) await as(D, `select public.ea_review_save('ai101', 4, 'Edit number ${i}, still a fine review.', null, 'Dee')`);
  await assert.rejects(as(D, `select public.ea_review_save('ai101', 4, 'One edit too many in an hour.', null, 'Dee')`), /slow down/);
});
test('verified means the person held a seat AND the class has started', async () => {
  await setEvent('2 days');
  assert.equal((await one(A, `select public.ea_review_save('ai101', 5, 'Reviewing before the class even happened.', null, 'Ann') j`)).j.verified, false);
  await setEvent('-10 minutes');
  assert.equal((await one(A, `select public.ea_review_save('ai101', 5, 'Reviewing after the class, for real.', null, 'Ann') j`)).j.verified, true);
});
test('a hidden review stays hidden when its author edits it', async () => {
  await as(N, `update public.ea_reviews set status = 'hidden', approved_at = null where user_id = $1`, [A]);
  const r = await one(A, `select public.ea_review_save('ai101', 1, 'Trying to get my hidden review back up.', null, 'Ann') j`);
  assert.equal(r.j.status, 'hidden');
  assert.equal((await one(N, `select status from public.ea_reviews where user_id = $1`, [A])).status, 'hidden');
});
test('display names: odd spaces, invisible and control characters never make an odd name (same as the class page)', async () => {
  const name = async (x) => (await db.query(`select public.ea_review_display_name($1) n`, [x])).rows[0].n;
  assert.equal(await name('  ann​  lee\n'), 'Ann L.');
  assert.equal(await name('​⁠\u0007 '), 'Academy member');
  assert.equal(await name('ann\tmarie　lee'), 'Ann L.');
  assert.equal(await name('😀bob smith'), '😀bob S.');
});
test('practice taps and the 3 questions save as kinds; a question keeps its FIRST answer', async () => {
  for (const k of ['useful', 'steered', 'chk_safe', 'chk_verify', 'chk_prompt']) await as(B, `select public.ea_pulse_save('ai101','${k}',1)`);
  await as(B, `select public.ea_pulse_save('ai101','chk_safe',2)`);
  await as(B, `select public.ea_pulse_save('ai101','useful',3)`);
  const rows = Object.fromEntries((await as(B, `select kind, score from public.ea_class_pulse`)).rows.map((r) => [r.kind, r.score]));
  assert.equal(rows.chk_safe, 1, 'the first answer counts'); assert.equal(rows.useful, 3, 'a tap can change');
});
test('nobody but the service role and 0059 itself can touch the rate limiter (else anyone could lock a person out)', async () => {
  await assert.rejects(as(null, `select public.ea_rate_check('review:${A}', 10, 3600)`), /permission denied/);
  await assert.rejects(as(A, `select public.ea_rate_check('review:${B}', 10, 3600)`), /permission denied/);
  await as(A, `select public.ea_pulse_save('ai101','useful',2)`); // still works through the definer function
});
