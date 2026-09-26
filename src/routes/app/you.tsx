import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  GraduationCap,
  PenLine,
  TrendingDown,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlayerSportCards } from "@/components/player-proof";
import { ProfileFace } from "@/components/profile-face";
import { ProofDisplay } from "@/components/proof-lists";
import { PlatformFeesCard } from "@/components/rally-pay";
import { CoachInvite, ShareRally } from "@/components/share-rally";
import { UserButton } from "@/lib/auth/gates";
import { useRally } from "@/lib/rally-context";

export const Route = createFileRoute("/app/you")({ component: You });

function You() {
  const { profile } = useRally();

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">You</p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProfileFace name={profile.display_name} photo={profile.photo_data} size="lg" />
          <div>
            <h1 className="font-display text-4xl">{profile.display_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.city}</p>
          </div>
        </div>
        <UserButton />
      </div>
      <Card className="mt-8">
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Your card</p>
        <div className="mt-3">
          <PlayerSportCards player={profile} />
          <ProofDisplay certs={profile.certs} honors={profile.honors} />
        </div>
      </Card>
      {profile.is_coach ? (
        <div className="mt-8">
          <CoachInvite code={profile.share_code} coachName={profile.display_name} />
        </div>
      ) : null}
      <div className="mt-8">
        <ShareRally code={profile.share_code} creditCents={profile.credit_cents} />
      </div>
      <PlatformFeesCard />
      <div className="mt-8 grid gap-3">
        <Link to="/app/mental" search={{ after: "court" }}>
          <Card className="flex items-center gap-4 transition-colors duration-150 hover:border-primary/40">
            <PenLine className="size-5 text-primary" />
            <div>
              <div className="font-medium">After court</div>
              <div className="text-sm text-muted-foreground">
                After play or a lesson, start with what you did well.
              </div>
            </div>
          </Card>
        </Link>
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="flex items-center gap-4 transition-colors duration-150 hover:border-primary/40">
              <l.icon className="size-5 text-primary" />
              <div>
                <div className="font-medium">{l.title}</div>
                <div className="text-sm text-muted-foreground">{l.body}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

const LINKS = [
  {
    to: "/app/partners" as const,
    icon: Users,
    title: "Partners",
    body: "Find a hit. Answer requests.",
  },
  {
    to: "/app/leagues" as const,
    icon: Trophy,
    title: "Leagues",
    body: "Rosters, schedules, scores.",
  },
  {
    to: "/app/progress" as const,
    icon: TrendingDown,
    title: "I have stalled",
    body: "Beginner basics, or you have outgrown this coach.",
  },
  {
    to: "/app/desk" as const,
    icon: GraduationCap,
    title: "Coach desk",
    body: "Listing, menu, pipeline, books.",
  },
  {
    to: "/app/mental" as const,
    icon: Brain,
    title: "Mental game",
    body: "Reset, self-talk, journal.",
  },
  {
    to: "/app/profile" as const,
    icon: UserRound,
    title: "Profile",
    body: "Tennis and pickleball, each with skill, years, and how often.",
  },
];
