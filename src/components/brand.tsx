import { cn } from "@/lib/utils";

export function RallyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-primary", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 24 L14 8 M10.5 16.5 C12 20 16 21 19 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="12.5" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18.4 12.5 h4.2 M20.5 10.4 v4.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function RallyWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <RallyMark className="size-7" />
      <span className="font-display text-xl font-medium tracking-tight">Rally</span>
    </span>
  );
}
