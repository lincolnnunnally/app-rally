import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import type {
  CatalogCity,
  CatalogCoach,
  CoachBilling,
  CoachService,
  Court,
  LessonRow,
  PlayerProof,
  Profile,
  PublicProfile,
  ReservationRow,
  ReviewRow,
} from "@/lib/rally";
import { cleanCashAppHandle, cleanVenmoHandle } from "@/lib/pay-href";
import { canActorSaveLessonNotes, LESSON_NOTES_MAX, lessonNotesNotice } from "@/lib/lesson-notes";
import { canActorSetLessonStatus } from "@/lib/lesson-status";
import { publicFromCents, rosterServiceNotice, serviceIsPublic } from "@/lib/service-visibility";
import { RALLY, citySlug, money, parseCerts, parseHonors, priceLine, slugify, takeCents } from "@/lib/rally";

export type { ReviewRow };

function num(v: unknown) {
	return typeof v === "number" ? v : Number(v);
}
function bool(v: unknown) {
	return v === true || v === "t" || v === "true";
}
var sportZ = z.enum(["pickleball", "tennis"]);
let seedLock: Promise<void> | null = null;
async function ensureSeed(sql: Sql) {
	if (!seedLock) seedLock = runSeed(sql).catch((err) => {
		seedLock = null;
		throw err;
	});
	await seedLock;
}
async function runSeed(sql: Sql) {
	if (num((await sql`select count(*)::int as n from courts`)[0]?.n ?? 0) === 0) {
		await sql`
      insert into courts (name, address, city, sports, indoor, court_count, surface, lights, restrooms, access_notes, typical_hours, phone, is_other)
      values
      (
        'Ed Smith Complex — Pickleball',
        '102 Stockyard Rd',
        'Vidalia',
        'pickleball',
        false,
        4,
        'Asphalt, permanent lines and nets',
        true,
        true,
        'Ed Smith Complex (Smith Park / Vidalia Rec). Free public pickleball courts at Stockyard Road. Lights and restrooms on site.',
        'Open play most evenings; lighted',
        '912-537-7913',
        false
      ),
      (
        'Ed Smith Complex — Tennis',
        '102 Stockyard Rd',
        'Vidalia',
        'tennis',
        false,
        4,
        'Hard court',
        true,
        true,
        'Ed Smith Complex (Smith Park / Vidalia Rec). Four lighted tennis courts at Stockyard Road. Parks & Rec: 912-537-7913.',
        'Daylight plus lights until 10 PM',
        '912-537-7913',
        false
      ),
      (
        'Other / private court',
        'Vidalia area',
        'Vidalia',
        'tennis,pickleball',
        false,
        1,
        null,
        false,
        false,
        'Backyard, church, school, or a court you already have a key to. Use this when the lesson or hit is not at Rec.',
        null,
        null,
        true
      )
    `;
	}
	await ensureFacilities(sql);
	await ensureCourtSlugs(sql);
	await ensureUpcomingSessions(sql);
}
function upcomingDow(dow: number, count: number) {
	const dates = [];
	const now = /* @__PURE__ */ new Date();
	const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	for (let i = 0; i < 28 && dates.length < count; i += 1) {
		const d = new Date(start + i * 864e5);
		if (d.getUTCDay() === dow) dates.push(d.toISOString().slice(0, 10));
	}
	return dates;
}
async function ensureUpcomingSessions(sql: Sql) {
	if (num((await sql`
    select count(*)::int as n from sessions where starts_at > now()
  `)[0]?.n ?? 0) >= 6) return;
	const courtId = (await sql`
    select id from courts
    where name in ('Ed Smith Complex — Pickleball', 'Vidalia Rec — Pickleball')
    limit 1
  `)[0]?.id;
	if (!courtId) return;
	const rows = [];
	for (const date of upcomingDow(1, 3)) rows.push({
		title: "Monday Open Play",
		date,
		time: "17:30:00",
		notes: "Posted Rec hours. RSVP so the board knows who is coming."
	});
	for (const date of upcomingDow(4, 3)) rows.push({
		title: "Thursday Open Play",
		date,
		time: "17:30:00",
		notes: "Posted Rec hours. RSVP if you are coming."
	});
	for (const date of upcomingDow(0, 3)) rows.push({
		title: "Sunday Open Play",
		date,
		time: "14:00:00",
		notes: "Posted Rec hours. Beginners welcome. Shade is limited — bring water."
	});
	for (const row of rows) {
		const starts = `${row.date} ${row.time}`;
		if (num((await sql`
      select count(*)::int as n from sessions where title = ${row.title} and starts_at = ${starts}::timestamp
    `)[0]?.n ?? 0) > 0) continue;
		await sql`
      insert into sessions (host_user_id, court_id, title, sport, format, starts_at, duration_min, skill_min, skill_max, spots, notes)
      values (null, ${courtId}, ${row.title}, 'pickleball', 'open_play', ${starts}::timestamp, 120, '2.5', '4.0', 16, ${row.notes})
    `;
	}
}
async function ensureCommunity(sql: Sql) {
	if (num((await sql`
    select count(*)::int as n from profiles where user_id like 'seed:%'
  `)[0]?.n ?? 0) > 0) return;
	await sql`
    insert into profiles (
      user_id, display_name, city, bio, plays_tennis, plays_pickleball,
      tennis_level, pickleball_level, looking_for_partners, looking_for_coach,
      interested_in_leagues, is_coach, availability, onboarded
    ) values
    (
      'seed:avery', 'Avery', 'Vidalia',
      'Right-side player. Thursday night regular. Looking for 3.5 doubles that actually rotate.',
      false, true, null, '3.5', true, false, true, false, 'Weeknights after 5', true
    ),
    (
      'seed:cam', 'Cam', 'Vidalia',
      'Sundays at Rec. Working from 3.0 up. Will drill kitchen if you will.',
      false, true, null, '3.0', true, true, true, false, 'Sunday afternoons', true
    ),
    (
      'seed:riley', 'Riley', 'Vidalia',
      'Tennis first. Pickleball when the courts are open. Hits a heavy ball.',
      true, true, '3.5', '3.0', true, false, true, false, 'Mornings and Sunday', true
    ),
    (
      'seed:ellis', 'Ellis', 'Vidalia',
      'Stockyard singles. Looking for 3.5–4.5 who want a score, not a rally-until-we-are-tired.',
      true, false, '4.0', null, true, false, true, false, 'Evenings', true
    ),
    (
      'seed:quinn', 'Quinn', 'Vidalia',
      'Coaches pickleball at Rec. Still plays Thursday nights. Third shot and kitchen.',
      false, true, null, '4.0', true, false, true, true, 'Lessons weekday mornings', true
    )
  `;
	await sql`
    insert into coach_profiles (
      user_id, headline, philosophy, hourly_rate, certifications,
      offers_private, offers_group, accepting, years_coaching
    ) values (
      'seed:quinn',
      'Kitchen and third shot. 3.5–4.5.',
      'We drill the thing that breaks down on Thursday night, then we play it under score.',
      60, 'PPR', true, true, true, 8
    )
  `;
	const leagues = await sql`select id, name from leagues`;
	const byName = Object.fromEntries(leagues.map((l) => [String(l.name), num(l.id)]));
	const thursday = byName["Vidalia Thursday Night"];
	const onion = byName["Sweet Onion Round Robin"];
	const singles = byName["Stockyard Singles"];
	const members = [
		{
			league: thursday,
			user: "seed:avery"
		},
		{
			league: thursday,
			user: "seed:quinn"
		},
		{
			league: thursday,
			user: "seed:cam"
		},
		{
			league: onion,
			user: "seed:cam"
		},
		{
			league: onion,
			user: "seed:avery"
		},
		{
			league: singles,
			user: "seed:riley"
		},
		{
			league: singles,
			user: "seed:ellis"
		}
	];
	for (const m of members) {
		if (!m.league) continue;
		await sql`
      insert into league_members (league_id, user_id)
      values (${m.league}, ${m.user})
      on conflict do nothing
    `;
	}
	const pb = await sql`
    select id from courts where name = 'Vidalia Rec — Pickleball' limit 1
  `;
	const tn = await sql`
    select id from courts where name = 'Vidalia Rec — Tennis' limit 1
  `;
	const thu = upcomingDow(4, 1)[0];
	const sun = upcomingDow(0, 1)[0];
	if (thursday && pb[0] && thu) {
		const id = num((await sql`
      insert into matches (league_id, court_id, sport, format, scheduled_at, status)
      values (${thursday}, ${num(pb[0].id)}, 'pickleball', 'singles', ${`${thu} 18:30:00`}::timestamp, 'scheduled')
      returning id
    `)[0].id);
		await sql`insert into match_sides (match_id, user_id, side) values (${id}, 'seed:avery', 'a')`;
		await sql`insert into match_sides (match_id, user_id, side) values (${id}, 'seed:quinn', 'b')`;
	}
	if (singles && tn[0] && sun) {
		const id = num((await sql`
      insert into matches (league_id, court_id, sport, format, scheduled_at, status)
      values (${singles}, ${num(tn[0].id)}, 'tennis', 'singles', ${`${sun} 16:00:00`}::timestamp, 'scheduled')
      returning id
    `)[0].id);
		await sql`insert into match_sides (match_id, user_id, side) values (${id}, 'seed:riley', 'a')`;
		await sql`insert into match_sides (match_id, user_id, side) values (${id}, 'seed:ellis', 'b')`;
	}
}
async function ensureFacilities(sql: Sql) {
	await sql`
    update courts set
      name = 'Ed Smith Complex — Pickleball',
      address = '102 Stockyard Rd',
      lat = 32.2174, lng = -82.4132, region = 'Toombs', kind = 'public', status = 'open',
      court_count = 4, lights = true, restrooms = true,
      booking_mode = 'claim', player_fee_cents = 0, coach_fee_cents = 0, facility_cut_pct = 0,
      manager_name = 'Vidalia Parks & Rec', manager_phone = '912-537-7913',
      manager_email = 'parks@vidaliaga.gov', lights_until = '10:00 PM',
      typical_hours = 'Open play most evenings; lighted until 10 PM',
      access_notes = 'Ed Smith Complex (Smith Park / Vidalia Rec). Free public pickleball courts at Stockyard Road. Lights and restrooms on site.',
      rules = 'Public courts at Ed Smith Complex. Community claims in Rally are a courtesy so two groups are not walking up to the same nets. Parks & Rec still owns the asphalt.',
      restrictions = 'No exclusive block during posted open play (Mon/Thu 5:30, Sun 2:00) unless you are hosting that session. Coaches: introduce yourself to Parks & Rec before you run a paid clinic.',
      slug = coalesce(slug, 'vidalia-rec-pickleball')
    where name in ('Vidalia Rec — Pickleball', 'Ed Smith Complex — Pickleball')
       or slug = 'vidalia-rec-pickleball'
  `;
	await sql`
    update courts set
      name = 'Ed Smith Complex — Tennis',
      address = '102 Stockyard Rd',
      lat = 32.2171, lng = -82.414, region = 'Toombs', kind = 'public', status = 'open',
      court_count = 4, lights = true, restrooms = true,
      booking_mode = 'claim', player_fee_cents = 0, coach_fee_cents = 0, facility_cut_pct = 0,
      manager_name = 'Vidalia Parks & Rec', manager_phone = '912-537-7913',
      manager_email = 'parks@vidaliaga.gov', lights_until = '10:00 PM',
      typical_hours = 'Daylight plus lights until 10 PM',
      access_notes = 'Ed Smith Complex (Smith Park / Vidalia Rec). Four lighted tennis courts at Stockyard Road. Parks & Rec: 912-537-7913.',
      rules = 'Same complex as pickleball. Call Parks & Rec if you need the courts for a league night so they are not double-booked with a rec program. Coaching is welcome.',
      restrictions = 'Lights cut at 10. No vehicles on the courts. A paid clinic should be on the Parks & Rec calendar.',
      slug = coalesce(slug, 'vidalia-rec-tennis')
    where name in ('Vidalia Rec — Tennis', 'Ed Smith Complex — Tennis')
       or slug = 'vidalia-rec-tennis'
  `;
	await sql`
    update courts set
      region = 'Toombs', kind = 'private', status = 'open', booking_mode = 'walkup',
      rules = 'A court you already have a key to. Rally logs the lesson. It does not book someone else''s backyard.',
      restrictions = 'You are the manager. No public walk-up.'
    where is_other = true and booking_mode = 'claim'
  `;
	if (((await sql`
    select count(*)::int as n from courts where name = 'Lyons Rec — Pickleball'
  `)[0]?.n ?? 0) === 0) await sql`
      insert into courts (
        name, address, city, sports, indoor, court_count, surface, lights, restrooms,
        access_notes, typical_hours, phone, is_other, lat, lng, manager_name, manager_phone,
        booking_mode, rules, restrictions, region, kind, status
      ) values (
        'Lyons Rec — Pickleball',
        'Lyons Recreation Complex',
        'Lyons',
        'pickleball',
        false,
        4,
        'New outdoor courts',
        true,
        true,
        'Toombs County is putting pickleball courts in Lyons. Rally is watching the opening so Vidalia players can migrate a night when they land.',
        'TBD — watch this board',
        '912-526-3943',
        false,
        32.2043, -82.3217,
        'Lyons Recreation',
        '912-526-3943',
        'call',
        'Not open yet. Call Lyons Rec for the current pour / net date.',
        'Do not drive over for a game until the status on this card flips to open.',
        'Toombs',
        'public',
        'coming'
      )
    `;
	if (num((await sql`
    select count(*)::int as n from courts where name = 'Vidalia High Tennis'
  `)[0]?.n ?? 0) === 0) await sql`
      insert into courts (
        name, address, city, sports, indoor, court_count, surface, lights, restrooms,
        access_notes, typical_hours, phone, is_other, lat, lng, manager_name, manager_phone,
        manager_email, booking_mode, player_fee_cents, coach_fee_cents, facility_cut_pct,
        rules, restrictions, lights_until, region, kind, status
      ) values (
        'Vidalia High Tennis',
        'Vidalia High School',
        'Vidalia',
        'tennis',
        false,
        4,
        'Hard court',
        true,
        true,
        'School courts. The path into the next generation of players — after the last bell, not during class.',
        'After school and weekends, with athletic director sign-off',
        '912-537-3032',
        false,
        32.2148, -82.4019,
        'Athletic Department',
        '912-537-3032',
        null,
        'call',
        0, 2500, 0,
        'Public and coaching use after school hours and weekends only. Call the athletic department before you put a clinic on the calendar.',
        'No public play during school hours. Coaches pay a $25 court fee per booked hour. Juniors welcome with a coach or a parent on site.',
        '9:00 PM',
        'Toombs',
        'school',
        'open'
      )
    `;
	await sql`
    update coach_profiles set
      playing_level = coalesce(playing_level, '4.0'),
      specializations = coalesce(specializations, 'Third shot, kitchen, 3.5–4.5 plateau'),
      achievements = coalesce(achievements, 'Eight years on these courts. PPR. Thursday night ladder regular.'),
      travel_radius_mi = coalesce(travel_radius_mi, 20),
      teaching_beginner = false,
      teaching_intermediate = true,
      teaching_advanced = true,
      teaching_juniors = false
    where user_id = 'seed:quinn'
  `;
	if (num((await sql`
    select count(*)::int as n from coach_services where coach_user_id = 'seed:quinn'
  `)[0]?.n ?? 0) === 0) await sql`
      insert into coach_services (coach_user_id, name, kind, sport, price_cents, unit, duration_min, notes)
      values
      ('seed:quinn', 'Private — kitchen and third shot', 'private', 'pickleball', 6000, 'hour', 60, 'Vidalia Rec. One hour. We drill the miss, then we play it under score.'),
      ('seed:quinn', 'Group clinic (up to 6)', 'group', 'pickleball', 2000, 'person', 90, 'Per person. Rec courts. Bring a paddle, I bring the structure.'),
      ('seed:quinn', 'Hitting hour', 'hitting', 'pickleball', 4500, 'hour', 60, 'Not a lesson. Balls, pace, and a partner who will not let you hide.')
    `;
	if (num((await sql`
    select count(*)::int as n from profiles where user_id = 'seed:pat'
  `)[0]?.n ?? 0) === 0) {
		await sql`
      insert into profiles (
        user_id, display_name, city, bio, plays_tennis, plays_pickleball,
        tennis_level, pickleball_level, looking_for_partners, looking_for_coach,
        interested_in_leagues, is_coach, availability, onboarded
      ) values (
        'seed:pat', 'Pat', 'Vidalia',
        'Tennis first. Adult beginners and juniors after school at the high school courts.',
        true, false, '3.5', null, false, false, true, true, 'Weekday afternoons, Saturday morning', true
      )
    `;
		await sql`
      insert into coach_profiles (
        user_id, headline, philosophy, hourly_rate, certifications,
        offers_private, offers_group, accepting, years_coaching,
        playing_level, specializations, achievements, travel_radius_mi,
        teaching_beginner, teaching_intermediate, teaching_advanced, teaching_juniors
      ) values (
        'seed:pat',
        'First serve. First volley. Juniors and adult beginners.',
        'We do not skip the boring parts. Grip, toss, ready position. Then we play a game that uses them.',
        45, 'USPTA', true, true, true, 11,
        '3.5', 'Beginner tennis, juniors, adult restart',
        'Eleven years teaching the first year of tennis. High school after-school clinics.',
        15, true, true, false, true
      )
    `;
		await sql`
      insert into coach_services (coach_user_id, name, kind, sport, price_cents, unit, duration_min, notes)
      values
      ('seed:pat', 'Private beginner hour', 'private', 'tennis', 4500, 'hour', 60, 'Vidalia High after the bell, or Rec tennis. $25 school court fee is on top when we use the high school.'),
      ('seed:pat', 'Junior group (per player)', 'junior', 'tennis', 1500, 'person', 60, 'After school. Parent or coach on site. Per player.')
    `;
	}
}
async function ensurePlayerResumes(sql: Sql) {
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 4),
      pickleball_years = coalesce(pickleball_years, 4),
      pickleball_frequency = coalesce(pickleball_frequency, 'few_week'),
      dupr = coalesce(dupr, '3.62'),
      pickleball_experience = coalesce(pickleball_experience, 'Four years at Rec. Doubles, right side.'),
      pickleball_results = coalesce(pickleball_results, 'Thursday Night ladder. Stopped hiding on the left.'),
      experience = coalesce(experience, 'Four years at Rec. Doubles, right side.'),
      accomplishments = coalesce(accomplishments, 'Thursday Night ladder. Stopped hiding on the left.'),
      credit_coach_user_id = coalesce(credit_coach_user_id, 'seed:quinn'),
      coach_note = coalesce(coach_note, 'Quinn fixed my third shot. I stopped dumping at 10–10.')
    where user_id = 'seed:avery'
  `;
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 1),
      pickleball_years = coalesce(pickleball_years, 1),
      pickleball_frequency = coalesce(pickleball_frequency, 'weekly'),
      pickleball_times = coalesce(pickleball_times, 20),
      dupr = coalesce(dupr, '3.12'),
      pickleball_experience = coalesce(pickleball_experience, 'Picked up a paddle last spring. Sundays, then a clinic.'),
      pickleball_results = coalesce(pickleball_results, 'Moved off the Sunday beginner hour.'),
      experience = coalesce(experience, 'Picked up a paddle last spring. Sundays, then a clinic.'),
      accomplishments = coalesce(accomplishments, 'Moved off the Sunday beginner hour.'),
      credit_coach_user_id = coalesce(credit_coach_user_id, 'seed:quinn'),
      coach_note = coalesce(coach_note, 'Quinn made the kitchen make sense. Worth the group rate.')
    where user_id = 'seed:cam'
  `;
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 8),
      tennis_years = coalesce(tennis_years, 8),
      tennis_frequency = coalesce(tennis_frequency, 'weekly'),
      pickleball_years = coalesce(pickleball_years, 1),
      pickleball_times = coalesce(pickleball_times, 6),
      pickleball_frequency = coalesce(pickleball_frequency, 'handful'),
      utr = coalesce(utr, '4.2'),
      tennis_experience = coalesce(tennis_experience, 'High school tennis, then rec singles at Stockyard.'),
      tennis_results = coalesce(tennis_results, 'Stockyard singles, first season on the board.'),
      pickleball_experience = coalesce(pickleball_experience, 'Picked up a paddle last year when the tennis nets were busy. A handful of rec nights.'),
      experience = coalesce(experience, 'Tennis first. Pickleball when the nets are free.'),
      accomplishments = coalesce(accomplishments, 'Stockyard singles, first season on the board.')
    where user_id = 'seed:riley'
  `;
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 12),
      tennis_years = coalesce(tennis_years, 12),
      tennis_frequency = coalesce(tennis_frequency, 'few_week'),
      utr = coalesce(utr, '5.1'),
      tennis_experience = coalesce(tennis_experience, 'Hard-court singles. Wants a score, not a rally-until-we-are-tired.'),
      tennis_results = coalesce(tennis_results, 'Stockyard Singles. Holds a 4.0 on these courts.'),
      experience = coalesce(experience, 'Hard-court singles. Wants a score, not a rally-until-we-are-tired.'),
      accomplishments = coalesce(accomplishments, 'Stockyard Singles. Holds a 4.0 on these courts.')
    where user_id = 'seed:ellis'
  `;
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 10),
      pickleball_years = coalesce(pickleball_years, 10),
      pickleball_frequency = coalesce(pickleball_frequency, 'few_week'),
      dupr = coalesce(dupr, '4.05'),
      pickleball_experience = coalesce(pickleball_experience, 'Still plays Thursday nights. Coaches the rest of the week.'),
      experience = coalesce(experience, 'Still plays Thursday nights. Coaches the rest of the week.')
    where user_id = 'seed:quinn'
  `;
	await sql`
    update profiles set
      years_playing = coalesce(years_playing, 15),
      tennis_years = coalesce(tennis_years, 15),
      tennis_frequency = coalesce(tennis_frequency, 'weekly'),
      utr = coalesce(utr, '4.0'),
      tennis_experience = coalesce(tennis_experience, 'Adult beginners and juniors after the bell.'),
      experience = coalesce(experience, 'Adult beginners and juniors after the bell.')
    where user_id = 'seed:pat'
  `;
	if (num((await sql`
    select count(*)::int as n from profiles where user_id = 'seed:sam'
  `)[0]?.n ?? 0) === 0) await sql`
      insert into profiles (
        user_id, display_name, city, bio, plays_tennis, plays_pickleball,
        tennis_level, pickleball_level, looking_for_partners, looking_for_coach,
        interested_in_leagues, is_coach, availability, onboarded,
        years_playing, tennis_years, tennis_frequency, tennis_times, utr,
        tennis_experience, tennis_results, experience, accomplishments, credit_coach_user_id, coach_note
      ) values (
        'seed:sam', 'Sam', 'Vidalia',
        'High school after-school. First year of a real serve.',
        true, false, '2.5', null, true, true, true, false, 'Weekday afternoons', true,
        1, 1, 'weekly', 30, '2.8',
        'Started this year at the high school courts.',
        'Can hold a rally. Working on the toss.',
        'Started this year at the high school courts.',
        'Can hold a rally. Working on the toss.',
        'seed:pat', 'Pat does not skip the boring parts. Grip, toss, then a game that uses them.'
      )
    `;
	for (const [userId, code] of [
		["seed:avery", "avery"],
		["seed:cam", "cam"],
		["seed:riley", "riley"],
		["seed:ellis", "ellis"],
		["seed:quinn", "quinn"],
		["seed:pat", "pat"],
		["seed:sam", "sam"]
	]) await sql`
      update profiles set share_code = coalesce(share_code, ${code})
      where user_id = ${userId}
    `;
}
async function ensureCourtSlugs(sql: Sql) {
	const missing = await sql`
    select id, name from courts where slug is null
  `;
	for (const row of missing) {
		let slug = slugify(String(row.name)) || `court-${num(row.id)}`;
		if (num((await sql`
      select count(*)::int as n from courts where slug = ${slug} and id <> ${num(row.id)}
    `)[0]?.n ?? 0) > 0) slug = `${slug}-${num(row.id)}`;
		await sql`update courts set slug = ${slug} where id = ${num(row.id)}`;
	}
}
async function recordTake(sql: Sql, kind: string, amount: number, sourceUserId: string | null, relatedId: number | null, note: string) {
	if (amount <= 0) return;
	await sql`
    insert into platform_ledger (kind, amount_cents, source_user_id, related_id, note)
    values (${kind}, ${amount}, ${sourceUserId}, ${relatedId}, ${note})
  `;
}
async function settleTake(sql: Sql, opts: { kind: string; scheduled: number; payerUserId: string; relatedId: number; note: string }) {
	if (opts.scheduled <= 0) return {
		take: 0,
		creditUsed: 0
	};
	const row = await sql`
    select credit_cents, referred_by from profiles where user_id = ${opts.payerUserId} limit 1
  `;
	const available = num(row[0]?.credit_cents ?? 0);
	const creditUsed = Math.min(available, opts.scheduled);
	const take = opts.scheduled - creditUsed;
	if (creditUsed > 0) await sql`
      update profiles set credit_cents = credit_cents - ${creditUsed}
      where user_id = ${opts.payerUserId}
    `;
	await recordTake(sql, opts.kind, take, opts.payerUserId, opts.relatedId, opts.note);
	const referrer = row[0]?.referred_by == null ? null : String(row[0].referred_by);
	if (referrer && referrer !== opts.payerUserId && take > 0) {
		const bonus = takeCents(take, RALLY.referralPct);
		if (bonus > 0) {
			await sql`
        update profiles set credit_cents = credit_cents + ${bonus}
        where user_id = ${referrer}
      `;
			await sql`
        insert into referral_events (
          referrer_user_id, referred_user_id, kind, take_cents, credit_cents, related_id
        ) values (
          ${referrer}, ${opts.payerUserId}, ${opts.kind}, ${take}, ${bonus}, ${opts.relatedId}
        )
      `;
			await notify(sql, referrer, "Share credit", `Someone you brought onto Rally generated a fee. ${money(bonus)} off your next Rally take.`, "/app/you");
		}
	}
	return {
		take,
		creditUsed
	};
}
async function ensureShareCode(sql: Sql, userId: string, displayName: string) {
	const existing = await sql`
    select share_code from profiles where user_id = ${userId} limit 1
  `;
	if (existing[0]?.share_code) return String(existing[0].share_code);
	const base = slugify(displayName).replace(/-/g, "").slice(0, 12) || "player";
	const preferred = /lincoln/i.test(displayName) ? ["lincoln", base] : [base];
	for (let i = 0; i < 12; i += 1) {
		const code = i < preferred.length ? preferred[i]! : `${base}${i + 1}`;
		if (num((await sql`
      select count(*)::int as n from profiles where share_code = ${code}
    `)[0]?.n ?? 0) === 0) {
			await sql`update profiles set share_code = ${code} where user_id = ${userId}`;
			return code;
		}
	}
	const code = `${base}${Math.random().toString(36).slice(2, 6)}`;
	await sql`update profiles set share_code = ${code} where user_id = ${userId}`;
	return code;
}
function mapProof(r: Record<string, unknown>, sessions?: number): PlayerProof {
	return {
		user_id: String(r.user_id),
		display_name: String(r.display_name),
		pickleball_level: r.pickleball_level == null ? null : String(r.pickleball_level),
		tennis_level: r.tennis_level == null ? null : String(r.tennis_level),
		years_playing: r.years_playing == null ? null : num(r.years_playing),
		dupr: r.dupr == null ? null : String(r.dupr),
		utr: r.utr == null ? null : String(r.utr),
		experience: r.experience == null ? null : String(r.experience),
		accomplishments: r.accomplishments == null ? null : String(r.accomplishments),
		plays_tennis: r.plays_tennis == null ? undefined : bool(r.plays_tennis),
		plays_pickleball: r.plays_pickleball == null ? undefined : bool(r.plays_pickleball),
		tennis_years: r.tennis_years == null ? null : num(r.tennis_years),
		pickleball_years: r.pickleball_years == null ? null : num(r.pickleball_years),
		tennis_times: r.tennis_times == null ? null : num(r.tennis_times),
		pickleball_times: r.pickleball_times == null ? null : num(r.pickleball_times),
		tennis_frequency: r.tennis_frequency == null ? null : String(r.tennis_frequency),
		pickleball_frequency: r.pickleball_frequency == null ? null : String(r.pickleball_frequency),
		tennis_experience: r.tennis_experience == null ? null : String(r.tennis_experience),
		pickleball_experience: r.pickleball_experience == null ? null : String(r.pickleball_experience),
		tennis_results: r.tennis_results == null ? null : String(r.tennis_results),
		pickleball_results: r.pickleball_results == null ? null : String(r.pickleball_results),
		coach_note: r.coach_note == null ? null : String(r.coach_note),
		sessions,
		photo_data: r.photo_data == null ? null : String(r.photo_data)
	};
}
function billingOf(createdAt: unknown, stored: string, takeThisMonth: number): CoachBilling {
	let start;
	if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) start = createdAt;
	else start = new Date(String(createdAt ?? "").replace(" ", "T"));
	const ends = new Date(start.getTime() + RALLY.trialDays * 864e5);
	const inTrial = !Number.isNaN(start.getTime()) && Date.now() < ends.getTime();
	const plan = stored === "monthly" ? "monthly" : "percent";
	const y = ends.getFullYear();
	const m = String(ends.getMonth() + 1).padStart(2, "0");
	const d = String(ends.getDate()).padStart(2, "0");
	return {
		plan: inTrial ? "trial" : plan,
		stored: plan,
		trial_ends: `${y}-${m}-${d}`,
		in_trial: inTrial,
		take_this_month: takeThisMonth,
		cash_app_handle: null,
		venmo_handle: null
	};
}
async function notify(sql: Sql, userId: string, title: string, body: string, href: string | null) {
	if (userId.startsWith("seed:")) return;
	await sql`
    insert into notifications (user_id, title, body, href)
    values (${userId}, ${title}, ${body}, ${href})
  `;
}
function addDays(starts: string, days: number) {
	const [d, t = "00:00:00"] = starts.replace("T", " ").split(" ");
	const [y, m, dd] = d.split("-").map(Number);
	const dt = new Date(y, (m || 1) - 1, (dd || 1) + days);
	const p = (n: number) => String(n).padStart(2, "0");
	const time = t.length >= 8 ? t.slice(0, 8) : `${t}:00`.slice(0, 8);
	return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${time}`;
}
async function priceLesson(sql: Sql, opts: { durationMin: number; serviceId?: number | null; courtId?: number | null }) {
	let price = 0;
	let billing = "hour";
	let duration = opts.durationMin;
	let serviceId = opts.serviceId ?? null;
	if (opts.serviceId) {
		const svc = await sql`
      select price_cents, unit, duration_min from coach_services where id = ${opts.serviceId}
    `;
		if (svc[0]) {
			price = num(svc[0].price_cents);
			billing = String(svc[0].unit);
			duration = num(svc[0].duration_min) || opts.durationMin;
		}
	}
	let facilityFee = 0;
	let facilityCut = 0;
	if (opts.courtId) {
		const court = await sql`
      select coach_fee_cents, facility_cut_pct from courts where id = ${opts.courtId}
    `;
		if (court[0]) {
			facilityFee = num(court[0].coach_fee_cents ?? 0);
			facilityCut = Math.round(price * num(court[0].facility_cut_pct ?? 0) / 100);
		}
	}
	return {
		price,
		billing,
		duration,
		serviceId,
		facilityFee,
		facilityCut
	};
}
function mapProfile(r: Record<string, unknown>): Profile {
	return {
		user_id: String(r.user_id),
		display_name: String(r.display_name),
		city: String(r.city ?? "Vidalia"),
		bio: r.bio == null ? null : String(r.bio),
		plays_tennis: bool(r.plays_tennis),
		plays_pickleball: bool(r.plays_pickleball),
		tennis_level: r.tennis_level == null ? null : String(r.tennis_level),
		pickleball_level: r.pickleball_level == null ? null : String(r.pickleball_level),
		looking_for_partners: bool(r.looking_for_partners),
		looking_for_coach: bool(r.looking_for_coach),
		interested_in_leagues: bool(r.interested_in_leagues),
		is_coach: bool(r.is_coach),
		availability: r.availability == null ? null : String(r.availability),
		phone: r.phone == null ? null : String(r.phone),
		onboarded: bool(r.onboarded),
		years_playing: r.years_playing == null ? null : num(r.years_playing),
		dupr: r.dupr == null ? null : String(r.dupr),
		utr: r.utr == null ? null : String(r.utr),
		experience: r.experience == null ? null : String(r.experience),
		accomplishments: r.accomplishments == null ? null : String(r.accomplishments),
		tennis_years: r.tennis_years == null ? null : num(r.tennis_years),
		pickleball_years: r.pickleball_years == null ? null : num(r.pickleball_years),
		tennis_times: r.tennis_times == null ? null : num(r.tennis_times),
		pickleball_times: r.pickleball_times == null ? null : num(r.pickleball_times),
		tennis_frequency: r.tennis_frequency == null ? null : String(r.tennis_frequency),
		pickleball_frequency: r.pickleball_frequency == null ? null : String(r.pickleball_frequency),
		tennis_experience: r.tennis_experience == null ? null : String(r.tennis_experience),
		pickleball_experience: r.pickleball_experience == null ? null : String(r.pickleball_experience),
		tennis_results: r.tennis_results == null ? null : String(r.tennis_results),
		pickleball_results: r.pickleball_results == null ? null : String(r.pickleball_results),
		credit_coach_user_id: r.credit_coach_user_id == null ? null : String(r.credit_coach_user_id),
		credit_coach_name: r.credit_coach_name == null ? null : String(r.credit_coach_name),
		coach_note: r.coach_note == null ? null : String(r.coach_note),
		share_code: r.share_code == null ? null : String(r.share_code),
		referred_by: r.referred_by == null ? null : String(r.referred_by),
		credit_cents: num(r.credit_cents ?? 0),
		photo_data: r.photo_data == null ? null : String(r.photo_data),
		certs: parseCerts(r.certs_json),
		honors: parseHonors(r.honors_json)
	};
}
function publicOf(p: Profile): PublicProfile {
	const { phone: _phone, credit_cents: _c, referred_by: _r, share_code: _s, ...rest } = p;
	return rest;
}
export const bootstrap = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const rows = await sql`
      select p.*, c.display_name as credit_coach_name
      from profiles p
      left join profiles c on c.user_id = p.credit_coach_user_id
      where p.user_id = ${context.userId}
      limit 1
    `;
	const profile = rows[0] ? mapProfile(rows[0]) : null;
	if (profile?.is_coach) await sql`
        insert into coach_profiles (user_id) values (${context.userId})
        on conflict do nothing
      `;
	return {
		profile,
		courts: (await sql`select * from courts order by status, is_other, city, name`).map(mapCourt),
		userId: context.userId
	};
});
function mapCourt(r: Record<string, unknown>): Court {
	return {
		id: num(r.id),
		name: String(r.name),
		address: String(r.address),
		city: String(r.city),
		sports: String(r.sports),
		indoor: bool(r.indoor),
		court_count: num(r.court_count),
		surface: r.surface == null ? null : String(r.surface),
		lights: bool(r.lights),
		restrooms: bool(r.restrooms),
		access_notes: r.access_notes == null ? null : String(r.access_notes),
		typical_hours: r.typical_hours == null ? null : String(r.typical_hours),
		phone: r.phone == null ? null : String(r.phone),
		is_other: bool(r.is_other),
		lat: r.lat == null ? null : num(r.lat),
		lng: r.lng == null ? null : num(r.lng),
		manager_name: r.manager_name == null ? null : String(r.manager_name),
		manager_phone: r.manager_phone == null ? null : String(r.manager_phone),
		manager_email: r.manager_email == null ? null : String(r.manager_email),
		booking_mode: String(r.booking_mode ?? "claim"),
		player_fee_cents: num(r.player_fee_cents ?? 0),
		coach_fee_cents: num(r.coach_fee_cents ?? 0),
		facility_cut_pct: num(r.facility_cut_pct ?? 0),
		rules: r.rules == null ? null : String(r.rules),
		restrictions: r.restrictions == null ? null : String(r.restrictions),
		lights_until: r.lights_until == null ? null : String(r.lights_until),
		added_by: r.added_by == null ? null : String(r.added_by),
		region: String(r.region ?? "Toombs"),
		kind: String(r.kind ?? "public"),
		status: String(r.status ?? "open"),
		slug: r.slug == null ? null : String(r.slug),
		photo_data: r.photo_data == null ? null : String(r.photo_data)
	};
}
function mapService(r: Record<string, unknown>): CoachService {
	return {
		id: num(r.id),
		coach_user_id: String(r.coach_user_id),
		name: String(r.name),
		kind: String(r.kind),
		sport: String(r.sport),
		price_cents: num(r.price_cents),
		unit: String(r.unit ?? "hour"),
		duration_min: num(r.duration_min ?? 60),
		notes: r.notes == null ? null : String(r.notes),
		visibility: String(r.visibility ?? "public") === "player" ? "player" : "public"
	};
}
var profileInput = z.object({
	display_name: z.string().trim().min(1).max(80),
	city: z.string().trim().min(1).max(60).default("Vidalia"),
	bio: z.string().max(600).optional(),
	plays_tennis: z.boolean(),
	plays_pickleball: z.boolean(),
	tennis_level: z.string().optional(),
	pickleball_level: z.string().optional(),
	looking_for_partners: z.boolean(),
	looking_for_coach: z.boolean(),
	interested_in_leagues: z.boolean(),
	is_coach: z.boolean(),
	availability: z.string().max(240).optional(),
	phone: z.string().max(40).optional(),
	years_playing: z.coerce.number().min(0).max(80).optional(),
	dupr: z.string().max(12).optional(),
	utr: z.string().max(12).optional(),
	experience: z.string().max(400).optional(),
	accomplishments: z.string().max(400).optional(),
	tennis_years: z.coerce.number().min(0).max(80).optional(),
	pickleball_years: z.coerce.number().min(0).max(80).optional(),
	tennis_times: z.coerce.number().min(0).max(9999).optional(),
	pickleball_times: z.coerce.number().min(0).max(9999).optional(),
	tennis_frequency: z.string().max(20).optional(),
	pickleball_frequency: z.string().max(20).optional(),
	tennis_experience: z.string().max(400).optional(),
	pickleball_experience: z.string().max(400).optional(),
	tennis_results: z.string().max(400).optional(),
	pickleball_results: z.string().max(400).optional(),
	credit_coach_user_id: z.string().max(80).optional(),
	coach_note: z.string().max(240).optional(),
	referred_by: z.string().max(32).optional(),
	coach_code: z.string().max(32).optional(),
	photo_data: z.string().max(450000).optional(),
	certs: z.array(z.object({
		title: z.string().trim().max(80),
		issuer: z.string().trim().max(80).optional(),
		year: z.string().trim().max(12).optional()
	})).max(20).optional(),
	honors: z.array(z.object({
		title: z.string().trim().max(120),
		event: z.string().trim().max(120).optional(),
		year: z.string().trim().max(12).optional(),
		kind: z.enum(["title", "trophy", "competition"])
	})).max(30).optional()
});
export const saveProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(profileInput).handler(async ({ context, data }) => {
	const sql = await getSql();
	const tYears = data.plays_tennis ? data.tennis_years ?? null : null;
	const pYears = data.plays_pickleball ? data.pickleball_years ?? null : null;
	const yearBits = [tYears, pYears].filter((n): n is number => n != null);
	data.years_playing = yearBits.length ? Math.max(...yearBits) : data.years_playing;
	const stories = [
		data.plays_tennis ? data.tennis_experience : null,
		data.plays_pickleball ? data.pickleball_experience : null
	].filter(Boolean);
	if (stories.length) data.experience = stories.join("\n");
	const results = [
		data.plays_tennis ? data.tennis_results : null,
		data.plays_pickleball ? data.pickleball_results : null
	].filter(Boolean);
	if (results.length) data.accomplishments = results.join("\n");
	const photo = data.photo_data === undefined ? undefined : data.photo_data || null;
	if (photo && !photo.startsWith("data:image/")) throw new Error("Photo must be an image you upload.");
	const certsJson = JSON.stringify(parseCerts(JSON.stringify(data.certs ?? [])));
	const honorsJson = JSON.stringify(parseHonors(JSON.stringify(data.honors ?? [])));
	await sql`
      insert into profiles (
        user_id, display_name, city, bio, plays_tennis, plays_pickleball,
        tennis_level, pickleball_level, looking_for_partners, looking_for_coach,
        interested_in_leagues, is_coach, availability, phone, onboarded, updated_at,
        years_playing, dupr, utr, experience, accomplishments,
        tennis_years, pickleball_years, tennis_times, pickleball_times,
        tennis_frequency, pickleball_frequency, tennis_experience, pickleball_experience,
        tennis_results, pickleball_results, credit_coach_user_id, coach_note,
        photo_data, certs_json, honors_json
      ) values (
        ${context.userId}, ${data.display_name}, ${data.city}, ${data.bio ?? null},
        ${data.plays_tennis}, ${data.plays_pickleball}, ${data.tennis_level ?? null},
        ${data.pickleball_level ?? null}, ${data.looking_for_partners}, ${data.looking_for_coach},
        ${data.interested_in_leagues}, ${data.is_coach}, ${data.availability ?? null},
        ${data.phone ?? null}, true, now(),
        ${data.years_playing ?? null}, ${data.dupr ?? null}, ${data.utr ?? null},
        ${data.experience ?? null}, ${data.accomplishments ?? null},
        ${data.plays_tennis ? data.tennis_years ?? null : null},
        ${data.plays_pickleball ? data.pickleball_years ?? null : null},
        ${data.plays_tennis ? data.tennis_times ?? null : null},
        ${data.plays_pickleball ? data.pickleball_times ?? null : null},
        ${data.plays_tennis ? data.tennis_frequency ?? null : null},
        ${data.plays_pickleball ? data.pickleball_frequency ?? null : null},
        ${data.plays_tennis ? data.tennis_experience ?? null : null},
        ${data.plays_pickleball ? data.pickleball_experience ?? null : null},
        ${data.plays_tennis ? data.tennis_results ?? null : null},
        ${data.plays_pickleball ? data.pickleball_results ?? null : null},
        ${data.credit_coach_user_id || null}, ${data.coach_note ?? null},
        ${photo ?? null}, ${certsJson}, ${honorsJson}
      )
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        city = excluded.city,
        bio = excluded.bio,
        plays_tennis = excluded.plays_tennis,
        plays_pickleball = excluded.plays_pickleball,
        tennis_level = excluded.tennis_level,
        pickleball_level = excluded.pickleball_level,
        looking_for_partners = excluded.looking_for_partners,
        looking_for_coach = excluded.looking_for_coach,
        interested_in_leagues = excluded.interested_in_leagues,
        is_coach = excluded.is_coach,
        availability = excluded.availability,
        phone = excluded.phone,
        onboarded = true,
        years_playing = excluded.years_playing,
        dupr = excluded.dupr,
        utr = excluded.utr,
        experience = excluded.experience,
        accomplishments = excluded.accomplishments,
        tennis_years = excluded.tennis_years,
        pickleball_years = excluded.pickleball_years,
        tennis_times = excluded.tennis_times,
        pickleball_times = excluded.pickleball_times,
        tennis_frequency = excluded.tennis_frequency,
        pickleball_frequency = excluded.pickleball_frequency,
        tennis_experience = excluded.tennis_experience,
        pickleball_experience = excluded.pickleball_experience,
        tennis_results = excluded.tennis_results,
        pickleball_results = excluded.pickleball_results,
        credit_coach_user_id = excluded.credit_coach_user_id,
        coach_note = excluded.coach_note,
        photo_data = coalesce(excluded.photo_data, profiles.photo_data),
        certs_json = excluded.certs_json,
        honors_json = excluded.honors_json,
        updated_at = now()
    `;
	if (data.photo_data === "") await sql`update profiles set photo_data = null where user_id = ${context.userId}`;
	if (!data.is_coach) await sql`delete from coach_profiles where user_id = ${context.userId}`;
	else await sql`
        insert into coach_profiles (user_id) values (${context.userId})
        on conflict do nothing
      `;
	await ensureShareCode(sql, context.userId, data.display_name);
	const ref = (data.referred_by || "").trim().toLowerCase();
	if (ref) {
		const owner = await sql`
        select user_id from profiles
        where lower(share_code) = ${ref} and user_id <> ${context.userId}
        limit 1
      `;
		if (owner[0]) await sql`
          update profiles
          set referred_by = coalesce(referred_by, ${String(owner[0].user_id)})
          where user_id = ${context.userId}
        `;
	}
	const coachCode = (data.coach_code || "").trim().toLowerCase();
	if (coachCode) {
		const coach = await sql`
        select user_id, display_name from profiles
        where lower(share_code) = ${coachCode}
          and is_coach = true
          and onboarded = true
          and user_id <> ${context.userId}
          and user_id not like 'seed:%'
        limit 1
      `;
		if (coach[0]) {
			const coachId = String(coach[0].user_id);
			await sql`
        update profiles
        set
          credit_coach_user_id = coalesce(credit_coach_user_id, ${coachId}),
          looking_for_coach = true,
          looking_for_partners = true
        where user_id = ${context.userId}
      `;
			const joiner = await sql`
        select display_name from profiles where user_id = ${context.userId} limit 1
      `;
			await notify(
				sql,
				coachId,
				"New player from your invite",
				`${joiner[0]?.display_name ?? "A player"} joined Rally from your QR / link. They are on your list and looking for hitting partners too.`,
				"/app/desk",
			);
		}
	}
	return mapProfile((await sql`
      select p.*, c.display_name as credit_coach_name
      from profiles p
      left join profiles c on c.user_id = p.credit_coach_user_id
      where p.user_id = ${context.userId}
      limit 1
    `)[0]);
});
export const listPartners = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	return (await sql`
      select p.*, c.display_name as credit_coach_name
      from profiles p
      left join profiles c on c.user_id = p.credit_coach_user_id
      where p.onboarded = true and p.looking_for_partners = true
        and p.user_id <> ${context.userId}
        and p.user_id not like 'seed:%'
      order by p.display_name
    `).map((r) => publicOf(mapProfile(r)));
});
export const listDirectory = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	return (await sql`
      select * from profiles
      where onboarded = true and user_id <> ${context.userId} and user_id not like 'seed:%'
      order by display_name
    `).map((r) => publicOf(mapProfile(r)));
});
export const listSessions = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	return (await sql`
      select
        s.id, s.host_user_id, s.court_id, s.title, s.sport, s.format,
        s.starts_at::text as starts_at, s.duration_min, s.skill_min, s.skill_max, s.spots, s.notes,
        c.name as court_name,
        p.display_name as host_name,
        (select count(*)::int from session_rsvps r where r.session_id = s.id and r.status = 'going') as going,
        exists(select 1 from session_rsvps r where r.session_id = s.id and r.user_id = ${context.userId} and r.status = 'going') as mine
      from sessions s
      left join courts c on c.id = s.court_id
      left join profiles p on p.user_id = s.host_user_id
      where s.starts_at > now() - interval '2 hours'
      order by s.starts_at
    `).map((r) => ({
		id: num(r.id),
		host_user_id: r.host_user_id == null ? null : String(r.host_user_id),
		host_name: r.host_name == null ? "Vidalia Rec" : String(r.host_name),
		court_id: r.court_id == null ? null : num(r.court_id),
		court_name: r.court_name == null ? null : String(r.court_name),
		title: String(r.title),
		sport: String(r.sport),
		format: String(r.format),
		starts_at: String(r.starts_at),
		duration_min: num(r.duration_min),
		skill_min: r.skill_min == null ? null : String(r.skill_min),
		skill_max: r.skill_max == null ? null : String(r.skill_max),
		spots: num(r.spots),
		going: num(r.going),
		notes: r.notes == null ? null : String(r.notes),
		mine: bool(r.mine)
	}));
});
export const createSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	title: z.string().trim().min(2).max(80),
	sport: sportZ,
	format: z.string().min(1),
	starts_at: z.string().min(10),
	duration_min: z.coerce.number().min(30).max(240),
	court_id: z.coerce.number(),
	skill_min: z.string().optional(),
	skill_max: z.string().optional(),
	spots: z.coerce.number().min(2).max(32),
	notes: z.string().max(400).optional()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const starts = data.starts_at.replace("T", " ");
	const id = num((await sql`
      insert into sessions (host_user_id, court_id, title, sport, format, starts_at, duration_min, skill_min, skill_max, spots, notes)
      values (
        ${context.userId}, ${data.court_id}, ${data.title}, ${data.sport}, ${data.format},
        ${starts}::timestamp, ${data.duration_min}, ${data.skill_min ?? null}, ${data.skill_max ?? null},
        ${data.spots}, ${data.notes ?? null}
      )
      returning id
    `)[0].id);
	await sql`
      insert into session_rsvps (session_id, user_id, status) values (${id}, ${context.userId}, 'going')
    `;
	return { id };
});
export const rsvpSession = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	session_id: z.coerce.number(),
	going: z.boolean()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	if (data.going) {
		const row = (await sql`
        select spots,
          (select count(*)::int from session_rsvps r where r.session_id = s.id and r.status = 'going') as going
        from sessions s where id = ${data.session_id}
      `)[0];
		if (!row) throw new Error("Session not found");
		if (num(row.going) >= num(row.spots)) throw new Error("That session is full.");
		await sql`
        insert into session_rsvps (session_id, user_id, status)
        values (${data.session_id}, ${context.userId}, 'going')
        on conflict (session_id, user_id) do update set status = 'going'
      `;
	} else await sql`
        update session_rsvps set status = 'cancelled'
        where session_id = ${data.session_id} and user_id = ${context.userId}
      `;
	return { ok: true };
});
export const listReservations = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	return (await sql`
          select r.id, r.court_id, r.user_id, r.sport, r.starts_at::text as starts_at, r.ends_at::text as ends_at,
                 r.status, r.notes, r.fee_cents, r.for_coaching, r.rally_take_cents, c.name as court_name, p.display_name as holder_name
          from reservations r
          join courts c on c.id = r.court_id
          left join profiles p on p.user_id = r.user_id
          where r.status in ('confirmed', 'pending') and r.ends_at > now()
          order by r.starts_at
        `).map((r) => ({
		id: num(r.id),
		court_id: num(r.court_id),
		court_name: String(r.court_name),
		user_id: String(r.user_id),
		holder_name: r.holder_name == null ? "Player" : String(r.holder_name),
		sport: String(r.sport),
		starts_at: String(r.starts_at),
		ends_at: String(r.ends_at),
		status: String(r.status),
		notes: r.notes == null ? null : String(r.notes),
		mine: String(r.user_id) === context.userId,
		fee_cents: num(r.fee_cents ?? 0),
		for_coaching: bool(r.for_coaching),
		rally_take_cents: num(r.rally_take_cents ?? 0)
	}));
});
export const createReservation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	court_id: z.coerce.number(),
	sport: sportZ,
	starts_at: z.string().min(10),
	duration_min: z.coerce.number().min(30).max(180),
	notes: z.string().max(240).optional(),
	for_coaching: z.boolean().optional()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const starts = data.starts_at.replace("T", " ");
	const court = (await sql`select * from courts where id = ${data.court_id}`)[0];
	if (!court) throw new Error("Court not found");
	const mapped = mapCourt(court);
	if (mapped.status === "coming") throw new Error("That facility is not open yet. Watch the board, or call the manager.");
	if (mapped.booking_mode === "walkup") throw new Error("Walk-up court. No reservation — show up, or log a private court you already have a key to.");
	if (!mapped.is_other && mapped.booking_mode !== "walkup") {
		if (num((await sql`
        select count(*)::int as n from reservations
        where court_id = ${data.court_id}
          and status in ('confirmed', 'pending')
          and starts_at < (${starts}::timestamp + make_interval(mins => ${data.duration_min}))
          and ends_at > ${starts}::timestamp
      `)[0]?.n ?? 0) > 0) throw new Error("That window is already claimed. Pick another time, or call the manager.");
	}
	const fee = mapped.player_fee_cents + (data.for_coaching ? mapped.coach_fee_cents : 0);
	const scheduled = takeCents(fee, RALLY.courtPct);
	const status = mapped.booking_mode === "call" ? "pending" : "confirmed";
	const inserted = await sql`
      insert into reservations (court_id, user_id, sport, starts_at, ends_at, notes, status, fee_cents, for_coaching, rally_take_cents)
      values (
        ${data.court_id}, ${context.userId}, ${data.sport},
        ${starts}::timestamp,
        ${starts}::timestamp + make_interval(mins => ${data.duration_min}),
        ${data.notes ?? null}, ${status}, ${fee}, ${data.for_coaching ?? false}, ${scheduled}
      )
      returning id
    `;
	const settled = await settleTake(sql, {
		kind: "court_fee",
		payerUserId: context.userId,
		scheduled,
		relatedId: num(inserted[0]?.id ?? 0),
		note: `${mapped.name} · facility ${fee} · Rally ${scheduled}`
	});
	if (settled.take !== scheduled) await sql`update reservations set rally_take_cents = ${settled.take} where id = ${num(inserted[0]?.id ?? 0)}`;
	const take = settled.take;
	if (status === "pending") {
		const who = mapped.manager_name ?? "the facility";
		const phone = mapped.manager_phone ? ` Call ${mapped.manager_phone}.` : "";
		const bits = [];
		if (mapped.player_fee_cents > 0) bits.push(`player fee $${mapped.player_fee_cents / 100}`);
		if (mapped.coach_fee_cents > 0) bits.push(`coach court fee $${mapped.coach_fee_cents / 100}`);
		if (take > 0) bits.push(`Rally $${(take / 100).toFixed(take % 100 === 0 ? 0 : 2)}`);
		const feeLine = bits.length > 0 ? ` ${bits.join(" · ")}.` : "";
		await notify(sql, context.userId, `Call ${who} to lock ${mapped.name}`, `Rally held the window as pending.${phone}${feeLine}`, "/app/courts");
	}
	return {
		ok: true,
		status,
		fee_cents: fee,
		rally_take_cents: take,
		credit_used_cents: settled.creditUsed,
		manager_phone: mapped.manager_phone
	};
});
export const cancelReservation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({ id: z.coerce.number() })).handler(async ({ context, data }) => {
	await (await getSql())`
      update reservations set status = 'cancelled'
      where id = ${data.id} and user_id = ${context.userId}
    `;
	return { ok: true };
});
export const listCoaches = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
	const sql = await getSql();
	await ensureSeed(sql);
	const rows = await sql`
      select p.user_id, p.display_name, p.city, p.bio, p.plays_tennis, p.plays_pickleball,
             p.photo_data, p.certs_json, p.honors_json,
             c.headline, c.philosophy, c.hourly_rate, c.certifications,
             c.offers_private, c.offers_group, c.accepting, c.years_coaching,
             c.playing_level, c.specializations, c.achievements, c.travel_radius_mi,
             c.teaching_beginner, c.teaching_intermediate, c.teaching_advanced, c.teaching_juniors
      from coach_profiles c
      join profiles p on p.user_id = c.user_id
      where p.onboarded = true and p.is_coach = true and p.user_id not like 'seed:%'
      order by c.accepting desc, p.display_name
    `;
	const services = await sql`select * from coach_services order by price_cents`;
	const byCoach = /* @__PURE__ */ new Map();
	for (const s of services) {
		const mapped = mapService(s);
		if (!serviceIsPublic(mapped.visibility)) continue;
		const uid = String(s.coach_user_id);
		const list = byCoach.get(uid) ?? [];
		list.push(mapped);
		byCoach.set(uid, list);
	}
	const proofs = await sql`
      select user_id, display_name, plays_tennis, plays_pickleball, pickleball_level, tennis_level,
             years_playing, dupr, utr, experience, accomplishments, coach_note, credit_coach_user_id,
             photo_data,
             tennis_years, pickleball_years, tennis_times, pickleball_times, tennis_frequency,
             pickleball_frequency, tennis_experience, pickleball_experience, tennis_results, pickleball_results
      from profiles
      where credit_coach_user_id is not null and onboarded = true
      order by display_name
    `;
	const byCredit = /* @__PURE__ */ new Map();
	for (const p of proofs) {
		const cid = String(p.credit_coach_user_id);
		const list = byCredit.get(cid) ?? [];
		list.push(mapProof(p));
		byCredit.set(cid, list);
	}
	return rows.map((r) => {
		const svc = byCoach.get(String(r.user_id)) ?? [];
		const from = publicFromCents(svc) ?? (r.hourly_rate == null ? null : num(r.hourly_rate) * 100);
		return {
			user_id: String(r.user_id),
			display_name: String(r.display_name),
			city: String(r.city),
			bio: r.bio == null ? null : String(r.bio),
			plays_tennis: bool(r.plays_tennis),
			plays_pickleball: bool(r.plays_pickleball),
			headline: r.headline == null ? null : String(r.headline),
			philosophy: r.philosophy == null ? null : String(r.philosophy),
			hourly_rate: r.hourly_rate == null ? null : num(r.hourly_rate),
			certifications: r.certifications == null ? null : String(r.certifications),
			offers_private: bool(r.offers_private),
			offers_group: bool(r.offers_group),
			accepting: bool(r.accepting),
			years_coaching: r.years_coaching == null ? null : num(r.years_coaching),
			playing_level: r.playing_level == null ? null : String(r.playing_level),
			specializations: r.specializations == null ? null : String(r.specializations),
			achievements: r.achievements == null ? null : String(r.achievements),
			travel_radius_mi: r.travel_radius_mi == null ? null : num(r.travel_radius_mi),
			teaching_beginner: bool(r.teaching_beginner ?? true),
			teaching_intermediate: bool(r.teaching_intermediate ?? true),
			teaching_advanced: bool(r.teaching_advanced ?? true),
			teaching_juniors: bool(r.teaching_juniors),
			services: svc,
			from_cents: from,
			students: byCredit.get(String(r.user_id)) ?? [],
			photo_data: r.photo_data == null ? null : String(r.photo_data),
			certs: parseCerts(r.certs_json).length
				? parseCerts(r.certs_json)
				: parseCerts(r.certifications ? JSON.stringify([{ title: String(r.certifications) }]) : "[]"),
			honors: parseHonors(r.honors_json).length
				? parseHonors(r.honors_json)
				: parseHonors(r.achievements ? JSON.stringify([{ title: String(r.achievements), kind: "title" }]) : "[]")
		};
	});
});
export const getCoachDesk = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const coach = await sql`
      select * from coach_profiles where user_id = ${context.userId} limit 1
    `;
	const lessons = await loadLessons(sql, { coach: context.userId });
	const roster = await sql`
      select p.user_id, p.display_name, count(*)::int as n,
             p.plays_tennis, p.plays_pickleball, p.pickleball_level, p.tennis_level, p.years_playing, p.dupr, p.utr,
             p.experience, p.accomplishments, p.coach_note,
             p.tennis_years, p.pickleball_years, p.tennis_times, p.pickleball_times, p.tennis_frequency,
             p.pickleball_frequency, p.tennis_experience, p.pickleball_experience, p.tennis_results, p.pickleball_results
      from lessons l
      join profiles p on p.user_id = l.player_user_id
      where l.coach_user_id = ${context.userId} and l.status in ('confirmed', 'checked_in', 'completed')
      group by p.user_id, p.display_name, p.plays_tennis, p.plays_pickleball, p.pickleball_level, p.tennis_level, p.years_playing,
               p.dupr, p.utr, p.experience, p.accomplishments, p.coach_note,
               p.tennis_years, p.pickleball_years, p.tennis_times, p.pickleball_times, p.tennis_frequency,
               p.pickleball_frequency, p.tennis_experience, p.pickleball_experience, p.tennis_results, p.pickleball_results
      order by n desc
    `;
	const credited = await sql`
      select user_id, display_name, plays_tennis, plays_pickleball, pickleball_level, tennis_level, years_playing, dupr, utr,
             experience, accomplishments, coach_note,
             tennis_years, pickleball_years, tennis_times, pickleball_times, tennis_frequency,
             pickleball_frequency, tennis_experience, pickleball_experience, tennis_results, pickleball_results
      from profiles
      where credit_coach_user_id = ${context.userId} and onboarded = true
      order by display_name
    `;
	const services = await sql`select * from coach_services where coach_user_id = ${context.userId} order by price_cents`;
	const thisWeek = await sql`
      select count(*)::int as n from lessons
      where coach_user_id = ${context.userId}
        and status in ('confirmed', 'checked_in')
        and starts_at >= now()
        and starts_at < now() + interval '7 days'
    `;
	const nextWeek = await sql`
      select count(*)::int as n from lessons
      where coach_user_id = ${context.userId}
        and status in ('confirmed', 'checked_in')
        and starts_at >= now() + interval '7 days'
        and starts_at < now() + interval '14 days'
    `;
	const books = await sql`
      select kind, coalesce(sum(amount_cents),0)::int as total
      from coach_ledger
      where coach_user_id = ${context.userId}
        and occurred_on >= date_trunc('month', current_date)
      group by kind
    `;
	const ledger = await sql`
      select id, kind, category, amount_cents, occurred_on::text as occurred_on, note
      from coach_ledger
      where coach_user_id = ${context.userId}
      order by occurred_on desc, id desc
      limit 30
    `;
	const income = num(books.find((b) => String(b.kind) === "income")?.total ?? 0);
	const expense = num(books.find((b) => String(b.kind) === "expense")?.total ?? 0);
	const takeMonth = await sql`
      select coalesce(sum(amount_cents),0)::int as n from coach_ledger
      where coach_user_id = ${context.userId}
        and category in ('rally_take', 'rally_monthly')
        and occurred_on >= date_trunc('month', current_date)
    `;
	const billing = {
		...billingOf(coach[0]?.created_at, String(coach[0]?.billing_plan ?? "percent"), num(takeMonth[0]?.n ?? 0)),
		cash_app_handle: coach[0]?.cash_app_handle == null || String(coach[0].cash_app_handle).trim() === ""
			? null
			: String(coach[0].cash_app_handle),
		venmo_handle: coach[0]?.venmo_handle == null || String(coach[0].venmo_handle).trim() === ""
			? null
			: String(coach[0].venmo_handle)
	};
	return {
		coach: coach[0] ? {
			headline: coach[0].headline == null ? "" : String(coach[0].headline),
			philosophy: coach[0].philosophy == null ? "" : String(coach[0].philosophy),
			hourly_rate: coach[0].hourly_rate == null ? null : num(coach[0].hourly_rate),
			certifications: coach[0].certifications == null ? "" : String(coach[0].certifications),
			offers_private: bool(coach[0].offers_private),
			offers_group: bool(coach[0].offers_group),
			accepting: bool(coach[0].accepting),
			years_coaching: coach[0].years_coaching == null ? null : num(coach[0].years_coaching),
			playing_level: coach[0].playing_level == null ? "" : String(coach[0].playing_level),
			specializations: coach[0].specializations == null ? "" : String(coach[0].specializations),
			achievements: coach[0].achievements == null ? "" : String(coach[0].achievements),
			travel_radius_mi: coach[0].travel_radius_mi == null ? null : num(coach[0].travel_radius_mi),
			teaching_beginner: bool(coach[0].teaching_beginner ?? true),
			teaching_intermediate: bool(coach[0].teaching_intermediate ?? true),
			teaching_advanced: bool(coach[0].teaching_advanced ?? true),
			teaching_juniors: bool(coach[0].teaching_juniors)
		} : null,
		lessons,
		roster: roster.map((r) => mapProof(r, num(r.n))),
		credited: credited.map((r) => mapProof(r)),
		billing,
		services: services.map(mapService),
		pipeline: {
			thisWeek: num(thisWeek[0]?.n ?? 0),
			nextWeek: num(nextWeek[0]?.n ?? 0),
			gap: num(thisWeek[0]?.n ?? 0) >= 2 && num(nextWeek[0]?.n ?? 0) === 0
		},
		books: {
			income,
			expense,
			net: income - expense,
			rows: ledger.map((r) => ({
				id: num(r.id),
				kind: String(r.kind),
				category: String(r.category),
				amount_cents: num(r.amount_cents),
				occurred_on: String(r.occurred_on).slice(0, 10),
				note: r.note == null ? null : String(r.note)
			}))
		}
	};
});
export const saveCoachProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	headline: z.string().max(120).optional(),
	philosophy: z.string().max(800).optional(),
	hourly_rate: z.coerce.number().min(0).max(400).optional(),
	certifications: z.string().max(200).optional(),
	offers_private: z.boolean(),
	offers_group: z.boolean(),
	accepting: z.boolean(),
	years_coaching: z.coerce.number().min(0).max(60).optional(),
	playing_level: z.string().max(20).optional(),
	specializations: z.string().max(240).optional(),
	achievements: z.string().max(400).optional(),
	travel_radius_mi: z.coerce.number().min(0).max(200).optional(),
	teaching_beginner: z.boolean(),
	teaching_intermediate: z.boolean(),
	teaching_advanced: z.boolean(),
	teaching_juniors: z.boolean()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	await sql`
      update profiles set is_coach = true, updated_at = now() where user_id = ${context.userId}
    `;
	await sql`
      insert into coach_profiles (
        user_id, headline, philosophy, hourly_rate, certifications,
        offers_private, offers_group, accepting, years_coaching,
        playing_level, specializations, achievements, travel_radius_mi,
        teaching_beginner, teaching_intermediate, teaching_advanced, teaching_juniors
      ) values (
        ${context.userId}, ${data.headline ?? null}, ${data.philosophy ?? null},
        ${data.hourly_rate ?? null}, ${data.certifications ?? null},
        ${data.offers_private}, ${data.offers_group}, ${data.accepting}, ${data.years_coaching ?? null},
        ${data.playing_level ?? null}, ${data.specializations ?? null}, ${data.achievements ?? null},
        ${data.travel_radius_mi ?? null},
        ${data.teaching_beginner}, ${data.teaching_intermediate}, ${data.teaching_advanced}, ${data.teaching_juniors}
      )
      on conflict (user_id) do update set
        headline = excluded.headline,
        philosophy = excluded.philosophy,
        hourly_rate = excluded.hourly_rate,
        certifications = excluded.certifications,
        offers_private = excluded.offers_private,
        offers_group = excluded.offers_group,
        accepting = excluded.accepting,
        years_coaching = excluded.years_coaching,
        playing_level = excluded.playing_level,
        specializations = excluded.specializations,
        achievements = excluded.achievements,
        travel_radius_mi = excluded.travel_radius_mi,
        teaching_beginner = excluded.teaching_beginner,
        teaching_intermediate = excluded.teaching_intermediate,
        teaching_advanced = excluded.teaching_advanced,
        teaching_juniors = excluded.teaching_juniors
    `;
	return { ok: true };
});
export const saveCoachBilling = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({ plan: z.enum(["percent", "monthly"]) })).handler(async ({ context, data }) => {
	await (await getSql())`
      update coach_profiles set billing_plan = ${data.plan}
      where user_id = ${context.userId}
    `;
	return { ok: true };
});
export const saveCoachPayHandles = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	cash_app: z.string().max(80).optional(),
	venmo: z.string().max(80).optional()
})).handler(async ({ context, data }) => {
	const cash = cleanCashAppHandle(data.cash_app ?? "");
	const venmo = cleanVenmoHandle(data.venmo ?? "");
	const sql = await getSql();
	await sql`update profiles set is_coach = true, updated_at = now() where user_id = ${context.userId}`;
	await sql`
      insert into coach_profiles (user_id) values (${context.userId})
      on conflict do nothing
    `;
	await sql`
      update coach_profiles
      set cash_app_handle = ${cash || null}, venmo_handle = ${venmo || null}
      where user_id = ${context.userId}
    `;
	return { ok: true, cash_app: cash || null, venmo: venmo || null };
});
async function loadLessons(sql: Sql, who: { coach?: string; player?: string }): Promise<LessonRow[]> {
	return (who.coach ? await sql`
        select l.id, l.coach_user_id, l.player_user_id, l.court_id, l.starts_at::text as starts_at,
               l.duration_min, l.sport, l.status, l.notes, l.price_cents, l.billing, l.group_spots,
               l.series_id, l.facility_fee_cents, l.facility_cut_cents, l.rally_take_cents,
               l.for_kind, l.for_name,
               c.name as court_name, pc.display_name as coach_name, pp.display_name as player_name,
               sv.name as service_name
        from lessons l
        left join courts c on c.id = l.court_id
        left join profiles pc on pc.user_id = l.coach_user_id
        left join profiles pp on pp.user_id = l.player_user_id
        left join coach_services sv on sv.id = l.service_id
        where l.coach_user_id = ${who.coach}
        order by l.starts_at desc
        limit 40
      ` : await sql`
        select l.id, l.coach_user_id, l.player_user_id, l.court_id, l.starts_at::text as starts_at,
               l.duration_min, l.sport, l.status, l.notes, l.price_cents, l.billing, l.group_spots,
               l.series_id, l.facility_fee_cents, l.facility_cut_cents, l.rally_take_cents,
               l.for_kind, l.for_name,
               c.name as court_name, pc.display_name as coach_name, pp.display_name as player_name,
               sv.name as service_name
        from lessons l
        left join courts c on c.id = l.court_id
        left join profiles pc on pc.user_id = l.coach_user_id
        left join profiles pp on pp.user_id = l.player_user_id
        left join coach_services sv on sv.id = l.service_id
        where l.player_user_id = ${who.player}
        order by l.starts_at desc
        limit 40
      `).map(mapLesson);
}

