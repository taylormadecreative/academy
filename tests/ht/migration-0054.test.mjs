// tests/ht/migration-0054.test.mjs — run: node --test tests/ht/migration-0054.test.mjs
// The migration's contract as text: the statements the client code (Files in rooms, the warm-up question,
// Next session, the replay page) relies on must be there. The only database is prod; Nelson applies it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../../supabase/migrations/0054_ht_room_features.sql', import.meta.url), 'utf8');
const has = (re, why) => assert.match(sql, re, why);
test('0054 adds the three room columns', () => {
  has(/alter table public\.ea_rooms add column if not exists warmup_q text/i, 'warmup_q');
  has(/alter table public\.ea_rooms add column if not exists next_title text/i, 'next_title');
  has(/alter table public\.ea_rooms add column if not exists next_at timestamptz/i, 'next_at');
});
test('0054 returns them from ea_room_state', () => {
  has(/create or replace function public\.ea_room_state\(p_key text default null, p_slug text default 'academy'\)/, 'same signature as 0038');
  has(/'warmup_q', r\.warmup_q/, 'warmup_q in the json');
  has(/'next_title', r\.next_title/, 'next_title in the json');
  has(/'next_at', r\.next_at/, 'next_at in the json');
  has(/grant execute on function public\.ea_room_state\(text, text\) to anon, authenticated/, 'anon may still call it');
});
test('0054 opens materials to room keys through the class functions', () => {
  has(/create policy mat_room_read on public\.ea_opil_materials for select to authenticated\s+using \(room_key like 'room:%' and public\.ea_class_can\(room_key\)\)/, 'read');
  has(/create policy mat_room_insert on public\.ea_opil_materials for insert to authenticated/, 'insert');
  has(/public\.ea_class_is_host\(room_key\)/, 'hosts write');
  has(/create policy mat_read on public\.ea_opil_materials[\s\S]*?room_key not like 'room:%'/, 'the cohort read no longer covers room rows');
});
test('0054 scopes storage by the room prefix', () => {
  has(/create policy "opil files room read" on storage\.objects for select to authenticated/, 'room read');
  has(/\(storage\.foldername\(name\)\)\[3\] = 'room'/, 'the room folder');
  has(/public\.ea_class_can\('room:' \|\| \(storage\.foldername\(name\)\)\[4\]\)/, 'read = in the room');
  has(/create policy "opil files room write" on storage\.objects for insert to authenticated/, 'room write');
  has(/public\.ea_class_is_host\('room:' \|\| \(storage\.foldername\(name\)\)\[4\]\)/, 'write = a host');
});
test('0054 ends with its status row', () => { has(/select 'ht room features ready' as status;\s*$/, 'status'); });
