import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { sendLessonCopy, type LessonMailKind } from "@/lib/lesson-mail";
import { formatWall } from "@/lib/rally";
import type { LessonRow } from "@/lib/rally";
import {
  extendAfterLast,
  isOpenLesson,
  lessonTimeZone,
  moveSingleLesson,
  renewWeekCount,
  seriesShiftNotice,
  shiftSeriesFromDate,
  singleMoveNotice,
  todayInZone,
  topUpStandingSlots,
  weatherCancelIds,
  weatherCancelNotices,
  weatherReason,
  type ScheduleOccurrence,
} from "@/lib/schedule";
import { isAccountlessStudent } from "@/lib/students";

const MIGRATION_HINT =
  "This scheduling action needs migration 0016_lesson_schedule.sql. It is not applied yet.";

export function isMissingScheduleColumn(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /does not exist/i.test(message) &&
    /(timezone|open_ended|cadence_at|cancel_reason)/i.test(message)
  );
}

function num(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

async function notify(sql: Sql, userId: string, title: string, body: string, href: string | null) {
  if (!userId || userId.startsWith("seed:") || isAccountlessStudent(userId)) return;
  await sql`
    insert into notifications (user_id, title, body, href)
    values (${userId}, ${title}, ${body}, ${href})
  `;
}

export async function deliverLessonEmail(
  sql: Sql,
  userId: string | null | undefined,
  mail: { kind: LessonMailKind; whenLabel: string; detail: string },
) {
  try {
    if (!userId || isAccountlessStudent(userId) || userId.startsWith("seed:")) return;
    const row = (await sql`select "email" from "user" where "id" = ${userId} limit 1`)[0];
    const to = row?.email == null ? "" : String(row.email);
    await sendLessonCopy({ to, ...mail });
  } catch (err) {
    console.error("[lesson-mail]", err instanceof Error ? err.message : "email failed");
  }
}

async function guardianId(sql: Sql, playerId: string): Promise<string> {
  const row = (
    await sql`
    select guardian_user_id from profiles where user_id = ${playerId} limit 1
  `
  )[0];
  return row?.guardian_user_id == null ? "" : String(row.guardian_user_id);
}

async function assertCanTouch(sql: Sql, actorId: string, coachId: string, playerId: string) {
  if (actorId === coachId || actorId === playerId) return;
  const guardian = await guardianId(sql, playerId);
  if (guardian && guardian === actorId) return;
  throw new Error("This lesson is not yours.");
}

export async function scheduleColumnsReady(sql: Sql): Promise<boolean> {
  try {
    await sql`select timezone, open_ended, cadence_at, cancel_reason from lessons limit 0`;
    return true;
  } catch (err) {
    if (isMissingScheduleColumn(err)) return false;
    throw err;
  }
}

export async function assertScheduleColumns(sql: Sql) {
  if (!(await scheduleColumnsReady(sql))) throw new Error(MIGRATION_HINT);
}

export async function stampNewLessons(
  sql: Sql,
  ids: number[],
  timezone: string | null | undefined,
  openEnded: boolean,
) {
  if (ids.length === 0) return;
  const zone = lessonTimeZone(timezone);
  try {
    await sql.query(
      `update lessons
         set timezone = $1, open_ended = $2, cadence_at = starts_at
       where id = any($3::int[])`,
      [zone, openEnded, ids],
    );
  } catch (err) {
    if (isMissingScheduleColumn(err)) {
      if (openEnded) throw new Error(MIGRATION_HINT);
      return;
    }
    throw err;
  }
}

export async function attachScheduleFields(sql: Sql, lessons: LessonRow[]): Promise<LessonRow[]> {
  if (lessons.length === 0) return lessons;
  try {
    const rows = await sql.query(
      `select id, timezone, open_ended, cancel_reason from lessons where id = any($1::int[])`,
      [lessons.map((lesson) => lesson.id)],
    );
    const byId = new Map(rows.map((row) => [num(row.id), row]));
    return lessons.map((lesson) => {
      const extra = byId.get(lesson.id);
      if (!extra) return lesson;
      return {
        ...lesson,
        timezone: extra.timezone == null ? null : String(extra.timezone),
        open_ended:
          extra.open_ended === true || extra.open_ended === "t" || extra.open_ended === "true",
        cancel_reason:
          extra.cancel_reason == null || String(extra.cancel_reason).trim() === ""
            ? null
            : String(extra.cancel_reason),
      };
    });
  } catch (err) {
    if (isMissingScheduleColumn(err)) return lessons;
    throw err;
  }
}

function mapOccurrence(row: Record<string, unknown>): ScheduleOccurrence {
  return {
    id: num(row.id),
    series_id: row.series_id == null ? null : String(row.series_id),
    starts_at: String(row.starts_at),
    cadence_at:
      row.cadence_at == null || String(row.cadence_at).trim() === ""
        ? null
        : String(row.cadence_at),
    coach_user_id: String(row.coach_user_id),
    player_user_id: String(row.player_user_id),
    status: String(row.status),
  };
}

async function loadSeries(sql: Sql, seriesId: string): Promise<ScheduleOccurrence[]> {
  try {
    const rows = await sql`
      select id, series_id, starts_at::text as starts_at, cadence_at::text as cadence_at,
             coach_user_id, player_user_id, status
      from lessons
      where series_id = ${seriesId}
      order by starts_at, id
    `;
    return rows.map((row) => mapOccurrence(row));
  } catch (err) {
    if (isMissingScheduleColumn(err)) throw new Error(MIGRATION_HINT);
    throw err;
  }
}

type TemplateRow = Record<string, unknown> & {
  id: number;
  coach_user_id: string;
  player_user_id: string;
  court_id: number | null;
  duration_min: number;
  sport: string;
  status: string;
  notes: string | null;
  service_id: number | null;
  price_cents: number | null;
  billing: string;
  group_spots: number | null;
  series_id: string;
  facility_fee_cents: number;
  facility_cut_cents: number;
  for_kind: string;
  for_name: string | null;
  timezone: string | null;
  open_ended: boolean;
};

async function loadTemplate(sql: Sql, seriesId: string): Promise<TemplateRow | null> {
  const rows = await sql`
    select id, coach_user_id, player_user_id, court_id, starts_at::text as starts_at,
           cadence_at::text as cadence_at, duration_min, sport, status, notes,
           service_id, price_cents, billing, group_spots, series_id,
           facility_fee_cents, facility_cut_cents, for_kind, for_name, timezone, open_ended
    from lessons
    where series_id = ${seriesId}
    order by coalesce(cadence_at, starts_at) desc, id desc
  `;
  if (rows.length === 0) return null;
  const open = rows.find((row) => isOpenLesson(String(row.status))) ?? rows[0];
  return {
    ...(open as Record<string, unknown>),
    id: num(open.id),
    coach_user_id: String(open.coach_user_id),
    player_user_id: String(open.player_user_id),
    court_id: open.court_id == null ? null : num(open.court_id),
    duration_min: num(open.duration_min),
    sport: String(open.sport),
    status: String(open.status),
    notes: open.notes == null ? null : String(open.notes),
    service_id: open.service_id == null ? null : num(open.service_id),
    price_cents: open.price_cents == null ? null : num(open.price_cents),
    billing: String(open.billing ?? "hour"),
    group_spots: open.group_spots == null ? null : num(open.group_spots),
    series_id: String(open.series_id),
    facility_fee_cents: num(open.facility_fee_cents ?? 0),
    facility_cut_cents: num(open.facility_cut_cents ?? 0),
    for_kind: open.for_kind == null ? "self" : String(open.for_kind),
    for_name: open.for_name == null ? null : String(open.for_name),
    timezone: open.timezone == null ? null : String(open.timezone),
    open_ended: open.open_ended === true || open.open_ended === "t" || open.open_ended === "true",
  };
}

async function insertCopy(sql: Sql, template: TemplateRow, startsAt: string, status: string) {
  await sql`
    insert into lessons (
      coach_user_id, player_user_id, court_id, starts_at, duration_min, sport, status, notes,
      service_id, price_cents, billing, group_spots, series_id, facility_fee_cents,
      facility_cut_cents, for_kind, for_name, timezone, open_ended, cadence_at
    ) values (
      ${template.coach_user_id}, ${template.player_user_id}, ${template.court_id},
      ${startsAt}::timestamp, ${template.duration_min}, ${template.sport}, ${status}, ${template.notes},
      ${template.service_id}, ${template.price_cents}, ${template.billing}, ${template.group_spots},
      ${template.series_id}, ${template.facility_fee_cents}, ${template.facility_cut_cents},
      ${template.for_kind}, ${template.for_name}, ${lessonTimeZone(template.timezone)},
      ${template.open_ended}, ${startsAt}::timestamp
    )
  `;
}

function copiedStatus(rows: { status: string }[]): string {
  const confirmed = rows.some(
    (row) =>
      row.status === "confirmed" || row.status === "checked_in" || row.status === "completed",
  );
  return confirmed ? "confirmed" : "requested";
}

export async function topUpStanding(sql: Sql, scope: { coachId?: string; playerId?: string }) {
  try {
    const seriesRows = scope.coachId
      ? await sql`
          select distinct series_id from lessons
          where coach_user_id = ${scope.coachId}
            and open_ended is true
            and series_id is not null
        `
      : await sql`
          select distinct series_id from lessons
          where open_ended is true
            and series_id is not null
            and (
              player_user_id = ${scope.playerId}
              or player_user_id in (
                select user_id from profiles where guardian_user_id = ${scope.playerId}
              )
            )
        `;
    for (const series of seriesRows) {
      const seriesId = series.series_id == null ? "" : String(series.series_id);
      if (!seriesId) continue;
      await materializeSeries(sql, seriesId);
    }
  } catch (err) {
    if (isMissingScheduleColumn(err)) return;
    console.error("[schedule] standing top-up skipped", err instanceof Error ? err.message : err);
  }
}

async function materializeSeries(sql: Sql, seriesId: string) {
  const rows = await loadSeries(sql, seriesId);
  if (rows.length === 0) return;
  const template = await loadTemplate(sql, seriesId);
  if (!template || !template.open_ended) return;
  const zone = lessonTimeZone(template.timezone);
  const slots = topUpStandingSlots({
    existingCadence: rows.map((row) => row.cadence_at || row.starts_at),
    asOfDate: todayInZone(zone),
  });
  const status = copiedStatus(rows);
  for (const slot of slots) {
    await insertCopy(sql, template, slot, status);
  }
}

async function mailAndNotify(
  sql: Sql,
  notice: { userId: string; title: string; body: string; href: string } | null,
  mail: { kind: LessonMailKind; whenLabel: string; detail: string },
) {
  if (!notice) return;
  let userId = notice.userId;
  if (isAccountlessStudent(userId)) userId = await guardianId(sql, userId);
  if (!userId) return;
  await notify(sql, userId, notice.title, notice.body, notice.href);
  await deliverLessonEmail(sql, userId, mail);
}

export const moveLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.coerce.number(),
      starts_at: z.string().min(10),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertScheduleColumns(sql);
    const rows = await sql`
      select id, series_id, starts_at::text as starts_at, cadence_at::text as cadence_at,
             coach_user_id, player_user_id, status, sport, timezone
      from lessons
      where id = ${data.id}
      limit 1
    `;
    const current = rows[0];
    if (!current) throw new Error("Lesson not found");
    const occurrence = mapOccurrence(current);
    await assertCanTouch(sql, context.userId, occurrence.coach_user_id, occurrence.player_user_id);
    const [moved] = moveSingleLesson([occurrence], occurrence.id, data.starts_at);
    await sql`
      update lessons
      set cadence_at = ${moved.cadence_at}::timestamp,
          starts_at = ${moved.starts_at}::timestamp,
          timezone = coalesce(timezone, ${lessonTimeZone(current.timezone == null ? null : String(current.timezone))})
      where id = ${occurrence.id}
    `;
    const whenLabel = formatWall(moved.starts_at);
    const notice = singleMoveNotice({
      actorId: context.userId,
      coachId: occurrence.coach_user_id,
      playerId: occurrence.player_user_id,
      lessonId: occurrence.id,
      whenLabel,
    });
    await mailAndNotify(sql, notice, {
      kind: "reschedule",
      whenLabel,
      detail: "One lesson moved. Other dates in the series are unchanged.",
    });
    return { ok: true, starts_at: moved.starts_at };
  });

