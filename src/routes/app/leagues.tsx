import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leagues")({ component: LeagueLayout });

function LeagueLayout() {
  return <Outlet />;
}
