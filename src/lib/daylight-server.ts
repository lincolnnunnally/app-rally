import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  buildSeasonSuggestions,
  courtPoint,
  formatClock,
  formatMonthDay,
  lessonForecastFlag,
  minutesOfDay,
  startsWithinHours,
  weekdayOf,
  type DaylightOccurrence,
  type DismissedSuggestion,
  type ForecastHour,
  type WeatherFlag,
} from "@/lib/daylight";
import { lessonTimeZone, stampDate } from "@/lib/schedule";
import { isMissingScheduleColumn } from "@/lib/schedule-server";

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function mapOccurrence(row: Record<string, unknown>): DaylightOccurrence {
  return {
    seriesId: row.series_id == null ? "" : String(row.series_id),
    startsAt: String(row.starts_at),
    cadenceAt:
      row.cadence_at == null || String(row.cadence_at).trim() === ""
        ? null
        : String(row.cadence_at),
    durationMin: num(row.duration_min, 60) || 60,
    timezone: row.timezone == null ? null : String(row.timezone),
    status: String(row.status),
    courtLat: numOrNull(row.lat),
    courtLng: numOrNull(row.lng),
    courtLights: row.lights == null ? null : bool(row.lights),
    courtIndoor: bool(row.indoor),
    playerName: row.player_name == null ? null : String(row.player_name),
  };
}

function isMissingDismissals(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /daylight_dismissals/i.test(message) && /does not exist/i.test(message);
}

async function readDismissals(sql: Sql, userId: string): Promise<DismissedSuggestion[]> {
  try {
    const rows = await sql`
      select series_id, lesson_date::text as lesson_date
      from daylight_dismissals
      where user_id = ${userId}
    `;
    return rows.map((row) => ({
      seriesId: String(row.series_id),
      fromDate: String(row.lesson_date).slice(0, 10),
    }));
  } catch (err) {
    if (isMissingDismissals(err)) return [];
    throw err;
  }
}

export const listSeasonSuggestions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    try {
      const rows = await sql`
        select l.series_id, l.starts_at::text as starts_at, l.cadence_at::text as cadence_at,
               l.duration_min, l.timezone, l.status,
               c.lat, c.lng, c.lights, c.indoor,
               pp.display_name as player_name
        from lessons l
        left join courts c on c.id = l.court_id
        left join profiles pp on pp.user_id = l.player_user_id
        where l.coach_user_id = ${context.userId}
          and l.series_id is not null
          and l.status in ('requested', 'confirmed', 'checked_in')
          and l.starts_at >= current_date - interval '1 day'
        order by l.starts_at, l.id
      `;
      const dismissed = await readDismissals(sql, context.userId);
      return buildSeasonSuggestions({
        rows: rows.map((row) => mapOccurrence(row)),
        dismissed,
      });
    } catch (err) {
      if (isMissingScheduleColumn(err)) return [];
      throw err;
    }
  });

export const dismissSeasonSuggestion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      series_id: z.string().min(8).max(80),
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql`
      select id from lessons
      where series_id = ${data.series_id} and coach_user_id = ${context.userId}
      limit 1
    `;
    if (owned.length === 0) throw new Error("Series not found");
    await sql`
      insert into daylight_dismissals (series_id, lesson_date, user_id)
      values (${data.series_id}, ${data.from_date}::date, ${context.userId})
      on conflict (series_id, lesson_date, user_id) do nothing
    `;
    return { ok: true };
  });

export type WeatherHeadsup = {
  lessonId: number;
  day: string;
  flag: WeatherFlag;
  precipitationProbability: number | null;
  courtName: string | null;
  locationFallback: boolean;
  message: string;
};

function weatherMessage(opts: {
  flag: WeatherFlag;
  startsAt: string;
  precipitationProbability: number | null;
}): string {
  const date = stampDate(opts.startsAt.replace("T", " "));
  const when = `${weekdayOf(date)}, ${formatMonthDay(date)} · ${formatClock(minutesOfDay(opts.startsAt))}`;
  if (opts.flag === "thunder") return `Thunderstorm in the forecast for ${when}.`;
  const pct =
    opts.precipitationProbability == null ? "" : ` (${Math.round(opts.precipitationProbability)}%)`;
  return `Rain likely${pct} for ${when}.`;
}

