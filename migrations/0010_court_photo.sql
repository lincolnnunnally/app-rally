-- Facility photo so a listing looks like the place, not only an address.
-- Directions still use lat/lng and the street address.

alter table courts add column if not exists photo_data text;