function mapLesson(r: Record<string, unknown>): LessonRow {
	return {
		id: num(r.id),
		coach_user_id: String(r.coach_user_id),
		coach_name: r.coach_name == null ? "Coach" : String(r.coach_name),
		player_user_id: String(r.player_user_id),
		player_name: r.player_name == null ? "Player" : String(r.player_name),
		court_id: r.court_id == null ? null : num(r.court_id),
		court_name: r.court_name == null ? null : String(r.court_name),
		starts_at: String(r.starts_at),
		duration_min: num(r.duration_min),
		sport: String(r.sport),
		status: String(r.status),
		notes: r.notes == null ? null : String(r.notes),
		price_cents: r.price_cents == null ? null : num(r.price_cents),
		billing: String(r.billing ?? "hour"),
		group_spots: r.group_spots == null ? null : num(r.group_spots),
		series_id: r.series_id == null ? null : String(r.series_id),
		facility_fee_cents: num(r.facility_fee_cents ?? 0),
		facility_cut_cents: num(r.facility_cut_cents ?? 0),
		service_name: r.service_name == null ? null : String(r.service_name),
		rally_take_cents: num(r.rally_take_cents ?? 0),
		for_kind: r.for_kind === "child" ? "child" : "self",
		for_name: r.for_name == null ? null : String(r.for_name)
	};
}
export const listMyLessons = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	return loadLessons(await getSql(), { player: context.userId });
});
export const getLessonScan = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const row = (await sql`
      select l.id, l.coach_user_id, l.player_user_id, l.court_id, l.starts_at::text as starts_at,
             l.duration_min, l.sport, l.status, l.notes, l.price_cents, l.billing, l.group_spots,
             l.series_id, l.facility_fee_cents, l.facility_cut_cents, l.rally_take_cents,
             l.for_kind, l.for_name,
             c.name as court_name, pc.display_name as coach_name, pp.display_name as player_name,
             sv.name as service_name,
             cp.cash_app_handle, cp.venmo_handle
      from lessons l
      left join courts c on c.id = l.court_id
      left join profiles pc on pc.user_id = l.coach_user_id
      left join profiles pp on pp.user_id = l.player_user_id
      left join coach_services sv on sv.id = l.service_id
      left join coach_profiles cp on cp.user_id = l.coach_user_id
      where l.id = ${data.id}
      limit 1
    `)[0];
	if (!row) throw new Error("Lesson not found");
	const lesson = mapLesson(row);
	if (context.userId !== lesson.coach_user_id && context.userId !== lesson.player_user_id) {
		throw new Error("This lesson is not yours.");
	}
	return {
		lesson,
		role: context.userId === lesson.coach_user_id ? "coach" as const : "player" as const,
		cash_app_handle: row.cash_app_handle == null || String(row.cash_app_handle).trim() === ""
			? null
			: String(row.cash_app_handle),
		venmo_handle: row.venmo_handle == null || String(row.venmo_handle).trim() === ""
			? null
			: String(row.venmo_handle)
	};
});
export const requestLesson = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	coach_user_id: z.string().min(1),
	sport: sportZ,
	starts_at: z.string().min(10),
	duration_min: z.coerce.number().min(30).max(180),
	court_id: z.coerce.number().optional(),
	notes: z.string().max(LESSON_NOTES_MAX).optional(),
	service_id: z.coerce.number().optional(),
	recur_weeks: z.coerce.number().min(1).max(12).optional(),
	for_kind: z.enum(["self", "child"]).optional(),
	for_name: z.string().trim().max(80).optional()
})).handler(async ({ context, data }) => {
	if (data.coach_user_id === context.userId) throw new Error("You cannot book yourself.");
	const sql = await getSql();
	const starts = data.starts_at.replace("T", " ");
	const priced = await priceLesson(sql, {
		serviceId: data.service_id,
		courtId: data.court_id,
		durationMin: data.duration_min
	});
	const weeks = data.recur_weeks && data.recur_weeks > 1 ? data.recur_weeks : 1;
	const series = weeks > 1 ? crypto.randomUUID() : null;
	const forKind = data.for_kind === "child" ? "child" : "self";
	const forName = forKind === "child" ? (data.for_name || "").trim() || null : null;
	if (forKind === "child" && !forName) throw new Error("Add the child's first name.");
	for (let i = 0; i < weeks; i += 1) {
		const when = i === 0 ? starts : addDays(starts, i * 7);
		await sql`
        insert into lessons (
          coach_user_id, player_user_id, court_id, starts_at, duration_min, sport, status, notes,
          service_id, price_cents, billing, series_id, facility_fee_cents, facility_cut_cents,
          for_kind, for_name
        ) values (
          ${data.coach_user_id}, ${context.userId}, ${data.court_id ?? null},
          ${when}::timestamp, ${priced.duration}, ${data.sport}, 'requested', ${data.notes ?? null},
          ${priced.serviceId}, ${priced.price}, ${priced.billing}, ${series},
          ${priced.facilityFee}, ${priced.facilityCut},
          ${forKind}, ${forName}
        )
      `;
	}
	const who = await sql`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `;
	const whoLine = forName ? `${who[0]?.display_name ?? "A parent"} for ${forName}` : (who[0]?.display_name ?? "A player");
	await notify(sql, data.coach_user_id, "Lesson request", `${whoLine} asked for ${data.sport}${weeks > 1 ? ` · ${weeks} weeks` : ""}.`, "/app/desk");
	return { ok: true };
});
export const logLesson = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	player_user_id: z.string().min(1),
	sport: sportZ,
	starts_at: z.string().min(10),
	duration_min: z.coerce.number().min(30).max(180),
	court_id: z.coerce.number().optional(),
	notes: z.string().max(LESSON_NOTES_MAX).optional(),
	service_id: z.coerce.number().optional(),
	recur_weeks: z.coerce.number().min(1).max(12).optional(),
	group_spots: z.coerce.number().min(1).max(16).optional(),
	for_kind: z.enum(["self", "child"]).optional(),
	for_name: z.string().trim().max(80).optional()
})).handler(async ({ context, data }) => {
	if (data.player_user_id === context.userId) throw new Error("Pick a student.");
	const sql = await getSql();
	await sql`update profiles set is_coach = true, updated_at = now() where user_id = ${context.userId}`;
	await sql`
      insert into coach_profiles (user_id) values (${context.userId})
      on conflict do nothing
    `;
	const starts = data.starts_at.replace("T", " ");
	const priced = await priceLesson(sql, {
		serviceId: data.service_id,
		courtId: data.court_id,
		durationMin: data.duration_min
	});
	const weeks = data.recur_weeks && data.recur_weeks > 1 ? data.recur_weeks : 1;
	const series = weeks > 1 ? crypto.randomUUID() : null;
	const forKind = data.for_kind === "child" ? "child" : "self";
	const forName = forKind === "child" ? (data.for_name || "").trim() || null : null;
	if (forKind === "child" && !forName) throw new Error("Add the child's first name.");
	for (let i = 0; i < weeks; i += 1) {
		const when = i === 0 ? starts : addDays(starts, i * 7);
		await sql`
        insert into lessons (
          coach_user_id, player_user_id, court_id, starts_at, duration_min, sport, status, notes,
          service_id, price_cents, billing, group_spots, series_id, facility_fee_cents, facility_cut_cents,
          for_kind, for_name
        ) values (
          ${context.userId}, ${data.player_user_id}, ${data.court_id ?? null},
          ${when}::timestamp, ${priced.duration}, ${data.sport}, 'confirmed', ${data.notes ?? null},
          ${priced.serviceId}, ${priced.price}, ${priced.billing}, ${data.group_spots ?? null}, ${series},
          ${priced.facilityFee}, ${priced.facilityCut},
          ${forKind}, ${forName}
        )
      `;
	}
	await notify(
		sql,
		data.player_user_id,
		weeks > 1 ? `Recurring lesson · ${weeks} weeks` : "Lesson on the books",
		forName ? `Your coach put a lesson for ${forName} on the board.` : "Your coach put a lesson on the board.",
		"/app/coaches",
	);
	return { ok: true };
});
export const saveLessonNotes = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	notes: z.string().max(LESSON_NOTES_MAX)
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const lesson = (await sql`
      select coach_user_id, player_user_id, status from lessons where id = ${data.id}
    `)[0];
	if (!lesson) throw new Error("Lesson not found");
	const coach = String(lesson.coach_user_id);
	const player = String(lesson.player_user_id);
	const gate = canActorSaveLessonNotes({
		actorId: context.userId,
		coachId: coach,
		status: String(lesson.status)
	});
	if (!gate.ok) throw new Error(gate.error);
	const notes = data.notes.trim() || null;
	await sql`update lessons set notes = ${notes} where id = ${data.id}`;
	const notice = lessonNotesNotice(notes);
	await notify(sql, player, notice.title, notice.body, notice.href);
	return { ok: true, notes };
});
export const setLessonStatus = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	status: z.enum([
		"confirmed",
		"declined",
		"cancelled",
		"completed",
		"checked_in"
	])
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const lesson = (await sql`
      select coach_user_id, player_user_id, price_cents, facility_fee_cents, facility_cut_cents, sport, status
      from lessons where id = ${data.id}
    `)[0];
	if (!lesson) throw new Error("Lesson not found");
	const coach = String(lesson.coach_user_id);
	const player = String(lesson.player_user_id);
	const gate = canActorSetLessonStatus({
		actorId: context.userId,
		coachId: coach,
		playerId: player,
		current: String(lesson.status),
		next: data.status
	});
	if (!gate.ok) throw new Error(gate.error);
	await sql`update lessons set status = ${data.status} where id = ${data.id}`;
	if (data.status === "confirmed") await notify(sql, player, "Lesson confirmed", `Your ${lesson.sport} lesson is on the board.`, "/app/coaches");
	else if (data.status === "declined") await notify(sql, player, "Lesson declined", "The coach declined that time. Try another window.", "/app/coaches");
	else if (data.status === "checked_in") {
		const other = context.userId === coach ? player : coach;
		await notify(
			sql,
			other,
			"Checked in",
			`${lesson.sport} lesson — scanned in.`,
			context.userId === coach ? "/app/coaches" : "/app/desk",
		);
	}
	else if (data.status === "completed") {
		const price = num(lesson.price_cents ?? 0);
		const fee = num(lesson.facility_fee_cents ?? 0);
		const cut = num(lesson.facility_cut_cents ?? 0);
		if (price > 0) await sql`
          insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
          values (${coach}, 'income', 'lesson', ${price}, 'Completed lesson', ${data.id})
        `;
		if (fee > 0) await sql`
          insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
          values (${coach}, 'expense', 'facility_fee', ${fee}, 'Court / facility fee', ${data.id})
        `;
		if (cut > 0) await sql`
          insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
          values (${coach}, 'expense', 'facility_cut', ${cut}, 'Facility cut', ${data.id})
        `;
		const facilityTake = takeCents(fee, RALLY.facilityPct) + takeCents(cut, RALLY.facilityPct);
		if (facilityTake > 0) await recordTake(sql, "facility", facilityTake, coach, data.id, "Rally share of facility fee/cut");
		const planRow = await sql`
        select billing_plan, created_at from coach_profiles where user_id = ${coach} limit 1
      `;
		const billing = billingOf(planRow[0]?.created_at, String(planRow[0]?.billing_plan ?? "percent"), 0);
		let lessonTake = 0;
		if (billing.plan === "percent" && price > 0) lessonTake = takeCents(price, RALLY.lessonPct);
		else if (billing.plan === "monthly") {
			if (num((await sql`
          select count(*)::int as n from coach_ledger
          where coach_user_id = ${coach} and category = 'rally_monthly'
            and occurred_on >= date_trunc('month', current_date)
        `)[0]?.n ?? 0) === 0) {
				const settled = await settleTake(sql, {
					kind: "coach_monthly",
					payerUserId: coach,
					scheduled: RALLY.monthlyCents,
					relatedId: data.id,
					note: "Monthly after trial"
				});
				if (settled.take + settled.creditUsed > 0) await sql`
              insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
              values (
                ${coach}, 'expense', 'rally_monthly', ${settled.take},
                ${settled.creditUsed ? "Rally monthly · share credit applied" : "Rally monthly after trial"},
                ${data.id}
              )
            `;
			}
		}
		if (lessonTake > 0) {
			const settled = await settleTake(sql, {
				kind: "lesson",
				payerUserId: coach,
				scheduled: lessonTake,
				relatedId: data.id,
				note: `Rally ${RALLY.lessonPct}% of lesson`
			});
			if (settled.take + settled.creditUsed > 0) {
				const takeNote = settled.creditUsed ? `Rally ${RALLY.lessonPct}% of lesson · share credit` : `Rally ${RALLY.lessonPct}% of lesson`;
				await sql`
            insert into coach_ledger (coach_user_id, kind, category, amount_cents, note, lesson_id)
            values (${coach}, 'expense', 'rally_take', ${settled.take}, ${takeNote}, ${data.id})
          `;
			}
			lessonTake = settled.take;
		}
		await sql`update lessons set rally_take_cents = ${(billing.plan === "monthly" ? 0 : lessonTake) + facilityTake} where id = ${data.id}`;
		await notify(
			sql,
			context.userId === coach ? player : coach,
			"Lesson complete",
			"Pay on Cash App or Venmo — same handles as the coach desk Books.",
			context.userId === coach ? "/app/coaches" : "/app/desk",
		);
	} else if (data.status === "cancelled") await notify(sql, context.userId === coach ? player : coach, "Lesson cancelled", "A lesson came off the board.", "/app/desk");
	return { ok: true };
});
export const sendPlayRequest = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	to_user_id: z.string().min(1),
	sport: sportZ,
	message: z.string().max(400).optional(),
	proposed_at: z.string().optional(),
	court_id: z.coerce.number().optional()
})).handler(async ({ context, data }) => {
	if (data.to_user_id === context.userId) throw new Error("That is you.");
	const sql = await getSql();
	const proposed = data.proposed_at ? data.proposed_at.replace("T", " ") : null;
	await sql`
      insert into play_requests (from_user_id, to_user_id, sport, message, proposed_at, court_id)
      values (
        ${context.userId}, ${data.to_user_id}, ${data.sport}, ${data.message ?? null},
        ${proposed}::timestamp, ${data.court_id ?? null}
      )
    `;
	return { ok: true };
});
export const listPlayRequests = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	return (await (await getSql())`
      select pr.id, pr.from_user_id, pr.to_user_id, pr.sport, pr.message,
             pr.proposed_at::text as proposed_at, pr.status, pr.created_at::text as created_at,
             pf.display_name as from_name, pt.display_name as to_name, c.name as court_name
      from play_requests pr
      left join profiles pf on pf.user_id = pr.from_user_id
      left join profiles pt on pt.user_id = pr.to_user_id
      left join courts c on c.id = pr.court_id
      where pr.from_user_id = ${context.userId} or pr.to_user_id = ${context.userId}
      order by pr.created_at desc
      limit 40
    `).map((r) => ({
		id: num(r.id),
		from_user_id: String(r.from_user_id),
		from_name: r.from_name == null ? "Player" : String(r.from_name),
		to_user_id: String(r.to_user_id),
		to_name: r.to_name == null ? "Player" : String(r.to_name),
		sport: String(r.sport),
		message: r.message == null ? null : String(r.message),
		proposed_at: r.proposed_at == null ? null : String(r.proposed_at),
		court_name: r.court_name == null ? null : String(r.court_name),
		status: String(r.status),
		created_at: String(r.created_at)
	}));
});
export const setPlayRequestStatus = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	status: z.enum(["accepted", "declined"])
})).handler(async ({ context, data }) => {
	await (await getSql())`
      update play_requests set status = ${data.status}
      where id = ${data.id} and to_user_id = ${context.userId} and status = 'pending'
    `;
	return { ok: true };
});
export const listLeagues = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	return (await sql`
      select l.id, l.owner_user_id, l.name, l.sport, l.format, l.skill_band, l.season_label,
             l.status, l.notes, l.reg_fee_cents,
             (select count(*)::int from league_members m where m.league_id = l.id) as member_count,
             exists(select 1 from league_members m where m.league_id = l.id and m.user_id = ${context.userId}) as joined
      from leagues l
      order by l.status, l.name
    `).map((r) => ({
		id: num(r.id),
		owner_user_id: r.owner_user_id == null ? null : String(r.owner_user_id),
		name: String(r.name),
		sport: String(r.sport),
		format: String(r.format),
		skill_band: r.skill_band == null ? null : String(r.skill_band),
		season_label: r.season_label == null ? null : String(r.season_label),
		status: String(r.status),
		notes: r.notes == null ? null : String(r.notes),
		member_count: num(r.member_count),
		joined: bool(r.joined),
		reg_fee_cents: num(r.reg_fee_cents ?? 0)
	}));
});
export const createLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	name: z.string().trim().min(3).max(80),
	sport: sportZ,
	format: z.enum(["round_robin", "ladder"]),
	skill_band: z.string().max(40).optional(),
	season_label: z.string().max(40).optional(),
	notes: z.string().max(400).optional(),
	reg_fee: z.coerce.number().min(0).max(200).optional()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const fee = Math.round((data.reg_fee ?? 0) * 100);
	const id = num((await sql`
      insert into leagues (owner_user_id, name, sport, format, skill_band, season_label, notes, reg_fee_cents)
      values (
        ${context.userId}, ${data.name}, ${data.sport}, ${data.format},
        ${data.skill_band ?? null}, ${data.season_label ?? null}, ${data.notes ?? null}, ${fee}
      )
      returning id
    `)[0].id);
	await sql`insert into league_members (league_id, user_id) values (${id}, ${context.userId})`;
	return { id };
});
export const joinLeague = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	join: z.boolean()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	if (data.join) {
		const fee = num((await sql`
        select reg_fee_cents from leagues where id = ${data.id}
      `)[0]?.reg_fee_cents ?? 0);
		const scheduled = takeCents(fee, RALLY.leaguePct);
		if ((await sql`
        insert into league_members (league_id, user_id, fee_cents, rally_take_cents)
        values (${data.id}, ${context.userId}, ${fee}, ${scheduled})
        on conflict do nothing
        returning league_id
      `)[0]) {
			const settled = await settleTake(sql, {
				kind: "league",
				payerUserId: context.userId,
				scheduled,
				relatedId: data.id,
				note: "League registration"
			});
			if (settled.take !== scheduled) await sql`
            update league_members set rally_take_cents = ${settled.take}
            where league_id = ${data.id} and user_id = ${context.userId}
          `;
		}
	} else await sql`
        delete from league_members where league_id = ${data.id} and user_id = ${context.userId}
      `;
	return { ok: true };
});
export const getLeague = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(z.object({ id: z.coerce.number() })).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const l = (await sql`select * from leagues where id = ${data.id}`)[0];
	if (!l) throw new Error("League not found");
	const members = await sql`
      select m.user_id, p.display_name, p.plays_tennis, p.plays_pickleball, p.pickleball_level, p.tennis_level, p.years_playing,
             p.dupr, p.utr, p.experience, p.accomplishments, p.coach_note,
             p.tennis_years, p.pickleball_years, p.tennis_times, p.pickleball_times, p.tennis_frequency,
             p.pickleball_frequency, p.tennis_experience, p.pickleball_experience, p.tennis_results, p.pickleball_results
      from league_members m
      join profiles p on p.user_id = m.user_id
      where m.league_id = ${data.id}
      order by p.display_name
    `;
	const matchRows = await sql`
      select m.id, m.league_id, m.sport, m.format, m.scheduled_at::text as scheduled_at,
             m.status, m.score, m.notes, c.name as court_name
      from matches m
      left join courts c on c.id = m.court_id
      where m.league_id = ${data.id}
      order by m.scheduled_at nulls last, m.id
    `;
	const sides = await sql`
      select ms.match_id, ms.user_id, ms.side, p.display_name
      from match_sides ms
      join matches m on m.id = ms.match_id
      join profiles p on p.user_id = ms.user_id
      where m.league_id = ${data.id}
    `;
	const byMatch = /* @__PURE__ */ new Map();
	for (const s of sides) {
		const id = num(s.match_id);
		const cur = byMatch.get(id) ?? {
			a: [],
			b: [],
			ai: [],
			bi: []
		};
		if (String(s.side) === "a") {
			cur.a.push(String(s.display_name));
			cur.ai.push(String(s.user_id));
		} else {
			cur.b.push(String(s.display_name));
			cur.bi.push(String(s.user_id));
		}
		byMatch.set(id, cur);
	}
	const matches = matchRows.map((m) => {
		const id = num(m.id);
		const s = byMatch.get(id) ?? {
			a: [],
			b: [],
			ai: [],
			bi: []
		};
		return {
			id,
			league_id: num(m.league_id),
			court_name: m.court_name == null ? null : String(m.court_name),
			sport: String(m.sport),
			format: String(m.format),
			scheduled_at: m.scheduled_at == null ? null : String(m.scheduled_at),
			status: String(m.status),
			score: m.score == null ? null : String(m.score),
			notes: m.notes == null ? null : String(m.notes),
			side_a: s.a,
			side_b: s.b,
			side_a_ids: s.ai,
			side_b_ids: s.bi
		};
	});
	return {
		league: {
			id: num(l.id),
			owner_user_id: l.owner_user_id == null ? null : String(l.owner_user_id),
			name: String(l.name),
			sport: String(l.sport),
			format: String(l.format),
			skill_band: l.skill_band == null ? null : String(l.skill_band),
			season_label: l.season_label == null ? null : String(l.season_label),
			status: String(l.status),
			notes: l.notes == null ? null : String(l.notes),
			member_count: members.length,
			joined: members.some((m) => String(m.user_id) === context.userId),
			reg_fee_cents: num(l.reg_fee_cents ?? 0)
		},
		members: members.map((m) => mapProof(m)),
		matches,
		userId: context.userId
	};
});
export const scheduleMatch = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	league_id: z.coerce.number(),
	format: z.enum(["singles", "doubles"]),
	scheduled_at: z.string().optional(),
	court_id: z.coerce.number().optional(),
	side_a: z.array(z.string()).min(1).max(2),
	side_b: z.array(z.string()).min(1).max(2)
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	if (((await sql`
      select count(*)::int as n from league_members
      where league_id = ${data.league_id} and user_id = ${context.userId}
    `)[0]?.n ?? 0) === 0) throw new Error("Join the league first.");
	const league = await sql`select sport from leagues where id = ${data.league_id}`;
	if (!league[0]) throw new Error("League not found");
	const scheduled = data.scheduled_at ? data.scheduled_at.replace("T", " ") : null;
	const id = num((await sql`
      insert into matches (league_id, court_id, sport, format, scheduled_at, status)
      values (
        ${data.league_id}, ${data.court_id ?? null}, ${String(league[0].sport)}, ${data.format},
        ${scheduled}::timestamp, 'scheduled'
      )
      returning id
    `)[0].id);
	for (const uid of data.side_a) await sql`insert into match_sides (match_id, user_id, side) values (${id}, ${uid}, 'a')`;
	for (const uid of data.side_b) await sql`insert into match_sides (match_id, user_id, side) values (${id}, ${uid}, 'b')`;
	return { id };
});
export const updateMatch = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	status: z.enum([
		"scheduled",
		"confirmed",
		"played",
		"cancelled"
	]).optional(),
	score: z.string().max(40).optional()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	if (((await sql`
      select count(*)::int as n from match_sides where match_id = ${data.id} and user_id = ${context.userId}
    `)[0]?.n ?? 0) === 0) throw new Error("Only players in the match can update it.");
	if (data.status) await sql`update matches set status = ${data.status} where id = ${data.id}`;
	if (data.score != null) await sql`update matches set score = ${data.score}, status = 'played' where id = ${data.id}`;
	return { ok: true };
});
export const listJournal = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	return (await (await getSql())`
      select id, kind, title, body, created_at::text as created_at
      from journal_entries
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `).map((r) => ({
		id: num(r.id),
		kind: String(r.kind),
		title: r.title == null ? null : String(r.title),
		body: String(r.body),
		created_at: String(r.created_at)
	}));
});
export const addJournal = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	kind: z.enum([
		"journal",
		"self_talk",
		"visualization",
		"reset"
	]),
	title: z.string().max(80).optional(),
	body: z.string().trim().min(1).max(2e3)
})).handler(async ({ context, data }) => {
	await (await getSql())`
      insert into journal_entries (user_id, kind, title, body)
      values (${context.userId}, ${data.kind}, ${data.title ?? null}, ${data.body})
    `;
	return { ok: true };
});
export const homeFeed = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const sessions = await sql`
      select s.id, s.title, s.sport, s.starts_at::text as starts_at, c.name as court_name
      from session_rsvps r
      join sessions s on s.id = r.session_id
      left join courts c on c.id = s.court_id
      where r.user_id = ${context.userId} and r.status = 'going' and s.starts_at > now() - interval '1 hour'
      order by s.starts_at
      limit 5
    `;
	const lessonsIn = await sql`
      select count(*)::int as n from lessons
      where coach_user_id = ${context.userId} and status = 'requested'
    `;
	const playIn = await sql`
      select count(*)::int as n from play_requests
      where to_user_id = ${context.userId} and status = 'pending'
    `;
	const res = await sql`
      select r.id, r.sport, r.starts_at::text as starts_at, r.status, c.name as court_name
      from reservations r
      join courts c on c.id = r.court_id
      where r.user_id = ${context.userId} and r.status in ('confirmed', 'pending') and r.ends_at > now()
      order by r.starts_at
      limit 5
    `;
	const upcomingOpen = await sql`
      select s.id, s.title, s.sport, s.starts_at::text as starts_at, c.name as court_name,
        (select count(*)::int from session_rsvps r where r.session_id = s.id and r.status = 'going') as going,
        s.spots
      from sessions s
      left join courts c on c.id = s.court_id
      where s.starts_at > now()
      order by s.starts_at
      limit 4
    `;
	const unread = await sql`
      select count(*)::int as n from notifications
      where user_id = ${context.userId} and read = false
    `;
	const pipeline = await sql`
      select
        (select count(*)::int from lessons
          where coach_user_id = ${context.userId} and status in ('confirmed', 'checked_in')
            and starts_at >= now() and starts_at < now() + interval '7 days') as this_week,
        (select count(*)::int from lessons
          where coach_user_id = ${context.userId} and status in ('confirmed', 'checked_in')
            and starts_at >= now() + interval '7 days' and starts_at < now() + interval '14 days') as next_week
    `;
	return {
		mySessions: sessions.map((s) => ({
			id: num(s.id),
			title: String(s.title),
			sport: String(s.sport),
			starts_at: String(s.starts_at),
			court_name: s.court_name == null ? null : String(s.court_name)
		})),
		pendingLessons: num(lessonsIn[0]?.n ?? 0),
		pendingPlay: num(playIn[0]?.n ?? 0),
		unread: num(unread[0]?.n ?? 0),
		pipelineGap: num(pipeline[0]?.this_week ?? 0) >= 2 && num(pipeline[0]?.next_week ?? 0) === 0,
		reservations: res.map((r) => ({
			id: num(r.id),
			sport: String(r.sport),
			starts_at: String(r.starts_at),
			court_name: String(r.court_name),
			status: String(r.status)
		})),
		openPlay: upcomingOpen.map((s) => ({
			id: num(s.id),
			title: String(s.title),
			sport: String(s.sport),
			starts_at: String(s.starts_at),
			court_name: s.court_name == null ? null : String(s.court_name),
			going: num(s.going),
			spots: num(s.spots)
		}))
	};
});
var courtSubmitZ = z.object({
	name: z.string().trim().min(3).max(80),
	address: z.string().trim().min(3).max(120),
	city: z.string().trim().min(2).max(60).default("Vidalia"),
	sports: z.string().min(1),
	court_count: z.coerce.number().min(1).max(24),
	surface: z.string().max(80).optional(),
	indoor: z.boolean(),
	lights: z.boolean(),
	restrooms: z.boolean(),
	kind: z.enum([
		"public",
		"club",
		"school",
		"private"
	]),
	booking_mode: z.enum([
		"claim",
		"call",
		"walkup"
	]),
	player_fee: z.coerce.number().min(0).max(200).optional(),
	coach_fee: z.coerce.number().min(0).max(200).optional(),
	facility_cut_pct: z.coerce.number().min(0).max(50).optional(),
	manager_name: z.string().max(80).optional(),
	manager_phone: z.string().max(40).optional(),
	manager_email: z.string().max(80).optional(),
	typical_hours: z.string().max(80).optional(),
	lights_until: z.string().max(40).optional(),
	rules: z.string().max(600).optional(),
	restrictions: z.string().max(600).optional(),
	access_notes: z.string().max(400).optional(),
	lat: z.coerce.number().optional(),
	lng: z.coerce.number().optional(),
	photo_data: z.string().max(450000).optional()
});
async function insertListedCourt(sql: Sql, data: {
	name: string;
	address: string;
	city: string;
	sports: string;
	court_count: number;
	indoor: boolean;
	lights: boolean;
	restrooms: boolean;
	kind: string;
	booking_mode: string;
	player_fee?: number;
	coach_fee?: number;
	manager_name?: string;
	manager_phone?: string;
	manager_email?: string;
	typical_hours?: string;
	rules?: string;
	restrictions?: string;
	surface?: string;
	access_notes?: string;
	lat?: number;
	lng?: number;
	facility_cut_pct?: number;
	lights_until?: string;
	photo_data?: string;
	addedBy: string | null;
}) {
	const dup = await sql`
    select * from courts
    where lower(name) = lower(${data.name}) and lower(city) = lower(${data.city})
    limit 1
  `;
	if (dup[0]) return {
		court: mapCourt(dup[0]),
		created: false
	};
	const city = data.city;
	const cityKey = city.toLowerCase();
	const lat = data.lat ?? (cityKey.includes("lyon") ? 32.2043 : cityKey.includes("vidalia") ? 32.2174 : null);
	const lng = data.lng ?? (cityKey.includes("lyon") ? -82.3217 : cityKey.includes("vidalia") ? -82.4132 : null);
	const photo = data.photo_data && data.photo_data.startsWith("data:image/") ? data.photo_data : null;
	if (data.photo_data && !photo) throw new Error("Photo must be an image you upload.");
	let slug = slugify(data.name) || `court-${Date.now()}`;
	if (num((await sql`select count(*)::int as n from courts where slug = ${slug}`)[0]?.n ?? 0) > 0) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
	const region = /vidalia|lyons|toombs/i.test(city) ? "Toombs" : city;
	const isOther = data.kind === "private";
	return {
		court: mapCourt((await sql`
    insert into courts (
      name, address, city, sports, indoor, court_count, surface, lights, restrooms,
      access_notes, typical_hours, phone, is_other, lat, lng, manager_name, manager_phone,
      manager_email, booking_mode, player_fee_cents, coach_fee_cents, facility_cut_pct,
      rules, restrictions, lights_until, added_by, region, kind, status, slug, photo_data
    ) values (
      ${data.name}, ${data.address}, ${city}, ${data.sports}, ${data.indoor}, ${data.court_count},
      ${data.surface ?? null}, ${data.lights}, ${data.restrooms}, ${data.access_notes ?? null},
      ${data.typical_hours ?? null}, ${data.manager_phone ?? null}, ${isOther},
      ${lat}, ${lng}, ${data.manager_name ?? null}, ${data.manager_phone ?? null},
      ${data.manager_email ?? null}, ${data.booking_mode},
      ${Math.round((data.player_fee ?? 0) * 100)}, ${Math.round((data.coach_fee ?? 0) * 100)},
      ${data.facility_cut_pct ?? 0}, ${data.rules ?? null}, ${data.restrictions ?? null},
      ${data.lights_until ?? null}, ${data.addedBy}, ${region}, ${data.kind}, 'open', ${slug},
      ${photo}
    )
    returning *
  `)[0]),
		created: true
	};
}
export const registerCourt = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(courtSubmitZ).handler(async ({ context, data }) => {
	const result = await insertListedCourt(await getSql(), {
		...data,
		addedBy: context.userId
	});
	return {
		id: result.court.id,
		slug: result.court.slug,
		city: result.court.city,
		created: result.created,
		public: !result.court.is_other
	};
});
export const submitCourt = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(courtSubmitZ).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const result = await insertListedCourt(sql, {
		...data,
		addedBy: context.userId
	});
	return {
		id: result.court.id,
		slug: result.court.slug,
		city: result.court.city,
		citySlug: citySlug(result.court.city),
		created: result.created,
		public: !result.court.is_other,
		booking_mode: result.court.booking_mode
	};
});
export const saveCourtPhoto = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	photo_data: z.string().max(450000)
})).handler(async ({ data }) => {
	const photo = data.photo_data === "" ? null : data.photo_data;
	if (photo && !photo.startsWith("data:image/")) throw new Error("Photo must be an image you upload.");
	const sql = await getSql();
	const rows = await sql`
      update courts set photo_data = ${photo}
      where id = ${data.id} and is_other = false
      returning *
    `;
	if (!rows[0]) throw new Error("That court is not on the public board.");
	return mapCourt(rows[0]);
});
async function syncPublicHourly(sql: Sql, coachUserId: string) {
	const cheapest = await sql`
      select min(price_cents)::int as n from coach_services
      where coach_user_id = ${coachUserId} and unit = 'hour' and visibility = 'public'
    `;
	if (cheapest[0]?.n != null) {
		await sql`update coach_profiles set hourly_rate = ${Math.round(num(cheapest[0].n) / 100)} where user_id = ${coachUserId}`;
	}
}
export const saveCoachService = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	name: z.string().trim().min(2).max(80),
	kind: z.enum([
		"private",
		"group",
		"hitting",
		"junior"
	]),
	sport: sportZ,
	price: z.coerce.number().min(0).max(400),
	unit: z.enum([
		"hour",
		"person",
		"session"
	]),
	duration_min: z.coerce.number().min(30).max(180),
	notes: z.string().max(240).optional(),
	visibility: z.enum(["public", "player"]).optional()
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	await sql`
      insert into coach_profiles (user_id) values (${context.userId})
      on conflict do nothing
    `;
	await sql`update profiles set is_coach = true where user_id = ${context.userId}`;
	const visibility = data.visibility === "player" ? "player" : "public";
	await sql`
      insert into coach_services (coach_user_id, name, kind, sport, price_cents, unit, duration_min, notes, visibility)
      values (
        ${context.userId}, ${data.name}, ${data.kind}, ${data.sport},
        ${Math.round(data.price * 100)}, ${data.unit}, ${data.duration_min}, ${data.notes ?? null},
        ${visibility}
      )
    `;
	await syncPublicHourly(sql, context.userId);
	return { ok: true };
});
export const setCoachServiceVisibility = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	id: z.coerce.number(),
	visibility: z.enum(["public", "player"])
})).handler(async ({ context, data }) => {
	const sql = await getSql();
	const rows = await sql`
      update coach_services set visibility = ${data.visibility}
      where id = ${data.id} and coach_user_id = ${context.userId}
      returning id
    `;
	if (!rows[0]) throw new Error("Service not found");
	await syncPublicHourly(sql, context.userId);
	return { ok: true };
});
export const notifyRosterService = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	service_id: z.coerce.number(),
	player_user_id: z.string().min(1)
})).handler(async ({ context, data }) => {
	if (data.player_user_id === context.userId) throw new Error("Pick a player on your roster.");
	const sql = await getSql();
	const service = (await sql`
      select * from coach_services
      where id = ${data.service_id} and coach_user_id = ${context.userId}
      limit 1
    `)[0];
	if (!service) throw new Error("Service not found");
	const mapped = mapService(service);
	if (serviceIsPublic(mapped.visibility)) throw new Error("Only a player-only price can be sent this way.");
	const onRoster = num((await sql`
      select count(*)::int as n from lessons
      where coach_user_id = ${context.userId} and player_user_id = ${data.player_user_id}
        and status in ('confirmed', 'checked_in', 'completed')
    `)[0]?.n ?? 0);
	const credited = num((await sql`
      select count(*)::int as n from profiles
      where user_id = ${data.player_user_id} and credit_coach_user_id = ${context.userId} and onboarded = true
    `)[0]?.n ?? 0);
	if (onRoster === 0 && credited === 0) throw new Error("That player is not on your roster.");
	const coach = (await sql`
      select display_name from profiles where user_id = ${context.userId} limit 1
    `)[0];
	const notice = rosterServiceNotice({
		coachName: coach?.display_name == null ? "Your coach" : String(coach.display_name),
		serviceName: mapped.name,
		priceLine: priceLine(mapped)
	});
	await notify(sql, data.player_user_id, notice.title, notice.body, notice.href);
	return { ok: true };
});
export const deleteCoachService = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({ id: z.coerce.number() })).handler(async ({ context, data }) => {
	const sql = await getSql();
	await sql`delete from coach_services where id = ${data.id} and coach_user_id = ${context.userId}`;
	await syncPublicHourly(sql, context.userId);
	return { ok: true };
});
export const addLedgerEntry = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	kind: z.enum(["income", "expense"]),
	category: z.string().min(1).max(40),
	amount: z.coerce.number().min(0).max(5e3),
	note: z.string().max(160).optional()
})).handler(async ({ context, data }) => {
	await (await getSql())`
      insert into coach_ledger (coach_user_id, kind, category, amount_cents, note)
      values (${context.userId}, ${data.kind}, ${data.category}, ${Math.round(data.amount * 100)}, ${data.note ?? null})
    `;
	return { ok: true };
});
export const listNotices = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	return (await (await getSql())`
      select id, title, body, href, read, created_at::text as created_at
      from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `).map((r) => ({
		id: num(r.id),
		title: String(r.title),
		body: String(r.body),
		href: r.href == null ? null : String(r.href),
		read: bool(r.read),
		created_at: String(r.created_at)
	}));
});
export const markNoticesRead = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(async ({ context }) => {
	await (await getSql())`update notifications set read = true where user_id = ${context.userId} and read = false`;
	return { ok: true };
});
export const saveStall = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(z.object({
	sport: sportZ,
	stuck_on: z.string().min(1).max(40),
	weeks: z.coerce.number().min(1).max(52).optional()
})).handler(async ({ context, data }) => {
	await (await getSql())`
      insert into stall_checks (user_id, sport, stuck_on, weeks)
      values (${context.userId}, ${data.sport}, ${data.stuck_on}, ${data.weeks ?? null})
    `;
	return { ok: true };
});
export const catalogCities = createServerFn({ method: "GET" }).handler(async () => {
	const sql = await getSql();
	await ensureSeed(sql);
	const rows = await sql`
    select city, sports from courts where is_other = false
  `;
	const byCity = /* @__PURE__ */ new Map();
	for (const r of rows) {
		const city = String(r.city);
		const cur = byCity.get(city) ?? {
			n: 0,
			sports: /* @__PURE__ */ new Set()
		};
		cur.n += 1;
		for (const part of String(r.sports).split(",")) {
			const sport = part.trim();
			if (sport) cur.sports.add(sport);
		}
		byCity.set(city, cur);
	}
	return [...byCity.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, v]) => ({
		city,
		slug: citySlug(city),
		court_count: v.n,
		sports: [...v.sports]
	}));
});
export const catalogCity = createServerFn({ method: "GET" }).validator(z.object({ city: z.string().min(1).max(60) })).handler(async ({ data }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const slug = citySlug(data.city);
	const mapped = (await sql`select * from courts where is_other = false order by status, name`).map(mapCourt).filter((c) => citySlug(c.city) === slug);
	if (mapped.length === 0) return null;
	const city = mapped[0].city;
	const coaches = await sql`
      select p.user_id, p.display_name, p.city, p.plays_tennis, p.plays_pickleball, c.headline, c.hourly_rate
      from coach_profiles c
      join profiles p on p.user_id = c.user_id
      where p.onboarded = true and p.is_coach = true and p.user_id not like 'seed:%' and lower(p.city) = lower(${city})
      order by p.display_name
    `;
	const services = await sql`
      select coach_user_id, min(price_cents)::int as from_cents
      from coach_services
      where visibility = 'public'
      group by coach_user_id
    `;
	const fromBy = new Map(services.map((s) => [String(s.coach_user_id), num(s.from_cents)]));
	return {
		city,
		slug,
		courts: mapped,
		coaches: coaches.map((c) => ({
			display_name: String(c.display_name),
			headline: c.headline == null ? null : String(c.headline),
			from_cents: fromBy.get(String(c.user_id)) ?? (c.hourly_rate == null ? null : num(c.hourly_rate) * 100),
			plays_tennis: bool(c.plays_tennis),
			plays_pickleball: bool(c.plays_pickleball),
			city: String(c.city)
		}))
	};
});
export const catalogCourt = createServerFn({ method: "GET" }).validator(z.object({
	city: z.string().min(1).max(60),
	slug: z.string().min(1).max(80)
})).handler(async ({ data }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const rows = await sql`select * from courts where slug = ${data.slug} and is_other = false limit 1`;
	const court = rows[0] ? mapCourt(rows[0]) : null;
	if (!court) return null;
	if (citySlug(court.city) !== citySlug(data.city)) return null;
	return court;
});
export const lookupShare = createServerFn({ method: "GET" }).validator(z.object({
	code: z.string().min(1).max(32),
	as_coach: z.boolean().optional()
})).handler(async ({ data }) => {
	const sql = await getSql();
	await ensureSeed(sql);
	const rows = await sql`
      select * from profiles
      where lower(share_code) = ${data.code.trim().toLowerCase()} and onboarded = true
      limit 1
    `;
	if (!rows[0]) return null;
	const p = mapProfile(rows[0]);
	if (p.user_id.startsWith("seed:")) return null;
	if (data.as_coach && !p.is_coach) return null;
	return publicOf(p);
});

