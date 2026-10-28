import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import {
  GROWTH_TEXT_MAX,
  REFLECTION_FIELDS,
  STARTING_FIELDS,
  asGrowthSport,
  cleanText,
  clampRating,
  growthRole,
  parseRatings,
  ratingsToText,
  reflectionEditable,
  type AssessmentKind,
  type GrowthSport,
  type Ratings,
} from "@/lib/growth";
import { lessonScanPath } from "@/lib/lesson-status";
import { parseCoachIds } from "@/lib/students";
import { isGuardianOf } from "@/lib/students-server";

function truthy(v: unknown) {
  return v === true || v === "t" || v === "true";
}

/** A coach of this student: on their coach list, created them, or has taught them. */
async function isCoachOf(sql: Sql, actorId: string, studentId: string) {
  if (!actorId || !studentId || actorId === studentId) return false;
  const row = (await sql`
    select coach_user_ids,
           exists (
             select 1 from lessons l
             where l.player_user_id = ${studentId} and l.coach_user_id = ${actorId}
           ) as taught
    from profiles where user_id = ${studentId} limit 1
  `)[0];
  if (!row) return false;
  return parseCoachIds(row.coach_user_ids).includes(actorId) || truthy(row.taught);
}

async function roleFor(sql: Sql, actorId: string, studentId: string) {
  const [isCoach, isGuardian] = await Promise.all([
    isCoachOf(sql, actorId, studentId),
    isGuardianOf(sql, actorId, studentId),
  ]);
  return growthRole({ actorId, studentId, isCoach, isGuardian });
}

async function notify(sql: Sql, userId: string, title: string, body: string, href: string) {
  if (!userId || userId.startsWith("seed:") || userId.startsWith("student:")) return;
  await sql`
    insert into notifications (user_id, title, body, href)
    values (${userId}, ${title}, ${body}, ${href})
  `;
}

function text(v: unknown) {
  return v == null ? null : String(v);
}

function mapAssessment(r: Record<string, unknown>, viewerId: string) {
  const coachId = String(r.coach_user_id);
  return {
    id: Number(r.id),
    coach_user_id: coachId,
    coach_name: r.coach_name == null ? "Coach" : String(r.coach_name),
    sport: asGrowthSport(r.sport),
    kind: (r.kind === "baseline" ? "baseline" : "checkin") as AssessmentKind,
    assessed_on: String(r.assessed_on).slice(0, 10),
    ratings: parseRatings(r.ratings),
    strengths: text(r.strengths),
    weaknesses: text(r.weaknesses),
    opportunities: text(r.opportunities),
    threats: text(r.threats),
    potential: text(r.potential),
    goals: text(r.goals),
    // Coach-only stays with the coach who wrote it.
    coach_only: viewerId === coachId ? text(r.coach_only) : null,
  };
}

function mapReflection(r: Record<string, unknown>) {
  return {
    lesson_id: Number(r.lesson_id),
    entered_by: String(r.entered_by),
    entered_by_name: r.entered_by_name == null ? null : String(r.entered_by_name),
    did: text(r.did),
    felt: text(r.felt),
    thought: text(r.thought),
    proof: text(r.proof),
    see_next: text(r.see_next),
    confidence: clampRating(r.confidence),
    belief: clampRating(r.belief),
    updated_at: String(r.updated_at),
  };
}

export type GrowthAssessment = ReturnType<typeof mapAssessment>;
export type GrowthReflection = ReturnType<typeof mapReflection>;

