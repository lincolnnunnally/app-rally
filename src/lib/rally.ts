export const SPORTS = ["pickleball", "tennis"] as const;
export type Sport = (typeof SPORTS)[number];

export const LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;
export type Level = (typeof LEVELS)[number];

export const SESSION_FORMATS = [
  { value: "open_play", label: "Open play" },
  { value: "round_robin", label: "Round robin" },
  { value: "drilling", label: "Clinic / drilling" },
  { value: "social", label: "Social mix" },
] as const;

export const LEAGUE_FORMATS = [
  { value: "round_robin", label: "Round robin" },
  { value: "ladder", label: "Ladder" },
] as const;

export const BOOKING_MODES = [
  { value: "claim", label: "Claim a window in Rally" },
  { value: "call", label: "Call or email to lock it" },
  { value: "walkup", label: "Walk-up / first come" },
] as const;

export const COURT_KINDS = [
  { value: "public", label: "Public rec" },
  { value: "club", label: "Club" },
  { value: "school", label: "School" },
  { value: "private", label: "Private / backyard" },
] as const;

export const SERVICE_KINDS = [
  { value: "private", label: "Private lesson" },
  { value: "group", label: "Group / clinic" },
  { value: "hitting", label: "Hitting session" },
  { value: "junior", label: "Juniors" },
] as const;

export const SERVICE_UNITS = [
  { value: "hour", label: "Per hour" },
  { value: "person", label: "Per person" },
  { value: "session", label: "Per session" },
] as const;

/** Rally only takes when money already moves. Rec at $0 stays $0. */
export const RALLY = {
  courtPct: 8,
  leaguePct: 10,
  lessonPct: 8,
  facilityPct: 10,
  trialDays: 30,
  monthlyCents: 1500,
  referralPct: 25,
} as const;

export const REF_KEY = "rally_ref";
export const COACH_KEY = "rally_coach";

export const PLAY_FREQUENCY = [
  { value: "handful", label: "A handful of times" },
  { value: "monthly", label: "A few times a month" },
  { value: "weekly", label: "About once a week" },
  { value: "few_week", label: "A few times a week" },
  { value: "daily", label: "Almost every day" },
] as const;
export type PlayFrequency = (typeof PLAY_FREQUENCY)[number]["value"];

export type LoginSearch = { ref?: string; coach?: string; mode?: "in" | "up" };

export function loginSearch(mode?: "in" | "up", ref?: string, coach?: string): LoginSearch {
  return { ref, coach, mode };
}


export const STALL_AREAS = [
  {
    value: "basics",
    label: "Beginner basics",
    hint: "Grip, ready position, the first serve. I am new.",
  },
  {
    value: "third_shot",
    label: "The same shot keeps breaking",
    hint: "Third shot, transition, a serve that sits up.",
  },
  {
    value: "match",
    label: "I freeze under score",
    hint: "I can rally. 10–10 is a different person.",
  },
  {
    value: "same_coach",
    label: "I have outgrown this coach",
    hint: "They took me as far as they go. I need a new eye.",
  },
  {
    value: "no_reps",
    label: "Open play is my only practice",
    hint: "No drilling. The game does not get cleaner.",
  },
  {
    value: "no_people",
    label: "I cannot find the right people",
    hint: "Skill match, time of day, someone who actually shows.",
  },
] as const;

export type Profile = {
  user_id: string;
  display_name: string;
  city: string;
  bio: string | null;
  plays_tennis: boolean;
  plays_pickleball: boolean;
  tennis_level: string | null;
  pickleball_level: string | null;
  looking_for_partners: boolean;
  looking_for_coach: boolean;
  interested_in_leagues: boolean;
  is_coach: boolean;
  availability: string | null;
  phone: string | null;
  onboarded: boolean;
  years_playing: number | null;
  dupr: string | null;
  utr: string | null;
  experience: string | null;
  accomplishments: string | null;
  tennis_years: number | null;
  pickleball_years: number | null;
  tennis_times: number | null;
  pickleball_times: number | null;
  tennis_frequency: string | null;
  pickleball_frequency: string | null;
  tennis_experience: string | null;
  pickleball_experience: string | null;
  tennis_results: string | null;
  pickleball_results: string | null;
  credit_coach_user_id: string | null;
  credit_coach_name: string | null;
  coach_note: string | null;
  share_code: string | null;
  referred_by: string | null;
  credit_cents: number;
  photo_data: string | null;
  certs: CertItem[];
  honors: HonorItem[];
};

