import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/rally";
import { confirmCheckoutReturn, getConnectStatus } from "@/lib/payments-server";

export const Route = createFileRoute("/app/payments/return")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    canceled: search.canceled === "1" ? "1" : undefined,
    connect: search.connect === "1" ? "1" : undefined,
  }),
  component: PaymentReturn,
});

function PaymentReturn() {
  const { session_id, canceled, connect } = Route.useSearch();
  const paid = useQuery({
    queryKey: ["checkout-return", session_id],
    queryFn: () => confirmCheckoutReturn({ data: { sessionId: session_id! } }),
    enabled: Boolean(session_id),
  });
  const connectStatus = useQuery({
    queryKey: ["connect-status"],
    queryFn: () => getConnectStatus(),
    enabled: connect === "1",
    staleTime: 0,
    refetchOnMount: "always",
  });

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Payments</p>
      <Card className="mt-4">
        {canceled === "1" ? (
          <>
            <h1 className="font-display text-3xl">Checkout canceled</h1>
            <p className="mt-2 text-sm text-muted-foreground">No charge was made. You can pay from the lesson, court, or league when you are ready.</p>
          </>
        ) : connect === "1" ? (
          <>
            <h1 className="font-display text-3xl">
              {connectStatus.data?.ready ? "Payouts are on" : "Payout setup saved"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {connectStatus.data?.ready
                ? "Players can pay you in Rally. The platform fee is taken from your side."
                : "Stripe still needs a detail before charges can land. Open payouts again if the status stays pending."}
            </p>
          </>
        ) : paid.data?.status === "unavailable" ? (
          <>
            <h1 className="font-display text-3xl">Payments coming soon</h1>
          </>
        ) : paid.data?.status === "paid" ? (
          <>
            <h1 className="font-display text-3xl">Paid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {money(paid.data.grossCents)} received
              {paid.data.platformFeeCents > 0 ? ` · Rally kept ${money(paid.data.platformFeeCents)}` : ""}.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl">{paid.isPending ? "Confirming payment…" : "Payment pending"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If the charge went through, this page updates as soon as Stripe confirms it.
            </p>
          </>
        )}
        <Button className="mt-4" variant="secondary" asChild>
          <Link to="/app">Back to Rally</Link>
        </Button>
      </Card>
    </div>
  );
}
