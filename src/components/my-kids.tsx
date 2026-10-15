import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FinishStudentForm, RegisterChildForm, ScheduleChildForm } from "@/components/students";
import { listHousehold } from "@/lib/students-server";
import { listGuardedKidLessons } from "@/lib/lesson-extras-server";
import { formatWall } from "@/lib/rally";
import { lessonStatusLabel } from "@/lib/lesson-status";
import { LESSON_NOTES_LABEL } from "@/lib/lesson-notes";

/** Family card for any signed-in user: add a child, finish their profile, schedule their lessons. */
export function MyKidsCard() {
  const qc = useQueryClient();
  const household = useQuery({ queryKey: ["household"], queryFn: () => listHousehold() });
  const lessons = useQuery({ queryKey: ["guarded-lessons"], queryFn: () => listGuardedKidLessons() });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const kids = household.data?.children ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["household"] });
    void qc.invalidateQueries({ queryKey: ["my-lessons"] });
    void qc.invalidateQueries({ queryKey: ["home"] });
    void qc.invalidateQueries({ queryKey: ["desk"] });
    void qc.invalidateQueries({ queryKey: ["guarded-lessons"] });
  };
  if (!household.data) return null;

  if (kids.length === 0) {
    return (
      <Card id="my-kids" className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">My kids</p>
            <p className="mt-1 text-sm text-muted-foreground">Booking lessons for your child? Add them once.</p>
          </div>
          {adding ? null : (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              Add my child
            </Button>
          )}
        </div>
        {adding ? <RegisterChildForm onSaved={refresh} /> : null}
      </Card>
    );
  }

  return (
    <Card id="my-kids" className="mt-8">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">My kids</p>
      <p className="mt-2 font-display text-xl">Your children ({kids.length})</p>
      <ul className="mt-3 flex flex-col gap-3">
        {kids.map((child) => (
          <li key={child.user_id} className="border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{child.display_name}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setScheduleFor(scheduleFor === child.user_id ? null : child.user_id)}
                >
                  Schedule a lesson
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(editing === child.user_id ? null : child.user_id)}
                >
                  {editing === child.user_id ? "Close profile" : "Edit profile"}
                </Button>
              </div>
            </div>
            {(lessons.data ?? [])
              .filter((l) => l.player_user_id === child.user_id)
              .slice(0, 3)
              .map((l) => (
                <div key={l.id} className="mt-2 rounded-md border border-border px-3 py-2 text-xs">
                  <p>
                    {formatWall(l.starts_at)} · {l.coach_name} · {lessonStatusLabel(l.status)}
                  </p>
                  {l.notes ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      <span className="text-muted-foreground">{LESSON_NOTES_LABEL}: </span>
                      {l.notes}
                    </p>
                  ) : null}
                  {l.successes ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      <span className="text-muted-foreground">Successes: </span>
                      {l.successes}
                    </p>
                  ) : null}
                </div>
              ))}
            {editing === child.user_id ? <FinishStudentForm child={child} onSaved={refresh} /> : null}
            {scheduleFor === child.user_id ? (
              <ScheduleChildForm
                key={child.user_id}
                children={kids}
                coaches={household.data!.coaches}
                courts={household.data!.courts}
                defaultChildId={child.user_id}
                defaultCoachId={child.coach_user_ids[0]}
                onSaved={refresh}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-border pt-3">
        {adding ? (
          <RegisterChildForm onSaved={refresh} />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add another child
          </Button>
        )}
      </div>
    </Card>
  );
}
