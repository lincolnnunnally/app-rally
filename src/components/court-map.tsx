import type { Court } from "@/lib/rally";
import { cn } from "@/lib/utils";

const WEST = -82.5;
const EAST = -82.28;
const SOUTH = 32.16;
const NORTH = 32.26;

function pinLabel(c: Court) {
  if ((c.name.includes("Vidalia Rec") || c.name.includes("Ed Smith")) && c.name.includes("Pickleball"))
    return "Rec PB";
  if ((c.name.includes("Vidalia Rec") || c.name.includes("Ed Smith")) && c.name.includes("Tennis"))
    return "Rec tennis";
  if (c.name.includes("Vidalia High")) return "High school";
  if (c.city === "Lyons") return "Lyons";
  const first = c.name.split(/[—–-]/)[0]?.trim() ?? c.name;
  return first.length > 16 ? `${first.slice(0, 14)}…` : first;
}

function pos(lat: number, lng: number, bump: number) {
  const x = ((lng - WEST) / (EAST - WEST)) * 100 + (bump % 3) * 3.2;
  const y = ((NORTH - lat) / (NORTH - SOUTH)) * 100 + Math.floor(bump / 3) * 7;
  return {
    left: `${Math.min(92, Math.max(6, x))}%`,
    top: `${Math.min(88, Math.max(10, y))}%`,
  };
}

export function CourtMap({
  courts,
  activeId,
  onSelect,
}: {
  courts: Court[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const pins = courts.filter((c) => c.lat != null && c.lng != null && !c.is_other);
  const seen = new Map<string, number>();

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <svg viewBox="0 0 640 280" className="h-56 w-full text-line md:h-72" aria-hidden>
        <rect width="640" height="280" fill="currentColor" className="text-background" />
        <path
          d="M40 40 H600 V240 H40 Z"
          fill="none"
          stroke="currentColor"
          className="text-line"
          strokeWidth="1"
        />
        <path d="M40 140 H600 M320 40 V240" stroke="currentColor" className="text-line/50" strokeWidth="0.6" />
        <path d="M180 40 V240 M460 40 V240" stroke="currentColor" className="text-line/30" strokeWidth="0.5" />
        <text x="200" y="168" fill="currentColor" className="text-muted-foreground" fontSize="11" fontFamily="Outfit, sans-serif">
          Vidalia
        </text>
        <text x="470" y="188" fill="currentColor" className="text-muted-foreground" fontSize="11" fontFamily="Outfit, sans-serif">
          Lyons
        </text>
        <text x="48" y="32" fill="currentColor" className="text-muted-foreground" fontSize="9" letterSpacing="2" fontFamily="Outfit, sans-serif">
          TOOMBS COUNTY
        </text>
      </svg>
      {pins.map((c) => {
        const key = `${Number(c.lat).toFixed(3)},${Number(c.lng).toFixed(3)}`;
        const bump = seen.get(key) ?? 0;
        seen.set(key, bump + 1);
        const p = pos(c.lat!, c.lng!, bump);
        const on = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            style={p}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] tracking-wide uppercase transition-colors duration-150",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : c.status === "coming"
                  ? "border-warn/40 bg-card text-warn"
                  : "border-border bg-card text-foreground hover:border-primary",
            )}
          >
            {pinLabel(c)}
          </button>
        );
      })}
    </div>
  );
}
