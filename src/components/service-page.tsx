import type { ReactNode } from "react";
import { PublicChrome } from "@/components/public-chrome";
import { ServiceLinks } from "@/components/service-links";
import { Button } from "@/components/ui/button";

/**
 * One public page per thing Rally does: who it is for, what you get, how it works,
 * and a way in. Copy lives in each route so it stays next to the feature it describes.
 */
export function ServicePage({
  eyebrow,
  title,
  intro,
  whoFor,
  youGet,
  steps,
  extra,
  cta,
  path,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  whoFor: string[];
  youGet: string[];
  steps: string[];
  extra?: ReactNode;
  cta: { href: string; label: string }[];
  path: string;
}) {
  return (
    <PublicChrome>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {cta.map((c, i) => (
            <Button key={c.href} asChild variant={i === 0 ? "default" : "outline"}>
              <a href={c.href}>{c.label}</a>
            </Button>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="font-display text-2xl">Who it is for</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {whoFor.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">What you get</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {youGet.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
            {steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </section>

        {extra}

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-2xl">More on Rally</h2>
          <ServiceLinks
            exclude={path}
            className="mt-3 grid gap-2 sm:grid-cols-2"
            itemClassName="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
          />
        </section>
      </main>
    </PublicChrome>
  );
}
