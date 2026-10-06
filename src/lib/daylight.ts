/**
 * Season daylight for standing lessons.
 * Sunrise and sunset use the NOAA solar calculator equations
 * (https://gml.noaa.gov/grad/solcalc/main.js): Julian century, equation of time,
 * declination, and the 90.833° zenith. Longitude is degrees east (negative in
 * the Americas), matching that calculator. No network and no key.
 *
 * starts_at stays a wall-clock stamp. The clock offset for a date comes from
 * the lesson timezone, so Nov 1 2026 in America/New_York is EST after the
 * 2:00 AM fallback.
 */

import {
  isOpenLesson,
  lessonTimeZone,
  normalizeStamp,
  offsetMinutes,
  stampDate,
  stampTime,
  todayInZone,
} from "./schedule.ts";

export const VIDALIA_LAT = 32.2177;
export const VIDALIA_LNG = -82.4135;
export const VIDALIA_LABEL = "Vidalia, GA";
export const VIDALIA_FALLBACK_NOTE = `Sunrise and sunset use ${VIDALIA_LABEL} (${VIDALIA_LAT}, ${VIDALIA_LNG}). This court has no map pin.`;
export const DAYLIGHT_MARGIN_MIN = 15;
export const SUGGEST_GRID_MIN = 30;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type SolarTimes = {
  sunriseMin: number;
  sunsetMin: number;
};

export type DaylightOccurrence = {
  seriesId: string;
  startsAt: string;
  cadenceAt: string | null;
  durationMin: number;
  timezone: string | null;
  status: string;
  courtLat: number | null;
  courtLng: number | null;
  /** null when the lesson has no court. true skips the suggestion. */
  courtLights: boolean | null;
  courtIndoor: boolean;
  playerName: string | null;
};

export type DismissedSuggestion = {
  seriesId: string;
  fromDate: string;
};

export type SeasonSuggestion = {
  seriesId: string;
  /** First upcoming dark occurrence. Confirm still shifts from this date. */
  fromDate: string;
  /**
   * Stable key for daylight_dismissals.lesson_date.
   * That column stores this shift anchor, not an occurrence date, so the
   * existing primary key (series_id, lesson_date, user_id) can hide a shift
   * without a new column. The same clocks stay hidden next week. A new
   * suggested clock is a new anchor and shows again.
   */
  anchorDate: string;
  /** HH:MM for the existing shift-series action. */
  localTime: string;
  message: string;
  playerName: string | null;
  locationFallback: boolean;
  reason: "after-dark" | "before-sunrise" | "outside";
};

/**
 * Encode the current wall clock and the suggested wall clock as one civil date.
 * daylight_dismissals.lesson_date stores this value. It is not a lesson date.
 */
