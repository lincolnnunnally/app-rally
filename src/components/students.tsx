import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultLessonWhen } from "@/lib/lesson-notes";
import { requestLesson } from "@/lib/rally-server";
import { claimPath } from "@/lib/students";
import { finishStudentProfile, registerChild } from "@/lib/students-server";

export type HouseholdChild = {
  user_id: string;
  display_name: string;
  city: string;
  phone: string | null;
  bio: string | null;
  availability: string | null;
  plays_tennis: boolean;
  plays_pickleball: boolean;
  tennis_level: string | null;
  pickleball_level: string | null;
  dupr: string | null;
  utr: string | null;
  experience: string | null;
  public_fields: string[];
  coach_user_ids: string[];
};

export function CopyClaimLink({ code, name }: { code: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const path = claimPath(code);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`Claim link for ${name} copied.`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="mt-2">
      <p className="break-all font-mono text-xs text-muted-foreground">{url}</p>
      <Button className="mt-2" type="button" size="sm" variant="secondary" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy claim link"}
      </Button>
    </div>
  );
}

export function RegisterChildForm({ onSaved }: { onSaved: () => void }) {
  const save = useMutation({
    mutationFn: (display_name: string) => registerChild({ data: { display_name } }),
    onSuccess: (row) => {
      toast.success(`${row.display_name} is on your account.`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("display_name") || "").trim();
        if (!name) return;
        save.mutate(name);
        e.currentTarget.reset();
      }}
    >
      <Field label="New child">
        <Input name="display_name" required placeholder="First name" />
      </Field>
      <Button type="submit" size="sm" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Register child"}
      </Button>
    </form>
  );
}

export function FinishStudentForm({ child, onSaved }: { child: HouseholdChild; onSaved: () => void }) {
  const publicSet = new Set(child.public_fields);
  const save = useMutation({
    mutationFn: (data: Parameters<typeof finishStudentProfile>[0]["data"]) =>
      finishStudentProfile({ data }),
    onSuccess: () => {
      toast.success("Profile saved.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const on = (name: string) => f.get(name) === "on";
        save.mutate({
          user_id: child.user_id,
          display_name: String(f.get("display_name") || ""),
          city: String(f.get("city") || "Vidalia"),
          phone: String(f.get("phone") || "") || undefined,
          bio: String(f.get("bio") || "") || undefined,
          availability: String(f.get("availability") || "") || undefined,
          plays_tennis: on("plays_tennis"),
          plays_pickleball: on("plays_pickleball"),
          tennis_level: String(f.get("tennis_level") || "") || undefined,
          pickleball_level: String(f.get("pickleball_level") || "") || undefined,
          dupr: String(f.get("dupr") || "") || undefined,
          utr: String(f.get("utr") || "") || undefined,
          experience: String(f.get("experience") || "") || undefined,
          public_bio: on("public_bio"),
          public_levels: on("public_levels"),
          public_ratings: on("public_ratings"),
          public_experience: on("public_experience"),
          public_photo: on("public_photo"),
          public_availability: on("public_availability"),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="display_name" required defaultValue={child.display_name} />
        </Field>
        <Field label="City">
          <Input name="city" required defaultValue={child.city} />
        </Field>
      </div>
      <Field label="Phone (always private)">
        <Input name="phone" defaultValue={child.phone ?? ""} placeholder="Only you" />
      </Field>
      <Field label="Bio">
        <Textarea name="bio" defaultValue={child.bio ?? ""} />
      </Field>
      <Field label="When they can play">
        <Input name="availability" defaultValue={child.availability ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="plays_pickleball" defaultChecked={child.plays_pickleball} />
          Pickleball
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="plays_tennis" defaultChecked={child.plays_tennis} />
          Tennis
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pickleball level">
          <Input name="pickleball_level" defaultValue={child.pickleball_level ?? ""} />
        </Field>
        <Field label="Tennis level">
          <Input name="tennis_level" defaultValue={child.tennis_level ?? ""} />
        </Field>
        <Field label="DUPR">
          <Input name="dupr" defaultValue={child.dupr ?? ""} />
        </Field>
        <Field label="UTR">
          <Input name="utr" defaultValue={child.utr ?? ""} />
        </Field>
      </div>
      <Field label="Experience">
        <Textarea name="experience" defaultValue={child.experience ?? ""} />
      </Field>
      <fieldset className="grid gap-2 text-sm">
        <legend className="text-xs tracking-widest text-muted-foreground uppercase">
          Public on the card
        </legend>
        <p className="text-xs text-muted-foreground">
          Name, city, and sports stay visible. Phone stays private. Coach notes stay with the coach.
        </p>
        <PublicCheck name="public_bio" label="Bio" defaultChecked={publicSet.has("bio")} />
        <PublicCheck name="public_levels" label="Levels" defaultChecked={publicSet.has("levels")} />
        <PublicCheck name="public_ratings" label="DUPR and UTR" defaultChecked={publicSet.has("ratings")} />
        <PublicCheck name="public_experience" label="Experience" defaultChecked={publicSet.has("experience")} />
        <PublicCheck name="public_photo" label="Photo" defaultChecked={publicSet.has("photo")} />
        <PublicCheck
          name="public_availability"
          label="When they can play"
          defaultChecked={publicSet.has("availability")}
        />
      </fieldset>
      <Button type="submit" size="sm" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function ScheduleChildForm({
  children,
  coaches,
  courts,
  defaultChildId,
  onSaved,
}: {
  children: { user_id: string; display_name: string }[];
  coaches: { user_id: string; display_name: string }[];
  courts: { id: number; name: string }[];
  defaultChildId?: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: Parameters<typeof requestLesson>[0]["data"]) => requestLesson({ data }),
    onSuccess: () => {
      toast.success("Request sent. The coach confirms it on the desk.");
      void qc.invalidateQueries({ queryKey: ["my-lessons"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (children.length === 0) return null;

  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate({
          player_user_id: String(f.get("player_user_id")),
          coach_user_id: String(f.get("coach_user_id")),
          sport: String(f.get("sport")) as "pickleball" | "tennis",
          starts_at: String(f.get("starts_at")),
          duration_min: Number(f.get("duration_min") || 60),
          court_id: f.get("court_id") ? Number(f.get("court_id")) : undefined,
        });
      }}
    >
      <Field label="Student">
        <Select name="player_user_id" required defaultValue={defaultChildId ?? children[0]?.user_id}>
          {children.map((child) => (
            <option key={child.user_id} value={child.user_id}>
              {child.display_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Coach">
        <Select name="coach_user_id" required defaultValue={coaches[0]?.user_id ?? ""}>
          {coaches.length === 0 ? <option value="">No coach listed yet</option> : null}
          {coaches.map((coach) => (
            <option key={coach.user_id} value={coach.user_id}>
              {coach.display_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sport">
        <Select name="sport" defaultValue="pickleball">
          <option value="pickleball">Pickleball</option>
          <option value="tennis">Tennis</option>
        </Select>
      </Field>
      <Field label="When">
        <Input name="starts_at" type="datetime-local" required defaultValue={defaultLessonWhen()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes">
          <Input name="duration_min" type="number" defaultValue={60} min={30} max={180} />
        </Field>
        <Field label="Court">
          <Select name="court_id" defaultValue={String(courts[0]?.id ?? "")}>
            {courts.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={save.isPending || coaches.length === 0}>
        {save.isPending ? "Sending…" : "Schedule next lesson"}
      </Button>
    </form>
  );
}

function PublicCheck({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
