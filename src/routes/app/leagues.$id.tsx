import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useRally } from "@/lib/rally-context";
import type { Court } from "@/lib/rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PlayerProofBlock } from "@/components/player-proof";
import { formatLabel, formatWall, money, sportLabel } from "@/lib/rally";
import { getLeague, joinLeague, scheduleMatch, updateMatch } from "@/lib/rally-server";

export const Route = createFileRoute("/app/leagues/$id")({ component: LeagueDetail });

function LeagueDetail() {
  const { id } = Route.useParams();
  const { courts } = useRally();
  const qc = useQueryClient();
  const leagueId = Number(id);
  const detail = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeague({ data: { id: leagueId } }),
  });
  const join = useMutation({
    mutationFn: (joinIn: boolean) => joinLeague({ data: { id: leagueId, join: joinIn } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["league", leagueId] }),
  });
  const score = useMutation({
    mutationFn: (data: { id: number; score?: string; status?: "confirmed" | "cancelled" }) =>
      updateMatch({ data }),
    onSuccess: () => {
      toast.success("Updated.");
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!detail.data) {
    return <div className="px-5 py-8 text-sm text-muted-foreground">Loading league…</div>;
  }

  const { league, members, matches, userId } = detail.data;

  return (
    <div className="px-5 py-8">
      <Link to="/app/leagues" className="text-xs text-muted-foreground hover:text-foreground">
        All leagues
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">{league.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sportLabel(league.sport)} · {formatLabel(league.format)}
            {league.skill_band ? ` · ${league.skill_band}` : ""}
            {league.reg_fee_cents > 0 ? ` · ${money(league.reg_fee_cents)} to join` : ""}
          </p>
        </div>
        <Button
          variant={league.joined ? "secondary" : "default"}
          onClick={() => join.mutate(!league.joined)}
        >
          {league.joined ? "Leave" : league.reg_fee_cents > 0 ? `Join · ${money(league.reg_fee_cents)}` : "Join"}
        </Button>
      </div>
      {league.notes ? <p className="mt-4 max-w-xl text-sm leading-relaxed">{league.notes}</p> : null}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Roster</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.user_id} className="rounded-md border border-border px-3 py-2">
              <PlayerProofBlock player={m} />
              {m.user_id === userId ? <p className="mt-1 text-xs text-muted-foreground">you</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {league.joined ? <ScheduleForm leagueId={leagueId} members={members} courts={courts} /> : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl">Schedule</h2>
        <div className="mt-3 flex flex-col gap-3">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches posted yet.</p>
          ) : (
            matches.map((m) => {
              const inMatch = [...m.side_a_ids, ...m.side_b_ids].includes(userId);
              return (
                <Card key={m.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{m.status}</Badge>
                    <span className="text-sm text-muted-foreground">{formatLabel(m.format)}</span>
                  </div>
                  <p className="mt-2 font-medium">
                    {m.side_a.join(" / ") || "TBD"}
                    <span className="text-muted-foreground"> vs </span>
                    {m.side_b.join(" / ") || "TBD"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWall(m.scheduled_at)} · {m.court_name ?? "Court TBD"}
                  </p>
                  {m.score ? <p className="mt-2 text-sm tabular-nums">{m.score}</p> : null}
                  {inMatch && m.status !== "played" && m.status !== "cancelled" ? (
                    <form
                      className="mt-3 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const s = String(f.get("score") || "");
                        if (s) score.mutate({ id: m.id, score: s });
                      }}
                    >
                      <Input name="score" placeholder="11-7, 11-9" className="max-w-40" />
                      <Button size="sm" type="submit">
                        Post score
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => score.mutate({ id: m.id, status: "confirmed" })}
                      >
                        Confirm
                      </Button>
                    </form>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ScheduleForm({
  leagueId,
  members,
  courts,
}: {
  leagueId: number;
  members: { user_id: string; display_name: string }[];
  courts: Court[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const schedule = useMutation({
    mutationFn: (data: Parameters<typeof scheduleMatch>[0]["data"]) => scheduleMatch({ data }),
    onSuccess: () => {
      toast.success("Match posted.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button className="mt-8" variant="secondary" onClick={() => setOpen(true)}>
        Schedule a match
      </Button>
    );
  }

  return (
    <Card className="mt-8">
      <h3 className="font-display text-lg">Schedule a match</h3>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const format = String(f.get("format")) as "singles" | "doubles";
          const a1 = String(f.get("a1"));
          const a2 = String(f.get("a2") || "");
          const b1 = String(f.get("b1"));
          const b2 = String(f.get("b2") || "");
          const side_a = format === "doubles" ? [a1, a2].filter(Boolean) : [a1];
          const side_b = format === "doubles" ? [b1, b2].filter(Boolean) : [b1];
          schedule.mutate({
            league_id: leagueId,
            format,
            scheduled_at: String(f.get("scheduled_at") || "") || undefined,
            court_id: f.get("court_id") ? Number(f.get("court_id")) : undefined,
            side_a,
            side_b,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label>Format</Label>
          <Select name="format" defaultValue="doubles">
            <option value="doubles">Doubles</option>
            <option value="singles">Singles</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <PlayerSelect name="a1" label="Side A" members={members} />
          <PlayerSelect name="a2" label="A partner" members={members} optional />
          <PlayerSelect name="b1" label="Side B" members={members} />
          <PlayerSelect name="b2" label="B partner" members={members} optional />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>When</Label>
          <Input name="scheduled_at" type="datetime-local" />
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
        <div className="flex gap-2">
          <Button type="submit" disabled={schedule.isPending}>
            Post match
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PlayerSelect({
  name,
  label,
  members,
  optional,
}: {
  name: string;
  label: string;
  members: { user_id: string; display_name: string }[];
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select name={name} required={!optional}>
        {optional ? <option value="">—</option> : null}
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name}
          </option>
        ))}
      </Select>
    </div>
  );
}
