import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { PlayerSportCards } from "@/components/player-proof";
import { ProfileFace } from "@/components/profile-face";
import { ProofDisplay } from "@/components/proof-lists";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rememberCoach, rememberRef } from "@/lib/rally";
import { lookupShare } from "@/lib/rally-server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    coach: typeof s.coach === "string" ? s.coach : undefined,
  }),
  loaderDeps: ({ search }) => ({ ref: search.ref, coach: search.coach }),
  loader: async ({ deps }) => {
    if (deps.coach) {
      const who = await lookupShare({ data: { code: deps.coach, as_coach: true } });
      return { who, asCoach: Boolean(who) };
    }
    if (!deps.ref) return { who: null, asCoach: false };
    const who = await lookupShare({ data: { code: deps.ref } });
    return { who, asCoach: Boolean(who?.is_coach) };
  },
  head: ({ match }) => {
    const tagged = Boolean(match.search.ref || match.search.coach);
    return {
      meta: [
        { title: "Join Rally — tennis and pickleball" },
        {
          name: "description",
          content:
            "Join Rally to reserve listed courts, get matched with people at your skill level, book a coach, and join a league.",
        },
        ...(tagged ? [{ name: "robots", content: "noindex, follow" }] : []),
      ],
    };
  },
  component: Join,
});

function Join() {
  const { ref, coach } = Route.useSearch();
  const { who, asCoach } = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const invite = coach || ref;

  useEffect(() => {
    if (ref) rememberRef(ref);
    if (coach) rememberCoach(coach);
    else if (asCoach && ref) rememberCoach(ref);
  }, [ref, coach, asCoach]);

  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Join</p>
        <h1 className="mt-2 font-display text-4xl">
          {asCoach && who
            ? `${who.display_name} invited you`
            : who?.display_name
              ? `${who.display_name} sent you Rally`
              : "Join Rally"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {asCoach && who
            ? `Create your player profile and you land on ${who.display_name}'s coaching list. You can also find people at your skill to hit with at Ed Smith Complex.`
            : "Rally runs tennis and pickleball: find a court, reserve a window, get matched with people at your skill level, book a coach, join a league."}
        </p>
        {who ? (
          <Card className="mt-6">
            <div className="flex items-center gap-3">
              <ProfileFace name={who.display_name} photo={who.photo_data} />
              <p className="font-display text-2xl">{who.display_name}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {who.city}
              {asCoach ? " · coach" : ""}
            </p>
            <div className="mt-4">
              <PlayerSportCards player={who} />
              <ProofDisplay certs={who.certs} honors={who.honors} />
            </div>
            {asCoach ? (
              <p className="mt-4 text-sm text-muted-foreground">
                After you join, request a lesson for you or your kid. Court: Ed Smith Complex
                (Smith Park / Vidalia Rec).
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                When you join from this link, they get a share credit if a fee later moves — Rec at $0
                still stays $0.
              </p>
            )}
          </Card>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-2">
          {user ? (
            <Button asChild>
              <Link to="/app">Open Rally</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/login" search={{ ref: invite, mode: "up", coach: coach || (asCoach ? ref : undefined) }}>
                Create a player profile
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/where">Find your court</Link>
          </Button>
        </div>
      </main>
    </PublicChrome>
  );
}
