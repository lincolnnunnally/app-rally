import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRally } from "@/lib/rally-context";
import type { CoachCard, Court } from "@/lib/rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlayerProofBlock } from "@/components/player-proof";
import { formatWall, money, priceLine, sportLabel, unitLabel } from "@/lib/rally";
import { ReviewBlock } from "@/components/reviews";
import { listCoaches, listMyLessons, requestLesson } from "@/lib/rally-server";

type Fit = "all" | "beginner" | "stalled" | "juniors";

export const Route = createFileRoute("/app/coaches")({
  validateSearch: (s: Record<string, unknown>) => ({
    fit: s.fit === "beginner" || s.fit === "stalled" || s.fit === "juniors" ? (s.fit as Fit) : "all",
  }),
  component: Coaches,
});

function Coaches() {
  const { profile, courts } = useRally();
  const { fit } = Route.useSearch();
  const coaches = useQuery({ queryKey: ["coaches"], queryFn: () => listCoaches() });
  const lessons = useQuery({ queryKey: ["my-lessons"], queryFn: () => listMyLessons() });

  const filtered = useMemo(() => {
    const list = coaches.data ?? [];
    if (fit === "beginner") return list.filter((c) => c.teaching_beginner);
    if (fit === "stalled") return list.filter((c) => c.teaching_advanced || (c.specializations ?? "").toLowerCase().includes("plateau"));
    if (fit === "juniors") return list.filter((c) => c.teaching_juniors);
    return list;
  }, [coaches.data, fit]);

  return (
    <div className="px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Coaches</p>
          <h1 className="mt-2 font-display text-4xl">Book a lesson</h1>
        </div>
        {profile.is_coach ? (
          <Button asChild variant="secondary">
            <Link to="/app/desk">Your desk</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link to="/app/desk">I coach</Link>
          </Button>
        )}
      </div>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Book a lesson for you or your kid. Pick Ed Smith Complex (Smith Park /
        Vidalia Rec) as the court. The coach confirms. Recurring weeks stay on
        both calendars.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {([
          ["all", "Everyone"],
          ["beginner", "I'm new"],
          ["stalled", "I've stalled"],
          ["juniors", "Juniors"],
        ] as const).map(([v, label]) => (
          <Button key={v} size="sm" variant={fit === v ? "default" : "outline"} asChild>
            <Link to="/app/coaches" search={{ fit: v }}>
              {label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {coaches.isSuccess && filtered.length === 0 ? (
          <Card>
            <p className="font-display text-xl">
              {fit === "all" ? "No coaches listed yet" : "No coaches in that filter"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {fit === "all"
                ? "Empty stays empty until a real coach opens a desk. If you teach, open yours."
                : "Try everyone, or open a desk if you teach this."}
            </p>
          </Card>
        ) : null}
        {filtered.map((c) => (
          <CoachRow key={c.user_id} coach={c} mine={c.user_id === profile.user_id} courts={courts} />
        ))}
      </div>

      {(lessons.data ?? []).length > 0 ? (
        <div className="mt-10">
          <h2 className="font-display text-2xl">Your lessons</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {lessons.data!.map((l) => (
              <li key={l.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {l.coach_name} · {l.service_name ?? sportLabel(l.sport)}
                    {l.for_kind === "child" && l.for_name ? ` · for ${l.for_name}` : ""}
                    {l.series_id ? " · recurring" : ""}
                  </span>
                  <Badge>{l.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatWall(l.starts_at)} · {l.duration_min} min · {l.court_name ?? "Court TBD"}
                  {l.price_cents ? ` · ${money(l.price_cents)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CoachRow({
  coach: c,
  mine,
  courts,
}: {
  coach: CoachCard;
  mine: boolean;
  courts: Court[];
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl">{c.display_name}</h2>
            {c.accepting ? <Badge variant="good">Accepting</Badge> : <Badge>Waitlist</Badge>}
            {c.city !== "Vidalia" ? <Badge variant="outline">{c.city}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.headline || c.city}
            {c.from_cents != null ? ` · from ${money(c.from_cents)}` : c.hourly_rate != null ? ` · from $${c.hourly_rate}` : ""}
            {c.years_coaching != null ? ` · ${c.years_coaching} yrs` : ""}
            {c.playing_level ? ` · plays ${c.playing_level}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.plays_pickleball ? <Badge variant="pickleball">Pickleball</Badge> : null}
            {c.plays_tennis ? <Badge variant="tennis">Tennis</Badge> : null}
            {c.teaching_beginner ? <Badge variant="outline">Beginners</Badge> : null}
            {c.teaching_advanced ? <Badge variant="outline">Advanced / stalled</Badge> : null}
            {c.teaching_juniors ? <Badge variant="outline">Juniors</Badge> : null}
          </div>
          {c.philosophy ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.philosophy}</p>
          ) : c.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.bio}</p>
          ) : null}
          {c.specializations ? (
            <p className="mt-2 text-sm">{c.specializations}</p>
          ) : null}
          {c.achievements ? (
            <p className="mt-1 text-xs text-muted-foreground">{c.achievements}</p>
          ) : null}
          {c.certifications ? (
            <p className="mt-1 text-xs text-muted-foreground">{c.certifications}</p>
          ) : null}
          {c.students.length > 0 ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                Players who credit this coach
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {c.students.map((s) => (
                  <li key={s.user_id}>
                    <PlayerProofBlock player={s} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {c.services.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {c.services.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 border-t border-border pt-1 first:border-0 first:pt-0">
                  <span>
                    {s.name}
                    <span className="text-muted-foreground"> · {sportLabel(s.sport)}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{priceLine(s)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!mine ? <ReviewBlock subjectType="coach" subjectId={c.user_id} noun={c.display_name} /> : null}
        </div>
        {!mine && c.accepting ? <BookDialog coach={c} courts={courts} /> : null}
      </div>
    </Card>
  );
}

function BookDialog({ coach, courts }: { coach: CoachCard; courts: Court[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [forKind, setForKind] = useState<"self" | "child">("self");
  const tennisCourt = courts.find(
    (c) => c.status === "open" && !c.is_other && c.sports.includes("tennis"),
  );
  const recCourt = courts.find((c) => c.status === "open" && !c.is_other && c.name.includes("Rec"));
  const book = useMutation({
    mutationFn: (data: Parameters<typeof requestLesson>[0]["data"]) => requestLesson({ data }),
    onSuccess: () => {
      toast.success("Request sent. The coach will confirm — you will see it on the board.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["my-lessons"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Request</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request {coach.display_name}</DialogTitle>
        <DialogDescription>Pick the service. The coach confirms. Recurring weeks stay on both calendars.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const serviceId = f.get("service_id") ? Number(f.get("service_id")) : undefined;
            const svc = coach.services.find((s) => s.id === serviceId);
            const child = String(f.get("for_name") || "").trim();
            book.mutate({
              coach_user_id: coach.user_id,
              sport: (svc?.sport as "pickleball" | "tennis") || (String(f.get("sport")) as "pickleball" | "tennis"),
              starts_at: String(f.get("starts_at")),
              duration_min: Number(f.get("duration_min")),
              court_id: Number(f.get("court_id")),
              notes: String(f.get("notes") || "") || undefined,
              service_id: serviceId,
              recur_weeks: Number(f.get("recur_weeks") || 1),
              for_kind: forKind,
              for_name: forKind === "child" ? child : undefined,
            });
          }}
        >
          {coach.services.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label>Service</Label>
              <Select name="service_id" defaultValue={String(coach.services[0]!.id)}>
                {coach.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {priceLine(s)}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Sport</Label>
              <Select name="sport" defaultValue={coach.plays_tennis && !coach.plays_pickleball ? "tennis" : "pickleball"}>
                <option value="pickleball">Pickleball</option>
                <option value="tennis">Tennis</option>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Who is this lesson for?</Label>
            <Select
              name="for_kind"
              value={forKind}
              onChange={(e) => setForKind(e.target.value === "child" ? "child" : "self")}
            >
              <option value="self">Me</option>
              <option value="child">My child</option>
            </Select>
          </div>
          {forKind === "child" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Child's first name</Label>
              <Input name="for_name" required placeholder="First name" />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label>When</Label>
            <Input name="starts_at" type="datetime-local" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Minutes</Label>
              <Input name="duration_min" type="number" defaultValue={60} min={30} max={180} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Weeks (recurring)</Label>
              <Input name="recur_weeks" type="number" defaultValue={1} min={1} max={12} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Court</Label>
            <Select
              name="court_id"
              defaultValue={String(
                tennisCourt?.id ??
                  recCourt?.id ??
                  courts.find((c) => c.status === "open")?.id ??
                  courts[0]?.id ??
                  "",
              )}
            >
              {courts
                .filter((c) => c.status === "open")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.coach_fee_cents > 0 ? ` · coach fee ${money(c.coach_fee_cents)}` : ""}
                    {c.facility_cut_pct > 0 ? ` · ${c.facility_cut_pct}% cut` : ""}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" placeholder="Working on the third shot. 3.5 doubles. I'm stalled." />
          </div>
          <Button type="submit" disabled={book.isPending}>
            {book.isPending ? "Sending…" : "Send request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
