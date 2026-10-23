import { createFileRoute } from "@tanstack/react-router";
import { CoachPricing } from "@/components/coach-pricing";
import { ServicePage } from "@/components/service-page";
import { RALLY } from "@/lib/rally";
import { SITE_URL, pageHead, serviceLd } from "@/lib/seo";

const PATH = "/for-coaches";
const TITLE = "Tennis and pickleball coach scheduling app | Rally";
const DESCRIPTION = `A coach desk for tennis and pickleball coaches: public page, lesson menu, requests, recurring lessons, roster, and books. Pay as you go: no annual or monthly fee; Rally keeps ${RALLY.coachCardPct}% of each card payment plus card processing.`;

export const Route = createFileRoute("/for-coaches")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      jsonLd: [
        serviceLd({
          name: "Rally coach desk",
          description: DESCRIPTION,
          path: PATH,
          serviceType: "Coaching business software for tennis and pickleball coaches",
          audience: "Tennis and pickleball coaches",
          offers: {
            "@type": "Offer",
            url: `${SITE_URL}${PATH}`,
            priceCurrency: "USD",
            description: `Pay as you go. No annual or monthly fee. Rally keeps ${RALLY.coachCardPct}% of each lesson paid by credit card, plus the card processing fee. Cash App and Venmo payments: 0%.`,
          },
        }),
      ],
    }),
  component: ForCoaches,
});

function ForCoaches() {
  return (
    <ServicePage
      path={PATH}
      eyebrow="For coaches"
      title="A coach desk for tennis and pickleball coaches"
      intro="Your public page, your lesson menu, incoming requests, recurring lessons, and your books. Players request a time; you confirm it. If next week looks empty, Rally flags it."
      whoFor={[
        "Tennis and pickleball coaches who book lessons by text and keep the books on paper.",
        "Coaches who teach adults, juniors, groups, and clinics and want one calendar for all of it.",
      ]}
      youGet={[
        "A public coach page with your photo, headline, experience, and results, plus a link and QR code you can share.",
        "A menu, not one hourly rate: private lessons, group / clinic, hitting sessions, and juniors, priced per hour, per person, or per session.",
        "Lesson requests from players and parents. You confirm the time.",
        "Recurring lessons, a weather-day cancel, check-in, lesson notes, and video for your students.",
        "A roster of your students and a simple ledger: income, expenses, net.",
        "Players who credit you put their results on your card.",
      ]}
      steps={[
        "Join Rally and open your coach desk.",
        "Save your listing to turn on your public page, and build your lesson menu.",
        "Share your page or booking link. Requests land on your desk.",
      ]}
      extra={
        <section className="mt-10">
          <h2 className="font-display text-2xl">Price</h2>
          <CoachPricing className="mt-3" />
        </section>
      }
      cta={[
        { href: "/app/desk", label: "Open a coach desk" },
        { href: "/coaches", label: "See coaches on Rally" },
      ]}
    />
  );
}
