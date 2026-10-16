/** Shared app-engine owner. Compared at request time; never written as a DB role. */
export const DEFAULT_OWNER_EMAIL = "lincoln@unitedundergod.org";

/**
 * Rally owner-screen accounts (both are Lincoln). Matched on the verified session
 * email on every server call. Only gates owner privileges (e.g. /app/admin);
 * the GoTrue sign-in bridge still uses the single owner email below.
 */
export const RALLY_OWNER_EMAILS = ["lincoln@unitedundergod.org", "lincoln.nunnally@gmail.com"] as const;

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

/** Owner privileges in the app: the configured owner email or any address in RALLY_OWNER_EMAILS. */
export function isAppOwnerEmail(
  email: string | null | undefined,
  env: EnvLike = process.env,
): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  return isOwnerEmail(value, env) || (RALLY_OWNER_EMAILS as readonly string[]).includes(value);
}
