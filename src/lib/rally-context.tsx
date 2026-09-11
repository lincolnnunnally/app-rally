import { createContext, useContext, type ReactNode } from "react";
import type { Court, Profile } from "@/lib/rally";

export type RallyContextValue = { profile: Profile; courts: Court[] };

const RallyContext = createContext<RallyContextValue | null>(null);

export function RallyProvider({
  value,
  children,
}: {
  value: RallyContextValue;
  children: ReactNode;
}) {
  return <RallyContext.Provider value={value}>{children}</RallyContext.Provider>;
}

export function useRally() {
  const ctx = useContext(RallyContext);
  if (!ctx) throw new Error("useRally must be used under RallyProvider");
  return ctx;
}
