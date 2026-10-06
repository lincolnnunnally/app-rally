-- Personal ICS subscribe links and a lesson revision stamp for calendar updates.
-- Follows 0016_lesson_schedule.sql.
-- Additive only: a new table, one nullable column, a trigger. No drops, renames, or data rewrites.
-- calendar_feeds.token is the unguessable read credential for /api/calendar/{token}.ics.
-- lessons.updated_at stays null on existing rows. The trigger fills it on later updates
-- so a moved or canceled lesson gets a new SEQUENCE and LAST-MODIFIED.
-- Do not apply this file by hand; deploy runs scripts/migrate.mjs.

create table if not exists calendar_feeds (
  user_id text primary key,
  token text not null,
  rotated_at timestamp not null default now()
);

create unique index if not exists calendar_feeds_token_idx on calendar_feeds (token);

alter table lessons add column if not exists updated_at timestamp;

create or replace function rally_lessons_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'rally_lessons_touch_updated_at'
  ) then
    create trigger rally_lessons_touch_updated_at
      before update on lessons
      for each row
      execute function rally_lessons_touch_updated_at();
  end if;
end
$$;
