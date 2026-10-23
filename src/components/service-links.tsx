import { SERVICE_PAGES } from "@/lib/seo";

/** Plain links to every public service page, so people and crawlers can reach each one. */
export function ServiceLinks({
  className = "flex flex-wrap justify-center gap-x-4 gap-y-1",
  itemClassName = "inline-flex min-h-11 items-center hover:text-foreground",
  exclude,
}: {
  className?: string;
  itemClassName?: string;
  exclude?: string;
}) {
  return (
    <nav aria-label="What Rally does">
      <ul className={className}>
        {SERVICE_PAGES.filter((p) => p.path !== exclude).map((p) => (
          <li key={p.path} className="contents">
            <a href={p.path} className={itemClassName}>
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
