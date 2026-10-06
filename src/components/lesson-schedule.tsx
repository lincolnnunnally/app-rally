import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lessonIsOpen } from "@/lib/lesson-status";
import { toInputValue, type LessonRow } from "@/lib/rally";
import { DEFAULT_WEATHER_REASON } from "@/lib/schedule";
import { setLessonStatus } from "@/lib/rally-server";
import {
  cancelCoachDay,
  extendLessonSeries,
  moveLesson,
  renewLessonSeries,
  shiftLessonSeries,
} from "@/lib/schedule-server";

function datePart(starts: string) {
  return starts.replace("T", " ").slice(0, 10);
}

function timePart(starts: string) {
  return (starts.replace("T", " ").split(" ")[1] ?? "08:00").slice(0, 5);
}

function refreshSchedule(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["desk"] });
  void qc.invalidateQueries({ queryKey: ["my-lessons"] });
  void qc.invalidateQueries({ queryKey: ["home"] });
  void qc.invalidateQueries({ queryKey: ["notices"] });
  void qc.invalidateQueries({ queryKey: ["lesson-scan"] });
  void qc.invalidateQueries({ queryKey: ["week-lessons"] });
}

export function LessonScheduleActions({ lesson }: { lesson: LessonRow }) {
  const qc = useQueryClient();
  const [moveOpen, setMoveOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const open = lessonIsOpen(lesson.status) || lesson.status === "requested";
  const series = Boolean(lesson.series_id) && open;
  const fixedSeries = series && !lesson.open_ended;

  const move = useMutation({
    mutationFn: (starts_at: string) => moveLesson({ data: { id: lesson.id, starts_at } }),
    onSuccess: () => {
      toast.success("This lesson moved. The rest of the series stayed put.");
      setMoveOpen(false);
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const shift = useMutation({
    mutationFn: (input: { from_date: string; local_time: string }) =>
      shiftLessonSeries({
        data: {
          series_id: lesson.series_id!,
          from_date: input.from_date,
          local_time: input.local_time,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Series moved from that date (${result.moved}).`);
      setShiftOpen(false);
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const extend = useMutation({
    mutationFn: (weeks: number) =>
      extendLessonSeries({ data: { series_id: lesson.series_id!, weeks } }),
    onSuccess: (result) => {
      toast.success(`Added ${result.added} week${result.added === 1 ? "" : "s"}.`);
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const renew = useMutation({
    mutationFn: () => renewLessonSeries({ data: { series_id: lesson.series_id! } }),
    onSuccess: (result) => {
      toast.success(`Renewed · ${result.added} more week${result.added === 1 ? "" : "s"}.`);
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!open) {
    return lesson.cancel_reason ? (
      <p className="mt-2 text-xs text-muted-foreground">{lesson.cancel_reason}</p>
    ) : null;
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setMoveOpen((value) => !value)}>
          Move this lesson
        </Button>
        {series ? (
          <Button size="sm" variant="outline" onClick={() => setShiftOpen((value) => !value)}>
            Shift series
          </Button>
        ) : null}
        {fixedSeries ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={extend.isPending}
              onClick={() => extend.mutate(4)}
            >
              Extend
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={renew.isPending}
              onClick={() => renew.mutate()}
            >
              Renew
            </Button>
          </>
        ) : null}
      </div>
      {moveOpen ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const starts = String(new FormData(event.currentTarget).get("starts_at") || "");
            if (!starts) return;
            move.mutate(starts);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>New time for this lesson only</Label>
            <Input
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={toInputValue(lesson.starts_at)}
            />
          </div>
          <Button type="submit" size="sm" disabled={move.isPending}>
            {move.isPending ? "Moving…" : "Save move"}
          </Button>
        </form>
      ) : null}
      {shiftOpen && lesson.series_id ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            shift.mutate({
              from_date: String(form.get("from_date") || ""),
              local_time: String(form.get("local_time") || ""),
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>First date that moves</Label>
            <Input
              name="from_date"
              type="date"
              required
              defaultValue={datePart(lesson.starts_at)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>New local time</Label>
            <Input
              name="local_time"
              type="time"
              required
              defaultValue={timePart(lesson.starts_at)}
            />
          </div>
          <Button type="submit" size="sm" disabled={shift.isPending}>
            {shift.isPending ? "Shifting…" : "Shift from this date"}
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Earlier lessons stay put. The clock stays on local time across daylight saving.
          </p>
        </form>
      ) : null}
    </div>
  );
}

export function WeatherCancelForm({ day }: { day?: string }) {
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: (input: { day: string; reason: string }) => cancelCoachDay({ data: input }),
    onSuccess: (result) => {
      toast.success(
        `Canceled ${result.canceled} lesson${result.canceled === 1 ? "" : "s"} for that day.`,
      );
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const day = String(form.get("day") || "");
        if (!day) return;
        cancel.mutate({ day, reason: String(form.get("reason") || "") });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Day</Label>
          <Input id="weather-day-input" name="day" type="date" required key={day ?? "weather-day"} defaultValue={day} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Reason</Label>
          <Textarea name="reason" defaultValue={DEFAULT_WEATHER_REASON} />
        </div>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={cancel.isPending}>
          {cancel.isPending ? "Canceling…" : "Cancel this day"}
        </Button>
      </div>
    </form>
  );
}

export function CancelLessonButton({
  lessonId,
  size = "sm",
  variant = "ghost",
}: {
  lessonId: number;
  size?: "default" | "sm";
  variant?: "ghost" | "outline";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () =>
      setLessonStatus({
        data: { id: lessonId, status: "cancelled", reason: reason.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Lesson canceled.");
      setOpen(false);
      setReason("");
      refreshSchedule(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!open) {
    return (
      <Button size={size} variant={variant} type="button" onClick={() => setOpen(true)}>
        Cancel
      </Button>
    );
  }

  return (
    <form
      className="flex min-w-56 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        cancel.mutate();
      }}
    >
      <Label htmlFor={`cancel-reason-${lessonId}`}>Reason (optional)</Label>
      <Textarea
        id={`cancel-reason-${lessonId}`}
        value={reason}
        maxLength={500}
        placeholder="Rain, sick, schedule change"
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex gap-2">
        <Button size={size} type="submit" variant="outline" disabled={cancel.isPending}>
          {cancel.isPending ? "Canceling…" : "Cancel lesson"}
        </Button>
        <Button
          size={size}
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          Keep lesson
        </Button>
      </div>
    </form>
  );
}
