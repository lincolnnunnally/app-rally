import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const REQUEST_NOTE_MAX = 1000;

/**
 * The player's note on a lesson request goes to the coach as a notice only.
 * It never lands in lessons.notes (the shared session notes).
 * Only sent when this account (or a child it guards) has a request with that
 * coach from the last 15 minutes.
 */
export const sendLessonRequestNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      coach_user_id: z.string().min(1).max(80),
      note: z.string().trim().min(1).max(REQUEST_NOTE_MAX),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const lesson = (
      await sql`
        select l.id, l.player_user_id, p.display_name
        from lessons l
        left join profiles p on p.user_id = l.player_user_id
        where l.coach_user_id = ${data.coach_user_id}
          and l.status = 'requested'
          and (l.player_user_id = ${me} or p.guardian_user_id = ${me} or exists (select 1 from student_guardian_links sg where sg.student_id = l.player_user_id and sg.user_id = ${me} and sg.revoked_at is null))
          and l.created_at > now() - interval '15 minutes'
        order by l.id desc
        limit 1
      `
    )[0];
    if (!lesson) return { ok: false };
    const who = lesson.display_name == null ? "A player" : String(lesson.display_name);
    await sql`
      insert into notifications (user_id, title, body, href)
      values (
        ${data.coach_user_id},
        ${`Note with ${who}'s request`},
        ${data.note},
        ${`/app/lessons/${Number(lesson.id)}`}
      )
    `;
    return { ok: true };
  });
