import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlayerSportCards } from "@/components/player-proof";
import {
  LEVELS,
  PLAY_FREQUENCY,
  readCoach,
  readRef,
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
  const coaches = useQuery({
    queryKey: ["coaches"],
    queryFn: () => listCoaches(),
    enabled: !!existing?.onboarded,
  });
  const [displayName, setDisplayName] = useState(
    existing?.display_name || user?.displayName || "",
  );
  const [city, setCity] = useState(existing?.city || "Vidalia");
  const [tennis, setTennis] = useState(existing?.plays_tennis ?? true);
  const [pickleball, setPickleball] = useState(existing?.plays_pickleball ?? false);
  const [tennisLevel, setTennisLevel] = useState(existing?.tennis_level || "3.0");
  const [pbLevel, setPbLevel] = useState(existing?.pickleball_level || "3.0");
  const [partners, setPartners] = useState(existing?.looking_for_partners ?? true);
  const [coach, setCoach] = useState(existing?.looking_for_coach ?? true);
  const [leagues, setLeagues] = useState(existing?.interested_in_leagues ?? true);
  const [isCoach, setIsCoach] = useState(existing?.is_coach ?? false);
  const [availability, setAvailability] = useState(existing?.availability || "");
  const [bio, setBio] = useState(existing?.bio || "");
  const [dupr, setDupr] = useState(existing?.dupr ?? "");
  const [utr, setUtr] = useState(existing?.utr ?? "");
  const [pbYears, setPbYears] = useState(
    existing?.pickleball_years?.toString() ??
      (existing?.plays_pickleball ? existing?.years_playing?.toString() ?? "" : ""),
  );
  const [tennisYears, setTennisYears] = useState(
    existing?.tennis_years?.toString() ??
      (existing?.plays_tennis ? existing?.years_playing?.toString() ?? "" : ""),
  );
  const [pbTimes, setPbTimes] = useState(existing?.pickleball_times?.toString() ?? "");
  const [tennisTimes, setTennisTimes] = useState(existing?.tennis_times?.toString() ?? "");
  const [pbFreq, setPbFreq] = useState(existing?.pickleball_frequency ?? "");
  const [tennisFreq, setTennisFreq] = useState(existing?.tennis_frequency ?? "");
  const [pbExp, setPbExp] = useState(
    existing?.pickleball_experience ?? (existing?.plays_pickleball ? existing?.experience ?? "" : ""),
  );
  const [tennisExp, setTennisExp] = useState(
    existing?.tennis_experience ?? (existing?.plays_tennis ? existing?.experience ?? "" : ""),
  );
  const [pbResults, setPbResults] = useState(
    existing?.pickleball_results ?? (existing?.plays_pickleball ? existing?.accomplishments ?? "" : ""),
  );
  const [tennisResults, setTennisResults] = useState(
    existing?.tennis_results ?? (existing?.plays_tennis ? existing?.accomplishments ?? "" : ""),
  );
  const [creditCoach, setCreditCoach] = useState(existing?.credit_coach_user_id ?? "");
  const [coachNote, setCoachNote] = useState(existing?.coach_note ?? "");
  const [error, setError] = useState<string | null>(null);
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
        },
      });
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
        Tennis and pickleball are different games. Check tennis if you are here for lessons. Check
        “I coach” if you teach. A parent can book a kid later without the kid needing an account.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
        <Field label="Name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>
        <div>
          <Label>Sports</Label>
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
              <Field label="Skill">
                <Select value={pbLevel} onChange={(e) => setPbLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="DUPR (optional)">
                <Input value={dupr} onChange={(e) => setDupr(e.target.value)} placeholder="3.62" />
              </Field>
              <Field label="Years">
                <Input
                  value={pbYears}
                  onChange={(e) => setPbYears(e.target.value)}
                  type="number"
                  min={0}
                  max={80}
                  placeholder="1"
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
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground">
                Useful when you just started — “a year, but only five times.”
              </p>
            </Field>
            <Field label="Your pickleball">
              <Textarea
                value={pbExp}
                onChange={(e) => setPbExp(e.target.value)}
                placeholder="Picked up a paddle a year ago. Rec nights when I can."
              />
            </Field>
            <Field label="Results">
              <Textarea
                value={pbResults}
                onChange={(e) => setPbResults(e.target.value)}
                placeholder="Moved off the Sunday beginner hour."
              />
            </Field>
          </SportSection>
        ) : null}

        {tennis ? (
          <SportSection title="Tennis">
            <div className="grid grid-cols-2 gap-3">
              <Field label="NTRP">
                <Select value={tennisLevel} onChange={(e) => setTennisLevel(e.target.value)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="UTR (optional)">
                <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="4.2" />
              </Field>
              <Field label="Years">
                <Input
                  value={tennisYears}
                  onChange={(e) => setTennisYears(e.target.value)}
                  type="number"
                  min={0}
                  max={80}
                  placeholder="30"
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
                placeholder="Leave blank if years already says it"
              />
            </Field>
            <Field label="Your tennis">
              <Textarea
                value={tennisExp}
                onChange={(e) => setTennisExp(e.target.value)}
                placeholder="High school and rec tennis for decades."
              />
            </Field>
            <Field label="Results">
              <Textarea
                value={tennisResults}
                onChange={(e) => setTennisResults(e.target.value)}
                placeholder="Stockyard singles. Holds a 4.0 on these courts."
              />
            </Field>
          </SportSection>
        ) : null}

        <Field label="When you usually play">
          <Input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="Weeknights after 5, Saturday morning"
          />
        </Field>
        <Field label="Short bio">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Looking for a hitting partner on Sundays."
          />
        </Field>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">How people see you</p>
          <div className="mt-3">
            <PlayerSportCards player={preview} />
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
                  placeholder="Quinn fixed my third shot."
                />
              </Field>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-col gap-2 text-sm">
          <CheckRow checked={partners} onChange={setPartners} label="Looking for hitting partners" />
          <CheckRow checked={coach} onChange={setCoach} label="Looking for a coach" />
          <CheckRow checked={leagues} onChange={setLeagues} label="Interested in leagues" />
          <CheckRow checked={isCoach} onChange={setIsCoach} label="I coach — list me on the board" />
        </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
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
