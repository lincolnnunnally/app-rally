-- Practice / stroke clips for Rally lessons.
-- Apply this on the LPL Supabase project (uqhqulrqcygsmmzdzemx) by hand.
-- The app migrator does not run this file: PGLite has no storage schema,
-- and the bucket should not be created by a preview deploy.
--
-- Rally sign-in is Better Auth, not Supabase Auth, so auth.uid() does not
-- match coach_user_id / player_user_id today. The app server checks those
-- columns, then uses the service role (server only) to sign upload and
-- playback URLs. These policies still lock the private bucket: a Supabase
-- JWT can touch an object only when its uid is the lesson coach or student.

alter table rally.lessons
  add column if not exists video_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rally-lesson-videos',
  'rally-lesson-videos',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do nothing;

create schema if not exists rally_private;

create or replace function rally_private.can_access_lesson_video(object_name text)
returns boolean
language sql
stable
security definer
set search_path = rally, public, auth
as $$
  select exists (
    select 1
    from rally.lessons l
    where l.id::text = split_part(object_name, '/', 1)
      and (select auth.uid())::text in (l.coach_user_id, l.player_user_id)
  );
$$;

revoke all on function rally_private.can_access_lesson_video(text) from public, anon;
grant usage on schema rally_private to authenticated;
grant execute on function rally_private.can_access_lesson_video(text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'rally_lesson_videos_select'
  ) then
    create policy rally_lesson_videos_select
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'rally-lesson-videos'
        and rally_private.can_access_lesson_video(name)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'rally_lesson_videos_insert'
  ) then
    create policy rally_lesson_videos_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'rally-lesson-videos'
        and rally_private.can_access_lesson_video(name)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'rally_lesson_videos_update'
  ) then
    create policy rally_lesson_videos_update
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'rally-lesson-videos'
        and rally_private.can_access_lesson_video(name)
      )
      with check (
        bucket_id = 'rally-lesson-videos'
        and rally_private.can_access_lesson_video(name)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'rally_lesson_videos_delete'
  ) then
    create policy rally_lesson_videos_delete
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'rally-lesson-videos'
        and rally_private.can_access_lesson_video(name)
      );
  end if;
end $$;
