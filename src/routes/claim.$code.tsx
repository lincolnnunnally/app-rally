import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { PublicChrome } from "@/components/public-chrome";
import {
  FinishStudentForm,
  RegisterChildForm,
  ScheduleChildForm,
  type HouseholdChild,
} from "@/components/students";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { consumeAppNext, rememberAppNext } from "@/lib/rally";
import { claimStudent, listHousehold, lookupClaim } from "@/lib/students-server";

export const Route = createFileRoute("/claim/$code")({
  component: ClaimPage,
});

function ClaimPage() {
  const { code } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const lookup = useQuery({
    queryKey: ["claim", code],
    queryFn: () => lookupClaim({ data: { code } }),
  });
  const household = useQuery({
    queryKey: ["household"],
    queryFn: () => listHousehold(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) rememberAppNext(`/claim/${code}`);
    else consumeAppNext();
  }, [user, code]);

  const [relation, setRelation] = useState<
    "mother" | "father" | "grandmother" | "grandfather" | "guardian" | "self"
  >("guardian");
  const relationPicker = (
    <label className="mb-3 flex flex-col gap-1 text-sm">
      I am their
      <Select value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)}>
        <option value="mother">Mother</option>
        <option value="father">Father</option>
        <option value="grandmother">Grandmother</option>
        <option value="grandfather">Grandfather</option>
        <option value="guardian">Guardian</option>
        <option value="self">This is me (I am the student)</option>
      </Select>
    </label>
  );
  const claim = useMutation({
    mutationFn: () => claimStudent({ data: { code, relation } }),
    onSuccess: (row) => {
      toast.success(
        row.linked
          ? `You are now a ${relation} for ${row.display_name}.`
          : `${row.display_name} is on your account.`,
      );
      void qc.invalidateQueries({ queryKey: ["claim", code] });
      void qc.invalidateQueries({ queryKey: ["household"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const student = lookup.data;
  const mine = (household.data?.children ?? []).find((child) => child.claim_code === code) as
    (HouseholdChild & { claim_code: string | null }) | undefined;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["household"] });
  };

  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Claim a student</p>
        {lookup.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : lookup.isError ? (
          <p className="mt-4 text-sm text-destructive">
            {lookup.error instanceof Error
              ? lookup.error.message
              : "Could not open this claim link."}
          </p>
        ) : !student ? (
          <>
            <h1 className="mt-2 font-display text-4xl">This link is not valid</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ask the coach for a new claim link.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl">{student.display_name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {student.coach_name
                ? `${student.coach_name} added ${student.display_name} on Rally.`
                : `${student.display_name} is on Rally.`}{" "}
              Claim them, finish the profile, and schedule the next lesson. Coach notes stay with
              the coach.
            </p>
            <Card className="mt-6">
              {isPending ? (
                <p className="text-sm text-muted-foreground">Checking your account…</p>
              ) : !user ? (
                <Button asChild>
                  <Link
                    to="/login"
                    search={{
                      mode: "up",
                      ref: undefined,
                      coach: undefined,
                      next: `/claim/${code}`,
                    }}
                    onClick={() => rememberAppNext(`/claim/${code}`)}
                  >
                    Sign in to claim {student.display_name}
                  </Link>
                </Button>
              ) : mine ? (
                <div>
                  <p className="text-sm">{student.display_name} is on your account.</p>
                  <FinishStudentForm key={mine.user_id} child={mine} onSaved={refresh} />
                  <div className="mt-6 border-t border-border pt-4">
                    <h2 className="font-display text-xl">Schedule the next lesson</h2>
                    <ScheduleChildForm
                      children={[mine]}
                      coaches={household.data?.coaches ?? []}
                      courts={household.data?.courts ?? []}
                      defaultChildId={mine.user_id}
                      defaultCoachId={mine.coach_user_ids?.[0]}
                      onSaved={refresh}
                    />
                  </div>
                </div>
              ) : student.claimed ? (
                <div>
                  <p className="mb-3 text-sm">
                    {student.display_name} already has a guardian. Join as another guardian so you can
                    schedule and pay too.
                  </p>
                  {relationPicker}
                  <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
                    {claim.isPending ? "Joining…" : `Join as ${relation}`}
                  </Button>
                </div>
              ) : (
                <div>
                  {relationPicker}
                  <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
                    {claim.isPending ? "Claiming…" : `Claim ${student.display_name}`}
                  </Button>
                </div>
              )}
            </Card>
            {user ? (
              <Card className="mt-6">
                <h2 className="font-display text-xl">Another child</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account can hold more than one child.
                </p>
                <RegisterChildForm onSaved={refresh} />
                <Button className="mt-4" variant="outline" asChild>
                  <Link to="/app" hash="my-kids">Open My kids</Link>
                </Button>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </PublicChrome>
  );
}
