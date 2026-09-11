import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CourtMap } from "@/components/court-map";
import { useRally } from "@/lib/rally-context";
import type { Court } from "@/lib/rally";
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
import {
  BOOKING_MODES,
  COURT_KINDS,
  RALLY,
  bookingLabel,
  citySlug,
  feeSplit,
  formatWall,
  kindLabel,
  money,
  sportLabel,
} from "@/lib/rally";
import {
  cancelReservation,
  createReservation,
  listReservations,
  registerCourt,
} from "@/lib/rally-server";

export const Route = createFileRoute("/app/courts")({ component: Courts });

function Courts() {
  const { courts } = useRally();
  const qc = useQueryClient();
  const [city, setCity] = useState<"all" | "Vidalia" | "Lyons">("all");
  const [active, setActive] = useState<number | null>(courts.find((c) => !c.is_other)?.id ?? null);
  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: () => listReservations(),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => cancelReservation({ data: { id } }),
    onSuccess: () => {
      toast.success("Released.");
      void qc.invalidateQueries({ queryKey: ["reservations"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const shown = courts.filter((c) => city === "all" || c.city === city);

  return (
    <div className="px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Courts</p>
          <h1 className="mt-2 font-display text-4xl">The board</h1>
        </div>
        <AddFacility
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["bootstrap"] });
          }}
        />
      </div>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Find a listed facility, read the rules, claim a window or call the person who actually
        books it. Rally is the app. The rec or club is the place.
      </p>

      <div className="mt-6">
        <CourtMap
          courts={courts}
          activeId={active}
          onSelect={(id) => {
            setActive(id);
            document.getElementById(`court-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        {(["all", "Vidalia", "Lyons"] as const).map((c) => (
          <Button key={c} size="sm" variant={city === c ? "default" : "outline"} onClick={() => setCity(c)}>
            {c === "all" ? "Toombs" : c}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {shown.map((c) => {
          const upcoming = (reservations.data ?? []).filter((r) => r.court_id === c.id);
          const highlighted = active === c.id;
          return (
            <Card
              key={c.id}
              id={`court-${c.id}`}
              className={highlighted ? "border-primary/50" : undefined}
              onClick={() => setActive(c.id)}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl">{c.name}</h2>
                    <Badge variant="outline">{kindLabel(c.kind)}</Badge>
                    {c.status === "coming" ? <Badge variant="warn">Coming online</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.address}, {c.city}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.sports.split(",").map((s) => (
                      <Badge key={s} variant={s.includes("pickle") ? "pickleball" : "tennis"}>
                        {s.trim()}
                      </Badge>
                    ))}
                    <Badge variant="outline">{c.court_count} courts</Badge>
                    {c.lights ? <Badge variant="outline">Lights {c.lights_until ?? ""}</Badge> : null}
                    {c.restrooms ? <Badge variant="outline">Restrooms</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm">{bookingLabel(c.booking_mode)}</p>
                  {c.slug && !c.is_other ? (
                    <p className="mt-2">
                      <Link
                        to="/where/$city/$slug"
                        params={{ city: citySlug(c.city), slug: c.slug }}
                        className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                      >
                        Public listing — share this court
                      </Link>
                    </p>
                  ) : null}
                  {(c.player_fee_cents > 0 || c.coach_fee_cents > 0 || c.facility_cut_pct > 0) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.player_fee_cents > 0
                        ? `Player ${money(c.player_fee_cents)}${feeSplit(c.player_fee_cents, RALLY.courtPct).take ? ` · Rally ${money(feeSplit(c.player_fee_cents, RALLY.courtPct).take)}` : ""} · `
                        : ""}
                      {c.coach_fee_cents > 0
                        ? `Coach court fee ${money(c.coach_fee_cents)}${feeSplit(c.coach_fee_cents, RALLY.courtPct).take ? ` · Rally ${money(feeSplit(c.coach_fee_cents, RALLY.courtPct).take)}` : ""} · `
                        : ""}
                      {c.facility_cut_pct > 0
                        ? `Facility takes ${c.facility_cut_pct}% of a lesson · Rally ${RALLY.facilityPct}% of that cut`
                        : ""}
                    </p>
                  )}
                  {c.rules ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.rules}</p>
                  ) : c.access_notes ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.access_notes}</p>
                  ) : null}
                  {c.restrictions ? (
                    <p className="mt-2 text-xs text-warn">{c.restrictions}</p>
                  ) : null}
                  {(c.manager_name || c.manager_phone) && (
                    <p className="mt-3 text-sm">
                      {c.manager_name ?? "Manager"}
                      {c.manager_phone ? (
                        <>
                          {" · "}
                          <a className="underline decoration-border underline-offset-4" href={`tel:${c.manager_phone}`}>
                            {c.manager_phone}
                          </a>
                        </>
                      ) : null}
                      {c.manager_email ? (
                        <>
                          {" · "}
                          <a className="underline decoration-border underline-offset-4" href={`mailto:${c.manager_email}`}>
                            {c.manager_email}
                          </a>
                        </>
                      ) : null}
                    </p>
                  )}
                </div>
                {c.status === "coming" || c.booking_mode === "walkup" ? (
                  c.manager_phone ? (
                    <Button asChild variant="secondary">
                      <a href={`tel:${c.manager_phone}`}>Call</a>
                    </Button>
                  ) : null
                ) : (
                  <ReserveDialog court={c} courts={courts} />
                )}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs tracking-widest text-muted-foreground uppercase">Reserved</p>
                {upcoming.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Open on the board.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {upcoming.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          {formatWall(r.starts_at)} · {sportLabel(r.sport)}
                          {r.status === "pending" ? " · pending call" : ""}
                          {r.fee_cents > 0 ? ` · ${money(r.fee_cents)}` : ""}
                          {r.rally_take_cents > 0 ? ` · Rally ${money(r.rally_take_cents)}` : ""}
                          <span className="text-muted-foreground"> · {r.mine ? "You" : r.holder_name}</span>
                        </span>
                        {r.mine ? (
                          <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                            Release
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ReserveDialog({ court, courts }: { court: Court; courts: Court[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [forCoach, setForCoach] = useState(false);
  const create = useMutation({
    mutationFn: (data: Parameters<typeof createReservation>[0]["data"]) =>
      createReservation({ data }),
    onSuccess: (res) => {
      toast.success(
        res.status === "pending"
          ? `Held as pending. Call ${court.manager_name ?? "the facility"} to lock it.`
          : res.fee_cents
            ? `Reserved · ${money(res.fee_cents)} on the card`
            : "Reserved.",
      );
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["reservations"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fee = court.player_fee_cents + (forCoach ? court.coach_fee_cents : 0);
  const split = feeSplit(fee, RALLY.courtPct);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">{court.booking_mode === "call" ? "Hold & call" : "Reserve"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{court.booking_mode === "call" ? "Hold a window" : "Reserve a window"}</DialogTitle>
        <DialogDescription>
          {court.booking_mode === "call"
            ? `Rally will hold it as pending. You still call ${court.manager_name ?? "the manager"} so it is official.`
            : "Eastern time. Overlaps on the same facility are blocked."}
        </DialogDescription>
        {court.rules ? <p className="mt-3 text-sm leading-relaxed">{court.rules}</p> : null}
        {court.restrictions ? <p className="mt-2 text-xs text-warn">{court.restrictions}</p> : null}
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({
              court_id: Number(f.get("court_id")),
              sport: String(f.get("sport")) as "pickleball" | "tennis",
              starts_at: String(f.get("starts_at")),
              duration_min: Number(f.get("duration_min")),
              notes: String(f.get("notes") || "") || undefined,
              for_coaching: forCoach,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Court</Label>
            <Select name="court_id" defaultValue={String(court.id)}>
              {courts
                .filter((c) => c.status === "open" && c.booking_mode !== "walkup")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sport</Label>
            <Select name="sport" defaultValue={court.sports.includes("tennis") && !court.sports.includes("pickle") ? "tennis" : "pickleball"}>
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Starts</Label>
            <Input name="starts_at" type="datetime-local" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Minutes</Label>
            <Input name="duration_min" type="number" defaultValue={90} min={30} max={180} />
          </div>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={forCoach} onChange={(e) => setForCoach(e.target.checked)} />
            This is a paid lesson / clinic
            {court.coach_fee_cents > 0 ? ` · +${money(court.coach_fee_cents)} court fee` : ""}
          </label>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Lesson, round robin, just us two" />
          </div>
          {fee > 0 ? (
            <p className="text-sm">
              Due at the facility: <span className="font-medium">{money(fee)}</span>
              {split.take > 0 ? ` · Rally ${money(split.take)} (${RALLY.courtPct}%) · facility keeps ${money(split.net)}` : ""}
              {court.facility_cut_pct > 0 ? ` · they also take ${court.facility_cut_pct}% of a lesson (Rally ${RALLY.facilityPct}% of that cut)` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No player fee on this court. Rally takes nothing when the fee is $0.</p>
          )}
          {court.manager_phone ? (
            <a className="text-sm underline decoration-border underline-offset-4" href={`tel:${court.manager_phone}`}>
              Call {court.manager_name ?? "manager"} {court.manager_phone}
            </a>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : court.booking_mode === "call" ? "Hold window" : "Confirm reservation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddFacility({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: (data: Parameters<typeof registerCourt>[0]["data"]) => registerCourt({ data }),
    onSuccess: () => {
      toast.success("Facility on the board.");
      setOpen(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add a court</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Register a facility</DialogTitle>
        <DialogDescription>
          Rec, club, school, backyard. Listed on Rally — not the same thing as Rally. Who books
          it, what it costs, how Rally should take the reservation.
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: String(f.get("name")),
              address: String(f.get("address")),
              city: String(f.get("city") || "Vidalia"),
              sports: String(f.get("sports")),
              court_count: Number(f.get("court_count")),
              surface: String(f.get("surface") || "") || undefined,
              indoor: f.get("indoor") === "on",
              lights: f.get("lights") === "on",
              restrooms: f.get("restrooms") === "on",
              kind: String(f.get("kind")) as "public" | "club" | "school" | "private",
              booking_mode: String(f.get("booking_mode")) as "claim" | "call" | "walkup",
              player_fee: f.get("player_fee") ? Number(f.get("player_fee")) : 0,
              coach_fee: f.get("coach_fee") ? Number(f.get("coach_fee")) : 0,
              facility_cut_pct: f.get("facility_cut_pct") ? Number(f.get("facility_cut_pct")) : 0,
              manager_name: String(f.get("manager_name") || "") || undefined,
              manager_phone: String(f.get("manager_phone") || "") || undefined,
              manager_email: String(f.get("manager_email") || "") || undefined,
              typical_hours: String(f.get("typical_hours") || "") || undefined,
              lights_until: String(f.get("lights_until") || "") || undefined,
              rules: String(f.get("rules") || "") || undefined,
              restrictions: String(f.get("restrictions") || "") || undefined,
              access_notes: String(f.get("access_notes") || "") || undefined,
            });
          }}
        >
          <Field label="Name">
            <Input name="name" required placeholder="Meadows neighborhood courts" />
          </Field>
          <Field label="Address">
            <Input name="address" required placeholder="102 Stockyard Rd" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input name="city" defaultValue="Vidalia" />
            </Field>
            <Field label="Courts">
              <Input name="court_count" type="number" defaultValue={2} min={1} max={24} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select name="kind" defaultValue="public">
                {COURT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="How it books">
              <Select name="booking_mode" defaultValue="claim">
                {BOOKING_MODES.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Sports">
            <Select name="sports" defaultValue="pickleball">
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
              <option value="tennis,pickleball">Both</option>
            </Select>
          </Field>
          <Field label="Surface">
            <Input name="surface" placeholder="Hard court, asphalt, indoor wood" />
          </Field>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label className="flex h-11 items-center gap-2">
              <input type="checkbox" name="lights" /> Lights
            </label>
            <label className="flex h-11 items-center gap-2">
              <input type="checkbox" name="restrooms" /> Restrooms
            </label>
            <label className="flex h-11 items-center gap-2">
              <input type="checkbox" name="indoor" /> Indoor
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Player fee $">
              <Input name="player_fee" type="number" min={0} defaultValue={0} />
            </Field>
            <Field label="Coach fee $">
              <Input name="coach_fee" type="number" min={0} defaultValue={0} />
            </Field>
            <Field label="Cut %">
              <Input name="facility_cut_pct" type="number" min={0} max={50} defaultValue={0} />
            </Field>
          </div>
          <Field label="Who books it">
            <Input name="manager_name" placeholder="Parks & Rec, athletic director, you" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input name="manager_phone" placeholder="912-537-7913" />
            </Field>
            <Field label="Email">
              <Input name="manager_email" type="email" />
            </Field>
          </div>
          <Field label="Hours / lights until">
            <Input name="lights_until" placeholder="10:00 PM" />
          </Field>
          <Field label="Typical hours">
            <Input name="typical_hours" placeholder="After school and weekends" />
          </Field>
          <Field label="Rules">
            <Textarea name="rules" placeholder="How a stranger should use this place." />
          </Field>
          <Field label="Restrictions">
            <Textarea name="restrictions" placeholder="No coaching without a fee, no play during school hours…" />
          </Field>
          <Field label="Access notes">
            <Textarea name="access_notes" placeholder="Gate code, parking, which door." />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Put it on the map"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
