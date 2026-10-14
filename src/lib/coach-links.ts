/** Public coach links. The code is the coach's existing share_code (same as /join?coach=). */
export const RALLY_ORIGIN = "https://rally.unitedundergod.org";

export function coachProfilePath(code: string) {
  return `/coach/${encodeURIComponent(code)}`;
}

export function coachBookPath(code: string) {
  return `/book/${encodeURIComponent(code)}`;
}

/** In-app request dialog for one coach (signed in). */
export function coachRequestAppPath(code: string) {
  return `/app/coaches?coach=${encodeURIComponent(code)}`;
}

export function absoluteRallyUrl(path: string) {
  if (typeof window === "undefined") return `${RALLY_ORIGIN}${path}`;
  return `${window.location.origin}${path}`;
}
