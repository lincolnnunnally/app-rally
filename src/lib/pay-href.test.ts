import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cashAppDisplay,
  cashAppHref,
  cleanCashAppHandle,
  cleanVenmoHandle,
  payAmount,
  rallyQrSrc,
  venmoDeepHref,
  venmoDisplay,
  venmoWebHref,
} from "./pay-href.ts";

describe("cleanCashAppHandle", () => {
  it("strips $ and cash.app URLs", () => {
    assert.equal(cleanCashAppHandle("$CoachVidalia"), "CoachVidalia");
    assert.equal(cleanCashAppHandle("https://cash.app/$CoachVidalia/40"), "CoachVidalia");
    assert.equal(cleanCashAppHandle("  $Coach-1  "), "Coach-1");
  });
});

describe("cleanVenmoHandle", () => {
  it("strips @ and venmo.com URLs", () => {
    assert.equal(cleanVenmoHandle("@coach.vidalia"), "coachvidalia");
    assert.equal(cleanVenmoHandle("https://venmo.com/CoachVidalia"), "CoachVidalia");
    assert.equal(cleanVenmoHandle("@Coach_Vidalia"), "Coach_Vidalia");
  });
});

describe("ChurchConnect type:link hrefs", () => {
  it("builds Cash App without inventing Stripe", () => {
    assert.equal(cashAppHref("$CoachVidalia"), "https://cash.app/$CoachVidalia");
    assert.equal(cashAppHref("CoachVidalia", 40), "https://cash.app/$CoachVidalia/40");
    assert.equal(cashAppHref("CoachVidalia", "25.5"), "https://cash.app/$CoachVidalia/25.50");
    assert.equal(cashAppHref("   "), null);
    assert.equal(cashAppDisplay("$CoachVidalia"), "$CoachVidalia");
  });

  it("builds Venmo deep link plus web fallback", () => {
    assert.equal(venmoWebHref("@CoachVidalia"), "https://venmo.com/CoachVidalia");
    assert.equal(
      venmoDeepHref("CoachVidalia"),
      "venmo://paycharge?txn=pay&recipients=CoachVidalia",
    );
    assert.equal(
      venmoDeepHref("CoachVidalia", { amount: 40, note: "Rally lesson" }),
      "venmo://paycharge?txn=pay&recipients=CoachVidalia&amount=40&note=Rally+lesson",
    );
    assert.equal(venmoHrefEmpty(), true);
    assert.equal(venmoDisplay("@CoachVidalia"), "@CoachVidalia");
  });
});

describe("rallyQrSrc", () => {
  it("matches the CoachInvite qrserver pattern", () => {
    const url = "https://cash.app/$CoachVidalia";
    assert.equal(
      rallyQrSrc(url),
      `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=8&ecc=M&data=${encodeURIComponent(url)}`,
    );
  });
});

describe("payAmount", () => {
  it("drops empty and non-positive", () => {
    assert.equal(payAmount(""), "");
    assert.equal(payAmount(0), "");
    assert.equal(payAmount("$40"), "40");
  });
});

function venmoHrefEmpty() {
  return venmoWebHref("") == null && venmoDeepHref("  ") == null;
}
