import { Navigate, createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RallyMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/auth/auth-error";
import { GROK_PROVIDERS, authClient, authEnabled, signIn, socialAuthEnabled } from "@/lib/auth/client";
import { rallyResetRedirect } from "@/lib/auth/reset-redirect";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { consumeAppNext, rememberCoach, rememberRef } from "@/lib/rally";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    coach: typeof s.coach === "string" ? s.coach : undefined,
    mode: s.mode === "up" || s.mode === "in" ? s.mode : undefined,
  }),
  component: Login,
});

function Login() {
  const { user } = useCurrentUserState();
  const { ref, coach, mode: modeSearch } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">(modeSearch === "in" ? "in" : "up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);

  useEffect(() => {
    if (ref) rememberRef(ref);
    if (coach) rememberCoach(coach);
  }, [ref, coach]);

  if (user) return <Navigate to="/app" />;

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const dest = consumeAppNext() ?? "/app";
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
          callbackURL: dest,
        });
        if (res.error) {
          throw new Error(authErrorMessage(res.error, "Could not create account"));
        }
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
          callbackURL: dest,
        });
        if (res.error) {
          throw new Error(authErrorMessage(res.error, "Could not sign in"));
        }
      }
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter the email you used to create this Rally account.");
      return;
    }
    setBusy(true);
    setError(null);
    setResetNote(null);
    try {
      const client = authClient as typeof authClient & {
        requestPasswordReset?: (args: {
          email: string;
          redirectTo: string;
        }) => Promise<{ error?: { message?: string } | null }>;
        forgetPassword?: (args: {
          email: string;
          redirectTo: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
      const requestReset = client.requestPasswordReset ?? client.forgetPassword;
      if (!requestReset) {
        setError("Password reset is not available in this build. Write lincoln@unitedundergod.org.");
        return;
      }
      const res = await requestReset({
        email: trimmed,
        redirectTo: rallyResetRedirect(window.location.origin),
      });
      if (res.error) {
        setError(
          res.error.message ??
            "Could not start a password reset. Write lincoln@unitedundergod.org.",
        );
        return;
      }
      setResetNote(
        "If an account exists for that email, we queued a reset. Check inbox and spam. Rally uses its own login — this does not reset Neighborly or other United Under God apps. If nothing arrives, write lincoln@unitedundergod.org.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start a password reset. Write lincoln@unitedundergod.org.",
      );
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
        <h1 className="font-display text-3xl">
          {mode === "in" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Same account for players and coaches. Tennis and pickleball, each on their own card.
        </p>

        {authEnabled && socialAuthEnabled ? (
          <div className="mt-8 flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                onClick={() => signIn(p.providerId, { callbackURL: consumeAppNext() ?? "/app" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : null}

        {authEnabled && socialAuthEnabled ? (
          <div className="my-6 flex items-center gap-3 text-xs tracking-widest text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>
        ) : (
          <div className="mt-8" />
        )}

        {forgot ? (
          <form onSubmit={onForgot} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {resetNote ? <p className="text-sm text-muted-foreground">{resetNote}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : "Send reset link"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setForgot(false);
                setError(null);
                setResetNote(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={onEmail} className="flex flex-col gap-3">
            {mode === "up" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                {mode === "in" ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setForgot(true);
                      setError(null);
                      setResetNote(null);
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "in" ? "Sign in with email" : "Create account"}
            </Button>
          </form>
        )}

        {!forgot ? (
          <button
            type="button"
            className="mt-6 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        ) : null}

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          {" · "}
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}
