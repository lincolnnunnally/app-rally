import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_OWNER_EMAIL, isAppOwnerEmail, isOwnerEmail, isReservedSignupEmail, ownerEmail } from "./owner.ts";

describe("owner email", () => {
  it("falls back to lincoln@unitedundergod.org", () => {
    assert.equal(ownerEmail({}), DEFAULT_OWNER_EMAIL);
    assert.equal(isOwnerEmail("Lincoln@UnitedUnderGod.org", {}), true);
  });

  it("reads APP_ENGINE_OWNER_EMAIL case-insensitively", () => {
    const env = { APP_ENGINE_OWNER_EMAIL: " Owner@Example.com " };
    assert.equal(ownerEmail(env), "owner@example.com");
    assert.equal(isOwnerEmail("owner@example.com", env), true);
    assert.equal(isOwnerEmail("lincoln@unitedundergod.org", env), false);
  });

  it("does not treat any other address as the owner", () => {
    assert.equal(isOwnerEmail("lincoln.nunnally@gmail.com", {}), false);
    assert.equal(isOwnerEmail("", {}), false);
    assert.equal(isOwnerEmail(null, {}), false);
    assert.equal(isOwnerEmail(" lincoln@unitedundergod.org ", {}), true);
  });
});

describe("app owner emails", () => {
  it("keeps lincoln@unitedundergod.org and lincoln.nunnally@gmail.com as app owners", () => {
    assert.equal(isAppOwnerEmail("lincoln@unitedundergod.org"), true);
    assert.equal(isAppOwnerEmail("lincoln.nunnally@gmail.com"), true);
  });
  it("compares owner emails trimmed and lowercased", () => {
    assert.equal(isAppOwnerEmail(" Lincoln.Nunnally@Gmail.com "), true);
    assert.equal(isAppOwnerEmail(" Lincoln@UnitedUnderGod.org "), true);
  });
  it("rejects everyone else", () => {
    for (const e of ["qa@mailinator.com", "lincoln@gmail.com", "lincoln.nunnally@gmail.com.evil.io", "", null, undefined]) {
      assert.equal(isAppOwnerEmail(e), false);
    }
  });
});

describe("reserved sign-up emails", () => {
  it("reserves lincoln@unitedundergod.org and the configured bridge address", () => {
    assert.equal(isReservedSignupEmail(" LINCOLN@unitedundergod.org ", {}), true);
    assert.equal(isReservedSignupEmail("owner@example.com", { APP_ENGINE_OWNER_EMAIL: "owner@example.com" }), true);
    assert.equal(isReservedSignupEmail("lincoln@unitedundergod.org", { APP_ENGINE_OWNER_EMAIL: "owner@example.com" }), true);
  });
  it("leaves normal addresses alone", () => {
    assert.equal(isReservedSignupEmail("coach@example.com", {}), false);
    assert.equal(isReservedSignupEmail("", {}), false);
  });
});
