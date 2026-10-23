/** Shared app-engine owner. Compared at request time; never written as a DB role. */
export const DEFAULT_OWNER_EMAIL = "lincoln@unitedundergod.org";

/**
 * Rally owner-screen accounts. lincoln@unitedundergod.org is the app owner;
 * lincoln.nunnally@gmail.com stays. Matched on the session email (trimmed and
 * lowercased) on every server call. APP_ENGINE_OWNER_EMAIL does NOT grant owner
 * privileges in the app; it only names the GoTrue sign-in bridge address.
 */
export const RALLY_OWNER_EMAILS = [
  "lincoln@unitedundergod.org",
  "lincoln.nunnally@gmail.com",
] as const;

/**
 * Addresses nobody may self-register with a password. They can only come into Rally
 * through the verified GoTrue owner bridge (real LPL password, confirmed email).
 */
export const RESERVED_SIGNUP_EMAILS = [
  "lincoln@unitedundergod.org",
  "lincoln.nunnally@gmail.com",
] as const;

export type EnvLike = Record<string, string | undefined>;

export function ownerEmail(env: EnvLike = process.env): string {
  const configured = env.APP_ENGINE_OWNER_EMAIL?.trim();
  return (configured || DEFAULT_OWNER_EMAIL).toLowerCase();
}

export function isOwnerEmail(
  email: string | null | undefined,
  env: EnvLike = process.env,
): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  return value === ownerEmail(env);
}

/** Owner privileges in the app: RALLY_OWNER_EMAILS only. Env is deliberately ignored. */
export function isAppOwnerEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  return RALLY_OWNER_EMAILS.some((owner) => owner.trim().toLowerCase() === value);
}

/** True when a password sign-up / email change to this address must be refused. */
export function isReservedSignupEmail(
  email: string | null | undefined,
  env: EnvLike = process.env,
): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  return (RESERVED_SIGNUP_EMAILS as readonly string[]).includes(value) || value === ownerEmail(env);
}
