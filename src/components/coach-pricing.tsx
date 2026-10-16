import { Card } from "@/components/ui/card";
import { RALLY, money } from "@/lib/rally";

/** Decided coach pricing, shown before anyone commits. Display only. */
export function CoachPricing({ className = "mb-4" }: { className?: string }) {
  return (
    <Card className={className}>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Coach pricing</p>
      <h2 className="mt-2 font-display text-xl">
        {money(RALLY.coachYearCents)} a year + {RALLY.coachCardPct}% on card payments
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{money(RALLY.coachYearCents)} a year for your coach page, calendar, roster, and books.</li>
        <li>
          {RALLY.coachCardPct}% of each lesson a player pays by credit card. No cap.
        </li>
        <li>Cash App and Venmo payments are free. Rally takes nothing on those.</li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Nothing is charged today. Card checkout is not turned on yet.
      </p>
    </Card>
  );
}