/** One student's whole growth page. Private lesson notes are never selected here. */
export const getStudentGrowth = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ student_id: z.string().min(1).max(120) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    const role = await roleFor(sql, me, data.student_id);
    if (!role) throw new Error("This growth page is not yours to see.");
    const student = (await sql`
      select user_id, display_name, plays_tennis, plays_pickleball
      from profiles where user_id = ${data.student_id} limit 1
    `)[0];
    if (!student) throw new Error("That student does not have a profile.");

    const assessments = await sql`
      select a.id, a.coach_user_id, a.sport, a.kind, a.assessed_on::text as assessed_on, a.ratings,
             a.strengths, a.weaknesses, a.opportunities, a.threats, a.potential, a.goals,
             a.coach_only, c.display_name as coach_name
      from student_assessments a
      left join profiles c on c.user_id = a.coach_user_id
      where a.student_id = ${data.student_id}
      order by a.assessed_on, a.id
    `;
    const lessons = await sql`
      select l.id, l.coach_user_id, l.starts_at::text as starts_at, l.duration_min, l.sport,
             l.status, l.notes, l.successes, c.display_name as coach_name
      from lessons l
      left join profiles c on c.user_id = l.coach_user_id
      where l.player_user_id = ${data.student_id}
        and l.status in ('confirmed', 'checked_in', 'completed')
      order by l.starts_at desc
      limit 200
    `;
    const reflections = await sql`
      select r.lesson_id, r.entered_by, r.did, r.felt, r.thought, r.proof, r.see_next,
             r.confidence, r.belief, r.updated_at::text as updated_at,
             e.display_name as entered_by_name
      from lesson_reflections r
      left join profiles e on e.user_id = r.entered_by
      where r.student_id = ${data.student_id}
    `;
    const byLesson = new Map(reflections.map((r) => [Number(r.lesson_id), mapReflection(r)]));

    return {
      role,
      me,
      student: {
        user_id: String(student.user_id),
        display_name: String(student.display_name),
        plays_tennis: truthy(student.plays_tennis),
        plays_pickleball: truthy(student.plays_pickleball),
      },
      assessments: assessments.map((r) => mapAssessment(r, me)),
      lessons: lessons.map((l) => ({
        id: Number(l.id),
        coach_user_id: String(l.coach_user_id),
        coach_name: l.coach_name == null ? "Coach" : String(l.coach_name),
        starts_at: String(l.starts_at),
        duration_min: Number(l.duration_min),
        sport: asGrowthSport(l.sport),
        status: String(l.status),
        notes: text(l.notes),
        successes: text(l.successes),
        reflection: byLesson.get(Number(l.id)) ?? null,
      })),
    };
  });

const ratingsZ = z.record(z.string().regex(/^[a-z_]{1,32}$/), z.coerce.number().int().min(1).max(5));
const longText = z.string().max(GROWTH_TEXT_MAX).optional();

/** Coach writes a starting point or a later check-in. Editing keeps the same row. */
export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.coerce.number().int().positive().optional(),
      student_id: z.string().min(1).max(120),
      sport: z.enum(["tennis", "pickleball"]),
      kind: z.enum(["baseline", "checkin"]),
      assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ratings: ratingsZ,
      strengths: longText,
      weaknesses: longText,
      opportunities: longText,
      threats: longText,
      potential: longText,
      goals: longText,
      coach_only: longText,
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    if (!(await isCoachOf(sql, me, data.student_id))) {
      throw new Error("Only this student's coach can rate them.");
    }
    const sport: GrowthSport = data.sport;
    const ratings = ratingsToText(data.ratings as Ratings, sport);
    const fields = Object.fromEntries(
      STARTING_FIELDS.map((f) => [f.key, cleanText(data[f.key])]),
    ) as Record<(typeof STARTING_FIELDS)[number]["key"], string | null>;
    const coachOnly = cleanText(data.coach_only);

    if (data.id) {
      const existing = (await sql`
        select coach_user_id, student_id from student_assessments where id = ${data.id} limit 1
      `)[0];
      if (!existing || String(existing.coach_user_id) !== me || String(existing.student_id) !== data.student_id) {
        throw new Error("Only the coach who wrote this can change it.");
      }
      await sql`
        update student_assessments set
          sport = ${sport}, kind = ${data.kind}, assessed_on = ${data.assessed_on}, ratings = ${ratings},
          strengths = ${fields.strengths}, weaknesses = ${fields.weaknesses},
          opportunities = ${fields.opportunities}, threats = ${fields.threats},
          potential = ${fields.potential}, goals = ${fields.goals}, coach_only = ${coachOnly},
          updated_at = now()
        where id = ${data.id}
      `;
      return { id: data.id };
    }

    const row = (await sql`
      insert into student_assessments (
        student_id, coach_user_id, sport, kind, assessed_on, ratings,
        strengths, weaknesses, opportunities, threats, potential, goals, coach_only
      ) values (
        ${data.student_id}, ${me}, ${sport}, ${data.kind}, ${data.assessed_on}, ${ratings},
        ${fields.strengths}, ${fields.weaknesses}, ${fields.opportunities}, ${fields.threats},
        ${fields.potential}, ${fields.goals}, ${coachOnly}
      )
      returning id
    `)[0];
    await notify(
      sql,
      data.student_id,
      data.kind === "baseline" ? "Your starting point is written" : "Your coach checked in on your growth",
      data.kind === "baseline"
        ? "Where you are starting from, so you can see how far you come."
        : "New ratings beside where you started.",
      "/app/progress",
    );
    return { id: Number(row?.id) };
  });

async function lessonForReflection(sql: Sql, lessonId: number) {
  return (await sql`
    select id, coach_user_id, player_user_id, status from lessons where id = ${lessonId} limit 1
  `)[0];
}

