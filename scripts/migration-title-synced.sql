-- Add title_synced flag to activities table
-- Tracks whether an activity has been title-synced (quäldich trigger)
alter table activities add column if not exists title_synced boolean default false;
