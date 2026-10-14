import { Link, createFileRoute, notFound } from "@tanstack/react-router";
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
  head: ({ loaderData: c }) => ({
    meta: [
      { title: c ? `${c.display_name} — tennis coach in ${c.city}, GA | Rally` : "Coach | Rally" },
      {
        name: "description",
        content: c
          ? `${c.display_name} coaches ${c.plays_tennis ? "tennis" : "pickleball"} in ${c.city}, GA.${c.headline ? ` ${c.headline}.` : ""} Request a lesson on Rally.`
          : "Coach on Rally.",
      },
    ],
    links: c ? [{ rel: "canonical", href: coachProfilePath(c.code) }] : [],
  }),
  notFoundComponent: () => (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <h1 className="mt-2 font-display text-4xl">Coach not found</h1>
        <Link to="/coaches" className="mt-4 inline-block underline">
          See coaches
        </Link>
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
