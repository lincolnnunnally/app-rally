import { createHash, timingSafeEqual } from "node:crypto";

/** The owner account. Cleanup refuses this user even if another owner email is configured. */
export const PROTECTED_CLEANUP_EMAIL = "lincoln@unitedundergod.org";

export type CleanupStep = {
  key: string;
  table: string;
  why: string;
  countSql: string;
  mutateSql: string;
  params: (ctx: CleanupCtx) => unknown[];
};

export type CleanupCtx = {
  ids: string[];
  emails: string[];
};

export type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const ids = (ctx: CleanupCtx) => [ctx.ids];

function deleteWhere(opts: {
  key: string;
  table: string;
  relation?: string;
  why: string;
  where: string;
  params?: (ctx: CleanupCtx) => unknown[];
}): CleanupStep {
  const relation = opts.relation ?? opts.table;
  return {
    key: opts.key,
    table: opts.table,
    why: opts.why,
    countSql: `select count(*)::int as n from ${relation} where ${opts.where}`,
    mutateSql: `delete from ${relation} where ${opts.where}`,
    params: opts.params ?? ids,
  };
}

function clearColumn(opts: {
  key: string;
  column: string;
  why: string;
}): CleanupStep {
  return {
    key: opts.key,
    table: "profiles",
    why: opts.why,
    countSql: `select count(*)::int as n from profiles where ${opts.column} = any($1::text[])`,
    mutateSql: `update profiles set ${opts.column} = null where ${opts.column} = any($1::text[])`,
    params: ids,
  };
}

/**
 * Rows tied to the given user ids, children first.
 * Auth "session" and "account" reference "user" on delete cascade, so they
 * would not block a user delete; they are still removed explicitly so the
 * dry-run count is the real row count. Other app tables store user ids with
 * no foreign key, so they would not block "user" either — they are included
 * so a QA account does not leave lessons, notices, or roster pointers behind.
 */