export type CertItem = {
  title: string;
  issuer: string;
  year: string;
};

export type HonorItem = {
  title: string;
  event: string;
  year: string;
  kind: "title" | "trophy" | "competition";
};

export const HONOR_KINDS = [
  { value: "title", label: "Title" },
  { value: "trophy", label: "Trophy" },
  { value: "competition", label: "Competition" },
] as const;

export function parseCerts(raw: unknown): CertItem[] {
  const rows = parseJsonRows(raw);
  return rows
    .map((r) => ({
      title: String(r.title ?? "").trim(),
      issuer: String(r.issuer ?? "").trim(),
      year: String(r.year ?? "").trim(),
    }))
    .filter((r) => r.title);
}

function honorKind(raw: unknown): HonorItem["kind"] {
  if (raw === "trophy" || raw === "competition" || raw === "title") return raw;
  return "title";
}

export function parseHonors(raw: unknown): HonorItem[] {
  const rows = parseJsonRows(raw);
  return rows
    .map((r) => ({
      title: String(r.title ?? "").trim(),
      event: String(r.event ?? "").trim(),
      year: String(r.year ?? "").trim(),
      kind: honorKind(r.kind),
    }))
    .filter((r) => r.title);
}

function parseJsonRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

export function honorKindLabel(kind: HonorItem["kind"]) {
  return HONOR_KINDS.find((k) => k.value === kind)?.label ?? "Title";
}

export type PublicProfile = Omit<Profile, "phone" | "credit_cents" | "referred_by" | "share_code">;

export type SportBits = {
  plays_pickleball?: boolean;
  plays_tennis?: boolean;
  pickleball_level?: string | null;
  tennis_level?: string | null;
  dupr?: string | null;
  utr?: string | null;
  years_playing?: number | null;
  experience?: string | null;
  accomplishments?: string | null;
  tennis_years?: number | null;
  pickleball_years?: number | null;
  tennis_times?: number | null;
  pickleball_times?: number | null;
  tennis_frequency?: string | null;
  pickleball_frequency?: string | null;
  tennis_experience?: string | null;
  pickleball_experience?: string | null;
  tennis_results?: string | null;
  pickleball_results?: string | null;
};

export type PlayerProof = SportBits & {
  user_id: string;
  display_name: string;
  pickleball_level: string | null;
  tennis_level: string | null;
  years_playing: number | null;
  dupr: string | null;
  utr: string | null;
  experience: string | null;
  accomplishments: string | null;
  coach_note: string | null;
  sessions?: number;
  photo_data?: string | null;
};

export type Court = {
  id: number;
  name: string;
  address: string;
  city: string;
  sports: string;
  indoor: boolean;
  court_count: number;
  surface: string | null;
  lights: boolean;
  restrooms: boolean;
  access_notes: string | null;
  typical_hours: string | null;
  phone: string | null;
  is_other: boolean;
  lat: number | null;
  lng: number | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  booking_mode: string;
  player_fee_cents: number;
  coach_fee_cents: number;
  facility_cut_pct: number;
  rules: string | null;
  restrictions: string | null;
  lights_until: string | null;
  added_by: string | null;
  region: string;
  kind: string;
  status: string;
  slug: string | null;
  photo_data: string | null;
};

export type CourtPlace = Pick<Court, "name" | "address" | "city" | "lat" | "lng">;

export function courtDestination(c: CourtPlace) {
  if (c.lat != null && c.lng != null) return `${c.lat},${c.lng}`;
  const street = [c.address, c.city, "GA"].filter(Boolean).join(", ");
  return street || c.name;
}

