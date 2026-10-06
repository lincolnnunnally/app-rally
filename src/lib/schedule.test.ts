import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_WEATHER_REASON,
  STANDING_HORIZON_WEEKS,
  addLocalWeeks,
  extendAfterLast,
  cancelNoticeHref,
  formatNoticeWhen,
  lessonCameOff,
  lessonConfirmNotice,
  lessonDeclineNotice,
  lessonNoticeAudience,
  lessonOnBoard,
  lessonRequestNotice,
  moveSingleLesson,
  noticeTarget,
  offsetMinutes,
  renewWeekCount,
  seriesShiftNotice,
  shiftSeriesFromDate,
  singleMoveNotice,
  stampTime,
  topUpStandingSlots,
  weatherCancelIds,
  weatherCancelNotices,
  weatherReason,
  weeklyStamps,
  type ScheduleOccurrence,
} from "./schedule.ts";

const coach = "coach-1";
const player = "player-1";
const otherCoach = "coach-2";
const otherPlayer = "player-2";

function occ(
  partial: Partial<ScheduleOccurrence> & Pick<ScheduleOccurrence, "id" | "starts_at">,
): ScheduleOccurrence {
  return {
    series_id: "series-a",
    cadence_at: null,
    coach_user_id: coach,
    player_user_id: player,
    status: "confirmed",
    ...partial,
  };
}

describe("moveSingleLesson", () => {
  it("changes that lesson only and leaves siblings unchanged", () => {
    const rows = [
      occ({ id: 1, starts_at: "2026-10-26 07:30:00" }),
      occ({ id: 2, starts_at: "2026-11-02 07:30:00" }),
      occ({ id: 3, starts_at: "2026-11-09 07:30:00" }),
    ];
    const next = moveSingleLesson(rows, 2, "2026-11-03T09:15");
    assert.equal(next[0].starts_at, "2026-10-26 07:30:00");
    assert.equal(next[2].starts_at, "2026-11-09 07:30:00");
    assert.equal(next[1].starts_at, "2026-11-03 09:15:00");
    assert.equal(next[1].cadence_at, "2026-11-02 07:30:00");
    assert.equal(rows[1].starts_at, "2026-11-02 07:30:00");
  });
});

describe("shiftSeriesFromDate", () => {
  it("leaves occurrences before the chosen date unchanged", () => {
    const rows = [
      occ({ id: 1, starts_at: "2026-10-26 07:30:00" }),
      occ({ id: 2, starts_at: "2026-11-02 07:30:00" }),
      occ({ id: 3, starts_at: "2026-11-09 07:30:00" }),
      occ({ id: 4, series_id: "series-b", starts_at: "2026-11-02 07:30:00" }),
    ];
    const next = shiftSeriesFromDate(rows, "series-a", "2026-11-02", "08:00");
    assert.equal(next[0].starts_at, "2026-10-26 07:30:00");
    assert.equal(next[1].starts_at, "2026-11-02 08:00:00");
    assert.equal(next[2].starts_at, "2026-11-09 08:00:00");
    assert.equal(next[3].starts_at, "2026-11-02 07:30:00");
    assert.equal(next[1].cadence_at, "2026-11-02 08:00:00");
  });
});

describe("DST wall clock", () => {
  it("keeps 8:00 local before and after the Nov 1 2026 US DST end", () => {
    const zone = "America/New_York";
    const stamps = weeklyStamps("2026-10-26 08:00:00", 3);
    assert.deepEqual(stamps, ["2026-10-26 08:00:00", "2026-11-02 08:00:00", "2026-11-09 08:00:00"]);
    for (const stamp of stamps) assert.equal(stampTime(stamp), "08:00:00");
    const before = offsetMinutes("2026-10-26 08:00:00", zone);
    const after = offsetMinutes("2026-11-02 08:00:00", zone);
    assert.equal(before, -240);
    assert.equal(after, -300);
    assert.notEqual(before, after);

    const shifted = shiftSeriesFromDate(
      stamps.map((starts_at, index) =>
        occ({ id: index + 1, starts_at: starts_at.replace("08:00:00", "07:30:00") }),
      ),
      "series-a",
      "2026-10-26",
      "08:00",
    );
    assert.deepEqual(
      shifted.map((row) => row.starts_at),
      stamps,
    );
  });
});