export const CLEANUP_STEPS: CleanupStep[] = [
  deleteWhere({
    key: "daylight_dismissals",
    table: "daylight_dismissals",
    why: "user_id is the coach who dismissed a daylight suggestion.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "notifications",
    table: "notifications",
    why: "user_id is the account the in-app notice was written for.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "calendar_feeds",
    table: "calendar_feeds",
    why: "user_id is the owner of that personal calendar feed.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "journal_entries",
    table: "journal_entries",
    why: "user_id is the author of the journal row.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "coach_ledger",
    table: "coach_ledger",
    why: "coach_user_id is that coach's book row. No foreign key, so it would not block the user delete, but it is that coach's money line.",
    where: "coach_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "coach_services",
    table: "coach_services",
    why: "coach_user_id is the coach who offers that service.",
    where: "coach_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "stall_checks",
    table: "stall_checks",
    why: "user_id is the player the stall check was recorded for.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "reviews",
    table: "reviews",
    why: "reviewer_user_id is the author. subject_id is that user when the review is of a player or coach. Facility reviews use a court id and are left alone.",
    where:
      "reviewer_user_id = any($1::text[]) or (subject_type in ('player', 'coach') and subject_id = any($1::text[]))",
  }),
  deleteWhere({
    key: "platform_ledger",
    table: "platform_ledger",
    why: "source_user_id is the account the platform line was sourced from.",
    where: "source_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "referral_events",
    table: "referral_events",
    why: "referrer_user_id or referred_user_id points at the account.",
    where: "referrer_user_id = any($1::text[]) or referred_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "play_requests",
    table: "play_requests",
    why: "from_user_id or to_user_id is a side of the request.",
    where: "from_user_id = any($1::text[]) or to_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "reservations",
    table: "reservations",
    why: "user_id is the player who reserved the court.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "session_rsvps",
    table: "session_rsvps",
    why: "user_id is the player who RSVPed. Deleted before hosted play sessions so an RSVP on someone else's session is removed too.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "sessions",
    table: "sessions",
    why: "host_user_id is the play-session host. session_rsvps.session_id references sessions on delete cascade, so leftover RSVPs on a hosted session go with it.",
    where: "host_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "match_sides",
    table: "match_sides",
    why: "user_id is a player in the match. No foreign key to the user table.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "league_members",
    table: "league_members",
    why: "user_id is the member. Removed before a league that user owns, which cascades its own members.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "leagues",
    table: "leagues",
    why: "owner_user_id is the league owner. league_members and matches reference leagues on delete cascade.",
    where: "owner_user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "lessons",
    table: "lessons",
    why: "coach_user_id or player_user_id is the account on that lesson.",
    where: "coach_user_id = any($1::text[]) or player_user_id = any($1::text[])",
  }),
  clearColumn({
    key: "profiles_guardian_user_id",
    column: "guardian_user_id",
    why: "Another profile's guardian_user_id points at this account. No foreign key, so it would not block the delete. The other profile stays; the pointer is cleared.",
  }),
  clearColumn({
    key: "profiles_credit_coach_user_id",
    column: "credit_coach_user_id",
    why: "Another profile's credit_coach_user_id points at this coach. The other profile stays; the pointer is cleared.",
  }),
  clearColumn({
    key: "profiles_referred_by",
    column: "referred_by",
    why: "Another profile's referred_by stores this user id. The other profile stays; the pointer is cleared.",
  }),
  {
    key: "profiles_coach_user_ids",
    table: "profiles",
    why: "Another profile's coach_user_ids JSON lists this coach. The other profile stays; that id is removed from the array.",
    countSql: `select count(*)::int as n from profiles
      where coach_user_ids ~ '^[[:space:]]*\\[.*\\][[:space:]]*$'
        and coach_user_ids::jsonb ?| $1::text[]`,
    mutateSql: `update profiles
      set coach_user_ids = (
        select coalesce(jsonb_agg(elem), '[]'::jsonb)::text
        from jsonb_array_elements_text(coach_user_ids::jsonb) elem
        where not (elem = any($1::text[]))
      )
      where coach_user_ids ~ '^[[:space:]]*\\[.*\\][[:space:]]*$'
        and coach_user_ids::jsonb ?| $1::text[]`,
    params: ids,
  },
  deleteWhere({
    key: "coach_profiles",
    table: "coach_profiles",
    why: "user_id is that coach's profile row.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "profiles",
    table: "profiles",
    why: "user_id is the Rally profile, including an accountless student id when that id was passed.",
    where: "user_id = any($1::text[])",
  }),
  deleteWhere({
    key: "verification",
    table: "verification",
    relation: '"verification"',
    why: "Better Auth verification has no user id column and no foreign key. Rows whose identifier is this account's email are removed so a sign-in challenge does not linger.",
    where: "lower(identifier) = any($1::text[])",
    params: (ctx) => [ctx.emails],
  }),
  deleteWhere({
    key: "account",
    table: "account",
    relation: '"account"',
    why: 'Better Auth account."userId" references "user" on delete cascade, so it would not block the delete. Counted and removed explicitly.',
    where: '"userId" = any($1::text[])',
  }),
  deleteWhere({
    key: "session",
    table: "session",
    relation: '"session"',
    why: 'Better Auth session."userId" references "user" on delete cascade, so it would not block the delete. Counted and removed explicitly. This is the auth session table, not play sessions.',
    where: '"userId" = any($1::text[])',
  }),
  deleteWhere({
    key: "user",
    table: "user",
    relation: '"user"',
    why: "Better Auth user row. Deleted last, after session and account.",
    where: "id = any($1::text[])",
  }),
];

