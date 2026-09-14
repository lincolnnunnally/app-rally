import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  publicFromCents,
  rosterServiceNotice,
  serviceIsPublic,
} from "./service-visibility.ts";

describe("serviceIsPublic", () => {
  it("defaults missing visibility to public so seed rows stay listed", () => {
    assert.equal(serviceIsPublic(undefined), true);
    assert.equal(serviceIsPublic("public"), true);
    assert.equal(serviceIsPublic("player"), false);
  });
});

describe("publicFromCents", () => {
  it("ignores player-only rows when computing from-price", () => {
    assert.equal(
      publicFromCents([
        { visibility: "player", price_cents: 1000 },
        { visibility: "public", price_cents: 4500 },
        { visibility: "public", price_cents: 6000 },
      ]),
      4500,
    );
    assert.equal(publicFromCents([{ visibility: "player", price_cents: 1000 }]), null);
  });
});

describe("rosterServiceNotice", () => {
  it("names the private service and price on the existing notify path", () => {
    const n = rosterServiceNotice({
      coachName: "Quinn",
      serviceName: "Early hitting",
      priceLine: "$40/hr",
    });
    assert.equal(n.title, "A price for you");
    assert.match(n.body, /Early hitting/);
    assert.match(n.body, /\$40\/hr/);
    assert.equal(n.href, "/app/coaches");
  });
});
