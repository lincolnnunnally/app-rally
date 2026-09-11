import { createFileRoute, Link } from "@tanstack/react-router";
import { RallyWordmark } from "@/components/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy — Rally" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10">
      <Link to="/" className="text-foreground">
        <RallyWordmark />
      </Link>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        · Privacy
      </p>
      <h1 className="mt-2 font-display text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 11, 2026</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Rally is operated by <strong className="text-foreground">United Under God, Inc.</strong>{" "}
          This policy explains what we collect when you use Rally for tennis and pickleball.
        </p>
        <h2 className="font-display text-xl text-foreground">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details you provide (name, email, password if you use email sign-in).</li>
          <li>
            Profile answers you choose to share (photo, sports, skill, years, certifications,
            titles, trophies, competitions, city, whether you coach).
          </li>
          <li>
            Court listings, reservations, open play RSVPs, partner requests, lessons, leagues,
            reviews, and journal notes you write.
          </li>
          <li>Technical data needed to run the service (session cookies, basic device/browser info).</li>
        </ul>
        <h2 className="font-display text-xl text-foreground">How we use it</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To match players, book courts, list coaches, and run leagues you join.</li>
          <li>To keep accounts secure, recover passwords, and prevent abuse.</li>
          <li>To improve Rally and related United Under God tools.</li>
        </ul>
        <h2 className="font-display text-xl text-foreground">Sharing</h2>
        <p>
          Your player or coach card is visible to other Rally users so they can decide whether
          to hit, book, or review. We do not sell your personal information. We may use trusted
          infrastructure (hosting, database, email) solely to operate the product.
        </p>
        <h2 className="font-display text-xl text-foreground">Retention and your choices</h2>
        <p>
          You can edit your profile in the app. To close an account or ask what we store, write{" "}
          <a className="text-foreground underline" href="mailto:lincoln@unitedundergod.org">
            lincoln@unitedundergod.org
          </a>
          .
        </p>
      </div>
    </main>
  );
}
