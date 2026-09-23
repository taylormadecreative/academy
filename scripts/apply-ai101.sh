#!/usr/bin/env bash
# AI 101 (free, Sat Oct 3, 7 PM CT) + Build Your First AI Agent moved to Sat Oct 17, 7–9 PM CT.
# Nelson runs it from Claude Code:   ! bash ~/Downloads/ai101-apply.sh
# (that copy just runs this file from the ~/tma-ai101 worktree, branch ai101)
#
#   1. migration 0056 — the reminder log + the pg_cron knock (reuses the OPIL reminder secret)
#   2. scripts/ai101-dates.sql — moves the agent date + its tiers, creates the AI 101 date + free seat
#   3. deploys the four functions that changed (ticket email, free sign-up, reminders)
#   4. puts the cheat sheet PDF at /ai101/cheat-sheet.pdf if it is in ~/Downloads
# Then YOU push:  git -C ~/tma-ai101 push origin ai101:main
# Safe to re-run until the first agent seat sells. Token: the Supabase CLI login in the keychain. Prints no secrets.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="https://api.supabase.com/v1/projects/$REF/database/query"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

run_sql() {   # run_sql <file>  → prints HTTP code, answer in $TMP/out.json
  jq -Rs '{query: .}' < "$1" > "$TMP/body.json"
  curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json"
}

echo "== 1/4 migration 0056 (event reminders)"
code=$(run_sql "$ROOT/supabase/migrations/0056_event_reminders.sql"); echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "0056 FAILED — stopping"; exit 1;; esac
jq -e '.[0].status == "event reminders ready"' "$TMP/out.json" >/dev/null || { echo "0056 FAILED — stopping"; exit 1; }

# the reminders reuse the OPIL reminder secret (scripts/apply-0050.sh). Without it they never go out.
cat > "$TMP/v.sql" <<'SQL'
select count(*) as n from vault.secrets where name = 'opil_remind_secret';
SQL
run_sql "$TMP/v.sql" >/dev/null
if [ "$(jq -r '.[0].n' "$TMP/out.json" 2>/dev/null)" = "1" ]; then echo "  reminder secret is set"; else
  echo "  ⚠ the reminder secret is NOT set — reminders will not send until you run: bash ~/tma-ai101/scripts/apply-0050.sh"; fi

echo "== 2/4 the dates: agent → Sat Oct 17, AI 101 on Sat Oct 3"
code=$(run_sql "$ROOT/scripts/ai101-dates.sql"); echo "HTTP $code"
case "$code" in 2*) jq -r '.[] | "  \(.title) — \(.starts) — \(.status)\n    \(.tiers)\n    room link set: \(.has_room_link)"' "$TMP/out.json";;
  *) cat "$TMP/out.json"; echo; echo "DATES FAILED — stopping (nothing after this ran)"; exit 1;; esac

echo "== 3/4 functions"
cd "$ROOT"
for f in ea-ticket-checkout ea-stripe-webhook ea-import-tickets ea-event-remind; do
  supabase functions deploy "$f" --no-verify-jwt --project-ref "$REF" >/dev/null 2>"$TMP/dep.err" \
    && echo "  $f deployed" \
    || { echo "  $f FAILED:"; tail -5 "$TMP/dep.err"; echo "  run by hand: supabase functions deploy $f --no-verify-jwt --project-ref $REF"; }
done
# the reminder knock should now answer 401 (it has no secret from here) — 404 means ea-event-remind is not live
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$REF.functions.supabase.co/ea-event-remind")
echo "  ea-event-remind answers HTTP $code (401 = live and locked, which is right)"

echo "== 4/4 the cheat sheet"
PDF="$HOME/Downloads/ai101-cheat-sheet.pdf"
if [ -f "$PDF" ]; then
  cp "$PDF" "$ROOT/ai101/cheat-sheet.pdf"
  git -C "$ROOT" add ai101/cheat-sheet.pdf
  git -C "$ROOT" commit -q -m "feat(ai101): the prompt cheat sheet at /ai101/cheat-sheet.pdf" && echo "  committed ai101/cheat-sheet.pdf" || echo "  cheat sheet unchanged"
else
  echo "  NOT FOUND: $PDF — the sign-up email links to /ai101/cheat-sheet.pdf, which is a 404 until it is added."
fi

cat <<'NEXT'

Done. Last step, publish the pages:
  git -C ~/tma-ai101 push origin ai101:main
Then open https://taylormadeacademy.com/ai101/ and https://taylormadeacademy.com/agent/ (bare URLs, no ?cb=).
NEXT