describe("open-ended standing materialization", () => {
  it("fills a rolling window of weekly 8:00 slots and does not repeat existing ones", () => {
    const initial = weeklyStamps("2026-10-05 08:00:00", STANDING_HORIZON_WEEKS);
    assert.equal(initial.length, 12);
    assert.equal(stampTime(initial[0]!), "08:00:00");
    assert.equal(stampTime(initial[11]!), "08:00:00");
    const topped = topUpStandingSlots({ existingCadence: initial, asOfDate: "2026-10-05" });
    assert.ok(topped.every((stamp) => stampTime(stamp) === "08:00:00"));
    assert.ok(topped.every((stamp) => stamp > initial[11]!));

    const partial = initial.slice(0, 2);
    const more = topUpStandingSlots({ existingCadence: partial, asOfDate: "2026-10-05" });
    assert.ok(more.length >= 10);
    assert.equal(more[0], addLocalWeeks(partial[1]!, 1));
    assert.ok(more.every((stamp) => stampTime(stamp) === "08:00:00"));
    assert.ok(more.some((stamp) => stamp.startsWith("2026-11-02 ")));
    assert.equal(more[more.length - 1]!.slice(0, 10) <= "2026-12-28", true);

    const extended = extendAfterLast(initial, 4);
    assert.equal(extended.length, 4);
    assert.equal(stampTime(extended[0]!), "08:00:00");
    assert.equal(renewWeekCount(initial.length), 12);
  });
});

describe("weather cancel", () => {
  it("cancels only that coach and that day", () => {
    const rows = [
      { id: 1, coach_user_id: coach, starts_at: "2026-11-02 08:00:00", status: "confirmed" },
      { id: 2, coach_user_id: coach, starts_at: "2026-11-02 15:00:00", status: "requested" },
      { id: 3, coach_user_id: otherCoach, starts_at: "2026-11-02 08:00:00", status: "confirmed" },
      { id: 4, coach_user_id: coach, starts_at: "2026-11-03 08:00:00", status: "confirmed" },
      { id: 5, coach_user_id: coach, starts_at: "2026-11-02 09:00:00", status: "completed" },
      { id: 6, coach_user_id: coach, starts_at: "2026-11-02 10:00:00", status: "cancelled" },
    ];
    assert.deepEqual(weatherCancelIds(rows, coach, "2026-11-02"), [1, 2]);
    assert.equal(weatherReason("  "), DEFAULT_WEATHER_REASON);
    assert.equal(weatherReason("Courts are underwater."), "Courts are underwater.");
  });
});

