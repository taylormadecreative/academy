#!/usr/bin/env bash
# AI 101 results: confidence before vs after (everyone who answered, the people who answered both, and the seat
# holders among them), who went up, the practice taps, the 3 questions graded, and the reviews.
# Nelson runs:   ! bash scripts/ai101-results.sh      Read-only. Numbers are exactly what Friday reported.
# Report them as self-reported, one session, with n. The right answers below match CHECK_ITEMS in ai101_course.py.
set -euo pipefail
REF=pgqdmnmessbbzyszjfvr
API="https://api.supabase.com/v1/projects/$REF/database/query"
RAW=$(security find-generic-password -s "Supabase CLI" -w); SB_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d)
q() { jq -n --arg q "$1" '{query: $q}' | curl -sS -X POST "$API" -H @<(printf 'Authorization: Bearer %s\n' "$SB_TOKEN") -H "Content-Type: application/json" -d @- | jq .; }
echo "== confidence (1-5), before vs after"
q "with p as (select * from public.ea_class_pulse where workshop_slug='ai101'), seat as (select distinct coalesce(o.user_id, u.id) uid from public.ea_orders o join public.ea_events e on e.id = o.event_id left join auth.users u on lower(u.email) = lower(o.email) and u.email_confirmed_at is not null where e.workshop_slug = 'ai101' and o.status = 'paid'), b as (select user_id, score from p where kind='before'), a as (select user_id, score from p where kind='after'), pr as (select b.user_id, b.score bs, a.score af from b join a using (user_id)), prs as (select * from pr where user_id in (select uid from seat)) select (select count(*) from b) before_n, (select round(avg(score),2) from b) before_avg, (select count(*) from a) after_n, (select round(avg(score),2) from a) after_avg, (select count(*) from pr) both_n, (select round(avg(bs),2) from pr) both_before_avg, (select round(avg(af),2) from pr) both_after_avg, (select count(*) from pr where af > bs) went_up, (select count(*) from pr where af >= 4) ended_4_or_5, (select count(*) from prs) seat_both_n, (select round(avg(bs),2) from prs) seat_before_avg, (select round(avg(af),2) from prs) seat_after_avg;"
echo "== practice taps (useful: 1 not yet, 2 almost, 3 yes · steered: 1 not yet, 2 yes) and the 3 questions (first answer only)"
q "select kind, count(*) n, count(*) filter (where (kind='chk_safe' and score=2) or (kind='chk_verify' and score=3) or (kind='chk_prompt' and score=2)) n_right, jsonb_object_agg(score, c) by_answer from (select kind, score, count(*) over (partition by kind, score) c from public.ea_class_pulse where workshop_slug='ai101' and kind not in ('before','after')) t group by kind order by kind;"
echo "== reviews"
q "select (select count(*) from public.ea_reviews where workshop_slug='ai101') reviews, (select count(*) from public.ea_reviews where workshop_slug='ai101' and status='pending') pending, (select count(*) from public.ea_reviews where workshop_slug='ai101' and status='approved') approved, (select count(*) from public.ea_reviews where workshop_slug='ai101' and verified) verified, (select round(avg(stars),2) from public.ea_reviews where workshop_slug='ai101') avg_stars_all;"
