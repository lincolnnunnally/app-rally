import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /
Allow: /where
Allow: /join
Allow: /list-a-court
Allow: /coaches
Allow: /coach/
Allow: /open-play
Allow: /find-a-partner
Allow: /leagues
Allow: /get-better
Allow: /for-coaches
Allow: /privacy
Allow: /terms
Disallow: /app
Disallow: /api
Disallow: /login
Sitemap: ${SITE_URL}/sitemap.xml
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
