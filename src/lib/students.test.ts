import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canActorReadCoachNotes,
  canActorWriteCoachNotes,
  claimWouldDuplicate,
  inviteUsable,
  parseScheduleKey,
  schedulePeople,
  studentClaimPath,
  studentScheduleKey,
} from "./students.ts";

describe("schedulePeople", () => {
  it("lists roster students and connected real profiles only", () => {
    const people = schedulePeople({
      rosterStudents: [
        { id: 7, display_name: "Kaia", claimed_user_id: null, guardian_user_ids: [] },
        { id: 8, display_name: "Sam", claimed_user_id: "user-sam", guardian_user_ids: ["mom"] },
      ],
      connectedPlayers: [
        { user_id: "user-sam", display_name: "Sam" },
        { user_id: "user-pat", display_name: "Pat" },
        { user_id: "seed:avery", display_name: "Avery" },
      ],
    });
    assert.deepEqual(
      people.map((p) => p.key),
      ["student:7", "student:8", "user:user-pat"],
    );
    assert.equal(people[0]?.label, "Kaia (invite pending)");
    assert.equal(people.some((p) => p.label === "Avery"), false);
  });
});

describe("parseScheduleKey", () => {
  it("reads student and user keys", () => {
    assert.deepEqual(parseScheduleKey(studentScheduleKey(7)), { student_id: 7 });
    assert.deepEqual(parseScheduleKey("user:abc"), { player_user_id: "abc" });
    assert.deepEqual(parseScheduleKey("nope"), {});
  });
});

describe("coach note privacy", () => {
  it("lets only that coach read and write their notes", () => {
    assert.equal(canActorReadCoachNotes({ actorId: "coach-a", coachId: "coach-a" }), true);
    assert.equal(canActorWriteCoachNotes({ actorId: "coach-a", coachId: "coach-a" }), true);
    assert.equal(canActorReadCoachNotes({ actorId: "mom", coachId: "coach-a" }), false);
    assert.equal(canActorReadCoachNotes({ actorId: "coach-b", coachId: "coach-a" }), false);
    assert.equal(canActorWriteCoachNotes({ actorId: "kaia", coachId: "coach-a" }), false);
  });
});

describe("claimWouldDuplicate", () => {
  it("blocks a second person from claiming an already-claimed student", () => {
    assert.equal(claimWouldDuplicate({ existingClaimedUserId: null, actorId: "kaia" }), false);
    assert.equal(claimWouldDuplicate({ existingClaimedUserId: "kaia", actorId: "kaia" }), false);
    assert.equal(claimWouldDuplicate({ existingClaimedUserId: "kaia", actorId: "other" }), true);
  });
});

describe("inviteUsable", () => {
  it("fails closed on used or expired tokens", () => {
    const future = new Date("2026-10-14T00:00:00");
    const past = new Date("2026-09-01T00:00:00");
    const now = new Date("2026-09-30T00:00:00");
    assert.equal(inviteUsable({ claimedAt: null, expiresAt: future, now }).ok, true);
    assert.equal(inviteUsable({ claimedAt: now, expiresAt: future, now }).ok, false);
    assert.equal(inviteUsable({ claimedAt: null, expiresAt: past, now }).ok, false);
  });
});

describe("studentClaimPath", () => {
  it("is a shareable in-app path", () => {
    assert.equal(studentClaimPath("abc123"), "/join?student=abc123");
  });
});
