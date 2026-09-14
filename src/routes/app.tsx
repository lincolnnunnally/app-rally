import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RallyProvider } from "@/lib/rally-context";
import { AppShell } from "@/components/app-shell";
import { Onboarding } from "@/components/onboarding";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { rememberAppNext } from "@/lib/rally";
import { bootstrap } from "@/lib/rally-server";

export const Route = createFileRoute("/app")({
  component: AppGate,
});

function AppGate() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrap(),
    enabled: !!user,
  });

  if (isPending) return <ShellSkeleton />;
  if (!user) {
    rememberAppNext(pathname);
    return <RedirectToSignIn />;
  }
  if (boot.isPending) return <ShellSkeleton />;
  if (boot.isError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Could not load Rally. {boot.error instanceof Error ? boot.error.message : ""}
        </p>
      </div>
    );
  }

  const data = boot.data;
  if (!data.profile || !data.profile.onboarded) {
    return (
      <Onboarding
        existing={data.profile}
        onDone={(profile) => {
          qc.setQueryData(["bootstrap"], { ...data, profile });
        }}
      />
    );
  }

  return (
    <RallyProvider value={{ profile: data.profile, courts: data.courts }}>
      <AppShell />
    </RallyProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-background p-6">
      <Skeleton className="h-10 w-40" />
      <div className="mt-8 grid gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
