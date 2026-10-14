import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { publicFromCents, serviceIsPublic } from "@/lib/service-visibility";

/**
 * Public, signed-out coach data for /coach/<code> and /coaches.
 * Only fields already shown on the in-app coach board. No email, phone,
 * private prices (player-only services), or private notes.
 */
export type PublicCoachService = {
  id: number;
  name: string;
  sport: string;
  price_cents: number;
  unit: string;
  duration_min: number;
  notes: string | null;
};

export type PublicCoach = {
  user_id: string;
  code: string;
  display_name: string;
  city: string;
  bio: string | null;
  photo_data: string | null;
  availability: string | null;
  plays_tennis: boolean;
  plays_pickleball: boolean;
  headline: string | null;
  philosophy: string | null;
  specializations: string | null;
  years_coaching: number | null;
  playing_level: string | null;
  accepting: boolean;
  teaching_beginner: boolean;
  teaching_advanced: boolean;
  teaching_juniors: boolean;
  from_cents: number | null;
  services: PublicCoachService[];
};

const str = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v));
const bool = (v: unknown) => v === true || v === "t" || v === "true" || v === 1;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

/** QA and test accounts never show on the public board. */
const HIDDEN_NAME = /^(qa[\s-]|rally pr\d+ qa)/i;

async function load(code?: string): Promise<PublicCoach[]> {
  const sql = await getSql();
  const rows = code
    ? await sql`
        select p.user_id, p.share_code, p.display_name, p.city, p.bio, p.photo_data, p.availability,
               p.plays_tennis, p.plays_pickleball, p.public_fields,
               c.headline, c.philosophy, c.specializations, c.years_coaching, c.playing_level,
               c.accepting, c.teaching_beginner, c.teaching_advanced, c.teaching_juniors, c.hourly_rate
        from coach_profiles c
        join profiles p on p.user_id = c.user_id
        where p.onboarded = true and p.is_coach = true and p.user_id not like 'seed:%'
          and p.share_code is not null and lower(p.share_code) = ${code.trim().toLowerCase()}
        limit 1
      `
    : await sql`
        select p.user_id, p.share_code, p.display_name, p.city, p.bio, p.photo_data, p.availability,
               p.plays_tennis, p.plays_pickleball, p.public_fields,
               c.headline, c.philosophy, c.specializations, c.years_coaching, c.playing_level,
               c.accepting, c.teaching_beginner, c.teaching_advanced, c.teaching_juniors, c.hourly_rate
        from coach_profiles c
        join profiles p on p.user_id = c.user_id
        where p.onboarded = true and p.is_coach = true and p.user_id not like 'seed:%'
          and p.share_code is not null
        order by c.accepting desc, p.display_name
      `;
  const list = rows.filter((r) => !HIDDEN_NAME.test(String(r.display_name ?? "")));
  if (list.length === 0) return [];
  const services = await sql`select * from coach_services order by price_cents`;
  return list.map((r) => {
    const fields = String(r.public_fields ?? "bio,availability,photo");
    const svc = services
      .filter((s) => String(s.coach_user_id) === String(r.user_id))
      .filter((s) => serviceIsPublic(s.visibility == null ? null : String(s.visibility)))
      .map((s) => ({
        id: num(s.id),
        name: String(s.name),
        sport: String(s.sport),
        price_cents: num(s.price_cents),
        unit: String(s.unit ?? "hour"),
        duration_min: num(s.duration_min ?? 60),
        notes: str(s.notes),
        visibility: "public" as const,
      }));
    const from = publicFromCents(svc) ?? (r.hourly_rate == null ? null : num(r.hourly_rate) * 100);
    return {
      user_id: String(r.user_id),
      code: String(r.share_code),
      display_name: String(r.display_name),
      city: String(r.city ?? "Vidalia"),
      bio: fields.includes("bio") ? str(r.bio) : null,
      photo_data: fields.includes("photo") ? str(r.photo_data) : null,
      availability: fields.includes("availability") ? str(r.availability) : null,
      plays_tennis: bool(r.plays_tennis),
      plays_pickleball: bool(r.plays_pickleball),
      headline: str(r.headline),
      philosophy: str(r.philosophy),
      specializations: str(r.specializations),
      years_coaching: r.years_coaching == null ? null : num(r.years_coaching),
      playing_level: str(r.playing_level),
      accepting: bool(r.accepting),
      teaching_beginner: bool(r.teaching_beginner),
      teaching_advanced: bool(r.teaching_advanced),
      teaching_juniors: bool(r.teaching_juniors),
      from_cents: Number.isFinite(from) ? from : null,
      services: svc.map(({ visibility: _v, ...rest }) => rest),
    };
  });
}

export const getPublicCoach = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().min(1).max(32) }))
  .handler(async ({ data }) => (await load(data.code))[0] ?? null);

export const listPublicCoaches = createServerFn({ method: "GET" }).handler(async () => load());
