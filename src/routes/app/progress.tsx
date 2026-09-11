import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { STALL_AREAS, stallAdvice, type Advice } from "@/lib/rally";
import { saveStall } from "@/lib/rally-server";

export const Route = createFileRoute("/app/progress")({ component: Progress });

function Progress() {
  const [sport, setSport] = useState<"pickleball" | "tennis">("pickleball");
  const [stuck, setStuck] = useState("basics");
  const [weeks, setWeeks] = useState("4");
  const [advice, setAdvice] = useState<Advice[] | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveStall({
        data: { sport, stuck_on: stuck, weeks: Number(weeks) || undefined },
      }),
    onSuccess: () => {
      setAdvice(stallAdvice(stuck, sport));
      toast.success("Logged. Here is what Rally would do.");
    },
  });

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Progress</p>
      <h1 className="mt-2 font-display text-4xl">I have stalled</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        New to the game, or you already know everything your current coach has to
        teach. Tell Rally where it broke. We will not sell you a miracle — a
        mindset drill, a structured hour, or a different coach.
      </p>

      <Card className="mt-8">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Sport</Label>
            <Select value={sport} onChange={(e) => setSport(e.target.value as "pickleball" | "tennis")}>
              <option value="pickleball">Pickleball</option>
              <option value="tennis">Tennis</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>What is stuck</Label>
            <Select value={stuck} onChange={(e) => setStuck(e.target.value)}>
              {STALL_AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {STALL_AREAS.find((a) => a.value === stuck)?.hint}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>How many weeks like this</Label>
            <Select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="8">8</option>
              <option value="12">12+</option>
            </Select>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Thinking…" : "What should I do"}
          </Button>
        </form>
      </Card>

      {advice ? (
        <div className="mt-6 flex flex-col gap-3">
          {advice.map((a) => (
            <Card key={a.title}>
              <h2 className="font-display text-xl">{a.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              <Button asChild className="mt-4" variant="secondary">
                {a.href === "/app/coaches" ? (
                  <Link
                    to="/app/coaches"
                    search={{
                      fit: stuck === "basics" ? "beginner" : stuck === "same_coach" ? "stalled" : "all",
                    }}
                  >
                    {a.cta}
                  </Link>
                ) : (
                  <Link to={a.href}>{a.cta}</Link>
                )}
              </Button>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
