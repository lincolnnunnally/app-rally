import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { PublicChrome } from "@/components/public-chrome";
import { CoachLinkQr, PublicCoachCard } from "@/components/public-coach";
import { getPublicCoach } from "@/lib/coach-public-server";
import { coachProfilePath } from "@/lib/coach-links";

export const Route = createFileRoute("/coach/$code")({
  loader: async ({ params }) => {
    const coach = await getPublicCoach({ data: { code: params.code } });
    if (!coach) throw notFound();
    return coach;
  },
  head: ({ loaderData: c }) => {
    const head = pageHead({
      title: c
        ? `${c.display_name} — ${c.plays_tennis ? "tennis" : "pickleball"} coach in ${c.city}, GA | Rally`
        : "Coach | Rally",
      description: c
        ? `${c.display_name} coaches ${c.plays_tennis ? "tennis" : "pickleball"} in ${c.city}, GA.${c.headline ? ` ${c.headline}.` : ""} Request a lesson on Rally.`
        : "Coach on Rally.",
      path: c ? coachProfilePath(c.code) : "/coaches",
    });
    return c ? head : { meta: head.meta, links: [] };
  },
  notFoundComponent: () => (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <h1 className="mt-2 font-display text-4xl">This coach page is not public</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The link may be mistyped, or the coach has not turned on their page yet.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/coaches" className="underline">
            Find a coach
          </Link>
          <Link to="/app/desk" className="text-muted-foreground underline">
            Is this your page? Turn it on from your coach desk
          </Link>
        </div>
      </main>
    </PublicChrome>
  ),
  component: CoachPage,
});

function CoachPage() {
  const c = Route.useLoaderData();
  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Coach · Rally</p>
        <div className="mt-3">
          <PublicCoachCard coach={c} full />
        </div>
        <CoachLinkQr
          label="Share this profile"
          path={coachProfilePath(c.code)}
          fileName={`${c.code}-profile-qr.png`}
        />
        <p className="mt-6 text-sm">
          <Link to="/coaches" className="underline">
            All coaches
          </Link>
        </p>
      </main>
    </PublicChrome>
  );
}
