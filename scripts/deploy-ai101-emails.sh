#!/usr/bin/env bash
# Deploy the four functions that send AI 101 email (they share _shared/tickets.ts): the confirmation and both
# reminders link the class page, promise the cheat sheet in class, and warn that Claude texts a sign-up code.
# MUST be live before Thu Oct 8, 7 PM CT (the day-before reminder). Run AFTER the class page is live.
# Nelson:   ! bash scripts/deploy-ai101-emails.sh
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
cd "$(dirname "$0")/.."
ERR="$(mktemp)"; trap 'rm -f "$ERR"' EXIT
code=$(curl -s -o /dev/null -w '%{http_code}' https://taylormadeacademy.com/ai101/class/) || code="000"
[ "$code" = "000" ] && { echo "could not reach taylormadeacademy.com — check the connection and run this again"; exit 1; }
[ "$code" = "200" ] || { echo "the class page is not live yet (HTTP $code) — push the site first"; exit 1; }
for f in ea-ticket-checkout ea-stripe-webhook ea-import-tickets ea-event-remind; do
  supabase functions deploy "$f" --no-verify-jwt --project-ref "$REF" >/dev/null 2>"$ERR" \
    && echo "  $f deployed" || { echo "  $f FAILED:"; tail -5 "$ERR"; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$REF.functions.supabase.co/ea-event-remind") || code="000"
echo "  ea-event-remind answers HTTP $code (401 = live and locked, which is right)"
