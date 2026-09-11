-- Facilities, coach services, books, notifications.
-- Existing Rec / league / profile tables stay. This only extends them.

alter table courts add column if not exists lat double precision;
alter table courts add column if not exists lng double precision;
alter table courts add column if not exists manager_name text;
alter table courts add column if not exists manager_phone text;
alter table courts add column if not exists manager_email text;
alter table courts add column if not exists booking_mode text not null default 'claim';
alter table courts add column if not exists player_fee_cents integer not null default 0;
alter table courts add column if not exists coach_fee_cents integer not null default 0;
alter table courts add column if not exists facility_cut_pct integer not null default 0;
alter table courts add column if not exists rules text;
alter table courts add column if not exists restrictions text;
alter table courts add column if not exists lights_until text;
alter table courts add column if not exists added_by text;
alter table courts add column if not exists region text not null default 'Toombs';
alter table courts add column if not exists kind text not null default 'public';
alter table courts add column if not exists status text not null default 'open';

alter table reservations add column if not exists fee_cents integer not null default 0;
alter table reservations add column if not exists for_coaching boolean not null default false;

alter table coach_profiles add column if not exists playing_level text;
alter table coach_profiles add column if not exists specializations text;
alter table coach_profiles add column if not exists achievements text;
alter table coach_profiles add column if not exists travel_radius_mi integer;
alter table coach_profiles add column if not exists teaching_beginner boolean not null default true;
alter table coach_profiles add column if not exists teaching_intermediate boolean not null default true;
alter table coach_profiles add column if not exists teaching_advanced boolean not null default true;
alter table coach_profiles add column if not exists teaching_juniors boolean not null default false;

alter table lessons add column if not exists service_id integer;
alter table lessons add column if not exists price_cents integer;
alter table lessons add column if not exists billing text not null default 'hour';
alter table lessons add column if not exists group_spots integer;
alter table lessons add column if not exists series_id text;
alter table lessons add column if not exists facility_fee_cents integer not null default 0;
alter table lessons add column if not exists facility_cut_cents integer not null default 0;

create table if not exists coach_services (
  id serial primary key,
  coach_user_id text not null,
  name text not null,
  kind text not null,
  sport text not null,
  price_cents integer not null,
  unit text not null default 'hour',
  duration_min integer not null default 60,
  notes text
);
create index if not exists coach_services_coach_idx on coach_services (coach_user_id);

create table if not exists coach_ledger (
  id serial primary key,
  coach_user_id text not null,
  kind text not null,
  category text not null,
  amount_cents integer not null,
  occurred_on date not null default current_date,
  note text,
  lesson_id integer,
  created_at timestamp not null default now()
);
create index if not exists coach_ledger_coach_idx on coach_ledger (coach_user_id, occurred_on desc);

create table if not exists notifications (
  id serial primary key,
  user_id text not null,
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  created_at timestamp not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);

create table if not exists stall_checks (
  id serial primary key,
  user_id text not null,
  sport text not null,
  stuck_on text not null,
  weeks integer,
  created_at timestamp not null default now()
);
