#!/usr/bin/env bash
# Apply migration 0037 (the HT class room: many rooms, hosts by email) to the ONE database and
# prove it, keeping nothing from the proof. Runs AFTER apply-0036.sh. Nelson runs it from the repo root:
#
#     ! bash scripts/apply-0037.sh                 # apply, then verify
#     ! bash scripts/apply-0037.sh --verify-only   # verify again without re-applying
#
# The migration is safe to re-run. The verify runs inside `begin; … rollback;` — every row it
# writes (a throwaway guest account, a members row, a hand, the live flag) is thrown away.
# Token: the Supabase CLI login in the macOS keychain (memory: supabase-mgmt-api-token-keychain).
# Transport: curl only — python urllib is Cloudflare-blocked. Nothing here prints the token.
set -euo pipefail

REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0037_ht_room.sql"
VERIFY="$ROOT/scripts/verify-0037.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
MODE="${1:-apply}"
# only two spellings exist; anything else (a typo like --verify) must not silently APPLY
case "$MODE" in apply|--verify-only) ;; *) echo "usage: bash scripts/apply-0037.sh [--verify-only]"; exit 1;; esac

command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
[ -f "$VERIFY" ] || { echo "missing $VERIFY"; exit 1; }

RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# post <sql file>: POSTs the file as {"query": "<contents>"}; prints the HTTP status; body in $TMP/out.json
post() {
  jq -Rs '{query: .}' < "$1" > "$TMP/body.json"
  curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" \
    -d @"$TMP/body.json"
}

if [ "$MODE" != "--verify-only" ]; then
  echo "== apply supabase/migrations/0037_ht_room.sql → $REF"
  code="$(post "$MIG")"
  echo "HTTP $code"
  cat "$TMP/out.json"; echo
  case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code) — nothing below ran"; exit 1;; esac
  jq -e '.[0].status == "ht room ready"' "$TMP/out.json" >/dev/null \
    || { echo "APPLY FAILED — the last statement did not return 'ht room ready'"; exit 1; }
  echo "applied."
fi

echo "== verify (begin … rollback — nothing is kept)"
code="$(post "$VERIFY")"
echo "HTTP $code"
case "$code" in 2*) ;; *) cat "$TMP/out.json"; echo; echo "VERIFY FAILED (HTTP $code)"; exit 1;; esac
jq -e 'type == "array"' "$TMP/out.json" >/dev/null \
  || { cat "$TMP/out.json"; echo; echo "VERIFY FAILED — expected an array of {line} rows"; exit 1; }
jq -r '.[].line' "$TMP/out.json"
ok="$(jq -r '[.[].line | select(startswith("OK "))] | length' "$TMP/out.json")"
fail="$(jq -r '[.[].line | select(startswith("FAIL "))] | length' "$TMP/out.json")"
skip="$(jq -r '[.[].line | select(startswith("SKIP "))] | length' "$TMP/out.json")"
echo "== $ok OK · $fail FAIL · $skip SKIP"
# The gate is the whole tally, not "no FAIL": an empty result, rows without .line, or the SKIP path (no
# profiles.role = 'admin' row → the admin checks never ran) would otherwise read as verified.
# 29 = 23 case-inserts + 6 exception-block checks (the admin block's OK is one of the 23); recount when verify-0037.sql changes
EXPECT_OK=29
if [ "$fail" != "0" ] || [ "$skip" != "0" ] || [ "$ok" -lt "$EXPECT_OK" ]; then
  echo "VERIFY FAILED — expected $EXPECT_OK OK · 0 FAIL · 0 SKIP (got $ok/$fail/$skip; a SKIP means the admin checks never ran). The migration is applied; fix and re-run with --verify-only"; exit 1
fi
echo "0037 is on prod and verified. Nothing from the verify was kept."
