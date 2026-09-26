import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runEmailSignIn, signInOutcome } from "./sign-in-outcome.ts";

describe("sign-in failure is always visible", () => {
  it("shows Invalid email or password from the server body", () => {
    const outcome = signInOutcome(
      { error: { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD", statusText: "Unauthorized" } },
      "Could not sign in",
      "/app",
    );
    assert.deepEqual(outcome, { ok: false, message: "Invalid email or password" });
  });

  it("shows a nested server message instead of a blank or generic status", () => {
    const outcome = signInOutcome(
      { error: { statusText: "Unauthorized", error: { message: "Protected deployment" } }, data: null },
      "Could not sign in",
      "/app",
    );
    assert.deepEqual(outcome, { ok: false, message: "Protected deployment" });
  });

  it("does not navigate when the response has no session", () => {
    const outcome = signInOutcome({ error: null, data: {} }, "Could not sign in", "/app");
    assert.deepEqual(outcome, { ok: false, message: "Could not sign in" });
  });

  it("navigates only when a session token or user came back", () => {
    assert.deepEqual(signInOutcome({ data: { token: "tok", user: { id: "1" } } }, "Could not sign in", "/app"), {
      ok: true,
      dest: "/app",
    });
  });

  it("returns a message for a thrown network error and a hung request", async () => {
    const thrown = await runEmailSignIn({
      dest: "/app",
      fallback: "Could not sign in",
      request: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    assert.deepEqual(thrown, { error: "Network error", navigateTo: null });

    const hung = await runEmailSignIn({
      dest: "/app",
      fallback: "Could not sign in",
      timeoutMs: 20,
      request: () => new Promise(() => {}),
    });
    assert.deepEqual(hung, { error: "Network error", navigateTo: null });
  });

  it("leaves the caller able to clear the loading state after every failure", async () => {
    let busy = true;
    let error: string | null = null;
    try {
      const result = await runEmailSignIn({
        dest: "/app",
        fallback: "Could not sign in",
        request: async () => ({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } }),
      });
      error = result.error;
      assert.equal(result.navigateTo, null);
    } finally {
      busy = false;
    }
    assert.equal(busy, false);
    assert.equal(error, "Invalid email or password");
  });
});
