import { Link, createFileRoute } from "@tanstack/react-router";
import { RallyWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { catalogCities, catalogCity } from "@/lib/rally-server";
import { RALLY, bookingLabel, citySlug, kindLabel, sportLabel } from "@/lib/rally";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ServiceLinks } from "@/components/service-links";
import { SITE_URL, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => {
    const cities = await catalogCities();
    const courts = (
      await Promise.all(cities.map((c) => catalogCity({ data: { city: c.slug } })))
    ).flatMap((d) => d?.courts ?? []);
    return { cities, courts };
  },
  head: () =>
    pageHead({
      title: "Rally — tennis and pickleball courts, partners, coaches",
      description:
        "The app for tennis and pickleball: find a court, reserve a window, join open play, get matched with players at your level, book a coach, and join a league.",
      path: "/",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Rally",
          url: `${SITE_URL}/`,
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          description:
            "App for tennis and pickleball: court listings, reservations, open play, partner matching, coaches, and leagues.",
          about: ["Tennis", "Pickleball"],
          publisher: { "@id": `${SITE_URL}/#org` },
        },
      ],
    }),
  component: Home,
});

const MUTED = "text-[#bfc6bd]";
const BTN = "h-[54px] px-7 text-base";

function Home() {
  const { user, isPending } = useCurrentUserState();
  const { cities, courts } = Route.useLoaderData();
  const listed = courts.filter((c) => c.slug).slice(0, 4);
  const joinSearch = { ref: undefined, coach: undefined, mode: "up" as const };

  return (
    <main className="min-h-dvh bg-background text-[18px]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-5">
        <RallyWordmark />
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/where">Find a court</Link>
          </Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/coaches">Find a coach</Link>
          </Button>
          {/* Until auth resolves, show the signed-out buttons (real links) instead of blank boxes. */}
          {!isPending && user ? (
            <Button asChild>
              <Link to="/app">Open Rally</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary">
                <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "in" }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild>
                <Link to="/login" search={joinSearch}>
                  Join
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 pb-16 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold tracking-[0.22em] text-primary uppercase">Tennis · pickleball</p>
          <h1 className="mt-4 font-display text-[44px] leading-[1.04] md:text-[64px]">
            Tennis and pickleball, in one place.
          </h1>
          <p className={`mt-6 max-w-xl text-lg md:text-xl ${MUTED}`}>
            Find a court, reserve a window, get matched with people at your skill level, book a
            coach, join a league. Recs, clubs, and schools are listed on Rally.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className={BTN}>
              <Link to="/where">Find a court</Link>
            </Button>
            {!isPending && user ? (
              <Button asChild size="lg" variant="outline" className={BTN}>
                <Link to="/app">Open Rally</Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className={BTN}>
                <Link to="/login" search={joinSearch}>
                  Join Rally
                </Link>
              </Button>
            )}
          </div>
          <p className={`mt-5 text-base ${MUTED}`}>
            Want lessons?{" "}
            <Link to="/coaches" className="text-foreground underline underline-offset-4">
              Find a coach
            </Link>
          </p>
        </div>
        <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
          <div className="flex h-8 items-center gap-1.5 bg-secondary px-3">
            <i className="size-2.5 rounded-full bg-line" />
            <i className="size-2.5 rounded-full bg-line" />
            <i className="size-2.5 rounded-full bg-line" />
            <span className={`ml-2 truncate text-xs ${MUTED}`}>A court page on Rally</span>
          </div>
          <img
            src="/home-court.jpg"
            alt="Rally court page for Ed Smith Complex — Tennis"
            width={1280}
            height={800}
            fetchPriority="high"
            className="block w-full"
          />
        </figure>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-4xl">How Rally works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-[#161b19] p-6">
                <span className="font-display text-3xl text-primary">{i + 1}</span>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className={`mt-2 leading-relaxed ${MUTED}`}>{s.body}</p>
              </li>
            ))}
          </ol>
          <p className={`mt-6 ${MUTED}`}>If a facility charges $0, Rally takes $0.</p>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">Listed facilities</p>
          <h2 className="mt-2 font-display text-4xl">
            Courts near {cities.map((c) => c.city).join(" and ") || "you"}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {listed.map((c) => (
              <article key={c.id} className="flex flex-col rounded-xl border border-border bg-[#161b19] p-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{kindLabel(c.kind)}</Badge>
                  {c.sports.split(",").map((s) => (
                    <Badge key={s} variant="outline">{sportLabel(s.trim())}</Badge>
                  ))}
                  {c.status === "coming" ? <Badge variant="warn">Coming online</Badge> : null}
                </div>
                <h3 className="mt-4 font-display text-2xl">{c.name}</h3>
                <p className={`mt-1 ${MUTED}`}>{c.address}, {c.city}, GA</p>
                <p className={`mt-1 ${MUTED}`}>{bookingLabel(c.booking_mode)}</p>
                <Link
                  to="/where/$city/$slug"
                  params={{ city: citySlug(c.city), slug: c.slug! }}
                  className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View court →
                </Link>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className={BTN}>
              <Link to="/where">Browse by city</Link>
            </Button>
            <Button asChild className={BTN}>
              <Link to="/list-a-court">List a court</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-[#161b19] p-7">
            <h2 className="font-display text-3xl">If you run a rec, club, or school program</h2>
            <p className={`mt-3 ${MUTED}`}>
              List the courts. Rally posts open play and takes the reservation, or holds a window
              for a call if that is how you book. Listing does not require a paid plan.
            </p>
            <Button asChild className={`mt-6 ${BTN}`}>
              <Link to="/list-a-court">List your courts</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-[#161b19] p-7">
            <h2 className="font-display text-3xl">If you coach</h2>
            <p className={`mt-3 ${MUTED}`}>
              A menu, not one hourly rate. Players who credit you put results on your card.
              Recurring lessons and the books live on your desk. No annual or monthly fee: Rally
              keeps {RALLY.coachCardPct}% of each card payment plus card processing; Cash App and Venmo
              payments are free.
            </p>
            <Button asChild className={`mt-6 ${BTN}`}>
              {user ? (
                <Link to="/app/desk">Open a coach desk</Link>
              ) : (
                <Link to="/login" search={joinSearch}>
                  Open a coach desk
                </Link>
              )}
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-4xl">What you can do on Rally</h2>
          <ServiceLinks className="mt-6 grid gap-3 sm:grid-cols-2" itemClassName="rounded-xl border border-border bg-[#161b19] p-5 font-semibold hover:border-primary/40" />
        </div>
      </section>

      <footer className={`border-t border-border px-5 py-8 text-center text-base ${MUTED}`}>
        Rally — tennis and pickleball. All times Eastern.
        {" · "}
        <Link to="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">
          Privacy
        </Link>
        {" · "}
        <Link to="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">
          Terms
        </Link>
      </footer>
    </main>
  );
}

const STEPS = [
  {
    title: "Find a court",
    body: "Address, hours, who books it, fees and rules. Rec, club, school, or a court someone just added.",
  },
  {
    title: "Reserve a window",
    body: "Rally takes the reservation when the facility allows it, or holds it as pending and you call. Walk-up stays walk-up.",
  },
  {
    title: "Play at your level",
    body: "Partners by DUPR, NTRP, years, and results. Coaches and leagues on the same board.",
  },
];
