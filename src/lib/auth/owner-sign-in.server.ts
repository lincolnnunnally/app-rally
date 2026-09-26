import { makeSignature } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { auth, SESSION_TOKEN_COOKIE } from "./server";
import {
  OWNER_SIGN_IN_UNAVAILABLE,
  readSupabaseAnonConfig,
  verifyGoTruePassword,
} from "./gotrue-password.ts";
import { ensureOwnerAccount, parseEmailPasswordBody, shouldTryOwnerBridge } from "./owner-sign-in.ts";
import { buildSessionSetCookie } from "./session-cookie.ts";

function jsonResponse(status: number, body: { message: string; code: string }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type AuthContext = {
  internalAdapter: {
    findUserByEmail: (
      email: string,
      options?: { includeAccounts?: boolean },
    ) => Promise<{
      user: { id: string; email: string; name: string; emailVerified?: boolean; image?: string | null; createdAt?: Date; updatedAt?: Date };
      accounts?: { providerId?: string; password?: string | null }[];
    } | null>;
    createUser: (user: { email: string; name: string; emailVerified: boolean }) => Promise<{
      id: string;
      email: string;
      name: string;
      emailVerified?: boolean;
      image?: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }>;
    linkAccount: (account: {
      userId: string;
      providerId: string;
      accountId: string;
      password: string;
    }) => Promise<unknown>;
    updatePassword: (userId: string, passwordHash: string) => Promise<unknown>;
    createSession: (userId: string) => Promise<{ token: string } | null>;
  };
  password: { hash: (password: string) => Promise<string> };
  secret: unknown;
  authCookies?: { sessionToken?: { name?: string } };
  sessionConfig?: { expiresIn?: number };
};

function signingSecret(secret: unknown): string {
  if (typeof secret === "string" && secret.trim()) return secret;
  return "";
}

async function ownerSessionResponse(input: { email: string; name?: string }): Promise<Response> {
  const ctx = (await auth.$context) as AuthContext;
  const secret = signingSecret(ctx.secret);
  if (!secret) {
    return jsonResponse(500, { message: "Could not create a session.", code: "FAILED_TO_CREATE_SESSION" });
  }
  const user = await ensureOwnerAccount(
    {
      findUserByEmail: (email) => ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true }),
      createUser: (row) => ctx.internalAdapter.createUser(row),
      linkAccount: (account) => ctx.internalAdapter.linkAccount(account),
      updatePassword: (userId, passwordHash) => ctx.internalAdapter.updatePassword(userId, passwordHash),
      hashPassword: (password) => ctx.password.hash(password),
      randomPassword: () => randomBytes(32).toString("base64url"),
    },
    input,
  );
  const session = await ctx.internalAdapter.createSession(user.id);
  if (!session?.token) {
    return jsonResponse(500, { message: "Could not create a session.", code: "FAILED_TO_CREATE_SESSION" });
  }
  const cookieName = ctx.authCookies?.sessionToken?.name || SESSION_TOKEN_COOKIE;
  const maxAge = ctx.sessionConfig?.expiresIn ?? 60 * 60 * 24 * 7;
  const cookie = await buildSessionSetCookie({
    name: cookieName,
    token: session.token,
    secret,
    maxAge,
    sign: (value, key) => makeSignature(value, key),
  });
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(cookieName, cookie.value, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
    });
  } catch (err) {
    console.error("[owner-sign-in] setCookie failed", err instanceof Error ? err.message : "error");
  }
  return new Response(
    JSON.stringify({
      redirect: false,
      token: session.token,
      url: null,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified ?? true,
        image: user.image ?? null,
        createdAt: user.createdAt ?? new Date().toISOString(),
        updatedAt: user.updatedAt ?? new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": cookie.header,
      },
    },
  );
}

/** POST /api/auth/*. Owner GoTrue bridge runs only on a failed email sign-in. */
export async function handleAuthPost(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/sign-in/email")) return auth.handler(request);

  const raw = await request.text();
  const response = await auth.handler(
    new Request(request.url, { method: "POST", headers: request.headers, body: raw }),
  );
  const parsed = parseEmailPasswordBody(raw, request.headers.get("content-type"));
  if (
    !shouldTryOwnerBridge({
      betterAuthOk: response.ok,
      betterAuthStatus: response.status,
      email: parsed.email,
      passwordPresent: Boolean(parsed.password),
    })
  ) {
    return response;
  }

  const config = readSupabaseAnonConfig();
  if (!config) {
    return jsonResponse(503, { message: OWNER_SIGN_IN_UNAVAILABLE, code: "OWNER_SIGN_IN_UNAVAILABLE" });
  }

  const gotrue = await verifyGoTruePassword(config, parsed.email ?? "", parsed.password ?? "");
  if (!gotrue.ok) {
    if (gotrue.reason === "network") {
      return jsonResponse(503, { message: gotrue.message, code: "OWNER_SIGN_IN_UNAVAILABLE" });
    }
    return response;
  }

  try {
    return await ownerSessionResponse({ email: parsed.email ?? "", name: gotrue.name });
  } catch (err) {
    console.error("[owner-sign-in] session failed", err instanceof Error ? err.message : "error");
    return jsonResponse(500, { message: "Could not create a session.", code: "FAILED_TO_CREATE_SESSION" });
  }
}
