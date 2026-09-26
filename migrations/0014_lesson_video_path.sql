-- Path of a practice clip in the private rally-lesson-videos bucket.
-- Applied on deploy by scripts/migrate.mjs (`npm run build` → db:migrate)
-- against Rally's DATABASE_URL (search_path rally, public). Not the LPL
-- storage project. The bucket itself is supabase/migrations/
-- 20260926140900_rally_lesson_videos.sql, applied on LPL by hand.
-- Old clips stay in video_data.

alter table lessons
  add column if not exists video_path text;
