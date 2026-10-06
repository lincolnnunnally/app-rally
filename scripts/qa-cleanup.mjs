#!/usr/bin/env node
/**
 * Dry-run or delete QA rows tied to the given user ids.
 * Default is a dry run. Pass --execute to delete inside one transaction.
 *
 *   node scripts/qa-cleanup.mjs --ids=<id1>,<id2>
 *   node scripts/qa-cleanup.mjs --ids=<id1>,<id2> --execute
 *
 * Does not run unless you invoke it. Refuses an empty id list and refuses
 * lincoln@unitedundergod.org.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);

if (process.env.QA_CLEANUP_INNER !== "1") {
  const child = spawnSync(
    process.execPath,
    ["--experimental-strip-types", here, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: { ...process.env, QA_CLEANUP_INNER: "1" },
    },
  );
  process.exit(child.status ?? 1);
}

const { cliMain } = await import("../src/lib/qa-cleanup.ts");
process.exit(await cliMain(process.argv.slice(2)));
