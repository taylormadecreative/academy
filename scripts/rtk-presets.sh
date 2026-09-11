#!/usr/bin/env bash
# Create or update the five RealtimeKit presets from the committed JSON bodies.
# Spec: docs/superpowers/specs/2026-09-10-realtimekit-live-rooms-design.md §4.1, §11.4
#
# Reads three variables from the shell (never committed):
#   CF_ACCOUNT_ID CF_RTK_APP_ID CF_RTK_API_TOKEN   (the Realtime Admin token)
# Writes scripts/rtk-presets.ids (untracked) mapping name -> preset id, so a
# re-run PATCHes by id instead of creating duplicates.
set -euo pipefail
: "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID}" "${CF_RTK_APP_ID:?set CF_RTK_APP_ID}" "${CF_RTK_API_TOKEN:?set CF_RTK_API_TOKEN}"

RTK="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/realtime/kit/$CF_RTK_APP_ID"
H=(-H "Authorization: Bearer $CF_RTK_API_TOKEN" -H "Content-Type: application/json")
DIR="$(cd "$(dirname "$0")" && pwd)"
IDS="$DIR/rtk-presets.ids"
touch "$IDS"

for f in "$DIR"/rtk-presets/*.json; do
  name="$(basename "$f" .json)"
  id="$(grep "^$name=" "$IDS" 2>/dev/null | tail -1 | cut -d= -f2 || true)"
  if [ -n "$id" ]; then
    echo "PATCH $name ($id)"
    curl -sS -X PATCH "$RTK/presets/$id" "${H[@]}" -d @"$f" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  ok" if d.get("success") else "  FAILED "+json.dumps(d.get("errors"))[:300])'
  else
    echo "POST  $name"
    out="$(curl -sS -X POST "$RTK/presets" "${H[@]}" -d @"$f")"
    newid="$(printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(((d.get("data") or d.get("result")) or {}).get("id","") if d.get("success") else "")')"
    if [ -n "$newid" ]; then
      echo "$name=$newid" >> "$IDS"; echo "  ok $newid"
    else
      printf '  FAILED %s\n' "$(printf '%s' "$out" | cut -c1-300)"
    fi
  fi
done
echo "ids: $IDS"
