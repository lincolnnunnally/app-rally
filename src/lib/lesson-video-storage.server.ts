/**
 * Server-only Storage client for practice clips.
 * Uses the service role to sign URLs after the lesson ownership check.
 * Never import this from a component. Never send the service role to the browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LESSON_VIDEO_BUCKET,
  LESSON_VIDEO_ERRORS,
  LESSON_VIDEO_SIGN_SECONDS,
  LESSON_VIDEO_STORAGE_URL,
} from "./lesson-video.ts";

function admin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Lesson video storage is not configured.");
  const url = process.env.SUPABASE_URL?.trim() || LESSON_VIDEO_STORAGE_URL;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asUploadError(error: { message?: string } | null): Error {
  const message = error?.message ?? "";
  if (/not configured/i.test(message)) return new Error("Lesson video storage is not configured.");
  return new Error(LESSON_VIDEO_ERRORS.upload);
}

export async function createLessonVideoUpload(path: string) {
  const supabase = admin();
  const { data, error } = await supabase.storage
    .from(LESSON_VIDEO_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.signedUrl) throw asUploadError(error);
  return { signedUrl: data.signedUrl, path: data.path || path };
}

export async function lessonVideoObjectExists(path: string) {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const supabase = admin();
  const { data, error } = await supabase.storage.from(LESSON_VIDEO_BUCKET).list(folder, {
    search: file,
    limit: 10,
  });
  if (error) throw asUploadError(error);
  return (data ?? []).some((object) => object.name === file);
}

export async function signLessonVideoPlayback(path: string) {
  const supabase = admin();
  const { data, error } = await supabase.storage
    .from(LESSON_VIDEO_BUCKET)
    .createSignedUrl(path, LESSON_VIDEO_SIGN_SECONDS);
  if (error || !data?.signedUrl) throw asUploadError(error);
  return data.signedUrl;
}

export async function deleteLessonVideoObject(path: string) {
  const supabase = admin();
  const { error } = await supabase.storage.from(LESSON_VIDEO_BUCKET).remove([path]);
  if (error) throw asUploadError(error);
}
