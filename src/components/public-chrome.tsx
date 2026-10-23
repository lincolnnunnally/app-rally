import { Link } from "@tanstack/react-router";
import { RallyWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { ReactNode } from "react";
import { ServiceLinks } from "@/components/service-links";

export function PublicChrome({
  children,
  joinSearch,
}: {
  children: ReactNode;
  joinSearch?: { ref?: string; coach?: string };
}) {
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-foreground">
          <RallyWordmark />
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/where">Find a court</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/list-a-court">List a court</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/coaches">Find a coach</Link>
          </Button>
          {!isPending && user ? (
            <Button asChild>
              <Link to="/app">Open Rally</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link
                to="/login"
                search={{ ref: joinSearch?.ref, coach: joinSearch?.coach, mode: "up" }}
              >
                Join
              </Link>
            </Button>
          )}
        </nav>
      </header>
      {children}
      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        <ServiceLinks className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm" />
        Rally — tennis and pickleball. Eastern time.
        {" · "}
        <Link to="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        {" · "}
        <Link to="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
    </div>
  );
}
