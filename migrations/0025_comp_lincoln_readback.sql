-- Read-only: list Lincoln's account(s) and coach profiles named Carmen, by user id, before comping.
do $$
declare r record;
begin
  for r in select u.id, u.email, u.name, p.display_name, (cp.user_id is not null) as coach,
                  (c.user_id is not null) as comped,
                  (select count(*) from coach_services s where s.coach_user_id = u.id) as services
           from "user" u
           left join profiles p on p.user_id = u.id
           left join coach_profiles cp on cp.user_id = u.id
           left join rally_comped_coaches c on c.user_id = u.id
           where lower(u.email) like '%lincoln%' or lower(u.email) like '%unitedundergod%'
              or p.display_name ilike '%carmen%' or u.name ilike '%carmen%' or p.display_name ilike '%lincoln%' loop
    raise notice '[comp-readback] user id=% email=% name=% display=% coach=% comped=% services=%',
      r.id, r.email, r.name, r.display_name, r.coach, r.comped, r.services;
  end loop;
  for r in select s.id, s.name, s.coach_user_id, u.email, p.display_name from coach_services s
           left join "user" u on u.id = s.coach_user_id left join profiles p on p.user_id = s.coach_user_id
           where p.display_name ilike '%carmen%' or s.name ilike '%carmen%' loop
    raise notice '[comp-readback] carmen service id=% name=% owner=% email=% display=%', r.id, r.name, r.coach_user_id, r.email, r.display_name;
  end loop;
  for r in select cp.user_id, p.display_name, u.email from coach_profiles cp
           left join profiles p on p.user_id = cp.user_id left join "user" u on u.id = cp.user_id loop
    raise notice '[comp-readback] coach user_id=% display=% email=%', r.user_id, r.display_name, r.email;
  end loop;
  raise notice '[comp-readback] comped now=%', (select count(*) from rally_comped_coaches);
end $$;
