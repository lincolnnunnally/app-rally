import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { PublicChrome } from "@/components/public-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FacilityPhotoPicker } from "@/components/facility-place";
import { BOOKING_MODES, COURT_KINDS } from "@/lib/rally";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { submitCourt } from "@/lib/rally-server";

export const Route = createFileRoute("/list-a-court")({
  head: () => ({
    meta: [
      { title: "List a tennis or pickleball court on Rally" },
      {
        name: "description",
        content:
          "Add a rec, club, school, or public court to Rally. Once it is listed, players can reserve a window or Rally will hold it for a call to the facility.",
      },
    ],
    links: [{ rel: "canonical", href: "/list-a-court" }],
  }),
  component: ListACourt,
});

function ListACourt() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await submitCourt({
        data: {
          name: String(f.get("name")),
          address: String(f.get("address")),
          city: String(f.get("city") || "Vidalia"),
          sports: String(f.get("sports")),
          court_count: Number(f.get("court_count") || 1),
          indoor: f.get("indoor") === "on",
          lights: f.get("lights") === "on",
          restrooms: f.get("restrooms") === "on",
          kind: String(f.get("kind")) as "public" | "club" | "school" | "private",
          booking_mode: String(f.get("booking_mode")) as "claim" | "call" | "walkup",
          player_fee: f.get("player_fee") ? Number(f.get("player_fee")) : 0,
          manager_name: String(f.get("manager_name") || "") || undefined,
          manager_phone: String(f.get("manager_phone") || "") || undefined,
          typical_hours: String(f.get("typical_hours") || "") || undefined,
          rules: String(f.get("rules") || "") || undefined,
          photo_data: photo || undefined,
        },
      });
      if (!result.public || !result.slug) {
        toast.success(
          result.created
            ? "Private court is on Rally. Join to reserve it from your board."
            : "That court is already on Rally.",
        );
        await navigate({ to: "/login", search: { ref: undefined, coach: undefined, mode: "up" } });
        return;
      }
      toast.success(
        result.created
          ? result.booking_mode === "claim"
            ? "Listed. Rally is taking reservations on this court."
            : result.booking_mode === "call"
              ? "Listed. Rally will hold a window, then you call the facility."
              : "Listed as walk-up. No reservation — the listing is public."
          : "That court is already listed.",
      );
      await navigate({
        to: "/where/$city/$slug",
        params: { city: result.citySlug, slug: result.slug },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not list the court.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicChrome>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <Link to="/where" className="text-xs text-muted-foreground hover:text-foreground">
          All listed courts
        </Link>
        <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground uppercase">Facilities</p>
        <h1 className="mt-2 font-display text-4xl">List a court on Rally</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Rally is the app. The rec, the club, the school — those are facilities listed on it. Add
          one and Rally starts taking reservations, or holding a window for a call, the same day.
          Listing is free. It does require an account so the board is not anonymous spam.
        </p>

        {!isPending && !user ? (
          <Card className="mt-8">
            <p className="font-display text-xl">Join to list a court</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account, then come back here. The listing form is the same for recs, clubs,
              schools, and a court you already have a key to.
            </p>
            <Button asChild className="mt-4">
              <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }}>
                Create an account
              </Link>
            </Button>
          </Card>
        ) : null}

        {user ? (
        <Card className="mt-8">
          <form className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
            <FacilityPhotoPicker photo={photo} onChange={setPhoto} />
            <Field label="Court or facility name">
              <Input name="name" required placeholder="Meadows neighborhood courts" />
            </Field>
            <Field label="Address">
              <Input name="address" required placeholder="Street, complex, or school" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input name="city" defaultValue="Vidalia" required />
              </Field>
              <Field label="How many courts">
                <Input name="court_count" type="number" defaultValue={2} min={1} max={24} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <Select name="kind" defaultValue="public">
                  {COURT_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sports">
                <Select name="sports" defaultValue="pickleball">
                  <option value="pickleball">Pickleball</option>
                  <option value="tennis">Tennis</option>
                  <option value="tennis,pickleball">Both</option>
                </Select>
              </Field>
            </div>
            <Field label="How Rally should handle bookings">
              <Select name="booking_mode" defaultValue="claim">
                <option value="claim">Rally takes the reservation</option>
                <option value="call">Hold it here, then call the facility</option>
                <option value="walkup">Walk-up — no reservation</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                {BOOKING_MODES.find((m) => m.value === "claim")?.label}. Default is Rally takes the
                window so play can start without a group chat.
              </p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Who books it">
                <Input name="manager_name" placeholder="Parks & Rec, pro shop, AD" />
              </Field>
              <Field label="Phone">
                <Input name="manager_phone" placeholder="912-555-0100" />
              </Field>
            </div>
            <Field label="Hours">
              <Input name="typical_hours" placeholder="Evenings and weekends, lights till 10" />
            </Field>
            <Field label="Player fee $ (0 if free)">
              <Input name="player_fee" type="number" min={0} defaultValue={0} />
            </Field>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="flex h-11 items-center gap-2">
                <input type="checkbox" name="lights" /> Lights
              </label>
              <label className="flex h-11 items-center gap-2">
                <input type="checkbox" name="restrooms" /> Restrooms
              </label>
              <label className="flex h-11 items-center gap-2">
                <input type="checkbox" name="indoor" /> Indoor
              </label>
            </div>
            <Field label="Rules / how to use it">
              <Textarea name="rules" placeholder="Open play nights, coaching rules, anything a stranger should know." />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Listing…" : "List this court"}
            </Button>
          </form>
        </Card>
        ) : null}
      </main>
    </PublicChrome>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
