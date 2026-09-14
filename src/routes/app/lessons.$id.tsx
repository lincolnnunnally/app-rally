import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LessonScanQr, PayHandleShow } from "@/components/share-rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lessonIsOpen, lessonStatusLabel } from "@/lib/lesson-status";
import { formatWall, lessonWho, money, sportLabel } from "@/lib/rally";
import { getLessonScan, setLessonStatus } from "@/lib/rally-server";

export const Route = createFileRoute("/app/lessons/$id")({
  component: LessonScan,
});

function LessonScan() {
  const { id } = Route.useParams();
  const lessonId = Number(id);
  const qc = useQueryClient();
  const scan = useQuery({
    queryKey: ["lesson-scan", lessonId],
    queryFn: () => getLessonScan({ data: { id: lessonId } }),
    enabled: Number.isFinite(lessonId),
  });
  const setStatus = useMutation({
    mutationFn: (status: "checked_in" | "completed" | "cancelled") =>
      setLessonStatus({ data: { id: lessonId, status } }),
    onSuccess: (_, status) => {
      void qc.invalidateQueries({ queryKey: ["lesson-scan", lessonId] });
      void qc.invalidateQueries({ queryKey: ["desk"] });
      void qc.invalidateQueries({ queryKey: ["my-lessons"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
      toast.success(
        status === "checked_in" ? "Checked in." : status === "completed" ? "Checked out." : "Updated.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (scan.isError) {
    return (
      <div className="px-5 py-8">
        <p className="text-sm text-muted-foreground">
          {scan.error instanceof Error ? scan.error.message : "Could not load this lesson."}
        </p>
        <Button className="mt-4" variant="secondary" asChild>
          <Link to="/app/coaches" search={{ fit: "all" }}>
            Back to coaches
          </Link>
        </Button>
      </div>
    );
  }

  if (!scan.data) {
    return <div className="px-5 py-8 text-sm text-muted-foreground">Loading lesson…</div>;
  }

  const { lesson: l, role, cash_app_handle, venmo_handle } = scan.data;
  const open = lessonIsOpen(l.status);

  return (
    <div className="px-5 py-8">
      {role === "coach" ? (
        <Link to="/app/desk" className="text-xs text-muted-foreground hover:text-foreground">
          Back to desk
        </Link>
      ) : (
        <Link
          to="/app/coaches"
          search={{ fit: "all" }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to coaches
        </Link>
      )}
      <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">Lesson</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">{l.service_name ?? sportLabel(l.sport)}</h1>
        <Badge>{lessonStatusLabel(l.status)}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {lessonWho(l)} · {l.coach_name} · {formatWall(l.starts_at)} · {l.duration_min} min
        {l.court_name ? ` · ${l.court_name}` : ""}
        {l.price_cents ? ` · ${money(l.price_cents)}` : ""}
      </p>

      <Card className="mt-6">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Check in / check out</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Scan updates this lesson on the existing status path. Check in when you arrive. Check out
          when you are done — or pay now with the same handles.
        </p>
        {open ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {l.status === "confirmed" ? (
              <Button onClick={() => setStatus.mutate("checked_in")} disabled={setStatus.isPending}>
                Check in
              </Button>
            ) : null}
            <Button
              variant={l.status === "checked_in" ? "default" : "secondary"}
              onClick={() => setStatus.mutate("completed")}
              disabled={setStatus.isPending}
            >
              Check out
            </Button>
            <Button
              variant="outline"
              onClick={() => setStatus.mutate("cancelled")}
              disabled={setStatus.isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm">This lesson is {lessonStatusLabel(l.status)}.</p>
        )}
        {role === "coach" ? <LessonScanQr lessonId={l.id} label={`${lessonWho(l)} lesson`} /> : null}
      </Card>

      <Card className="mt-6">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          {l.status === "completed" ? "Pay after check-out" : "Pay now or at the end"}
        </p>
        <h2 className="mt-2 font-display text-2xl">Cash App and Venmo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Same handle QR as Books. Rally does not take a card.
        </p>
        <PayHandleShow
          cashApp={cash_app_handle}
          venmo={venmo_handle}
          amount={l.price_cents != null ? l.price_cents / 100 : ""}
          note="Rally lesson"
        />
      </Card>
    </div>
  );
}
