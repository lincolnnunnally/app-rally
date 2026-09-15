/** Public vs player-only on existing `coach_services`. Not a new rate board. */

export const SERVICE_VISIBILITY = ["public", "player"] as const;
export type ServiceVisibility = (typeof SERVICE_VISIBILITY)[number];

export function serviceIsPublic(visibility?: string | null) {
  return visibility !== "player";
}

export function publicFromCents(
  services: readonly { visibility?: string | null; price_cents: number }[],
): number | null {
  const pub = services.filter((s) => serviceIsPublic(s.visibility));
  if (pub.length === 0) return null;
  return Math.min(...pub.map((s) => s.price_cents));
}

export function rosterServiceNotice(opts: {
  coachName: string;
  serviceName: string;
  priceLine: string;
}) {
  return {
    title: "A price for you",
    body: `${opts.coachName} sent ${opts.serviceName} at ${opts.priceLine}. Player-only — not on the public list.`,
    href: "/app/coaches",
  };
}
