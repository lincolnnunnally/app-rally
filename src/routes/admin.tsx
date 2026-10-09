import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PublicChrome } from "@/components/public-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  createCoachCoupon,
  disableCoachCoupon,
  getOwnerAdmin,
  grantCoachAccess,
  revokeCoachAccess,
} from "@/lib/coach-access-server";
import type { CoachAccess } from "@/lib/coach-access";
import { sportLabel } from "@/lib/rally";

export const Route = createFileRoute("/admin")({
  component: OwnerAdmin,
});

const ACCESS_LABEL: Record<CoachAccess, string> = {
  paid: "Paid",
  granted: "Granted",
  coupon: "Coupon",
  none: "None",
};

function OwnerAdmin() {
  const { user, isPending } = useCurrentUserState();
  const admin = useQuery({
    queryKey: ["owner-admin"],
    queryFn: () => getOwnerAdmin(),
    enabled: !!user,
  });

  if (isPending) return <AdminFrame />;
  if (!user) return <RedirectToSignIn />;
  if (admin.isPending) return <AdminFrame />;
  if (admin.isError) {
    const message = admin.error instanceof Error ? admin.error.message : "";
    return (
      <AdminFrame>
        <h1 className="mt-2 font-display text-4xl">Owner</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {message === "Forbidden" || message === "Unauthorized"
            ? "This area is for the Rally owner."
            : message || "Could not load the owner area."}
        </p>
      </AdminFrame>
    );
  }

  const data = admin.data;
  return (
    <AdminFrame>
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Owner</p>
      <h1 className="mt-2 font-display text-4xl">Coaches, players, teams</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Grant free coach access, or hand out a code. Nothing on this page charges a card.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Count label="Coaches" value={data.counts.coaches} />
        <Count label="Players" value={data.counts.players} />
        <Count label="Teams" value={data.counts.teams} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Count label="Lessons completed" value={data.counts.lessonsCompleted} />
        <Count label="Players reached" value={data.counts.playersReached} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Coaches</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.counts.coaches} on the board. Lessons and distinct players are the impact.
        </p>
        {data.coaches.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No coaches yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {data.coaches.map((coach) => (
              <li key={coach.userId}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{coach.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {coach.city} · {coach.lessons} lessons · {coach.players} players
                      </p>
                    </div>
                    <Badge variant={coach.access === "none" ? "outline" : "good"}>
                      {ACCESS_LABEL[coach.access]}
                    </Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GrantPanel coaches={data.coaches} grants={data.grants} />
      <CouponPanel coupons={data.coupons} />

      <section className="mt-10">
        <h2 className="font-display text-2xl">Players</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.counts.players} profiles that are not coaches, including students waiting on a
          parent.
        </p>
        {data.players.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No players yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {data.players.map((player) => (
              <li key={player.userId}>
                <Card>
                  <p className="font-medium">{player.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {player.city} · {player.lessons} lessons
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Teams</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.counts.teams} league rosters. Members and matches are the impact.
        </p>
        {data.teams.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {data.teams.map((team) => (
              <li key={team.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {sportLabel(team.sport)} · {team.members} members · {team.matches} matches
                      </p>
                    </div>
                    <Badge variant="outline">{team.status}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminFrame>
  );
}

function AdminFrame({ children }: { children?: ReactNode }) {
  return (
    <PublicChrome>
      <main className="mx-auto max-w-3xl px-5 pb-16">{children}</main>
    </PublicChrome>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </Card>
  );
}

function GrantPanel({
  coaches,
  grants,
}: {
  coaches: { userId: string; name: string }[];
  grants: {
    id: number;
    coachUserId: string;
    coachName: string | null;
    reason: string;
    expiresAt: string | null;
    active: boolean;
    revokedAt: string | null;
  }[];
}) {
  const qc = useQueryClient();
  const [coachId, setCoachId] = useState(coaches[0]?.userId ?? "");
  const [testerId, setTesterId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["owner-admin"] });
  const grant = useMutation({
    mutationFn: () =>
      grantCoachAccess({
        data: {
          coach_user_id: testerId.trim() || coachId,
          reason,
          expires_on: expiresOn || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Free access granted.");
      setReason("");
      setExpiresOn("");
      setTesterId("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => revokeCoachAccess({ data: { id } }),
    onSuccess: () => {
      toast.success("Grant revoked.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Free access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A reason is required. Leave the date blank to keep the grant open.
      </p>
      <Card className="mt-4">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            grant.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="grant-coach">Coach</Label>
            <Select
              id="grant-coach"
              value={coachId}
              onChange={(event) => setCoachId(event.target.value)}
            >
              {coaches.length === 0 ? <option value="">No coaches listed</option> : null}
              {coaches.map((coach) => (
                <option key={coach.userId} value={coach.userId}>
                  {coach.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grant-tester">Tester user id</Label>
            <Input
              id="grant-tester"
              value={testerId}
              onChange={(event) => setTesterId(event.target.value)}
              placeholder="Optional, if they are not on the coach list"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grant-reason">Reason</Label>
            <Input
              id="grant-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grant-expires">Expires</Label>
            <Input
              id="grant-expires"
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={grant.isPending || (!coachId && !testerId.trim())}>
            {grant.isPending ? "Granting…" : "Grant free access"}
          </Button>
        </form>
      </Card>
      {grants.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No grants yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {grants.map((row) => (
            <li key={row.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.coachName ?? row.coachUserId}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.expiresAt ? `Until ${row.expiresAt}` : "No expiry"}
                      {row.revokedAt ? " · Revoked" : row.active ? " · Active" : " · Expired"}
                    </p>
                  </div>
                  {row.revokedAt ? null : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(row.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CouponPanel({
  coupons,
}: {
  coupons: {
    id: number;
    code: string;
    note: string | null;
    disabledAt: string | null;
    redemptions: number;
  }[];
}) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["owner-admin"] });
  const create = useMutation({
    mutationFn: () => createCoachCoupon({ data: { code, note: note || undefined } }),
    onSuccess: () => {
      toast.success("Code created.");
      setCode("");
      setNote("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const disable = useMutation({
    mutationFn: (id: number) => disableCoachCoupon({ data: { id } }),
    onSuccess: () => {
      toast.success("Code disabled.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Codes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A coach can redeem one code. Disabling a code stops the free access it granted.
      </p>
      <Card className="mt-4">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="coupon-code">Code</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              autoComplete="off"
              maxLength={32}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="coupon-note">Note</Label>
            <Input
              id="coupon-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create code"}
          </Button>
        </form>
      </Card>
      {coupons.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No codes yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {coupons.map((row) => (
            <li key={row.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium tracking-wide">{row.code}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.note || "No note"} · {row.redemptions} redeemed
                      {row.disabledAt ? " · Disabled" : " · Active"}
                    </p>
                  </div>
                  {row.disabledAt ? null : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={disable.isPending}
                      onClick={() => disable.mutate(row.id)}
                    >
                      Disable
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
