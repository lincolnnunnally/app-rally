import { Link, createFileRoute } from "@tanstack/react-router";
import { pageHead, serviceLd } from "@/lib/seo";
import { catalogCities } from "@/lib/rally-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/where/")({
  loader: () => catalogCities(),
  head: () =>
    pageHead({
      title: "Find a tennis or pickleball court near you | Rally",
      description:
        "Find tennis and pickleball courts listed on Rally — recs, clubs, and schools, including Vidalia Rec at 102 Stockyard Rd. Hours, fees, rules, and how to reserve.",
      path: "/where",
      jsonLd: [
        serviceLd({
          name: "Find and reserve a tennis or pickleball court",
          description:
            "Court listings with address, hours, fees, and rules. Rally takes the reservation when the facility allows it, or holds a window while you call.",
          path: "/where",
          serviceType: "Tennis and pickleball court listings and reservations",
          audience: "Tennis and pickleball players",
        }),
      ],
    }),
  component: WhereIndex,
});

function WhereIndex() {
  const cities = Route.useLoaderData();

  return (
    <main className="mx-auto max-w-5xl px-5 pb-16">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Listed on Rally</p>
      <h1 className="mt-2 font-display text-4xl">Find a court</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Facilities listed on the app — recs, clubs, schools, public courts. No account to read a
        listing. Join Rally to reserve, or list a court if yours is missing.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {cities.map((c) => (
          <Link key={c.slug} to="/where/$city" params={{ city: c.slug }}>
            <Card className="transition-colors duration-150 hover:border-primary/40">
              <h2 className="font-display text-2xl">{c.city}, GA</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.sports.some((s) => s.includes("tennis")) ? "Tennis" : ""}
                {c.sports.some((s) => s.includes("tennis")) &&
                c.sports.some((s) => s.includes("pickle"))
                  ? " and pickleball"
                  : c.sports.some((s) => s.includes("pickle"))
                    ? "Pickleball"
                    : ""}
                {` · ${c.court_count} ${c.court_count === 1 ? "facility" : "facilities"}`}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-10">
        <Button asChild>
          <Link to="/list-a-court">Don't see your court? List it</Link>
        </Button>
      </div>
    </main>
  );
}
