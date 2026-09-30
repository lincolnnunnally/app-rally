/** Roster students are real records a coach can schedule and invite. */

export const STUDENT_INVITE_DAYS = 14;

export type RosterStudent = {
  id: number;
  display_name: string;
  claimed_user_id: string | null;
  guardian_user_ids: string[];
};

export type SchedulePerson = {
  key: string;
  label: string;
  student_id?: number;
  player_user_id?: string;
  claimed: boolean;
};

export function studentScheduleKey(studentId: number) {
  return `student:${studentId}`;
}

export function playerScheduleKey(userId: string) {
  return `user:${userId}`;
}

export function parseScheduleKey(key: string): { student_id?: number; player_user_id?: string } {
  if (key.startsWith("student:")) {
    const id = Number(key.slice("student:".length));
    return Number.isFinite(id) && id > 0 ? { student_id: id } : {};
  }
  if (key.startsWith("user:")) {
    const id = key.slice("user:".length).trim();
    return id ? { player_user_id: id } : {};
  }
  return {};
}

export function isSeedUserId(userId: string) {
  return userId.startsWith("seed:");
}

/** Dropdown source: this coach's roster + connected real players. Never seeds. */
export function schedulePeople(opts: {
  rosterStudents: RosterStudent[];
  connectedPlayers: { user_id: string; display_name: string }[];
}): SchedulePerson[] {
  const people: SchedulePerson[] = [];
  const seenUsers = new Set<string>();

  for (const s of opts.rosterStudents) {
    people.push({
      key: studentScheduleKey(s.id),
      label: s.claimed_user_id ? s.display_name : `${s.display_name} (invite pending)`,
      student_id: s.id,
      player_user_id: s.claimed_user_id ?? undefined,
      claimed: Boolean(s.claimed_user_id),
    });
    if (s.claimed_user_id) seenUsers.add(s.claimed_user_id);
  }

  for (const p of opts.connectedPlayers) {
    if (!p.user_id || isSeedUserId(p.user_id)) continue;
    if (seenUsers.has(p.user_id)) continue;
    seenUsers.add(p.user_id);
    people.push({
      key: playerScheduleKey(p.user_id),
      label: p.display_name,
      player_user_id: p.user_id,
      claimed: true,
    });
  }

  return people;
}

export function canActorReadCoachNotes(opts: { actorId: string; coachId: string }) {
  return opts.actorId === opts.coachId;
}

export function canActorWriteCoachNotes(opts: { actorId: string; coachId: string }) {
  return opts.actorId === opts.coachId;
}

export function claimWouldDuplicate(opts: {
  existingClaimedUserId: string | null;
  actorId: string;
}) {
  return Boolean(opts.existingClaimedUserId && opts.existingClaimedUserId !== opts.actorId);
}

export function inviteExpired(expiresAt: Date | string, now = new Date()) {
  const exp = typeof expiresAt === "string" ? new Date(expiresAt.replace(" ", "T")) : expiresAt;
  return exp.getTime() <= now.getTime();
}

export function inviteUsable(opts: {
  claimedAt: string | Date | null;
  expiresAt: Date | string;
  now?: Date;
}) {
  if (opts.claimedAt) return { ok: false as const, error: "This invite was already used." };
  if (inviteExpired(opts.expiresAt, opts.now)) return { ok: false as const, error: "This invite expired. Ask the coach for a new link." };
  return { ok: true as const };
}

export function studentClaimPath(token: string) {
  return `/join?student=${encodeURIComponent(token)}`;
}
