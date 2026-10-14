-- Coach-entered "successes" on a lesson: what went right, shown to the player and guardian.
-- Additive only. Session notes (lessons.notes) and private notes (lessons.private_notes) are unchanged.
alter table lessons add column if not exists successes text;
