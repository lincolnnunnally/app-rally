-- Tennis and pickleball are different games: skill, years, frequency, and
-- results live per sport. Combined years_playing / experience stay as fallbacks.

alter table profiles add column if not exists tennis_years integer;
alter table profiles add column if not exists pickleball_years integer;
alter table profiles add column if not exists tennis_times integer;
alter table profiles add column if not exists pickleball_times integer;
alter table profiles add column if not exists tennis_frequency text;
alter table profiles add column if not exists pickleball_frequency text;
alter table profiles add column if not exists tennis_experience text;
alter table profiles add column if not exists pickleball_experience text;
alter table profiles add column if not exists tennis_results text;
alter table profiles add column if not exists pickleball_results text;

update profiles set
  pickleball_years = coalesce(pickleball_years, case when plays_pickleball then years_playing end),
  tennis_years = coalesce(tennis_years, case when plays_tennis then years_playing end),
  pickleball_experience = coalesce(pickleball_experience, case when plays_pickleball then experience end),
  tennis_experience = coalesce(tennis_experience, case when plays_tennis then experience end),
  pickleball_results = coalesce(pickleball_results, case when plays_pickleball then accomplishments end),
  tennis_results = coalesce(tennis_results, case when plays_tennis then accomplishments end);
