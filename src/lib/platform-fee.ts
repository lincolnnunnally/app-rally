/**
 * Rally's platform fee — the only place percentages and the lesson cap live.
 * Env overrides win. Missing or invalid values fall back to the defaults.
 *
 * Lessons: percent of each paid lesson, capped per coach per calendar month.
 * Once recorded fees for that month reach the cap, further lessons are 0.
 * The last lesson can take a partial fee so the month lands on the cap.
 * Courts and leagues: percent, no cap.
 * A $0 charge is always a $0 fee.
 */

export type FeeSource = "lesson" | "court" | "league";

export type PlatformFeeConfig = {
  lessonPct: number;
  lessonCapCents: number;
  courtPct: number;
  leaguePct: number;
  /** IANA zone for the coach's calendar month. Vidalia is Eastern. */
  timeZone: string;
};

export const PLATFORM_FEE_DEFAULTS: PlatformFeeConfig = {
  lessonPct: 5,
  lessonCapCents: 5000,
  courtPct: 5,
  leaguePct: 5,
  timeZone: "America/New_York",
};

export type EnvLike = Record<string, string | undefined>;

export function readPlatformFeeConfig(env: EnvLike = process.env): PlatformFeeConfig {
  return {
    lessonPct: readPct(env.PLATFORM_FEE_LESSON_PCT, PLATFORM_FEE_DEFAULTS.lessonPct),
    lessonCapCents: readCents(
      env.PLATFORM_FEE_LESSON_CAP_CENTS,
      PLATFORM_FEE_DEFAULTS.lessonCapCents,
    ),
    courtPct: readPct(env.PLATFORM_FEE_COURT_PCT, PLATFORM_FEE_DEFAULTS.courtPct),
    leaguePct: readPct(env.PLATFORM_FEE_LEAGUE_PCT, PLATFORM_FEE_DEFAULTS.leaguePct),
    timeZone: readTimeZone(env.PLATFORM_FEE_TIMEZONE),
  };
}

export function percentOfCents(grossCents: number, pct: number): number {
  if (!Number.isFinite(grossCents) || !Number.isFinite(pct)) return 0;
  if (grossCents <= 0 || pct <= 0) return 0;
  return Math.round((grossCents * pct) / 100);
}

export function platformFeeCents(input: {
  source: FeeSource;
  grossCents: number;
  /** Lesson fees already recorded for this coach in this calendar month. */
  recordedLessonFeesCents: number;
  config: PlatformFeeConfig;
}): { feeCents: number; capped: boolean } {
  const gross = Math.max(0, Math.trunc(input.grossCents));
  if (gross <= 0) return { feeCents: 0, capped: false };

  if (input.source === "court") {
    return { feeCents: Math.min(gross, percentOfCents(gross, input.config.courtPct)), capped: false };
  }
  if (input.source === "league") {
    return { feeCents: Math.min(gross, percentOfCents(gross, input.config.leaguePct)), capped: false };
  }

  const uncapped = Math.min(gross, percentOfCents(gross, input.config.lessonPct));
  const recorded = Math.max(0, Math.trunc(input.recordedLessonFeesCents));
  const room = Math.max(0, input.config.lessonCapCents - recorded);
  const feeCents = Math.min(uncapped, room);
  return { feeCents, capped: feeCents < uncapped };
}

/** `YYYY-MM` in the fee timezone. */
export function monthKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("Could not resolve the calendar month.");
  return `${year}-${month}`;
}

function readPct(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}

function readCents(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function readTimeZone(raw: string | undefined): string {
  const tz = raw?.trim() || PLATFORM_FEE_DEFAULTS.timeZone;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return PLATFORM_FEE_DEFAULTS.timeZone;
  }
}
