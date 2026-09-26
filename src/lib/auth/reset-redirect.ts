import { isRallyResetOrigin } from "./trusted-hosts.ts";

/** Rally route that accepts the reset token and sets a new password. */
export const RALLY_RESET_PATH = "/reset-password";

export const RALLY_PRODUCTION_ORIGIN = "https://rally.unitedundergod.org";

/**
 * Absolute callback for a password reset started on `origin`.
 * Better Auth resolves a relative redirect against `baseURL` (BETTER_AUTH_URL).
 * On the shared project that base is the Supabase Site URL, so a relative
 * `/reset-password` lands on dashboard.unitedundergod.org.
 */
export function rallyResetRedirect(origin: string): string {
  return `${new URL(origin).origin}${RALLY_RESET_PATH}`;
}

/**
 * Origin of the browser that asked for the reset, when it is a Rally host.
 * Prefers the `Origin` header, then the forwarded host Vercel sets.
 */
export function originFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const origin = headers.get("origin");
  const fromOrigin = allowedOrigin(origin);
  if (fromOrigin) return fromOrigin;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  if (!host) return null;
  return allowedOrigin(`${proto || "https"}://${host}`);
}

/**
 * Move Better Auth's emailed reset link onto the Rally origin that requested
 * it, and point `callbackURL` at this app's `/reset-password` page.
 * The token path (`/api/auth/reset-password/:token`) stays intact.
 */
export function rallyResetEmailUrl(input: {
  url: string;
  requestOrigin?: string | null;
  siteUrl?: string | null;
}): string {
  const parsed = new URL(input.url);
  const origin =
    allowedOrigin(input.requestOrigin) ??
    allowedOrigin(input.siteUrl) ??
    RALLY_PRODUCTION_ORIGIN;
  const target = new URL(origin);
  parsed.protocol = target.protocol;
  parsed.host = target.host;
  parsed.searchParams.set("callbackURL", rallyResetRedirect(target.origin));
  return parsed.toString();
}

function allowedOrigin(value: string | null | undefined): string | null {
  if (!value || !isRallyResetOrigin(value)) return null;
  return new URL(value).origin;
}
