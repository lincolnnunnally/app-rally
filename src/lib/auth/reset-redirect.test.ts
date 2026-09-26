import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRallyResetOrigin } from "./trusted-hosts.ts";
import {
  RALLY_PRODUCTION_ORIGIN,
  originFromHeaders,
  rallyResetEmailUrl,
  rallyResetRedirect,
} from "./reset-redirect.ts";

const TOKEN_URL =
  "https://dashboard.unitedundergod.org/api/auth/reset-password/tok_123?callbackURL=%2Freset-password";

describe("isRallyResetOrigin", () => {
  it("allows production and this project's Vercel previews", () => {
    assert.equal(isRallyResetOrigin("https://rally.unitedundergod.org"), true);
    assert.equal(isRallyResetOrigin("https://rally.unitedundergod.org/reset-password"), true);
    assert.equal(
      isRallyResetOrigin("https://app-rally-qn7qsdp4a-life-produces-life.vercel.app"),
      true,
    );
    assert.equal(
      isRallyResetOrigin(
        "https://app-rally-git-cursor-coach-pay-handles-3901-life-produces-life.vercel.app/reset-password",
      ),
      true,
    );
  });

  it("rejects the shared site URL and unrelated Vercel apps", () => {
    assert.equal(isRallyResetOrigin("https://dashboard.unitedundergod.org"), false);
    assert.equal(isRallyResetOrigin("https://evil.vercel.app"), false);
    assert.equal(isRallyResetOrigin("https://other-life-produces-life.vercel.app"), false);
  });
});

describe("rallyResetRedirect", () => {
  it("points at /reset-password on the given origin", () => {
    assert.equal(
      rallyResetRedirect("https://rally.unitedundergod.org"),
      "https://rally.unitedundergod.org/reset-password",
    );
    assert.equal(
      rallyResetRedirect("https://rally.unitedundergod.org/login?mode=in"),
      "https://rally.unitedundergod.org/reset-password",
    );
  });
});

describe("rallyResetEmailUrl", () => {
  it("rewrites a Site URL link onto the Rally origin that requested the reset", () => {
    const url = rallyResetEmailUrl({
      url: TOKEN_URL,
      requestOrigin: "https://rally.unitedundergod.org",
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://rally.unitedundergod.org");
    assert.equal(parsed.pathname, "/api/auth/reset-password/tok_123");
    assert.equal(parsed.searchParams.get("callbackURL"), "https://rally.unitedundergod.org/reset-password");
  });

  it("keeps a Vercel preview on that preview", () => {
    const preview = "https://app-rally-abc-life-produces-life.vercel.app";
    const url = rallyResetEmailUrl({
      url: TOKEN_URL,
      requestOrigin: preview,
      siteUrl: "https://dashboard.unitedundergod.org",
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, preview);
    assert.equal(parsed.searchParams.get("callbackURL"), `${preview}/reset-password`);
  });

  it("ignores a non-Rally site URL and falls back to production", () => {
    const url = rallyResetEmailUrl({
      url: TOKEN_URL,
      siteUrl: "https://dashboard.unitedundergod.org",
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, RALLY_PRODUCTION_ORIGIN);
    assert.equal(
      parsed.searchParams.get("callbackURL"),
      "https://rally.unitedundergod.org/reset-password",
    );
  });
});

describe("originFromHeaders", () => {
  it("reads Origin, then the forwarded host", () => {
    assert.equal(
      originFromHeaders(new Headers({ origin: "https://rally.unitedundergod.org" })),
      "https://rally.unitedundergod.org",
    );
    assert.equal(
      originFromHeaders(
        new Headers({
          "x-forwarded-proto": "https",
          "x-forwarded-host": "app-rally-abc-life-produces-life.vercel.app",
        }),
      ),
      "https://app-rally-abc-life-produces-life.vercel.app",
    );
  });

  it("does not treat the shared dashboard host as Rally", () => {
    assert.equal(
      originFromHeaders(new Headers({ origin: "https://dashboard.unitedundergod.org" })),
      null,
    );
  });
});
