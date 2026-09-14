-- Coach Cash App + Venmo handles for in-app QR / deep-link pull-up.
-- ChurchConnect Give type:link only. No Stripe, no OAuth, no wallet.

alter table coach_profiles add column if not exists cash_app_handle text;
alter table coach_profiles add column if not exists venmo_handle text;
