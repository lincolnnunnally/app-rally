import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startConnectOnboarding } from "@/lib/payments-server";

export const Route = createFileRoute("/app/payments/refresh")({
  component: PaymentRefresh,
});

function PaymentRefresh() {
  const [message, setMessage] = useState("Refreshing the payout link…");

  useEffect(() => {
    let cancelled = false;
    startConnectOnboarding()
      .then((res) => {
        if (!cancelled) window.location.assign(res.url);
      })
      .catch((err: Error) => {
        if (!cancelled) setMessage(err.message || "Payments coming soon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Payouts</p>
      <h1 className="mt-2 font-display text-3xl">{message}</h1>
    </div>
  );
}