export function googleDirectionsHref(c: CourtPlace) {
  const dest = encodeURIComponent(courtDestination(c));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export function appleMapsHref(c: CourtPlace) {
  const dest = encodeURIComponent(courtDestination(c));
  const q = encodeURIComponent(c.name);
  return `https://maps.apple.com/?daddr=${dest}&q=${q}&dirflg=d`;
}

export function directionsHref(c: CourtPlace) {
  return googleDirectionsHref(c);
}

export function preferAppleMaps() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function osmEmbedSrc(c: CourtPlace) {
  if (c.lat == null || c.lng == null) return null;
  const pad = 0.012;
  const bbox = [c.lng - pad, c.lat - pad, c.lng + pad, c.lat + pad].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${c.lat}%2C${c.lng}`;
}

export function osmTileUrl(c: CourtPlace, zoom = 16) {
  if (c.lat == null || c.lng == null) return null;
  const n = 2 ** zoom;
  const x = Math.floor(((c.lng + 180) / 360) * n);
  const latRad = (c.lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export type CatalogCity = {
  city: string;
  slug: string;
  court_count: number;
  sports: string[];
};

export type CatalogCoach = {
  display_name: string;
  headline: string | null;
  from_cents: number | null;
  plays_tennis: boolean;
  plays_pickleball: boolean;
  city: string;
};

export type SessionRow = {
  id: number;
  host_user_id: string | null;
  host_name: string | null;
  court_id: number | null;
  court_name: string | null;
  title: string;
  sport: string;
  format: string;
  starts_at: string;
  duration_min: number;
  skill_min: string | null;
  skill_max: string | null;
  spots: number;
  going: number;
  notes: string | null;
  mine: boolean;
};

export type ReservationRow = {
  id: number;
  court_id: number;
  court_name: string;
  user_id: string;
  holder_name: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  mine: boolean;
  fee_cents: number;
  for_coaching: boolean;
  rally_take_cents: number;
};

export type CoachService = {
  id: number;
  coach_user_id: string;
  name: string;
  kind: string;
  sport: string;
  price_cents: number;
  unit: string;
  duration_min: number;
  notes: string | null;
};

export type CoachCard = {
  user_id: string;
  display_name: string;
  city: string;
  bio: string | null;
  plays_tennis: boolean;
  plays_pickleball: boolean;
  headline: string | null;
  philosophy: string | null;
  hourly_rate: number | null;
  certifications: string | null;
  offers_private: boolean;
  offers_group: boolean;
  accepting: boolean;
  years_coaching: number | null;
  playing_level: string | null;
  specializations: string | null;
  achievements: string | null;
  travel_radius_mi: number | null;
  teaching_beginner: boolean;
  teaching_intermediate: boolean;
  teaching_advanced: boolean;
  teaching_juniors: boolean;
  services: CoachService[];
  from_cents: number | null;
  students: PlayerProof[];
  photo_data: string | null;
  certs: CertItem[];
  honors: HonorItem[];
};

export type LessonRow = {
  id: number;
  coach_user_id: string;
  coach_name: string;
  player_user_id: string;
  player_name: string;
  court_id: number | null;
  court_name: string | null;
  starts_at: string;
  duration_min: number;
  sport: string;
  status: string;
  notes: string | null;
  price_cents: number | null;
  billing: string;
  group_spots: number | null;
  series_id: string | null;
  facility_fee_cents: number;
  facility_cut_cents: number;
  service_name: string | null;
  rally_take_cents: number;
  for_kind: "self" | "child";
  for_name: string | null;
};

export function lessonWho(l: Pick<LessonRow, "player_name" | "for_kind" | "for_name">) {
  if (l.for_kind === "child" && l.for_name) return `${l.player_name} · for ${l.for_name}`;
  return l.player_name;
}

export type PlayRequestRow = {
  id: number;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  sport: string;
  message: string | null;
  proposed_at: string | null;
  court_name: string | null;
  status: string;
  created_at: string;
};

export type LeagueRow = {
  id: number;
  owner_user_id: string | null;
  name: string;
  sport: string;
  format: string;
  skill_band: string | null;
  season_label: string | null;
  status: string;
  notes: string | null;
  member_count: number;
  joined: boolean;
  reg_fee_cents: number;
};

export type MatchRow = {
  id: number;
  league_id: number | null;
  court_name: string | null;
  sport: string;
  format: string;
  scheduled_at: string | null;
  status: string;
  score: string | null;
  notes: string | null;
  side_a: string[];
  side_b: string[];
  side_a_ids: string[];
  side_b_ids: string[];
};

export type JournalRow = {
  id: number;
  kind: string;
  title: string | null;
  body: string;
  created_at: string;
};

export type LedgerRow = {
  id: number;
  kind: string;
  category: string;
  amount_cents: number;
  occurred_on: string;
  note: string | null;
};

export type Notice = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  created_at: string;
};

export type ReviewRow = {
  id: number;
  reviewer_user_id: string;
  reviewer_name: string;
  subject_type: "player" | "coach" | "facility";
  subject_id: string;
  rating: number;
  body: string;
  created_at: string;
};

export type AdviceHref =
  | "/app/coaches"
  | "/app/play"
  | "/app/mental"
  | "/app/leagues"
  | "/app/partners";

export type Advice = {
  title: string;
  body: string;
  href: AdviceHref;
  cta: string;
};

export type CoachBilling = {
  plan: "trial" | "percent" | "monthly";
  stored: "percent" | "monthly";
  trial_ends: string;
  in_trial: boolean;
  take_this_month: number;
};

export function sportLabel(sport: string) {
  return sport === "tennis" ? "Tennis" : "Pickleball";
}

export function formatWall(value: string | null | undefined) {
  if (!value) return "TBD";
  const clean = value.replace(" ", "T").slice(0, 16);
  const [date, time] = clean.split("T");
  if (!date) return value;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
  const month = dt.toLocaleDateString("en-US", { month: "short" });
  if (!time) return `${weekday}, ${month} ${d}`;
  const [hh, mm] = time.split(":").map(Number);
  const h = hh % 12 || 12;
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${weekday}, ${month} ${d} · ${h}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function toInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(" ", "T").slice(0, 16);
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function money(cents: number) {
  const n = cents / 100;
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs % 1 === 0 ? abs : abs.toFixed(2)}`;
}

export function takeCents(gross: number, pct: number) {
  if (gross <= 0 || pct <= 0) return 0;
  return Math.round((gross * pct) / 100);
}

export function feeSplit(gross: number, pct: number) {
  const take = takeCents(gross, pct);
  return { gross, take, net: gross - take };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function citySlug(city: string) {
  return slugify(city);
}

export function rememberRef(code: string) {
  if (typeof window === "undefined") return;
  const c = code.trim().toLowerCase();
  if (c) window.localStorage.setItem(REF_KEY, c);
}

export function readRef() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REF_KEY) || "";
}

