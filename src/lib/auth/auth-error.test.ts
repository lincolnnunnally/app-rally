import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authErrorMessage } from "./auth-error.ts";

describe("authErrorMessage", () => {
  it("shows the server reason when one is present", () => {
    assert.equal(
      authErrorMessage(
        { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" },
        "Could not sign in",
      ),
      "Invalid email or password",
    );
    assert.equal(
      authErrorMessage({ message: "Email not verified", code: "EMAIL_NOT_VERIFIED" }, "Could not sign in"),
      "Email not verified",
    );
  });

  it("does not collapse a specific code into the generic fallback", () => {
    assert.equal(
      authErrorMessage({ message: "Unauthorized", code: "EMAIL_NOT_VERIFIED" }, "Could not sign in"),
      "Email not verified",
    );
    assert.equal(
      authErrorMessage(
        { message: "", code: "INVALID_EMAIL_OR_PASSWORD", statusText: "Unauthorized" },
        "Could not sign in",
      ),
      "Invalid email or password",
    );
  });

  it("uses the fallback only when nothing specific came back", () => {
    assert.equal(authErrorMessage(null, "Could not sign in"), "Could not sign in");
    assert.equal(authErrorMessage({ message: "Unauthorized" }, "Could not sign in"), "Could not sign in");
  });
});
