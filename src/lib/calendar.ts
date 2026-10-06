/**
 * Personal lesson calendars.
 * starts_at stays a wall-clock timestamp. DTSTART/DTEND use lessons.timezone
 * (TZID + VTIMEZONE). Duration is added on that wall clock, so 8:00–9:00
 * stays 8:00–9:00 across DST.
 */

import {
  DEFAULT_LESSON_TIMEZONE,
  addLocalDays,
  addLocalWeeks,
  lessonTimeZone,
  normalizeStamp,
  offsetMinutes,
  stampDate,
  todayInZone,
} from "./schedule.ts";

export const CALENDAR_PAST_DAYS = 14;
export const CALENDAR_FUTURE_WEEKS = 12;
export const CALENDAR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const CRLF = "\r\n";

export type FeedRole = "coach" | "player" | "any";

export type FeedLesson = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: string;
  cancelReason: string | null;
  courtName: string | null;
  coachName: string;
  playerName: string;
  coachUserId: string;
  playerUserId: string;
  guardianUserId: string | null;
  sport: string;
  serviceName: string | null;
  timezone: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  notes: string | null;
};

export type CalendarFeed = {
  userId: string;
  token: string;
};

type ZoneRule = {
  standard: number;
  daylight: number | null;
  standardName: string;
  daylightName: string | null;
  standardLabel: string;
  daylightLabel: string | null;
};

/** US zones Rally offers, plus Arizona (no DST). Offsets are minutes east of UTC. */
const ZONE_RULES: Record<string, ZoneRule> = {
  "America/New_York": {
    standard: -300,
    daylight: -240,
    standardName: "EST",
    daylightName: "EDT",
    standardLabel: "-0500",
    daylightLabel: "-0400",
  },
  "America/Chicago": {
    standard: -360,
    daylight: -300,
    standardName: "CST",
    daylightName: "CDT",
    standardLabel: "-0600",
    daylightLabel: "-0500",
  },
  "America/Denver": {
    standard: -420,
    daylight: -360,
    standardName: "MST",
    daylightName: "MDT",
    standardLabel: "-0700",
    daylightLabel: "-0600",
  },
  "America/Phoenix": {
    standard: -420,
    daylight: null,
    standardName: "MST",
    daylightName: null,
    standardLabel: "-0700",
    daylightLabel: null,
  },
  "America/Los_Angeles": {
    standard: -480,
    daylight: -420,
    standardName: "PST",
    daylightName: "PDT",
    standardLabel: "-0800",
    daylightLabel: "-0700",
  },
};

export function isCalendarToken(token: string): boolean {
  return CALENDAR_TOKEN_PATTERN.test(token);
}

export function newCalendarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function calendarPath(token: string): string {
  return `/api/calendar/${token}.ics`;
}

export function rotateCalendarFeed(
  feeds: readonly CalendarFeed[],
  userId: string,
  token = newCalendarToken(),
): { feeds: CalendarFeed[]; token: string } {
  if (!isCalendarToken(token)) throw new Error("Calendar token is not valid.");
  return {
    token,
    feeds: [...feeds.filter((feed) => feed.userId !== userId), { userId, token }],
  };
}

export function resolveCalendarUser(feeds: readonly CalendarFeed[], token: string): string | null {
  if (!isCalendarToken(token)) return null;
  const hits = feeds.filter((feed) => feed.token === token);
  return hits.length === 1 ? hits[0]!.userId : null;
}

export function feedWindow(asOfDate: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) throw new Error("Use a real date.");
  return {
    start: stampDate(addLocalDays(`${asOfDate} 00:00:00`, -CALENDAR_PAST_DAYS)),
    end: stampDate(addLocalWeeks(`${asOfDate} 00:00:00`, CALENDAR_FUTURE_WEEKS)),
  };
}

export function lessonInFeedWindow(startsAt: string, window: { start: string; end: string }): boolean {
  const day = lessonDay(startsAt);
  if (!day) return false;
  return day >= window.start && day <= window.end;
}

export function lessonMatchesRole(viewerId: string, lesson: FeedLesson, role: FeedRole): boolean {
  const asCoach = lesson.coachUserId === viewerId;
  const asPlayer = lesson.playerUserId === viewerId || lesson.guardianUserId === viewerId;
  if (role === "coach") return asCoach;
  if (role === "player") return asPlayer;
  return asCoach || asPlayer;
}

