-- More than one guardian per student (mother, grandmother, ...).
-- Named student_guardian_links (not student_guardians) so it cannot collide with an existing relation.
-- Additive only and idempotent: preview builds run this against prod. No deletes, no drops.
-- profiles.guardian_user_id stays the primary guardian. This table lists every guardian,
-- including the primary. A coach "revoke" sets revoked_at; rows are never deleted.
create table if not exists student_guardian_links (
  student_id text not null,
  user_id text not null,
  relation text not null default 'guardian',
  added_by text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (student_id, user_id)
);

create index if not exists student_guardian_links_user_idx on student_guardian_links (user_id);

insert into student_guardian_links (student_id, user_id, relation, added_by)
select p.user_id, p.guardian_user_id, 'guardian', p.guardian_user_id
from profiles p
where p.guardian_user_id is not null and p.guardian_user_id <> ''
on conflict (student_id, user_id) do nothing;
