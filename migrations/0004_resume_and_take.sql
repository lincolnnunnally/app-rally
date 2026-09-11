-- Player résumé (ratings, experience, results) and Rally's take on real fees.
-- Rec stays $0. Take is 0 when the underlying fee is 0.

alter table profiles add column if not exists years_playing integer;
alter table profiles add column if not exists dupr text;
alter table profiles add column if not exists utr text;
alter table profiles add column if not exists experience text;
alter table profiles add column if not exists accomplishments text;
alter table profiles add column if not exists credit_coach_user_id text;
alter table profiles add column if not exists coach_note text;

alter table coach_profiles add column if not exists billing_plan text not null default 'percent';

alter table reservations add column if not exists rally_take_cents integer not null default 0;

alter table lessons add column if not exists rally_take_cents integer not null default 0;

alter table leagues add column if not exists reg_fee_cents integer not null default 0;

alter table league_members add column if not exists fee_cents integer not null default 0;
alter table league_members add column if not exists rally_take_cents integer not null default 0;

create table if not exists platform_ledger (
  id serial primary key,
  kind text not null,
  amount_cents integer not null,
  source_user_id text,
  related_id integer,
  note text,
  created_at timestamp not null default now()
);
create index if not exists platform_ledger_kind_idx on platform_ledger (kind, created_at desc);
