-- Stripe Connect payouts and the platform fee on money that moves through Rally.
-- Lesson cap rows are locked (see platform-fee-reserve.ts) so two checkouts
-- cannot both read "under $50" and both charge a fee.

create table if not exists connect_accounts (
  user_id text primary key,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  transfers_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_fee_months (
  payee_user_id text not null,
  month_key text not null,
  fee_cents integer not null default 0,
  primary key (payee_user_id, month_key),
  constraint platform_fee_months_nonneg check (fee_cents >= 0)
);

create table if not exists payments (
  id serial primary key,
  source text not null,
  related_id integer not null,
  payer_user_id text not null,
  payee_user_id text not null,
  gross_cents integer not null,
  platform_fee_cents integer not null,
  month_key text,
  fee_reserved boolean not null default false,
  currency text not null default 'usd',
  status text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_account_id text,
  refunded_cents integer not null default 0,
  platform_fee_refunded_cents integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  constraint payments_source_chk check (source in ('lesson', 'court', 'league')),
  constraint payments_status_chk check (status in ('pending', 'paid', 'refunded', 'expired')),
  constraint payments_amounts_chk check (
    gross_cents >= 0
    and platform_fee_cents >= 0
    and platform_fee_cents <= gross_cents
    and refunded_cents >= 0
    and platform_fee_refunded_cents >= 0
    and platform_fee_refunded_cents <= platform_fee_cents
  )
);

create unique index if not exists payments_one_pending
  on payments (source, related_id, payer_user_id)
  where status = 'pending';

create index if not exists payments_payee_paid_idx
  on payments (payee_user_id, source, paid_at);

create index if not exists payments_intent_idx
  on payments (stripe_payment_intent_id);

create index if not exists payments_charge_idx
  on payments (stripe_charge_id);

create table if not exists stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
