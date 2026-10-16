import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPublicCoach } from "@/lib/coach-public-server";
import { coachProfilePath, coachRequestAppPath } from "@/lib/coach-links";
import { rememberAppNext, rememberCoach } from "@/lib/rally";

/**
 * Booking link a coach can text: /book/<code>.
 * Signed in -> the coach's request dialog on /app/coaches.
 * Signed out -> create an account (credited to this coach), then the same dialog.
 */
export const Route = createFileRoute("/book/$code")({
  loader: async ({ params }) => getPublicCoach({ data: { code: params.code } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Book a lesson with ${loaderData.display_name} | Rally`
          : "Book a lesson | Rally",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const coach = Route.useLoaderData();
  const { code } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const next = coachRequestAppPath(coach?.code ?? code);

  useEffect(() => {
    if (!coach || isPending) return;
    if (user) {
      window.location.replace(next);
      return;
    }
    rememberCoach(coach.code);
    rememberAppNext(next);
  }, [coach, user, isPending, next]);

  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Book a lesson</p>
        {!coach ? (
          <>
            <h1 className="mt-2 font-display text-4xl">This booking link is not active</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The coach has not turned on their page yet, or the link is mistyped. Ask your coach
              for a fresh link, or find a coach below.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/coaches">Find a coach</Link>
              </Button>
              <Link to="/app/desk" className="text-sm text-muted-foreground underline">
                Is this your link? Turn on your page
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-4xl">Request a time with {coach.display_name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Pick a time on {coach.display_name}&apos;s calendar. {coach.display_name} confirms it,
              and you get a notice either way. You can book for yourself or your kid.
            </p>
            <Card className="mt-6">
              {isPending || user ? (
                <p className="text-sm text-muted-foreground">Opening the request form…</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">
                    Create a free player account (or sign in) to send the request.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link
                        to="/login"
                        search={{ mode: "up", ref: coach.code, coach: coach.code, next }}
                      >
                        Create account and request
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link
                        to="/login"
                        search={{ mode: "in", ref: undefined, coach: coach.code, next }}
                      >
                        I have an account
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            <p className="mt-4 text-sm">
              <a className="underline" href={coachProfilePath(coach.code)}>
                See {coach.display_name}&apos;s profile
              </a>
            </p>
          </>
        )}
      </main>
    </PublicChrome>
  );
}