export const shiftLessonSeries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      series_id: z.string().min(8).max(80),
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      local_time: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertScheduleColumns(sql);
    const rows = await loadSeries(sql, data.series_id);
    if (rows.length === 0) throw new Error("Series not found");
    await assertCanTouch(sql, context.userId, rows[0]!.coach_user_id, rows[0]!.player_user_id);
    const shifted = shiftSeriesFromDate(rows, data.series_id, data.from_date, data.local_time);
    const changed = shifted.filter((row, index) => row.starts_at !== rows[index]!.starts_at);
    if (changed.length === 0)
      throw new Error("Nothing on or after that date is still on the board.");
    for (const row of changed) {
      await sql`
        update lessons
        set starts_at = ${row.starts_at}::timestamp,
            cadence_at = ${row.cadence_at}::timestamp
        where id = ${row.id}
      `;
    }
    const first = changed[0]!;
    const timeLabel =
      formatWall(`2000-01-01 ${first.starts_at.slice(11, 19)}`).split(" · ")[1] ?? data.local_time;
    const players = [...new Set(changed.map((row) => row.player_user_id))];
    for (const playerId of players) {
      const sample = changed.find((row) => row.player_user_id === playerId)!;
      const notice = seriesShiftNotice({
        actorId: context.userId,
        coachId: sample.coach_user_id,
        playerId,
        lessonId: sample.id,
        fromDate: data.from_date,
        timeLabel,
      });
      await mailAndNotify(sql, notice, {
        kind: "reschedule",
        whenLabel: `${data.from_date} · ${timeLabel}`,
        detail: "Lessons on that date and after moved. Earlier ones stayed put.",
      });
    }
    return { ok: true, moved: changed.length };
  });

