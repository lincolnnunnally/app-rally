-- Path of a practice clip in the private rally-lesson-videos bucket.
-- Bucket, 50 MB limit, mime types, and storage.objects policies are in
-- supabase/migrations/20260926140900_rally_lesson_videos.sql (apply on LPL by hand).
-- This column is what list/scan queries read. Old clips stay in video_data.

alter table lessons
  add column if not exists video_path text;
