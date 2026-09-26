import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLessonVideoChoice,
  canActorOwnLessonVideoPath,
  canActorSaveLessonVideo,
  isLessonVideoData,
  isLessonVideoObjectPath,
  lessonVideoEditable,
  lessonVideoNotice,
  lessonVideoNoticeTarget,
  lessonVideoObjectPath,
  lessonVideoPlaybackSrc,
  lessonVideoUiMessage,
  showsPlayerLessonVideo,
  withCoachAsPlayer,
  LESSON_VIDEO_ERRORS,
  LESSON_VIDEO_MAX_BYTES,
} from "./lesson-video.ts";

const coach = "coach-1";
const player = "player-1";
const other = "other-1";
const clip = "11111111-1111-4111-8111-111111111111";

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

describe("assertLessonVideoChoice", () => {
  it("accepts a 6 second phone clip that used to hit the data-URI cap", () => {
    const choice = assertLessonVideoChoice({
      contentType: "video/mp4",
      fileName: "IMG_0001.mp4",
      byteSize: 4_600_000,
      durationSec: 6,
    });
    assert.equal(choice.contentType, "video/mp4");
    assert.equal(choice.extension, "mp4");
  });

  it("reads mov from the file name when the phone leaves the type blank", () => {
    const choice = assertLessonVideoChoice({
      contentType: "",
      fileName: "clip.MOV",
      byteSize: 1_000_000,
      durationSec: 20,
    });
    assert.equal(choice.contentType, "video/quicktime");
    assert.equal(choice.extension, "mov");
  });

  it("says over 60 seconds when the clip is too long", () => {
    assert.throws(
      () =>
        assertLessonVideoChoice({
          contentType: "video/mp4",
          fileName: "long.mp4",
          byteSize: 4_600_000,
          durationSec: 61,
        }),
      new Error(LESSON_VIDEO_ERRORS.tooLong),
    );
  });

  it("says over 50 MB when the file is too big", () => {
    assert.throws(
      () =>
        assertLessonVideoChoice({
          contentType: "video/mp4",
          fileName: "big.mp4",
          byteSize: LESSON_VIDEO_MAX_BYTES + 1,
          durationSec: 10,
        }),
      new Error(LESSON_VIDEO_ERRORS.tooBig),
    );
  });

  it("rejects a photo with its own message", () => {
    assert.throws(
      () =>
        assertLessonVideoChoice({
          contentType: "image/jpeg",
          fileName: "still.jpg",
          byteSize: 200_000,
          durationSec: 1,
        }),
      new Error(LESSON_VIDEO_ERRORS.type),
    );
  });

  it("keeps reading an old data-URI clip", () => {
    assert.equal(isLessonVideoData("data:video/webm;base64,AAAA"), true);
    assert.equal(isLessonVideoData(null), false);
  });

  it("plays an old data-URI clip when storage is not signed", () => {
    const legacy = "data:video/mp4;base64,AAAA";
    assert.equal(lessonVideoPlaybackSrc(legacy, null), legacy);
    assert.equal(lessonVideoPlaybackSrc(legacy, undefined), legacy);
    assert.equal(
      lessonVideoPlaybackSrc(legacy, "https://uqhqulrqcygsmmzdzemx.supabase.co/storage/v1/object/sign/rally-lesson-videos/7/a.mp4"),
      "https://uqhqulrqcygsmmzdzemx.supabase.co/storage/v1/object/sign/rally-lesson-videos/7/a.mp4",
    );
  });
});

describe("lessonVideoUiMessage", () => {
  it("says video upload is not set up instead of a raw storage error", () => {
    assert.equal(
      lessonVideoUiMessage(new Error("Lesson video storage is not configured.")),
      LESSON_VIDEO_ERRORS.notSetUp,
    );
    assert.equal(
      lessonVideoUiMessage(new Error("Missing SUPABASE_SERVICE_ROLE_KEY")),
      LESSON_VIDEO_ERRORS.notSetUp,
    );
    assert.equal(lessonVideoUiMessage(new Error(LESSON_VIDEO_ERRORS.notSetUp)), LESSON_VIDEO_ERRORS.notSetUp);
    assert.equal(
      lessonVideoUiMessage(new Error("Error: boom\n    at signLessonVideoPlayback")),
      LESSON_VIDEO_ERRORS.upload,
    );
  });
});

describe("lesson video object path", () => {
  it("keeps the object inside that lesson folder", () => {
    const path = lessonVideoObjectPath(7, clip, "mp4");
    assert.equal(path, `7/${clip}.mp4`);
    assert.equal(isLessonVideoObjectPath(7, path), true);
    assert.equal(isLessonVideoObjectPath(8, path), false);
    assert.equal(isLessonVideoObjectPath(7, `7/../8/${clip}.mp4`), false);
    assert.equal(isLessonVideoObjectPath(7, `7/${clip}.jpg`), false);
  });

  it("forbids signing an upload or playback url for a stranger or another lesson", () => {
    const objectPath = lessonVideoObjectPath(7, clip, "mp4");
    assert.equal(objectPath.startsWith("7/"), true);
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: other,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath,
      }),
      false,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: coach,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath: "8/11111111-1111-4111-8111-111111111111.mp4",
      }),
      false,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: player,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath: "not-a-lesson/clip.mp4",
      }),
      false,
    );
  });

  it("lets the coach or the student own the path, not a stranger", () => {
    const objectPath = lessonVideoObjectPath(7, clip, "mov");
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: coach,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath,
      }),
      true,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: player,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath,
      }),
      true,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: coach,
        coachId: coach,
        playerId: coach,
        lessonId: 7,
        objectPath,
      }),
      true,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: other,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath,
      }),
      false,
    );
    assert.equal(
      canActorOwnLessonVideoPath({
        actorId: coach,
        coachId: coach,
        playerId: player,
        lessonId: 7,
        objectPath: lessonVideoObjectPath(9, clip, "mp4"),
      }),
      false,
    );
  });
});
