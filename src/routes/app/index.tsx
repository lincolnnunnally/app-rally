import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useRally } from "@/lib/rally-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWall, sportLabel } from "@/lib/rally";
import { homeFeed } from "@/lib/rally-server";

export const Route = createFileRoute("/app/")({ component: Today });

function Today() {
  const { profile } = useRally();
  const feed = useQuery({ queryKey: ["home"], queryFn: () => homeFeed() });

  return (
    <div className="px-5 py-8">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Today</p>
      <h1 className="mt-2 font-display text-4xl">
        {greeting()}, {firstName(profile.display_name)}
      </h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        {profile.plays_pickleball && profile.plays_tennis
          ? `Pickleball ${profile.pickleball_level ?? ""} · Tennis ${profile.tennis_level ?? ""}`
          : profile.plays_pickleball
            ? `Pickleball ${profile.pickleball_level ?? ""}`
            : `Tennis ${profile.tennis_level ?? ""}`}
        {" · "}
        {profile.city}
      </p>

      {feed.isPending ? (
        <div className="mt-8 grid gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : feed.data ? (
        <div className="mt-8 grid gap-4">
          {feed.data.pendingLessons > 0 || feed.data.pendingPlay > 0 || feed.data.unread > 0 ? (
            <Card className="flex flex-col gap-2">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">Needs you</p>
              {feed.data.pendingLessons > 0 ? (
                <Link to="/app/desk" className="flex items-center justify-between text-sm">
                  {feed.data.pendingLessons} lesson request{feed.data.pendingLessons === 1 ? "" : "s"}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
              {feed.data.pendingPlay > 0 ? (
                <Link to="/app/partners" className="flex items-center justify-between text-sm">
                  {feed.data.pendingPlay} hitting request{feed.data.pendingPlay === 1 ? "" : "s"}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
              {feed.data.unread > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {feed.data.unread} notice{feed.data.unread === 1 ? "" : "s"} in the bell
                </p>
              ) : null}
            </Card>
          ) : null}

          {feed.data.pipelineGap ? (
            <Card className="border-warn/40">
              <p className="text-xs tracking-widest text-warn uppercase">Pipeline</p>
              <p className="mt-2 font-display text-xl">Busy this week. Empty in two weeks.</p>
              <Link to="/app/desk" className="mt-2 flex items-center justify-between text-sm">
                Open the desk and fill next week
                <ArrowRight className="size-4" />
              </Link>
            </Card>
          ) : null}

          <Section title="You are on the board" to="/app/play">
            {feed.data.mySessions.length === 0 ? (
              <Empty>
                You have not RSVP’d to open play yet.{" "}
                <Link to="/app/play" className="text-foreground">
                  See the board
                </Link>
              </Empty>
            ) : (
              feed.data.mySessions.map((s) => (
                <Row
                  key={s.id}
                  k={s.title}
                  v={`${formatWall(s.starts_at)} · ${s.court_name ?? ""}`}
                />
              ))
            )}
          </Section>

          <Section title="Your courts" to="/app/courts">
            {feed.data.reservations.length === 0 ? (
              <Empty>
                No reservations on the books.{" "}
                <Link to="/app/courts" className="text-foreground">
                  Claim a window
                </Link>
              </Empty>
            ) : (
              feed.data.reservations.map((r) => (
                <Row
                  key={r.id}
                  k={r.court_name}
                  v={`${formatWall(r.starts_at)} · ${sportLabel(r.sport)}${r.status === "pending" ? " · pending call" : ""}`}
                />
              ))
            )}
          </Section>

          <Section title="Coming up at Rec" to="/app/play">
            {feed.data.openPlay.length === 0 ? (
              <Empty>No open play posted yet.</Empty>
            ) : (
              feed.data.openPlay.map((s) => (
                <Row
                  key={s.id}
                  k={s.title}
                  v={`${formatWall(s.starts_at)} · ${s.going}/${s.spots} in`}
                />
              ))
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  to,
  children,
}: {
  title: string;
  to: "/app/play" | "/app/courts";
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground">
          All
        </Link>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-3 first:border-0 first:pt-0">
      <div className="text-sm">{k}</div>
      <div className="text-xs text-muted-foreground">{v}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function firstName(name: string) {
  return name.split(" ")[0];
}
