import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Onboarding } from "@/components/onboarding";
import { useRally } from "@/lib/rally-context";

export const Route = createFileRoute("/app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile } = useRally();
  const qc = useQueryClient();
  return (
    <Onboarding
      existing={profile}
      onDone={() => {
        void qc.invalidateQueries({ queryKey: ["bootstrap"] });
      }}
    />
  );
}
