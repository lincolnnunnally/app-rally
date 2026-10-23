import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/service-page";
import { MENTAL_RESET, STALL_AREAS } from "@/lib/rally";
import { pageHead, serviceLd } from "@/lib/seo";

const PATH = "/get-better";
const TITLE = "Stuck at tennis or pickleball? Get unstuck | Rally";
const DESCRIPTION =
  "Stalled at pickleball or tennis? Tell Rally where it broke and get a next step — a mindset drill, a structured hour, or a different coach — plus a reset routine.";

export const Route = createFileRoute("/get-better")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      jsonLd: [
        serviceLd({
          name: "Get unstuck at tennis and pickleball",
          description: DESCRIPTION,
          path: PATH,
          serviceType: "Tennis and pickleball improvement guidance",
          audience: "Tennis and pickleball players",
        }),
      ],
    }),
  component: GetBetter,
});

function GetBetter() {
  return (
    <ServicePage
      path={PATH}
      eyebrow="Get better"
      title="Stuck at tennis or pickleball? Start where it broke."
      intro="New to the game, or you already know everything your current coach has to teach. Tell Rally where it broke. We will not sell you a miracle — a mindset drill, a structured hour, or a different coach."
      whoFor={STALL_AREAS.map((a) => `${a.label}: ${a.hint}`)}
      youGet={[
        "A next step matched to where you are stuck, pointing at a coach, open play, a league, or the between-points routine on Rally.",
        "A four-step routine for between points, the same every time until it is automatic.",
        "An “after court” journal: after play or a lesson, name one thing that worked.",
      ]}
      steps={[
        "Join Rally and open Progress.",
        "Pick the spot where your game stalled.",
        "Use the between-points routine in your next match, and log one thing that worked after.",
      ]}
      extra={
        <section className="mt-10">
          <h2 className="font-display text-2xl">The between-points routine</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
            {MENTAL_RESET.map((s) => (
              <li key={s.step}>
                <span className="font-semibold text-foreground">{s.step}.</span> {s.body}
              </li>
            ))}
          </ol>
        </section>
      }
      cta={[
        { href: "/app/progress", label: "Tell Rally where it broke" },
        { href: "/coaches", label: "Find a coach" },
      ]}
    />
  );
}