/** Lessons this user may see in the feed window. Declined rows stay off the calendar. */
export function selectFeedLessons(
  viewerId: string,
  lessons: readonly FeedLesson[],
  asOfDate: string,
  role: FeedRole = "any",
): FeedLesson[] {
  const window = feedWindow(asOfDate);
  return lessons
    .filter((lesson) => lesson.status !== "declined")
    .filter((lesson) => lessonMatchesRole(viewerId, lesson, role))
    .filter((lesson) => lessonInFeedWindow(lesson.startsAt, window))
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
}

export function lessonDay(startsAt: string): string | null {
  try {
    return stampDate(startsAt);
  } catch {
    return null;
  }
}

/** Monday of the week that contains `date` (Monday–Sunday). */
export function mondayOnOrBefore(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use a real date.");
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month! - 1 || utc.getUTCDate() !== day) {
    throw new Error("Use a real date.");
  }
  const dow = utc.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return stampDate(addLocalDays(`${date} 00:00:00`, delta));
}

export function weekDates(monday: string): string[] {
  const start = mondayOnOrBefore(monday);
  return Array.from({ length: 7 }, (_, index) =>
    stampDate(addLocalDays(`${start} 00:00:00`, index)),
  );
}

export function shiftWeek(monday: string, weeks: number): string {
  const start = mondayOnOrBefore(monday);
  return stampDate(addLocalWeeks(`${start} 00:00:00`, weeks));
}

export function lessonsOnDate<T extends { startsAt: string; id: number }>(
  lessons: readonly T[],
  date: string,
): T[] {
  return lessons
    .filter((lesson) => lessonDay(lesson.startsAt) === date)
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
}

export function formatWeekday(date: string): { weekday: string; monthDay: string } {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day));
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(utc),
    monthDay: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      utc,
    ),
  };
}

export function formatWeekRange(monday: string): string {
  const days = weekDates(monday);
  const start = formatWeekday(days[0]!);
  const end = formatWeekday(days[6]!);
  return `${start.monthDay} – ${end.monthDay}`;
}

/** US DST: second Sunday in March 02:00 through first Sunday in November 02:00. */
export function vtimezoneOffsetMinutes(timeZone: string, stamp: string): number {
  const zone = lessonTimeZone(timeZone);
  const rule = ZONE_RULES[zone];
  if (!rule) return offsetMinutes(stamp, zone);
  if (rule.daylight == null) return rule.standard;
  const norm = normalizeStamp(stamp);
  const [date, time] = norm.split(" ");
  const [year, month, day] = date!.split("-").map(Number);
  const [hour, minute, second] = time!.split(":").map(Number);
  const wall = Date.UTC(year!, month! - 1, day, hour, minute, second ?? 0);
  const startDay = nthSunday(year!, 3, 2);
  const endDay = nthSunday(year!, 11, 1);
  const dstStart = Date.UTC(year!, 2, startDay, 2, 0, 0);
  const dstEnd = Date.UTC(year!, 10, endDay, 2, 0, 0);
  if (wall >= dstStart && wall < dstEnd) return rule.daylight;
  return rule.standard;
}

export function namedZone(timeZone: string): string | null {
  const zone = lessonTimeZone(timeZone);
  return ZONE_RULES[zone] ? zone : null;
}

