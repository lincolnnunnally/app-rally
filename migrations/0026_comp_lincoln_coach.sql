-- Comp Lincoln's own coach account (CoS GO 2026-10-16). Verified by 0025 read-back:
-- user T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL = lincoln.nunnally@gmail.com, coach page, owner of
-- service 9 "Carmen lesson". lincoln@unitedundergod.org has no Rally account (included if it appears).
-- Ledger only: Rally fee rows on his coaching are dropped as in 0019; no money moves.
do $$
begin
  raise notice '[comp-lincoln] BEFORE comped=% his_rows=% his_fee_ledger=% his_lesson_take=%',
    (select count(*) from rally_comped_coaches),
    (select count(*) from rally_comped_coaches where user_id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL'),
    (select count(*) from coach_ledger where coach_user_id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL' and category in ('rally_take','rally_monthly','rally_annual')),
    (select coalesce(sum(rally_take_cents),0) from lessons where coach_user_id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL');
end $$;

insert into rally_comped_coaches (user_id, note)
  select id, 'Founder: free coach access (Lincoln, owns Carmen lesson service)' from "user"
  where id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL' and lower(email) = 'lincoln.nunnally@gmail.com'
on conflict (user_id) do nothing;
insert into rally_comped_coaches (user_id, note)
  select id, 'Founder: free coach access' from "user" where lower(email) = 'lincoln@unitedundergod.org'
on conflict (user_id) do nothing;

delete from platform_ledger where kind in ('lesson','coach_monthly','coach_annual','facility')
  and source_user_id in (select user_id from rally_comped_coaches);
delete from coach_ledger where category in ('rally_take','rally_monthly','rally_annual')
  and coach_user_id in (select user_id from rally_comped_coaches);
update lessons set rally_take_cents = 0
  where coach_user_id in (select user_id from rally_comped_coaches) and rally_take_cents <> 0;

do $$
declare r record;
begin
  for r in select c.user_id, u.email, c.note from rally_comped_coaches c left join "user" u on u.id = c.user_id loop
    raise notice '[comp-lincoln] AFTER comped user_id=% email=% note=%', r.user_id, r.email, r.note;
  end loop;
  raise notice '[comp-lincoln] AFTER comped=% his_fee_ledger=% his_lesson_take=%',
    (select count(*) from rally_comped_coaches),
    (select count(*) from coach_ledger where coach_user_id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL' and category in ('rally_take','rally_monthly','rally_annual')),
    (select coalesce(sum(rally_take_cents),0) from lessons where coach_user_id = 'T4GnvJ7tFT1OtnPHbHToP1J7FxMQ8bWL');
end $$;
