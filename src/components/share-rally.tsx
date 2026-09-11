import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RALLY, money, sharePath } from "@/lib/rally";

export function ShareRally({
  code,
  creditCents,
}: {
  code: string | null;
  creditCents: number;
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const path = sharePath(code);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function nativeShare() {
    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: "Rally",
        text: "Rally — tennis and pickleball. Find a court, reserve, play.",
        url,
      });
    } catch {
      /* dismissed */
    }
  }

  return (
    <Card>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Share Rally</p>
      <h2 className="mt-2 font-display text-2xl">Your link does the promoting</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Players, coaches, facilities — same tool. When someone joins from your link and a fee
        actually moves, you get {RALLY.referralPct}% of Rally’s take as credit off your next Rally
        fee. A $0 court still stays $0.
      </p>
      <p className="mt-3 break-all font-mono text-sm">{url}</p>
      {creditCents > 0 ? (
        <p className="mt-2 text-sm">Share credit on the books: {money(creditCents)}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void nativeShare()}>
          Share
        </Button>
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Card>
  );
}

export function ShareListing({ href, label }: { href: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? href : `${window.location.origin}${href}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Listing link copied.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function nativeShare() {
    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: label, text: `${label} on Rally.`, url });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => void nativeShare()}>
        Share this listing
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
