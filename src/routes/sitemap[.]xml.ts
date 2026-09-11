import { createFileRoute } from "@tanstack/react-router";
import { catalogCities, catalogCity } from "@/lib/rally-server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
        const proto = host.includes("127.") || host.startsWith("localhost") ? "http" : "https";
        const origin = host ? `${proto}://${host}` : "";
        const cities = await catalogCities();
        const urls = [`${origin}/`, `${origin}/where`, `${origin}/join`, `${origin}/list-a-court`];
        for (const city of cities) {
          urls.push(`${origin}/where/${city.slug}`);
          const detail = await catalogCity({ data: { city: city.slug } });
          for (const court of detail?.courts ?? []) {
            if (court.slug) urls.push(`${origin}/where/${city.slug}/${court.slug}`);
          }
        }
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`,
  )
  .join("\n")}
</urlset>
`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
