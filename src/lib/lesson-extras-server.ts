import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { lessonNotesEditable } from "@/lib/lesson-notes";

export const LESSON_SUCCESSES_MAX = 400;

/** Coach "successes" on a lesson. The coach writes them; the player and guardian read them. */
export const getLessonSuccesses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.coerce.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = (
      await sql`
        select l.coach_user_id, l.player_user_id, l.status, l.successes, p.guardian_user_id,
               exists (select 1 from student_guardian_links sg where sg.student_id = l.player_user_id and sg.user_id = ${context.userId} and sg.revoked_at is null) as linked
        from lessons l
        left join profiles p on p.user_id = l.player_user_id
        where l.id = ${data.id}
        limit 1
      `
    )[0];
    if (!row) return null;
    const me = context.userId;
    const isCoach = String(row.coach_user_id) === me;
    const allowed =
      isCoach || String(row.player_user_id) === me || String(row.guardian_user_id ?? "") === me ||
      row.linked === true ||
      row.linked === "t";
    if (!allowed) return null;
    return {
      successes: row.successes == null ? null : String(row.successes),
      canEdit: isCoach && lessonNotesEditable(String(row.status)),
    };
  });

export const saveLessonSuccesses = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.coerce.number().int().positive(),
      successes: z.string().max(LESSON_SUCCESSES_MAX),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = (
      await sql`select coach_user_id, status from lessons where id = ${data.id} limit 1`
    )[0];
    if (!row || String(row.coach_user_id) !== context.userId) {
      throw new Error("Only the coach can write successes.");
    }
    if (!lessonNotesEditable(String(row.status))) {
      throw new Error("Successes can be written on upcoming or completed lessons.");
    }
    const text = data.successes.trim() || null;
    await sql`update lessons set successes = ${text} where id = ${data.id}`;
    return { successes: text };
  });

/** Cash App / Venmo handles for the coaches on this player's (or their kids') lessons. */
export const myCoachPayHandles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql`
      select distinct p.user_id, p.display_name, c.cash_app_handle, c.venmo_handle
      from lessons l
      join profiles p on p.user_id = l.coach_user_id
      join coach_profiles c on c.user_id = l.coach_user_id
      left join profiles kid on kid.user_id = l.player_user_id
      where (l.player_user_id = ${context.userId} or kid.guardian_user_id = ${context.userId}
             or exists (select 1 from student_guardian_links sg where sg.student_id = l.player_user_id and sg.user_id = ${context.userId} and sg.revoked_at is null))
        and l.coach_user_id <> ${context.userId}
        and l.status in ('confirmed', 'checked_in', 'completed')
        and (coalesce(c.cash_app_handle, '') <> '' or coalesce(c.venmo_handle, '') <> '')
      order by p.display_name
    `;
    return rows.map((r) => ({
      coach_user_id: String(r.user_id),
      coach_name: String(r.display_name),
      cash_app_handle: r.cash_app_handle == null ? null : String(r.cash_app_handle),
      venmo_handle: r.venmo_handle == null ? null : String(r.venmo_handle),
    }));
  });

/**
 * Lessons for every kid this account guards (primary or linked guardian). Shared notes and
 * successes only; private coach notes are never selected here.
 */
export const listGuardedKidLessons = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = await sql`
      select l.id, l.player_user_id, l.starts_at::text as starts_at, l.status, l.notes, l.successes,
             c.display_name as coach_name
      from lessons l
      join profiles kid on kid.user_id = l.player_user_id
      left join profiles c on c.user_id = l.coach_user_id
      where (
        kid.guardian_user_id = ${me}
        or exists (
          select 1 from student_guardian_links sg
          where sg.student_id = l.player_user_id and sg.user_id = ${me} and sg.revoked_at is null
        )
      )
        and l.status in ('requested', 'confirmed', 'checked_in', 'completed')
      order by l.starts_at desc
      limit 40
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      player_user_id: String(r.player_user_id),
      starts_at: String(r.starts_at),
      status: String(r.status),
      notes: r.notes == null ? null : String(r.notes),
      successes: r.successes == null ? null : String(r.successes),
      coach_name: r.coach_name == null ? "Coach" : String(r.coach_name),
    }));
  });
