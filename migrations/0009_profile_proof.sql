-- Profile photo plus structured certifications, titles, trophies, and competitions.
-- Same résumé for players and coaches.

alter table profiles add column if not exists photo_data text;
alter table profiles add column if not exists certs_json text not null default '[]';
alter table profiles add column if not exists honors_json text not null default '[]';
