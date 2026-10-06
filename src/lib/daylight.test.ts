import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VIDALIA_LAT,
  VIDALIA_LNG,
  buildSeasonSuggestions,
  confirmSeasonShift,
  dismissalBody,
  forecastHeadsUp,
  lessonForecastFlag,
  parseDismissals,
  seasonShiftData,
  shiftAnchorDate,
  solarTimesOn,
  startsWithinHours,
  suggestWallMinutes,
  suggestionMessage,
  type DaylightOccurrence,
  type SeasonSuggestion,
  type SolarTimes,
} from "./daylight.ts";

function assertNear(actual: number, expected: number, slack = 3) {
  assert.ok(
    Math.abs(actual - expected) <= slack,
    `${actual.toFixed(2)} is not within ${slack} min of ${expected}`,
  );
}

describe("NOAA sunrise and sunset for Vidalia", () => {
  // Cross-check against sunrise-sunset.org UTC times converted to America/New_York.
  // Those published times sit within a few minutes of the NOAA solar algorithm.
  it("matches 2026-10-26, still on EDT", () => {
    const times = solarTimesOn("2026-10-26", VIDALIA_LAT, VIDALIA_LNG, "America/New_York");
    assert.ok(times);
    assertNear(times.sunriseMin, 7 * 60 + 40.65);
    assertNear(times.sunsetMin, 18 * 60 + 46.53);
  });

  it("matches 2026-11-01 after the 2:00 AM clock fallback to EST", () => {
    const times = solarTimesOn("2026-11-01", VIDALIA_LAT, VIDALIA_LNG, "America/New_York");
    assert.ok(times);
    assertNear(times.sunriseMin, 6 * 60 + 45.55);
    assertNear(times.sunsetMin, 17 * 60 + 40.9);
  });

  it("matches 2026-11-02 on EST", () => {
    const times = solarTimesOn("2026-11-02", VIDALIA_LAT, VIDALIA_LNG, "America/New_York");
    assert.ok(times);
    assertNear(times.sunriseMin, 6 * 60 + 46.38);
    assertNear(times.sunsetMin, 17 * 60 + 40.03);
  });

  it("moves local sunset about an hour earlier when DST ends, with the sun almost unchanged", () => {
    const before = solarTimesOn("2026-10-31", VIDALIA_LAT, VIDALIA_LNG, "America/New_York");
    const after = solarTimesOn("2026-11-01", VIDALIA_LAT, VIDALIA_LNG, "America/New_York");
    assert.ok(before && after);
    const jump = before.sunsetMin - after.sunsetMin;
    assert.ok(jump > 50 && jump < 75, `local sunset jump was ${jump.toFixed(1)} min`);
  });
});

function slot(
  date: string,
  time: string,
  extra: Partial<DaylightOccurrence> = {},
): DaylightOccurrence {
  return {
    seriesId: "series-tuesday-1730",
    startsAt: `${date} ${time}`,
    cadenceAt: `${date} ${time}`,
    durationMin: 60,
    timezone: "America/New_York",
    status: "confirmed",
    courtLat: VIDALIA_LAT,
    courtLng: VIDALIA_LNG,
    courtLights: false,
    courtIndoor: false,
    playerName: "Avery",
    ...extra,
  };
}

