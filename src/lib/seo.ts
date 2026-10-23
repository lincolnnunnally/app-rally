/**
 * Search and share metadata. Canonical URLs always use the production host so a preview,
 * a vercel.app alias, or a proxy never becomes the indexed address.
 */
export const SITE_URL = "https://rally.unitedundergod.org";
export const SITE_NAME = "Rally";
export const OG_IMAGE = `${SITE_URL}/og.jpg`;

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Site-wide: who publishes Rally. Only facts the app states. */
export const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon.svg`,
  description: "Tennis and pickleball, managed in one place.",
  parentOrganization: { "@type": "Organization", name: "United Under God, Inc." },
};

type Meta = Record<string, unknown>;

/**
 * Title, description, canonical, Open Graph and Twitter tags for one public page.
 * `jsonLd` entries are emitted as <script type="application/ld+json"> by HeadContent.
 */
export function pageHead({
  title,
  description,
  path,
  noindex = false,
  jsonLd = [],
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: object[];
}): { meta: Meta[]; links: { rel: string; href: string }[] } {
  const url = absoluteUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: OG_IMAGE },
      ...(noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
      ...jsonLd.map((ld) => ({ "script:ld+json": ld })),
    ],
    links: noindex ? [] : [{ rel: "canonical", href: url }],
  };
}

/** A noindex tag for private or signed-in pages. */
export const NOINDEX = { name: "robots", content: "noindex, nofollow" };

/** schema.org Service for one thing Rally does. No ratings, no invented facts. */
export function serviceLd({
  name,
  description,
  path,
  serviceType,
  audience,
  offers,
}: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
  audience?: string;
  offers?: object;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    provider: { "@id": `${SITE_URL}/#org`, "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
    ...(audience ? { audience: { "@type": "Audience", audienceType: audience } } : {}),
    ...(offers ? { offers } : {}),
  };
}

/** Every public service page, in the order they appear in the footer. */
export const SERVICE_PAGES = [
  { path: "/where", label: "Find a tennis or pickleball court" },
  { path: "/open-play", label: "Open play and round robins" },
  { path: "/find-a-partner", label: "Find a partner at your level" },
  { path: "/coaches", label: "Book a coach or lessons" },
  { path: "/leagues", label: "Leagues and ladders" },
  { path: "/get-better", label: "Get unstuck and play calmer" },
  { path: "/for-coaches", label: "For coaches: a coach desk" },
  { path: "/list-a-court", label: "For facilities: list a court" },
] as const;