async function appendSeries(sql: Sql, actorId: string, seriesId: string, extraWeeks: number) {
  await assertScheduleColumns(sql);
  const rows = await loadSeries(sql, seriesId);
  if (rows.length === 0) throw new Error("Series not found");
  const template = await loadTemplate(sql, seriesId);
  if (!template) throw new Error("Series not found");
  if (template.open_ended) {
    throw new Error("This standing series already keeps the next 12 weeks on the board.");
  }
  await assertCanTouch(sql, actorId, template.coach_user_id, template.player_user_id);
  const slots = extendAfterLast(
    rows.map((row) => row.cadence_at || row.starts_at),
    extraWeeks,
  );
  const status = copiedStatus(rows);
  const copy = { ...template, open_ended: false };
  for (const slot of slots) await insertCopy(sql, copy, slot, status);
  return { ok: true, added: slots.length };
}

export const extendLessonSeries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      series_id: z.string().min(8).max(80),
      weeks: z.coerce.number().int().min(1).max(52),
    }),
  )
  .handler(async ({ context, data }) => {
    return appendSeries(await getSql(), context.userId, data.series_id, data.weeks);
  });

export const renewLessonSeries = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      series_id: z.string().min(8).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await loadSeries(sql, data.series_id);
    return appendSeries(sql, context.userId, data.series_id, renewWeekCount(rows.length));
  });

export const cancelCoachDay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertScheduleColumns(sql);
    const reason = weatherReason(data.reason);
    const rows = await sql`
      select id, coach_user_id, player_user_id, starts_at::text as starts_at, status
      from lessons
      where coach_user_id = ${context.userId}
        and starts_at >= ${data.day}::timestamp
        and starts_at < (${data.day}::timestamp + interval '1 day')
    `;
    const mapped = rows.map((row) => ({
      id: num(row.id),
      coach_user_id: String(row.coach_user_id),
      player_user_id: String(row.player_user_id),
      starts_at: String(row.starts_at),
      status: String(row.status),
    }));
    const ids = weatherCancelIds(mapped, context.userId, data.day);
    if (ids.length === 0) throw new Error("No open lessons on that day.");
    await sql.query(
      `update lessons set status = 'cancelled', cancel_reason = $1 where id = any($2::int[])`,
      [reason, ids],
    );
    const notices = weatherCancelNotices(mapped, context.userId, data.day, reason);
    for (const notice of notices) {
      await mailAndNotify(sql, notice, {
        kind: "cancel",
        whenLabel: data.day,
        detail: reason,
      });
    }
    return { ok: true, canceled: ids.length };
  });