export function shiftAnchorDate(currentMin: number, nextMin: number): string {
  const current = Math.max(0, Math.min(1439, Math.round(currentMin)));
  const next = Math.max(0, Math.min(1439, Math.round(nextMin)));
  const dayIndex = current * 1440 + next;
  const dt = new Date(Date.UTC(2000, 0, 1) + dayIndex * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type SeasonShiftData = {
  series_id: string;
  from_date: string;
  local_time: string;
};

function degToRad(deg: number): number {
  return (Math.PI * deg) / 180;
}

function radToDeg(rad: number): number {
  return (180 * rad) / Math.PI;
}

function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function julianCent(jd: number): number {
  return (jd - 2451545) / 36525;
}

function geomMeanLongSun(t: number): number {
  let l0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
  l0 %= 360;
  if (l0 < 0) l0 += 360;
  return l0;
}

function geomMeanAnomalySun(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function eccentricityEarthOrbit(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunEqOfCenter(t: number): number {
  const mrad = degToRad(geomMeanAnomalySun(t));
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(mrad + mrad);
  const sin3m = Math.sin(mrad + mrad + mrad);
  return (
    sinm * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin2m * (0.019993 - 0.000101 * t) +
    sin3m * 0.000289
  );
}

function sunTrueLong(t: number): number {
  return geomMeanLongSun(t) + sunEqOfCenter(t);
}

function sunApparentLong(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return sunTrueLong(t) - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
}

function meanObliquity(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}

function obliquityCorrection(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return meanObliquity(t) + 0.00256 * Math.cos(degToRad(omega));
}

function sunDeclination(t: number): number {
  const e = obliquityCorrection(t);
  const lambda = sunApparentLong(t);
  const sint = Math.sin(degToRad(e)) * Math.sin(degToRad(lambda));
  return radToDeg(Math.asin(sint));
}

function equationOfTime(t: number): number {
  const epsilon = obliquityCorrection(t);
  const l0 = geomMeanLongSun(t);
  const e = eccentricityEarthOrbit(t);
  const m = geomMeanAnomalySun(t);
  let y = Math.tan(degToRad(epsilon) / 2);
  y *= y;
  const sin2l0 = Math.sin(2 * degToRad(l0));
  const sinm = Math.sin(degToRad(m));
  const cos2l0 = Math.cos(2 * degToRad(l0));
  const sin4l0 = Math.sin(4 * degToRad(l0));
  const sin2m = Math.sin(2 * degToRad(m));
  const eTime =
    y * sin2l0 -
    2 * e * sinm +
    4 * e * y * sinm * cos2l0 -
    0.5 * y * y * sin4l0 -
    1.25 * e * e * sin2m;
  return radToDeg(eTime) * 4;
}

function hourAngleSunrise(lat: number, solarDec: number): number {
  const latRad = degToRad(lat);
  const sdRad = degToRad(solarDec);
  const arg =
    Math.cos(degToRad(90.833)) / (Math.cos(latRad) * Math.cos(sdRad)) -
    Math.tan(latRad) * Math.tan(sdRad);
  return Math.acos(Math.min(1, Math.max(-1, arg)));
}

/** Minutes from 0:00 UTC. `rise` true is sunrise. Longitude is degrees east. */
function sunriseSetUtc(rise: boolean, jd: number, latitude: number, longitude: number): number {
  const t = julianCent(jd);
  const eqTime = equationOfTime(t);
  const solarDec = sunDeclination(t);
  let hourAngle = hourAngleSunrise(latitude, solarDec);
  if (!rise) hourAngle = -hourAngle;
  const delta = longitude + radToDeg(hourAngle);
  return 720 - 4 * delta - eqTime;
}

function wrapLocal(minutes: number): number {
  let local = minutes;
  while (local < 0) local += 1440;
  while (local >= 1440) local -= 1440;
  return local;
}

/**
 * Local sunrise and sunset in minutes from local midnight.
 * `utcOffsetHours` is hours east of UTC (EDT -4, EST -5).
 */
export function solarTimesAt(
  year: number,
  month: number,
  day: number,
  latitude: number,
  longitude: number,
  utcOffsetHours: number,
): SolarTimes | null {
  const jd = julianDay(year, month, day);
  const riseUtc = sunriseSetUtc(true, jd, latitude, longitude);
  const setUtc = sunriseSetUtc(false, jd, latitude, longitude);
  if (!Number.isFinite(riseUtc) || !Number.isFinite(setUtc)) return null;
  const riseUtc2 = sunriseSetUtc(true, jd + riseUtc / 1440, latitude, longitude);
  const setUtc2 = sunriseSetUtc(false, jd + setUtc / 1440, latitude, longitude);
  if (!Number.isFinite(riseUtc2) || !Number.isFinite(setUtc2)) return null;
  return {
    sunriseMin: wrapLocal(riseUtc2 + utcOffsetHours * 60),
    sunsetMin: wrapLocal(setUtc2 + utcOffsetHours * 60),
  };
}

export function courtPoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number; fallback: boolean } {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: VIDALIA_LAT, lng: VIDALIA_LNG, fallback: true };
  }
  return { lat, lng, fallback: false };
}

export function solarTimesOn(
  date: string,
  lat: number,
  lng: number,
  timeZone: string,
): SolarTimes | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const offsetHours = offsetMinutes(`${date} 12:00:00`, lessonTimeZone(timeZone)) / 60;
  return solarTimesAt(year!, month!, day!, lat, lng, offsetHours);
}

export function minutesOfDay(stamp: string): number {
  const time = stampTime(stamp);
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}

