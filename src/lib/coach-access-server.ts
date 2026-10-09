import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  assertOwner,
  expiryWall,
  grantIsActive,
  isCouponCode,
  normalizeCouponCode,
  parseAccessTime,
  readCoachAccess,
  resolveCoachAccess,
  type CoachAccess,
} from "@/lib/coach-access";
import { getSql, type Sql } from "@/lib/db";

function num(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value);
  return raw.trim() ? raw : null;
}

/**
 * Coach access label for one coach. Nothing in the product calls this to
 * block a desk, a lesson, or a listing.
 */
export async function getCoachAccess(coachId: string): Promise<CoachAccess> {
  return readCoachAccess(await getSql(), coachId);
}

async function accessForCoaches(
  sql: Sql,
  coachIds: string[],
  now: Date,
): Promise<Map<string, CoachAccess>> {
  const out = new Map<string, CoachAccess>();
  if (coachIds.length === 0) return out;
  const [paidRows, grantRows, couponRows] = await Promise.all([
    sql<{ coach_user_id: string; paid_through: unknown }>`
      select coach_user_id, paid_through::text as paid_through
      from coach_paid_access
      where coach_user_id = any(${coachIds}::text[])
    `,
    sql<{ coach_user_id: string; revoked_at: unknown; expires_at: unknown }>`
      select coach_user_id, revoked_at::text as revoked_at, expires_at::text as expires_at
      from coach_access_grants
      where coach_user_id = any(${coachIds}::text[])
    `,
    sql<{ coach_user_id: string }>`
      select r.coach_user_id
      from coach_coupon_redemptions r
      join coach_access_coupons c on c.id = r.coupon_id
      where r.coach_user_id = any(${coachIds}::text[])
        and c.disabled_at is null
    `,
  ]);
  const paidByCoach = new Map(paidRows.map((row) => [String(row.coach_user_id), row.paid_through]));
  const grantsByCoach = new Map<string, { revokedAt: Date | null; expiresAt: Date | null }[]>();
  for (const row of grantRows) {
    const id = String(row.coach_user_id);
    const list = grantsByCoach.get(id) ?? [];
    list.push({
      revokedAt: parseAccessTime(row.revoked_at),
      expiresAt: parseAccessTime(row.expires_at),
    });
    grantsByCoach.set(id, list);
  }
  const couponCoaches = new Set(couponRows.map((row) => String(row.coach_user_id)));
  for (const id of coachIds) {
    out.set(
      id,
      resolveCoachAccess({
        now,
        paidThrough: parseAccessTime(paidByCoach.get(id)),
        grants: grantsByCoach.get(id) ?? [],
        couponLive: couponCoaches.has(id),
      }),
    );
  }
  return out;
}

export const getOwnerAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    assertOwner(context.isOwner === true);
    const sql = await getSql();
    const now = new Date();
    const [countRows, coachRows, playerRows, teamRows, grantRows, couponRows] = await Promise.all([
      sql<{
        coaches: unknown;
        players: unknown;
        teams: unknown;
        lessons_completed: unknown;
        players_reached: unknown;
      }>`
        select
          (select count(*) from profiles where is_coach = true and user_id not like 'seed:%') as coaches,
          (select count(*) from profiles where is_coach = false and user_id not like 'seed:%') as players,
          (select count(*) from leagues) as teams,
          (select count(*) from lessons where status = 'completed') as lessons_completed,
          (select count(distinct player_user_id) from lessons where status = 'completed') as players_reached
      `,
      sql<{
        user_id: string;
        display_name: string;
        city: string;
        lessons: unknown;
        players: unknown;
      }>`
        select p.user_id, p.display_name, p.city,
          (select count(*) from lessons l where l.coach_user_id = p.user_id) as lessons,
          (select count(distinct l.player_user_id) from lessons l where l.coach_user_id = p.user_id) as players
        from profiles p
        where p.is_coach = true and p.user_id not like 'seed:%'
        order by p.display_name
        limit 300
      `,
      sql<{ user_id: string; display_name: string; city: string; lessons: unknown }>`
        select p.user_id, p.display_name, p.city,
          (select count(*) from lessons l where l.player_user_id = p.user_id) as lessons
        from profiles p
        where p.is_coach = false and p.user_id not like 'seed:%'
        order by p.display_name
        limit 300
      `,
      sql<{
        id: unknown;
        name: string;
        sport: string;
        status: string;
        members: unknown;
        matches: unknown;
      }>`
        select l.id, l.name, l.sport, l.status,
          (select count(*) from league_members m where m.league_id = l.id) as members,
          (select count(*) from matches mt where mt.league_id = l.id) as matches
        from leagues l
        order by l.name
        limit 300
      `,
      sql<{
        id: unknown;
        coach_user_id: string;
        display_name: string | null;
        reason: string;
        expires_at: unknown;
        revoked_at: unknown;
        created_at: unknown;
      }>`
        select g.id, g.coach_user_id, p.display_name, g.reason,
          g.expires_at::text as expires_at, g.revoked_at::text as revoked_at,
          g.created_at::text as created_at
        from coach_access_grants g
        left join profiles p on p.user_id = g.coach_user_id
        order by g.created_at desc
        limit 200
      `,
      sql<{
        id: unknown;
        code: string;
        note: string | null;
        disabled_at: unknown;
        created_at: unknown;
        redemptions: unknown;
      }>`
        select c.id, c.code, c.note, c.disabled_at::text as disabled_at, c.created_at::text as created_at,
          (select count(*) from coach_coupon_redemptions r where r.coupon_id = c.id) as redemptions
        from coach_access_coupons c
        order by c.created_at desc
        limit 200
      `,
    ]);
    const counts = countRows[0];
    const access = await accessForCoaches(
      sql,
      coachRows.map((row) => String(row.user_id)),
      now,
    );
    return {
      counts: {
        coaches: num(counts?.coaches ?? 0),
        players: num(counts?.players ?? 0),
        teams: num(counts?.teams ?? 0),
        lessonsCompleted: num(counts?.lessons_completed ?? 0),
        playersReached: num(counts?.players_reached ?? 0),
      },
      coaches: coachRows.map((row) => ({
        userId: String(row.user_id),
        name: String(row.display_name),
        city: String(row.city),
        lessons: num(row.lessons),
        players: num(row.players),
        access: access.get(String(row.user_id)) ?? "none",
      })),
      players: playerRows.map((row) => ({
        userId: String(row.user_id),
        name: String(row.display_name),
        city: String(row.city),
        lessons: num(row.lessons),
      })),
      teams: teamRows.map((row) => ({
        id: num(row.id),
        name: String(row.name),
        sport: String(row.sport),
        status: String(row.status),
        members: num(row.members),
        matches: num(row.matches),
      })),
      grants: grantRows.map((row) => {
        const revokedAt = parseAccessTime(row.revoked_at);
        const expiresAt = parseAccessTime(row.expires_at);
        return {
          id: num(row.id),
          coachUserId: String(row.coach_user_id),
          coachName: text(row.display_name),
          reason: String(row.reason),
          expiresAt: text(row.expires_at),
          revokedAt: text(row.revoked_at),
          createdAt: text(row.created_at),
          active: grantIsActive({ revokedAt, expiresAt }, now),
        };
      }),
      coupons: couponRows.map((row) => ({
        id: num(row.id),
        code: String(row.code),
        note: text(row.note),
        disabledAt: text(row.disabled_at),
        createdAt: text(row.created_at),
        redemptions: num(row.redemptions),
      })),
    };
  });

