/**
 * Stripe sends platform events and connected-account events to separate
 * endpoints, each with its own signing secret. Rally uses one route and
 * tries both secrets. The secret that verifies decides which events we run.
 */

import type { EnvLike } from "./platform-fee.ts";

export type WebhookSource = "platform" | "connect";

const PLATFORM_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.refunded",
]);

export function webhookSecrets(env: EnvLike): Array<{ source: WebhookSource; secret: string }> {
  const secrets: Array<{ source: WebhookSource; secret: string }> = [];
  const platform = env.STRIPE_WEBHOOK_SECRET?.trim();
  const connect = env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (platform) secrets.push({ source: "platform", secret: platform });
  if (connect) secrets.push({ source: "connect", secret: connect });
  return secrets;
}

/** Platform secret: checkout and refunds. Connect secret: account.updated only. */
export function webhookHandles(source: WebhookSource, type: string): boolean {
  if (source === "connect") return type === "account.updated";
  return PLATFORM_EVENTS.has(type);
}
