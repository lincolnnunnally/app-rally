import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COACH_CARD_PCT,
  COACH_YEAR_CENTS,
  annualFeeDue,
  annualRenewsOn,
  lessonCardTakeCents,
  parsePaidVia,
} from "./coach-fee.ts";

describe("decided coach pricing", () => {
  it("is $100/yr + 5% card", () => {
    assert.equal(COACH_YEAR_CENTS, 10000);
    assert.equal(COACH_CARD_PCT, 5);
  });
});

describe("lessonCardTakeCents", () => {
  it("takes 5% on card", () => {
    assert.equal(lessonCardTakeCents(6000, "card"), 300);
    assert.equal(lessonCardTakeCents(4500, "card"), 225);
  });
  it("has no cap", () => {
    assert.equal(lessonCardTakeCents(10_000_000, "card"), 500_000);
  });
  it("takes nothing on Cash App, Venmo, cash, or unknown", () => {
    for (const via of ["cash_app", "venmo", "cash", null, undefined] as const) {
      assert.equal(lessonCardTakeCents(6000, via), 0);
    }
  });
  it("takes nothing on a free lesson", () => {
    assert.equal(lessonCardTakeCents(0, "card"), 0);
    assert.equal(lessonCardTakeCents(-5, "card"), 0);
  });
});

describe("parsePaidVia", () => {
  it("accepts known methods only", () => {
    assert.equal(parsePaidVia("card"), "card");
    assert.equal(parsePaidVia("venmo"), "venmo");
    assert.equal(parsePaidVia("stripe"), null);
    assert.equal(parsePaidVia(null), null);
  });
});

describe("annual fee", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("is due when never recorded", () => {
    assert.equal(annualFeeDue(null, now), true);
  });
  it("is not due within a year", () => {
    assert.equal(annualFeeDue(new Date("2026-01-01T00:00:00Z"), now), false);
  });
  it("is due after 365 days", () => {
    assert.equal(annualFeeDue(new Date("2025-10-16T12:00:00Z"), now), true);
  });
  it("reports the renewal date", () => {
    assert.equal(annualRenewsOn(new Date("2026-01-01T00:00:00Z")), "2027-01-01");
    assert.equal(annualRenewsOn(null), null);
  });
});
