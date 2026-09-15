/**
 * Session notes + weekly practice cue stay on the existing `lessons.notes`
 * column and `saveLessonNotes` door. Not a second notes store. Not a video
 * product. Not skill badges.
 */

import { lessonScanPath } from "./lesson-status.ts";

export const LESSON_NOTES_MAX = 400;

export const LESSON_NOTES_LABEL = "Session notes + weekly practice cue";

export const LESSON_NOTES_HELP =
  "Same field. What you worked this session, and what they practice this week.";

export function lessonNotesEditable(status: string) {
  return status === "confirmed" || status === "checked_in" || status === "completed";
}

export function canActorSaveLessonNotes(opts: {
  actorId: string;
  coachId: string;
  status: string;
}): { ok: true } | { ok: false; error: string } {
  if (opts.actorId !== opts.coachId) {
    return { ok: false, error: "Only the coach can write lesson notes." };
  }
  if (!lessonNotesEditable(opts.status)) {
    return { ok: false, error: "Notes can be written on upcoming or completed lessons." };
  }
  return { ok: true };
}

export function lessonNotesNotice(notes: string | null, lessonId: number) {
  const cue = (notes ?? "").trim();
  return {
    title: "Practice cue",
    body: cue || "Your coach updated the weekly practice cue.",
    href: lessonScanPath(lessonId),
  };
}

/** Existing Log a lesson form — default wall-clock so Upcoming is seedable. */
export function defaultLessonWhen(now = new Date()) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}
