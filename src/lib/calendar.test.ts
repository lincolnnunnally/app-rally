import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCalendar,
  calendarFeedHttp,
  calendarPath,
  feedWindow,
  foldIcsLine,
  formatIcsUtc,
  isCalendarToken,
  lessonSequence,
  lessonUid,
  lessonsOnDate,
  mondayOnOrBefore,
  newCalendarToken,
  resolveCalendarUser,
  rotateCalendarFeed,
  selectFeedLessons,
  shiftWeek,
  toFeedLesson,
  unfoldIcs,
  vtimezoneOffsetMinutes,
  wallToUtcDate,
  weekDates,
  type FeedLesson,
} from "./calendar.ts";
import { offsetMinutes } from "./schedule.ts";

const AS_OF = "2026-10-26";

function lesson(partial: Partial<FeedLesson> & Pick<FeedLesson, "id" | "startsAt">): FeedLesson {
  return {
    durationMin: 60,
    status: "confirmed",
    cancelReason: null,
    courtName: "Ed Smith Complex",
    coachName: "Coach Ada",
    playerName: "Kaia",
    coachUserId: "coach-a",
    playerUserId: "player-a",
    guardianUserId: "guardian-a",
    sport: "tennis",
    serviceName: null,
    timezone: "America/New_York",
    updatedAt: "2026-10-01 12:00:00",
    createdAt: "2026-09-01 12:00:00",
    notes: null,
    ...partial,
  };
}

function physicalLines(ics: string): string[] {
  const lines = ics.split("\r\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function unfoldedLines(ics: string): string[] {
  return unfoldIcs(ics)
    .split("\r\n")
    .filter((line) => line.length > 0);
}

describe("ICS timezone across Nov 1 2026", () => {
  it("keeps 8:00–9:00 wall clock with TZID and the New York DST offset change", () => {
    const before = lesson({ id: 11, startsAt: "2026-10-26 08:00:00" });
    const after = lesson({
      id: 12,
      startsAt: "2026-11-02 08:00:00",
      updatedAt: "2026-11-02 13:00:00",
    });
    const ics = buildCalendar([before, after], {
      viewerId: "coach-a",
      now: new Date("2026-10-06T15:00:00Z"),
    });

    assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:America\/New_York/);
    assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU/);
    assert.match(ics, /DTSTART;TZID=America\/New_York:20261026T080000/);
    assert.match(ics, /DTEND;TZID=America\/New_York:20261026T090000/);
    assert.match(ics, /DTSTART;TZID=America\/New_York:20261102T080000/);
    assert.match(ics, /DTEND;TZID=America\/New_York:20261102T090000/);

    assert.equal(vtimezoneOffsetMinutes("America/New_York", "2026-10-26 08:00:00"), -240);
    assert.equal(vtimezoneOffsetMinutes("America/New_York", "2026-11-02 08:00:00"), -300);
    assert.equal(offsetMinutes("2026-10-26 08:00:00", "America/New_York"), -240);
    assert.equal(offsetMinutes("2026-11-02 08:00:00", "America/New_York"), -300);
    assert.equal(formatIcsUtc(wallToUtcDate("2026-10-26 08:00:00", "America/New_York")), "20261026T120000Z");
    assert.equal(formatIcsUtc(wallToUtcDate("2026-11-02 08:00:00", "America/New_York")), "20261102T130000Z");
    assert.equal(vtimezoneOffsetMinutes("America/New_York", "2026-03-07 08:00:00"), -300);
    assert.equal(vtimezoneOffsetMinutes("America/New_York", "2026-03-09 08:00:00"), -240);
    assert.equal(offsetMinutes("2026-03-09 08:00:00", "America/New_York"), -240);

    assert.equal(vtimezoneOffsetMinutes("America/Phoenix", "2026-10-26 08:00:00"), -420);
    assert.equal(vtimezoneOffsetMinutes("America/Phoenix", "2026-11-02 08:00:00"), -420);
    const phoenix = buildCalendar(
      [lesson({ id: 13, startsAt: "2026-11-02 08:00:00", timezone: "America/Phoenix" })],
      { viewerId: "coach-a" },
    );
    assert.match(phoenix, /TZID:America\/Phoenix/);
    assert.equal(phoenix.includes("BEGIN:DAYLIGHT"), false);
    assert.match(phoenix, /DTSTART;TZID=America\/Phoenix:20261102T080000/);
  });
});

