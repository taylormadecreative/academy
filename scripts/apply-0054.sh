#!/usr/bin/env bash
# Apply migration 0054 (HT room features: Files for room keys + the storage room prefix, ea_rooms.warmup_q /
# next_title / next_at, ea_room_state returns them). Run BEFORE the client that uses them goes out.
# Nelson runs it from the repo root:   ! bash scripts/apply-0054.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain. curl only. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0054_ht_room_features.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
jq -Rs '{query: .}' < "$MIG" > "$TMP/body.json"
echo "== apply supabase/migrations/0054_ht_room_features.sql → $REF"
code=$(curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json")
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "ht room features ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'ht room features ready'"; exit 1; }
echo "== check: columns, policies, and the state function"
jq -Rs '{query: .}' <<< "select (select count(*) from information_schema.columns where table_schema='public' and table_name='ea_rooms' and column_name in ('warmup_q','next_title','next_at')) as room_columns, (select count(*) from pg_policies where tablename='ea_opil_materials' and policyname in ('mat_room_read','mat_room_insert')) as material_policies, (select count(*) from pg_policies where tablename='objects' and policyname in ('opil files room read','opil files room write')) as storage_policies, (select public.ea_room_state(null, 'ht') ? 'next_at') as state_has_next, (select count(*) from information_schema.column_privileges where table_schema='public' and table_name='ea_rooms' and grantee='authenticated' and privilege_type='UPDATE' and column_name in ('warmup_q','next_title','next_at')) as update_grants, (select count(*) from pg_proc where proname='ea_room_reader') as reader_fn;" > "$TMP/chk.json"
curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/chk.json"; echo
echo "Expect room_columns 3, material_policies 2, storage_policies 2, state_has_next true, update_grants 3, reader_fn 1. 0054 applied."
echo "== the summary function (it now reads only the published replay's window — a standing room files every session under one key)"
supabase functions deploy ea-class-summary --no-verify-jwt --project-ref "$REF" && echo "ea-class-summary deployed." || echo "FUNCTION DEPLOY FAILED — run by hand: supabase functions deploy ea-class-summary --no-verify-jwt --project-ref $REF"