export function normalizeIds(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const out: string[] = [];
  for (const part of parts) {
    const id = String(part).trim();
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/** Empty list, or any id that is the protected account. Does not echo the id. */
export function cleanupIdRefusal(idsToClean: readonly string[], protectedIds: readonly string[]): string | null {
  const ids = idsToClean.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return "Provide at least one user id.";
  if (ids.some((id) => protectedIds.includes(id))) return "Refused.";
  return null;
}

export function bearerMatches(token: string, authorization: string | null | undefined): boolean {
  const presented = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(presented).digest();
  return timingSafeEqual(a, b);
}

/** 404 hides the route in production and when the token is unset. A wrong bearer is 401. */
export function qaCleanupDenied(opts: {
  vercelEnv: string | undefined;
  token: string | undefined;
  authorization: string | null | undefined;
}): 404 | 401 | null {
  if (opts.vercelEnv === "production" || !opts.token) return 404;
  if (!bearerMatches(opts.token, opts.authorization)) return 401;
  return null;
}

async function countSteps(query: Queryable, ctx: CleanupCtx): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const step of CLEANUP_STEPS) {
    const rows = await query.query<{ n: number | string }>(step.countSql, step.params(ctx));
    counts[step.key] = Number(rows[0]?.n ?? 0);
  }
  return counts;
}

export async function lookupProtectedIds(query: Queryable): Promise<string[]> {
  const rows = await query.query<{ id: string }>(
    `select id::text as id from "user" where lower(email) = $1`,
    [PROTECTED_CLEANUP_EMAIL],
  );
  return rows.map((row) => String(row.id));
}

async function lookupEmails(query: Queryable, userIds: string[]): Promise<string[]> {
  const rows = await query.query<{ email: string }>(
    `select lower(email) as email from "user" where id = any($1::text[]) and email is not null`,
    [userIds],
  );
  return rows.map((row) => String(row.email)).filter(Boolean);
}

export type CleanupOutcome = {
  ok: boolean;
  status: number;
  error?: string;
  dryRun?: boolean;
  ids?: string[];
  counts?: Record<string, number>;
  deleted?: Record<string, number>;
  commit: boolean;
};

export async function applyCleanup(
  query: Queryable,
  ctx: CleanupCtx,
  execute: boolean,
): Promise<CleanupOutcome> {
  const before = await countSteps(query, ctx);
  if (!execute) {
    return { ok: true, status: 200, dryRun: true, ids: ctx.ids, counts: before, commit: false };
  }
  for (const step of CLEANUP_STEPS) {
    await query.query(step.mutateSql, step.params(ctx));
  }
  const after = await countSteps(query, ctx);
  const leftover = Object.entries(after).filter(([, n]) => n !== 0);
  if (leftover.length > 0) {
    return {
      ok: false,
      status: 500,
      error: "Cleanup read-back was not zero.",
      dryRun: false,
      ids: ctx.ids,
      counts: after,
      deleted: before,
      commit: false,
    };
  }
  return {
    ok: true,
    status: 200,
    dryRun: false,
    ids: ctx.ids,
    counts: after,
    deleted: before,
    commit: true,
  };
}

type ClientQuery = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

function asQueryable(client: ClientQuery): Queryable {
  return {
    query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
      const result = await client.query(text, params ?? []);
      return result.rows as T[];
    },
  };
}

