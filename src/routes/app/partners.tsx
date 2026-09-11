import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { PlayerSportCards } from "@/components/player-proof";
import { formatWall, nearLevel, sportLabel } from "@/lib/rally";
import {
  listPartners,
  listPlayRequests,
  sendPlayRequest,
  setPlayRequestStatus,
} from "@/lib/rally-server";

export const Route = createFileRoute("/app/partners")({ component: Partners });

function Partners() {
  const { profile, courts } = useRally();
  const qc = useQueryClient();
  const [near, setNear] = useState(false);
  const people = useQuery({ queryKey: ["partners"], queryFn: () => listPartners() });
  const requests = useQuery({ queryKey: ["play-requests"], queryFn: () => listPlayRequests() });
  const decide = useMutation({
    mutationFn: (data: { id: number; status: "accepted" | "declined" }) =>
      setPlayRequestStatus({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["play-requests"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const incoming = (requests.data ?? []).filter(
    (r) => r.to_user_id === profile.user_id && r.status === "pending",
  );
  const outgoing = (requests.data ?? []).filter(
    (r) => r.from_user_id === profile.user_id && r.status === "pending",
  );
  const shown = (people.data ?? []).filter((p) => {
    if (!near) return true;
    const pb =
      profile.plays_pickleball &&
      p.plays_pickleball &&
      (nearLevel(profile.pickleball_level, p.pickleball_level) ||
        nearLevel(profile.dupr, p.dupr));
    const tn =
      profile.plays_tennis &&
      p.plays_tennis &&
      (nearLevel(profile.tennis_level, p.tennis_level) || nearLevel(profile.utr, p.utr));
    return pb || tn;
  });

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Partners</p>
      <h1 className="mt-2 font-display text-4xl">Who wants a hit</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Ratings, years, how often. Tennis and pickleball live on separate cards so a 30-year
        tennis player is not a 30-year pickleball player.
      </p>

      {incoming.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Incoming</p>
          {incoming.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm">
                  {r.from_name} · {sportLabel(r.sport)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.proposed_at ? formatWall(r.proposed_at) : "Time open"}
                  {r.court_name ? ` · ${r.court_name}` : ""}
                </p>
                {r.message ? <p className="mt-1 text-sm">{r.message}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide.mutate({ id: r.id, status: "accepted" })}>
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide.mutate({ id: r.id, status: "declined" })}
                >
                  No
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Sent</p>
          {outgoing.map((r) => (
            <Card key={r.id}>
              <p className="text-sm">
                {r.to_name} · {sportLabel(r.sport)}
              </p>
              <p className="text-xs text-muted-foreground">
                Waiting · {r.proposed_at ? formatWall(r.proposed_at) : "Time open"}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button size="sm" variant={!near ? "default" : "outline"} onClick={() => setNear(false)}>
          Everyone
        </Button>
        <Button size="sm" variant={near ? "default" : "outline"} onClick={() => setNear(true)}>
          Near my level
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {shown.map((p) => (
          <Card key={p.user_id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl">{p.display_name}</h2>
                {p.plays_pickleball ? (
                  <Badge variant="pickleball">PB {p.dupr ?? p.pickleball_level}</Badge>
                ) : null}
                {p.plays_tennis ? (
                  <Badge variant="tennis">T {p.utr ?? p.tennis_level}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.city}
                {p.availability ? ` · ${p.availability}` : ""}
              </p>
              <div className="mt-3">
                <PlayerSportCards player={p} compact />
              </div>
              {p.credit_coach_name ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Credits {p.credit_coach_name}
                  {p.coach_note ? ` — “${p.coach_note}”` : ""}
                </p>
              ) : null}
            </div>
            <AskDialog to={p.user_id} name={p.display_name} courts={courts} />
          </Card>
        ))}
        {people.isSuccess && shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {near
              ? "Nobody near your skill yet. Try everyone, or ask someone at Rec to put tennis and pickleball on their card."
              : "You are first on the board. Ask someone at Rec to join Rally."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AskDialog({
  to,
  name,
  courts,
}: {
  to: string;
  name: string;
  courts: Court[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const send = useMutation({
    mutationFn: (data: Parameters<typeof sendPlayRequest>[0]["data"]) => sendPlayRequest({ data }),
    onSuccess: () => {
      toast.success("Request sent.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["play-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Ask</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Hit with {name}</DialogTitle>
        <DialogDescription>Propose a time. They confirm.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            send.mutate({
              to_user_id: to,
              sport: String(f.get("sport")) as "pickleball" | "tennis",
              proposed_at: String(f.get("proposed_at") || "") || undefined,
              court_id: f.get("court_id") ? Number(f.get("court_id")) : undefined,
              message: String(f.get("message") || "") || undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Sport</Label>
            <Select name="sport" defaultValue="pickleball">
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>When</Label>
            <Input name="proposed_at" type="datetime-local" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Court</Label>
            <Select name="court_id">
              <option value="">TBD</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Note</Label>
            <Textarea name="message" placeholder="Doubles, 3.5, looking for 90 minutes." />
          </div>
          <Button type="submit" disabled={send.isPending}>
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
