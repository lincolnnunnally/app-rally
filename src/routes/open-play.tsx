import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/service-page";
import { pageHead, serviceLd } from "@/lib/seo";

const PATH = "/open-play";
const TITLE = "Pickleball and tennis open play, round robins | Rally";
const DESCRIPTION =
  "Find pickleball and tennis open play on Rally: round robins, clinics, and social mixes at listed courts, each with a skill range and an RSVP count.";

export const Route = createFileRoute("/open-play")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: PATH,
      jsonLd: [
        serviceLd({
          name: "Open play and round robins",
          description: DESCRIPTION,
          path: PATH,
          serviceType: "Pickleball and tennis open play scheduling",
          audience: "Tennis and pickleball players",
        }),
      ],
    }),
  component: OpenPlay,
});

function OpenPlay() {
  return (
    <ServicePage
      path={PATH}
      eyebrow="Open play"
      title="Pickleball and tennis open play, posted where you can see it"
      intro="Open play, round robins, clinics, and social mixes go on one board. Each session names the court, the time, the format, and the skill range, and shows who has said they are going."
      whoFor={[
        "Players who want a game without texting five people first.",
        "Anyone new in town looking for a group at their level.",
        "Organizers who run a weekly open play or round robin and want one place to post it.",
      ]}
      youGet={[
        "Sessions by format: open play, round robin, clinic / drilling, or social mix.",
        "Tennis and pickleball side by side, with a filter for each.",
        "A skill range on each session, so a 3.0 does not walk into a 4.5 drill by surprise.",
        "An RSVP: say you are going, or take it back, and see the count.",
      ]}
      steps={[
        "Join Rally and set up your player card (tennis, pickleball, or both).",
        "Open the play board and pick a session at a listed court.",
        "Tap that you are going. If you run a group, post your own session.",
      ]}
      cta={[
        { href: "/app/play", label: "See open play" },
        { href: "/where", label: "Find a court" },
      ]}
    />
  );
}
