import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSessionSetCookie } from "./session-cookie.ts";

describe("buildSessionSetCookie", () => {
  it("signs the token and sets a host-only cookie", async () => {
    const cookie = await buildSessionSetCookie({
      name: "__Host-grok-auth.session_token",
      token: "session-token",
      secret: "secret",
      maxAge: 604800,
      sign: async (value) => `sig-for-${value}`,
    });
    assert.equal(cookie.value, "session-token.sig-for-session-token");
    assert.match(cookie.header, /^__Host-grok-auth\.session_token=session-token\.sig-for-session-token;/);
    assert.match(cookie.header, /HttpOnly/);
    assert.match(cookie.header, /Secure/);
    assert.match(cookie.header, /Path=\//);
    assert.match(cookie.header, /SameSite=Lax/);
    assert.equal(/Domain=/i.test(cookie.header), false);
  });
});
