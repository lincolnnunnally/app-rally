import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  OwnerOnlyError,
  assertOwner,
  expiryWall,
  grantIsActive,
  isCouponCode,
  normalizeCouponCode,
  readCoachAccess,
  resolveCoachAccess,
  type AccessSql,
} from "./coach-access.ts";

const now = new Date("2026-10-09T15:00:00Z");

function at(iso: string) {
  return new Date(iso);
}

describe("resolveCoachAccess", () => {
  it("returns none when nothing is active", () => {
    assert.equal(
      resolveCoachAccess({ now, paidThrough: null, grants: [], couponLive: false }),
      "none",
    );
  });

  it("returns paid ahead of a grant and a coupon", () => {
    assert.equal(
      resolveCoachAccess({
        now,
        paidThrough: at("2027-01-01T00:00:00Z"),
        grants: [{ revokedAt: null, expiresAt: null }],
        couponLive: true,
      }),
      "paid",
    );
  });

  it("ignores a paid period that has ended", () => {
    assert.equal(
      resolveCoachAccess({
        now,
        paidThrough: at("2026-10-01T00:00:00Z"),
        grants: [],
        couponLive: false,
      }),
      "none",
    );
  });

  it("returns granted when the owner grant is open", () => {
    assert.equal(
      resolveCoachAccess({
        now,
        paidThrough: null,
        grants: [{ revokedAt: null, expiresAt: at("2026-12-01T00:00:00Z") }],
        couponLive: true,
      }),
      "granted",
    );
  });

  it("skips a revoked or expired grant and falls through to a coupon", () => {
    assert.equal(grantIsActive({ revokedAt: now, expiresAt: null }, now), false);
    assert.equal(
      grantIsActive({ revokedAt: null, expiresAt: at("2026-10-09T15:00:00Z") }, now),
      false,
    );
    assert.equal(
      resolveCoachAccess({
        now,
        paidThrough: null,
        grants: [
          { revokedAt: now, expiresAt: null },
          { revokedAt: null, expiresAt: at("2026-10-01T00:00:00Z") },
        ],
        couponLive: true,
      }),
      "coupon",
    );
  });

  it("returns none when the coupon is not live", () => {
    assert.equal(
      resolveCoachAccess({
        now,
        paidThrough: null,
        grants: [],
        couponLive: false,
      }),
      "none",
    );
  });
});

describe("coupon codes and expiry", () => {
  it("normalizes a code the coach can type", () => {
    assert.equal(normalizeCouponCode("  vidalia 1 "), "VIDALIA1");
    assert.equal(isCouponCode("VIDALIA1"), true);
    assert.equal(isCouponCode("NO"), false);
    assert.equal(isCouponCode("HAS-DASH"), false);
  });

  it("treats a blank expiry as open-ended and rejects a bad date", () => {
    assert.equal(expiryWall("  "), null);
    assert.equal(expiryWall("2026-12-31"), "2026-12-31 23:59:59");
    assert.throws(() => expiryWall("12/31/2026"), /date/);
  });
});

describe("owner gate", () => {
  it("allows the owner and rejects everyone else", () => {
    assert.doesNotThrow(() => assertOwner(true));
    assert.throws(() => assertOwner(false), OwnerOnlyError);
  });
});

describe("migration file", () => {
  const sql = readFileSync(
    new URL("../../migrations/0017_coach_access.sql", import.meta.url),
    "utf8",
  );

  it("enables RLS, writes no policies, and keeps anon and authenticated ungranted", () => {
    for (const table of [
      "coach_access_grants",
      "coach_access_coupons",
      "coach_coupon_redemptions",
      "coach_paid_access",
    ]) {
      assert.match(sql, new RegExp(`alter table ${table} enable row level security`));
      assert.match(sql, new RegExp(`revoke all on table ${table} from anon`));
      assert.match(sql, new RegExp(`revoke all on table ${table} from authenticated`));
    }
    assert.doesNotMatch(sql, /create policy/i);
    assert.match(sql, /grant all on table coach_access_grants to service_role/);
    assert.match(sql, /grant all on table coach_paid_access to service_role/);
  });
});

function toSql(pg: PGlite): AccessSql {
  return async (strings, ...values) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<Record<string, unknown>>(text, values);
    return result.rows;
  };
}

describe("coach access tables", () => {
  it("applies with RLS, no policies, and service_role access", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
    `);
    const migration = readFileSync(
      new URL("../../migrations/0017_coach_access.sql", import.meta.url),
      "utf8",
    );
    await pg.exec(migration);

    const flags = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
       from pg_class
       where relname in (
         'coach_access_grants',
         'coach_access_coupons',
         'coach_coupon_redemptions',
         'coach_paid_access'
       )
       order by relname`,
    );
    assert.equal(flags.rows.length, 4);
    assert.ok(flags.rows.every((row) => row.relrowsecurity));

    const policies = await pg.query<{ polname: string }>(
      `select pol.polname
       from pg_policy pol
       join pg_class c on c.oid = pol.polrelid
       where c.relname like 'coach_%'`,
    );
    assert.equal(policies.rows.length, 0);

    const anon = await pg.query<{ ok: boolean }>(
      `select has_table_privilege('anon', 'coach_access_grants', 'SELECT') as ok`,
    );
    const authenticated = await pg.query<{ ok: boolean }>(
      `select has_table_privilege('authenticated', 'coach_access_coupons', 'INSERT') as ok`,
    );
    const service = await pg.query<{ ok: boolean }>(
      `select has_table_privilege('service_role', 'coach_paid_access', 'SELECT') as ok`,
    );
    assert.equal(anon.rows[0]?.ok, false);
    assert.equal(authenticated.rows[0]?.ok, false);
    assert.equal(service.rows[0]?.ok, true);

    await pg.exec(`
      insert into coach_access_grants (coach_user_id, reason, granted_by)
      values ('coach-a', 'tester', 'owner');
      insert into coach_access_coupons (code, created_by) values ('FREEYEAR', 'owner');
      insert into coach_coupon_redemptions (coupon_id, coach_user_id)
      values (1, 'coach-b');
      insert into coach_paid_access (coach_user_id, paid_through)
      values ('coach-c', '2027-01-01 00:00:00');
    `);
    const sql = toSql(pg);
    const clock = new Date("2026-10-09T15:00:00Z");
    assert.equal(await readCoachAccess(sql, "coach-a", clock), "granted");
    assert.equal(await readCoachAccess(sql, "coach-b", clock), "coupon");
    assert.equal(await readCoachAccess(sql, "coach-c", clock), "paid");
    assert.equal(await readCoachAccess(sql, "coach-d", clock), "none");

    await pg.exec(`update coach_access_coupons set disabled_at = now() where code = 'FREEYEAR'`);
    assert.equal(await readCoachAccess(sql, "coach-b", clock), "none");
    await pg.exec(
      `update coach_access_grants set revoked_at = now() where coach_user_id = 'coach-a'`,
    );
    assert.equal(await readCoachAccess(sql, "coach-a", clock), "none");
  });
});

describe("getCoachAccess is not a gate", () => {
  it("is not called from lesson, student, or billing server paths", () => {
    const files = [
      "src/lib/rally-server.ts",
      "src/lib/students-server.ts",
      "src/lib/schedule-server.ts",
      "src/routes/app/desk.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.equal(source.includes("getCoachAccess"), false, file);
    }
  });
});
