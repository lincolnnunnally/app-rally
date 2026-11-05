import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readSupabaseAnonConfig } from "@/lib/auth/gotrue-password";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Coaching articles from the shared ecosystem table `public.lpl_articles`
 * (LPL Supabase). Read server-side through PostgREST with the public anon key;
 * row-level security lets anon see only status = 'published'. We filter on that
 * too, so a policy change can never leak a draft here.
 */

const APP = "rally";

export type ArticleSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  author: string;
  published_at: string | null;
};

export type Article = ArticleSummary & {
  body_html: string;
  scripture_ref: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string | null;
};

const SUMMARY_COLS = "slug,title,excerpt,tags,author,published_at";
const DETAIL_COLS = `${SUMMARY_COLS},body_md,scripture_ref,seo_title,seo_description,updated_at`;

async function query<T>(params: URLSearchParams): Promise<T[]> {
  const config = readSupabaseAnonConfig();
  if (!config) {
    console.error("[articles] SUPABASE_URL / SUPABASE_ANON_KEY not set");
    return [];
  }
  params.set("app", `eq.${APP}`);
  params.set("status", "eq.published");
  const res = await fetch(`${config.url}/rest/v1/lpl_articles?${params.toString()}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.error("[articles] PostgREST", res.status, await res.text().catch(() => ""));
    throw new Error("Articles are unavailable right now.");
  }
  return (await res.json()) as T[];
}

function normalize<T extends { tags?: string[] | null; author?: string | null }>(row: T) {
  return { ...row, tags: row.tags ?? [], author: row.author || "Lincoln Nunnally" };
}

export async function loadArticleSummaries(): Promise<ArticleSummary[]> {
  const rows = await query<ArticleSummary>(
    new URLSearchParams({
      select: SUMMARY_COLS,
      order: "published_at.desc.nullslast,publish_at.desc.nullslast",
      limit: "200",
    }),
  );
  return rows.map(normalize);
}

export const listArticles = createServerFn({ method: "GET" }).handler(async () =>
  loadArticleSummaries(),
);

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<Article | null> => {
    const rows = await query<ArticleSummary & {
      body_md: string | null;
      scripture_ref: string | null;
      seo_title: string | null;
      seo_description: string | null;
      updated_at: string | null;
    }>(new URLSearchParams({ select: DETAIL_COLS, slug: `eq.${data.slug}`, limit: "1" }));
    const row = rows[0];
    if (!row) return null;
    const { body_md, ...rest } = normalize(row);
    return { ...rest, body_html: renderMarkdown(body_md ?? "") };
  });
