import { createFileRoute } from "@tanstack/react-router";
import { buildCalendar, isCalendarToken } from "@/lib/calendar";
import { findCalendarUserId, loadVisibleLessons } from "@/lib/calendar-server";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/calendar/{$token}.ics")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = tokenFrom(request, params);
        if (!isCalendarToken(token)) return notFound();
        try {
          const sql = await getSql();
          const userId = await findCalendarUserId(sql, token);
          if (!userId) return notFound();
          const now = new Date();
          const lessons = await loadVisibleLessons(sql, userId, "any", now);
          const body = buildCalendar(lessons, {
            viewerId: userId,
            now,
            origin: originFrom(request),
          });
          return new Response(body, {
            status: 200,
            headers: {
              "content-type": "text/calendar; charset=utf-8",
              "content-disposition": 'inline; filename="rally.ics"',
              "cache-control": "private, no-store",
            },
          });
        } catch (err) {
          console.error("[calendar]", err instanceof Error ? err.message : "feed failed");
          return new Response("Calendar unavailable", {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function tokenFrom(request: Request, params: { token?: string }): string {
  const fromParams = params.token ? decodeURIComponent(params.token) : "";
  if (fromParams) return fromParams.replace(/\.ics$/i, "");
  const path = new URL(request.url).pathname;
  const match = /\/api\/calendar\/([^/]+)\.ics$/i.exec(path);
  return match ? decodeURIComponent(match[1]!) : "";
}

function originFrom(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (!host) return "";
  const proto = host.includes("127.") || host.startsWith("localhost") ? "http" : "https";
  const forwarded = request.headers.get("x-forwarded-proto");
  return `${forwarded || proto}://${host}`;
}
