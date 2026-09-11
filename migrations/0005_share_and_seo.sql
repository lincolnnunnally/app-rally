-- Share codes, referral credit, public court slugs for search.

alter table profiles add column if not exists share_code text;
alter table profiles add column if not exists referred_by text;
alter table profiles add column if not exists credit_cents integer not null default 0;

create unique index if not exists profiles_share_code_idx on profiles (share_code) where share_code is not null;

alter table courts add column if not exists slug text;
create unique index if not exists courts_slug_idx on courts (slug) where slug is not null;

create table if not exists referral_events (
  id serial primary key,
  referrer_user_id text not null,
  referred_user_id text,
  kind text not null,
  take_cents integer not null,
  credit_cents integer not null,
  related_id integer,
  created_at timestamp not null default now()
);
create index if not exists referral_events_referrer_idx on referral_events (referrer_user_id, created_at desc);
