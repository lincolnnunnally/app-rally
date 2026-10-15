-- Free coach access: owner grants and coupon codes.
-- Nothing in this file charges a card, calls Stripe, or enforces payment.
-- coach_paid_access is only a read target for getCoachAccess ('paid').
-- The app does not insert into it here.
-- Do not apply this file by hand. It follows migrations/*.sql and waits for the Rally migrator.
--
-- RLS is on and there are no policies, so anon and authenticated cannot read rows
-- through the Data API. Those roles are granted nothing. When service_role
-- exists (Supabase), it receives full access on these tables and their
-- sequences, which is how the other server-side Rally tables are reached
-- outside the anon key. PGLite has no service_role role, so those grants are skipped.

create table if not exists coach_access_grants (
  id serial primary key,
  coach_user_id text not null,
  reason text not null check (length(btrim(reason)) > 0),
  expires_at timestamp,
  revoked_at timestamp,
  granted_by text not null,
  created_at timestamp not null default now()
);
create index if not exists coach_access_grants_coach_idx
  on coach_access_grants (coach_user_id);

create table if not exists coach_access_coupons (
  id serial primary key,
  code text not null check (code ~ '^[A-Z0-9]{4,32}$'),
  note text,
  disabled_at timestamp,
  created_by text not null,
  created_at timestamp not null default now()
);
create unique index if not exists coach_access_coupons_code_idx
  on coach_access_coupons (lower(code));

create table if not exists coach_coupon_redemptions (
  id serial primary key,
  coupon_id integer not null references coach_access_coupons (id),
  coach_user_id text not null,
  redeemed_at timestamp not null default now(),
  unique (coach_user_id)
);
create index if not exists coach_coupon_redemptions_coupon_idx
  on coach_coupon_redemptions (coupon_id);

create table if not exists coach_paid_access (
  coach_user_id text primary key,
  paid_through timestamp not null,
  created_at timestamp not null default now()
);

alter table coach_access_grants enable row level security;
alter table coach_access_coupons enable row level security;
alter table coach_coupon_redemptions enable row level security;
alter table coach_paid_access enable row level security;

revoke all on table coach_access_grants from public;
revoke all on table coach_access_coupons from public;
revoke all on table coach_coupon_redemptions from public;
revoke all on table coach_paid_access from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table coach_access_grants from anon;
    revoke all on table coach_access_coupons from anon;
    revoke all on table coach_coupon_redemptions from anon;
    revoke all on table coach_paid_access from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table coach_access_grants from authenticated;
    revoke all on table coach_access_coupons from authenticated;
    revoke all on table coach_coupon_redemptions from authenticated;
    revoke all on table coach_paid_access from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute format('grant usage on schema %I to service_role', current_schema());
    grant all on table coach_access_grants to service_role;
    grant all on table coach_access_coupons to service_role;
    grant all on table coach_coupon_redemptions to service_role;
    grant all on table coach_paid_access to service_role;
    grant usage, select on sequence coach_access_grants_id_seq to service_role;
    grant usage, select on sequence coach_access_coupons_id_seq to service_role;
    grant usage, select on sequence coach_coupon_redemptions_id_seq to service_role;
  end if;
end $$;
