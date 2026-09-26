-- Private bucket for Rally practice / stroke clips on the LPL project
-- (uqhqulrqcygsmmzdzemx). Applied by hand as rally_lesson_videos_bucket.
-- The app migrator does not run this file.
--
-- Rally's lessons table is not in this database. lessons.video_path is added
-- by migrations/0014_lesson_video_path.sql on Rally's own DATABASE_URL when
-- `npm run build` runs `db:migrate`.
--
-- No storage.objects policies and no rally_private helper. Rally signs in
-- with Better Auth, so auth.uid() never matches coach_user_id or
-- player_user_id. The bucket stays private: only the server's service-role
-- signed URLs can upload, read, or delete objects. The server checks the
-- signed-in user is that lesson's coach or player before it signs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rally-lesson-videos',
  'rally-lesson-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do nothing;
