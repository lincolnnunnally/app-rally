-- Student growth: where a student started (baseline), later check-ins, and the
-- student's own reflection after each lesson.
-- Additive only and idempotent: preview builds run this against prod. No deletes, no drops.
-- lessons.notes (what we worked), lessons.successes (what the coach saw go right), and
-- lessons.private_notes (coach-only) are unchanged; this sits beside them.
--
-- student_assessments: one row per rating moment. kind 'baseline' is the starting point,
-- 'checkin' is a later re-rate. ratings is JSON text {"serve":2,"forehand":3,...} (1-5).
-- coach_only is never shown to the student or guardian.
create table if not exists student_assessments (
  id serial primary key,
  student_id text not null,
  coach_user_id text not null,
  sport text not null default 'tennis',
  kind text not null default 'checkin',
  assessed_on date not null default current_date,
  ratings text not null default '{}',
  strengths text,
  weaknesses text,
  opportunities text,
  threats text,
  potential text,
  goals text,
  coach_only text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists student_assessments_student_idx on student_assessments (student_id, assessed_on);

-- lesson_reflections: the student's side of one lesson. One row per lesson.
-- entered_by is whoever typed it (the student, a guardian, or the coach after talking it through).
create table if not exists lesson_reflections (
  lesson_id integer primary key references lessons(id) on delete cascade,
  student_id text not null,
  entered_by text not null,
  did text,
  felt text,
  thought text,
  proof text,
  see_next text,
  confidence integer,
  belief integer,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create index if not exists lesson_reflections_student_idx on lesson_reflections (student_id);
