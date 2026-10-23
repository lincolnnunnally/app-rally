import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/service-page";
import { pageHead, serviceLd } from "@/lib/seo";

const PATH = "/find-a-partner";
const TITLE = "Find a tennis or pickleball partner at your level | Rally";
const DESCRIPTION =
  "Find someone to play tennis or pickleball with at your skill level. Rally shows ratings, years played, and how often people play, then lets you ask for a hit.";

export const Route = createFileRoute("/find-a-partner")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      jsonLd: [
        serviceLd({
          name: "Tennis and pickleball partner matching",
          description: DESCRIPTION,
          path: PATH,
          serviceType: "Tennis and pickleball partner matching",
          audience: "Tennis and pickleball players",
        }),
      ],
    }),
  component: FindAPartner,
});

function FindAPartner() {
  return (
    <ServicePage
      path={PATH}
      eyebrow="Partners"
      title="Find someone to play with at your level"
      intro="Rally keeps tennis and pickleball on separate cards, so a 30-year tennis player is not mistaken for a 30-year pickleball player. Filter to people near your level and ask for a hit."
      whoFor={[
        "Players who want a regular hitting partner.",
        "People new to pickleball or tennis who want someone close to their level.",
        "Players coming back to the game after time away.",
      ]}
      youGet={[
        "A player card per sport: rating (DUPR, UTR, or a 2.0–5.0 level), years played, and how often you play.",
        "A “near my level” filter on the partner list.",
        "Play requests: pick a court and a time, add a note, and the other player accepts or declines.",
        "Titles and certifications a player chose to add, and the coach they credit.",
      ]}
      steps={[
        "Join Rally and fill in your card for tennis, pickleball, or both.",
        "Open Partners and turn on “near my level”.",
        "Send a request with a court and a time. You see it when they answer.",
      ]}
      cta={[
        { href: "/app/partners", label: "Find a partner" },
        { href: "/open-play", label: "Or try open play" },
      ]}
    />
  );
}
