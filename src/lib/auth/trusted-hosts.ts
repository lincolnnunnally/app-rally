/**
 * Origins Better Auth accepts on credentialed POSTs (email sign-up/sign-in).
 * Missing entries surface as FORBIDDEN "Invalid origin".
 *
 * Unique Vercel preview hosts (app-rally-<id>-life-produces-life.vercel.app)
 * are not known at build time — allow `*.vercel.app` always. Production
 * `rally.unitedundergod.org` stays on the list so custom-domain sign-in
 * keeps working after merge.
 */

export const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
] as const;

export const PRODUCTION_ORIGINS = [
  "https://rally.unitedundergod.org",
  "https://app-rally-nine.vercel.app",
  "https://app-rally-life-produces-life.vercel.app",
  "https://app-rally-git-main-life-produces-life.vercel.app",
] as const;

export const PRODUCTION_HOSTS = [
  "rally.unitedundergod.org",
  "app-rally-nine.vercel.app",
  "app-rally-life-produces-life.vercel.app",
] as const;

/** Host wildcards (Better Auth matches these against Origin's host). */
export const VERCEL_PREVIEW_HOSTS = ["*.vercel.app"] as const;

export function originWildcards(hosts: readonly string[]): string[] {
  return hosts.flatMap((host) => [host, `https://${host}`, `http://${host}`]);
}

export function rallyTrustedOrigins(opts: {
  explicitBaseURL?: string;
  previewHosts?: readonly string[];
}): string[] {
  const preview = opts.previewHosts ?? [];
  const wild = [...originWildcards(preview), ...originWildcards(VERCEL_PREVIEW_HOSTS)];
  const base = opts.explicitBaseURL ? [opts.explicitBaseURL] : [];
  return [...base, ...wild, ...PRODUCTION_ORIGINS, ...LOCAL_DEV_ORIGINS];
}

export function rallyAllowedHosts(previewHosts: readonly string[]): string[] {
  return [
    ...previewHosts,
    ...VERCEL_PREVIEW_HOSTS,
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...PRODUCTION_HOSTS,
  ];
}

/**
 * Origins that may receive a Rally password-reset link.
 * Preview hosts are this Vercel project (`app-rally-*-life-produces-life.vercel.app`),
 * not every `*.vercel.app` site — a reset token in the URL must not be sent to
 * an unrelated deployment.
 */
export function isRallyResetOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (url.protocol === "http:") {
    return (
      url.origin === "http://localhost:8080" ||
      url.origin === "http://127.0.0.1:8080" ||
      url.origin === "http://[::1]:8080"
    );
  }
  if (url.protocol !== "https:") return false;
  if ((PRODUCTION_HOSTS as readonly string[]).includes(host)) return true;
  if (host.endsWith(".grok-sandbox.com")) return true;
  return host.startsWith("app-rally") && host.endsWith("-life-produces-life.vercel.app");
}
