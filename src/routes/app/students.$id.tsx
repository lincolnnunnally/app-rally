import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AssessmentForm,
  BeliefChart,
  ReflectionRead,
  SkillBars,
} from "@/components/growth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  STARTING_FIELDS,
  growthHighlights,
  latestCheckin,
  skillChanges,
  startingPoint,
  type GrowthSport,
} from "@/lib/growth";
import { getStudentGrowth, type GrowthAssessment } from "@/lib/growth-server";
import { formatWall, sportLabel } from "@/lib/rally";

export const Route = createFileRoute("/app/students/$id")({
  component: StudentGrowth,
});

function StudentGrowth() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["growth", id],
    queryFn: () => getStudentGrowth({ data: { student_id: id } }),
  });
  const [form, setForm] = useState<null | { kind: "baseline" | "checkin"; edit?: GrowthAssessment }>(
    null,
  );
  const [sportPick, setSportPick] = useState<GrowthSport | null>(null);

  if (q.isError) {
    return (
      <div className="px-5 py-8">
        <p className="text-sm text-muted-foreground">
          {q.error instanceof Error ? q.error.message : "Could not load this page."}
        </p>
        <Button className="mt-4" variant="secondary" asChild>
          <Link to="/app">Back</Link>
        </Button>
      </div>
    );
  }
  if (!q.data) return <div className="px-5 py-8 text-sm text-muted-foreground">Loading growth…</div>;

  const { role, student, assessments, lessons } = q.data;
  const isCoach = role === "coach";
  const name = student.display_name;
  const firstName = name.split(" ")[0] ?? name;
  const sports = (["tennis", "pickleball"] as const).filter(
    (s) => assessments.some((a) => a.sport === s) || lessons.some((l) => l.sport === s),
  );
  const fallbackSport: GrowthSport =
    sports[0] ?? (student.plays_tennis || !student.plays_pickleball ? "tennis" : "pickleball");
  const sport = sportPick ?? fallbackSport;

  const start = startingPoint(assessments, sport);
  const latest = latestCheckin(assessments, sport);
  const changes = skillChanges(start?.ratings, latest?.ratings ?? null, sport);
  const sportLessons = lessons.filter((l) => l.sport === sport);
  // A lesson that already happened counts, even if nobody tapped check out.
  const nowWall = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const done = sportLessons.filter(
    (l) => l.status === "completed" || l.starts_at.replace(" ", "T").slice(0, 16) <= nowWall,
  );
  const firstLesson = done[done.length - 1];
  const points = sportLessons
    .filter((l) => l.reflection)
    .map((l) => ({
      lesson_id: l.id,
      date: l.starts_at,
      confidence: l.reflection?.confidence ?? null,
      belief: l.reflection?.belief ?? null,
    }));
  const highlights = growthHighlights({
    lessonsDone: done.length,
    firstLessonDate: firstLesson ? formatWall(firstLesson.starts_at.slice(0, 10)) : null,
    successesCount: sportLessons.filter((l) => l.successes).length,
    changes,
    points,
  });
  const checkins = assessments.filter((a) => a.sport === sport && a.id !== start?.id);
  const refresh = () => {
    setForm(null);
    void qc.invalidateQueries({ queryKey: ["growth", id] });
  };

  return (
    <div className="px-5 py-8">
      <Link
        to={isCoach ? "/app/desk" : "/app/progress"}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {isCoach ? "Back to desk" : "Back to progress"}
      </Link>
      <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">Growth</p>
      <h1 className="mt-2 font-display text-4xl">
        {role === "student" ? "How far you have come" : name}
      </h1>
      {sports.length > 1 ? (
        <div className="mt-4 flex gap-2">
          {sports.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === sport ? "default" : "secondary"}
              aria-pressed={s === sport}
              onClick={() => setSportPick(s)}
            >
              {sportLabel(s)}
            </Button>
          ))}
        </div>
      ) : null}

      <Card className="mt-6 border-primary/40">
        <ul className="grid gap-2">
          {highlights.map((line) => (
            <li key={line} className="text-base leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
        {role !== "coach" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Progress in tennis is slow to feel and fast to see on paper. When it feels like nothing
            is changing, read where you started.
          </p>
        ) : null}
      </Card>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">Where {role === "student" ? "you" : firstName} started</h2>
          {start ? (
            <span className="text-xs text-muted-foreground">
              {formatWall(start.assessed_on)} · {start.coach_name}
            </span>
          ) : null}
        </div>
        {form?.kind === "baseline" ? (
          <Card className="mt-3">
            <AssessmentForm
              studentId={student.user_id}
              sport={sport}
              kind="baseline"
              start={form.edit}
              onSaved={refresh}
              onCancel={() => setForm(null)}
            />
          </Card>
        ) : start ? (
          <Card className="mt-3">
            <StartingRead assessment={start} />
            {isCoach && start.coach_user_id === q.data.me ? (
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                onClick={() => setForm({ kind: start.kind, edit: start })}
              >
                Edit
              </Button>
            ) : null}
          </Card>
        ) : (
          <Card className="mt-3">
            <p className="text-sm text-muted-foreground">
              {isCoach
                ? `No starting point yet. Write down where ${firstName} is today — strengths, what they are working on, and the potential you see — so they can see how far they come.`
                : "Your coach has not written your starting point yet."}
            </p>
            {isCoach ? (
              <Button className="mt-4" size="sm" onClick={() => setForm({ kind: "baseline" })}>
                Write starting point
              </Button>
            ) : null}
          </Card>
        )}
      </section>

      {start ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl">Start vs now</h2>
            {latest ? (
              <span className="text-xs text-muted-foreground">Last check-in {formatWall(latest.assessed_on)}</span>
            ) : null}
          </div>
          <Card className="mt-3">
            {changes.length > 0 ? (
              <SkillBars rows={changes} />
            ) : (
              <p className="text-sm text-muted-foreground">No skills rated yet.</p>
            )}
            {!latest ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {isCoach
                  ? "Re-rate every month or so. The second set of numbers is what makes growth visible."
                  : "Your coach re-rates you every so often. The new numbers land beside the old ones."}
              </p>
            ) : null}
            {isCoach && form?.kind !== "checkin" ? (
              <Button className="mt-4" size="sm" onClick={() => setForm({ kind: "checkin" })}>
                Add check-in
              </Button>
            ) : null}
            {form?.kind === "checkin" ? (
              <AssessmentForm
                studentId={student.user_id}
                sport={sport}
                kind="checkin"
                start={form.edit}
                onSaved={refresh}
                onCancel={() => setForm(null)}
              />
            ) : null}
          </Card>
          {checkins.length > 0 ? (
            <ul className="mt-3 grid gap-2">
              {[...checkins].reverse().map((c) => (
                <li key={c.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    Check-in · {formatWall(c.assessed_on)} · {c.coach_name}
                  </p>
                  {c.strengths ? <p className="mt-1">Grown: {c.strengths}</p> : null}
                  {c.weaknesses ? <p className="mt-1 text-muted-foreground">Next: {c.weaknesses}</p> : null}
                  {c.coach_only ? <p className="mt-1 text-xs text-muted-foreground">Coach only: {c.coach_only}</p> : null}
                  {isCoach && c.coach_user_id === q.data.me ? (
                    <button
                      type="button"
                      className="mt-2 text-xs underline text-muted-foreground"
                      onClick={() => setForm({ kind: "checkin", edit: c })}
                    >
                      Edit
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Belief, lesson by lesson</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From the two numbers picked after each lesson. Believing you can hit it comes first.
        </p>
        <Card className="mt-3">
          <BeliefChart points={points} />
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Every lesson</h2>
        {sportLessons.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No {sportLabel(sport).toLowerCase()} lessons yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {sportLessons.map((l) => (
              <li key={l.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatWall(l.starts_at)} · {l.coach_name} · {l.duration_min} min
                    </p>
                    {l.status !== "completed" ? <Badge variant="outline">{l.status.replace("_", " ")}</Badge> : null}
                  </div>
                  {l.notes ? (
                    <Block label="What we worked on" text={l.notes} />
                  ) : null}
                  {l.successes ? (
                    <Block label="What went right" text={l.successes} strong />
                  ) : null}
                  {l.reflection ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        {role === "student" ? "Your side" : `${firstName}'s side`}
                      </p>
                      <ReflectionRead reflection={l.reflection} />
                    </div>
                  ) : null}
                  <Link
                    to="/app/lessons/$id"
                    params={{ id: String(l.id) }}
                    className="mt-3 inline-block text-sm text-muted-foreground underline hover:text-foreground"
                  >
                    {l.reflection ? "Open lesson" : "Open lesson and write about it"}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StartingRead({ assessment }: { assessment: GrowthAssessment }) {
  const written = STARTING_FIELDS.filter((f) => assessment[f.key]);
  return (
    <div className="grid gap-4">
      {written.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ratings only.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {written.map((f) => (
            <Block key={f.key} label={f.label} text={assessment[f.key] ?? ""} />
          ))}
        </div>
      )}
      {assessment.coach_only ? <Block label="Coach only" text={assessment.coach_only} /> : null}
    </div>
  );
}

function Block({ label, text, strong }: { label: string; text: string; strong?: boolean }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={strong ? "mt-1 whitespace-pre-wrap text-base" : "mt-1 whitespace-pre-wrap text-sm leading-relaxed"}>
        {text}
      </p>
    </div>
  );
}
