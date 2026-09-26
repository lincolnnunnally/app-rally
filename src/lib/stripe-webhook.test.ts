import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { webhookHandles, webhookSecrets } from "./stripe-webhook.ts";

describe("webhook secrets", () => {
  it("tries the platform secret and the connect secret when both are set", () => {
    const secrets = webhookSecrets({
      STRIPE_WEBHOOK_SECRET: "whsec_platform",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect",
    });
    assert.deepEqual(
      secrets.map((item) => item.source),
      ["platform", "connect"],
    );
    assert.equal(secrets[0]?.secret, "whsec_platform");
    assert.equal(secrets[1]?.secret, "whsec_connect");
  });

  it("skips a blank connect secret", () => {
    const secrets = webhookSecrets({
      STRIPE_WEBHOOK_SECRET: "whsec_platform",
      STRIPE_CONNECT_WEBHOOK_SECRET: "  ",
    });
    assert.deepEqual(
      secrets.map((item) => item.source),
      ["platform"],
    );
  });
});

describe("webhook event routing", () => {
  it("gives checkout and refunds to the platform secret", () => {
    assert.equal(webhookHandles("platform", "checkout.session.completed"), true);
    assert.equal(webhookHandles("platform", "checkout.session.expired"), true);
    assert.equal(webhookHandles("platform", "charge.refunded"), true);
    assert.equal(webhookHandles("platform", "account.updated"), false);
  });

  it("gives account.updated to the connect secret", () => {
    assert.equal(webhookHandles("connect", "account.updated"), true);
    assert.equal(webhookHandles("connect", "checkout.session.completed"), false);
    assert.equal(webhookHandles("connect", "charge.refunded"), false);
  });
});
