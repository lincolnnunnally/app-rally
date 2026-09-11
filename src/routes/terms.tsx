import { createFileRoute, Link } from "@tanstack/react-router";
import { RallyWordmark } from "@/components/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms — Rally" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10">
      <Link to="/" className="text-foreground">
        <RallyWordmark />
      </Link>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        · Terms
      </p>
      <h1 className="mt-2 font-display text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 11, 2026</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Rally is operated by <strong className="text-foreground">United Under God, Inc.</strong>,
          a Georgia corporation. By creating an account or using Rally, you agree to these terms.
        </p>
        <h2 className="font-display text-xl text-foreground">1. Purpose</h2>
        <p>
          Rally helps tennis and pickleball players find courts, partners, coaches, and leagues,
          and helps recs, clubs, schools, and coaches organize play. Post honestly. Do not invent
          people, coaches, or facilities. Empty boards stay empty until a real person joins.
        </p>
        <h2 className="font-display text-xl text-foreground">2. Your responsibilities</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Be truthful about skill, availability, fees, and whether a court is actually open.</li>
          <li>Show up when you reserve or RSVP, or cancel so someone else can use the window.</li>
          <li>Reviews must be about play you actually had. Do not farm ratings.</li>
          <li>
            Meeting in person is always optional. Prefer public courts. Rally does not screen
            players or coaches for you.
          </li>
          <li>Obey local facility rules and the law. Youth lessons need a parent or coach on site.</li>
        </ul>
        <h2 className="font-display text-xl text-foreground">3. Money</h2>
        <p>
          Rally may record a platform split when a facility or coach already charges a fee. Rec
          courts at $0 stay $0. Card checkout is not live yet — we do not take payment in the app
          until that path is proven. Do not send Rally money expecting automated collection.
        </p>
        <h2 className="font-display text-xl text-foreground">4. Accounts</h2>
        <p>
          Keep your login secure. Rally email/password accounts are separate from Neighborly,
          Kindred, and other United Under God apps unless you used the same Google or X identity.
          A password reset here does not change those other apps. We may suspend accounts that
          abuse the board or post fabricated people as real.
        </p>
        <h2 className="font-display text-xl text-foreground">5. Contact</h2>
        <p>
          Questions:{" "}
          <a className="text-foreground underline" href="mailto:lincoln@unitedundergod.org">
            lincoln@unitedundergod.org
          </a>
        </p>
      </div>
    </main>
  );
}
