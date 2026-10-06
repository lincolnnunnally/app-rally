import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { LESSON_NOTES_MAX, canActorSaveLessonNotes } from "@/lib/lesson-notes";
import {
  addCoachId,
  canFinishStudent,
  claimPath,
  isClaimCode,
  newClaimCode,
  newStudentUserId,
  canCoachSchedulePlayer,
  NOT_ON_ROSTER,
  parseCoachIds,
  parsePublicFields,
  publicFieldsToText,
} from "@/lib/students";

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v);
}

export async function assertCoachCanSchedulePlayer(sql: Sql, coachId: string, playerId: string) {
  if (playerId === coachId) return;
  const row = (await sql`
    select coach_user_ids from profiles where user_id = ${playerId} limit 1
  `)[0];
  if (
    !canCoachSchedulePlayer({
      coachId,
      playerId,
      coachUserIds: row?.coach_user_ids,
    })
  ) {
    throw new Error(NOT_ON_ROSTER);
  }
}

export async function connectCoach(sql: Sql, playerId: string, coachId: string) {
  if (!playerId || !coachId || playerId === coachId) return;
  const row = (await sql`
    select coach_user_ids from profiles where user_id = ${playerId} limit 1
  `)[0];
  if (!row) return;
  const next = JSON.stringify(addCoachId(parseCoachIds(row.coach_user_ids), coachId));
  await sql`
    update profiles set coach_user_ids = ${next}, updated_at = now()
    where user_id = ${playerId}
  `;
}

export async function resolveScheduledPlayer(sql: Sql, actorId: string, requested?: string | null) {
  const playerId = requested && requested !== actorId ? requested : actorId;
  if (playerId === actorId) return playerId;
  const row = (await sql`
    select guardian_user_id from profiles where user_id = ${playerId} limit 1
  `)[0];
  if (!row) throw new Error("That student does not have a profile.");
  if (String(row.guardian_user_id ?? "") !== actorId) {
    throw new Error("Only their guardian can schedule that student.");
  }
  return playerId;
}

async function notify(sql: Sql, userId: string, title: string, body: string, href: string) {
  if (!userId || userId.startsWith("seed:") || userId.startsWith("student:")) return;
  await sql`
    insert into notifications (user_id, title, body, href)
    values (${userId}, ${title}, ${body}, ${href})
  `;
}

export async function coachStudents(sql: Sql, coachId: string) {
  const rows = await sql`
    select p.user_id, p.display_name, p.city, p.claim_code, p.guardian_user_id,
           p.plays_tennis, p.plays_pickleball
    from profiles p
    where p.user_id <> ${coachId}
      and p.user_id not like 'seed:%'
      and (
        p.coach_user_ids::jsonb ? ${coachId}
        or exists (
          select 1 from lessons l
          where l.player_user_id = p.user_id and l.coach_user_id = ${coachId}
        )
      )
    order by p.display_name
  `;
  return rows.map((row) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    city: String(row.city ?? "Vidalia"),
    claim_code: row.claim_code == null ? null : String(row.claim_code),
    claimed: row.guardian_user_id != null && String(row.guardian_user_id) !== "",
    plays_tennis: row.plays_tennis === true || row.plays_tennis === "t" || row.plays_tennis === "true",
    plays_pickleball:
      row.plays_pickleball === true || row.plays_pickleball === "t" || row.plays_pickleball === "true",
  }));
}

async function markCoach(sql: Sql, userId: string) {
  await sql`update profiles set is_coach = true, updated_at = now() where user_id = ${userId}`;
  await sql`insert into coach_profiles (user_id) values (${userId}) on conflict do nothing`;
}

const nameZ = z.string().trim().min(1).max(80);

export const createStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ display_name: nameZ }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await markCoach(sql, context.userId);
    const userId = newStudentUserId();
    const code = newClaimCode();
    const coaches = JSON.stringify([context.userId]);
    await sql`
      insert into profiles (
        user_id, display_name, city, onboarded, plays_pickleball, plays_tennis,
        looking_for_partners, looking_for_coach, interested_in_leagues, is_coach,
        claim_code, coach_user_ids, public_fields
      ) values (
        ${userId}, ${data.display_name}, 'Vidalia', false, true, false,
        false, false, false, false,
        ${code}, ${coaches}, ''
      )
    `;
    return {
      user_id: userId,
      display_name: data.display_name,
      claim_code: code,
      claim_path: claimPath(code),
    };
  });

