-- Public vs player-only on the existing coach_services menu.
-- Default public so Vidalia seed + from-price stay the same.

alter table coach_services
  add column if not exists visibility text not null default 'public';
