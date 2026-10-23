import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/service-page";
import { pageHead, serviceLd } from "@/lib/seo";

const PATH = "/leagues";
const TITLE = "Pickleball and tennis leagues and ladders | Rally";
const DESCRIPTION =
  "Join or start a pickleball or tennis league on Rally. Round robin or ladder, a skill band, a season, a roster, and a match schedule with scores in one place.";

export const Route = createFileRoute("/leagues")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      jsonLd: [
        serviceLd({
          name: "Tennis and pickleball leagues",
          description: DESCRIPTION,
          path: PATH,
          serviceType: "Tennis and pickleball league management",
          audience: "Tennis and pickleball players and league organizers",
        }),
      ],
    }),
  component: Leagues,
});

function Leagues() {
  return (
    <ServicePage
      path={PATH}
      eyebrow="Leagues"
      title="Pickleball and tennis leagues and ladders"
      intro="Start a league or join one. Each league has a format, a skill band, a season, a roster, and a schedule of matches with scores, so nobody is keeping it on a group text."
      whoFor={[
        "Players who want regular, scored matches instead of only open play.",
        "Organizers running a round robin or ladder at a rec, club, or school.",
      ]}
      youGet={[
        "Two formats: round robin or ladder.",
        "A skill band and season label, like “3.0–3.5, Fall”.",
        "A roster you join or leave with one tap.",
        "A match schedule: who plays whom, on which court, and the score once it is played.",
        "An optional registration fee set by the organizer. A league at $0 costs nothing to join.",
      ]}
      steps={[
        "Join Rally and open Leagues.",
        "Join a league that fits your sport and level, or start one. You are on its roster.",
        "Schedule matches from the league board and post scores after you play.",
      ]}
      cta={[
        { href: "/app/leagues", label: "See leagues" },
        { href: "/find-a-partner", label: "Find a partner" },
      ]}
    />
  );
}
