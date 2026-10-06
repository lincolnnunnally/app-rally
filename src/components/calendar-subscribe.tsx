import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCalendarSubscription, resetCalendarSubscription } from "@/lib/calendar-server";

export function CalendarSubscribeCard() {
  const qc = useQueryClient();
  const sub = useQuery({
    queryKey: ["calendar-sub"],
    queryFn: () => getCalendarSubscription(),
  });
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const [copied, setCopied] = useState(false);
  const path = sub.data?.path ?? "";
  const url = path ? `${origin}${path}` : "";

  const reset = useMutation({
    mutationFn: () => resetCalendarSubscription(),
    onSuccess: (next) => {
      qc.setQueryData(["calendar-sub"], next);
      toast.success("Calendar link reset. The old link no longer works.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Calendar link copied.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <Card>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Calendar</p>
      <h2 className="mt-2 font-display text-2xl">Subscribe in your calendar</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This link lists your lessons for the next 12 weeks and the last 2 weeks. Anyone with the
        link can read those names. Reset the link and the old address stops working.
      </p>
      {sub.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Preparing your link…</p>
      ) : sub.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {sub.error instanceof Error ? sub.error.message : "Could not load the calendar link."}
        </p>
      ) : (
        <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{url || path}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!url} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={reset.isPending || sub.isPending}
          onClick={() => {
            if (!window.confirm("Reset the calendar link? The old address will stop working.")) return;
            reset.mutate();
          }}
        >
          {reset.isPending ? "Resetting…" : "Reset link"}
        </Button>
      </div>
    </Card>
  );
}
