import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canActorSaveLessonNotes,
  lessonNotesEditable,
  lessonNotesNotice,
} from "./lesson-notes.ts";

const coach = "coach-1";
const player = "player-1";

describe("lessonNotesEditable", () => {
  it("allows upcoming and completed, not requests", () => {
    assert.equal(lessonNotesEditable("confirmed"), true);
    assert.equal(lessonNotesEditable("checked_in"), true);
    assert.equal(lessonNotesEditable("completed"), true);
    assert.equal(lessonNotesEditable("requested"), false);
    assert.equal(lessonNotesEditable("cancelled"), false);
    assert.equal(lessonNotesEditable("declined"), false);
  });
});

describe("canActorSaveLessonNotes", () => {
  it("lets the coach write on upcoming and completed", () => {
    assert.equal(
      canActorSaveLessonNotes({ actorId: coach, coachId: coach, status: "confirmed" }).ok,
      true,
    );
    assert.equal(
      canActorSaveLessonNotes({ actorId: coach, coachId: coach, status: "checked_in" }).ok,
      true,
    );
    assert.equal(
      canActorSaveLessonNotes({ actorId: coach, coachId: coach, status: "completed" }).ok,
      true,
    );
  });

  it("keeps the student read-only", () => {
    const denied = canActorSaveLessonNotes({
      actorId: player,
      coachId: coach,
      status: "completed",
    });
    assert.equal(denied.ok, false);
  });

  it("does not invent a second notes store on a request", () => {
    const denied = canActorSaveLessonNotes({
      actorId: coach,
      coachId: coach,
      status: "requested",
    });
    assert.equal(denied.ok, false);
  });
});

describe("lessonNotesNotice", () => {
  it("points the student at the existing coaches surface", () => {
    const n = lessonNotesNotice("Third shot. Ten resets this week.");
    assert.equal(n.title, "Practice cue");
    assert.match(n.body, /Third shot/);
    assert.equal(n.href, "/app/coaches");
  });
});
