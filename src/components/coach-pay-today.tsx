import { useQuery } from "@tanstack/react-query";
import { PayHandleShow } from "@/components/share-rally";
import { Card } from "@/components/ui/card";
import { myCoachPayHandles } from "@/lib/lesson-extras-server";

/** Player Today: the Cash App / Venmo handles of their coaches. */
export function CoachPayToday() {
  const q = useQuery({ queryKey: ["coach-pay-handles"], queryFn: () => myCoachPayHandles() });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Card className="mt-8">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Pay your coach</p>
      {rows.map((r) => (
        <div key={r.coach_user_id} className="mt-3">
          <p className="font-display text-xl">{r.coach_name}</p>
          <PayHandleShow cashApp={r.cash_app_handle} venmo={r.venmo_handle} note="Rally lesson" />
        </div>
      ))}
    </Card>
  );
}
