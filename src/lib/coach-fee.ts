/**
 * Decided coach pricing (owner, 2026-10-23), ledger math only — no money moves.
 *   - Pay as you go. No annual or monthly fee.
 *   - Rally keeps 5% of each lesson paid by credit card. No cap.
 *   - Card processing fees are passed through on top of the 5%. The app does not model a
 *     processing rate (there is no card checkout yet), so the ledger records only Rally's 5%.
 *   - Cash App, Venmo, and cash go straight to the coach: 0%.
 * The old $100/yr fee, the 8%-after-30-day-trial and the $15/mo options are gone.
 */
export const COACH_CARD_PCT = 5;

export const PAID_VIA = ["card", "cash_app", "venmo", "cash"] as const;
export type PaidVia = (typeof PAID_VIA)[number];

export const PAID_VIA_LABEL: Record<PaidVia, string> = {
  card: "Card",
  cash_app: "Cash App",
  venmo: "Venmo",
  cash: "Cash",
};

export function parsePaidVia(raw: unknown): PaidVia | null {
  return typeof raw === "string" && (PAID_VIA as readonly string[]).includes(raw)
    ? (raw as PaidVia)
    : null;
}

/** Rally's share of one lesson: 5% on card only, no cap; 0 otherwise. Processing is extra. */
export function lessonCardTakeCents(priceCents: number, paidVia: PaidVia | null | undefined): number {
  if (paidVia !== "card") return 0;
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 0;
  return Math.round((priceCents * COACH_CARD_PCT) / 100);
}
