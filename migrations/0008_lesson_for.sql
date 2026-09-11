-- A parent can book a lesson for a child without the child needing an account.

alter table lessons add column if not exists for_kind text not null default 'self';
alter table lessons add column if not exists for_name text;
