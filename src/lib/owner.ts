/** Shared app-engine owner. Compared at request time; never written as a DB role. */
export const DEFAULT_OWNER_EMAIL = "lincoln@unitedundergod.org";

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
