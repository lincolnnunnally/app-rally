import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { grantFreeAccess, listCompedCoaches, revokeFreeAccess } from "@/lib/admin-server";
import { useRally } from "@/lib/rally-context";

export const Route = createFileRoute("/app/admin")({
  component: AdminGate,
});

/** Owner-only. Everyone else sees a plain not-found; the server checks again on every call. */
function AdminGate() {
  const { isOwner } = useRally();
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page does not exist.</p>
      </div>
    );
  }
  return <FreeAccessAdmin />;
}

function FreeAccessAdmin() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const list = useQuery({ queryKey: ["comped"], queryFn: () => listCompedCoaches() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["comped"] });
  const grant = useMutation({
    mutationFn: () => grantFreeAccess({ data: { email, note } }),
    onSuccess: () => {
      toast.success("Free access granted.");
      setEmail("");
      setNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (user_id: string) => revokeFreeAccess({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Free access removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Owner</p>
      <h1 className="mt-1 font-display text-3xl">Free coach access</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Coaches on this list record no Rally fee: no $100 year, no card 5%. Ledger only — no money
        moves.
      </p>
      <Card className="mt-6">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            grant.mutate();
          }}
        >
          <label className="text-sm" htmlFor="comp-email">Rally account email</label>
          <Input
            id="comp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@example.com"
          />
          <label className="text-sm" htmlFor="comp-note">Note (optional)</label>
          <Input id="comp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why" />
          <Button type="submit" disabled={grant.isPending || !email.trim()}>
            {grant.isPending ? "Granting…" : "Grant free access"}
          </Button>
        </form>
      </Card>
      <section className="mt-8">
        <h2 className="font-display text-xl">On the list</h2>
        {list.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : list.isError ? (
          <p className="mt-2 text-sm text-muted-foreground">Could not load the list.</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nobody yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {(list.data ?? []).map((c) => (
              <li
                key={c.user_id}
                className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 break-words">
                  <span className="font-medium">{c.display_name || c.email || c.user_id}</span>
                  {c.email && c.display_name ? <span className="text-muted-foreground"> · {c.email}</span> : null}
                  {c.note ? <span className="block text-muted-foreground">{c.note}</span> : null}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove free access for ${c.email ?? c.user_id}?`)) revoke.mutate(c.user_id);
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
