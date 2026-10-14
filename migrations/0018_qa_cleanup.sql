-- One-time removal of QA test accounts and their rows (QA patterns only).
-- Never touches lincoln@unitedundergod.org.

drop table if exists qa_ids;
drop table if exists qa_lessons;
create temp table qa_ids as
  select id from "user"
  where (email ilike 'qa-pr15-%@example.com'
      or email ilike 'qa-rally-%@example.com'
      or email ilike 'rallyqa-%@mailinator.com')
    and lower(email) <> 'lincoln@unitedundergod.org';

-- Children made by QA guardians/coaches, plus the named QA kid.
insert into qa_ids (id)
  select user_id from profiles
  where (guardian_user_id in (select id from qa_ids)
      or display_name ilike 'QA Rally Kid%')
    and user_id not in (select id from qa_ids);

create temp table qa_lessons as
  select id from lessons
  where coach_user_id in (select id from qa_ids) or player_user_id in (select id from qa_ids);

delete from notifications
  where user_id in (select id from qa_ids)
     or href in (select '/app/lessons/' || id from qa_lessons)
     or title ilike '%QA Rally%' or body ilike '%QA Rally%'
     or title ilike '%QA PR15%' or body ilike '%QA PR15%';
delete from coach_ledger where coach_user_id in (select id from qa_ids) or lesson_id in (select id from qa_lessons);
delete from platform_ledger where source_user_id in (select id from qa_ids);
delete from lessons where id in (select id from qa_lessons);
delete from reviews where reviewer_user_id in (select id from qa_ids) or subject_id::text in (select id from qa_ids);
delete from referral_events where referrer_user_id in (select id from qa_ids) or referred_user_id in (select id from qa_ids);
delete from coach_services where coach_user_id in (select id from qa_ids);
delete from journal_entries where user_id in (select id from qa_ids);
delete from reservations where user_id in (select id from qa_ids);
delete from play_requests where from_user_id in (select id from qa_ids) or to_user_id in (select id from qa_ids);
delete from session_rsvps where user_id in (select id from qa_ids);
delete from league_members where user_id in (select id from qa_ids);
delete from match_sides where user_id in (select id from qa_ids);
delete from stall_checks where user_id in (select id from qa_ids);
delete from coach_profiles where user_id in (select id from qa_ids);

-- Unlink QA coaches from anyone else's roster.
update profiles set credit_coach_user_id = null where credit_coach_user_id in (select id from qa_ids);
update profiles p set coach_user_ids = coalesce((
    select json_agg(c)::text from json_array_elements_text(p.coach_user_ids::json) c
    where c not in (select id from qa_ids)), '[]')
  where exists (select 1 from json_array_elements_text(p.coach_user_ids::json) c where c in (select id from qa_ids));

delete from profiles where user_id in (select id from qa_ids);
delete from "user" where id in (select id from qa_ids); -- session/account cascade

-- Hide the old QA coach from the board.
update profiles set is_coach = false
  where display_name = 'Rally PR7 QA'
    and user_id not in (select id from "user" where lower(email) = 'lincoln@unitedundergod.org');

drop table if exists qa_lessons;
drop table if exists qa_ids;
