import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatWeekRange,
  formatWeekday,
  lessonsOnDate,
  mondayOnOrBefore,
  shiftWeek,
  weekDates,
  type FeedLesson,
} from "@/lib/calendar";
import { listWeekLessons } from "@/lib/calendar-server";
import { DEFAULT_LESSON_TIMEZONE, todayInZone } from "@/lib/schedule";

export function LessonWeek({
  perspective,
  viewerId,
  timeZone = DEFAULT_LESSON_TIMEZONE,
}: {
  perspective: "coach" | "player";
  viewerId: string;
  timeZone?: string;
}) {
  const today = todayInZone(timeZone);
  const [monday, setMonday] = useState(() => mondayOnOrBefore(today));
  const days = useMemo(() => weekDates(monday), [monday]);
  const week = useQuery({
    queryKey: ["week-lessons", perspective, monday],
    queryFn: () => listWeekLessons({ data: { role: perspective, week_start: monday } }),
  });
  const lessons = week.data ?? [];

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">Week</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatWeekRange(monday)}. Open a lesson to move it or change the series.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setMonday((value) => shiftWeek(value, -1))}>
            Previous week
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setMonday(mondayOnOrBefore(today))}>
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMonday((value) => shiftWeek(value, 1))}>
            Next week
          </Button>
        </div>
      </div>
      {week.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading this week…</p>
      ) : week.isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {week.error instanceof Error ? week.error.message : "Could not load this week."}
        </p>
      ) : (
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => {
          const label = formatWeekday(day);
          const rows = lessonsOnDate(lessons, day);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={
                isToday
                  ? "rounded-lg border border-primary/50 bg-secondary/40 p-2"
                  : "rounded-lg border border-border p-2"
              }
            >
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                {label.weekday}
                {isToday ? " · today" : ""}
              </p>
              <p className="text-sm">{label.monthDay}</p>
              {rows.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {rows.map((lesson) => (
                    <li key={lesson.id}>
                      <WeekLessonLink lesson={lesson} perspective={perspective} viewerId={viewerId} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}

function WeekLessonLink({
  lesson,
  perspective,
  viewerId,
}: {
  lesson: FeedLesson;
  perspective: "coach" | "player";
  viewerId: string;
}) {
  const canceled = lesson.status === "cancelled";
  const title = lessonTitle(lesson, perspective, viewerId);
  return (
    <Link
      to="/app/lessons/$id"
      params={{ id: String(lesson.id) }}
      className={
        canceled
          ? "block rounded-md border border-dashed border-border bg-background px-2 py-2 text-sm"
          : "block rounded-md border border-border bg-background px-2 py-2 text-sm hover:border-primary/40"
      }
    >
      <p className="text-xs text-muted-foreground">{wallTime(lesson.startsAt)}</p>
      <p className={canceled ? "text-muted-foreground line-through decoration-muted-foreground" : ""}>
        {title}
      </p>
      {lesson.courtName ? <p className="text-xs text-muted-foreground">{lesson.courtName}</p> : null}
      {canceled ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Canceled{lesson.cancelReason ? `: ${lesson.cancelReason}` : ""}
        </p>
      ) : null}
    </Link>
  );
}

function lessonTitle(lesson: FeedLesson, perspective: "coach" | "player", viewerId: string): string {
  const what = lesson.serviceName || sportWord(lesson.sport);
  if (perspective === "coach") return `${lesson.playerName} · ${what}`;
  if (viewerId !== lesson.playerUserId) return `${lesson.playerName} · ${lesson.coachName} · ${what}`;
  return `${lesson.coachName} · ${what}`;
}

function wallTime(startsAt: string): string {
  const time = startsAt.replace("T", " ").split(" ")[1] ?? "";
  const [hh, mm] = time.split(":");
  const hour = Number(hh);
  if (!Number.isFinite(hour) || mm == null) return startsAt;
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h}:${mm.slice(0, 2)} ${ampm}`;
}

function sportWord(sport: string): string {
  if (sport === "tennis") return "Tennis";
  if (sport === "pickleball") return "Pickleball";
  return sport || "Lesson";
}
