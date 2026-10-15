/**
 * Free coach access. Status is a label only — nothing in Rally blocks a coach
 * on this value yet. 'paid' is reserved for a future paid period; this change
 * does not charge anyone.
 */

export type CoachAccess = "paid" | "granted" | "coupon" | "none";

export class OwnerOnlyError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "OwnerOnlyError";
  }
}

/** Server functions that list or change grants and coupons call this first. */
export function assertOwner(isOwner: boolean): void {
  if (!isOwner) throw new OwnerOnlyError();
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isCouponCode(code: string): boolean {
  return /^[A-Z0-9]{4,32}$/.test(code);
}

/** Empty means no expiry. A calendar date lasts through that UTC day. */
export function expiryWall(date: string | null | undefined): string | null {
  const value = date?.trim() ?? "";
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expiry must be a date.");
  }
  return `${value} 23:59:59`;
}

export function parseAccessTime(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function grantIsActive(
  grant: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date,
): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Precedence: an unexpired paid period, then an active owner grant, then a
 * redemption of a coupon that is still enabled, otherwise none.
 */
export function resolveCoachAccess(input: {
  now: Date;
  paidThrough: Date | null;
  grants: { revokedAt: Date | null; expiresAt: Date | null }[];
  couponLive: boolean;
}): CoachAccess {
  if (input.paidThrough && input.paidThrough.getTime() > input.now.getTime()) return "paid";
  if (input.grants.some((grant) => grantIsActive(grant, input.now))) return "granted";
  if (input.couponLive) return "coupon";
  return "none";
}

type AccessRow = Record<string, unknown>;

export type AccessSql = {
  <T = AccessRow>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

/** Same rules as getCoachAccess, with the caller supplying SQL and the clock. */
export async function readCoachAccess(
  sql: AccessSql,
  coachId: string,
  now = new Date(),
): Promise<CoachAccess> {
  const [paidRows, grantRows, couponRows] = await Promise.all([
    sql<{ paid_through: unknown }>`
      select paid_through::text as paid_through
      from coach_paid_access
      where coach_user_id = ${coachId}
      limit 1
    `,
    sql<{ revoked_at: unknown; expires_at: unknown }>`
      select revoked_at::text as revoked_at, expires_at::text as expires_at
      from coach_access_grants
      where coach_user_id = ${coachId}
    `,
    sql<{ id: unknown }>`
      select r.id
      from coach_coupon_redemptions r
      join coach_access_coupons c on c.id = r.coupon_id
      where r.coach_user_id = ${coachId}
        and c.disabled_at is null
      limit 1
    `,
  ]);
  return resolveCoachAccess({
    now,
    paidThrough: parseAccessTime(paidRows[0]?.paid_through),
    grants: grantRows.map((row) => ({
      revokedAt: parseAccessTime(row.revoked_at),
      expiresAt: parseAccessTime(row.expires_at),
    })),
    couponLive: Boolean(couponRows[0]),
  });
}
