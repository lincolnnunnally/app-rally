import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OWNER_SIGN_IN_NETWORK,
  OWNER_SIGN_IN_UNAVAILABLE,
  readSupabaseAnonConfig,
  verifyGoTruePassword,
} from "./gotrue-password.ts";

describe("readSupabaseAnonConfig", () => {
  it("requires a URL and the public anon key", () => {
    assert.equal(readSupabaseAnonConfig({}), null);
    assert.equal(readSupabaseAnonConfig({ SUPABASE_URL: "https://db.example.co" }), null);
    assert.equal(
      readSupabaseAnonConfig({
        SUPABASE_URL: "https://db.example.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
      null,
    );
  });

  it("accepts SUPABASE_ and the Vite / Next public names", () => {
    assert.deepEqual(
      readSupabaseAnonConfig({
        VITE_SUPABASE_URL: "https://db.example.co/",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
      { url: "https://db.example.co", anonKey: "anon-key" },
    );
    assert.deepEqual(
      readSupabaseAnonConfig({
        SUPABASE_URL: "https://db.example.co",
        SUPABASE_ANON_KEY: "anon",
      }),
      { url: "https://db.example.co", anonKey: "anon" },
    );
  });
});

describe("verifyGoTruePassword", () => {
  const config = { url: "https://db.example.co", anonKey: "anon-key" };

  it("posts the password grant with the anon key and treats 200 as success", async () => {
    let seen: { url?: string; apikey?: string; authorization?: string; body?: string } = {};
    const result = await verifyGoTruePassword(
      config,
      "Lincoln@UnitedUnderGod.org",
      "secret-pass",
      async (url, init) => {
        const headers = new Headers(init.headers);
        seen = {
          url,
          apikey: headers.get("apikey") ?? undefined,
          authorization: headers.get("authorization") ?? undefined,
          body: String(init.body),
        };
        return new Response(
          JSON.stringify({ user: { user_metadata: { name: "Lincoln Nunnally" } } }),
          { status: 200 },
        );
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.name, "Lincoln Nunnally");
    assert.equal(seen.url, "https://db.example.co/auth/v1/token?grant_type=password");
    assert.equal(seen.apikey, "anon-key");
    assert.equal(seen.authorization, "Bearer anon-key");
    assert.equal(seen.body, JSON.stringify({ email: "Lincoln@UnitedUnderGod.org", password: "secret-pass" }));
  });

  it("returns invalid credentials when GoTrue rejects the password", async () => {
    const result = await verifyGoTruePassword(config, "lincoln@unitedundergod.org", "nope", async () => {
      return new Response(JSON.stringify({ error_description: "Invalid login credentials" }), { status: 400 });
    });
    assert.deepEqual(result, { ok: false, reason: "rejected", message: "Invalid email or password" });
  });

  it("returns a network error when the request throws", async () => {
    const result = await verifyGoTruePassword(config, "lincoln@unitedundergod.org", "x", async () => {
      throw new Error("connect ECONNREFUSED");
    });
    assert.deepEqual(result, { ok: false, reason: "network", message: OWNER_SIGN_IN_NETWORK });
  });
});

describe("unavailable copy", () => {
  it("names the env vars the app reads", () => {
    assert.match(OWNER_SIGN_IN_UNAVAILABLE, /SUPABASE_URL/);
    assert.match(OWNER_SIGN_IN_UNAVAILABLE, /SUPABASE_ANON_KEY/);
  });
});
