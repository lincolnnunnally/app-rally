-- Rally: Vidalia tennis + pickleball. Timestamps are local Eastern wall-clock
-- stored as timestamp without time zone (no conversion in the UI).

create table if not exists profiles (
  user_id text primary key,
  display_name text not null,
  city text not null default 'Vidalia',
  bio text,
  plays_tennis boolean not null default false,
  plays_pickleball boolean not null default true,
  tennis_level text,
  pickleball_level text,
  looking_for_partners boolean not null default true,
  looking_for_coach boolean not null default false,
  interested_in_leagues boolean not null default true,
  is_coach boolean not null default false,
  availability text,
  phone text,
  onboarded boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists coach_profiles (
  user_id text primary key,
  headline text,
  philosophy text,
  hourly_rate integer,
  certifications text,
  offers_private boolean not null default true,
  offers_group boolean not null default true,
  accepting boolean not null default true,
  years_coaching integer,
  created_at timestamp not null default now()
);

create table if not exists courts (
  id serial primary key,
  name text not null,
  address text not null,
  city text not null default 'Vidalia',
  sports text not null,
  indoor boolean not null default false,
  court_count integer not null default 1,
  surface text,
  lights boolean not null default false,
  restrooms boolean not null default false,
  access_notes text,
  typical_hours text,
  phone text,
  is_other boolean not null default false
);

create table if not exists reservations (
  id serial primary key,
  court_id integer not null references courts(id),
  user_id text not null,
  sport text not null,
  starts_at timestamp not null,
  ends_at timestamp not null,
  status text not null default 'confirmed',
  notes text,
  created_at timestamp not null default now()
);
create index if not exists reservations_court_time_idx on reservations (court_id, starts_at);
create index if not exists reservations_user_idx on reservations (user_id);

create table if not exists sessions (
  id serial primary key,
  host_user_id text,
  court_id integer references courts(id),
  title text not null,
  sport text not null,
  format text not null default 'open_play',
  starts_at timestamp not null,
  duration_min integer not null default 120,
  skill_min text,
  skill_max text,
  spots integer not null default 16,
  notes text,
  created_at timestamp not null default now()
);
create index if not exists sessions_starts_idx on sessions (starts_at);

create table if not exists session_rsvps (
  session_id integer not null references sessions(id) on delete cascade,
  user_id text not null,
  status text not null default 'going',
  created_at timestamp not null default now(),
  primary key (session_id, user_id)
);

create table if not exists play_requests (
  id serial primary key,
  from_user_id text not null,
  to_user_id text not null,
  sport text not null,
  message text,
  proposed_at timestamp,
  court_id integer references courts(id),
  status text not null default 'pending',
  created_at timestamp not null default now()
);
create index if not exists play_requests_to_idx on play_requests (to_user_id, status);

create table if not exists lessons (
  id serial primary key,
  coach_user_id text not null,
  player_user_id text not null,
  court_id integer references courts(id),
  starts_at timestamp not null,
  duration_min integer not null default 60,
  sport text not null,
  status text not null default 'requested',
  notes text,
  created_at timestamp not null default now()
);
create index if not exists lessons_coach_idx on lessons (coach_user_id, starts_at);
create index if not exists lessons_player_idx on lessons (player_user_id, starts_at);

create table if not exists leagues (
  id serial primary key,
  owner_user_id text,
  name text not null,
  sport text not null,
  format text not null default 'round_robin',
  skill_band text,
  season_label text,
  status text not null default 'open',
  notes text,
  created_at timestamp not null default now()
);

create table if not exists league_members (
  league_id integer not null references leagues(id) on delete cascade,
  user_id text not null,
  joined_at timestamp not null default now(),
  primary key (league_id, user_id)
);

create table if not exists matches (
  id serial primary key,
  league_id integer references leagues(id) on delete cascade,
  court_id integer references courts(id),
  sport text not null,
  format text not null default 'doubles',
  scheduled_at timestamp,
  status text not null default 'scheduled',
  score text,
  notes text,
  created_at timestamp not null default now()
);

create table if not exists match_sides (
  match_id integer not null references matches(id) on delete cascade,
  user_id text not null,
  side text not null,
  primary key (match_id, user_id)
);

create table if not exists journal_entries (
  id serial primary key,
  user_id text not null,
  kind text not null,
  title text,
  body text not null,
  created_at timestamp not null default now()
);
create index if not exists journal_user_idx on journal_entries (user_id, created_at desc);
