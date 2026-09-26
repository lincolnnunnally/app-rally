import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureOwnerAccount, parseEmailPasswordBody, shouldTryOwnerBridge } from "./owner-sign-in.ts";

const env = {};

describe("shouldTryOwnerBridge", () => {
  it("runs only for the owner after a 401 password failure", () => {
    assert.equal(
      shouldTryOwnerBridge({
        betterAuthOk: false,
        betterAuthStatus: 401,
        email: "Lincoln@UnitedUnderGod.org",
        passwordPresent: true,
        env,
      }),
      true,
    );
  });

  it("never runs for anyone else, a success, or a non-401", () => {
    assert.equal(
      shouldTryOwnerBridge({
        betterAuthOk: false,
        betterAuthStatus: 401,
        email: "lincoln.nunnally@gmail.com",
        passwordPresent: true,
        env,
      }),
      false,
    );
    assert.equal(
      shouldTryOwnerBridge({
        betterAuthOk: true,
        betterAuthStatus: 200,
        email: "lincoln@unitedundergod.org",
        passwordPresent: true,
        env,
      }),
      false,
    );
    assert.equal(
      shouldTryOwnerBridge({
        betterAuthOk: false,
        betterAuthStatus: 403,
        email: "lincoln@unitedundergod.org",
        passwordPresent: true,
        env,
      }),
      false,
    );
    assert.equal(
      shouldTryOwnerBridge({
        betterAuthOk: false,
        betterAuthStatus: 401,
        email: "lincoln@unitedundergod.org",
        passwordPresent: false,
        env,
      }),
      false,
    );
  });
});

describe("parseEmailPasswordBody", () => {
  it("reads json and form bodies", () => {
    assert.deepEqual(parseEmailPasswordBody('{"email":"a@b.co","password":"pw"}', "application/json"), {
      email: "a@b.co",
      password: "pw",
    });
    assert.deepEqual(
      parseEmailPasswordBody("email=a%40b.co&password=p%26w", "application/x-www-form-urlencoded"),
      { email: "a@b.co", password: "p&w" },
    );
  });
});

describe("ensureOwnerAccount", () => {
  it("creates a user with a random password and never the submitted one", async () => {
    const hashed: string[] = [];
    const linked: string[] = [];
    const user = await ensureOwnerAccount(
      {
        findUserByEmail: async () => null,
        createUser: async (input) => ({ id: "user-1", email: input.email, name: input.name, emailVerified: true }),
        linkAccount: async (account) => {
          linked.push(account.password);
        },
        hashPassword: async (password) => {
          hashed.push(password);
          return `hashed:${password}`;
        },
        randomPassword: () => "random-not-the-gotrue-password",
      },
      { email: "Lincoln@UnitedUnderGod.org", name: "Lincoln Nunnally" },
    );
    assert.equal(user.email, "lincoln@unitedundergod.org");
    assert.equal(user.name, "Lincoln Nunnally");
    assert.deepEqual(hashed, ["random-not-the-gotrue-password"]);
    assert.deepEqual(linked, ["hashed:random-not-the-gotrue-password"]);
    assert.equal(hashed.includes("the-real-password"), false);
  });

  it("does not replace an existing credential password", async () => {
    let linked = 0;
    const user = await ensureOwnerAccount(
      {
        findUserByEmail: async () => ({
          user: { id: "user-1", email: "lincoln@unitedundergod.org", name: "Lincoln" },
          accounts: [{ providerId: "credential", password: "already-hashed" }],
        }),
        createUser: async () => {
          throw new Error("should not create");
        },
        linkAccount: async () => {
          linked += 1;
        },
        hashPassword: async () => {
          throw new Error("should not hash");
        },
        randomPassword: () => "unused",
      },
      { email: "lincoln@unitedundergod.org" },
    );
    assert.equal(user.id, "user-1");
    assert.equal(linked, 0);
  });
});
