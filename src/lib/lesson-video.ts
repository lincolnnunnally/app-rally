/**
 * Practice / stroke video on the existing lesson row.
 * New clips go to the private `rally-lesson-videos` bucket (`lessons.video_path`).
 * Old clips stay readable from `lessons.video_data`. Not a second notes store.
 *
 * iPhone Safari cannot reliably re-encode a camera clip (canvas + MediaRecorder),
 * so this door does not downscale. The cap is duration + file size, matching the bucket.
 */

import { lessonNotesEditable } from "./lesson-notes.ts";
import { lessonScanPath } from "./lesson-status.ts";

export const LESSON_VIDEO_BUCKET = "rally-lesson-videos";

/** Matches storage.buckets.file_size_limit (50 MB). */
export const LESSON_VIDEO_MAX_BYTES = 52_428_800;

export const LESSON_VIDEO_MAX_SECONDS = 60;

/** Playback signed URLs. Long enough to watch and scrub a one-minute clip. */
export const LESSON_VIDEO_SIGN_SECONDS = 900;

export const LESSON_VIDEO_LABEL = "Practice / stroke video";

export const LESSON_VIDEO_HELP =
  "Same lesson as the notes. Up to 60 seconds, 50 MB.";

/** LPL project. Publishable key only — never the service role. */
export const LESSON_VIDEO_STORAGE_URL = "https://uqhqulrqcygsmmzdzemx.supabase.co";

export const LESSON_VIDEO_PUBLISHABLE_KEY =
  "sb_publishable_7XktmGTAP0Ka52rhchT5mQ_xYXPs7e-";

export const LESSON_VIDEO_ERRORS = {
  type: "Choose an mp4, mov, or webm clip.",
  tooLong: "That clip is over 60 seconds.",
  tooBig: "That clip is over 50 MB.",
  upload: "Could not upload that clip. Try again.",
  read: "Could not read that video.",
} as const;

const MIME_EXT = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;

type LessonVideoMime = keyof typeof MIME_EXT;

export function lessonVideoEditable(status: string) {
  return lessonNotesEditable(status);
}

export function isLessonVideoData(value: string | null | undefined) {
  return Boolean(value && value.startsWith("data:video/") && value.length > 20);
}

export function isLessonVideoSrc(value: string | null | undefined) {
  return isLessonVideoData(value) || Boolean(value && value.startsWith("https://"));
}

export function canActorSaveLessonVideo(opts: {
  actorId: string;
  coachId: string;
  playerId: string;
  status: string;
}): { ok: true } | { ok: false; error: string } {
  if (opts.actorId !== opts.coachId && opts.actorId !== opts.playerId) {
    return { ok: false, error: "This lesson is not yours." };
  }
  if (!lessonVideoEditable(opts.status)) {
    return { ok: false, error: "Video can be added on upcoming or completed lessons." };
  }
  return { ok: true };
}

/**
 * Player play/replace stays on the lesson when this account is the student,
 * including when that same account is also the coach.
 */
export function showsPlayerLessonVideo(opts: {
  actorId: string;
  playerId: string;
  status: string;
}) {
  return opts.actorId === opts.playerId && lessonVideoEditable(opts.status);
}

/** Coach log list leads with this account. Coaches are players on the same lesson. */
export function withCoachAsPlayer<T extends { user_id: string; display_name: string }>(
  self: { user_id: string; display_name: string },
  others: T[],
) {
  const rest = others.filter((p) => p.user_id !== self.user_id);
  return [{ user_id: self.user_id, display_name: `${self.display_name} (you)` }, ...rest];
}

/** Notice goes to the other person on the lesson. Same account is both — no second party. */
export function lessonVideoNoticeTarget(actorId: string, coachId: string, playerId: string) {
  const other = actorId === coachId ? playerId : coachId;
  if (!other || other === actorId) return null;
  return other;
}

