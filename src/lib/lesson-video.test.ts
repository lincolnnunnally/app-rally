import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLessonVideoPayload,
  canActorSaveLessonVideo,
  isLessonVideoData,
  lessonVideoEditable,
  lessonVideoNotice,
  lessonVideoNoticeTarget,
  showsPlayerLessonVideo,
  withCoachAsPlayer,
  LESSON_VIDEO_MAX,
} from "./lesson-video.ts";

const coach = "coach-1";
const player = "player-1";
const other = "other-1";

describe("lessonVideoEditable", () => {
  it("uses the same upcoming/completed window as notes", () => {
    assert.equal(lessonVideoEditable("confirmed"), true);
    assert.equal(lessonVideoEditable("checked_in"), true);
    assert.equal(lessonVideoEditable("completed"), true);
    assert.equal(lessonVideoEditable("requested"), false);
    assert.equal(lessonVideoEditable("cancelled"), false);
  });
});

describe("canActorSaveLessonVideo", () => {
  it("lets the coach or the student on that lesson attach a clip", () => {
    assert.equal(
      canActorSaveLessonVideo({
        actorId: coach,
        coachId: coach,
        playerId: player,
        status: "confirmed",
      }).ok,
      true,
    );
    assert.equal(
      canActorSaveLessonVideo({
        actorId: player,
        coachId: coach,
        playerId: player,
        status: "completed",
      }).ok,
      true,
    );
  });

  it("keeps a stranger off the existing lesson row", () => {
    const denied = canActorSaveLessonVideo({
      actorId: other,
      coachId: coach,
      playerId: player,
      status: "confirmed",
    });
    assert.equal(denied.ok, false);
  });

  it("does not invent video on a request", () => {
    const denied = canActorSaveLessonVideo({
      actorId: coach,
      coachId: coach,
      playerId: player,
      status: "requested",
    });
    assert.equal(denied.ok, false);
  });

  it("lets one account be the coach and the player on that lesson", () => {
    assert.equal(
      canActorSaveLessonVideo({
        actorId: coach,
        coachId: coach,
        playerId: coach,
        status: "confirmed",
      }).ok,
      true,
    );
    assert.equal(
      showsPlayerLessonVideo({ actorId: coach, playerId: coach, status: "completed" }),
      true,
    );
    assert.equal(
      showsPlayerLessonVideo({ actorId: coach, playerId: player, status: "completed" }),
      false,
    );
    assert.equal(lessonVideoNoticeTarget(coach, coach, coach), null);
    assert.equal(lessonVideoNoticeTarget(coach, coach, player), player);
    assert.equal(lessonVideoNoticeTarget(player, coach, player), coach);
    const people = withCoachAsPlayer(
      { user_id: coach, display_name: "Coach Video" },
      [
        { user_id: player, display_name: "Student" },
        { user_id: coach, display_name: "Coach Video" },
      ],
    );
    assert.deepEqual(people, [
      { user_id: coach, display_name: "Coach Video (you)" },
      { user_id: player, display_name: "Student" },
    ]);
  });
});

describe("lessonVideoNotice", () => {
  it("points at the existing lesson scan door", () => {
    const n = lessonVideoNotice(42);
    assert.equal(n.title, "Practice video");
    assert.equal(n.href, "/app/lessons/42");
  });
});

describe("assertLessonVideoPayload", () => {
  it("clears on empty and accepts a data-URI video", () => {
    assert.equal(assertLessonVideoPayload(""), null);
    assert.equal(assertLessonVideoPayload("data:video/mp4;base64,AAAA"), "data:video/mp4;base64,AAAA");
    assert.equal(isLessonVideoData("data:video/webm;base64,AAAA"), true);
    assert.equal(isLessonVideoData(null), false);
  });

  it("rejects photos and oversized payloads", () => {
    assert.throws(() => assertLessonVideoPayload("data:image/jpeg;base64,xx"), /stroke clip/);
    assert.throws(() => assertLessonVideoPayload(`data:video/mp4;base64,${"A".repeat(LESSON_VIDEO_MAX)}`), /too large/);
  });
});
