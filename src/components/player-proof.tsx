import type { PlayerProof, SportBits } from "@/lib/rally";
import { sportLine, sportResults, sportStory } from "@/lib/rally";

export function PlayerSportCards({
  player: p,
  compact,
}: {
  player: SportBits;
  compact?: boolean;
}) {
  const tennis = p.plays_tennis !== false && (p.tennis_level || p.utr || p.tennis_years != null || p.tennis_experience);
  const pickleball =
    p.plays_pickleball !== false &&
    (p.pickleball_level || p.dupr || p.pickleball_years != null || p.pickleball_experience);
  const showT = p.plays_tennis === true || (p.plays_tennis !== false && tennis);
  const showP = p.plays_pickleball === true || (p.plays_pickleball !== false && pickleball);
  if (!showT && !showP) return null;

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {showP ? <SportBlock kind="pickleball" player={p} compact={compact} /> : null}
      {showT ? <SportBlock kind="tennis" player={p} compact={compact} /> : null}
    </div>
  );
}

function SportBlock({
  kind,
  player: p,
  compact,
}: {
  kind: "tennis" | "pickleball";
  player: SportBits;
  compact?: boolean;
}) {
  const line = sportLine(kind, p);
  const story = sportStory(kind, p);
  const results = sportResults(kind, p);
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {kind === "tennis" ? "Tennis" : "Pickleball"}
      </p>
      {line ? <p className={compact ? "mt-0.5 text-sm" : "mt-1 text-sm"}>{line}</p> : null}
      {story ? <p className="mt-1 text-sm leading-relaxed">{story}</p> : null}
      {results ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{results}</p> : null}
    </div>
  );
}

export function PlayerProofBlock({
  player: p,
  sessions,
}: {
  player: PlayerProof;
  sessions?: number;
}) {
  return (
    <div>
      <p className="text-sm">
        {p.display_name}
        {sessions != null ? (
          <span className="text-muted-foreground"> · {sessions} sessions</span>
        ) : null}
      </p>
      <div className="mt-2">
        <PlayerSportCards player={p} compact />
      </div>
      {p.coach_note ? <p className="mt-1 text-xs text-muted-foreground">“{p.coach_note}”</p> : null}
    </div>
  );
}
