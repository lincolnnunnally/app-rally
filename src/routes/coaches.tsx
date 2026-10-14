import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/public-chrome";
import { PublicCoachCard } from "@/components/public-coach";
import { Card } from "@/components/ui/card";
import { listPublicCoaches } from "@/lib/coach-public-server";

export const Route = createFileRoute("/coaches")({
  loader: async () => listPublicCoaches(),
  head: () => ({
    meta: [
      { title: "Tennis and pickleball coaches in Vidalia, GA | Rally" },
      {
        name: "description",
        content:
          "Coaches on Rally around Vidalia, GA. See prices and request a lesson time; the coach confirms.",
      },
    ],
    links: [{ rel: "canonical", href: "/coaches" }],
  }),
  component: CoachesPage,
});

function CoachesPage() {
  const coaches = Route.useLoaderData();
  return (
    <PublicChrome>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Coaches</p>
        <h1 className="mt-2 font-display text-4xl">Book a coach</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Request a lesson time for you or your kid. The coach confirms it.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {coaches.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">No coaches listed yet.</p>
            </Card>
          ) : (
            coaches.map((c) => <PublicCoachCard key={c.user_id} coach={c} />)
          )}
        </div>
      </main>
    </PublicChrome>
  );
}
