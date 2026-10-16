-- Remove the throwaway QA account used to walk the fee-ledger change (PR #22).
-- Exact match only: qa+rallyledger20261016@mailinator.com.
-- Before/after counts are printed as NOTICEs in the build log (read-back).
-- Never touches lincoln@unitedundergod.org or any other account.

drop table if exists qa_ids;
drop table if exists qa_lessons;
create temp table qa_ids as
  select id from "user"
  where lower(email) = 'qa+rallyledger20261016@mailinator.com'
    and lower(email) <> 'lincoln@unitedundergod.org';
-- Kids registered by these QA accounts only.
insert into qa_ids (id)
  select user_id from profiles
  where guardian_user_id in (select id from qa_ids) and user_id not in (select id from qa_ids)
    and user_id not in (select id from "user");

create temp table qa_lessons as
  select id from lessons
  where coach_user_id in (select id from qa_ids) or player_user_id in (select id from qa_ids);

do $$
declare r record;
begin
  raise notice '[qa-cleanup-ledger] BEFORE users=% profiles=% partner_board=% coach_profiles=% services_qa_owned=% service_named=% lessons=% play_requests=% reviews=% notifications=% sessions_hosted=% leagues_owned=%',
    (select count(*) from "user" where id in (select id from qa_ids)),
    (select count(*) from profiles where user_id in (select id from qa_ids)),
    (select count(*) from profiles where user_id in (select id from qa_ids) and looking_for_partners),
    (select count(*) from coach_profiles where user_id in (select id from qa_ids)),
    (select count(*) from coach_services where coach_user_id in (select id from qa_ids)),
    (select count(*) from coach_services where name = 'QA Test Service - delete'),
    (select count(*) from qa_lessons),
    (select count(*) from play_requests where from_user_id in (select id from qa_ids) or to_user_id in (select id from qa_ids)),
    (select count(*) from reviews where reviewer_user_id in (select id from qa_ids) or subject_id in (select id from qa_ids)),
    (select count(*) from notifications where user_id in (select id from qa_ids)),
    (select count(*) from sessions where host_user_id in (select id from qa_ids)),
    (select count(*) from leagues where owner_user_id in (select id from qa_ids));
  for r in select s.id, s.name, coalesce(p.display_name, '?') as owner from coach_services s
           left join profiles p on p.user_id = s.coach_user_id
           where s.name = 'QA Test Service - delete' or s.coach_user_id in (select id from qa_ids) loop
    raise notice '[qa-cleanup-ledger] service id=% name=% owner=%', r.id, r.name, r.owner;
  end loop;
end $$;

delete from notifications
  where user_id in (select id from qa_ids)
     or href in (select '/app/lessons/' || id from qa_lessons);
delete from coach_ledger where coach_user_id in (select id from qa_ids) or lesson_id in (select id from qa_lessons);
delete from platform_ledger where source_user_id in (select id from qa_ids);
delete from lessons where id in (select id from qa_lessons);
delete from reviews where reviewer_user_id in (select id from qa_ids) or subject_id in (select id from qa_ids);
delete from referral_events where referrer_user_id in (select id from qa_ids) or referred_user_id in (select id from qa_ids);
delete from coach_services where coach_user_id in (select id from qa_ids);
delete from journal_entries where user_id in (select id from qa_ids);
delete from reservations where user_id in (select id from qa_ids);
delete from play_requests where from_user_id in (select id from qa_ids) or to_user_id in (select id from qa_ids);
delete from session_rsvps where user_id in (select id from qa_ids)
   or session_id in (select id from sessions where host_user_id in (select id from qa_ids));
delete from sessions where host_user_id in (select id from qa_ids);
delete from league_members where user_id in (select id from qa_ids)
   or league_id in (select id from leagues where owner_user_id in (select id from qa_ids));
delete from leagues where owner_user_id in (select id from qa_ids);
delete from match_sides where user_id in (select id from qa_ids);
delete from stall_checks where user_id in (select id from qa_ids);
delete from student_guardian_links where student_id in (select id from qa_ids) or user_id in (select id from qa_ids);
delete from rally_comped_coaches where user_id in (select id from qa_ids);
delete from coach_profiles where user_id in (select id from qa_ids);
update profiles set credit_coach_user_id = null where credit_coach_user_id in (select id from qa_ids);
update profiles p set coach_user_ids = coalesce((
    select json_agg(c)::text from json_array_elements_text(p.coach_user_ids::json) c
    where c not in (select id from qa_ids)), '[]')
  where exists (select 1 from json_array_elements_text(p.coach_user_ids::json) c where c in (select id from qa_ids));
delete from profiles where user_id in (select id from qa_ids);
delete from "user" where id in (select id from qa_ids); -- session/account cascade

do $$
begin
  raise notice '[qa-cleanup-ledger] AFTER users=% profiles=% share_code_qaplayertest=% service_named=% services_qa_owned=% lessons=% play_requests=% reviews=% notifications=%',
    (select count(*) from "user" where lower(email) = 'qa+rallyledger20261016@mailinator.com'),
    (select count(*) from profiles where user_id in (select id from qa_ids)),
    (select count(*) from profiles where lower(share_code) = 'qaplayertest'),
    (select count(*) from coach_services where name = 'QA Test Service - delete'),
    (select count(*) from coach_services where coach_user_id in (select id from qa_ids)),
    (select count(*) from lessons where coach_user_id in (select id from qa_ids) or player_user_id in (select id from qa_ids)),
    (select count(*) from play_requests where from_user_id in (select id from qa_ids) or to_user_id in (select id from qa_ids)),
    (select count(*) from reviews where reviewer_user_id in (select id from qa_ids) or subject_id in (select id from qa_ids)),
    (select count(*) from notifications where user_id in (select id from qa_ids));
  raise notice '[qa-cleanup-ledger] totals now: users=% profiles=% coach_services=% lessons=%',
    (select count(*) from "user"), (select count(*) from profiles), (select count(*) from coach_services), (select count(*) from lessons);
end $$;

drop table if exists qa_lessons;
drop table if exists qa_ids;
