-- OPIL registration goes team-based (mirrors AUC's live SurveyMonkey form):
-- one submission per team; team lead detail + members 2-4 + both-tracks confirmation.
alter table public.ea_opil_registrations
  add column if not exists major text
    check (major is null or char_length(major) <= 120),
  add column if not exists phone text
    check (phone is null or char_length(phone) <= 40),
  add column if not exists classification text
    check (classification is null or char_length(classification) <= 60),
  add column if not exists personal_email text
    check (personal_email is null or personal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column if not exists members jsonb
    check (members is null or (jsonb_typeof(members) = 'array'
           and jsonb_array_length(members) <= 3
           and pg_column_size(members) <= 6000)),
  add column if not exists all_participating boolean;
