/**
 * Lesson check-in / check-out stays on the existing `lessons.status` column
 * and `setLessonStatus` door. Not a separate attendance product.
 *
 * requested → confirmed (coach) → checked_in (scan) → completed (check-out)
 */

export const LESSON_STATUS_NEXT = [
  "confirmed",
  "declined",
  "cancelled",
  "completed",
  "checked_in",
] as const;

export type LessonStatusNext = (typeof LESSON_STATUS_NEXT)[number];

export function lessonScanPath(id: number) {
  return `/app/lessons/${id}`;
}

export function noticeLessonId(href: string | null | undefined) {
  const m = href?.match(/^\/app\/lessons\/(\d+)$/);
  return m?.[1] ?? null;
}

export function canActorSetLessonStatus(opts: {
  actorId: string;
  coachId: string;
  playerId: string;
  current: string;
  next: LessonStatusNext;
}): { ok: true } | { ok: false; error: string } {
  const isCoach = opts.actorId === opts.coachId;
  const isPlayer = opts.actorId === opts.playerId;
  if (!isCoach && !isPlayer) return { ok: false, error: "Unauthorized" };

  if (opts.next === "cancelled") {
    if (opts.current === "cancelled" || opts.current === "completed" || opts.current === "declined") {
      return { ok: false, error: "That lesson is already closed." };
    }
    return { ok: true };
  }

  if (opts.next === "confirmed" || opts.next === "declined") {
    if (!isCoach) return { ok: false, error: "Only the coach can confirm or decline." };
    if (opts.current !== "requested") {
      return { ok: false, error: "Only a request can be confirmed or declined." };
    }
    return { ok: true };
  }

  if (opts.next === "checked_in") {
    if (opts.current !== "confirmed") {
      return { ok: false, error: "Check in after the coach confirms." };
    }
    return { ok: true };
  }

  if (opts.next === "completed") {
    if (opts.current !== "confirmed" && opts.current !== "checked_in") {
      return { ok: false, error: "Check out a confirmed lesson." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unauthorized" };
}

export function lessonStatusLabel(status: string) {
  if (status === "checked_in") return "checked in";
  return status;
}

export function lessonIsOpen(status: string) {
  return status === "confirmed" || status === "checked_in";
}