/** The student's side of one lesson. Coach, player, and guardians read it. */
export const getLessonReflection = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ lesson_id: z.coerce.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const lesson = await lessonForReflection(sql, data.lesson_id);
    if (!lesson) return null;
    const me = context.userId;
    const playerId = String(lesson.player_user_id);
    const isCoach = String(lesson.coach_user_id) === me;
    const isPlayer = playerId === me;
    const isGuardian = !isCoach && !isPlayer && (await isGuardianOf(sql, me, playerId));
    if (!isCoach && !isPlayer && !isGuardian) return null;
    const row = (await sql`
      select r.lesson_id, r.entered_by, r.did, r.felt, r.thought, r.proof, r.see_next,
             r.confidence, r.belief, r.updated_at::text as updated_at,
             e.display_name as entered_by_name
      from lesson_reflections r
      left join profiles e on e.user_id = r.entered_by
      where r.lesson_id = ${data.lesson_id}
      limit 1
    `)[0];
    return {
      reflection: row ? mapReflection(row) : null,
      student_id: playerId,
      canEdit: reflectionEditable(String(lesson.status)),
      role: isCoach ? ("coach" as const) : isPlayer ? ("player" as const) : ("guardian" as const),
    };
  });

export const saveLessonReflection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      lesson_id: z.coerce.number().int().positive(),
      did: longText,
      felt: longText,
      thought: longText,
      proof: longText,
      see_next: longText,
      confidence: z.coerce.number().int().min(1).max(5).nullable().optional(),
      belief: z.coerce.number().int().min(1).max(5).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const lesson = await lessonForReflection(sql, data.lesson_id);
    if (!lesson) throw new Error("Lesson not found");
    const me = context.userId;
    const coachId = String(lesson.coach_user_id);
    const playerId = String(lesson.player_user_id);
    const allowed =
      me === coachId || me === playerId || (await isGuardianOf(sql, me, playerId));
    if (!allowed) throw new Error("This lesson is not yours.");
    if (!reflectionEditable(String(lesson.status))) {
      throw new Error("Reflections are written on upcoming or completed lessons.");
    }
    const f = Object.fromEntries(
      REFLECTION_FIELDS.map((field) => [field.key, cleanText(data[field.key])]),
    ) as Record<(typeof REFLECTION_FIELDS)[number]["key"], string | null>;
    const confidence = clampRating(data.confidence);
    const belief = clampRating(data.belief);
    if (!Object.values(f).some(Boolean) && confidence == null && belief == null) {
      throw new Error("Write one line or pick a number first.");
    }
    const first = !(await sql`select 1 from lesson_reflections where lesson_id = ${data.lesson_id}`)[0];
    await sql`
      insert into lesson_reflections (
        lesson_id, student_id, entered_by, did, felt, thought, proof, see_next, confidence, belief
      ) values (
        ${data.lesson_id}, ${playerId}, ${me}, ${f.did}, ${f.felt}, ${f.thought}, ${f.proof},
        ${f.see_next}, ${confidence}, ${belief}
      )
      on conflict (lesson_id) do update set
        entered_by = excluded.entered_by, did = excluded.did, felt = excluded.felt,
        thought = excluded.thought, proof = excluded.proof, see_next = excluded.see_next,
        confidence = excluded.confidence, belief = excluded.belief, updated_at = now()
    `;
    if (first && me !== coachId) {
      const who = (await sql`select display_name from profiles where user_id = ${playerId} limit 1`)[0];
      await notify(
        sql,
        coachId,
        `${who?.display_name ?? "Your student"} wrote about the lesson`,
        "What they did, felt, and thought. Read it before next time.",
        lessonScanPath(data.lesson_id),
      );
    }
    return { ok: true };
  });

/** Growth pages this account can open as a student or guardian: self, then each kid. */
export const myGrowthPages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = await sql`
      select p.user_id, p.display_name,
             (select count(*) from lessons l where l.player_user_id = p.user_id
                and l.status in ('confirmed', 'checked_in', 'completed')) as lessons,
             (select count(*) from student_assessments a where a.student_id = p.user_id) as ratings
      from profiles p
      where p.user_id = ${me}
         or p.guardian_user_id = ${me}
         or exists (
           select 1 from student_guardian_links sg
           where sg.student_id = p.user_id and sg.user_id = ${me} and sg.revoked_at is null
         )
      order by (p.user_id = ${me}) desc, p.display_name
    `;
    return rows.map((r) => ({
      user_id: String(r.user_id),
      display_name: String(r.display_name),
      self: String(r.user_id) === me,
      lessons: Number(r.lessons),
      ratings: Number(r.ratings),
    }));
  });
