// tests/academy/migration-0059.test.mjs — run: node --test tests/academy/migration-0059.test.mjs
// 0059's contract as text: the names, grants and guards the class page, the founder tab and the public review
// strips rely on. The behaviour itself is proven in real Postgres by rls-0059.pglite.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../../supabase/migrations/0059_ai101_class_kit.sql', import.meta.url), 'utf8');
const has = (re, why) => assert.match(sql, re, why);
test('tables, with RLS on and no direct writes for signed-in users', () => {
  has(/create table if not exists public\.ea_class_pulse/i, 'pulse'); has(/create table if not exists public\.ea_reviews/i, 'reviews');
  has(/alter table public\.ea_class_pulse enable row level security/i, 'pulse rls'); has(/alter table public\.ea_reviews enable row level security/i, 'reviews rls');
  has(/revoke all on public\.ea_class_pulse from anon, authenticated/i, 'pulse revoke'); has(/revoke all on public\.ea_reviews from anon, authenticated/i, 'reviews revoke');
  has(/grant update \(status, approved_at\) on public\.ea_reviews to authenticated/i, 'only status columns are updatable');
  assert.doesNotMatch(sql, /grant insert on public\.ea_(class_pulse|reviews)/i, 'writes go through the definer functions');
});
test('guards: one answer per moment, one review per workshop, lengths capped', () => {
  has(/unique \(user_id, workshop_slug, kind\)/i, 'pulse unique'); has(/unique \(user_id, workshop_slug\)/i, 'review unique');
  has(/char_length\(btrim\(body\)\) between 10 and 1200/i, 'body cap'); has(/score between 1 and 5/i, 'score'); has(/stars between 1 and 5/i, 'stars');
});
test('functions are security definer with an empty search_path, granted narrowly', () => {
  for (const f of ['ea_holds_seat', 'ea_pulse_save', 'ea_review_display_name', 'ea_review_save', 'ea_reviews_public', 'ea_ai101_room_link'])
    has(new RegExp(`create or replace function public\\.${f}\\([\\s\\S]*?security definer set search_path = ''`, 'i'), f);
  has(/grant execute on function public\.ea_reviews_public\(text, int\) to anon, authenticated/i, 'public read');
  has(/grant execute on function public\.ea_ai101_room_link\(\) to authenticated/i, 'room link for signed-in only');
  assert.doesNotMatch(sql, /grant execute on function public\.ea_review_display_name/i, 'helper stays private');
});
test('an edit sends a review back to Nelson', () => { has(/approved_at = null, updated_at = now\(\),\s*status = case/i, 'edit resets approval'); });
test('ends on the ready line', () => { has(/select 'ai101 class kit ready' as status;\s*$/i, 'apply script keys on it'); });
// ---- final-review fixes (10/6) ----
test('every function is taken away from anon (Supabase grants new functions to anon by default); helpers from everyone', () => {
  for (const f of ['ea_pulse_save\\(text, text, int\\)', 'ea_review_save\\(text, int, text, text, text\\)', 'ea_reviews_public\\(text, int\\)', 'ea_ai101_room_link\\(\\)'])
    has(new RegExp(`revoke all on function public\\.${f} from public, anon;`, 'i'), f);
  for (const f of ['ea_holds_seat\\(text\\)', 'ea_workshop_open\\(text\\)', 'ea_review_display_name\\(text\\)'])
    has(new RegExp(`revoke all on function public\\.${f} from public, anon, authenticated;`, 'i'), f);
  assert.doesNotMatch(sql, /grant execute on function public\.ea_(holds_seat|workshop_open)/i, 'helpers stay private');
});
test('rate limits, a real workshop, a time-boxed room link, the new kinds, a sticky hide', () => {
  has(/ea_rate_check\('pulse:' \|\| auth\.uid\(\), 30, 3600\)/, 'pulse limit'); has(/ea_rate_check\('review:' \|\| auth\.uid\(\), 10, 3600\)/, 'review limit');
  has(/raise exception 'unknown workshop'/, 'unknown slug refused');
  has(/now\(\) between e\.starts_at - interval '3 hours' and coalesce\(e\.ends_at, e\.starts_at \+ interval '1 hour'\) \+ interval '30 minutes'/, 'room link window');
  has(/kind in \('before', 'after', 'useful', 'steered', 'chk_safe', 'chk_verify', 'chk_prompt'\)/, 'kinds');
  has(/when public\.ea_reviews\.status = 'hidden' then 'hidden' else 'pending'/, 'a hidden review stays hidden');
  has(/u\.email_confirmed_at is not null/, 'email match needs a confirmed email');
});
test('the 0004 rate limiter is closed to anon and members (it now keeps per-person buckets)', () => {
  has(/revoke all on function public\.ea_rate_check\(text, int, int\) from public, anon, authenticated;/i, 'rate check revoke');
});
