/**
 * Student growth: a starting point, later check-ins, and the student's own
 * reflection after each lesson. Pure helpers only; the doors live in
 * `growth-server.ts`. Coach notes and successes stay on `lessons`.
 *
 * The point is that the student can see it. Growth is often invisible from
 * inside one lesson — this lays the first day beside today.
 */

export const GROWTH_TEXT_MAX = 600;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export type GrowthSport = "tennis" | "pickleball";
export type AssessmentKind = "baseline" | "checkin";

export const SKILLS: Record<GrowthSport, { key: string; label: string }[]> = {
  tennis: [
    { key: "forehand", label: "Forehand" },
    { key: "backhand", label: "Backhand" },
    { key: "serve", label: "Serve" },
    { key: "return", label: "Return" },
    { key: "volley", label: "Volley / net" },
    { key: "footwork", label: "Footwork" },
    { key: "consistency", label: "Rally consistency" },
    { key: "match_play", label: "Match play" },
    { key: "confidence", label: "Confidence" },
  ],
  pickleball: [
    { key: "serve", label: "Serve" },
    { key: "return", label: "Return" },
    { key: "dink", label: "Dink" },
    { key: "third_shot", label: "Third shot" },
    { key: "volley", label: "Volley / hands" },
    { key: "reset", label: "Reset" },
    { key: "footwork", label: "Footwork" },
    { key: "match_play", label: "Match play" },
    { key: "confidence", label: "Confidence" },
  ],
};

export const RATING_WORDS = ["", "Just starting", "Learning", "Getting it", "Solid", "Weapon"] as const;

/** SWOT, worded for a player rather than a business. */
export const STARTING_FIELDS = [
  {
    key: "strengths",
    label: "Strengths",
    helper: "What they already do well. Athletic, coachable, a natural swing, loves to compete.",
  },
  {
    key: "weaknesses",
    label: "Working on",
    helper: "What is not there yet. Late contact, no second serve, rushes between points.",
  },
  {
    key: "opportunities",
    label: "Opportunities",
    helper: "Where the fastest growth is. One fix that unlocks a lot.",
  },
  {
    key: "threats",
    label: "What gets in the way",
    helper: "Doubt, fear of looking bad, time, an old habit, an injury.",
  },
  {
    key: "potential",
    label: "Potential",
    helper: "What you see they can become. Say it plainly — they will read this.",
  },
  {
    key: "goals",
    label: "Their goals",
    helper: "In their words. Play a match, beat a friend, rally twenty balls, make a team.",
  },
] as const;

export type StartingKey = (typeof STARTING_FIELDS)[number]["key"];

/**
 * After a lesson. The last two are belief work: proof they have grown, and a
 * picture of the next good shot. Belief that you can hit it comes before hitting it.
 */
export const REFLECTION_FIELDS = [
  {
    key: "did",
    label: "What I worked on",
    helper: "The shots, drills, or points from today.",
  },
  {
    key: "felt",
    label: "How it felt",
    helper: "In the body and in the head. Loose, tight, tired, fun, frustrated — all of it counts.",
  },
  {
    key: "thought",
    label: "What I was thinking",
    helper: "What you told yourself out there. Write it the way you said it.",
  },
  {
    key: "proof",
    label: "Something I can do now that I could not before",
    helper: "Even small. A ball you got back, a grip that feels normal, one more shot in a rally.",
  },
  {
    key: "see_next",
    label: "See it",
    helper:
      "Close your eyes. Picture one shot from next time going exactly where you want. Describe it.",
  },
] as const;

export type ReflectionKey = (typeof REFLECTION_FIELDS)[number]["key"];

export const CONFIDENCE_LABEL = "I believe I can hit the shot we worked on";
export const BELIEF_LABEL = "I believe I am getting better";

export type Ratings = Record<string, number>;

export function clampRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < RATING_MIN || r > RATING_MAX) return null;
  return r;
}

export function parseRatings(raw: unknown): Ratings {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: Ratings = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!/^[a-z_]{1,32}$/.test(key)) continue;
    const r = clampRating(value);
    if (r != null) out[key] = r;
  }
  return out;
}

export function ratingsToText(ratings: Ratings, sport: GrowthSport) {
  const out: Ratings = {};
  for (const skill of SKILLS[sport]) {
    const r = clampRating(ratings[skill.key]);
    if (r != null) out[skill.key] = r;
  }
  return JSON.stringify(out);
}

export function asGrowthSport(value: unknown): GrowthSport {
  return value === "pickleball" ? "pickleball" : "tennis";
}

export type AssessmentRow = {
  id: number;
  sport: GrowthSport;
  kind: AssessmentKind;
  assessed_on: string;
  ratings: Ratings;
};

