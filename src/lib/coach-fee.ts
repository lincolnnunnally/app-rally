/**
 * Decided coach pricing (CoS GO 2026-10-16), ledger math only — no money moves.
 *   - $100 a year coach fee.
 *   - 5% of a lesson paid by credit card. No cap.
 *   - Cash App, Venmo, and cash: 0%.
 * The old 8%-after-30-day-trial and $15/mo options are gone.
 */
export const COACH_YEAR_CENTS = 10000;
export const COACH_CARD_PCT = 5;
export const COACH_YEAR_DAYS = 365;

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

/** Rally's share of one lesson: 5% on card only, no cap; 0 otherwise. */
export function lessonCardTakeCents(priceCents: number, paidVia: PaidVia | null | undefined): number {
  if (paidVia !== "card") return 0;
  if (!Number.isFinite(priceCents) || priceCents <= 0) return 0;
  return Math.round((priceCents * COACH_CARD_PCT) / 100);
}

/** The $100 annual fee is due when none was recorded in the last 365 days. */
export function annualFeeDue(lastRecorded: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastRecorded || Number.isNaN(lastRecorded.getTime())) return true;
  return now.getTime() - lastRecorded.getTime() >= COACH_YEAR_DAYS * 864e5;
}

/** Next date the annual fee comes up (YYYY-MM-DD), or null when never recorded. */
export function annualRenewsOn(lastRecorded: Date | null | undefined): string | null {
  if (!lastRecorded || Number.isNaN(lastRecorded.getTime())) return null;
  const d = new Date(lastRecorded.getTime() + COACH_YEAR_DAYS * 864e5);
  return d.toISOString().slice(0, 10);
}
