import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/rally";
import {
  getConnectStatus,
  getPayOffer,
  getPlatformFeesThisMonth,
  listRefundablePayments,
  refundPayment,
  startCheckout,
  startConnectOnboarding,
  type PayOffer,
} from "@/lib/payments-server";

export function PayoutSetupCard() {
  const status = useQuery({ queryKey: ["connect-status"], queryFn: () => getConnectStatus() });
  const start = useMutation({
    mutationFn: () => startConnectOnboarding(),
    onSuccess: (res) => {
      window.location.assign(res.url);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!status.data) {
    return (
      <Card className="mb-4">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Payouts</p>
        <p className="mt-2 text-sm text-muted-foreground">Loading payout status…</p>
      </Card>
    );
  }

  const s = status.data;
  if (!s.enabled) {
    return (
      <Card className="mb-4">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Payouts</p>
        <h2 className="mt-2 font-display text-xl">Payments coming soon</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Coaches, court owners, and league organizers will connect a payout account here. Rally
          keeps a platform fee only on money that moves through the app.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Payouts</p>
      <h2 className="mt-2 font-display text-xl">
        {s.ready ? "Payouts are on" : s.detailsSubmitted ? "Stripe is reviewing the account" : "Connect payouts"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Rally keeps {s.lessonPct}% of each paid lesson, up to {money(s.lessonCapCents)} per coach
        each calendar month. After that cap, further lessons that month have no platform fee. Court
        bookings are {s.courtPct}%. League and ladder entry fees are {s.leaguePct}%. No cap on
        courts or leagues. The fee comes out of your side — the player pays the posted price.
      </p>
      <Button className="mt-4" onClick={() => start.mutate()} disabled={start.isPending}>
        {start.isPending ? "Opening Stripe…" : s.detailsSubmitted ? "Update payouts" : "Set up payouts"}
      </Button>
    </Card>
  );
}

export function RallyCheckout({
  source,
  relatedId,
  onRejoin,
}: {
  source: "lesson" | "court" | "league";
  relatedId: number;
  onRejoin?: () => void;
}) {
  const qc = useQueryClient();
  const offer = useQuery({
    queryKey: ["pay-offer", source, relatedId],
    queryFn: () => getPayOffer({ data: { source, relatedId } }),
  });
  const pay = useMutation({
    mutationFn: () => startCheckout({ data: { source, relatedId } }),
    onSuccess: (res) => {
      window.location.assign(res.url);
    },
    onError: (err: Error) => toast.error(err.message || "Payments coming soon"),
  });
  const refund = useMutation({
    mutationFn: (paymentId: number) => refundPayment({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Refund sent.");
      void qc.invalidateQueries({ queryKey: ["pay-offer", source, relatedId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (offer.isError) {
    return <p className="text-sm text-muted-foreground">Payments coming soon</p>;
  }
  if (!offer.data) return null;
  if (offer.data.canRejoin && onRejoin) {
    return (
      <Button disabled={pay.isPending} onClick={onRejoin}>
        Rejoin
      </Button>
    );
  }
  return (
    <PayOfferBody
      offer={offer.data}
      pending={pay.isPending || refund.isPending}
      onPay={() => pay.mutate()}
      onRefund={(id) => refund.mutate(id)}
    />
  );
}

function PayOfferBody({
  offer,
  pending,
  onPay,
  onRefund,
}: {
  offer: PayOffer;
  pending: boolean;
  onPay: () => void;
  onRefund: (paymentId: number) => void;
}) {
  if (offer.message === "none") return null;
  if (offer.message === "coming_soon" || !offer.enabled) {
    return <p className="text-sm text-muted-foreground">Payments coming soon</p>;
  }
  if (offer.message === "payee_setup") {
    return (
      <p className="text-sm text-muted-foreground">
        Payout setup isn&apos;t finished yet, so Rally can&apos;t take this payment.
      </p>
    );
  }
  if (offer.message === "paid") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">
          Paid {money(offer.grossCents)}
          {offer.platformFeeCents ? ` · Rally kept ${money(offer.platformFeeCents)}` : ""}
        </p>
        {offer.canRefund && offer.paymentId ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onRefund(offer.paymentId!)}>
            Refund
          </Button>
        ) : null}
      </div>
    );
  }
  if (offer.message === "refunded") {
    return <p className="text-sm text-muted-foreground">Refunded.</p>;
  }
  if (!offer.canPay) return null;
  return (
    <Button disabled={pending} onClick={onPay}>
      {pending ? "Opening checkout…" : `Pay ${money(offer.grossCents)} in Rally`}
    </Button>
  );
}

export function LeagueEntryPayments({ leagueId }: { leagueId: number }) {
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["league-payments", leagueId],
    queryFn: () => listRefundablePayments({ data: { source: "league", relatedId: leagueId } }),
  });
  const refund = useMutation({
    mutationFn: (paymentId: number) => refundPayment({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Refund sent.");
      void qc.invalidateQueries({ queryKey: ["league-payments", leagueId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  if (!rows.data || rows.data.length === 0) return null;
  return (
    <Card className="mt-6">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Entry fees</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.data.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {row.payerName} · {money(row.grossCents)} · Rally {money(row.platformFeeCents)}
            </span>
            <Button size="sm" variant="outline" disabled={refund.isPending} onClick={() => refund.mutate(row.id)}>
              Refund
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlatformFeesCard() {
  const fees = useQuery({ queryKey: ["platform-fees"], queryFn: () => getPlatformFeesThisMonth() });
  if (!fees.data || !fees.data.owner) return null;
  return (
    <Card className="mt-8">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Rally fees · {fees.data.month}</p>
      <h2 className="mt-2 font-display text-2xl">{money(fees.data.total)} this month</h2>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        <li>Lessons · {money(fees.data.lessons)}</li>
        <li>Courts · {money(fees.data.courts)}</li>
        <li>Leagues · {money(fees.data.leagues)}</li>
      </ul>
    </Card>
  );
}