/** The first baseline for a sport, else the earliest rating of any kind. */
export function startingPoint<T extends AssessmentRow>(rows: readonly T[], sport: GrowthSport): T | null {
  const mine = sortByDate(rows.filter((r) => r.sport === sport));
  return mine.find((r) => r.kind === "baseline") ?? mine[0] ?? null;
}

/** The most recent rating for a sport that is not the starting point. */
export function latestCheckin<T extends AssessmentRow>(rows: readonly T[], sport: GrowthSport): T | null {
  const start = startingPoint(rows, sport);
  const mine = sortByDate(rows.filter((r) => r.sport === sport && r.id !== start?.id));
  return mine[mine.length - 1] ?? null;
}

function sortByDate<T extends AssessmentRow>(rows: T[]) {
  return [...rows].sort((a, b) =>
    a.assessed_on === b.assessed_on ? a.id - b.id : a.assessed_on < b.assessed_on ? -1 : 1,
  );
}

export type SkillChange = { key: string; label: string; from: number | null; to: number | null; delta: number };

export function skillChanges(
  start: Ratings | null | undefined,
  now: Ratings | null | undefined,
  sport: GrowthSport,
): SkillChange[] {
  return SKILLS[sport]
    .map((skill) => {
      const from = start?.[skill.key] ?? null;
      const to = now?.[skill.key] ?? null;
      return {
        key: skill.key,
        label: skill.label,
        from,
        to,
        delta: from != null && to != null ? to - from : 0,
      };
    })
    .filter((c) => c.from != null || c.to != null);
}

export type ReflectionPoint = {
  lesson_id: number;
  date: string;
  confidence: number | null;
  belief: number | null;
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Early vs recent average of a 1-5 score. Needs at least four scored lessons. */
export function scoreTrend(points: readonly ReflectionPoint[], key: "confidence" | "belief") {
  const scored = [...points]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.lesson_id - b.lesson_id))
    .map((p) => p[key])
    .filter((v): v is number => v != null);
  if (scored.length < 4) return null;
  const size = Math.min(3, Math.floor(scored.length / 2));
  const early = average(scored.slice(0, size)) ?? 0;
  const recent = average(scored.slice(-size)) ?? 0;
  return { early: round1(early), recent: round1(recent), delta: round1(recent - early), n: scored.length };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Plain sentences the student reads at the top of their growth page. The
 * answer to "am I getting any better?" — built only from what is on file.
 */
export function growthHighlights(opts: {
  lessonsDone: number;
  firstLessonDate: string | null;
  successesCount: number;
  changes: SkillChange[];
  points: ReflectionPoint[];
}): string[] {
  const out: string[] = [];
  if (opts.lessonsDone > 0) {
    out.push(
      opts.firstLessonDate
        ? `${opts.lessonsDone} ${opts.lessonsDone === 1 ? "lesson" : "lessons"} since ${opts.firstLessonDate}. Every one is on file.`
        : `${opts.lessonsDone} ${opts.lessonsDone === 1 ? "lesson" : "lessons"} on file.`,
    );
  }
  const up = opts.changes.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta);
  if (up.length > 0) {
    const named = up
      .slice(0, 3)
      .map((c) => `${c.label} ${c.from} → ${c.to}`)
      .join(", ");
    out.push(`Better than where you started: ${named}.`);
  }
  if (opts.successesCount > 0) {
    out.push(
      `Your coach has written down ${opts.successesCount} ${opts.successesCount === 1 ? "lesson" : "lessons"} worth of things that went right.`,
    );
  }
  const conf = scoreTrend(opts.points, "confidence");
  if (conf && conf.delta > 0) {
    out.push(`Your confidence went from ${conf.early} to ${conf.recent} out of 5.`);
  }
  const belief = scoreTrend(opts.points, "belief");
  if (belief && belief.delta > 0) {
    out.push(`You believe you are improving more than you did at first: ${belief.early} → ${belief.recent}.`);
  }
  if (out.length === 0) {
    out.push(
      "This is day one on the page. Your coach writes where you start; after each lesson you add how it went. The thread shows up fast.",
    );
  }
  return out;
}

/** Who may read a student's growth page. Coach notes marked coach-only are handled separately. */
export function growthRole(opts: {
  actorId: string;
  studentId: string;
  isGuardian: boolean;
  isCoach: boolean;
}): "coach" | "student" | "guardian" | null {
  if (!opts.actorId || !opts.studentId) return null;
  if (opts.isCoach) return "coach";
  if (opts.actorId === opts.studentId) return "student";
  if (opts.isGuardian) return "guardian";
  return null;
}

export function reflectionEditable(status: string) {
  return status === "confirmed" || status === "checked_in" || status === "completed";
}

/** Trim and clip a free-text field; blank becomes null. */
export function cleanText(value: unknown, max = GROWTH_TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  return text || null;
}

export function growthPath(studentId: string) {
  return `/app/students/${encodeURIComponent(studentId)}`;
}
