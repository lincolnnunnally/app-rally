-- Decided coach pricing (CoS GO 2026-10-16): $100/yr coach fee + 5% on CARD lesson payments
-- only, no cap. Cash App / Venmo / cash: 0%. The 8%-after-30-day-trial and $15/mo options
-- are retired. Ledger-side only: no money moves, no historical ledger row is rewritten.

-- 1. Card-vs-cash on lesson payments.
alter table lessons add column if not exists paid_via text;
alter table lessons drop constraint if exists lessons_paid_via_check;
alter table lessons add constraint lessons_paid_via_check
  check (paid_via is null or paid_via in ('card', 'cash_app', 'venmo', 'cash'));

-- 2. Move every coach (old 'percent' and old 'monthly') onto the one annual plan.
do $$
declare before_monthly int; before_percent int; after_annual int;
begin
  select count(*) into before_monthly from coach_profiles where billing_plan = 'monthly';
  select count(*) into before_percent from coach_profiles where billing_plan = 'percent';
  update coach_profiles set billing_plan = 'annual' where billing_plan is distinct from 'annual';
  select count(*) into after_annual from coach_profiles where billing_plan = 'annual';
  raise notice '[0023] coach plans before: monthly=%, percent=%; after: annual=% (total coaches=%)',
    before_monthly, before_percent, after_annual, (select count(*) from coach_profiles);
end $$;
alter table coach_profiles alter column billing_plan set default 'annual';

-- 3. Comped coaches (0019) also skip the annual fee.
create or replace function rally_skip_comped_platform_take() returns trigger as $$
begin
  if new.kind in ('lesson', 'coach_monthly', 'coach_annual', 'facility')
     and new.source_user_id in (select user_id from rally_comped_coaches) then
    return null;
  end if;
  return new;
end $$ language plpgsql;

create or replace function rally_skip_comped_coach_take() returns trigger as $$
begin
  if new.category in ('rally_take', 'rally_monthly', 'rally_annual')
     and new.coach_user_id in (select user_id from rally_comped_coaches) then
    return null;
  end if;
  return new;
end $$ language plpgsql;

-- 4. Read-back of the untouched history (for the build log).
do $$
begin
  raise notice '[0023] history kept: rally_monthly rows=%, rally_take rows=%, comped coaches=%',
    (select count(*) from coach_ledger where category = 'rally_monthly'),
    (select count(*) from coach_ledger where category = 'rally_take'),
    (select count(*) from rally_comped_coaches);
end $$;
