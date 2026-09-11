import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/where/$city")({
  component: CityLayout,
});

function CityLayout() {
  return <Outlet />;
}