export const grantCoachAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      coach_user_id: z.string().min(1).max(200),
      reason: z.string().min(1).max(500),
      expires_on: z.string().max(10).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertOwner(context.isOwner === true);
    const coachUserId = data.coach_user_id.trim();
    const reason = data.reason.trim();
    if (!coachUserId) throw new Error("Choose a coach.");
    if (!reason) throw new Error("A reason is required.");
    const expiresAt = expiryWall(data.expires_on);
    const sql = await getSql();
    await sql`
      insert into coach_access_grants (coach_user_id, reason, expires_at, granted_by)
      values (${coachUserId}, ${reason}, ${expiresAt}, ${context.userId})
    `;
    return { ok: true as const };
  });

export const revokeCoachAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.coerce.number().int().positive() }))
  .handler(async ({ context, data }) => {
    assertOwner(context.isOwner === true);
    const rows = await (await getSql())`
      update coach_access_grants
      set revoked_at = now()
      where id = ${data.id} and revoked_at is null
      returning id
    `;
    if (!rows[0]) throw new Error("That grant is already revoked.");
    return { ok: true as const };
  });

export const createCoachCoupon = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: z.string().min(1).max(64),
      note: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertOwner(context.isOwner === true);
    const code = normalizeCouponCode(data.code);
    if (!isCouponCode(code)) throw new Error("Use 4–32 letters or numbers.");
    const note = data.note?.trim() || null;
    const sql = await getSql();
    try {
      await sql`
        insert into coach_access_coupons (code, note, created_by)
        values (${code}, ${note}, ${context.userId})
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/unique|duplicate/i.test(message)) throw new Error("That code already exists.");
      throw err;
    }
    return { ok: true as const, code };
  });

export const disableCoachCoupon = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.coerce.number().int().positive() }))
  .handler(async ({ context, data }) => {
    assertOwner(context.isOwner === true);
    const rows = await (await getSql())`
      update coach_access_coupons
      set disabled_at = now()
      where id = ${data.id} and disabled_at is null
      returning id
    `;
    if (!rows[0]) throw new Error("That code is already disabled.");
    return { ok: true as const };
  });

export const redeemCoachCoupon = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ code: z.string().min(1).max(64) }))
  .handler(async ({ context, data }) => {
    const code = normalizeCouponCode(data.code);
    if (!isCouponCode(code)) throw new Error("Enter the code you were sent.");
    const sql = await getSql();
    const existing = await sql`
      select id from coach_coupon_redemptions where coach_user_id = ${context.userId} limit 1
    `;
    if (existing[0]) throw new Error("You already redeemed a code.");
    const coupon = await sql<{ id: unknown; disabled_at: unknown }>`
      select id, disabled_at
      from coach_access_coupons
      where lower(code) = lower(${code})
      limit 1
    `;
    if (!coupon[0] || coupon[0].disabled_at != null) throw new Error("That code is not active.");
    try {
      await sql`
        insert into coach_coupon_redemptions (coupon_id, coach_user_id)
        values (${coupon[0].id}, ${context.userId})
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/unique|duplicate/i.test(message)) throw new Error("You already redeemed a code.");
      throw err;
    }
    return { ok: true as const };
  });
