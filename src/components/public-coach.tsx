import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileFace } from "@/components/profile-face";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PublicCoach } from "@/lib/coach-public-server";
import { absoluteRallyUrl, coachBookPath, coachProfilePath } from "@/lib/coach-links";
import { rallyQrSrc } from "@/lib/pay-href";
import { money, sportLabel } from "@/lib/rally";

const UNIT: Record<string, string> = { hour: "hr", session: "session", month: "mo", week: "wk" };

export function PublicCoachCard({
  coach: c,
  full = false,
}: {
  coach: PublicCoach;
  full?: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <ProfileFace name={c.display_name} photo={c.photo_data} size={full ? undefined : "sm"} />
        {full ? (
          <h1 className="font-display text-3xl">{c.display_name}</h1>
        ) : (
          <h2 className="font-display text-xl">
            <Link to="/coach/$code" params={{ code: c.code }} className="hover:underline">
              {c.display_name}
            </Link>
          </h2>
        )}
        {c.accepting ? <Badge variant="good">Accepting</Badge> : <Badge>Waitlist</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {c.city}, GA
        {c.headline ? ` · ${c.headline}` : ""}
        {c.from_cents != null ? ` · from ${money(c.from_cents)}` : ""}
        {c.years_coaching != null ? ` · ${c.years_coaching} yrs coaching` : ""}
        {c.playing_level ? ` · plays ${c.playing_level}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.plays_tennis ? <Badge variant="tennis">Tennis</Badge> : null}
        {c.plays_pickleball ? <Badge variant="pickleball">Pickleball</Badge> : null}
        {c.teaching_beginner ? <Badge variant="outline">Beginners</Badge> : null}
        {c.teaching_advanced ? <Badge variant="outline">Advanced / stalled</Badge> : null}
        {c.teaching_juniors ? <Badge variant="outline">Juniors</Badge> : null}
      </div>
      {c.philosophy ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.philosophy}</p>
      ) : null}
      {full && c.bio && c.bio !== c.philosophy ? (
        <p className="mt-3 text-sm leading-relaxed">{c.bio}</p>
      ) : null}
      {c.specializations ? <p className="mt-2 text-sm">{c.specializations}</p> : null}
      {full && c.availability ? (
        <p className="mt-2 text-sm text-muted-foreground">Usually available: {c.availability}</p>
      ) : null}
      {c.services.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {c.services.map((s) => (
            <li
              key={s.id}
              className="flex justify-between gap-3 border-t border-border pt-1 first:border-0 first:pt-0"
            >
              <span>
                {s.name}
                <span className="text-muted-foreground"> · {sportLabel(s.sport)}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {money(s.price_cents)}/{UNIT[s.unit] ?? s.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <a href={coachBookPath(c.code)}>Request a lesson</a>
        </Button>
        {!full ? (
          <Button variant="outline" asChild>
            <Link to="/coach/$code" params={{ code: c.code }}>
              Profile
            </Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function CoachLinkQr({
  label,
  path,
  fileName,
}: {
  label: string;
  path: string;
  fileName: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = absoluteRallyUrl(path);
  const qr = rallyQrSrc(url);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`${label} copied.`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy.");
    }
  }
  async function share() {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: label, url });
    } catch {
      /* dismissed */
    }
  }
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all font-mono text-sm">{url}</p>
      <img
        src={qr}
        alt={`QR code: ${label}`}
        width={180}
        height={180}
        className="mt-3 rounded-md border border-border bg-white p-2"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => void share()}>
          Share
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <a href={qr} download={fileName} target="_blank" rel="noreferrer">
            Save QR
          </a>
        </Button>
      </div>
    </div>
  );
}

export function CoachPublicLinks({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <Card>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Public page</p>
      <h2 className="mt-2 font-display text-2xl">Your profile and booking link</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Anyone can open these without an account. The profile shows your public prices and a Request
        a lesson button. The booking link goes straight to the request form; requests land on this
        desk for you to confirm. You are also listed at{" "}
        <a className="underline" href="/coaches">
          /coaches
        </a>
        .
      </p>
      <CoachLinkQr
        label="Public profile"
        path={coachProfilePath(code)}
        fileName={`${code}-profile-qr.png`}
      />
      <CoachLinkQr
        label="Booking link"
        path={coachBookPath(code)}
        fileName={`${code}-booking-qr.png`}
      />
    </Card>
  );
}
