-- Practice / stroke video on the existing lesson row.
-- Same data-URI door as profiles.photo_data / courts.photo_data.
-- Not a second media product. Not skill badges.

alter table lessons
  add column if not exists video_data text;
