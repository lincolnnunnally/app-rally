import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { RallyMark } from "@/components/brand";
import { authClient, authEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): ResetSearch => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const invalidLink = useMemo(
    () => !token || error === "INVALID_TOKEN",
    [token, error],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setFormError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Those passwords did not match.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const client = authClient as typeof authClient & {
        resetPassword?: (args: {
          newPassword: string;
          token: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
      if (!client.resetPassword) {
        setFormError(
          "Password reset is not available in this build. Write lincoln@unitedundergod.org.",
        );
        return;
      }
      const res = await client.resetPassword({
        newPassword: password,
        token,
      });
      if (res.error) {
        setFormError(res.error.message ?? "Could not reset that password. Request a new link.");
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        window.location.assign("/login?mode=in");
      }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not reset that password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <RallyMark className="size-8" />
          <span className="font-display text-2xl text-foreground">Rally</span>
        </Link>
        <h1 className="font-display text-3xl">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rally keeps its own login. This does not change Neighborly or other United Under God
          apps.
        </p>
        {!authEnabled ? (
          <p className="mt-6 text-sm text-muted-foreground">Sign-in is disabled here.</p>
        ) : invalidLink ? (
          <div className="mt-6">
            <p className="text-sm text-destructive">
              This reset link is missing, expired, or already used.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/login" search={{ ref: undefined, mode: "in" }}>
                Request a new link
              </Link>
            </Button>
          </div>
        ) : done ? (
          <p className="mt-6 text-sm text-muted-foreground">Password updated. Taking you to sign in…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
