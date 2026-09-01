-- Q22 has TWO bulleted affirmations plus a required text box on AUC's form.
-- 0020 shipped a single combined checkbox; split it so each bullet is its own
-- affirmative act, and capture the typed-name signature.
alter table public.ea_opil_registrations
  add column if not exists agreed_commitment boolean,
  add column if not exists commitment_signature text
    check (commitment_signature is null or char_length(commitment_signature) between 2 and 120);