export function lessonVideoNotice(lessonId: number) {
  return {
    title: "Practice video",
    body: "A practice / stroke video is on this lesson.",
    href: lessonScanPath(lessonId),
  };
}

export function lessonVideoContentType(contentType: string, fileName: string): LessonVideoMime | null {
  const type = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (type in MIME_EXT) return type as LessonVideoMime;
  const name = fileName.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  return null;
}

/** `{lessonId}/{uuid}.{ext}` — the lesson id is the ownership folder. */
export function isLessonVideoObjectPath(lessonId: number, objectPath: string) {
  const parts = objectPath.split("/");
  if (parts.length !== 2) return false;
  if (parts[0] !== String(lessonId)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov|webm)$/i.test(parts[1] ?? "");
}

export function lessonVideoObjectPath(lessonId: number, id: string, extension: string) {
  return `${lessonId}/${id}.${extension}`;
}

/**
 * The signed-in coach or student may attach this object path.
 * A stranger, or a path that points at another lesson, is rejected.
 */
export function canActorOwnLessonVideoPath(opts: {
  actorId: string;
  coachId: string;
  playerId: string;
  lessonId: number;
  objectPath: string;
}) {
  if (opts.actorId !== opts.coachId && opts.actorId !== opts.playerId) return false;
  return isLessonVideoObjectPath(opts.lessonId, opts.objectPath);
}

export function assertLessonVideoChoice(input: {
  contentType: string;
  fileName: string;
  byteSize: number;
  durationSec: number;
}): { contentType: LessonVideoMime; extension: (typeof MIME_EXT)[LessonVideoMime] } {
  const contentType = lessonVideoContentType(input.contentType, input.fileName);
  if (!contentType) throw new Error(LESSON_VIDEO_ERRORS.type);
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    throw new Error(LESSON_VIDEO_ERRORS.read);
  }
  if (input.byteSize > LESSON_VIDEO_MAX_BYTES) throw new Error(LESSON_VIDEO_ERRORS.tooBig);
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw new Error(LESSON_VIDEO_ERRORS.read);
  }
  if (input.durationSec > LESSON_VIDEO_MAX_SECONDS) throw new Error(LESSON_VIDEO_ERRORS.tooLong);
  return { contentType, extension: MIME_EXT[contentType] };
}

/** Duration from the file itself. iOS often reports Infinity until a seek. */
export function readLessonVideoDuration(file: File): Promise<number> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error(LESSON_VIDEO_ERRORS.read));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (err: Error | null, seconds?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      if (err) reject(err);
      else resolve(seconds ?? 0);
    };
    timer = setTimeout(() => finish(new Error(LESSON_VIDEO_ERRORS.read)), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      if (seconds === Infinity) {
        video.ontimeupdate = () => {
          video.ontimeupdate = null;
          video.currentTime = 0;
          const measured = video.duration;
          if (!Number.isFinite(measured) || measured <= 0) finish(new Error(LESSON_VIDEO_ERRORS.read));
          else finish(null, measured);
        };
        video.currentTime = 1e101;
        return;
      }
      if (!Number.isFinite(seconds) || seconds <= 0) finish(new Error(LESSON_VIDEO_ERRORS.read));
      else finish(null, seconds);
    };
    video.onerror = () => finish(new Error(LESSON_VIDEO_ERRORS.read));
    video.src = url;
  });
}

/** PUT the file to a server-minted signed URL. The publishable key is not the service role. */
export async function uploadLessonVideoFile(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  let res: Response;
  try {
    res = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        apikey: LESSON_VIDEO_PUBLISHABLE_KEY,
        Authorization: `Bearer ${LESSON_VIDEO_PUBLISHABLE_KEY}`,
      },
      body,
    });
  } catch {
    throw new Error(LESSON_VIDEO_ERRORS.upload);
  }
  if (!res.ok) throw new Error(LESSON_VIDEO_ERRORS.upload);
}
