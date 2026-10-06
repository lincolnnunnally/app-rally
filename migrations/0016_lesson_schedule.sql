-- Lesson scheduling: wall-clock timezone, standing series, cancel reasons.
-- Follows 0015_students_guardians.sql.
-- Additive only (nullable columns and an index). No drops, renames, or data rewrites.
-- starts_at stays timestamp without time zone and stores local wall-clock time.
-- lessons.timezone is the IANA zone for that wall clock (app default America/New_York).
-- cadence_at is the on-pattern slot. A single move changes starts_at and leaves cadence_at.
-- Do not apply this file by hand from the scheduling change; deploy runs scripts/migrate.mjs.

alter table lessons add column if not exists timezone text;
alter table lessons add column if not exists open_ended boolean;
alter table lessons add column if not exists cadence_at timestamp;
alter table lessons add column if not exists cancel_reason text;

create index if not exists lessons_series_idx on lessons (series_id, starts_at);