describe("ICS cancelled status, folding, and stable UID", () => {
  it("marks a cancel, folds long lines, and keeps UID when the lesson moves", () => {
    const reason = `Courts are underwater. ${"Rain ".repeat(30)}Bring it back next week.`;
    const original = lesson({
      id: 21,
      startsAt: "2026-11-02 08:00:00",
      status: "cancelled",
      cancelReason: reason,
      updatedAt: "2026-10-01 12:00:00",
      playerName: "Kaia Smith, Jr",
    });
    const moved = lesson({
      ...original,
      startsAt: "2026-11-03 09:15:00",
      updatedAt: "2026-11-03 15:04:00",
    });
    const now = new Date("2026-10-06T15:00:00Z");
    const first = buildCalendar([original], { viewerId: "coach-a", now });
    const second = buildCalendar([original], { viewerId: "coach-a", now });
    const afterMove = buildCalendar([moved], { viewerId: "coach-a", now });

    assert.equal(first, second);
    assert.equal(first.includes("\n"), true);
    assert.equal(first.replace(/\r\n/g, "").includes("\n"), false);
    for (const line of physicalLines(first)) {
      assert.ok(new TextEncoder().encode(line).length <= 75, line);
    }
    assert.notEqual(foldIcsLine(`DESCRIPTION:${reason}`), `DESCRIPTION:${reason}`);

    const flat = unfoldedLines(first).join("\n");
    assert.match(flat, /UID:lesson-21@rally/);
    assert.match(flat, /STATUS:CANCELLED/);
    assert.match(flat, /Canceled: Courts are underwater\./);
    assert.match(flat, /Kaia Smith\\, Jr/);
    assert.match(flat, /LOCATION:Ed Smith Complex/);
    assert.equal(flat.includes("private"), false);

    assert.equal(lessonUid(21), "lesson-21@rally");
    assert.match(unfoldedLines(afterMove).join("\n"), /UID:lesson-21@rally/);
    assert.match(unfoldedLines(afterMove).join("\n"), /DTSTART;TZID=America\/New_York:20261103T091500/);
    assert.ok(lessonSequence(moved) > lessonSequence(original));
    assert.match(flat, new RegExp(`SEQUENCE:${lessonSequence(original)}`));
    assert.match(flat, /LAST-MODIFIED:20261001T120000Z/);
    assert.match(unfoldedLines(afterMove).join("\n"), /LAST-MODIFIED:20261103T150400Z/);
    assert.doesNotMatch(unfoldedLines(afterMove).join("\n"), /LAST-MODIFIED:20261001T120000Z/);
  });
});

describe("calendar token", () => {
  it("returns 404 for an unknown token and drops the old token on reset", () => {
    const token = newCalendarToken();
    const other = newCalendarToken();
    assert.equal(isCalendarToken(token), true);
    assert.notEqual(token, other);
    assert.equal(calendarPath(token), `/api/calendar/${token}.ics`);

    const lessons = [
      lesson({ id: 31, startsAt: "2026-11-02 08:00:00", playerName: "Kaia" }),
      lesson({
        id: 32,
        startsAt: "2026-11-02 09:00:00",
        coachUserId: "coach-b",
        playerUserId: "player-b",
        guardianUserId: null,
        coachName: "Other Coach",
        playerName: "Bea Secret",
      }),
    ];
    const feeds = [{ userId: "coach-a", token }];
    const ok = calendarFeedHttp({ token, feeds, lessons, asOfDate: AS_OF });
    assert.equal(ok.status, 200);
    assert.equal(ok.contentType, "text/calendar; charset=utf-8");
    assert.match(ok.body, /Kaia/);
    assert.equal(ok.body.includes("Bea Secret"), false);
    assert.equal(ok.body.replace(/\r\n/g, "").includes("\n"), false);

    const unknown = calendarFeedHttp({
      token: other,
      feeds,
      lessons,
      asOfDate: AS_OF,
    });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body, "Not found");
    assert.equal(unknown.body.includes("Kaia"), false);
    assert.equal(unknown.contentType.startsWith("text/calendar"), false);

    const malformed = calendarFeedHttp({ token: "nope", feeds, lessons, asOfDate: AS_OF });
    assert.equal(malformed.status, 404);

    const rotated = rotateCalendarFeed(feeds, "coach-a", other);
    assert.equal(resolveCalendarUser(rotated.feeds, token), null);
    assert.equal(resolveCalendarUser(rotated.feeds, other), "coach-a");
    const stale = calendarFeedHttp({ token, feeds: rotated.feeds, lessons, asOfDate: AS_OF });
    assert.equal(stale.status, 404);
    assert.equal(stale.body.includes("Kaia"), false);
    const fresh = calendarFeedHttp({
      token: rotated.token,
      feeds: rotated.feeds,
      lessons,
      asOfDate: AS_OF,
    });
    assert.equal(fresh.status, 200);
    assert.match(fresh.body, /UID:lesson-31@rally/);
    assert.equal(fresh.body.includes("Bea Secret"), false);
  });
});

