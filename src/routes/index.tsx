import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  GraduationCap,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";
import { RallyWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { catalogCities, catalogCity } from "@/lib/rally-server";
import { bookingLabel, citySlug, kindLabel, sportLabel } from "@/lib/rally";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({
  loader: async () => {
    const cities = await catalogCities();
    const courts = (
      await Promise.all(cities.map((c) => catalogCity({ data: { city: c.slug } })))
    ).flatMap((d) => d?.courts ?? []);
    return { cities, courts };
  },
  head: () => ({
    meta: [
      { title: "Rally — tennis and pickleball, managed in one place" },
      {
        name: "description",
        content:
          "Rally is the app for tennis and pickleball: find a court, reserve a window, get matched with people at your skill level, book a coach, join a league. Find your court.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  const { cities, courts } = Route.useLoaderData();

  return (
    <main className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <RallyWordmark />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/where">Find a court</Link>
          </Button>
          {isPending ? (
            <div className="h-11 w-24 animate-pulse rounded-md bg-secondary" />
          ) : user ? (
            <Button asChild>
              <Link to="/app">Open Rally</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }}>
                Join
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl overflow-hidden px-5 pt-10 pb-20 md:pt-20">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Rally",
              applicationCategory: "SportsApplication",
              description:
                "App for tennis and pickleball: court listings, reservations, open play, coaches, and leagues.",
              about: ["Tennis", "Pickleball"],
            }),
          }}
        />
        <CourtLines />
        <p className="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">
          Tennis · pickleball
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-6xl">
          Tennis and pickleball, in one place.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Rally runs tennis and pickleball: find a court, reserve a window, get matched with people
          at your skill level, book a coach, join a league. Recs, clubs, and schools are listed on
          Rally. Find your court.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/where">Find a court</Link>
          </Button>
          {isPending ? (
            <div className="h-12 w-36 animate-pulse rounded-md bg-secondary" />
          ) : user ? (
            <Button asChild size="lg" variant="outline">
              <Link to="/app">Go to your board</Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline">
              <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }}>
                Join Rally
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-3xl">What to expect</h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Find the court you play, reserve a window, then partners, coaches, and leagues live on
            the same board.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {EXPECT.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-6">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-display text-xl">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Listed facilities</p>
          <h2 className="mt-2 font-display text-3xl">Find the court you play</h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            {cities.map((c) => c.city).join(", ") || "Your city"} — public listings, no account to
            read. If yours is missing, list it and Rally starts taking reservations.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {courts
              .filter((c) => c.slug)
              .map((c) => (
              <Link
                key={c.id}
                to="/where/$city/$slug"
                params={{ city: citySlug(c.city), slug: c.slug! }}
              >
                <Card className="transition-colors duration-150 hover:border-primary/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl">{c.name}</h3>
                    <Badge variant="outline">{kindLabel(c.kind)}</Badge>
                    {c.status === "coming" ? <Badge variant="warn">Coming online</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.address}, {c.city}, GA
                  </p>
                  <p className="mt-2 text-sm">
                    {c.sports.split(",").map((s) => sportLabel(s.trim())).join(" · ")} ·{" "}
                    {bookingLabel(c.booking_mode)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/list-a-court">List a court</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/where">Browse by city</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-3xl">If you run a rec, club, or school program</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            List the courts. Rally posts open play and takes the reservation — or holds a window
            for a call, if that is how you book. Listing does not require a paid plan.
          </p>
          <Button asChild className="mt-6">
            <Link to="/list-a-court">List your courts</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-3xl">If you coach</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            A menu, not one hourly rate. Players who credit you put results on your card. Recurring
            lessons and the books live on your desk. Rally records the split when a fee exists.
            Card checkout is not on yet.
          </p>
          <Button asChild className="mt-6">
            {user ? (
              <Link to="/app/desk">Open a coach desk</Link>
            ) : (
              <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }}>
                Open a coach desk
              </Link>
            )}
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        Rally — tennis and pickleball. Eastern time on the board.
        {" · "}
        <Link to="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        {" · "}
        <Link to="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
    </main>
  );
}

function CourtLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-[-10%] hidden w-1/2 md:block"
    >
      <div className="absolute inset-0 border-l border-line/40" />
      <div className="absolute top-[12%] right-[18%] bottom-[12%] w-px bg-line/50" />
      <div className="absolute top-1/2 right-[8%] left-0 h-px bg-line/40" />
      <div className="absolute top-[28%] right-[8%] h-px w-1/2 bg-line/30" />
      <div className="absolute top-[72%] right-[8%] h-px w-1/2 bg-line/30" />
    </div>
  );
}

const EXPECT = [
  {
    icon: MapPin,
    title: "Find a listed court",
    body: "Address, hours, who books it, fees and rules. Rec, club, school, or a court someone just added.",
  },
  {
    icon: Calendar,
    title: "Reserve a window",
    body: "Rally takes the reservation when the facility allows it. Or holds it as pending and you call. Walk-up stays walk-up.",
  },
  {
    icon: Users,
    title: "Get matched by skill",
    body: "Partners by DUPR, NTRP, years, and results. Open play that is posted, not a rumor in a chat.",
  },
  {
    icon: GraduationCap,
    title: "Coaches and leagues",
    body: "A menu of work, not one rate. Rosters and match nights. The stall board when the same shot keeps breaking.",
  },
  {
    icon: Trophy,
    title: "Money stays honest",
    body: "If a facility charges $0, Rally takes $0. Splits are on the card when a fee actually moves.",
  },
];
