import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ShareListing } from "@/components/share-rally";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { catalogCity } from "@/lib/rally-server";
import { DirectionsButton, DirectionsLink, FacilityThumb } from "@/components/facility-place";
import { bookingLabel, citySlug, kindLabel, money, sportLabel } from "@/lib/rally";

export const Route = createFileRoute("/where/$city/")({
  loader: async ({ params }) => {
    const data = await catalogCity({ data: { city: params.city } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const city = loaderData?.city ?? "Georgia";
    const names = (loaderData?.courts ?? []).map((c) => c.name).join(", ");
    return {
      meta: [
        { title: `Tennis and pickleball courts in ${city}, GA | Rally` },
        {
          name: "description",
          content: names
            ? `Tennis and pickleball in ${city}, Georgia. ${names}. Hours, fees, who books the court, and coaches on Rally.`
            : `Find tennis and pickleball courts in ${city}, Georgia.`,
        },
      ],
      links: [{ rel: "canonical", href: `/where/${loaderData?.slug ?? ""}` }],
    };
  },
  component: CityPage,
});

function CityPage() {
  const { city, slug, courts, coaches } = Route.useLoaderData();
  const tennis = courts.some((c) => c.sports.includes("tennis"));
  const pb = courts.some((c) => c.sports.includes("pickle"));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Tennis and pickleball courts in ${city}, GA`,
    itemListElement: courts.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `/where/${slug}/${c.slug ?? ""}`,
      name: c.name,
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link to="/where" className="text-xs text-muted-foreground hover:text-foreground">
        All cities
      </Link>
      <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">
        {city} · listed on Rally
      </p>
      <h1 className="mt-2 font-display text-4xl">
        {tennis && pb
          ? `Tennis and pickleball courts in ${city}, GA`
          : tennis
            ? `Tennis courts in ${city}, GA`
            : `Pickleball courts in ${city}, GA`}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Facilities listed on Rally in {city}. Addresses, who books the court, fees. Reserve a
        window after you join — or list another court if yours is missing.
      </p>
      <div className="mt-4">
        <ShareListing href={`/where/${slug}`} label={`${city} tennis and pickleball`} />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {courts.map((c) => (
          <Card key={c.id}>
            <div className="grid gap-4 sm:grid-cols-[14rem_1fr] sm:items-start">
              <FacilityThumb court={c} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/where/$city/$slug"
                    params={{ city: slug, slug: c.slug ?? citySlug(c.name) }}
                    className="font-display text-2xl"
                  >
                    {c.name}
                  </Link>
                  <Badge variant="outline">{kindLabel(c.kind)}</Badge>
                  {c.status === "coming" ? <Badge variant="warn">Coming online</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <DirectionsLink
                    court={c}
                    className="underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    {c.address}, {c.city}, GA
                  </DirectionsLink>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.sports.split(",").map((s) => (
                    <Badge key={s} variant={s.includes("pickle") ? "pickleball" : "tennis"}>
                      {sportLabel(s.trim())}
                    </Badge>
                  ))}
                  <Badge variant="outline">{c.court_count} courts</Badge>
                </div>
                <p className="mt-3 text-sm">{bookingLabel(c.booking_mode)}</p>
                {c.rules ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.rules}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <DirectionsButton court={c} size="sm" />
                <Button asChild variant="secondary" size="sm">
                  <Link
                    to="/where/$city/$slug"
                    params={{ city: slug, slug: c.slug ?? citySlug(c.name) }}
                  >
                    Court page
                  </Link>
                </Button>
              </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {coaches.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Coaches in {city}</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {coaches.map((c) => (
              <li key={c.display_name} className="rounded-lg border border-border px-4 py-3">
                <p className="text-sm">
                  {c.display_name}
                  {c.from_cents != null ? ` · from ${money(c.from_cents)}` : ""}
                </p>
                {c.headline ? <p className="mt-1 text-xs text-muted-foreground">{c.headline}</p> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Book from the board after you join. Players who credit a coach put results on that listing.
          </p>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }}>
            Join to reserve
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/list-a-court">Don't see your court?</Link>
        </Button>
      </div>
    </main>
  );
}
