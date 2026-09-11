import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useRally } from "@/lib/rally-context";
import type { CoachBilling, CoachService, Court, Profile } from "@/lib/rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PlayerProofBlock } from "@/components/player-proof";
import { CoachInvite, ShareRally } from "@/components/share-rally";
import {
  LEVELS,
  RALLY,
  SERVICE_KINDS,
  SERVICE_UNITS,
  formatWall,
  lessonWho,
  money,
  priceLine,
  sportLabel,
} from "@/lib/rally";
import {
  addLedgerEntry,
  deleteCoachService,
  getCoachDesk,
  listDirectory,
  logLesson,
  saveCoachBilling,
  saveCoachProfile,
  saveCoachService,
  saveProfile,
  setLessonStatus,
} from "@/lib/rally-server";

export const Route = createFileRoute("/app/desk")({ component: Desk });

function Desk() {
  const { profile, courts } = useRally();
  const qc = useQueryClient();
  const desk = useQuery({ queryKey: ["desk"], queryFn: () => getCoachDesk() });
  const directory = useQuery({ queryKey: ["directory"], queryFn: () => listDirectory() });
  const setStatus = useMutation({
    mutationFn: (data: { id: number; status: "confirmed" | "declined" | "completed" | "cancelled" }) =>
      setLessonStatus({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["desk"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
      toast.success("Updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshDesk = () => {
    void qc.invalidateQueries({ queryKey: ["desk"] });
    void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    void qc.invalidateQueries({ queryKey: ["coaches"] });
    void qc.invalidateQueries({ queryKey: ["home"] });
    void qc.invalidateQueries({ queryKey: ["notices"] });
  };

  const upcoming = (desk.data?.lessons ?? []).filter((l) => l.status === "confirmed");
  const requests = (desk.data?.lessons ?? []).filter((l) => l.status === "requested");
  const pipeline = desk.data?.pipeline;

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Coach desk</p>
      <h1 className="mt-2 font-display text-4xl">Your business on the board</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Listing, a real service menu, incoming requests, recurring hours, the
        books. Players book. You confirm. The gap two weeks out is the one we
        flag.
      </p>

      {pipeline?.gap ? (
        <Card className="mt-6 border-warn/40">
          <p className="text-xs tracking-widest text-warn uppercase">Red flag</p>
          <h2 className="mt-2 font-display text-2xl">Busy this week. Empty next week.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {pipeline.thisWeek} confirmed in the next seven days, nothing in the
            seven after that. Log a recurring series or ping the roster before
            the calendar goes quiet.
          </p>
        </Card>
      ) : pipeline ? (
        <Card className="mt-6">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Pipeline</p>
          <p className="mt-2 text-sm">
            This week <span className="font-medium">{pipeline.thisWeek}</span>
            {" · "}
            Next week <span className="font-medium">{pipeline.nextWeek}</span>
          </p>
        </Card>
      ) : null}

      <Tabs defaultValue="board" className="mt-8">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="listing">Listing</TabsTrigger>
          <TabsTrigger value="books">Books</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-6">
          <div className="mb-8">
            <CoachInvite code={profile.share_code} coachName={profile.display_name} />
          </div>
          <LogLessonForm
            courts={courts}
            people={directory.data ?? []}
            services={desk.data?.services ?? []}
            onSaved={refreshDesk}
          />

          <section className="mt-10">
            <h2 className="font-display text-2xl">Requests</h2>
            <div className="mt-3 flex flex-col gap-2">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open requests.</p>
              ) : (
                requests.map((l) => (
                  <Card key={l.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm">
                        {lessonWho(l)} · {l.service_name ?? sportLabel(l.sport)}
                        {l.series_id ? " · series" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWall(l.starts_at)} · {l.duration_min} min · {l.court_name ?? "Court TBD"}
                        {l.price_cents ? ` · ${money(l.price_cents)}` : ""}
                        {l.facility_fee_cents > 0 ? ` · court ${money(l.facility_fee_cents)}` : ""}
                        {l.facility_cut_cents > 0 ? ` · cut ${money(l.facility_cut_cents)}` : ""}
                      </p>
                      {l.notes ? <p className="mt-1 text-sm">{l.notes}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setStatus.mutate({ id: l.id, status: "confirmed" })}>
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: l.id, status: "declined" })}
                      >
                        Decline
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing confirmed yet. Log a lesson or wait on a request.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {upcoming.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {lessonWho(l)} · {formatWall(l.starts_at)}
                      {l.service_name ? ` · ${l.service_name}` : ""}
                      {l.series_id ? " · recurring" : ""}
                      {l.price_cents ? ` · ${money(l.price_cents)}` : ""}
                      {l.rally_take_cents > 0 ? ` · Rally ${money(l.rally_take_cents)}` : ""}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus.mutate({ id: l.id, status: "completed" })}
                      >
                        Mark done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus.mutate({ id: l.id, status: "cancelled" })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl">Roster</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sessions you logged, plus people who credit you on their résumé — that is the proof of the price.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {(desk.data?.roster ?? []).map((r) => (
                <li key={r.user_id} className="rounded-md border border-border px-3 py-2">
                  <PlayerProofBlock player={r} sessions={r.sessions} />
                </li>
              ))}
              {(desk.data?.roster ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmed students yet.</p>
              ) : null}
            </ul>
            {(desk.data?.credited ?? []).length > 0 ? (
              <div className="mt-6">
                <h3 className="font-display text-xl">They credit you</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {desk.data!.credited.map((r) => (
                    <li key={r.user_id} className="rounded-md border border-border px-3 py-2">
                      <PlayerProofBlock player={r} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="listing" className="mt-6">
          {desk.isSuccess ? (
            <ListingForm
              key={desk.data.coach ? "listed" : "new"}
              profile={profile}
              existing={desk.data.coach}
              onSaved={refreshDesk}
            />
          ) : (
            <Card className="h-40 animate-pulse bg-secondary" />
          )}
          <ServicesPanel
            services={desk.data?.services ?? []}
            onChanged={refreshDesk}
          />
        </TabsContent>

        <TabsContent value="books" className="mt-6">
          {desk.data?.coach && desk.data.billing ? (
            <BillingCard billing={desk.data.billing} onChanged={refreshDesk} />
          ) : null}
          <div className="mb-4">
            <ShareRally code={profile.share_code} creditCents={profile.credit_cents} />
          </div>
          <BooksPanel
            income={desk.data?.books.income ?? 0}
            expense={desk.data?.books.expense ?? 0}
            net={desk.data?.books.net ?? 0}
            rows={desk.data?.books.rows ?? []}
            onChanged={refreshDesk}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogLessonForm({
  courts,
  people,
  services,
  onSaved,
}: {
  courts: Court[];
  people: { user_id: string; display_name: string }[];
  services: CoachService[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [forKind, setForKind] = useState<"self" | "child">("self");
  const tennisCourt = courts.find(
    (c) => c.status === "open" && !c.is_other && c.sports.includes("tennis"),
  );
  const save = useMutation({
    mutationFn: (data: Parameters<typeof logLesson>[0]["data"]) => logLesson({ data }),
    onSuccess: () => {
      toast.success("Lesson on the books.");
      setOpen(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Log a lesson
      </Button>
    );
  }

  return (
    <Card>
      <h2 className="font-display text-xl">Log a lesson</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        For students you already coach. Confirmed as soon as you save it. Recurring
        weeks go on both calendars.
      </p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const serviceId = f.get("service_id") ? Number(f.get("service_id")) : undefined;
          const svc = services.find((s) => s.id === serviceId);
          save.mutate({
            player_user_id: String(f.get("player_user_id")),
            sport: (svc?.sport as "pickleball" | "tennis") || (String(f.get("sport")) as "pickleball" | "tennis"),
            starts_at: String(f.get("starts_at")),
            duration_min: Number(f.get("duration_min")),
            court_id: f.get("court_id") ? Number(f.get("court_id")) : undefined,
            notes: String(f.get("notes") || "") || undefined,
            service_id: serviceId,
            recur_weeks: Number(f.get("recur_weeks") || 1),
            group_spots: f.get("group_spots") ? Number(f.get("group_spots")) : undefined,
            for_kind: forKind,
            for_name: forKind === "child" ? String(f.get("for_name") || "").trim() : undefined,
          });
        }}
      >
        <Field label="Student (the parent if this is for a kid)">
          <Select name="player_user_id" required>
            <option value="">Select</option>
            {people.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Who plays">
          <Select
            name="for_kind"
            value={forKind}
            onChange={(e) => setForKind(e.target.value === "child" ? "child" : "self")}
          >
            <option value="self">The student</option>
            <option value="child">Their child</option>
          </Select>
        </Field>
        {forKind === "child" ? (
          <Field label="Child's first name">
            <Input name="for_name" required placeholder="First name" />
          </Field>
        ) : null}
        {services.length > 0 ? (
          <Field label="Service">
            <Select name="service_id" defaultValue={String(services[0]!.id)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {priceLine(s)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Sport">
            <Select name="sport" defaultValue="pickleball">
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes">
            <Input name="duration_min" type="number" defaultValue={60} min={30} max={180} />
          </Field>
          <Field label="Weeks (recurring)">
            <Input name="recur_weeks" type="number" defaultValue={1} min={1} max={12} />
          </Field>
        </div>
        <Field label="When">
          <Input name="starts_at" type="datetime-local" required />
        </Field>
        <Field label="Court">
          <Select
            name="court_id"
            defaultValue={String(
              tennisCourt?.id ??
                courts.find((c) => c.status === "open" && !c.is_other)?.id ??
                courts[0]?.id ??
                "",
            )}
          >
            {courts
              .filter((c) => c.status !== "coming")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.coach_fee_cents > 0 ? ` · fee ${money(c.coach_fee_cents)}` : ""}
                  {c.facility_cut_pct > 0 ? ` · ${c.facility_cut_pct}% cut` : ""}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Group spots (optional)">
          <Input name="group_spots" type="number" min={1} max={16} placeholder="Leave blank for private" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" placeholder="Third shot. Working on the reset." />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save lesson"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ServicesPanel({
  services,
  onChanged,
}: {
  services: CoachService[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: (data: Parameters<typeof saveCoachService>[0]["data"]) =>
      saveCoachService({ data }),
    onSuccess: () => {
      toast.success("Service on the menu.");
      setOpen(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCoachService({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed.");
      onChanged();
    },
  });

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Service menu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Private hourly, group per person, hitting, juniors. Price is not one number.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Add"}
        </Button>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services yet. Add the hours you actually sell.</p>
        ) : (
          services.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 border-t border-border pt-2 first:border-0 first:pt-0">
              <div>
                <p className="text-sm">
                  {s.name} · {priceLine(s)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sportLabel(s.sport)} · {s.duration_min} min · {s.kind}
                  {s.notes ? ` · ${s.notes}` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
      {open ? (
        <form
          className="mt-4 grid gap-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: String(f.get("name")),
              kind: String(f.get("kind")) as "private" | "group" | "hitting" | "junior",
              sport: String(f.get("sport")) as "pickleball" | "tennis",
              price: Number(f.get("price")),
              unit: String(f.get("unit")) as "hour" | "person" | "session",
              duration_min: Number(f.get("duration_min")),
              notes: String(f.get("notes") || "") || undefined,
            });
          }}
        >
          <Field label="Name">
            <Input name="name" required placeholder="Private — kitchen and third shot" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select name="kind" defaultValue="private">
                {SERVICE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sport">
              <Select name="sport" defaultValue="pickleball">
                <option value="pickleball">Pickleball</option>
                <option value="tennis">Tennis</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price $">
              <Input name="price" type="number" min={0} max={400} required />
            </Field>
            <Field label="Unit">
              <Select name="unit" defaultValue="hour">
                {SERVICE_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes">
              <Input name="duration_min" type="number" defaultValue={60} min={30} max={180} />
            </Field>
          </div>
          <Field label="Notes">
            <Input name="notes" placeholder="Vidalia Rec. We drill the miss." />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Add to menu"}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function BillingCard({
  billing,
  onChanged,
}: {
  billing: CoachBilling;
  onChanged: () => void;
}) {
  const save = useMutation({
    mutationFn: (plan: "percent" | "monthly") => saveCoachBilling({ data: { plan } }),
    onSuccess: () => {
      toast.success("Billing saved.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-4">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Rally take</p>
      <h2 className="mt-2 font-display text-xl">
        {billing.in_trial
          ? `Trial through ${billing.trial_ends}`
          : billing.plan === "monthly"
            ? `${money(RALLY.monthlyCents)} / month`
            : `${RALLY.lessonPct}% of completed lessons`}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Rally records the intended split: {RALLY.trialDays} days after you list, then{" "}
        {RALLY.lessonPct}% of each completed lesson, or {money(RALLY.monthlyCents)} a month.
        Rec at $0 stays $0. Card checkout is not on yet — Rally does not take payment in the
        app until that path is proven.
      </p>
      {billing.take_this_month > 0 ? (
        <p className="mt-2 text-sm">Rally this month: {money(billing.take_this_month)}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={billing.stored === "percent" ? "default" : "outline"}
          onClick={() => save.mutate("percent")}
        >
          {RALLY.lessonPct}% per lesson
        </Button>
        <Button
          size="sm"
          variant={billing.stored === "monthly" ? "default" : "outline"}
          onClick={() => save.mutate("monthly")}
        >
          {money(RALLY.monthlyCents)} / month
        </Button>
      </div>
    </Card>
  );
}

function BooksPanel({
  income,
  expense,
  net,
  rows,
  onChanged,
}: {
  income: number;
  expense: number;
  net: number;
  rows: { id: number; kind: string; category: string; amount_cents: number; occurred_on: string; note: string | null }[];
  onChanged: () => void;
}) {
  const save = useMutation({
    mutationFn: (data: Parameters<typeof addLedgerEntry>[0]["data"]) =>
      addLedgerEntry({ data }),
    onSuccess: () => {
      toast.success("On the books.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Income this month</p>
          <p className="mt-2 font-display text-3xl">{money(income)}</p>
        </Card>
        <Card>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Expenses</p>
          <p className="mt-2 font-display text-3xl">{money(expense)}</p>
        </Card>
        <Card>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Net</p>
          <p className="mt-2 font-display text-3xl">{money(net)}</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-display text-xl">Log money</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed lessons write themselves. Balls, nets, insurance, travel — you add.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              kind: String(f.get("kind")) as "income" | "expense",
              category: String(f.get("category")),
              amount: Number(f.get("amount")),
              note: String(f.get("note") || "") || undefined,
            });
            e.currentTarget.reset();
          }}
        >
          <Field label="Kind">
            <Select name="kind" defaultValue="expense">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select name="category" defaultValue="balls">
              <option value="balls">Balls / paddles</option>
              <option value="facility_fee">Court / facility fee</option>
              <option value="facility_cut">Facility cut</option>
              <option value="travel">Travel</option>
              <option value="insurance">Insurance</option>
              <option value="promo">Promotion</option>
              <option value="other">Other</option>
              <option value="clinic">Clinic / extra</option>
            </Select>
          </Field>
          <Field label="Amount $">
            <Input name="amount" type="number" min={0} step="0.01" required />
          </Field>
          <Field label="Note">
            <Input name="note" placeholder="New outdoor balls" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Add entry"}
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="font-display text-xl">Recent</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing posted this month yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {r.occurred_on} · {r.category}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
                <span className={r.kind === "expense" ? "text-warn" : "text-good"}>
                  {r.kind === "expense" ? "−" : "+"}
                  {money(r.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type Listing = {
  headline: string;
  philosophy: string;
  hourly_rate: number | null;
  certifications: string;
  offers_private: boolean;
  offers_group: boolean;
  accepting: boolean;
  years_coaching: number | null;
  playing_level: string;
  specializations: string;
  achievements: string;
  travel_radius_mi: number | null;
  teaching_beginner: boolean;
  teaching_intermediate: boolean;
  teaching_advanced: boolean;
  teaching_juniors: boolean;
};

function ListingForm({
  profile,
  existing,
  onSaved,
}: {
  profile: Profile;
  existing: Listing | null;
  onSaved: () => void;
}) {
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [philosophy, setPhilosophy] = useState(existing?.philosophy ?? "");
  const [rate, setRate] = useState(existing?.hourly_rate?.toString() ?? "");
  const [certs, setCerts] = useState(existing?.certifications ?? "");
  const [years, setYears] = useState(existing?.years_coaching?.toString() ?? "");
  const [level, setLevel] = useState(existing?.playing_level ?? "");
  const [specs, setSpecs] = useState(existing?.specializations ?? "");
  const [achievements, setAchievements] = useState(existing?.achievements ?? "");
  const [travel, setTravel] = useState(existing?.travel_radius_mi?.toString() ?? "20");
  const [priv, setPriv] = useState(existing?.offers_private ?? true);
  const [group, setGroup] = useState(existing?.offers_group ?? true);
  const [accepting, setAccepting] = useState(existing?.accepting ?? true);
  const [beginner, setBeginner] = useState(existing?.teaching_beginner ?? true);
  const [intermediate, setIntermediate] = useState(existing?.teaching_intermediate ?? true);
  const [advanced, setAdvanced] = useState(existing?.teaching_advanced ?? false);
  const [juniors, setJuniors] = useState(existing?.teaching_juniors ?? false);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile.is_coach) {
        await saveProfile({
          data: {
            display_name: profile.display_name,
            city: profile.city,
            bio: profile.bio ?? undefined,
            plays_tennis: profile.plays_tennis,
            plays_pickleball: profile.plays_pickleball,
            tennis_level: profile.tennis_level ?? undefined,
            pickleball_level: profile.pickleball_level ?? undefined,
            looking_for_partners: profile.looking_for_partners,
            looking_for_coach: profile.looking_for_coach,
            interested_in_leagues: profile.interested_in_leagues,
            is_coach: true,
            availability: profile.availability ?? undefined,
            phone: profile.phone ?? undefined,
            years_playing: profile.years_playing ?? undefined,
            dupr: profile.dupr ?? undefined,
            utr: profile.utr ?? undefined,
            experience: profile.experience ?? undefined,
            accomplishments: profile.accomplishments ?? undefined,
            tennis_years: profile.tennis_years ?? undefined,
            pickleball_years: profile.pickleball_years ?? undefined,
            tennis_times: profile.tennis_times ?? undefined,
            pickleball_times: profile.pickleball_times ?? undefined,
            tennis_frequency: profile.tennis_frequency ?? undefined,
            pickleball_frequency: profile.pickleball_frequency ?? undefined,
            tennis_experience: profile.tennis_experience ?? undefined,
            pickleball_experience: profile.pickleball_experience ?? undefined,
            tennis_results: profile.tennis_results ?? undefined,
            pickleball_results: profile.pickleball_results ?? undefined,
            credit_coach_user_id: profile.credit_coach_user_id ?? undefined,
            coach_note: profile.coach_note ?? undefined,
          },
        });
      }
      await saveCoachProfile({
        data: {
          headline: headline || undefined,
          philosophy: philosophy || undefined,
          hourly_rate: rate ? Number(rate) : undefined,
          certifications: certs || undefined,
          offers_private: priv,
          offers_group: group,
          accepting,
          years_coaching: years ? Number(years) : undefined,
          playing_level: level || undefined,
          specializations: specs || undefined,
          achievements: achievements || undefined,
          travel_radius_mi: travel ? Number(travel) : undefined,
          teaching_beginner: beginner,
          teaching_intermediate: intermediate,
          teaching_advanced: advanced,
          teaching_juniors: juniors,
        },
      });
    },
    onSuccess: () => {
      toast.success("Listing saved. You are on the coach board.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Listing</h2>
        {profile.is_coach ? <Badge variant="good">On the board</Badge> : <Badge>Off</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Experience and results are what make the price make sense. The menu lives below.
      </p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Headline">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Tennis lessons at Ed Smith. Beginners and juniors."
          />
        </Field>
        <Field label="Philosophy">
          <Textarea
            value={philosophy}
            onChange={(e) => setPhilosophy(e.target.value)}
            placeholder="We drill the thing that breaks down on Thursday night, then we play it under score."
          />
        </Field>
        <Field label="What you actually teach well">
          <Input
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            placeholder="Beginner serve, kitchen, juniors, 4.0 plateau"
          />
        </Field>
        <Field label="Achievements / proof">
          <Textarea
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
            placeholder="Years on these courts. High school clinics. Ladder regular."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From price ($/hr, optional)">
            <Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min={0} />
          </Field>
          <Field label="Years coaching">
            <Input value={years} onChange={(e) => setYears(e.target.value)} type="number" min={0} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Playing level">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Travel radius (mi)">
            <Input value={travel} onChange={(e) => setTravel(e.target.value)} type="number" min={0} max={200} />
          </Field>
        </div>
        <Field label="Certifications">
          <Input
            value={certs}
            onChange={(e) => setCerts(e.target.value)}
            placeholder="PPR, USPTA, PTR — or years on these courts"
          />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Check label="Private lessons" checked={priv} onChange={setPriv} />
          <Check label="Group clinics" checked={group} onChange={setGroup} />
          <Check label="Accepting new students" checked={accepting} onChange={setAccepting} />
          <Check label="Beginners" checked={beginner} onChange={setBeginner} />
          <Check label="Intermediate" checked={intermediate} onChange={setIntermediate} />
          <Check label="Advanced / stalled" checked={advanced} onChange={setAdvanced} />
          <Check label="Juniors" checked={juniors} onChange={setJuniors} />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save listing"}
        </Button>
      </form>
    </Card>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
