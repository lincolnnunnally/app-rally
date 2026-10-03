/**
 * Students and guardians stay on `profiles`. Private coach notes stay on
 * `lessons.private_notes`. No second student table.
 */

export const STUDENT_USER_PREFIX = "student:";

export const OPTIONAL_PUBLIC_FIELDS = [
  "bio",
  "levels",
  "ratings",
  "experience",
  "photo",
  "availability",
] as const;

export type OptionalPublicField = (typeof OPTIONAL_PUBLIC_FIELDS)[number];

/** Existing résumé stays public until someone narrows it. */
export const DEFAULT_PUBLIC_FIELDS: OptionalPublicField[] = [...OPTIONAL_PUBLIC_FIELDS];

export const NEVER_PUBLIC_KEYS = [
  "phone",
  "guardian_user_id",
  "claim_code",
  "share_code",
  "referred_by",
  "credit_cents",
  "coach_user_ids",
  "public_fields",
  "private_notes",
] as const;

const LEVEL_KEYS = ["tennis_level", "pickleball_level"] as const;
const RATING_KEYS = ["dupr", "utr"] as const;
const EXPERIENCE_KEYS = [
  "experience",
  "accomplishments",
  "tennis_experience",
  "pickleball_experience",
  "tennis_results",
  "pickleball_results",
  "years_playing",
  "tennis_years",
  "pickleball_years",
  "tennis_times",
  "pickleball_times",
  "tennis_frequency",
  "pickleball_frequency",
] as const;

export const PRIVATE_NOTE_LABEL = "Private coach note";
export const PRIVATE_NOTE_HELP =
  "Only you. The player, their guardian, and the public never see this.";

export function isAccountlessStudent(userId: string) {
  return userId.startsWith(STUDENT_USER_PREFIX);
}

export function newStudentUserId() {
  return `${STUDENT_USER_PREFIX}${crypto.randomUUID()}`;
}

export function newClaimCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

export function isClaimCode(code: string) {
  return /^[A-Za-z0-9_-]{8,64}$/.test(code);
}

export function claimPath(code: string) {
  return `/claim/${encodeURIComponent(code)}`;
}

export function parseCoachIds(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : typeof raw === "string" && raw.trim()
      ? parseJsonIds(raw)
      : [];
  return uniqueIds(list);
}

function parseJsonIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function uniqueIds(ids: string[]) {
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

/** A player can be connected to more than one coach. Order is stable. */
export function addCoachId(ids: readonly string[], coachId: string) {
  return uniqueIds([...ids, coachId]);
}

export function parsePublicFields(raw: unknown): OptionalPublicField[] {
  if (raw == null) return [...DEFAULT_PUBLIC_FIELDS];
  const text = String(raw).trim();
  if (!text) return [];
  const allowed = new Set<string>(OPTIONAL_PUBLIC_FIELDS);
  const seen = new Set<string>();
  const out: OptionalPublicField[] = [];
  for (const part of text.split(/[,\s]+/)) {
    if (!allowed.has(part) || seen.has(part)) continue;
    seen.add(part);
    out.push(part as OptionalPublicField);
  }
  return out;
}

export function publicFieldsToText(fields: readonly string[]) {
  const chosen = new Set(fields);
  return OPTIONAL_PUBLIC_FIELDS.filter((field) => chosen.has(field)).join(",");
}

export function applyPublicMask<T extends object>(row: T, rawFields: unknown): T {
  const fields = new Set(parsePublicFields(rawFields));
  const next = { ...row } as Record<string, unknown>;
  if (!fields.has("bio") && "bio" in next) next.bio = null;
  if (!fields.has("availability") && "availability" in next) next.availability = null;
  if (!fields.has("photo") && "photo_data" in next) next.photo_data = null;
  if (!fields.has("levels")) {
    for (const key of LEVEL_KEYS) if (key in next) next[key] = null;
  }
  if (!fields.has("ratings")) {
    for (const key of RATING_KEYS) if (key in next) next[key] = null;
  }
  if (!fields.has("experience")) {
    for (const key of EXPERIENCE_KEYS) if (key in next) next[key] = null;
  }
  return next as T;
}

export function omitNeverPublic<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row };
  for (const key of NEVER_PUBLIC_KEYS) delete next[key];
  return next;
}

/** Schedule dropdown: real profile ids only. A loose name has no user id. */
export function scheduleStudents<T extends { user_id?: string | null; display_name?: string | null }>(
  rows: readonly T[],
) {
  const out: { user_id: string; display_name: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const userId = (row.user_id ?? "").trim();
    const displayName = (row.display_name ?? "").trim();
    if (!userId || !displayName) continue;
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ user_id: userId, display_name: displayName });
  }
  return out;
}

export function childrenOf<T extends { guardian_user_id?: string | null }>(
  rows: readonly T[],
  guardianId: string,
) {
  return rows.filter((row) => row.guardian_user_id === guardianId);
}

export function canFinishStudent(opts: {
  actorId: string;
  studentUserId: string;
  guardianUserId: string | null;
}) {
  if (opts.actorId === opts.studentUserId) return true;
  return opts.guardianUserId != null && opts.actorId === opts.guardianUserId;
}

/** Coach notes never leave the coach's own desk or lesson view. */
export function privateNotesForViewer(opts: {
  actorId: string;
  coachId: string;
  notes: string | null;
}) {
  if (opts.actorId !== opts.coachId) return null;
  const text = (opts.notes ?? "").trim();
  return text || null;
}
