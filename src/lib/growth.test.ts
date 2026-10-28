import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanText,
  growthHighlights,
  growthRole,
  latestCheckin,
  parseRatings,
  ratingsToText,
  scoreTrend,
  skillChanges,
  startingPoint,
  type AssessmentRow,
} from "./growth.ts";

describe("ratings", () => {
  it("parses JSON text and drops anything outside 1-5", () => {
    assert.deepEqual(parseRatings('{"serve":2,"forehand":7,"Bad Key":3,"volley":"4"}'), {
      serve: 2,
      volley: 4,
    });
    assert.deepEqual(parseRatings("not json"), {});
    assert.deepEqual(parseRatings(null), {});
  });

  it("keeps only the skills for that sport", () => {
    assert.equal(ratingsToText({ serve: 3, dink: 4 }, "tennis"), '{"serve":3}');
    assert.equal(ratingsToText({ serve: 3, dink: 4 }, "pickleball"), '{"serve":3,"dink":4}');
  });
});

const rows: AssessmentRow[] = [
  { id: 3, sport: "tennis", kind: "checkin", assessed_on: "2026-10-20", ratings: { serve: 3, forehand: 4 } },
  { id: 1, sport: "tennis", kind: "baseline", assessed_on: "2026-08-01", ratings: { serve: 1, forehand: 2 } },
  { id: 2, sport: "tennis", kind: "checkin", assessed_on: "2026-09-10", ratings: { serve: 2 } },
  { id: 4, sport: "pickleball", kind: "checkin", assessed_on: "2026-07-01", ratings: { dink: 2 } },
];

describe("start vs now", () => {
  it("uses the baseline as the start and the latest other row as now", () => {
    assert.equal(startingPoint(rows, "tennis")?.id, 1);
    assert.equal(latestCheckin(rows, "tennis")?.id, 3);
  });

  it("falls back to the earliest rating when there is no baseline", () => {
    assert.equal(startingPoint(rows, "pickleball")?.id, 4);
    assert.equal(latestCheckin(rows, "pickleball"), null);
  });

  it("reports the change per skill", () => {
    const changes = skillChanges({ serve: 1, forehand: 2 }, { serve: 3, forehand: 4 }, "tennis");
    assert.deepEqual(
      changes.map((c) => [c.key, c.from, c.to, c.delta]),
      [
        ["forehand", 2, 4, 2],
        ["serve", 1, 3, 2],
      ],
    );
  });
});

describe("belief trend", () => {
  const pts = [1, 2, 2, 3, 4, 4].map((v, i) => ({
    lesson_id: i + 1,
    date: `2026-09-0${i + 1}`,
    confidence: v,
    belief: null,
  }));

  it("compares early lessons to recent ones", () => {
    assert.deepEqual(scoreTrend(pts, "confidence"), { early: 1.7, recent: 3.7, delta: 2, n: 6 });
  });

  it("waits for four scored lessons", () => {
    assert.equal(scoreTrend(pts.slice(0, 3), "confidence"), null);
    assert.equal(scoreTrend(pts, "belief"), null);
  });
});

describe("highlights", () => {
  it("answers 'am I getting better' from what is on file", () => {
    const lines = growthHighlights({
      lessonsDone: 8,
      firstLessonDate: "Aug 1",
      successesCount: 5,
      changes: skillChanges({ serve: 1 }, { serve: 3 }, "tennis"),
      points: [],
    });
    assert.equal(lines[0], "8 lessons since Aug 1. Every one is on file.");
    assert.ok(lines.some((l) => l.includes("Serve 1 → 3")));
    assert.ok(lines.some((l) => l.includes("5 lessons worth")));
  });

  it("says something kind on day one", () => {
    const lines = growthHighlights({
      lessonsDone: 0,
      firstLessonDate: null,
      successesCount: 0,
      changes: [],
      points: [],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? "", /day one/);
  });
});

describe("access", () => {
  it("lets the coach, the student, and a guardian in, nobody else", () => {
    const base = { actorId: "a", studentId: "s", isGuardian: false, isCoach: false };
    assert.equal(growthRole({ ...base, isCoach: true }), "coach");
    assert.equal(growthRole({ ...base, actorId: "s" }), "student");
    assert.equal(growthRole({ ...base, isGuardian: true }), "guardian");
    assert.equal(growthRole(base), null);
  });

  it("cleans text", () => {
    assert.equal(cleanText("  hi  "), "hi");
    assert.equal(cleanText("   "), null);
    assert.equal(cleanText(5), null);
  });
});
