import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SessionJournalPanel } from "@/components/session-journal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MENTAL_RESET, SELF_TALK, VISUALIZATIONS } from "@/lib/rally";
import { addJournal, listJournal } from "@/lib/rally-server";

export const Route = createFileRoute("/app/mental")({
  validateSearch: (s: Record<string, unknown>): { after?: "court" } =>
    s.after === "court" ? { after: "court" } : {},
  component: Mental,
});

function Mental() {
  const { after } = Route.useSearch();
  const qc = useQueryClient();
  const entries = useQuery({ queryKey: ["journal"], queryFn: () => listJournal() });
  const [savedSession, setSavedSession] = useState(false);
  const add = useMutation({
    mutationFn: (data: Parameters<typeof addJournal>[0]["data"]) => addJournal({ data }),
    onSuccess: (_result, vars) => {
      if (vars.kind === "journal") setSavedSession(true);
      else toast.success("Logged.");
      void qc.invalidateQueries({ queryKey: ["journal"] });
    },
    onError: (_err, vars) => {
      if (vars.kind === "journal") {
        toast("Could not save that yet. Your words are still here.");
      }
    },
  });
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState(after === "court" ? "journal" : "reset");
  const [swap, setSwap] = useState("");

  useEffect(() => {
    if (after === "court") setTab("journal");
  }, [after]);

  function openAfterCourt() {
    setTab("journal");
    setSavedSession(false);
    requestAnimationFrame(() => {
      document
        .getElementById("after-court")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Mental</p>
      <h1 className="mt-2 font-display text-4xl">Between the points</h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        The Rec crowd is loud. This is the quiet work — the same four steps, every time, until they
        are automatic.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openAfterCourt}>
          After court
        </Button>
        <p className="text-sm text-muted-foreground">
          After play or a lesson. Start with what went well.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="reset">Reset</TabsTrigger>
          <TabsTrigger value="talk">Self-talk</TabsTrigger>
          <TabsTrigger value="see">See it</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="reset" className="mt-6">
          <Card>
            <p className="text-xs tabular-nums text-muted-foreground">
              {step + 1} / {MENTAL_RESET.length}
            </p>
            <h2 className="mt-2 font-display text-3xl">{MENTAL_RESET[step]?.step}</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {MENTAL_RESET[step]?.body}
            </p>
            <div className="mt-6 flex gap-2">
              {step < MENTAL_RESET.length - 1 ? (
                <Button onClick={() => setStep((s) => Math.min(s + 1, MENTAL_RESET.length - 1))}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    add.mutate({
                      kind: "reset",
                      title: "Between-point reset",
                      body: "Completed the four-step reset.",
                    });
                    setStep(0);
                  }}
                >
                  Log it
                </Button>
              )}
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Start over
                </Button>
              ) : null}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="talk" className="mt-6">
          <div className="flex flex-col gap-3">
            {SELF_TALK.map((s) => (
              <Card key={s.from}>
                <p className="text-sm text-muted-foreground line-through">{s.from}</p>
                <p className="mt-1 font-medium">{s.to}</p>
              </Card>
            ))}
            <Card>
              <p className="text-sm text-muted-foreground">Write your own swap</p>
              <Textarea
                className="mt-2"
                value={swap}
                onChange={(e) => setSwap(e.target.value)}
                placeholder="From: I always dump this. To: This is a ball I know."
              />
              <Button
                className="mt-3"
                disabled={!swap.trim()}
                onClick={() => {
                  add.mutate({ kind: "self_talk", title: "Cue", body: swap });
                  setSwap("");
                }}
              >
                Save cue
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="see" className="mt-6">
          <div className="flex flex-col gap-3">
            {VISUALIZATIONS.map((v) => (
              <Card key={v.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl">{v.title}</h2>
                  <span className="text-xs text-muted-foreground">{v.minutes} min</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    add.mutate({
                      kind: "visualization",
                      title: v.title,
                      body: `Completed: ${v.title}`,
                    })
                  }
                >
                  I did this
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="journal" forceMount className="mt-6 data-[state=inactive]:hidden">
          <SessionJournalPanel
            entries={entries.data ?? []}
            pending={add.isPending}
            saved={savedSession}
            onWriteAnother={() => setSavedSession(false)}
            onSave={(data) => add.mutate({ kind: "journal", ...data })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
