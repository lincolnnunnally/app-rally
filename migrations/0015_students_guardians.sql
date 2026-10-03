-- Students, guardians, and private coach notes stay on tables that already exist.
-- A student without an account is a profiles row (user_id is text, not an auth user).
-- One guardian account points at many children through profiles.guardian_user_id.
-- A player can have more than one coach in profiles.coach_user_ids (and in lessons).
-- profiles.claim_code is the one link a parent uses to claim that student.
-- profiles.public_fields chooses which optional résumé fields are public.
-- Phone, the guardian link, the claim code, and lessons.private_notes are never public.
-- lessons.notes stays the shared practice cue. lessons.private_notes is coach-only.
-- No new table. Do not apply this file by hand; deploy runs scripts/migrate.mjs.

alter table profiles add column if not exists guardian_user_id text;
alter table profiles add column if not exists claim_code text;
alter table profiles add column if not exists coach_user_ids text not null default '[]';
alter table profiles add column if not exists public_fields text not null default 'bio,levels,ratings,experience,photo,availability';

create unique index if not exists profiles_claim_code_idx on profiles (claim_code) where claim_code is not null;
create index if not exists profiles_guardian_idx on profiles (guardian_user_id);

alter table lessons add column if not exists private_notes text;
