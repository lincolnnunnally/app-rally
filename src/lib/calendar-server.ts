import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  calendarPath,
  feedWindow,
  isCalendarToken,
  newCalendarToken,
  selectFeedLessons,
  toFeedLesson,
  type FeedLesson,
  type FeedRole,
} from "@/lib/calendar";
import { getSql, type Sql } from "@/lib/db";
import { DEFAULT_LESSON_TIMEZONE, todayInZone } from "@/lib/schedule";

const WINDOW_ROLE = z.enum(["coach", "player"]);

export async function ensureCalendarToken(sql: Sql, userId: string): Promise<string> {
  const existing = await sql`select token from calendar_feeds where user_id = ${userId} limit 1`;
  const current = existing[0]?.token;
  if (typeof current === "string" && isCalendarToken(current)) return current;
  return rotateCalendarToken(sql, userId);
}

export async function rotateCalendarToken(sql: Sql, userId: string): Promise<string> {
  const token = newCalendarToken();
  await sql`
    insert into calendar_feeds (user_id, token, rotated_at)
    values (${userId}, ${token}, now())
    on conflict (user_id) do update
      set token = excluded.token,
          rotated_at = now()
  `;
  return token;
}

export async function findCalendarUserId(sql: Sql, token: string): Promise<string | null> {
  if (!isCalendarToken(token)) return null;
  const rows = await sql`select user_id from calendar_feeds where token = ${token} limit 1`;
  const id = rows[0]?.user_id;
  return typeof id === "string" && id ? id : null;
}

export async function loadVisibleLessons(
  sql: Sql,
  userId: string,
  role: FeedRole,
  now = new Date(),
): Promise<FeedLesson[]> {
  const asOf = todayInZone(DEFAULT_LESSON_TIMEZONE, now);
  const window = feedWindow(asOf);
  const rows = await sql`
    select l.id,
           l.starts_at::text as starts_at,
           l.duration_min,
           l.sport,
           l.status,
           l.notes,
           l.timezone,
           l.cancel_reason,
           l.created_at::text as created_at,
           l.updated_at::text as updated_at,
           l.coach_user_id,
           l.player_user_id,
           c.name as court_name,
           pc.display_name as coach_name,
           pp.display_name as player_name,
           pp.guardian_user_id as guardian_user_id,
           sv.name as service_name
    from lessons l
    left join courts c on c.id = l.court_id
    left join profiles pc on pc.user_id = l.coach_user_id
    left join profiles pp on pp.user_id = l.player_user_id
    left join coach_services sv on sv.id = l.service_id
    where l.status <> 'declined'
      and l.starts_at >= ${window.start}::timestamp
      and l.starts_at < (${window.end}::date + interval '1 day')
      and (
        (${role} = 'coach' and l.coach_user_id = ${userId})
        or (
          ${role} = 'player'
          and (l.player_user_id = ${userId} or pp.guardian_user_id = ${userId})
        )
        or (
          ${role} = 'any'
          and (
            l.coach_user_id = ${userId}
            or l.player_user_id = ${userId}
            or pp.guardian_user_id = ${userId}
          )
        )
      )
    order by l.starts_at, l.id
  `;
  return selectFeedLessons(
    userId,
    rows.map((row) => toFeedLesson(row)),
    asOf,
    role,
  );
}

export const getCalendarSubscription = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const token = await ensureCalendarToken(sql, context.userId);
    return { path: calendarPath(token) };
  });

export const resetCalendarSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const token = await rotateCalendarToken(sql, context.userId);
    return { path: calendarPath(token) };
  });

export const listFeedLessons = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ role: WINDOW_ROLE }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return loadVisibleLessons(sql, context.userId, data.role);
  });
