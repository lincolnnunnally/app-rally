import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { absoluteUrl, OG_IMAGE, pageHead, SITE_NAME, SITE_URL } from "@/lib/seo";
import { PublicChrome } from "@/components/public-chrome";
import { getArticle } from "@/lib/articles-server";
import { formatArticleDate as formatDate } from "@/lib/article-date";

export const Route = createFileRoute("/articles/$slug")({
  loader: async ({ params }) => {
    const article = await getArticle({ data: { slug: params.slug } });
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData: a }) => {
    if (!a) {
      return pageHead({
        title: "Article not found | Rally",
        description: "This article is not published.",
        path: "/articles",
        noindex: true,
      });
    }
    const path = `/articles/${a.slug}`;
    const description = (a.seo_description || a.excerpt || `${a.title}. A coaching article on Rally.`).slice(0, 300);
    return pageHead({
      title: `${a.seo_title || a.title} | Rally`,
      description,
      path,
      ogType: "article",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description,
          url: absoluteUrl(path),
          mainEntityOfPage: absoluteUrl(path),
          image: OG_IMAGE,
          ...(a.published_at ? { datePublished: a.published_at } : {}),
          ...(a.updated_at || a.published_at
            ? { dateModified: a.updated_at || a.published_at }
            : {}),
          ...(a.tags.length ? { keywords: a.tags.join(", ") } : {}),
          author: { "@type": "Person", name: a.author },
          publisher: { "@id": `${SITE_URL}/#org`, "@type": "Organization", name: SITE_NAME },
        },
      ],
    });
  },
  notFoundComponent: ArticleNotFound,
  component: ArticlePage,
});

function ArticleNotFound() {
  return (
    <PublicChrome>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="mt-2 font-display text-4xl">Article not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That article isn't published.{" "}
          <Link to="/articles" className="text-foreground underline underline-offset-4">
            See all coaching articles
          </Link>
          .
        </p>
      </main>
    </PublicChrome>
  );
}

function ArticlePage() {
  const a = Route.useLoaderData();
  const date = formatDate(a.published_at);
  return (
    <PublicChrome>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        <Link to="/articles" className="text-xs text-muted-foreground hover:text-foreground">
          Coaching articles
        </Link>
        <article className="mt-4">
          <h1 className="font-display text-4xl">{a.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {a.author}
            {date ? ` · ${date}` : ""}
          </p>
          {a.scripture_ref ? (
            <p className="mt-1 text-sm text-muted-foreground italic">{a.scripture_ref}</p>
          ) : null}
          <div
            className="article-body mt-8 space-y-4 text-base leading-relaxed text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h4]:font-semibold [&_hr]:my-8 [&_hr]:border-border [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6"
            // Safe: renderMarkdown escapes all source text before adding markup.
            dangerouslySetInnerHTML={{ __html: a.body_html }}
          />
          {a.tags.length ? (
            <p className="mt-10 text-xs text-muted-foreground">{a.tags.join(" · ")}</p>
          ) : null}
        </article>
      </main>
    </PublicChrome>
  );
}
