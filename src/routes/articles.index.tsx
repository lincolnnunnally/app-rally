import { createFileRoute, Link } from "@tanstack/react-router";
import { absoluteUrl, pageHead, SITE_NAME } from "@/lib/seo";
import { PublicChrome } from "@/components/public-chrome";
import { Card } from "@/components/ui/card";
import { listArticles } from "@/lib/articles-server";
import { formatArticleDate as formatDate } from "@/lib/article-date";

const DESCRIPTION =
  "Coaching articles for tennis, pickleball, and life coaches: how to explain, correct, and encourage so your player understands and grows.";

export const Route = createFileRoute("/articles/")({
  loader: async () => listArticles(),
  head: () =>
    pageHead({
      title: "Coaching articles | Rally",
      description: DESCRIPTION,
      path: "/articles",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Coaching articles",
          description: DESCRIPTION,
          url: absoluteUrl("/articles"),
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
        },
      ],
    }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const articles = Route.useLoaderData();
  return (
    <PublicChrome>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Articles</p>
        <h1 className="mt-2 font-display text-4xl">Coaching articles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For coaches on the court and in life. How to explain, correct, and encourage so the
          person in front of you understands and grows.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {articles.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                No articles published yet. The first ones are on the way.
              </p>
            </Card>
          ) : (
            articles.map((a) => (
              <Link
                key={a.slug}
                to="/articles/$slug"
                params={{ slug: a.slug }}
                className="block rounded-xl transition-colors hover:bg-muted/40"
              >
                <Card>
                  <h2 className="font-display text-2xl text-foreground">{a.title}</h2>
                  {a.excerpt ? (
                    <p className="mt-1 text-sm text-muted-foreground">{a.excerpt}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {a.author}
                    {formatDate(a.published_at) ? ` · ${formatDate(a.published_at)}` : ""}
                  </p>
                </Card>
              </Link>
            ))
          )}
        </div>
      </main>
    </PublicChrome>
  );
}
