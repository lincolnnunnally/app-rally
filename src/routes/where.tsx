import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/public-chrome";

export const Route = createFileRoute("/where")({
  component: WhereLayout,
});

function WhereLayout() {
  return (
    <PublicChrome>
      <Outlet />
    </PublicChrome>
  );
}
