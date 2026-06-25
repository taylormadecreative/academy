-- 0005_lead_data.sql
-- Capture rich lead data on every newsletter signup / ebook download so the list
-- can be exported as a custom audience for Meta / Google ads. One row per unique
-- email (ea_subscribers); these columns reflect the most recent capture.
-- RLS already restricts the table; only the service role (edge functions) and the
-- Supabase dashboard (where Nelson exports the CSV) can read/write it.

alter table ea_subscribers add column if not exists lead_magnet  text;
alter table ea_subscribers add column if not exists landing_page text;
alter table ea_subscribers add column if not exists referrer     text;
alter table ea_subscribers add column if not exists utm_source   text;
alter table ea_subscribers add column if not exists utm_medium   text;
alter table ea_subscribers add column if not exists utm_campaign text;
alter table ea_subscribers add column if not exists utm_content  text;
alter table ea_subscribers add column if not exists utm_term     text;
alter table ea_subscribers add column if not exists user_agent   text;

create index if not exists ea_subscribers_created_idx on ea_subscribers (created_at desc);
