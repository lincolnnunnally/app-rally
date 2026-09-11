#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL (production: shared LPL Supabase, rally
 * schema — not Neon). Each file is applied in one transaction and recorded in
 * `_migrations`, so it runs once and is safe to re-run.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

// Managed Postgres (LPL Supabase pooler) often fails Node's strict TLS verify
// even with pg `ssl: { rejectUnauthorized: false }` when the URI includes
// sslmode=require (treated as verify-full in newer pg). Disable only for this
// short migrate process — not for the long-lived app server.
if (/supabase|pooler/i.test(databaseUrl)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  let connectionString = databaseUrl;
  try {
    const u = new URL(databaseUrl);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    connectionString = u.toString();
  } catch {
    connectionString = databaseUrl.replace(/[?&]sslmode=[^&]*/gi, "");
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    // Shared LPL: keep Rally isolated in its own schema (Better Auth tables
    // would otherwise collide with public.user-like names across ecosystem apps).
    await client.query("CREATE SCHEMA IF NOT EXISTS rally");
    await client.query("SET search_path TO rally, public");
    await client.query(
      "CREATE TABLE IF NOT EXISTS rally._migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM rally._migrations")).rows.map(
      (r) => r.name,
    );

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(text);
        await client.query("INSERT INTO rally._migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