describe("season suggestion rule", () => {
  const now = new Date("2026-10-06T15:00:00Z");
  const tuesdays = [
    "2026-10-06",
    "2026-10-13",
    "2026-10-20",
    "2026-10-27",
    "2026-11-03",
    "2026-11-10",
  ];

  it("asks to shift a Tue 5:30 PM series once it ends after sunset minus 15 minutes", () => {
    const suggestions = buildSeasonSuggestions({
      rows: tuesdays.map((date) => slot(date, "17:30:00")),
      dismissed: [],
      now,
    });
    assert.equal(suggestions.length, 1);
    const suggestion = suggestions[0]!;
    assert.equal(suggestion.fromDate, "2026-10-27");
    assert.equal(suggestion.localTime, "16:00");
    assert.equal(suggestion.reason, "after-dark");
    assert.equal(suggestion.locationFallback, false);
    assert.equal(
      suggestion.message,
      "Starting Oct 27, your Tue 5:30 PM series ends after dark. Shift to 4:00 PM from Oct 27?",
    );
  });

  it("labels the Vidalia fallback when the court has no lat/lng", () => {
    const suggestions = buildSeasonSuggestions({
      rows: tuesdays.map((date) => slot(date, "17:30:00", { courtLat: null, courtLng: null })),
      dismissed: [],
      now,
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]!.locationFallback, true);
    assert.equal(suggestions[0]!.fromDate, "2026-10-27");
  });

  it("stays quiet on a lit court, an indoor court, a midday lesson, and a dismissed date", () => {
    const evening = tuesdays.map((date) => slot(date, "17:30:00"));
    assert.deepEqual(
      buildSeasonSuggestions({
        rows: evening.map((row) => ({ ...row, courtLights: true })),
        dismissed: [],
        now,
      }),
      [],
    );
    assert.deepEqual(
      buildSeasonSuggestions({
        rows: evening.map((row) => ({ ...row, courtIndoor: true, courtLights: false })),
        dismissed: [],
        now,
      }),
      [],
    );
    assert.deepEqual(
      buildSeasonSuggestions({
        rows: tuesdays.map((date) => slot(date, "12:00:00")),
        dismissed: [],
        now,
      }),
      [],
    );
    const shown = buildSeasonSuggestions({ rows: evening, dismissed: [], now });
    assert.equal(shown.length, 1);
    assert.notEqual(shown[0]!.anchorDate, "2026-10-27");
    assert.equal(shown[0]!.anchorDate, shiftAnchorDate(17 * 60 + 30, 16 * 60));
    assert.deepEqual(
      buildSeasonSuggestions({
        rows: evening,
        dismissed: [{ seriesId: "series-tuesday-1730", fromDate: shown[0]!.anchorDate }],
        now,
      }),
      [],
    );
    assert.equal(
      buildSeasonSuggestions({
        rows: evening,
        dismissed: [{ seriesId: "series-tuesday-1730", fromDate: "2026-10-27" }],
        now,
      }).length,
      1,
    );
  });

  it("hides next week's same shift and shows a new season's shift", () => {
    const evening = tuesdays.map((date) => slot(date, "17:30:00"));
    const first = buildSeasonSuggestions({ rows: evening, dismissed: [], now });
    const anchor = first[0]!.anchorDate;
    const nextWeek = buildSeasonSuggestions({
      rows: evening.filter((row) => row.startsAt >= "2026-11-03"),
      dismissed: [{ seriesId: "series-tuesday-1730", fromDate: anchor }],
      now: new Date("2026-11-03T15:00:00Z"),
    });
    assert.equal(nextWeek.length, 0);

    const morning = buildSeasonSuggestions({
      rows: [slot("2026-11-03", "06:30:00")],
      dismissed: [{ seriesId: "series-tuesday-1730", fromDate: anchor }],
      now,
    });
    assert.equal(morning.length, 1);
    assert.equal(morning[0]!.reason, "before-sunrise");
    assert.notEqual(morning[0]!.anchorDate, anchor);
    assert.equal(morning[0]!.anchorDate, shiftAnchorDate(6 * 60 + 30, 7 * 60 + 30));
  });

  it("shifts a lesson that starts before sunrise plus 15 minutes later in the morning", () => {
    const suggestions = buildSeasonSuggestions({
      rows: [slot("2026-11-03", "06:30:00")],
      dismissed: [],
      now,
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]!.reason, "before-sunrise");
    assert.equal(suggestions[0]!.localTime, "07:30");
    assert.match(suggestions[0]!.message, /starts before sunrise/);
    assert.match(suggestions[0]!.message, /Shift to 7:30 AM from Nov 3/);
  });

  it("steps a 5:30 PM hour to 4:30 PM when that clears sunset minus 15", () => {
    const windows: SolarTimes[] = [{ sunriseMin: 7 * 60, sunsetMin: 18 * 60 }];
    const next = suggestWallMinutes(17 * 60 + 30, 60, windows);
    assert.equal(next, 16 * 60 + 30);
    assert.equal(
      suggestionMessage({
        fromDate: "2026-11-03",
        currentMin: 17 * 60 + 30,
        nextMin: next!,
        reason: "after-dark",
      }),
      "Starting Nov 3, your Tue 5:30 PM series ends after dark. Shift to 4:30 PM from Nov 3?",
    );
  });
});

describe("confirm season shift", () => {
  it("calls the R1 shift function with series_id, from_date, and local_time", async () => {
    const suggestion: SeasonSuggestion = {
      seriesId: "series-tuesday-1730",
      fromDate: "2026-11-03",
      anchorDate: shiftAnchorDate(17 * 60 + 30, 16 * 60 + 30),
      localTime: "16:30",
      message: "Starting Nov 3, your Tue 5:30 PM series ends after dark. Shift to 4:30 PM from Nov 3?",
      playerName: "Avery",
      locationFallback: false,
      reason: "after-dark",
    };
    const calls: { data: { series_id: string; from_date: string; local_time: string } }[] = [];
    const shiftLessonSeries = async (input: {
      data: { series_id: string; from_date: string; local_time: string };
    }) => {
      calls.push(input);
      return { ok: true as const, moved: 4 };
    };
    const result = await confirmSeasonShift(shiftLessonSeries, suggestion);
    assert.deepEqual(result, { ok: true, moved: 4 });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.data, seasonShiftData(suggestion));
    assert.deepEqual(Object.keys(calls[0]!.data).sort(), ["from_date", "local_time", "series_id"]);
    assert.equal(calls[0]!.data.series_id, "series-tuesday-1730");
    assert.equal(calls[0]!.data.from_date, "2026-11-03");
    assert.equal(calls[0]!.data.local_time, "16:30");
  });
});

describe("dismissals and weather flags", () => {
  it("round-trips dismissal JSON without a schema change", () => {
    const body = dismissalBody([
      { seriesId: "series-tuesday-1730", fromDate: "2026-10-27" },
      { seriesId: "series-tuesday-1730", fromDate: "2026-10-27" },
    ]);
    assert.deepEqual(parseDismissals(body), [
      { seriesId: "series-tuesday-1730", fromDate: "2026-10-27" },
    ]);
    assert.deepEqual(parseDismissals("not json"), []);
  });

  it("flags rain likely and thunderstorms, and ignores a dry hour", () => {
    assert.equal(forecastHeadsUp(60, 3), "rain");
    assert.equal(forecastHeadsUp(10, 95), "thunder");
    assert.equal(forecastHeadsUp(20, 1), null);
    const flag = lessonForecastFlag("2026-11-03 17:30:00", 60, [
      { time: "2026-11-03T17:00", precipitationProbability: 70, weatherCode: 61 },
      { time: "2026-11-03T18:00", precipitationProbability: 10, weatherCode: 1 },
    ]);
    assert.equal(flag?.flag, "rain");
    assert.equal(flag?.precipitationProbability, 70);
  });

  it("keeps a lesson inside a 48 hour window", () => {
    const now = new Date("2026-11-03T15:00:00Z");
    assert.equal(startsWithinHours("2026-11-03 17:30:00", "America/New_York", now, 48), true);
    assert.equal(startsWithinHours("2026-11-06 17:30:00", "America/New_York", now, 48), false);
  });
});
