-- Real student records. A name on the coach desk is a person the coach
-- can schedule, note, and invite — not a directory listing and not a seed.

create table if not exists students (
  id serial primary key,
  display_name text not null,
  created_by_coach_id text not null,
  claimed_user_id text,
  guardian_contact_name text,
  guardian_contact_email text,
  guardian_contact_phone text,
  sport text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists students_claimed_idx on students (claimed_user_id);
create index if not exists students_created_by_idx on students (created_by_coach_id);

create table if not exists student_coaches (
  student_id integer not null references students(id) on delete cascade,
  coach_user_id text not null,
  created_at timestamp not null default now(),
  primary key (student_id, coach_user_id)
);
create index if not exists student_coaches_coach_idx on student_coaches (coach_user_id);

create table if not exists student_guardians (
  student_id integer not null references students(id) on delete cascade,
  guardian_user_id text not null,
  created_at timestamp not null default now(),
  primary key (student_id, guardian_user_id)
);
create index if not exists student_guardians_guardian_idx on student_guardians (guardian_user_id);

-- Private to that coach. Another coach on the same student does not inherit these.
create table if not exists coach_student_notes (
  student_id integer not null references students(id) on delete cascade,
  coach_user_id text not null,
  strengths text,
  current_level text,
  work_on text,
  updated_at timestamp not null default now(),
  primary key (student_id, coach_user_id)
);

create table if not exists student_invites (
  id serial primary key,
  student_id integer not null references students(id) on delete cascade,
  token text not null unique,
  created_by text not null,
  expires_at timestamp not null,
  claimed_at timestamp,
  claimed_by text
);
create index if not exists student_invites_student_idx on student_invites (student_id);

alter table lessons add column if not exists student_id integer references students(id);
create index if not exists lessons_student_idx on lessons (student_id);
