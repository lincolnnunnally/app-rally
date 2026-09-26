import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_OWNER_EMAIL, isOwnerEmail, ownerEmail } from "./owner.ts";

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