export function rememberCoach(code: string) {
  if (typeof window === "undefined") return;
  const c = code.trim().toLowerCase();
  if (c) window.localStorage.setItem(COACH_KEY, c);
}

export function readCoach() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COACH_KEY) || "";
}

export function sharePath(code: string) {
  return `/join?ref=${encodeURIComponent(code)}`;
}

export function coachInvitePath(code: string) {
  return `/join?coach=${encodeURIComponent(code)}`;
}

export function bookingLabel(mode: string) {
  return BOOKING_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export function kindLabel(kind: string) {
  return COURT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function unitLabel(unit: string) {
  if (unit === "person") return "person";
  if (unit === "session") return "session";
  return "hr";
}

export function priceLine(s: CoachService) {
  return `${money(s.price_cents)}/${unitLabel(s.unit)}`;
}

export function frequencyLabel(value: string | null | undefined) {
  return PLAY_FREQUENCY.find((f) => f.value === value)?.label ?? "";
}

export function yearsPhrase(years: number | null | undefined) {
  if (years == null) return "";
  if (years <= 0) return "Just started";
  if (years === 1) return "1 year";
  return `${years} years`;
}

export function timesPhrase(times: number | null | undefined) {
  if (times == null) return "";
  if (times === 1) return "1 time on court";
  return `${times} times on court`;
}

export function sportLine(kind: "tennis" | "pickleball", p: SportBits) {
  const bits: string[] = [];
  const dual = p.plays_tennis && p.plays_pickleball;
  if (kind === "pickleball") {
    if (p.dupr) bits.push(`DUPR ${p.dupr}`);
    else if (p.pickleball_level) bits.push(p.pickleball_level);
    const years = p.pickleball_years ?? (dual ? null : p.plays_pickleball === false ? null : p.years_playing);
    const y = yearsPhrase(years);
    if (y) bits.push(y);
    const t = timesPhrase(p.pickleball_times);
    if (t) bits.push(t);
    const f = frequencyLabel(p.pickleball_frequency);
    if (f) bits.push(f);
  } else {
    if (p.utr) bits.push(`UTR ${p.utr}`);
    else if (p.tennis_level) bits.push(`NTRP ${p.tennis_level}`);
    const years = p.tennis_years ?? (dual ? null : p.plays_tennis === false ? null : p.years_playing);
    const y = yearsPhrase(years);
    if (y) bits.push(y);
    const t = timesPhrase(p.tennis_times);
    if (t) bits.push(t);
    const f = frequencyLabel(p.tennis_frequency);
    if (f) bits.push(f);
  }
  return bits.join(" · ");
}

export function sportStory(kind: "tennis" | "pickleball", p: SportBits) {
  if (kind === "pickleball") {
    if (p.pickleball_experience) return p.pickleball_experience;
    if (p.plays_tennis) return "";
    return p.experience || "";
  }
  if (p.tennis_experience) return p.tennis_experience;
  if (p.plays_pickleball) return "";
  return p.experience || "";
}

export function sportResults(kind: "tennis" | "pickleball", p: SportBits) {
  if (kind === "pickleball") {
    if (p.pickleball_results) return p.pickleball_results;
    if (p.plays_tennis) return "";
    return p.accomplishments || "";
  }
  if (p.tennis_results) return p.tennis_results;
  if (p.plays_pickleball) return "";
  return p.accomplishments || "";
}

export function nearLevel(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const i = LEVELS.indexOf(a as Level);
  const j = LEVELS.indexOf(b as Level);
  if (i >= 0 && j >= 0) return Math.abs(i - j) <= 1;
  const x = Number.parseFloat(a);
  const y = Number.parseFloat(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  return Math.abs(x - y) <= 0.5;
}

export function ratingLine(p: SportBits) {
  const bits: string[] = [];
  if (p.plays_pickleball !== false && (p.dupr || p.pickleball_level || p.pickleball_years != null)) {
    bits.push(sportLine("pickleball", p) ? `PB ${sportLine("pickleball", p)}` : "Pickleball");
  }
  if (p.plays_tennis !== false && (p.utr || p.tennis_level || p.tennis_years != null)) {
    bits.push(sportLine("tennis", p) ? `T ${sportLine("tennis", p)}` : "Tennis");
  }
  return bits.join(" · ");
}

export function stallAdvice(stuckOn: string, sport: string): Advice[] {
  const play = sport === "tennis" ? "tennis" : "pickleball";
  const out: Advice[] = [];
  if (stuckOn === "basics") {
    out.push({
      title: "Start with a beginner coach, not open play",
      body: `Open play at Rec will teach you chaos. A 30–60 minute private on grip, ready position, and the first ${play === "tennis" ? "serve toss" : "dink"} is cheaper than a month of guessing.`,
      href: "/app/coaches",
      cta: "Coaches who take beginners",
    });
    out.push({
      title: "Sunday 2:00 is the soft landing",
      body: "Sunday open play is the Rec session that still has room for a new paddle. Go with one thing to work on.",
      href: "/app/play",
      cta: "See open play",
    });
  } else if (stuckOn === "third_shot") {
    out.push({
      title: "Drill the thing that breaks, then play it under score",
      body: "A clinic or a coach who names the shot is the move. Open play will keep rewarding the miss.",
      href: "/app/coaches",
      cta: "Find a coach for the shot",
    });
    out.push({
      title: "See the ball before you swing at it",
      body: "The mental side of a breaking ball is rushing. Slow the first two steps of the reset.",
      href: "/app/mental",
      cta: "Between-point reset",
    });
  } else if (stuckOn === "match") {
    out.push({
      title: "This is a mental problem wearing a stroke costume",
      body: "Same swing at 10–10 as at 2–2. The four-step reset and the self-talk swaps exist for this exact feeling.",
      href: "/app/mental",
      cta: "Work the mental board",
    });
    out.push({
      title: "Play matches with a score, not just rallies",
      body: "Thursday night ladder and Stockyard singles exist so the nerves have a place to live besides your head.",
      href: "/app/leagues",
      cta: "Join a league",
    });
  } else if (stuckOn === "same_coach") {
    out.push({
      title: "A new eye is not a betrayal",
      body: "Filter for advanced or a different sport emphasis. Ask for one month, one shot. You can go back.",
      href: "/app/coaches",
      cta: "See other coaches",
    });
    out.push({
      title: "Write what stopped improving",
      body: "The journal is how you walk into the next lesson without a vague 'I feel stuck.'",
      href: "/app/mental",
      cta: "Open the journal",
    });
  } else if (stuckOn === "no_reps") {
    out.push({
      title: "Host a drilling hour, or book a clinic",
      body: "Open play will not grooved a shot. A hosted clinic or a group on the coach board will.",
      href: "/app/play",
      cta: "Host or join a session",
    });
    out.push({
      title: "A coach can run the hour you will not run yourself",
      body: "Group rate, per person. Cheaper than a private, more structure than Rec.",
      href: "/app/coaches",
      cta: "Group and clinic rates",
    });
  } else {
    out.push({
      title: "The partner board is the actual fix",
      body: "Skill first, then a time. Stop hoping Thursday produces a 3.5 who wants what you want.",
      href: "/app/partners",
      cta: "Who wants a hit",
    });
    out.push({
      title: "Open play is still how Vidalia meets",
      body: "RSVP so you are not the person wandering. The usual crowd is on the board.",
      href: "/app/play",
      cta: "RSVP to Rec",
    });
  }
  return out;
}

export const MENTAL_RESET = [
  {
    step: "Breathe",
    body: "Exhale longer than you inhale. One cycle. Let the last point leave the body.",
  },
  {
    step: "See",
    body: "Pick a target you can actually hit from this position. Deep middle. Backhand corner. The kitchen line.",
  },
  {
    step: "Cue",
    body: "One word. Split. Soft. Through. Not a paragraph, not a lecture.",
  },
  {
    step: "Play",
    body: "Commit. The next ball is the only one that exists.",
  },
];

export const SELF_TALK = [
  { from: "Don't miss.", to: "See it early. Send it deep." },
  { from: "I always dump this.", to: "This is a ball I know how to play." },
  { from: "They're better than me.", to: "Make them hit one more ball." },
  { from: "10–10, don't blow it.", to: "Same swing. Same target." },
  { from: "I choked last time.", to: "This point has no history." },
  { from: "My hands are gone.", to: "Soft face. Short backswing." },
];

export const VISUALIZATIONS = [
  {
    title: "The 10–10 dink",
    sport: "pickleball",
    minutes: 4,
    body: "You are at 10–10, side out. Crosscourt dink. See the ball leave their paddle. Soften your face. Drop it in the kitchen, two feet from the line. They attack. You block back to their feet. Reset. Do not speed up until you have a ball at the chest. Hold this for ten breaths.",
  },
  {
    title: "Break point serve",
    sport: "tennis",
    minutes: 3,
    body: "You are serving at 15–40. Toss is still. Trophy shape. Kick to the backhand, or a body serve if they cheat. See the toss, the hit, the bounce up high. You are already splitting for the next ball before they swing.",
  },
  {
    title: "Return vs the banger",
    sport: "pickleball",
    minutes: 3,
    body: "They crush every third ball. You are not there to win the war of pace. Compact swing. Block to their backhand. Take the kitchen. The point is won two shots later, not on the return.",
  },
  {
    title: "First ball of the day",
    sport: "both",
    minutes: 2,
    body: "Walk on. Same warm-up you always do. Feel the grip. Hear the first pop. You belong on this court. The first rally is a conversation, not a test.",
  },
];
