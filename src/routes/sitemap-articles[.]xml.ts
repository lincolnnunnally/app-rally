import { createFileRoute } from "@tanstack/react-router";
import { loadArticleSummaries } from "@/lib/articles-server";
import { SITE_URL } from "@/lib/seo";

/** Generated from the database: every published Rally coaching article. Listed in robots.txt. */
export const Route = createFileRoute("/sitemap-articles.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = SITE_URL;
        let articles: Awaited<ReturnType<typeof loadArticleSummaries>> = [];
        try {
          articles = await loadArticleSummaries();
        } catch {
          // Articles unavailable: still serve a valid sitemap with the index page.
        }
        const entries = [
          `  <url><loc>${origin}/articles</loc><changefreq>weekly</changefreq></url>`,
          ...articles.map((a) => {
            const lastmod = a.published_at ? `<lastmod>${a.published_at.slice(0, 10)}</lastmod>` : "";
            return `  <url><loc>${origin}/articles/${encodeURIComponent(a.slug)}</loc>${lastmod}</url>`;
          }),
        ];
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
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