export const registerChild = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ display_name: nameZ }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = newStudentUserId();
    await sql`
      insert into profiles (
        user_id, display_name, city, onboarded, plays_pickleball, plays_tennis,
        looking_for_partners, looking_for_coach, interested_in_leagues, is_coach,
        guardian_user_id, coach_user_ids, public_fields
      ) values (
        ${userId}, ${data.display_name}, 'Vidalia', false, true, false,
        false, false, false, false,
        ${context.userId}, '[]', ''
      )
    `;
    return { user_id: userId, display_name: data.display_name };
  });

export const lookupClaim = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().min(8).max(64) }))
  .handler(async ({ data }) => {
    const code = data.code.trim();
    if (!isClaimCode(code)) return null;
    const sql = await getSql();
    const row = (await sql`
      select display_name, city, guardian_user_id, coach_user_ids
      from profiles
      where claim_code = ${code}
      limit 1
    `)[0];
    if (!row) return null;
    const coachIds = parseCoachIds(row.coach_user_ids);
    let coachName: string | null = null;
    if (coachIds[0]) {
      const coach = (await sql`
        select display_name from profiles where user_id = ${coachIds[0]} limit 1
      `)[0];
      coachName = coach?.display_name == null ? null : String(coach.display_name);
    }
    return {
      display_name: String(row.display_name),
      city: String(row.city ?? "Vidalia"),
      claimed: row.guardian_user_id != null && String(row.guardian_user_id) !== "",
      coach_name: coachName,
    };
  });

export const claimStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ code: z.string().min(8).max(64) }))
  .handler(async ({ context, data }) => {
    const code = data.code.trim();
    if (!isClaimCode(code)) throw new Error("That claim link is not valid.");
    const sql = await getSql();
    const row = (await sql`
      select user_id, display_name, guardian_user_id, coach_user_ids
      from profiles
      where claim_code = ${code}
      limit 1
    `)[0];
    if (!row) throw new Error("That claim link is not valid.");
    const existing = row.guardian_user_id == null ? "" : String(row.guardian_user_id);
    if (existing && existing !== context.userId) throw new Error("This student is already claimed.");
    const userId = String(row.user_id);
    const displayName = String(row.display_name);
    if (!existing) {
      await sql`
        update profiles set guardian_user_id = ${context.userId}, updated_at = now()
        where user_id = ${userId}
      `;
      for (const coachId of parseCoachIds(row.coach_user_ids)) {
        await notify(
          sql,
          coachId,
          "Student claimed",
          `${displayName} was claimed by a parent. They can finish the profile and schedule the next lesson.`,
          "/app/desk",
        );
      }
    }
    return { user_id: userId, display_name: displayName };
  });

const finishZ = z.object({
  user_id: z.string().min(1).max(80),
  display_name: nameZ,
  city: z.string().trim().min(1).max(60),
  phone: z.string().max(40).optional(),
  bio: z.string().max(600).optional(),
  availability: z.string().max(240).optional(),
  plays_tennis: z.boolean(),
  plays_pickleball: z.boolean(),
  tennis_level: z.string().max(20).optional(),
  pickleball_level: z.string().max(20).optional(),
  dupr: z.string().max(12).optional(),
  utr: z.string().max(12).optional(),
  experience: z.string().max(400).optional(),
  public_bio: z.boolean(),
  public_levels: z.boolean(),
  public_ratings: z.boolean(),
  public_experience: z.boolean(),
  public_photo: z.boolean(),
  public_availability: z.boolean(),
});

