/**
 * Practice / stroke video stays on the existing `lessons` row
 * (`video_data`) and `saveLessonVideo` door. Same data-URI media path as
 * profile/court photos. Not a second notes store. Not skill badges.
 */

import { lessonNotesEditable } from "./lesson-notes.ts";
import { lessonScanPath } from "./lesson-status.ts";

/** Data-URI ceiling — short stroke clip, same family as photo_data (450k). */
export const LESSON_VIDEO_MAX = 3_200_000;

/** Raw file ceiling before the data-URI inflate (~4/3). */
export const LESSON_VIDEO_FILE_MAX = 2_400_000;

export const LESSON_VIDEO_LABEL = "Practice / stroke video";

export const LESSON_VIDEO_HELP =
  "Same lesson as the notes. A short stroke or practice clip — about 20 seconds.";

export function lessonVideoEditable(status: string) {
  return lessonNotesEditable(status);
}

export function isLessonVideoData(value: string | null | undefined) {
  return Boolean(value && value.startsWith("data:video/") && value.length > 20);
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

export function assertLessonVideoPayload(value: string): string | null {
  if (value === "") return null;
  if (!value.startsWith("data:video/")) {
    throw new Error("Video must be a practice or stroke clip you upload.");
  }
  if (value.length > LESSON_VIDEO_MAX) {
    throw new Error("That clip is still too large. Try a shorter stroke video.");
  }
  return value;
}

export async function readLessonVideo(file: File): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a practice or stroke video.");
  }
  if (file.size > LESSON_VIDEO_FILE_MAX) {
    throw new Error("That clip is too long. Use a short stroke video (about 20 seconds).");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that video."));
    reader.readAsDataURL(file);
  });
  return assertLessonVideoPayload(data) ?? "";
}
