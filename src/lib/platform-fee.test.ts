import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  addLessonPlatformFee,
  prepareLessonFeeMonth,
  type FeeSql,
} from "./platform-fee-reserve.ts";
import {
  monthKey,
  platformFeeCents,
  readPlatformFeeConfig,
  type PlatformFeeConfig,
} from "./platform-fee.ts";

const config: PlatformFeeConfig = {
  lessonPct: 5,
  lessonCapCents: 5000,
  courtPct: 5,
  leaguePct: 5,
  timeZone: "America/New_York",
};

describe("platformFeeCents", () => {
  it("takes 5% of a paid lesson", () => {
    const fee = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 0,
      config,
    });
    assert.equal(fee.feeCents, 500);
    assert.equal(fee.capped, false);
  });

  it("fills only the remaining cap when a lesson would cross $50", () => {
    const fee = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 4800,
      config,
    });
    assert.equal(fee.feeCents, 200);
    assert.equal(fee.capped, true);
  });

  it("is zero once recorded fees reach $50", () => {
    const atCap = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 5000,
      config,
    });
    assert.equal(atCap.feeCents, 0);
    assert.equal(atCap.capped, true);
    const over = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 5001,
      config,
    });
    assert.equal(over.feeCents, 0);
  });

  it("charges the last cent of cap room", () => {
    const fee = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 4999,
      config,
    });
    assert.equal(fee.feeCents, 1);
    assert.equal(fee.capped, true);
  });

  it("stops a sequence of $100 lessons at $50", () => {
    let recorded = 0;
    const fees: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const fee = platformFeeCents({
        source: "lesson",
        grossCents: 10000,
        recordedLessonFeesCents: recorded,
        config,
      }).feeCents;
      fees.push(fee);
      recorded += fee;
    }
    assert.deepEqual(fees, [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 0]);
    assert.equal(recorded, 5000);
  });

  it("does not cap court bookings or league entry fees", () => {
    const court = platformFeeCents({
      source: "court",
      grossCents: 200000,
      recordedLessonFeesCents: 5000,
      config,
    });
    assert.equal(court.feeCents, 10000);
    assert.equal(court.capped, false);
    const league = platformFeeCents({
      source: "league",
      grossCents: 4000,
      recordedLessonFeesCents: 5000,
      config,
    });
    assert.equal(league.feeCents, 200);
    assert.equal(league.capped, false);
  });

  it("rounds half cents and stays inside the charge", () => {
    assert.equal(
      platformFeeCents({ source: "court", grossCents: 10, recordedLessonFeesCents: 0, config }).feeCents,
      1,
    );
    assert.equal(
      platformFeeCents({ source: "court", grossCents: 30, recordedLessonFeesCents: 0, config }).feeCents,
      2,
    );
    assert.equal(
      platformFeeCents({ source: "court", grossCents: 333, recordedLessonFeesCents: 0, config }).feeCents,
      17,
    );
    assert.equal(
      platformFeeCents({ source: "lesson", grossCents: 1, recordedLessonFeesCents: 0, config }).feeCents,
      0,
    );
    assert.equal(
      platformFeeCents({ source: "lesson", grossCents: 0, recordedLessonFeesCents: 0, config }).feeCents,
      0,
    );
  });

  it("is zero when the percent is zero", () => {
    const fee = platformFeeCents({
      source: "lesson",
      grossCents: 10000,
      recordedLessonFeesCents: 0,
      config: { ...config, lessonPct: 0 },
    });
    assert.equal(fee.feeCents, 0);
  });
});

describe("monthKey", () => {
  it("uses the Eastern calendar month across the UTC boundary", () => {
    assert.equal(monthKey(new Date("2026-10-01T03:30:00Z"), "America/New_York"), "2026-09");
    assert.equal(monthKey(new Date("2026-10-01T04:00:00Z"), "America/New_York"), "2026-10");
  });
});

describe("readPlatformFeeConfig", () => {
  it("defaults to 5% and a $50 lesson cap", () => {
    const c = readPlatformFeeConfig({});
    assert.equal(c.lessonPct, 5);
    assert.equal(c.lessonCapCents, 5000);
    assert.equal(c.courtPct, 5);
    assert.equal(c.leaguePct, 5);
    assert.equal(c.timeZone, "America/New_York");
  });

  it("reads env overrides", () => {
    const c = readPlatformFeeConfig({
      PLATFORM_FEE_LESSON_PCT: "7.5",
      PLATFORM_FEE_LESSON_CAP_CENTS: "2500",
      PLATFORM_FEE_COURT_PCT: "3",
      PLATFORM_FEE_LEAGUE_PCT: "4",
      PLATFORM_FEE_TIMEZONE: "America/Chicago",
    });
    assert.equal(c.lessonPct, 7.5);
    assert.equal(c.lessonCapCents, 2500);
    assert.equal(c.courtPct, 3);
    assert.equal(c.leaguePct, 4);
    assert.equal(c.timeZone, "America/Chicago");
  });

  it("keeps defaults when an override is junk", () => {
    const c = readPlatformFeeConfig({
      PLATFORM_FEE_LESSON_PCT: "nope",
      PLATFORM_FEE_LESSON_CAP_CENTS: "-1",
      PLATFORM_FEE_COURT_PCT: "150",
      PLATFORM_FEE_TIMEZONE: "Not/AZone",
    });
    assert.equal(c.lessonPct, 5);
    assert.equal(c.lessonCapCents, 5000);
    assert.equal(c.courtPct, 5);
    assert.equal(c.timeZone, "America/New_York");
  });
});

describe("lesson cap reservation", () => {
  it("concurrent checkouts stop at $50", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(`
      create table platform_fee_months (
        payee_user_id text not null,
        month_key text not null,
        fee_cents integer not null default 0,
        primary key (payee_user_id, month_key)
      );
    `);
    const fees = await Promise.all(
      Array.from({ length: 12 }, () =>
        pg.transaction(async (tx) => {
          const sql = toFeeSql(tx);
          await prepareLessonFeeMonth(sql, "coach-1", "2026-09");
          return addLessonPlatformFee(sql, {
            payeeUserId: "coach-1",
            monthKey: "2026-09",
            grossCents: 10000,
            config,
          });
        }),
      ),
    );
    const total = fees.reduce((sum, fee) => sum + fee, 0);
    assert.equal(total, 5000);
    assert.equal(fees.filter((fee) => fee === 500).length, 10);
    assert.equal(fees.filter((fee) => fee === 0).length, 2);
    const row = await pg.query<{ fee_cents: number }>(
      "select fee_cents from platform_fee_months where payee_user_id = $1",
      ["coach-1"],
    );
    assert.equal(Number(row.rows[0]?.fee_cents), 5000);
    await pg.close();
  });
});

function toFeeSql(tx: {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}): FeeSql {
  return (async (strings, ...values) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await tx.query(text, values);
    return result.rows;
  }) as FeeSql;
}