async function fetchForecast(lat: number, lng: number, timeZone: string): Promise<ForecastHour[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("hourly", "precipitation_probability,weather_code");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", timeZone);
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) return [];
  const body = (await response.json()) as {
    hourly?: {
      time?: unknown[];
      precipitation_probability?: unknown[];
      weather_code?: unknown[];
    };
  };
  const times = body.hourly?.time ?? [];
  const pops = body.hourly?.precipitation_probability ?? [];
  const codes = body.hourly?.weather_code ?? [];
  return times.map((time, index) => ({
    time: String(time),
    precipitationProbability: numOrNull(pops[index]),
    weatherCode: numOrNull(codes[index]),
  }));
}

type SoonLesson = {
  id: number;
  startsAt: string;
  durationMin: number;
  timezone: string | null;
  courtName: string | null;
  lat: number | null;
  lng: number | null;
};

export const listWeatherHeadsUp = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WeatherHeadsup[]> => {
    try {
      const sql = await getSql();
      let rows: Record<string, unknown>[];
      try {
        rows = await sql`
          select l.id, l.starts_at::text as starts_at, l.duration_min, l.timezone,
                 c.name as court_name, c.lat, c.lng, c.indoor
          from lessons l
          left join courts c on c.id = l.court_id
          where l.coach_user_id = ${context.userId}
            and l.status in ('requested', 'confirmed', 'checked_in')
            and l.starts_at >= now() - interval '12 hours'
            and l.starts_at < now() + interval '3 days'
          order by l.starts_at, l.id
        `;
      } catch (err) {
        if (!isMissingScheduleColumn(err)) throw err;
        rows = await sql`
          select l.id, l.starts_at::text as starts_at, l.duration_min,
                 c.name as court_name, c.lat, c.lng, c.indoor
          from lessons l
          left join courts c on c.id = l.court_id
          where l.coach_user_id = ${context.userId}
            and l.status in ('requested', 'confirmed', 'checked_in')
            and l.starts_at >= now() - interval '12 hours'
            and l.starts_at < now() + interval '3 days'
          order by l.starts_at, l.id
        `;
      }
      const now = new Date();
      const soon: SoonLesson[] = [];
      for (const row of rows) {
        if (bool(row.indoor)) continue;
        const startsAt = String(row.starts_at);
        const timezone = row.timezone == null ? null : String(row.timezone);
        if (!startsWithinHours(startsAt, lessonTimeZone(timezone), now, 48)) continue;
        soon.push({
          id: num(row.id),
          startsAt,
          durationMin: num(row.duration_min, 60) || 60,
          timezone,
          courtName: row.court_name == null ? null : String(row.court_name),
          lat: numOrNull(row.lat),
          lng: numOrNull(row.lng),
        });
      }
      const forecasts = new Map<string, Promise<ForecastHour[]>>();
      for (const lesson of soon) {
        const point = courtPoint(lesson.lat, lesson.lng);
        const zone = lessonTimeZone(lesson.timezone);
        const key = `${point.lat.toFixed(3)}|${point.lng.toFixed(3)}|${zone}`;
        if (!forecasts.has(key)) {
          forecasts.set(
            key,
            fetchForecast(point.lat, point.lng, zone).catch(() => []),
          );
        }
      }
      const resolved = new Map<string, ForecastHour[]>();
      await Promise.all(
        [...forecasts.entries()].map(async ([key, pending]) => {
          resolved.set(key, await pending);
        }),
      );
      const heads: WeatherHeadsup[] = [];
      for (const lesson of soon) {
        const point = courtPoint(lesson.lat, lesson.lng);
        const zone = lessonTimeZone(lesson.timezone);
        const key = `${point.lat.toFixed(3)}|${point.lng.toFixed(3)}|${zone}`;
        const flag = lessonForecastFlag(lesson.startsAt, lesson.durationMin, resolved.get(key) ?? []);
        if (!flag) continue;
        heads.push({
          lessonId: lesson.id,
          day: stampDate(lesson.startsAt.replace("T", " ")),
          flag: flag.flag,
          precipitationProbability: flag.precipitationProbability,
          courtName: lesson.courtName,
          locationFallback: point.fallback,
          message: weatherMessage({
            flag: flag.flag,
            startsAt: lesson.startsAt,
            precipitationProbability: flag.precipitationProbability,
          }),
        });
      }
      return heads;
    } catch (err) {
      console.error("[weather]", err instanceof Error ? err.message : "forecast failed");
      return [];
    }
  });