describe("schedule notices", () => {
  it("notifies the other party for a move, a series shift, and a weather day", () => {
    assert.equal(noticeTarget(coach, coach, player), player);
    assert.equal(noticeTarget(player, coach, player), coach);

    const guardian = "guardian-1";
    assert.deepEqual(
      lessonNoticeAudience({
        recipientId: player,
        playerId: player,
        guardianId: guardian,
        actorId: coach,
      }),
      [player, guardian],
    );
    assert.deepEqual(
      lessonNoticeAudience({
        recipientId: player,
        playerId: player,
        guardianId: player,
        actorId: coach,
      }),
      [player],
    );
    assert.deepEqual(
      lessonNoticeAudience({
        recipientId: player,
        playerId: player,
        guardianId: coach,
        actorId: coach,
      }),
      [player],
    );
    assert.deepEqual(
      lessonNoticeAudience({
        recipientId: coach,
        playerId: player,
        guardianId: guardian,
        actorId: player,
      }),
      [coach],
    );
    assert.deepEqual(
      lessonNoticeAudience({
        recipientId: "student:kaia",
        playerId: "student:kaia",
        guardianId: guardian,
        actorId: coach,
      }),
      ["student:kaia", guardian],
    );

    assert.equal(formatNoticeWhen("2026-10-27 17:30:00"), "Tue, Oct 27, 5:30 PM");
    assert.equal(
      lessonOnBoard({ whenLabel: "Tue, Oct 27, 5:30 PM", coachName: "Coach Sam", playerName: "Kaia" }),
      "Tue, Oct 27, 5:30 PM with Coach Sam for Kaia is on the board.",
    );
    assert.equal(
      lessonCameOff({ whenLabel: "Tue, Oct 27, 5:30 PM", coachName: "Coach Sam", playerName: "Kaia" }),
      "Tue, Oct 27, 5:30 PM with Coach Sam for Kaia came off the board.",
    );
    assert.equal(
      lessonCameOff({
        whenLabel: "Mon, Jan 25, 10:00 AM",
        coachName: "Coach Sam",
        playerName: "Kaia",
        reason: "Rain day",
      }),
      "Mon, Jan 25, 10:00 AM with Coach Sam for Kaia came off the board. Rain day",
    );
    const requested = lessonRequestNotice({
      whenLabel: "Mon, Jan 25, 10:00 AM",
      playerName: "Kaia",
      coachName: "Coach Sam",
      sport: "tennis",
      span: " · recurring",
    });
    assert.equal(requested.href, "/app/desk");
    assert.match(requested.body, /Kaia asked Coach Sam for tennis/);
    const confirmed = lessonConfirmNotice({
      lessonId: 32,
      whenLabel: "Mon, Jan 25, 10:00 AM",
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    assert.equal(confirmed.href, "/app/lessons/32");
    assert.doesNotMatch(confirmed.href, /coaches/);
    const declined = lessonDeclineNotice({
      lessonId: 32,
      whenLabel: "Mon, Jan 25, 10:00 AM",
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    assert.equal(declined.href, "/app/lessons/32");
    assert.equal(cancelNoticeHref(player, coach, 34), "/app/lessons/34");
    assert.equal(cancelNoticeHref("guardian-1", coach, 34), "/app/lessons/34");
    assert.equal(cancelNoticeHref(coach, coach, 34), "/app/desk");

    const moved = singleMoveNotice({
      actorId: coach,
      coachId: coach,
      playerId: player,
      lessonId: 2,
      whenLabel: "Tue, Oct 27, 5:30 PM",
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    assert.equal(moved?.userId, player);
    assert.equal(moved?.title, "Lesson rescheduled");
    assert.equal(moved?.href, "/app/lessons/2");
    assert.match(moved?.body ?? "", /Tue, Oct 27, 5:30 PM/);
    assert.match(moved?.body ?? "", /Coach Sam with Kaia/);

    const shifted = seriesShiftNotice({
      actorId: player,
      coachId: coach,
      playerId: player,
      lessonId: 2,
      fromDate: "2026-10-27",
      timeLabel: "17:30",
      coachName: "Coach Sam",
      playerName: "Kaia",
    });
    assert.equal(shifted?.userId, coach);
    assert.equal(shifted?.href, "/app/lessons/2");
    assert.match(shifted?.body ?? "", /Tue, Oct 27/);
    assert.match(shifted?.body ?? "", /5:30 PM/);
    assert.match(shifted?.body ?? "", /Coach Sam with Kaia/);

    const weather = weatherCancelNotices(
      [
        {
          id: 1,
          coach_user_id: coach,
          player_user_id: player,
          starts_at: "2026-11-02 08:00:00",
          status: "confirmed",
          coach_name: "Coach Sam",
          player_name: "Kaia",
        },
        {
          id: 2,
          coach_user_id: coach,
          player_user_id: player,
          starts_at: "2026-11-02 15:00:00",
          status: "confirmed",
          coach_name: "Coach Sam",
          player_name: "Kaia",
        },
        {
          id: 3,
          coach_user_id: coach,
          player_user_id: otherPlayer,
          starts_at: "2026-11-02 09:00:00",
          status: "confirmed",
          coach_name: "Coach Sam",
          player_name: "Jules",
        },
        {
          id: 4,
          coach_user_id: otherCoach,
          player_user_id: player,
          starts_at: "2026-11-02 11:00:00",
          status: "confirmed",
        },
      ],
      coach,
      "2026-11-02",
      DEFAULT_WEATHER_REASON,
    );
    assert.deepEqual(
      weather.map((notice) => notice.userId),
      [player, otherPlayer],
    );
    assert.equal(weather[0]?.title, "Lesson canceled");
    assert.equal(weather[0]?.href, "/app/lessons/1");
    assert.match(weather[0]?.body ?? "", /Mon, Nov 2, 8:00 AM with Coach Sam for Kaia came off the board/);
    assert.match(weather[0]?.body ?? "", /Mon, Nov 2, 3:00 PM with Coach Sam for Kaia came off the board/);
    assert.match(weather[0]?.body ?? "", /Canceled for weather/);
    assert.equal(weather[1]?.href, "/app/lessons/3");
    assert.match(weather[1]?.body ?? "", /Jules/);
    assert.doesNotMatch(weather[0]?.href ?? "", /\/app\/desk/);
  });
});