export const finishStudentProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(finishZ)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const row = (await sql`
      select user_id, guardian_user_id from profiles where user_id = ${data.user_id} limit 1
    `)[0];
    if (!row) throw new Error("Student not found.");
    const guardian = row.guardian_user_id == null ? null : String(row.guardian_user_id);
    if (
      !canFinishStudent({
        actorId: context.userId,
        studentUserId: String(row.user_id),
        guardianUserId: guardian,
      })
    ) {
      throw new Error("Only the guardian can finish this profile.");
    }
    const fields = publicFieldsToText([
      data.public_bio ? "bio" : "",
      data.public_levels ? "levels" : "",
      data.public_ratings ? "ratings" : "",
      data.public_experience ? "experience" : "",
      data.public_photo ? "photo" : "",
      data.public_availability ? "availability" : "",
    ]);
    await sql`
      update profiles set
        display_name = ${data.display_name},
        city = ${data.city},
        phone = ${data.phone?.trim() || null},
        bio = ${data.bio?.trim() || null},
        availability = ${data.availability?.trim() || null},
        plays_tennis = ${data.plays_tennis},
        plays_pickleball = ${data.plays_pickleball},
        tennis_level = ${data.tennis_level?.trim() || null},
        pickleball_level = ${data.pickleball_level?.trim() || null},
        dupr = ${data.dupr?.trim() || null},
        utr = ${data.utr?.trim() || null},
        experience = ${data.experience?.trim() || null},
        public_fields = ${fields},
        updated_at = now()
      where user_id = ${data.user_id}
    `;
    return { ok: true };
  });

function mapChild(row: Record<string, unknown>) {
  const flag = (v: unknown) => v === true || v === "t" || v === "true";
  const text = (v: unknown) => (v == null || String(v) === "" ? null : String(v));
  return {
    user_id: String(row.user_id),
    display_name: String(row.display_name),
    city: String(row.city ?? "Vidalia"),
    phone: text(row.phone),
    bio: text(row.bio),
    availability: text(row.availability),
    plays_tennis: flag(row.plays_tennis),
    plays_pickleball: flag(row.plays_pickleball),
    tennis_level: text(row.tennis_level),
    pickleball_level: text(row.pickleball_level),
    dupr: text(row.dupr),
    utr: text(row.utr),
    experience: text(row.experience),
    public_fields: parsePublicFields(row.public_fields),
    coach_user_ids: parseCoachIds(row.coach_user_ids),
    claim_code: text(row.claim_code),
  };
}

export const listHousehold = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const children = (
      await sql`
        select user_id, display_name, city, phone, bio, availability, plays_tennis, plays_pickleball,
               tennis_level, pickleball_level, dupr, utr, experience, public_fields, coach_user_ids, claim_code
        from profiles
        where guardian_user_id = ${context.userId}
        order by display_name
      `
    ).map((row) => mapChild(row));
    const courts = (
      await sql`
        select id, name from courts
        where status = 'open'
        order by is_other, name
      `
    ).map((row) => ({ id: num(row.id), name: String(row.name) }));
    const coaches = (
      await sql`
        select p.user_id, p.display_name
        from profiles p
        join coach_profiles c on c.user_id = p.user_id
        where p.is_coach = true and p.onboarded = true and p.user_id not like 'seed:%'
        order by p.display_name
      `
    ).map((row) => ({ user_id: String(row.user_id), display_name: String(row.display_name) }));
    const known = new Set(coaches.map((coach) => coach.user_id));
    const missing = [...new Set(children.flatMap((child) => child.coach_user_ids))].filter(
      (id) => !known.has(id),
    );
    for (const id of missing) {
      const row = (await sql`
        select display_name from profiles where user_id = ${id} limit 1
      `)[0];
      if (row) coaches.push({ user_id: id, display_name: String(row.display_name) });
    }
    coaches.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return { children, courts, coaches };
  });

export const savePrivateLessonNotes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    id: z.coerce.number(),
    notes: z.string().max(LESSON_NOTES_MAX),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const lesson = (await sql`
      select coach_user_id, status from lessons where id = ${data.id} limit 1
    `)[0];
    if (!lesson) throw new Error("Lesson not found");
    const gate = canActorSaveLessonNotes({
      actorId: context.userId,
      coachId: String(lesson.coach_user_id),
      status: String(lesson.status),
    });
    if (!gate.ok) throw new Error(gate.error);
    const notes = data.notes.trim() || null;
    await sql`update lessons set private_notes = ${notes} where id = ${data.id}`;
    return { ok: true, notes };
  });
