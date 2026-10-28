import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BELIEF_LABEL,
  CONFIDENCE_LABEL,
  GROWTH_TEXT_MAX,
  RATING_MAX,
  RATING_WORDS,
  REFLECTION_FIELDS,
  SKILLS,
  STARTING_FIELDS,
  type GrowthSport,
  type Ratings,
  type ReflectionKey,
  type ReflectionPoint,
  type StartingKey,
} from "@/lib/growth";
import {
  getLessonReflection,
  saveAssessment,
  saveLessonReflection,
  type GrowthAssessment,
  type GrowthReflection,
} from "@/lib/growth-server";
import { todayISO } from "@/lib/session-journal";
import { cn } from "@/lib/utils";

/** 1-5 picker. Tap the same number again to clear it. */
export function ScorePicker({
  label,
  value,
  onChange,
  words,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  words?: readonly string[];
}) {
  return (
    <div>
      <p className="text-sm">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            title={words?.[n]}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm tabular-nums transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {words && value ? <p className="mt-1 text-xs text-muted-foreground">{words[value]}</p> : null}
    </div>
  );
}

/** The student's side of a lesson: what they did, felt, thought, and believe. */
export function LessonReflectionCard({ lessonId }: { lessonId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lesson-reflection", lessonId],
    queryFn: () => getLessonReflection({ data: { lesson_id: lessonId } }),
  });
  const [editing, setEditing] = useState(false);
  if (!q.data) return null;
  const { reflection, canEdit, role, student_id } = q.data;
  const open = editing || (!reflection && canEdit);

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          {role === "coach" ? "Their side of the lesson" : "Your side of the lesson"}
        </p>
        <Link
          to="/app/students/$id"
          params={{ id: student_id }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          See growth
        </Link>
      </div>
      {open ? (
        <ReflectionForm
          lessonId={lessonId}
          role={role}
          start={reflection}
          onSaved={() => {
            setEditing(false);
            void qc.invalidateQueries({ queryKey: ["lesson-reflection", lessonId] });
            void qc.invalidateQueries({ queryKey: ["growth"] });
          }}
          onCancel={reflection ? () => setEditing(false) : undefined}
        />
      ) : reflection ? (
        <>
          <ReflectionRead reflection={reflection} />
          {canEdit ? (
            <Button className="mt-4" size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing written for this lesson.</p>
      )}
    </Card>
  );
}

function ReflectionForm({
  lessonId,
  role,
  start,
  onSaved,
  onCancel,
}: {
  lessonId: number;
  role: "coach" | "player" | "guardian";
  start: GrowthReflection | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<ReflectionKey, string>>(() => ({
    did: start?.did ?? "",
    felt: start?.felt ?? "",
    thought: start?.thought ?? "",
    proof: start?.proof ?? "",
    see_next: start?.see_next ?? "",
  }));
  const [confidence, setConfidence] = useState<number | null>(start?.confidence ?? null);
  const [belief, setBelief] = useState<number | null>(start?.belief ?? null);
  const save = useMutation({
    mutationFn: () => saveLessonReflection({ data: { lesson_id: lessonId, ...answers, confidence, belief } }),
    onSuccess: () => {
      toast.success("Saved. It is on the growth page now.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-3 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {role === "coach"
          ? "Talk it through together, then write it down in their words."
          : "A few lines while it is fresh. Your coach reads this before next time."}
      </p>
      {REFLECTION_FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={`reflect-${field.key}`} className="text-sm font-medium">
            {field.label}
          </label>
          <p id={`reflect-${field.key}-help`} className="mt-1 text-xs text-muted-foreground">
            {field.helper}
          </p>
          <Textarea
            id={`reflect-${field.key}`}
            className="mt-2"
            aria-describedby={`reflect-${field.key}-help`}
            maxLength={GROWTH_TEXT_MAX}
            value={answers[field.key]}
            onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
          />
        </div>
      ))}
      <ScorePicker label={CONFIDENCE_LABEL} value={confidence} onChange={setConfidence} />
      <ScorePicker label={BELIEF_LABEL} value={belief} onChange={setBelief} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ReflectionRead({ reflection }: { reflection: GrowthReflection }) {
  return (
    <div className="mt-2 grid gap-3">
      {REFLECTION_FIELDS.map((field) =>
        reflection[field.key] ? (
          <div key={field.key}>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{field.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{reflection[field.key]}</p>
          </div>
        ) : null,
      )}
      {reflection.confidence != null || reflection.belief != null ? (
        <p className="text-sm text-muted-foreground">
          {reflection.confidence != null ? `Shot belief ${reflection.confidence}/5` : null}
          {reflection.confidence != null && reflection.belief != null ? " · " : null}
          {reflection.belief != null ? `Getting better ${reflection.belief}/5` : null}
        </p>
      ) : null}
    </div>
  );
}

/** Coach writes a starting point (SWOT + ratings) or a later check-in. */
export function AssessmentForm({
  studentId,
  sport: startSport,
  kind,
  start,
  onSaved,
  onCancel,
}: {
  studentId: string;
  sport: GrowthSport;
  kind: "baseline" | "checkin";
  start?: GrowthAssessment | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [sport, setSport] = useState<GrowthSport>(start?.sport ?? startSport);
  const [date, setDate] = useState(start?.assessed_on ?? todayISO());
  const [ratings, setRatings] = useState<Ratings>(start?.ratings ?? {});
  const [notes, setNotes] = useState<Record<StartingKey | "coach_only", string>>(() => ({
    strengths: start?.strengths ?? "",
    weaknesses: start?.weaknesses ?? "",
    opportunities: start?.opportunities ?? "",
    threats: start?.threats ?? "",
    potential: start?.potential ?? "",
    goals: start?.goals ?? "",
    coach_only: start?.coach_only ?? "",
  }));
  const save = useMutation({
    mutationFn: () =>
      saveAssessment({
        data: {
          id: start?.id,
          student_id: studentId,
          sport,
          kind,
          assessed_on: date,
          ratings,
          ...notes,
        },
      }),
    onSuccess: () => {
      toast.success(kind === "baseline" ? "Starting point saved." : "Check-in saved.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-3 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          Sport
          <Select value={sport} onChange={(e) => setSport(e.target.value as GrowthSport)}>
            <option value="tennis">Tennis</option>
            <option value="pickleball">Pickleball</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Date
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-xs tracking-widest text-muted-foreground uppercase">
          Skills, 1 to 5
        </legend>
        <p className="text-xs text-muted-foreground">
          1 just starting · 2 learning · 3 getting it · 4 solid · 5 weapon. Skip what you have not seen.
        </p>
        {SKILLS[sport].map((skill) => (
          <ScorePicker
            key={skill.key}
            label={skill.label}
            words={RATING_WORDS}
            value={ratings[skill.key] ?? null}
            onChange={(n) =>
              setRatings((r) => {
                const next = { ...r };
                if (n == null) delete next[skill.key];
                else next[skill.key] = n;
                return next;
              })
            }
          />
        ))}
      </fieldset>

      {kind === "baseline" ? (
        STARTING_FIELDS.map((field) => (
          <NoteField
            key={field.key}
            id={`assess-${field.key}`}
            label={field.label}
            helper={field.helper}
            value={notes[field.key]}
            onChange={(v) => setNotes((n) => ({ ...n, [field.key]: v }))}
          />
        ))
      ) : (
        <>
          <NoteField
            id="assess-strengths"
            label="What has grown"
            helper="Name it plainly. They will read this."
            value={notes.strengths}
            onChange={(v) => setNotes((n) => ({ ...n, strengths: v }))}
          />
          <NoteField
            id="assess-weaknesses"
            label="Still working on"
            helper="The next target, not a grade."
            value={notes.weaknesses}
            onChange={(v) => setNotes((n) => ({ ...n, weaknesses: v }))}
          />
        </>
      )}
      <NoteField
        id="assess-coach-only"
        label="Coach only"
        helper="Only you see this. The student and parents never do."
        value={notes.coach_only}
        onChange={(v) => setNotes((n) => ({ ...n, coach_only: v }))}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : kind === "baseline" ? "Save starting point" : "Save check-in"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function NoteField({
  id,
  label,
  helper,
  value,
  onChange,
}: {
  id: string;
  label: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
        {helper}
      </p>
      <Textarea
        id={id}
        className="mt-2"
        aria-describedby={`${id}-help`}
        maxLength={GROWTH_TEXT_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Start vs now, one bar pair per skill. */
export function SkillBars({
  rows,
}: {
  rows: { key: string; label: string; from: number | null; to: number | null }[];
}) {
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {row.from ?? "–"} → {row.to ?? "–"}
            </span>
          </div>
          <div className="mt-1 grid gap-1">
            <Bar value={row.from} className="bg-muted-foreground/40" label="Start" />
            {row.to != null ? <Bar value={row.to} className="bg-primary" label="Now" /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Bar({ value, className, label }: { value: number | null; className: string; label: string }) {
  const pct = value == null ? 0 : (value / RATING_MAX) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", className)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Confidence and belief per lesson, oldest left. Plain SVG, no chart library. */
export function BeliefChart({ points }: { points: ReflectionPoint[] }) {
  const sorted = [...points]
    .filter((p) => p.confidence != null || p.belief != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.lesson_id - b.lesson_id));
  if (sorted.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        After two lessons with a number picked, the line shows up here.
      </p>
    );
  }
  const w = 320;
  const h = 120;
  const pad = 12;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (sorted.length - 1);
  const y = (v: number) => h - pad - ((v - 1) * (h - pad * 2)) / (RATING_MAX - 1);
  const line = (key: "confidence" | "belief") =>
    sorted
      .map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key] as number)}`))
      .filter(Boolean)
      .join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-32 w-full"
        role="img"
        aria-label="Shot belief and getting-better scores by lesson"
      >
        {[1, 3, 5].map((v) => (
          <g key={v}>
            <line x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
            <text x={0} y={y(v) + 3} className="fill-muted-foreground text-[8px]">
              {v}
            </text>
          </g>
        ))}
        <polyline points={line("confidence")} fill="none" className="stroke-primary" strokeWidth={2} />
        <polyline
          points={line("belief")}
          fill="none"
          className="stroke-foreground"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        {sorted.map((p, i) =>
          p.confidence != null ? (
            <circle key={p.lesson_id} cx={x(i)} cy={y(p.confidence)} r={3} className="fill-primary" />
          ) : null,
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-primary" /> {CONFIDENCE_LABEL}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-foreground" />{" "}
          {BELIEF_LABEL}
        </span>
      </figcaption>
    </figure>
  );
}
