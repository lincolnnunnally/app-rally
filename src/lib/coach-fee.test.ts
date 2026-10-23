import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COACH_CARD_PCT,
  lessonCardTakeCents,
  parsePaidVia,
} from "./coach-fee.ts";

describe("decided coach pricing", () => {
  it("is pay as you go: 5% card, no annual or monthly fee", async () => {
    assert.equal(COACH_CARD_PCT, 5);
    const mod = await import("./coach-fee.ts");
    for (const gone of ["COACH_YEAR_CENTS", "COACH_YEAR_DAYS", "annualFeeDue", "annualRenewsOn"]) {
      assert.equal(gone in mod, false, `${gone} should be gone`);
    }
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
