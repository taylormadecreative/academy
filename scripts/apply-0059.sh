#!/usr/bin/env bash
# Apply migration 0059 (AI 101 class kit: ea_class_pulse, ea_reviews, the review/pulse/room-link functions).
# Run BEFORE the class page goes live. Nelson runs it from the repo root:   ! bash scripts/apply-0059.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain, handed to curl as a header file so it never
# shows on a command line. curl only. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0059_ai101_class_kit.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
q() { curl -sS -X POST "$API" -H @<(printf 'Authorization: Bearer %s\n' "$SB_TOKEN") -H "Content-Type: application/json" "$@"; }
echo "== check: 0059 calls ea_rate_check (migration 0004)"
jq -Rs '{query: .}' <<< "select to_regprocedure('public.ea_rate_check(text,integer,integer)') is not null as rate_check;" > "$TMP/pre.json"
q -d @"$TMP/pre.json" -o "$TMP/pre.out" || { echo "could not reach Supabase"; exit 1; }
jq -e '.[0].rate_check == true' "$TMP/pre.out" >/dev/null || { echo "STOP: public.ea_rate_check is missing. Apply supabase/migrations/0004_rate_limit.sql first."; cat "$TMP/pre.out"; exit 1; }
jq -Rs '{query: .}' < "$MIG" > "$TMP/body.json"
echo "== apply supabase/migrations/0059_ai101_class_kit.sql → $REF"
code=$(q -o "$TMP/out.json" -w '%{http_code}' -d @"$TMP/body.json") || { echo "could not reach Supabase"; exit 1; }
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "ai101 class kit ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'ai101 class kit ready'"; exit 1; }
echo "== check"
jq -Rs '{query: .}' <<< "select (select count(*) from information_schema.tables where table_schema='public' and table_name in ('ea_class_pulse','ea_reviews')) as tables, (select count(*) from pg_proc where proname in ('ea_holds_seat','ea_workshop_open','ea_pulse_save','ea_review_display_name','ea_review_save','ea_reviews_public','ea_ai101_room_link')) as functions, (select count(*) from pg_policies where tablename in ('ea_class_pulse','ea_reviews')) as policies, has_function_privilege('anon','public.ea_reviews_public(text,int)','execute') as anon_can_read_reviews, has_function_privilege('anon','public.ea_ai101_room_link()','execute') as anon_room_link, has_function_privilege('anon','public.ea_pulse_save(text,text,int)','execute') as anon_pulse_save, has_function_privilege('authenticated','public.ea_holds_seat(text)','execute') as members_holds_seat, has_function_privilege('anon','public.ea_rate_check(text,int,int)','execute') as anon_rate_check, (select public.ea_reviews_public('ai101')->>'count') as approved_ai101;" > "$TMP/chk.json"
q -d @"$TMP/chk.json"; echo
echo "Expect tables 2, functions 7, policies 3, anon_can_read_reviews true, anon_room_link false, anon_pulse_save false, members_holds_seat false, anon_rate_check false, approved_ai101 0. 0059 applied."