function safeError(err: unknown): string {
  const message = err instanceof Error ? err.message : "cleanup failed";
  if (/postgres(ql)?:\/\//i.test(message) || /password|secret|token/i.test(message)) return "cleanup failed";
  return message;
}

async function withCleanupClient<T>(fn: (query: Queryable) => Promise<T & { commit: boolean }>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const { Pool } = await import("pg");
    let connectionString = databaseUrl;
    try {
      const url = new URL(databaseUrl);
      url.searchParams.delete("sslmode");
      url.searchParams.delete("ssl");
      connectionString = url.toString();
    } catch {
      connectionString = databaseUrl.replace(/[?&]sslmode=[^&]*/gi, "");
    }
    const pool = new Pool({
      connectionString,
      max: 1,
      ssl: { rejectUnauthorized: false },
    });
    const client = await pool.connect();
    try {
      await client.query("CREATE SCHEMA IF NOT EXISTS rally");
      await client.query("SET search_path TO rally, public");
      await client.query("BEGIN");
      try {
        const result = await fn(asQueryable(client));
        await client.query(result.commit ? "COMMIT" : "ROLLBACK");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
  const { getPglite } = await import("./db.ts");
  const pg = await getPglite();
  let outcome: (T & { commit: boolean }) | undefined;
  try {
    await pg.transaction(async (tx) => {
      outcome = await fn(asQueryable(tx));
      if (!outcome.commit) throw new Error("__QA_CLEANUP_ROLLBACK__");
    });
  } catch (err) {
    if (err instanceof Error && err.message === "__QA_CLEANUP_ROLLBACK__" && outcome) return outcome;
    throw err;
  }
  if (!outcome) throw new Error("cleanup failed");
  return outcome;
}

export async function runQaCleanup(opts: { ids: unknown; execute: boolean }): Promise<CleanupOutcome> {
  const userIds = normalizeIds(opts.ids);
  const early = cleanupIdRefusal(userIds, []);
  if (early) return { ok: false, status: 400, error: early, commit: false };
  try {
    return await withCleanupClient(async (query) => {
      const protectedIds = await lookupProtectedIds(query);
      const refused = cleanupIdRefusal(userIds, protectedIds);
      if (refused) return { ok: false, status: 400, error: refused, commit: false };
      const emails = await lookupEmails(query, userIds);
      return applyCleanup(query, { ids: userIds, emails }, opts.execute === true);
    });
  } catch (err) {
    return { ok: false, status: 500, error: safeError(err), commit: false };
  }
}

export async function handleQaCleanup(opts: {
  vercelEnv: string | undefined;
  token: string | undefined;
  authorization: string | null | undefined;
  body: unknown;
  run?: (input: { ids: unknown; execute: boolean }) => Promise<CleanupOutcome>;
}): Promise<{ status: number; body: unknown }> {
  const denied = qaCleanupDenied({
    vercelEnv: opts.vercelEnv,
    token: opts.token,
    authorization: opts.authorization,
  });
  if (denied) return { status: denied, body: { error: "Not found" } };
  const payload = opts.body && typeof opts.body === "object" ? (opts.body as { ids?: unknown; execute?: unknown }) : null;
  if (!payload || !("ids" in payload)) return { status: 400, body: { error: "Provide at least one user id." } };
  const execute = payload.execute === true;
  const run = opts.run ?? runQaCleanup;
  const result = await run({ ids: payload.ids, execute });
  if (!result.ok) return { status: result.status, body: { error: result.error ?? "cleanup failed" } };
  return {
    status: 200,
    body: {
      dryRun: result.dryRun === true,
      ids: result.ids,
      counts: result.counts,
      ...(result.dryRun ? {} : { deleted: result.deleted }),
    },
  };
}

export function parseCliIds(argv: readonly string[]): { ids: string[]; execute: boolean; error: string | null } {
  let raw = "";
  let execute = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--execute") execute = true;
    else if (arg.startsWith("--ids=")) raw = arg.slice("--ids=".length);
    else if (arg === "--ids") raw = argv[++i] ?? "";
    else if (arg.startsWith("-")) return { ids: [], execute, error: "Unknown argument." };
  }
  const ids = normalizeIds(raw);
  return { ids, execute, error: cleanupIdRefusal(ids, []) };
}

export function formatCounts(counts: Record<string, number>): string {
  return CLEANUP_STEPS.map((step) => `${step.key}\t${counts[step.key] ?? 0}`).join("\n");
}

export async function cliMain(argv: readonly string[]): Promise<number> {
  const parsed = parseCliIds(argv);
  if (parsed.error) {
    console.error(parsed.error);
    return 1;
  }
  const result = await runQaCleanup({ ids: parsed.ids, execute: parsed.execute });
  if (!result.ok) {
    console.error(result.error ?? "cleanup failed");
    return 1;
  }
  console.log(parsed.execute ? "executed" : "dry run");
  console.log(formatCounts(result.counts ?? {}));
  if (!parsed.execute) return 0;
  const leftover = Object.values(result.counts ?? {}).some((n) => n !== 0);
  if (leftover) {
    console.error("Cleanup read-back was not zero.");
    return 1;
  }
  console.log("read-back");
  console.log(formatCounts(result.counts ?? {}));
  return 0;
}
