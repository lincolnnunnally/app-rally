-- Comp Lincoln's coach access: Rally never records a platform take on his coaching.
-- Ledger-side only; app code is unchanged. Add a user_id here to comp another coach.

create table if not exists rally_comped_coaches (
  user_id text primary key,
  note text,
  created_at timestamp not null default now()
);

insert into rally_comped_coaches (user_id, note)
  select id, 'Founder: free coach access' from "user" where lower(email) = 'lincoln@unitedundergod.org'
  on conflict do nothing;

create or replace function rally_skip_comped_platform_take() returns trigger as $$
begin
  if new.kind in ('lesson', 'coach_monthly', 'facility')
     and new.source_user_id in (select user_id from rally_comped_coaches) then
    return null;
  end if;
  return new;
end $$ language plpgsql;
drop trigger if exists rally_skip_comped_platform_take on platform_ledger;
create trigger rally_skip_comped_platform_take before insert on platform_ledger
  for each row execute function rally_skip_comped_platform_take();

create or replace function rally_skip_comped_coach_take() returns trigger as $$
begin
  if new.category in ('rally_take', 'rally_monthly')
     and new.coach_user_id in (select user_id from rally_comped_coaches) then
    return null;
  end if;
  return new;
end $$ language plpgsql;
drop trigger if exists rally_skip_comped_coach_take on coach_ledger;
create trigger rally_skip_comped_coach_take before insert on coach_ledger
  for each row execute function rally_skip_comped_coach_take();

create or replace function rally_zero_comped_lesson_take() returns trigger as $$
begin
  if new.coach_user_id in (select user_id from rally_comped_coaches) then
    new.rally_take_cents := 0;
  end if;
  return new;
end $$ language plpgsql;
drop trigger if exists rally_zero_comped_lesson_take on lessons;
create trigger rally_zero_comped_lesson_take before insert or update of rally_take_cents on lessons
  for each row execute function rally_zero_comped_lesson_take();

-- Drop any take already recorded on his coaching (ledger rows only; no money moved).
delete from platform_ledger where kind in ('lesson', 'coach_monthly', 'facility')
  and source_user_id in (select user_id from rally_comped_coaches);
delete from coach_ledger where category in ('rally_take', 'rally_monthly')
  and coach_user_id in (select user_id from rally_comped_coaches);
update lessons set rally_take_cents = 0
  where coach_user_id in (select user_id from rally_comped_coaches) and rally_take_cents <> 0;
