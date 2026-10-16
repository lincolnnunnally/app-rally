import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FormField } from "@/components/ui/form-field";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CoachPricing } from "@/components/coach-pricing";
import { PlayerSportCards } from "@/components/player-proof";
import { PhotoPicker } from "@/components/profile-face";
import { CertEditor, HonorEditor, ProofDisplay } from "@/components/proof-lists";
import {
  LEVELS,
  PLAY_FREQUENCY,
  clearCoach,
  readCoach,
  readRef,
  type CertItem,
  type HonorItem,
  type Profile,
} from "@/lib/rally";
import { listCoaches, saveProfile } from "@/lib/rally-server";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export function Onboarding({
  existing,
  onDone,
}: {
  existing: Profile | null;
  onDone: (p: Profile) => void;
}) {
  const user = useCurrentUser();
  // Drafts only for first-time setup; editing a saved profile starts from the saved values.
  const draftKey = existing?.onboarded ? "" : `rally_onboarding_draft:${user?.id ?? "me"}`;
  const [draft] = useState<Record<string, unknown>>(() => readDraft(draftKey));
  const d = <T,>(name: string, init: T): T =>
    draft[name] !== undefined && typeof draft[name] === typeof init ? (draft[name] as T) : init;
  const coaches = useQuery({
    queryKey: ["coaches"],
    queryFn: () => listCoaches(),
    enabled: !!existing?.onboarded,
  });
  const [displayName, setDisplayName] = useState(d("displayName", existing?.display_name || user?.displayName || "",));
  const [city, setCity] = useState(d("city", existing?.city || "Vidalia"));
  const [tennis, setTennis] = useState(d("tennis", existing?.plays_tennis ?? true));
  const [pickleball, setPickleball] = useState(d("pickleball", existing?.plays_pickleball ?? false));
  const [tennisLevel, setTennisLevel] = useState(d("tennisLevel", existing?.tennis_level || "3.0"));
  const [pbLevel, setPbLevel] = useState(d("pbLevel", existing?.pickleball_level || "3.0"));
  const [partners, setPartners] = useState(d("partners", existing?.looking_for_partners ?? true));
  const [coach, setCoach] = useState(d("coach", existing?.looking_for_coach ?? true));
  const [leagues, setLeagues] = useState(d("leagues", existing?.interested_in_leagues ?? true));
  const [isCoach, setIsCoach] = useState(d("isCoach", existing?.is_coach ?? false));
  const [availability, setAvailability] = useState(d("availability", existing?.availability || ""));
  const [bio, setBio] = useState(d("bio", existing?.bio || ""));
  const [dupr, setDupr] = useState(d("dupr", existing?.dupr ?? ""));
  const [utr, setUtr] = useState(d("utr", existing?.utr ?? ""));
  const [pbYears, setPbYears] = useState(d("pbYears", existing?.pickleball_years?.toString() ??
      (existing?.plays_pickleball ? existing?.years_playing?.toString() ?? "" : ""),));
  const [tennisYears, setTennisYears] = useState(d("tennisYears", existing?.tennis_years?.toString() ??
      (existing?.plays_tennis ? existing?.years_playing?.toString() ?? "" : ""),));
  const [pbTimes, setPbTimes] = useState(d("pbTimes", existing?.pickleball_times?.toString() ?? ""));
  const [tennisTimes, setTennisTimes] = useState(d("tennisTimes", existing?.tennis_times?.toString() ?? ""));
  const [pbFreq, setPbFreq] = useState(d("pbFreq", existing?.pickleball_frequency ?? ""));
  const [tennisFreq, setTennisFreq] = useState(d("tennisFreq", existing?.tennis_frequency ?? ""));
  const [pbExp, setPbExp] = useState(d("pbExp", existing?.pickleball_experience ?? (existing?.plays_pickleball ? existing?.experience ?? "" : ""),));
  const [tennisExp, setTennisExp] = useState(d("tennisExp", existing?.tennis_experience ?? (existing?.plays_tennis ? existing?.experience ?? "" : ""),));
  const [pbResults, setPbResults] = useState(d("pbResults", existing?.pickleball_results ?? (existing?.plays_pickleball ? existing?.accomplishments ?? "" : ""),));
  const [tennisResults, setTennisResults] = useState(d("tennisResults", existing?.tennis_results ?? (existing?.plays_tennis ? existing?.accomplishments ?? "" : ""),));
  const [creditCoach, setCreditCoach] = useState(d("creditCoach", existing?.credit_coach_user_id ?? ""));
  const [coachNote, setCoachNote] = useState(d("coachNote", existing?.coach_note ?? ""));
  const [photo, setPhoto] = useState<string | null>(existing?.photo_data ?? null);
  const [certs, setCerts] = useState<CertItem[]>(existing?.certs ?? []);
  const [honors, setHonors] = useState<HonorItem[]>(existing?.honors ?? []);
  const [error, setError] = useState<string | null>(null);
  // A refresh mid-form should not wipe what someone typed (bio, results, …).
  useEffect(() => {
    writeDraft(draftKey, {
      displayName, city, tennis, pickleball, tennisLevel, pbLevel, partners, coach, leagues,
      isCoach, availability, bio, dupr, utr, pbYears, tennisYears, pbTimes, tennisTimes, pbFreq,
      tennisFreq, pbExp, tennisExp, pbResults, tennisResults, creditCoach, coachNote,
    });
  }, [
    draftKey, displayName, city, tennis, pickleball, tennisLevel, pbLevel, partners, coach,
    leagues, isCoach, availability, bio, dupr, utr, pbYears, tennisYears, pbTimes, tennisTimes,
    pbFreq, tennisFreq, pbExp, tennisExp, pbResults, tennisResults, creditCoach, coachNote,
  ]);
  const [saving, setSaving] = useState(false);

  const preview = {
    plays_tennis: tennis,
    plays_pickleball: pickleball,
    tennis_level: tennis ? tennisLevel : null,
    pickleball_level: pickleball ? pbLevel : null,
    dupr: pickleball ? dupr || null : null,
    utr: tennis ? utr || null : null,
    tennis_years: tennis && tennisYears ? Number(tennisYears) : null,
    pickleball_years: pickleball && pbYears ? Number(pbYears) : null,
    tennis_times: tennis && tennisTimes ? Number(tennisTimes) : null,
    pickleball_times: pickleball && pbTimes ? Number(pbTimes) : null,
    tennis_frequency: tennis ? tennisFreq || null : null,
    pickleball_frequency: pickleball ? pbFreq || null : null,
    tennis_experience: tennis ? tennisExp || null : null,
    pickleball_experience: pickleball ? pbExp || null : null,
    tennis_results: tennis ? tennisResults || null : null,
    pickleball_results: pickleball ? pbResults || null : null,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tennis && !pickleball) {
      setError("Pick at least one sport.");
      return;
    }
    setSaving(true);
    try {
      const profile = await saveProfile({
        data: {
          display_name: displayName,
          city,
          bio: bio || undefined,
          plays_tennis: tennis,
          plays_pickleball: pickleball,
          tennis_level: tennis ? tennisLevel : undefined,
          pickleball_level: pickleball ? pbLevel : undefined,
          interested_in_leagues: leagues,
          is_coach: isCoach,
          availability: availability || undefined,
          dupr: pickleball && dupr ? dupr : undefined,
          utr: tennis && utr ? utr : undefined,
          tennis_years: tennis && tennisYears ? Number(tennisYears) : undefined,
          pickleball_years: pickleball && pbYears ? Number(pbYears) : undefined,
          tennis_times: tennis && tennisTimes ? Number(tennisTimes) : undefined,
          pickleball_times: pickleball && pbTimes ? Number(pbTimes) : undefined,
          tennis_frequency: tennis && tennisFreq ? tennisFreq : undefined,
          pickleball_frequency: pickleball && pbFreq ? pbFreq : undefined,
          tennis_experience: tennis && tennisExp ? tennisExp : undefined,
          pickleball_experience: pickleball && pbExp ? pbExp : undefined,
          tennis_results: tennis && tennisResults ? tennisResults : undefined,
          pickleball_results: pickleball && pbResults ? pbResults : undefined,
          looking_for_partners: partners || Boolean(readCoach()),
          looking_for_coach: coach || Boolean(readCoach()),
          credit_coach_user_id: creditCoach || undefined,
          coach_note: coachNote || undefined,
          referred_by: readRef() || undefined,
          coach_code: readCoach() || undefined,
          photo_data: photo ?? "",
          certs,
          honors,
        },
      });
      clearCoach();
      clearDraft(draftKey);
      onDone(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Rally
      </p>
      <h1 className="mt-2 font-display text-4xl">
        {existing?.onboarded ? "Your profile" : "Get on Rally"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Tennis and pickleball are different games, so each gets its own skill level. Check “I
        coach” at the bottom only if you teach. A parent can book a kid later without the kid
        needing an account.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
        <PhotoPicker name={displayName || "You"} photo={photo} onChange={setPhoto} />
        <Field label="Name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>
        <div role="group" aria-label="Sports">
          <p className="text-sm font-medium">Sports</p>
          <div className="mt-2 flex gap-2">
            <Toggle on={pickleball} onClick={() => setPickleball((v) => !v)}>
              Pickleball
            </Toggle>
            <Toggle on={tennis} onClick={() => setTennis((v) => !v)}>
              Tennis
            </Toggle>
          </div>
        </div>

        {pickleball ? (
          <SportSection title="Pickleball">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Skill" hint="1.0 brand new · 3.0 can rally and keep score · 4.0+ tournament level">
                <Select value={pbLevel} onChange={(e) => setPbLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="DUPR (optional)"
                hint="A pickleball rating (2.0–8.0) from recorded match results. Skip it if you don't have one."
              >
                <Input value={dupr} onChange={(e) => setDupr(e.target.value)} placeholder="e.g. 3.62" />
              </Field>
              <Field label="Years">
                <Input
                  value={pbYears}
                  onChange={(e) => setPbYears(e.target.value)}
                  type="number"
                  min={0}
                  max={80}
                  placeholder="e.g. 1"
                />
              </Field>
              <Field label="How often">
                <Select value={pbFreq} onChange={(e) => setPbFreq(e.target.value)}>
                  <option value="">Not sure yet</option>
                  {PLAY_FREQUENCY.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Times on court (optional)">
              <Input
                value={pbTimes}
                onChange={(e) => setPbTimes(e.target.value)}
                type="number"
                min={0}
                max={9999}
                placeholder="e.g. 5"
              />
              <p className="text-xs text-muted-foreground">
                Useful when you just started — “a year, but only five times.”
              </p>
            </Field>
            <Field label="Your pickleball">
              <Textarea
                value={pbExp}
                onChange={(e) => setPbExp(e.target.value)}
                placeholder="e.g. Picked up a paddle a year ago. Rec nights when I can."
              />
            </Field>
            <Field label="Results">
              <Textarea
                value={pbResults}
                onChange={(e) => setPbResults(e.target.value)}
                placeholder="e.g. Moved up from the Sunday beginner group."
              />
            </Field>
          </SportSection>
        ) : null}

        {tennis ? (
          <SportSection title="Tennis">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="NTRP level"
                hint="The 1.0–7.0 tennis scale used by rec leagues. 2.5 learning to rally · 3.5 steady club player · 4.5 strong tournament player."
              >
                <Select value={tennisLevel} onChange={(e) => setTennisLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="UTR (optional)"
                hint="Universal Tennis Rating (1–16), from match results. Skip it if you don't have one."
              >
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 4.2" />
              </Field>
              <Field label="Years">
                <Input
                  value={tennisYears}
                  onChange={(e) => setTennisYears(e.target.value)}
                  type="number"
                  min={0}
                  max={80}
                  placeholder="e.g. 10"
                />
              </Field>
              <Field label="How often">
                <Select value={tennisFreq} onChange={(e) => setTennisFreq(e.target.value)}>
                  <option value="">Not sure yet</option>
                  {PLAY_FREQUENCY.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Times on court (optional)">
              <Input
                value={tennisTimes}
                onChange={(e) => setTennisTimes(e.target.value)}
                type="number"
                min={0}
                max={9999}
                placeholder="e.g. 20 (optional)"
              />
            </Field>
            <Field label="Your tennis">
              <Textarea
                value={tennisExp}
                onChange={(e) => setTennisExp(e.target.value)}
                placeholder="e.g. High school tennis, then rec leagues."
              />
            </Field>
            <Field label="Results">
              <Textarea
                value={tennisResults}
                onChange={(e) => setTennisResults(e.target.value)}
                placeholder="e.g. Won the fall singles ladder."
              />
            </Field>
          </SportSection>
        ) : null}

        <Field label="When you usually play">
          <Input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="e.g. Weeknights after 5, Saturday mornings"
          />
        </Field>
        <Field label="Short bio">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. Looking for a hitting partner on Sundays."
          />
        </Field>
        <CertEditor items={certs} onChange={setCerts} />
        <HonorEditor items={honors} onChange={setHonors} />

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">How people see you</p>
          <div className="mt-3">
            <PlayerSportCards player={preview} />
            <ProofDisplay certs={certs} honors={honors} />
          </div>
        </div>

        {existing?.onboarded ? (
          <>
            <Field label="Credit a coach (optional)">
              <Select value={creditCoach} onChange={(e) => setCreditCoach(e.target.value)}>
                <option value="">None</option>
                {(coaches.data ?? [])
                  .filter((c) => c.user_id !== existing.user_id)
                  .map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name}
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Shows on their card. Proof the price is worth it — your results, not a review farm.
              </p>
            </Field>
            {creditCoach ? (
              <Field label="What they changed">
                <Input
                  value={coachNote}
                  onChange={(e) => setCoachNote(e.target.value)}
                  placeholder="e.g. Fixed my serve toss."
                />
              </Field>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-col gap-2 text-sm">
          <CheckRow checked={partners} onChange={setPartners} label="Looking for hitting partners" />
          <CheckRow checked={coach} onChange={setCoach} label="Looking for a coach" />
          <CheckRow checked={leagues} onChange={setLeagues} label="Interested in leagues" />
          <CheckRow checked={isCoach} onChange={setIsCoach} label="I coach — set up a coach page" />
        </div>
        {isCoach ? <CoachPricing className="mb-0" /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : existing?.onboarded ? "Save profile" : "Enter Rally"}
        </Button>
      </form>
    </div>
  );
}

function SportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <FormField label={label} hint={hint} className="flex flex-col gap-2">
      {children}
    </FormField>
  );
}

function readDraft(key: string): Record<string, unknown> {
  if (!key || typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeDraft(key: string, value: Record<string, unknown>) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: drafts are a nicety */
  }
}

function clearDraft(key: string) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          : "h-11 rounded-md border border-border px-4 text-sm text-muted-foreground"
      }
    >
      {children}
    </button>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-md border border-border px-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}
