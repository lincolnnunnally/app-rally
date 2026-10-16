import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COACH_CARD_PCT, PAID_VIA, PAID_VIA_LABEL, lessonCardTakeCents, type PaidVia } from "@/lib/coach-fee";
import { money } from "@/lib/rally";
import { setLessonPaidVia } from "@/lib/rally-server";

/** Coach marks how a lesson was paid. Card records Rally's 5% (no cap); the rest record 0. */
export function PaidViaPicker({
  lessonId,
  priceCents,
  paidVia,
}: {
  lessonId: number;
  priceCents: number | null;
  paidVia: PaidVia | null;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (via: PaidVia | null) => setLessonPaidVia({ data: { id: lessonId, paid_via: via } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["desk"] });
      toast.success("Payment method saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const take = lessonCardTakeCents(priceCents ?? 0, paidVia);
  return (
    <div>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">How they paid</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="How they paid">
        {PAID_VIA.map((via) => (
          <Button
            key={via}
            size="sm"
            type="button"
            variant={paidVia === via ? "default" : "outline"}
            aria-pressed={paidVia === via}
            disabled={save.isPending}
            onClick={() => save.mutate(paidVia === via ? null : via)}
          >
            {PAID_VIA_LABEL[via]}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {paidVia === "card"
          ? `Card: Rally ${COACH_CARD_PCT}% recorded${take > 0 ? ` (${money(take)})` : ""}. No money moves in the app.`
          : paidVia
            ? `${PAID_VIA_LABEL[paidVia]}: no Rally fee.`
            : `Cash App, Venmo, and cash carry no Rally fee. Card carries ${COACH_CARD_PCT}%.`}
      </p>
    </div>
  );
}