export const listReviews = createServerFn({ method: "GET" })
	.validator(z.object({
		subject_type: z.enum(["player", "coach", "facility"]),
		subject_id: z.string().min(1).max(80),
	}))
	.handler(async ({ data }) => {
		const sql = await getSql();
		await ensureSeed(sql);
		return (await sql`
      select r.id, r.reviewer_user_id, r.subject_type, r.subject_id, r.rating, r.body,
             r.created_at::text as created_at,
             coalesce(p.display_name, 'Player') as reviewer_name
      from reviews r
      left join profiles p on p.user_id = r.reviewer_user_id
      where r.subject_type = ${data.subject_type} and r.subject_id = ${data.subject_id}
      order by r.created_at desc
      limit 50
    `).map((r) => ({
			id: num(r.id),
			reviewer_user_id: String(r.reviewer_user_id),
			reviewer_name: String(r.reviewer_name),
			subject_type: String(r.subject_type) as "player" | "coach" | "facility",
			subject_id: String(r.subject_id),
			rating: num(r.rating),
			body: String(r.body),
			created_at: String(r.created_at),
		}));
	});

export const submitReview = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.object({
		subject_type: z.enum(["player", "coach", "facility"]),
		subject_id: z.string().min(1).max(80),
		rating: z.coerce.number().int().min(1).max(5),
		body: z.string().trim().min(8).max(600),
	}))
	.handler(async ({ context, data }) => {
		if (data.subject_id === context.userId) {
			throw new Error("You cannot review yourself.");
		}
		const sql = await getSql();
		await sql`
      insert into reviews (reviewer_user_id, subject_type, subject_id, rating, body)
      values (${context.userId}, ${data.subject_type}, ${data.subject_id}, ${data.rating}, ${data.body})
      on conflict (reviewer_user_id, subject_type, subject_id)
      do update set rating = excluded.rating, body = excluded.body, created_at = now()
    `;
		return { ok: true };
	});