export function formatClock(minutes: number): string {
  const wrapped = wrapLocal(Math.round(minutes));
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function formatLocalTime(minutes: number): string {
  const wrapped = wrapLocal(Math.floor(minutes));
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export function weekdayOf(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
}

function violation(
  startMin: number,
  durationMin: number,
  windows: SolarTimes[],
): number {
  let total = 0;
  for (const window of windows) {
    total += Math.max(0, window.sunriseMin + DAYLIGHT_MARGIN_MIN - startMin);
    total += Math.max(0, startMin + durationMin - (window.sunsetMin - DAYLIGHT_MARGIN_MIN));
  }
  return total;
}

function aggregateReason(
  startMin: number,
  durationMin: number,
  windows: SolarTimes[],
): SeasonSuggestion["reason"] | null {
  let early = false;
  let late = false;
  for (const window of windows) {
    if (startMin < window.sunriseMin + DAYLIGHT_MARGIN_MIN) early = true;
    if (startMin + durationMin > window.sunsetMin - DAYLIGHT_MARGIN_MIN) late = true;
  }
  if (early && late) return "outside";
  if (late) return "after-dark";
  if (early) return "before-sunrise";
  return null;
}

/**
 * Smallest 30-minute step that puts the lesson inside sunrise+15 and sunset−15
 * on every given day. Evening lessons step earlier. Morning lessons step later.
 */
export function suggestWallMinutes(
  startMin: number,
  durationMin: number,
  windows: SolarTimes[],
): number | null {
  if (windows.length === 0) return null;
  const reason = aggregateReason(startMin, durationMin, windows);
  if (!reason) return null;
  const step = reason === "before-sunrise" ? SUGGEST_GRID_MIN : -SUGGEST_GRID_MIN;
  let best: number | null = null;
  let bestViolation = violation(startMin, durationMin, windows);
  for (let i = 1; i <= 16; i += 1) {
    const next = startMin + step * i;
    if (next < 6 * 60 || next > 21 * 60) break;
    const nextViolation = violation(next, durationMin, windows);
    if (nextViolation < bestViolation) {
      best = next;
      bestViolation = nextViolation;
      if (nextViolation === 0) break;
    }
  }
  return best;
}

function reasonPhrase(reason: SeasonSuggestion["reason"]): string {
  if (reason === "after-dark") return "ends after dark";
  if (reason === "before-sunrise") return "starts before sunrise";
  return "falls outside daylight";
}

export function suggestionMessage(opts: {
  fromDate: string;
  currentMin: number;
  nextMin: number;
  reason: SeasonSuggestion["reason"];
}): string {
  const when = formatMonthDay(opts.fromDate);
  const day = weekdayOf(opts.fromDate);
  const now = formatClock(opts.currentMin);
  const next = formatClock(opts.nextMin);
  return `Starting ${when}, your ${day} ${now} series ${reasonPhrase(opts.reason)}. Shift to ${next} from ${when}?`;
}

function cadenceDate(row: DaylightOccurrence): string {
  return stampDate(normalizeStamp(row.cadenceAt || row.startsAt));
}

function courtNeedsDaylight(row: DaylightOccurrence): boolean {
  if (row.courtIndoor) return false;
  if (row.courtLights === true) return false;
  return true;
}

export function buildSeasonSuggestions(opts: {
  rows: DaylightOccurrence[];
  dismissed: DismissedSuggestion[];
  now?: Date;
}): SeasonSuggestion[] {
  const now = opts.now ?? new Date();
  const hidden = new Set(opts.dismissed.map((item) => `${item.seriesId}|${item.fromDate}`));
  const bySeries = new Map<string, DaylightOccurrence[]>();
  for (const row of opts.rows) {
    if (!row.seriesId || !isOpenLesson(row.status)) continue;
    const zone = lessonTimeZone(row.timezone);
    if (stampDate(normalizeStamp(row.startsAt)) < todayInZone(zone, now)) continue;
    const list = bySeries.get(row.seriesId) ?? [];
    list.push(row);
    bySeries.set(row.seriesId, list);
  }

  const suggestions: SeasonSuggestion[] = [];
  for (const [seriesId, rows] of bySeries) {
    const playable = rows.filter(courtNeedsDaylight);
    if (playable.length === 0) continue;
    const dark: {
      row: DaylightOccurrence;
      solar: SolarTimes;
      startMin: number;
      fallback: boolean;
    }[] = [];
    for (const row of playable) {
      const zone = lessonTimeZone(row.timezone);
      const point = courtPoint(row.courtLat, row.courtLng);
      const date = stampDate(normalizeStamp(row.startsAt));
      const solar = solarTimesOn(date, point.lat, point.lng, zone);
      if (!solar) continue;
      const startMin = minutesOfDay(row.startsAt);
      if (!aggregateReason(startMin, row.durationMin, [solar])) continue;
      dark.push({ row, solar, startMin, fallback: point.fallback });
    }
    if (dark.length === 0) continue;
    dark.sort((a, b) => cadenceDate(a.row).localeCompare(cadenceDate(b.row)));
    const first = dark[0]!;
    const fromDate = cadenceDate(first.row);
    const startMin = first.startMin;
    const durationMin = first.row.durationMin;
    const windows = dark.map((item) => item.solar);
    const reason = aggregateReason(startMin, durationMin, windows);
    if (!reason) continue;
    const nextMin = suggestWallMinutes(startMin, durationMin, windows);
    if (nextMin == null) continue;
    const anchorDate = shiftAnchorDate(startMin, nextMin);
    if (hidden.has(`${seriesId}|${anchorDate}`)) continue;
    suggestions.push({
      seriesId,
      fromDate,
      anchorDate,
      localTime: formatLocalTime(nextMin),
      message: suggestionMessage({ fromDate, currentMin: startMin, nextMin, reason }),
      playerName: first.row.playerName,
      locationFallback: dark.some((item) => item.fallback),
      reason,
    });
  }
  suggestions.sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.seriesId.localeCompare(b.seriesId));
  return suggestions;
}

/** Payload for R1 `shiftLessonSeries`. Confirm does not shift by any other path. */
export function seasonShiftData(
  suggestion: Pick<SeasonSuggestion, "seriesId" | "fromDate" | "localTime">,
): SeasonShiftData {
  return {
    series_id: suggestion.seriesId,
    from_date: suggestion.fromDate,
    local_time: suggestion.localTime,
  };
}

export function confirmSeasonShift<T>(
  shiftLessonSeries: (input: { data: SeasonShiftData }) => Promise<T>,
  suggestion: Pick<SeasonSuggestion, "seriesId" | "fromDate" | "localTime">,
): Promise<T> {
  return shiftLessonSeries({ data: seasonShiftData(suggestion) });
}

export const DISMISS_KIND = "daylight_dismiss";

export function parseDismissals(body: string | null | undefined): DismissedSuggestion[] {
  if (!body || !body.trim()) return [];
  try {
    const parsed = JSON.parse(body) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
    const out: DismissedSuggestion[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const seriesId = String((item as { seriesId?: unknown }).seriesId ?? "");
      const fromDate = String((item as { fromDate?: unknown }).fromDate ?? "");
      if (!seriesId || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) continue;
      out.push({ seriesId, fromDate });
    }
    return out;
  } catch {
    return [];
  }
}

export function dismissalBody(items: DismissedSuggestion[]): string {
  const seen = new Set<string>();
  const kept: DismissedSuggestion[] = [];
  for (const item of items) {
    const key = `${item.seriesId}|${item.fromDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ seriesId: item.seriesId, fromDate: item.fromDate });
  }
  return JSON.stringify({ items: kept.slice(-200) });
}

export function withDismissal(
  existing: DismissedSuggestion[],
  next: DismissedSuggestion,
): DismissedSuggestion[] {
  return [...existing, next];
}

const THUNDER_CODES = new Set([95, 96, 99]);
export const RAIN_LIKELY_PERCENT = 50;

export type WeatherFlag = "rain" | "thunder";

export function forecastHeadsUp(
  precipitationProbability: number | null | undefined,
  weatherCode: number | null | undefined,
): WeatherFlag | null {
  if (weatherCode != null && THUNDER_CODES.has(weatherCode)) return "thunder";
  if (
    precipitationProbability != null &&
    Number.isFinite(precipitationProbability) &&
    precipitationProbability >= RAIN_LIKELY_PERCENT
  ) {
    return "rain";
  }
  return null;
}

/** True when the wall-clock stamp falls in [now, now + hours]. */
export function startsWithinHours(
  stamp: string,
  timeZone: string,
  now: Date,
  hours: number,
): boolean {
  const norm = normalizeStamp(stamp);
  const offset = offsetMinutes(norm, lessonTimeZone(timeZone));
  const [date, time] = norm.split(" ");
  const [year, month, day] = date!.split("-").map(Number);
  const [hour, minute, second] = time!.split(":").map(Number);
  const utc = Date.UTC(year!, month! - 1, day!, hour!, minute!, second!) - offset * 60000;
  const delta = utc - now.getTime();
  return delta >= 0 && delta <= hours * 3600000;
}

export type ForecastHour = {
  time: string;
  precipitationProbability: number | null;
  weatherCode: number | null;
};

export function lessonForecastFlag(
  startsAt: string,
  durationMin: number,
  hours: ForecastHour[],
): { flag: WeatherFlag; precipitationProbability: number | null } | null {
  const start = normalizeStamp(startsAt);
  const startMin = minutesOfDay(start);
  const endMin = startMin + Math.max(durationMin, 1);
  const date = stampDate(start);
  let found: { flag: WeatherFlag; precipitationProbability: number | null } | null = null;
  for (const hour of hours) {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(hour.time);
    if (!match || match[1] !== date) continue;
    const hourMin = Number(match[2]) * 60;
    if (hourMin + 60 <= startMin || hourMin >= endMin) continue;
    const flag = forecastHeadsUp(hour.precipitationProbability, hour.weatherCode);
    if (!flag) continue;
    if (flag === "thunder" || !found) {
      found = { flag, precipitationProbability: hour.precipitationProbability };
    }
    if (flag === "thunder") break;
  }
  return found;
}
