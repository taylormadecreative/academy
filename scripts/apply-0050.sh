#!/usr/bin/env bash
# Apply migration 0050 (calendar feed + class reminders) and set the reminder secret in both places
# it must match: the Vault secret opil_remind_secret (pg_cron sends it) and the function secret
# REMIND_SECRET (ea-opil-remind checks it).
# Nelson runs it from the repo root:   ! bash scripts/apply-0050.sh
# Safe to re-run. Token: the Supabase CLI login in the macOS keychain. curl only. Prints no secrets.
#
# The secret lives in the macOS keychain under "OPIL remind secret" — made once (openssl), reused after.
# To rotate it: security delete-generic-password -s "OPIL remind secret"; re-run this script.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations/0050_class_calendar_reminders.sql"
API="https://api.supabase.com/v1/projects/$REF/database/query"
SECRETS_API="https://api.supabase.com/v1/projects/$REF/secrets"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
[ -f "$MIG" ] || { echo "missing $MIG"; exit 1; }
RAW=$(security find-generic-password -s "Supabase CLI" -w)
SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
[ -n "$SB_TOKEN" ] || { echo "no Supabase token in the keychain (run: supabase login)"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

run_sql() {   # run_sql <file with sql>  → prints HTTP code, leaves the answer in $TMP/out.json
  jq -Rs '{query: .}' < "$1" > "$TMP/body.json"
  curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json"
}

echo "== 1/4 the reminder secret (keychain: 'OPIL remind secret')"
if ! SECRET=$(security find-generic-password -s "OPIL remind secret" -w 2>/dev/null); then
  SECRET=$(openssl rand -hex 24)
  security add-generic-password -s "OPIL remind secret" -a "$REF" -w "$SECRET" -U
  echo "made a new secret and saved it to the keychain"
else
  echo "using the secret already in the keychain"
fi
[ -n "$SECRET" ] || { echo "the secret is empty — delete the keychain item and re-run"; exit 1; }

echo "== 2/4 apply supabase/migrations/0050_class_calendar_reminders.sql → $REF"
code=$(run_sql "$MIG")
echo "HTTP $code"; cat "$TMP/out.json"; echo
case "$code" in 2*) ;; *) echo "APPLY FAILED (HTTP $code)"; exit 1;; esac
jq -e '.[0].status == "calendar reminders ready"' "$TMP/out.json" >/dev/null || { echo "APPLY FAILED — the last statement did not return 'calendar reminders ready'"; exit 1; }

echo "== 3/4 store the secret in Vault as opil_remind_secret (pg_cron reads it on every run)"
# jq builds the SQL and the JSON body in one go (\u0027 is a single quote; one inside the value is doubled); nothing is echoed.
# create on the first run, update after.
jq -n --arg s "$SECRET" '{query: ("do $$ declare v_id uuid; begin select id into v_id from vault.secrets where name = \u0027opil_remind_secret\u0027; if v_id is null then perform vault.create_secret(\u0027" + ($s | gsub("\u0027"; "\u0027\u0027")) + "\u0027, \u0027opil_remind_secret\u0027, \u0027x-remind-secret for ea-opil-remind; equals the function secret REMIND_SECRET\u0027); else perform vault.update_secret(v_id, \u0027" + ($s | gsub("\u0027"; "\u0027\u0027")) + "\u0027); end if; end $$;")}' > "$TMP/body.json"
code=$(curl -sS -o "$TMP/out.json" -w '%{http_code}' -X POST "$API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/body.json")
rm -f "$TMP/body.json"
case "$code" in 2*) echo "vault secret saved";; *) echo "VAULT FAILED (HTTP $code)"; cat "$TMP/out.json"; echo; exit 1;; esac

echo "== 4/4 set the function secret REMIND_SECRET (ea-opil-remind checks it)"
jq -n --arg s "$SECRET" '[{name: "REMIND_SECRET", value: $s}]' > "$TMP/sec.json"
code=$(curl -sS -o "$TMP/sec-out.json" -w '%{http_code}' -X POST "$SECRETS_API" -H "Authorization: Bearer $SB_TOKEN" -H "Content-Type: application/json" -d @"$TMP/sec.json")
rm -f "$TMP/sec.json"
case "$code" in 2*) echo "function secret saved";; *) echo "SECRET FAILED (HTTP $code)"; cat "$TMP/sec-out.json"; echo; exit 1;; esac
unset SECRET

echo "== check: the cron job and the reminder log"
cat > "$TMP/chk.sql" <<'SQL'
select jobname, schedule, active from cron.job where jobname = 'ea-opil-remind';
SQL
run_sql "$TMP/chk.sql" >/dev/null; cat "$TMP/out.json"; echo
cat > "$TMP/chk2.sql" <<'SQL'
select public.ea_opil_remind_status() as reminders, (select count(*) from public.ea_class_reminders) as already_sent, (select count(*) from vault.secrets where name = 'opil_remind_secret') as vault_rows;
SQL
run_sql "$TMP/chk2.sql" >/dev/null; cat "$TMP/out.json"; echo

cat <<'NEXT'
0050 applied. Two functions still need to go out (the cron knock answers 404 until the second one is live):
  supabase functions deploy ea-opil-calendar --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
  supabase functions deploy ea-opil-remind   --no-verify-jwt --project-ref pgqdmnmessbbzyszjfvr
Then open https://pgqdmnmessbbzyszjfvr.functions.supabase.co/ea-opil-calendar — you should see the schedule as text.
The check above should read "Reminders go out half an hour before every class." and vault_rows = 1. If it says
"the secret is not set yet", step 3 did not land — run the script again and read its output.
NEXT
