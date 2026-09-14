import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeAppNext } from "./rally.ts";
import {
  canActorSetLessonStatus,
  lessonIsOpen,
  lessonScanPath,
  lessonStatusLabel,
} from "./lesson-status.ts";

const coach = "coach-1";
const player = "player-1";
const other = "stranger";

describe("lessonScanPath", () => {
  it("points the existing QR primitive at a lesson", () => {
    assert.equal(lessonScanPath(42), "/app/lessons/42");
  });
});

describe("safeAppNext", () => {
  it("only returns in-app paths", () => {
    assert.equal(safeAppNext("/app/lessons/42"), "/app/lessons/42");
    assert.equal(safeAppNext("https://evil.example/app"), undefined);
    assert.equal(safeAppNext("//evil.example"), undefined);
    assert.equal(safeAppNext("/login"), undefined);
  });
});

describe("canActorSetLessonStatus", () => {
  it("lets the student check in and check out on a confirmed lesson", () => {
    assert.equal(
      canActorSetLessonStatus({
        actorId: player,
        coachId: coach,
        playerId: player,
        current: "confirmed",
        next: "checked_in",
      }).ok,
      true,
    );
    assert.equal(
      canActorSetLessonStatus({
        actorId: player,
        coachId: coach,
        playerId: player,
        current: "checked_in",
        next: "completed",
      }).ok,
      true,
    );
  });

  it("lets the student check out without a separate check-in", () => {
    assert.equal(
      canActorSetLessonStatus({
        actorId: player,
        coachId: coach,
        playerId: player,
        current: "confirmed",
        next: "completed",
      }).ok,
      true,
    );
  });

  it("keeps confirm / decline coach-only", () => {
    const denied = canActorSetLessonStatus({
      actorId: player,
      coachId: coach,
      playerId: player,
      current: "requested",
      next: "confirmed",
    });
    assert.equal(denied.ok, false);
    assert.equal(
      canActorSetLessonStatus({
        actorId: coach,
        coachId: coach,
        playerId: player,
        current: "requested",
        next: "confirmed",
      }).ok,
      true,
    );
  });

  it("rejects a stranger", () => {
    const denied = canActorSetLessonStatus({
      actorId: other,
      coachId: coach,
      playerId: player,
      current: "confirmed",
      next: "checked_in",
    });
    assert.equal(denied.ok, false);
  });
});

describe("lesson helpers", () => {
  it("treats checked_in as still on the board", () => {
    assert.equal(lessonIsOpen("confirmed"), true);
    assert.equal(lessonIsOpen("checked_in"), true);
    assert.equal(lessonIsOpen("completed"), false);
    assert.equal(lessonStatusLabel("checked_in"), "checked in");
  });
});
