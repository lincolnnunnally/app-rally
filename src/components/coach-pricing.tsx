import { Card } from "@/components/ui/card";
import { RALLY } from "@/lib/rally";

/** Decided coach pricing, shown before anyone commits. Display only. */
export function CoachPricing({ className = "mb-4" }: { className?: string }) {
  return (
    <Card className={className}>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Coach pricing</p>
      <h2 className="mt-2 font-display text-xl">
        Pay as you go: {RALLY.coachCardPct}% + card processing
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>No annual or monthly fee. Your coach page, calendar, roster, and books cost nothing up front.</li>
        <li>
          Rally keeps {RALLY.coachCardPct}% of each lesson a player pays by credit card, plus the card
          processing fee. No cap.
        </li>
        <li>Cash App and Venmo payments go straight to you. Rally takes nothing on those.</li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Nothing is charged today. Card checkout is not turned on yet.
      </p>
    </Card>
  );
}
