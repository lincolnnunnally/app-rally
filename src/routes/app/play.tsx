import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
import { LEVELS, SESSION_FORMATS, formatWall, sportLabel } from "@/lib/rally";
import { createSession, listSessions, rsvpSession } from "@/lib/rally-server";

export const Route = createFileRoute("/app/play")({ component: Play });

function Play() {
  const { courts } = useRally();
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listSessions() });
  const [sport, setSport] = useState<"all" | "pickleball" | "tennis">("all");

  const rsvp = useMutation({
    mutationFn: (data: { session_id: number; going: boolean }) => rsvpSession({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sessions"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (sessions.data ?? []).filter((s) => sport === "all" || s.sport === sport);

  return (
    <div className="px-5 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Play</p>
          <h1 className="mt-2 font-display text-4xl">Open play</h1>
        </div>
        <HostDialog courts={courts} />
      </div>
      <div className="mt-6 flex gap-2">
        {(["all", "pickleball", "tennis"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={sport === s ? "default" : "outline"}
            onClick={() => setSport(s)}
          >
            {s === "all" ? "All" : sportLabel(s)}
          </Button>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {filtered.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl">{s.title}</h2>
                <Badge variant={s.sport === "pickleball" ? "pickleball" : "tennis"}>
                  {sportLabel(s.sport)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatWall(s.starts_at)} · {s.duration_min} min
              </p>
              <p className="text-sm text-muted-foreground">
                {s.court_name} · {s.host_name}
                {s.skill_min ? ` · ${s.skill_min}–${s.skill_max}` : ""}
              </p>
              {s.notes ? <p className="mt-2 text-sm">{s.notes}</p> : null}
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {s.going} / {s.spots} in
              </p>
            </div>
            <Button
              variant={s.mine ? "secondary" : "default"}
              disabled={rsvp.isPending || (!s.mine && s.going >= s.spots)}
              onClick={() => rsvp.mutate({ session_id: s.id, going: !s.mine })}
            >
              {s.mine ? "Leave" : s.going >= s.spots ? "Full" : "I'm in"}
            </Button>
          </Card>
        ))}
        {sessions.isSuccess && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing posted in that filter. Host one.</p>
        ) : null}
      </div>
    </div>
  );
}

function HostDialog({ courts }: { courts: Court[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: (data: Parameters<typeof createSession>[0]["data"]) => createSession({ data }),
    onSuccess: () => {
      toast.success("Posted.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["sessions"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Host</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Host a session</DialogTitle>
        <DialogDescription>Open play, clinic, or a social mix. Times are Eastern.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({
              title: String(f.get("title")),
              sport: String(f.get("sport")) as "pickleball" | "tennis",
              format: String(f.get("format")),
              starts_at: String(f.get("starts_at")),
              duration_min: Number(f.get("duration_min")),
              court_id: Number(f.get("court_id")),
              skill_min: String(f.get("skill_min") || "") || undefined,
              skill_max: String(f.get("skill_max") || "") || undefined,
              spots: Number(f.get("spots")),
              notes: String(f.get("notes") || "") || undefined,
            });
          }}
        >
          <Field label="Title">
            <Input name="title" required placeholder="Friday night round robin" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport">
              <Select name="sport" defaultValue="pickleball">
                <option value="pickleball">Pickleball</option>
                <option value="tennis">Tennis</option>
              </Select>
            </Field>
            <Field label="Format">
              <Select name="format" defaultValue="open_play">
                {SESSION_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Starts">
            <Input name="starts_at" type="datetime-local" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutes">
              <Input name="duration_min" type="number" defaultValue={120} min={30} max={240} />
            </Field>
            <Field label="Spots">
              <Input name="spots" type="number" defaultValue={16} min={2} max={32} />
            </Field>
          </div>
          <Field label="Court">
            <Select name="court_id" defaultValue={String(courts[0]?.id ?? "")}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Skill min">
              <Select name="skill_min" defaultValue="2.5">
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Skill max">
              <Select name="skill_max" defaultValue="4.0">
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Balls provided. Beginners on court 4." />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Posting…" : "Post session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
