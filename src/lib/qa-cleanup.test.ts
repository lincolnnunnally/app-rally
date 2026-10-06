import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLEANUP_STEPS,
  PROTECTED_CLEANUP_EMAIL,
  cleanupIdRefusal,
  handleQaCleanup,
  normalizeIds,
  parseCliIds,
  qaCleanupDenied,
} from "./qa-cleanup.ts";

const REQUIRED = [
  "user",
  "session",
  "account",
  "profiles",
  "coach_profiles",
  "lessons",
  "notifications",
  "calendar_feeds",
  "journal_entries",
  "daylight_dismissals",
];

describe("qa cleanup tables", () => {
  it("lists every requested table and the user-id rows that would otherwise remain", () => {
    const keys = CLEANUP_STEPS.map((step) => step.key);
    for (const name of REQUIRED) assert.equal(keys.includes(name), true, name);
    for (const step of CLEANUP_STEPS) {
      assert.ok(step.why.length > 20, step.key);
      assert.match(step.countSql, /\$1/);
      assert.match(step.mutateSql, /delete from|update profiles/i);
    }
    assert.ok(keys.indexOf("session") < keys.indexOf("user"));
    assert.ok(keys.indexOf("account") < keys.indexOf("user"));
    assert.equal(keys.at(-1), "user");
    assert.equal(keys.includes("sessions"), true);
    assert.equal(keys.includes("verification"), true);
    assert.equal(PROTECTED_CLEANUP_EMAIL, "lincoln@unitedundergod.org");
  });
});

describe("qa cleanup guards", () => {
  it("hides the route in production and when the token is unset", () => {
    assert.equal(
      qaCleanupDenied({ vercelEnv: "production", token: "secret", authorization: "Bearer secret" }),
      404,
    );
    assert.equal(
      qaCleanupDenied({ vercelEnv: "preview", token: undefined, authorization: "Bearer secret" }),
      404,
    );
    assert.equal(qaCleanupDenied({ vercelEnv: "preview", token: "", authorization: "Bearer secret" }), 404);
  });

  it("rejects a wrong bearer and accepts the matching one", () => {
    assert.equal(
      qaCleanupDenied({ vercelEnv: "preview", token: "secret", authorization: "Bearer wrong" }),
      401,
    );
    assert.equal(
      qaCleanupDenied({ vercelEnv: "preview", token: "secret", authorization: null }),
      401,
    );
    assert.equal(
      qaCleanupDenied({ vercelEnv: "preview", token: "secret", authorization: "Bearer secret" }),
      null,
    );
  });

  it("refuses an empty id list and the protected account", () => {
    assert.equal(cleanupIdRefusal([], []), "Provide at least one user id.");
    assert.equal(cleanupIdRefusal(["  "], []), "Provide at least one user id.");
    assert.equal(normalizeIds("").length, 0);
    assert.equal(cleanupIdRefusal(["qa-user"], ["lincoln-id"]), null);
    assert.equal(cleanupIdRefusal(["lincoln-id"], ["lincoln-id"]), "Refused.");
    assert.equal(cleanupIdRefusal(["qa-user", "lincoln-id"], ["lincoln-id"]), "Refused.");
    assert.equal(parseCliIds(["--ids="]).error, "Provide at least one user id.");
    assert.deepEqual(parseCliIds(["--ids=qa-user,qa-two"]).ids, ["qa-user", "qa-two"]);
    assert.equal(parseCliIds(["--ids=qa-user", "--execute"]).execute, true);
  });

  it("returns 404, 401, and the refusal statuses from the handler", async () => {
    const prod = await handleQaCleanup({
      vercelEnv: "production",
      token: "secret",
      authorization: "Bearer secret",
      body: { ids: ["qa-user"], execute: false },
      run: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(prod.status, 404);

    const missing = await handleQaCleanup({
      vercelEnv: "preview",
      token: undefined,
      authorization: "Bearer secret",
      body: { ids: ["qa-user"], execute: false },
      run: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(missing.status, 404);

    const wrong = await handleQaCleanup({
      vercelEnv: "preview",
      token: "secret",
      authorization: "Bearer no",
      body: { ids: ["qa-user"], execute: true },
      run: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(wrong.status, 401);

    const empty = await handleQaCleanup({
      vercelEnv: "preview",
      token: "secret",
      authorization: "Bearer secret",
      body: { ids: [], execute: false },
    });
    assert.equal(empty.status, 400);

    const lincoln = await handleQaCleanup({
      vercelEnv: "preview",
      token: "secret",
      authorization: "Bearer secret",
      body: { ids: ["lincoln-id", "qa-user"], execute: true },
      run: async ({ ids }) => {
        const error = cleanupIdRefusal(normalizeIds(ids), ["lincoln-id"]);
        return error
          ? { ok: false, status: 400, error, commit: false }
          : { ok: true, status: 200, dryRun: false, counts: {}, commit: true };
      },
    });
    assert.equal(lincoln.status, 400);
    assert.deepEqual(lincoln.body, { error: "Refused." });
  });
});
