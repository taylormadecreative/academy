#!/usr/bin/env bash
# Apply migration 0052 (profile cards in People: ea_profiles.hide_card + the ea_opil_roster_cards() RPC).
# Run this BEFORE js/rtk-roster.js goes out — the plugin reads both, and without them every card
# says it could not load. Nelson runs it from the repo root:   ! bash scripts/apply-0052.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain. curl only. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0052_roster_cards.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
jq -Rs '{query: .}' < "$MIG" > "$TMP/body.json"
echo "== apply supabase/migrations/0052_roster_cards.sql → $REF"
code=$(curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json")
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "roster cards ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'roster cards ready'"; exit 1; }
echo "== check: the column, the function, and who may call it"
jq -Rs '{query: .}' <<< "select (select count(*) from information_schema.columns where table_schema='public' and table_name='ea_profiles' and column_name='hide_card') as hide_card_column, (select count(*) from pg_proc where proname='ea_opil_roster_cards') as rpc, (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where proname='ea_opil_roster_cards') as anon_can_call;" > "$TMP/chk.json"
curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/chk.json"; echo
echo "Expect hide_card_column 1, rpc 1, anon_can_call false. 0052 applied: cards are ready; now the roster plugin can ship."
