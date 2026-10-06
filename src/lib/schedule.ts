/**
 * Lesson scheduling on the existing lessons rows (series_id + starts_at).
 * starts_at is a timestamp without time zone: local wall-clock time in `timezone`.
 * Weekly slots are calendar weeks, so a clock time stays 8:00 across DST.
 */

export const DEFAULT_LESSON_TIMEZONE = "America/New_York";
export const STANDING_HORIZON_WEEKS = 12;
export const SERIES_EXTEND_MAX_WEEKS = 52;
export const DEFAULT_WEATHER_REASON = "Canceled for weather.";

export const LESSON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
] as const;

const OPEN = new Set(["requested", "confirmed", "checked_in"]);

export type ScheduleOccurrence = {
  id: number;
  series_id: string | null;
  starts_at: string;
  cadence_at: string | null;
  coach_user_id: string;
  player_user_id: string;
  status: string;
};

export function lessonTimeZone(value: string | null | undefined): string {
  const tz = (value ?? "").trim();
  if (!tz) return DEFAULT_LESSON_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_LESSON_TIMEZONE;
  }
}

export function normalizeStamp(raw: string): string {
  const clean = raw
    .trim()
    .replace("T", " ")
    .replace(/\.\d+(?:Z|[+-]\d{2}:?\d{2})?$/, "");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(clean);
  if (!match) throw new Error("Use a real date and time.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  const second = Number(match[6] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new Error("Use a real date and time.");
  }
  const probed = new Date(Date.UTC(year, month - 1, day));
  if (
    probed.getUTCFullYear() !== year ||
    probed.getUTCMonth() !== month - 1 ||
    probed.getUTCDate() !== day
  ) {
    throw new Error("Use a real date and time.");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${match[1]}-${match[2]}-${match[3]} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function stampDate(stamp: string): string {
  return normalizeStamp(stamp).slice(0, 10);
}

export function stampTime(stamp: string): string {
  return normalizeStamp(stamp).slice(11, 19);
}

/** Add calendar days. The clock string is copied, so DST cannot move 8:00 to 7:00. */
export function addLocalDays(stamp: string, days: number): string {
  const norm = normalizeStamp(stamp);
  const [year, month, day] = norm.slice(0, 10).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())} ${norm.slice(11, 19)}`;
}

export function addLocalWeeks(stamp: string, weeks: number): string {
  return addLocalDays(stamp, weeks * 7);
}

export function weeklyStamps(anchor: string, count: number): string[] {
  if (count < 1) return [];
  const start = normalizeStamp(anchor);
  return Array.from({ length: count }, (_, index) => addLocalWeeks(start, index));
}

export function setWallTime(stamp: string, hhmm: string): string {
  const norm = normalizeStamp(stamp);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm.trim());
  if (!match) throw new Error("Use a time like 8:00.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) throw new Error("Use a time like 8:00.");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${norm.slice(0, 10)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function cadenceOf(row: Pick<ScheduleOccurrence, "starts_at" | "cadence_at">): string {
  return normalizeStamp(row.cadence_at || row.starts_at);
}

export function isOpenLesson(status: string): boolean {
  return OPEN.has(status);
}

/**
 * Move one lesson's starts_at. Sibling rows are returned unchanged.
 * cadence_at keeps the series pattern (the old starts_at, when cadence was empty).
 */
export function moveSingleLesson<T extends ScheduleOccurrence>(
  rows: T[],
  id: number,
  nextStartsAt: string,
): T[] {
  const next = normalizeStamp(nextStartsAt);
  let found = false;
  const moved = rows.map((row) => {
    if (row.id !== id) return row;
    found = true;
    if (!isOpenLesson(row.status)) throw new Error("That lesson is already closed.");
    return {
      ...row,
      starts_at: next,
      cadence_at: normalizeStamp(row.cadence_at || row.starts_at),
    };
  });
  if (!found) throw new Error("Lesson not found");
  return moved;
}

/**
 * Set the wall-clock time on series rows whose on-pattern date is on or after `fromDate`.
 * Earlier occurrences stay put. Closed rows stay put. The calendar date of each row stays.
 */
export function shiftSeriesFromDate<T extends ScheduleOccurrence>(
  rows: T[],
  seriesId: string,
  fromDate: string,
  newTime: string,
): T[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate))
    throw new Error("Pick the first date that should move.");
  return rows.map((row) => {
    if (row.series_id !== seriesId) return row;
    const basis = cadenceOf(row);
    if (stampDate(basis) < fromDate) return row;
    if (!isOpenLesson(row.status)) return row;
    return {
      ...row,
      starts_at: setWallTime(row.starts_at, newTime),
      cadence_at: setWallTime(basis, newTime),
    };
  });
}

export function horizonThroughDate(asOfDate: string, weeks = STANDING_HORIZON_WEEKS): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("Use a real date.");
  return stampDate(addLocalWeeks(`${asOfDate} 00:00:00`, weeks));
}

/** Weekly slots after the latest on-pattern lesson, through asOf + horizon weeks. */
export function topUpStandingSlots(opts: {
  existingCadence: string[];
  asOfDate: string;
  horizonWeeks?: number;
}): string[] {
  if (opts.existingCadence.length === 0) return [];
  const sorted = opts.existingCadence.map((stamp) => normalizeStamp(stamp)).sort();
  const last = sorted[sorted.length - 1]!;
  const through = horizonThroughDate(opts.asOfDate, opts.horizonWeeks ?? STANDING_HORIZON_WEEKS);
  if (stampDate(last) >= through) return [];
  const taken = new Set(sorted.map((stamp) => stampDate(stamp)));
  const out: string[] = [];
  for (let week = 1; week < 200; week += 1) {
    const slot = addLocalWeeks(last, week);
    if (stampDate(slot) > through) break;
    if (!taken.has(stampDate(slot))) out.push(slot);
  }
  return out;
}

export function extendAfterLast(existingCadence: string[], extraWeeks: number): string[] {
  if (extraWeeks < 1) return [];
  if (extraWeeks > SERIES_EXTEND_MAX_WEEKS) {
    throw new Error(`Extend up to ${SERIES_EXTEND_MAX_WEEKS} weeks at a time.`);
  }
  if (existingCadence.length === 0) throw new Error("This series has no lessons to extend.");
  const last = existingCadence
    .map((stamp) => normalizeStamp(stamp))
    .sort()
    .at(-1)!;
  return Array.from({ length: extraWeeks }, (_, index) => addLocalWeeks(last, index + 1));
}

export function renewWeekCount(existingCount: number): number {
  if (existingCount < 1) throw new Error("This series has no lessons to renew.");
  return Math.min(existingCount, SERIES_EXTEND_MAX_WEEKS);
}

export function weatherReason(input: string | null | undefined): string {
  const text = (input ?? "").trim();
  return text || DEFAULT_WEATHER_REASON;
}

export function weatherCancelIds(
  rows: { id: number; coach_user_id: string; starts_at: string; status: string }[],
  coachId: string,
  day: string,
): number[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Pick a day.");
  return rows
    .filter((row) => row.coach_user_id === coachId)
    .filter((row) => stampDate(row.starts_at) === day)
    .filter((row) => isOpenLesson(row.status))
    .map((row) => row.id);
}

/** Coach actions notify the player. Player or guardian actions notify the coach. */
export function noticeTarget(actorId: string, coachId: string, playerId: string): string | null {
  if (actorId === coachId) return actorId === playerId ? null : playerId;
  return coachId;
}

export type ScheduleNotice = {
  userId: string;
  title: string;
  body: string;
  href: string;
};

export function singleMoveNotice(opts: {
  actorId: string;
  coachId: string;
  playerId: string;
  lessonId: number;
  whenLabel: string;
}): ScheduleNotice | null {
  const userId = noticeTarget(opts.actorId, opts.coachId, opts.playerId);
  if (!userId) return null;
  return {
    userId,
    title: "Lesson rescheduled",
    body: `One lesson moved to ${opts.whenLabel}. The rest of the series stays put.`,
    href: `/app/lessons/${opts.lessonId}`,
  };
}

export function seriesShiftNotice(opts: {
  actorId: string;
  coachId: string;
  playerId: string;
  lessonId: number;
  fromDate: string;
  timeLabel: string;
}): ScheduleNotice | null {
  const userId = noticeTarget(opts.actorId, opts.coachId, opts.playerId);
  if (!userId) return null;
  return {
    userId,
    title: "Series rescheduled",
    body: `Lessons on ${opts.fromDate} and after move to ${opts.timeLabel}. Earlier ones stay put.`,
    href: `/app/lessons/${opts.lessonId}`,
  };
}

export function weatherCancelNotices(
  rows: {
    id: number;
    coach_user_id: string;
    player_user_id: string;
    starts_at: string;
    status: string;
  }[],
  coachId: string,
  day: string,
  reason: string,
): ScheduleNotice[] {
  const ids = new Set(weatherCancelIds(rows, coachId, day));
  const seen = new Set<string>();
  const notices: ScheduleNotice[] = [];
  for (const row of rows) {
    if (!ids.has(row.id)) continue;
    const userId = noticeTarget(coachId, row.coach_user_id, row.player_user_id);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    notices.push({
      userId,
      title: "Lesson canceled",
      body: `${day}: ${reason}`,
      href: `/app/lessons/${row.id}`,
    });
  }
  return notices;
}

/** Offset of a wall-clock stamp in an IANA zone, in minutes east of UTC. */
export function offsetMinutes(stamp: string, timeZone: string): number {
  const norm = normalizeStamp(stamp);
  const zone = lessonTimeZone(timeZone);
  const [date, time] = norm.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wallAsUtc;
  for (let pass = 0; pass < 3; pass += 1) {
    utc = wallAsUtc - zoneOffsetMs(new Date(utc), zone);
  }
  return Math.round((wallAsUtc - utc) / 60000);
}

export function todayInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: lessonTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const bag: Record<string, string> = {};
  for (const part of parts) bag[part.type] = part.value;
  return `${bag.year}-${bag.month}-${bag.day}`;
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const bag: Record<string, string> = {};
  for (const part of parts) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    hour,
    Number(bag.minute),
    Number(bag.second),
  );
  return asUtc - instant.getTime();
}
