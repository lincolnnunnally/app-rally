/**
 * Lesson-cap reservation. Call inside a database transaction.
 *
 * `prepareLessonFeeMonth` locks this coach's month rows (`INSERT … ON CONFLICT`
 * plus `FOR UPDATE`). Concurrent checkouts for the same coach block on that
 * lock, then each reads the fees already recorded — including the one the
 * other transaction just added — so the $50 cap cannot be exceeded by a race.
 */
import {
  platformFeeCents,
  type PlatformFeeConfig,
} from "./platform-fee.ts";

export interface FeeSql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
}

export async function prepareLessonFeeMonth(
  sql: FeeSql,
  payeeUserId: string,
  month: string,
): Promise<void> {
  await sql`
    insert into platform_fee_months (payee_user_id, month_key, fee_cents)
    values (${payeeUserId}, ${month}, 0)
    on conflict (payee_user_id, month_key)
    do update set fee_cents = platform_fee_months.fee_cents
  `;
  await sql`
    select fee_cents from platform_fee_months
    where payee_user_id = ${payeeUserId}
    for update
  `;
}

export async function addLessonPlatformFee(
  sql: FeeSql,
  input: {
    payeeUserId: string;
    monthKey: string;
    grossCents: number;
    config: PlatformFeeConfig;
  },
): Promise<number> {
  const rows = await sql<{ fee_cents: number | string }>`
    select fee_cents from platform_fee_months
    where payee_user_id = ${input.payeeUserId} and month_key = ${input.monthKey}
  `;
  const recorded = Number(rows[0]?.fee_cents ?? 0);
  const fee = platformFeeCents({
    source: "lesson",
    grossCents: input.grossCents,
    recordedLessonFeesCents: recorded,
    config: input.config,
  }).feeCents;
  if (fee > 0) {
    await sql`
      update platform_fee_months
      set fee_cents = fee_cents + ${fee}
      where payee_user_id = ${input.payeeUserId} and month_key = ${input.monthKey}
    `;
  }
  return fee;
}

export async function subtractLessonPlatformFee(
  sql: FeeSql,
  input: { payeeUserId: string; monthKey: string | null; cents: number },
): Promise<void> {
  if (input.cents <= 0 || !input.monthKey) return;
  await sql`
    update platform_fee_months
    set fee_cents = greatest(0, fee_cents - ${input.cents})
    where payee_user_id = ${input.payeeUserId} and month_key = ${input.monthKey}
  `;
}

/** Drop abandoned lesson checkouts and give their reserved fee back to the cap. */
export async function releaseExpiredLessonFees(
  sql: FeeSql,
  payeeUserId: string,
  nowIso: string,
): Promise<void> {
  const rows = await sql<{ platform_fee_cents: number | string; month_key: string | null }>`
    update payments
    set status = 'expired', fee_reserved = false
    where source = 'lesson'
      and payee_user_id = ${payeeUserId}
      and status = 'pending'
      and fee_reserved = true
      and expires_at is not null
      and expires_at <= ${nowIso}::timestamptz
    returning platform_fee_cents, month_key
  `;
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const month = row.month_key == null ? "" : String(row.month_key);
    if (!month) continue;
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(row.platform_fee_cents));
  }
  for (const [month, cents] of byMonth) {
    await subtractLessonPlatformFee(sql, { payeeUserId, monthKey: month, cents });
  }
}