export function addWallMinutes(stamp: string, minutes: number): string {
  const norm = normalizeStamp(stamp);
  const [date, time] = norm.split(" ");
  const [year, month, day] = date!.split("-").map(Number);
  const [hour, minute, second] = time!.split(":").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day, hour, minute! + minutes, second ?? 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`;
}

export function wallToUtcDate(stamp: string, timeZone: string): Date {
  const norm = normalizeStamp(stamp);
  const [date, time] = norm.split(" ");
  const [year, month, day] = date!.split("-").map(Number);
  const [hour, minute, second] = time!.split(":").map(Number);
  const wallAsUtc = Date.UTC(year!, month! - 1, day, hour, minute, second ?? 0);
  const zone = namedZone(timeZone);
  const offset = zone ? vtimezoneOffsetMinutes(zone, norm) : offsetMinutes(norm, timeZone);
  return new Date(wallAsUtc - offset * 60_000);
}

export function formatIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function formatIcsLocal(stamp: string): string {
  const norm = normalizeStamp(stamp);
  return `${norm.slice(0, 10).replace(/-/g, "")}T${norm.slice(11, 19).replace(/:/g, "")}`;
}

export function parseUtcTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    ),
  );
}

export function lessonUid(id: number): string {
  return `lesson-${id}@rally`;
}

export function lessonSequence(lesson: Pick<FeedLesson, "updatedAt" | "createdAt">): number {
  const stamp = parseUtcTimestamp(lesson.updatedAt) ?? parseUtcTimestamp(lesson.createdAt);
  if (!stamp) return 0;
  return Math.floor(stamp.getTime() / 1000);
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545: fold at 75 octets. Continuation lines start with a single space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chars = Array.from(line);
  let total = 0;
  for (const char of chars) total += encoder.encode(char).length;
  if (total <= 75) return line;

  const parts: string[] = [];
  let buf = "";
  let bufBytes = 0;
  let limit = 75;
  for (const char of chars) {
    const size = encoder.encode(char).length;
    if (buf && bufBytes + size > limit) {
      parts.push(buf);
      buf = char;
      bufBytes = size;
      limit = 74;
    } else {
      buf += char;
      bufBytes += size;
    }
  }
  if (buf) parts.push(buf);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join(CRLF);
}

export function unfoldIcs(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

export function buildCalendar(
  lessons: readonly FeedLesson[],
  opts: { viewerId: string; now?: Date; origin?: string | null },
): string {
  const now = opts.now ?? new Date();
  const dtStamp = formatIcsUtc(now);
  const zones = new Set<string>();
  for (const lesson of lessons) {
    const zone = namedZone(lesson.timezone ?? DEFAULT_LESSON_TIMEZONE);
    if (zone) zones.add(zone);
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rally//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Rally lessons",
  ];
  for (const zone of [...zones].sort()) lines.push(...vtimezoneLines(zone));
  for (const lesson of lessons) lines.push(...eventLines(lesson, opts.viewerId, dtStamp, opts.origin));
  lines.push("END:VCALENDAR");
  return `${lines.map((line) => foldIcsLine(line)).join(CRLF)}${CRLF}`;
}

export function calendarFeedHttp(input: {
  token: string;
  feeds: readonly CalendarFeed[];
  lessons: readonly FeedLesson[];
  now?: Date;
  asOfDate?: string;
  origin?: string | null;
}): { status: number; contentType: string; body: string } {
  const userId = resolveCalendarUser(input.feeds, input.token);
  if (!userId) {
    return { status: 404, contentType: "text/plain; charset=utf-8", body: "Not found" };
  }
  const now = input.now ?? new Date();
  const asOf = input.asOfDate ?? todayInZone(DEFAULT_LESSON_TIMEZONE, now);
  const selected = selectFeedLessons(userId, input.lessons, asOf, "any");
  return {
    status: 200,
    contentType: "text/calendar; charset=utf-8",
    body: buildCalendar(selected, { viewerId: userId, now, origin: input.origin }),
  };
}

/** Copy only fields the calendar is allowed to show. Private notes, phone, and email are not read. */
export function toFeedLesson(row: Record<string, unknown>): FeedLesson {
  return {
    id: numberValue(row.id),
    startsAt: String(row.starts_at ?? row.startsAt ?? ""),
    durationMin: Math.min(180, Math.max(15, numberValue(row.duration_min ?? row.durationMin) || 60)),
    status: String(row.status ?? ""),
    cancelReason: textOrNull(row.cancel_reason ?? row.cancelReason),
    courtName: textOrNull(row.court_name ?? row.courtName),
    coachName: textOrNull(row.coach_name ?? row.coachName) ?? "Coach",
    playerName: textOrNull(row.player_name ?? row.playerName) ?? "Player",
    coachUserId: String(row.coach_user_id ?? row.coachUserId ?? ""),
    playerUserId: String(row.player_user_id ?? row.playerUserId ?? ""),
    guardianUserId: textOrNull(row.guardian_user_id ?? row.guardianUserId),
    sport: String(row.sport ?? ""),
    serviceName: textOrNull(row.service_name ?? row.serviceName),
    timezone: textOrNull(row.timezone),
    updatedAt: textOrNull(row.updated_at ?? row.updatedAt),
    createdAt: textOrNull(row.created_at ?? row.createdAt),
    notes: textOrNull(row.notes),
  };
}

function eventLines(lesson: FeedLesson, viewerId: string, dtStamp: string, origin?: string | null): string[] {
  const zone = namedZone(lesson.timezone ?? DEFAULT_LESSON_TIMEZONE);
  const start = normalizeStamp(lesson.startsAt);
  const end = addWallMinutes(start, lesson.durationMin);
  const startProp = zone
    ? `DTSTART;TZID=${zone}:${formatIcsLocal(start)}`
    : `DTSTART:${formatIcsUtc(wallToUtcDate(start, lesson.timezone ?? DEFAULT_LESSON_TIMEZONE))}`;
  const endProp = zone
    ? `DTEND;TZID=${zone}:${formatIcsLocal(end)}`
    : `DTEND:${formatIcsUtc(wallToUtcDate(end, lesson.timezone ?? DEFAULT_LESSON_TIMEZONE))}`;
  const revised = parseUtcTimestamp(lesson.updatedAt) ?? parseUtcTimestamp(lesson.createdAt);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${lessonUid(lesson.id)}`,
    `DTSTAMP:${dtStamp}`,
    startProp,
    endProp,
    `SUMMARY:${escapeIcsText(summaryFor(viewerId, lesson))}`,
  ];
  if (lesson.courtName) lines.push(`LOCATION:${escapeIcsText(lesson.courtName)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(descriptionFor(lesson))}`);
  lines.push(`STATUS:${icsStatus(lesson.status)}`);
  lines.push(`SEQUENCE:${lessonSequence(lesson)}`);
  lines.push(`LAST-MODIFIED:${formatIcsUtc(revised ?? new Date(0))}`);
  if (origin) {
    const base = origin.replace(/\/$/, "");
    lines.push(`URL:${base}/app/lessons/${lesson.id}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

function summaryFor(viewerId: string, lesson: FeedLesson): string {
  const what = lesson.serviceName || sportWord(lesson.sport);
  if (viewerId === lesson.coachUserId && viewerId !== lesson.playerUserId) {
    return `${lesson.playerName} · ${what}`;
  }
  if (viewerId !== lesson.playerUserId) {
    return `${lesson.playerName} with ${lesson.coachName} · ${what}`;
  }
  return `${lesson.coachName} · ${what}`;
}

function descriptionFor(lesson: FeedLesson): string {
  const lines = [`Coach: ${lesson.coachName}`, `Player: ${lesson.playerName}`];
  if (lesson.serviceName) lines.push(`Service: ${lesson.serviceName}`);
  else if (lesson.sport) lines.push(`Sport: ${sportWord(lesson.sport)}`);
  if (lesson.status === "cancelled") {
    lines.push(`Canceled: ${(lesson.cancelReason ?? "").trim() || "Canceled."}`);
  }
  if (lesson.notes) lines.push(`Notes: ${lesson.notes}`);
  return lines.join("\n");
}

function icsStatus(status: string): string {
  if (status === "cancelled") return "CANCELLED";
  if (status === "requested") return "TENTATIVE";
  return "CONFIRMED";
}

function vtimezoneLines(zone: string): string[] {
  const rule = ZONE_RULES[zone];
  if (!rule) return [];
  const lines = ["BEGIN:VTIMEZONE", `TZID:${zone}`, `X-LIC-LOCATION:${zone}`];
  if (rule.daylight != null && rule.daylightLabel && rule.daylightName) {
    lines.push(
      "BEGIN:DAYLIGHT",
      `TZOFFSETFROM:${rule.standardLabel}`,
      `TZOFFSETTO:${rule.daylightLabel}`,
      `TZNAME:${rule.daylightName}`,
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${rule.daylightLabel}`,
      `TZOFFSETTO:${rule.standardLabel}`,
      `TZNAME:${rule.standardName}`,
      "DTSTART:19701101T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
      "END:STANDARD",
    );
  } else {
    lines.push(
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${rule.standardLabel}`,
      `TZOFFSETTO:${rule.standardLabel}`,
      `TZNAME:${rule.standardName}`,
      "DTSTART:19700101T000000",
      "END:STANDARD",
    );
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (7 - first.getUTCDay()) % 7;
  return 1 + delta + (n - 1) * 7;
}

function sportWord(sport: string): string {
  if (sport === "tennis") return "Tennis";
  if (sport === "pickleball") return "Pickleball";
  return sport || "Lesson";
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
