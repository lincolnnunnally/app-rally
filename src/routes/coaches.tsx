import { createFileRoute } from "@tanstack/react-router";
import { pageHead, serviceLd } from "@/lib/seo";
import { PublicChrome } from "@/components/public-chrome";
import { PublicCoachCard } from "@/components/public-coach";
import { Card } from "@/components/ui/card";
import { listPublicCoaches } from "@/lib/coach-public-server";

export const Route = createFileRoute("/coaches")({
  loader: async () => listPublicCoaches(),
  head: () =>
    pageHead({
      title: "Tennis and pickleball coaches and lessons | Rally",
      description:
        "Tennis and pickleball lessons with coaches on Rally around Vidalia, GA: private, group, hitting, and junior. See prices, request a time; the coach confirms.",
      path: "/coaches",
      jsonLd: [
        serviceLd({
          name: "Book a tennis or pickleball coach",
          description:
            "Request a tennis or pickleball lesson for you or your kid from coaches listed on Rally. See each coach's menu and price; the coach confirms the time.",
          path: "/coaches",
          serviceType: "Tennis and pickleball lesson booking",
          audience: "Tennis and pickleball players and parents",
        }),
      ],
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
        <p className="mt-2 text-sm text-muted-foreground">
          Coaches set their own menu — private lessons, group clinics, hitting sessions, and juniors —
          and their own prices. Coach on Rally yourself?{" "}
          <a href="/for-coaches" className="text-foreground underline underline-offset-4">
            See the coach desk
          </a>
          .
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
