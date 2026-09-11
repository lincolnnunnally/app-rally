import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
        const proto = host.includes("127.") || host.startsWith("localhost") ? "http" : "https";
        const origin = host ? `${proto}://${host}` : "";
        const body = `User-agent: *
Allow: /
Allow: /where
Allow: /join
Allow: /list-a-court
Disallow: /app
Disallow: /api
Disallow: /login
Sitemap: ${origin}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
