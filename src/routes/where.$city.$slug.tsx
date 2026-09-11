import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ShareListing } from "@/components/share-rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { catalogCourt } from "@/lib/rally-server";
import { bookingLabel, citySlug, kindLabel, money, sportLabel } from "@/lib/rally";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/where/$city/$slug")({
  loader: async ({ params }) => {
    const court = await catalogCourt({ data: { city: params.city, slug: params.slug } });
    if (!court) throw notFound();
    return court;
  },
  head: ({ loaderData }) => {
    const c = loaderData;
    const sport = c?.sports.includes("tennis")
      ? c.sports.includes("pickle")
        ? "tennis and pickleball"
        : "tennis"
      : "pickleball";
    return {
      meta: [
        { title: `${c?.name ?? "Court"} — ${sport} in ${c?.city ?? "Georgia"}, GA | Rally` },
        {
          name: "description",
          content: c
            ? `${c.name} at ${c.address}, ${c.city}, GA. ${c.court_count} ${sport} courts. ${bookingLabel(c.booking_mode)}. Fees and rules on Rally.`
            : "Court listing on Rally.",
        },
      ],
      links: c?.slug
        ? [{ rel: "canonical", href: `/where/${citySlug(c.city)}/${c.slug}` }]
        : [],
    };
  },
  component: CourtPage,
});

function CourtPage() {
  const c = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const city = citySlug(c.city);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: c.name,
    description: [c.typical_hours, c.rules].filter(Boolean).join(" · ") || undefined,
    sport: c.sports
      .split(",")
      .map((s) => (s.includes("pickle") ? "Pickleball" : "Tennis")),
    address: {
      "@type": "PostalAddress",
      streetAddress: c.address,
      addressLocality: c.city,
      addressRegion: "GA",
      postalCode: c.city.toLowerCase() === "vidalia" ? "30474" : c.city.toLowerCase() === "lyons" ? "30436" : undefined,
      addressCountry: "US",
    },
    telephone: c.manager_phone ?? c.phone ?? undefined,
    geo:
      c.lat != null && c.lng != null
        ? { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lng }
        : undefined,
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link
        to="/where/$city"
        params={{ city }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {c.city} courts
      </Link>
      <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Listed on Rally · {kindLabel(c.kind)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">{c.name}</h1>
        <Badge variant="outline">{kindLabel(c.kind)}</Badge>
        {c.status === "coming" ? <Badge variant="warn">Coming online</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {c.address}, {c.city}, GA
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {c.sports.split(",").map((s) => (
          <Badge key={s} variant={s.includes("pickle") ? "pickleball" : "tennis"}>
            {sportLabel(s.trim())}
          </Badge>
        ))}
        <Badge variant="outline">{c.court_count} courts</Badge>
        {c.lights ? <Badge variant="outline">Lights {c.lights_until ?? ""}</Badge> : null}
        {c.restrooms ? <Badge variant="outline">Restrooms</Badge> : null}
      </div>

      <Card className="mt-8">
        <p className="text-sm">{bookingLabel(c.booking_mode)}</p>
        {c.player_fee_cents > 0 || c.coach_fee_cents > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {c.player_fee_cents > 0 ? `Player ${money(c.player_fee_cents)} · ` : ""}
            {c.coach_fee_cents > 0 ? `Coach court fee ${money(c.coach_fee_cents)}` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No player fee. Rally takes nothing when the fee is $0.</p>
        )}
        {c.rules ? <p className="mt-4 text-sm leading-relaxed">{c.rules}</p> : null}
        {c.restrictions ? <p className="mt-3 text-xs text-warn">{c.restrictions}</p> : null}
        {c.typical_hours ? (
          <p className="mt-3 text-sm text-muted-foreground">{c.typical_hours}</p>
        ) : null}
        {(c.manager_name || c.manager_phone) && (
          <p className="mt-4 text-sm">
            {c.manager_name ?? "Manager"}
            {c.manager_phone ? (
              <>
                {" · "}
                <a className="underline decoration-border underline-offset-4" href={`tel:${c.manager_phone}`}>
                  {c.manager_phone}
                </a>
              </>
            ) : null}
          </p>
        )}
      </Card>

      <div className="mt-6">
        <ShareListing href={`/where/${city}/${c.slug}`} label={c.name} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild>
          {user ? (
            <Link to="/app/courts">Reserve on Rally</Link>
          ) : (
            <Link to="/login" search={{ ref: undefined, mode: "up" }}>
              Reserve on Rally
            </Link>
          )}
        </Button>
        <Button asChild variant="outline">
          <Link to="/list-a-court">List another court</Link>
        </Button>
      </div>
    </main>
  );
}