describe("feed visibility", () => {
  it("includes a coach's lessons and a guardian's students inside the window only", () => {
    const window = feedWindow(AS_OF);
    assert.equal(window.start, "2026-10-12");
    assert.equal(window.end, "2027-01-18");
    const rows = [
      lesson({ id: 1, startsAt: "2026-10-12 08:00:00" }),
      lesson({ id: 2, startsAt: "2026-10-11 08:00:00" }),
      lesson({ id: 3, startsAt: "2027-01-18 08:00:00" }),
      lesson({ id: 4, startsAt: "2027-01-19 08:00:00" }),
      lesson({ id: 5, startsAt: "2026-11-02 08:00:00", status: "declined" }),
      lesson({
        id: 6,
        startsAt: "2026-11-02 09:00:00",
        coachUserId: "coach-b",
        playerUserId: "student-1",
        guardianUserId: "guardian-a",
        playerName: "Student Sam",
        coachName: "Coach Bea",
      }),
    ];
    const coach = selectFeedLessons("coach-a", rows, AS_OF, "coach").map((row) => row.id);
    assert.deepEqual(coach, [1, 3]);
    const guardian = selectFeedLessons("guardian-a", rows, AS_OF, "player").map((row) => row.id);
    assert.deepEqual(guardian, [1, 6, 3]);
    const stranger = selectFeedLessons("stranger", rows, AS_OF, "any");
    assert.deepEqual(stranger, []);

    const mapped = toFeedLesson({
      id: 9,
      starts_at: "2026-11-02 08:00:00",
      status: "cancelled",
      cancel_reason: "Canceled for weather.",
      private_notes: "SECRET_NOTE",
      phone: "555-0100",
      email: "hidden@example.com",
      coach_user_id: "coach-a",
      player_user_id: "player-a",
      court_name: "Ed Smith Complex",
    });
    const packed = JSON.stringify(mapped);
    assert.equal(packed.includes("SECRET_NOTE"), false);
    assert.equal(packed.includes("555-0100"), false);
    assert.equal(packed.includes("hidden@example.com"), false);
    assert.equal(mapped.cancelReason, "Canceled for weather.");
    assert.equal(mapped.courtName, "Ed Smith Complex");
  });
});

describe("week grid date math", () => {
  it("uses Monday–Sunday weeks and steps across the Nov 1 2026 Sunday", () => {
    assert.equal(mondayOnOrBefore("2026-11-01"), "2026-10-26");
    assert.equal(mondayOnOrBefore("2026-11-02"), "2026-11-02");
    assert.equal(mondayOnOrBefore("2026-10-28"), "2026-10-26");
    const week = weekDates("2026-10-26");
    assert.deepEqual(week, [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    assert.equal(shiftWeek("2026-10-26", 1), "2026-11-02");
    assert.equal(shiftWeek("2026-10-26", -1), "2026-10-19");
    assert.equal(mondayOnOrBefore("2026-11-04"), "2026-11-02");

    const rows = [
      lesson({ id: 41, startsAt: "2026-10-26 08:00:00", status: "confirmed" }),
      lesson({
        id: 42,
        startsAt: "2026-11-01 09:00:00",
        status: "cancelled",
        cancelReason: "Canceled for weather.",
      }),
      lesson({ id: 43, startsAt: "2026-11-02 08:00:00" }),
    ];
    assert.deepEqual(
      lessonsOnDate(rows, "2026-10-26").map((row) => row.id),
      [41],
    );
    const sunday = lessonsOnDate(rows, "2026-11-01");
    assert.equal(sunday.length, 1);
    assert.equal(sunday[0]!.status, "cancelled");
    assert.equal(sunday[0]!.cancelReason, "Canceled for weather.");
    assert.deepEqual(
      lessonsOnDate(rows, shiftWeek(week[0]!, 1)).map((row) => row.id),
      [43],
    );
    assert.equal(lessonsOnDate(rows, "2026-10-27").length, 0);
  });
});
