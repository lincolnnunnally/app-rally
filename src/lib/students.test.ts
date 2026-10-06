import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCoachId,
  applyPublicMask,
  canCoachSchedulePlayer,
  canFinishStudent,
  childrenOf,
  claimPath,
  isClaimCode,
  omitNeverPublic,
  parsePublicFields,
  privateNotesForViewer,
  rosterParentLine,
  scheduleStudents,
} from "./students.ts";

describe("scheduleStudents", () => {
  it("lists real profiles and drops a loose name", () => {
    const rows = scheduleStudents([
      { user_id: "student:kaia", display_name: "Kaia" },
      { user_id: "", display_name: "Not a profile" },
      { user_id: null, display_name: "Also loose" },
      { display_name: "Missing id" },
    ]);
    assert.deepEqual(rows, [{ user_id: "student:kaia", display_name: "Kaia" }]);
  });
});

describe("coaches and guardians", () => {
  it("connects one player to more than one coach", () => {
    const ids = addCoachId(addCoachId([], "coach-a"), "coach-b");
    assert.deepEqual(addCoachId(ids, "coach-a"), ["coach-a", "coach-b"]);
  });

  it("lets a coach schedule a rostered student or themselves", () => {
    assert.equal(
      canCoachSchedulePlayer({
        coachId: "coach-a",
        playerId: "student:kaia",
        coachUserIds: '["coach-a","coach-b"]',
      }),
      true,
    );
    assert.equal(
      canCoachSchedulePlayer({
        coachId: "coach-a",
        playerId: "coach-a",
        coachUserIds: "[]",
      }),
      true,
    );
    assert.equal(
      canCoachSchedulePlayer({
        coachId: "coach-a",
        playerId: "user-random",
        coachUserIds: "[]",
      }),
      false,
    );
  });

  it("lets one guardian have more than one child", () => {
    const kids = childrenOf(
      [
        { user_id: "student:kaia", guardian_user_id: "parent-1" },
        { user_id: "student:leo", guardian_user_id: "parent-1" },
        { user_id: "student:other", guardian_user_id: "parent-2" },
      ],
      "parent-1",
    );
    assert.deepEqual(
      kids.map((kid) => kid.user_id),
      ["student:kaia", "student:leo"],
    );
  });

  it("lets the guardian finish the profile and keeps a stranger out", () => {
    assert.equal(
      canFinishStudent({
        actorId: "parent-1",
        studentUserId: "student:kaia",
        guardianUserId: "parent-1",
      }),
      true,
    );
    assert.equal(
      canFinishStudent({
        actorId: "coach-a",
        studentUserId: "student:kaia",
        guardianUserId: "parent-1",
      }),
      false,
    );
  });
});

describe("profile visibility", () => {
  it("keeps phone, the claim code, and coach notes off every public view", () => {
    const row = omitNeverPublic({
      display_name: "Kaia",
      phone: "555-0100",
      claim_code: "abc123def456",
      guardian_user_id: "parent-1",
      private_notes: "Footwork is late.",
      coach_user_ids: '["coach-a"]',
    });
    assert.equal(row.display_name, "Kaia");
    assert.equal("phone" in row, false);
    assert.equal("claim_code" in row, false);
    assert.equal("guardian_user_id" in row, false);
    assert.equal("private_notes" in row, false);
    assert.equal("coach_user_ids" in row, false);
  });

  it("hides optional fields the guardian did not mark public", () => {
    const hidden = applyPublicMask(
      { display_name: "Kaia", bio: "Junior", dupr: "3.1", city: "Vidalia" },
      "",
    );
    assert.equal(hidden.display_name, "Kaia");
    assert.equal(hidden.city, "Vidalia");
    assert.equal(hidden.bio, null);
    assert.equal(hidden.dupr, null);
    assert.deepEqual(parsePublicFields(null), [
      "bio",
      "levels",
      "ratings",
      "experience",
      "photo",
      "availability",
    ]);
  });
});

describe("private coach notes", () => {
  it("shows the note only to that coach", () => {
    const notes = "Kaia rushes the kitchen.";
    assert.equal(
      privateNotesForViewer({ actorId: "coach-a", coachId: "coach-a", notes }),
      notes,
    );
    for (const actorId of ["parent-1", "student:kaia", "stranger"]) {
      assert.equal(privateNotesForViewer({ actorId, coachId: "coach-a", notes }), null);
    }
  });
});

describe("roster parent line", () => {
  it("waits on a parent only for an unclaimed accountless student", () => {
    assert.equal(rosterParentLine({ userId: "student:kaia", claimed: false }), "waiting on a parent");
    assert.equal(rosterParentLine({ userId: "student:kaia", claimed: true }), "claimed");
    assert.equal(rosterParentLine({ userId: "user-adult", claimed: false }), null);
    assert.equal(rosterParentLine({ userId: "user-adult", claimed: true }), "claimed");
  });
});

describe("claim link", () => {
  it("is one path a parent can open", () => {
    assert.equal(isClaimCode("abc123def4567890abcd"), true);
    assert.equal(claimPath("abc123def4567890abcd"), "/claim/abc123def4567890abcd");
    assert.equal(isClaimCode("short"), false);
    assert.equal(isClaimCode("../etc"), false);
  });
});
