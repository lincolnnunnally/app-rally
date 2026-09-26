import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LEAGUE_FORMATS, RALLY, feeSplit, formatLabel, money, sportLabel } from "@/lib/rally";
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
import { PayoutSetupCard, RallyCheckout } from "@/components/rally-pay";
import { getPaymentsConfig } from "@/lib/payments-server";
import { createLeague, joinLeague, listLeagues } from "@/lib/rally-server";

export const Route = createFileRoute("/app/leagues/")({ component: Leagues });

function Leagues() {
  const qc = useQueryClient();
  const leagues = useQuery({ queryKey: ["leagues"], queryFn: () => listLeagues() });
  const payments = useQuery({ queryKey: ["pay-config"], queryFn: () => getPaymentsConfig() });
  const join = useMutation({
    mutationFn: (data: { id: number; join: boolean }) => joinLeague({ data }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["leagues"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Leagues</p>
          <h1 className="mt-2 font-display text-4xl">Rosters that stick</h1>
        </div>
        <CreateLeague />
      </div>
      <div className="mt-6">
        <PayoutSetupCard />
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {leagues.isSuccess && (leagues.data ?? []).length === 0 ? (
          <Card>
            <p className="font-display text-xl">No leagues yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Empty stays empty until someone opens a real roster. Start one if you will run it.
            </p>
          </Card>
        ) : null}
        {(leagues.data ?? []).map((l) => (
          <Card key={l.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/app/leagues/$id" params={{ id: String(l.id) }} className="font-display text-xl">
                  {l.name}
                </Link>
                <Badge variant={l.sport === "pickleball" ? "pickleball" : "tennis"}>
                  {sportLabel(l.sport)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLabel(l.format)}
                {l.skill_band ? ` · ${l.skill_band}` : ""}
                {l.season_label ? ` · ${l.season_label}` : ""}
                {` · ${l.member_count} on roster`}
                {l.reg_fee_cents > 0
                  ? ` · ${money(l.reg_fee_cents)} to join · Rally ${money(feeSplit(l.reg_fee_cents, payments.data?.enabled ? payments.data.leaguePct : RALLY.leaguePct).take)}`
                  : ""}
              </p>
              {l.notes ? <p className="mt-2 text-sm leading-relaxed">{l.notes}</p> : null}
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/leagues/$id" params={{ id: String(l.id) }}>
                    Board
                  </Link>
                </Button>
                {l.joined || l.reg_fee_cents === 0 || !payments.data?.enabled ? (
                  <Button
                    size="sm"
                    variant={l.joined ? "secondary" : "default"}
                    disabled={join.isPending}
                    onClick={() => join.mutate({ id: l.id, join: !l.joined })}
                  >
                    {l.joined ? "Leave" : l.reg_fee_cents > 0 ? `Join · ${money(l.reg_fee_cents)}` : "Join"}
                  </Button>
                ) : (
                  <RallyCheckout
                    source="league"
                    relatedId={l.id}
                    onRejoin={() => join.mutate({ id: l.id, join: true })}
                  />
                )}
              </div>
              {l.reg_fee_cents > 0 && payments.data && !payments.data.enabled ? (
                <p className="text-xs text-muted-foreground">Payments coming soon</p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CreateLeague() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: (data: Parameters<typeof createLeague>[0]["data"]) => createLeague({ data }),
    onSuccess: () => {
      toast.success("League opened.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["leagues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Start one</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Start a league</DialogTitle>
        <DialogDescription>You are on the roster. Invite the rest from Rec.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({
              name: String(f.get("name")),
              sport: String(f.get("sport")) as "pickleball" | "tennis",
              format: String(f.get("format")) as "round_robin" | "ladder",
              skill_band: String(f.get("skill_band") || "") || undefined,
              season_label: String(f.get("season_label") || "") || undefined,
              notes: String(f.get("notes") || "") || undefined,
              reg_fee: f.get("reg_fee") ? Number(f.get("reg_fee")) : 0,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="Tuesday 3.5 ladder" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Sport</Label>
              <Select name="sport" defaultValue="pickleball">
                <option value="pickleball">Pickleball</option>
                <option value="tennis">Tennis</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Format</Label>
              <Select name="format" defaultValue="round_robin">
                {LEAGUE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Skill band</Label>
              <Input name="skill_band" placeholder="3.0–3.5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Season</Label>
              <Input name="season_label" placeholder="Fall" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Registration fee $ (optional)</Label>
            <Input name="reg_fee" type="number" min={0} defaultValue={0} />
            <p className="text-xs text-muted-foreground">
              When players pay in Rally, the platform fee comes out of the organizer&apos;s side. $0
              means Rally takes nothing.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          <Button type="submit" disabled={create.isPending}>
            Open league
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
