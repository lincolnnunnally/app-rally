-- Daylight suggestion dismissals. Additive only.
-- series_id matches lessons.series_id (text). user_id matches "user"."id" and profiles.user_id (text).
-- Do not copy old journal_entries rows. Deploy applies this file.

create table if not exists daylight_dismissals (
  series_id text not null,
  lesson_date date not null,
  user_id text not null,
  created_at timestamp not null default now(),
  primary key (series_id, lesson_date, user_id)
);
