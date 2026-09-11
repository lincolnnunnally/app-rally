import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { PlayerSportCards } from "@/components/player-proof";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rememberRef } from "@/lib/rally";
import { lookupShare } from "@/lib/rally-server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  loaderDeps: ({ search }) => ({ ref: search.ref }),
  loader: async ({ deps }) => {
    if (!deps.ref) return { who: null };
    const who = await lookupShare({ data: { code: deps.ref } });
    return { who };
  },
  head: ({ match }) => {
    const ref = match.search.ref;
    return {
      meta: [
        { title: "Join Rally — tennis and pickleball" },
        {
          name: "description",
          content:
            "Join Rally to reserve listed courts, get matched with people at your skill level, book a coach, and join a league. Find your court.",
        },
        ...(ref ? [{ name: "robots", content: "noindex, follow" }] : []),
      ],
    };
  },
  component: Join,
});

function Join() {
  const { ref } = Route.useSearch();
  const { who } = Route.useLoaderData();
  const { user } = useCurrentUserState();

  useEffect(() => {
    if (ref) rememberRef(ref);
  }, [ref]);

  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Join</p>
        <h1 className="mt-2 font-display text-4xl">
          {who?.display_name ? `${who.display_name} sent you Rally` : "Join Rally"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Rally runs tennis and pickleball: find a court, reserve a window, get matched with people
          at your skill level, book a coach, join a league. Recs, clubs, and schools are listed on
          Rally. Find your court.
        </p>
        {who ? (
          <Card className="mt-6">
            <p className="font-display text-2xl">{who.display_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{who.city}</p>
            <div className="mt-4">
              <PlayerSportCards player={who} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              When you join from this link, they get a share credit if a fee later moves — Rec at $0
              still stays $0.
            </p>
          </Card>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-2">
          {user ? (
            <Button asChild>
              <Link to="/app">Open Rally</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/login" search={{ ref, mode: "up" }}>
                Create an account
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
