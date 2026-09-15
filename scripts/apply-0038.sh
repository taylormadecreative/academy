#!/usr/bin/env bash
# Apply migration 0038 (the HT room's open door: anyone signed in may enter while the class runs).
# Nelson runs it from the repo root:   ! bash scripts/apply-0038.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain. curl only. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0038_ht_open_door.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
jq -Rs '{query: .}' < "$MIG" > "$TMP/body.json"
echo "== apply supabase/migrations/0038_ht_open_door.sql → $REF"
code=$(curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json")
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "ht open door ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'ht open door ready'"; exit 1; }
echo "== check: ht row open_door"
jq -Rs '{query: .}' <<< "select slug, open_door from public.ea_rooms order by slug;" > "$TMP/chk.json"
curl -sS -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/chk.json"; echo
echo "0038 applied: the HT room admits anyone signed in while a class runs; the Academy room is unchanged."
