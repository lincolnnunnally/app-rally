-- Reviews for players, coaches, and facilities. Real people only — no seed rows.

create table if not exists reviews (
  id serial primary key,
  reviewer_user_id text not null,
  subject_type text not null,
  subject_id text not null,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamp not null default now(),
  unique (reviewer_user_id, subject_type, subject_id)
);
create index if not exists reviews_subject_idx on reviews (subject_type, subject_id, created_at desc);
