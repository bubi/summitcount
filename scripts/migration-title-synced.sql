-- Add title_synced flag to activities table
-- Tracks whether an activity has been title-synced (quäldich trigger)
alter table activities add column if not exists title_synced boolean default false;

-- Mark activities that already have quäldich climbs as synced
update activities
set title_synced = true
where id in (select distinct activity_id from qualdich_climbs);
