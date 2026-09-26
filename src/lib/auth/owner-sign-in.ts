import type { EnvLike } from "../owner.ts";
import { isOwnerEmail } from "../owner.ts";

export function parseEmailPasswordBody(
  raw: string,
  contentType: string | null,
): { email?: string; password?: string } {
  try {
    if ((contentType ?? "").includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      const email = params.get("email");
      const password = params.get("password");
      return {
        email: email ?? undefined,
        password: password ?? undefined,
      };
    }
    const body = JSON.parse(raw) as { email?: unknown; password?: unknown };
    return {
      email: typeof body.email === "string" ? body.email : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * GoTrue is consulted only after Better Auth already rejected this sign-in
 * with 401, and only for the owner email.
 */
export function shouldTryOwnerBridge(input: {
  betterAuthOk: boolean;
  betterAuthStatus: number;
  email: string | null | undefined;
  passwordPresent: boolean;
  env?: EnvLike;
}): boolean {
  if (input.betterAuthOk) return false;
  if (input.betterAuthStatus !== 401) return false;
  if (!input.passwordPresent) return false;
  return isOwnerEmail(input.email, input.env);
}

export type OwnerAccountUser = {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type OwnerAccountDeps = {
  findUserByEmail: (email: string) => Promise<{
    user: OwnerAccountUser;
    accounts?: { providerId?: string; password?: string | null }[];
  } | null>;
  createUser: (user: { email: string; name: string; emailVerified: boolean }) => Promise<OwnerAccountUser>;
  linkAccount: (account: {
    userId: string;
    providerId: string;
    accountId: string;
    password: string;
  }) => Promise<unknown>;
  updatePassword?: (userId: string, passwordHash: string) => Promise<unknown>;
  hashPassword: (password: string) => Promise<string>;
  randomPassword: () => string;
};

/**
 * Find the Better Auth user or create one. The credential password is always
 * a fresh random value — the GoTrue password is not an argument and is never
 * stored.
 */
export async function ensureOwnerAccount(
  deps: OwnerAccountDeps,
  input: { email: string; name?: string },
): Promise<OwnerAccountUser> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || email.split("@")[0] || "Owner";
  const found = await deps.findUserByEmail(email);
  if (!found) {
    const user = await deps.createUser({ email, name, emailVerified: true });
    await deps.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await deps.hashPassword(deps.randomPassword()),
    });
    return user;
  }
  const credentials = (found.accounts ?? []).filter((account) => account.providerId === "credential");
  const hasPassword = credentials.some((account) => Boolean(account.password));
  if (!hasPassword) {
    const passwordHash = await deps.hashPassword(deps.randomPassword());
    if (credentials.length > 0 && deps.updatePassword) {
      await deps.updatePassword(found.user.id, passwordHash);
    } else {
      await deps.linkAccount({
        userId: found.user.id,
        providerId: "credential",
        accountId: found.user.id,
        password: passwordHash,
      });
    }
  }
  return found.user;
}
