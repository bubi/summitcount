-- ============================================================
-- Cycling Odometer — Supabase Schema
-- Einmal im Supabase SQL Editor ausführen
-- ============================================================

-- Users table
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  strava_id         bigint unique not null,
  username          text,
  firstname         text,
  lastname          text,
  profile_img       text,
  city              text,
  country           text,
  access_token      text not null,
  refresh_token     text not null,
  token_expires_at  bigint not null,
  last_synced_at    timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Activities table
create table if not exists activities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  strava_activity_id  text unique not null,
  name                text,
  sport_type          text,
  start_date          timestamptz not null,
  distance_m          float default 0,
  elevation_gain_m    float default 0,
  elev_high           float,
  moving_time_s       integer default 0,
  year                integer,
  month               integer,
  summary_polyline    text,
  created_at          timestamptz default now()
);

-- Indexes for fast queries
create index if not exists idx_activities_user_id    on activities(user_id);
create index if not exists idx_activities_year       on activities(user_id, year);
create index if not exists idx_activities_start_date on activities(user_id, start_date desc);

-- quäldich climbs extracted from activity descriptions
create table if not exists qualdich_climbs (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  name        text not null,
  ele         integer,
  climb_type  text,           -- 'Passjagd' | 'Bergwertung' | 'Gipfeljagd' | …
  visited_at  timestamptz,
  created_at  timestamptz default now(),
  unique(activity_id, name)
);
create index if not exists idx_qualdich_activity on qualdich_climbs(activity_id);
create index if not exists idx_qualdich_name     on qualdich_climbs(name);

-- Summits cache (OSM nodes)
create table if not exists summits (
  id        uuid primary key default gen_random_uuid(),
  osm_id    bigint unique not null,
  name      text,
  ele       integer,
  osm_type  text,             -- 'peak' | 'mountain_pass' | 'saddle'
  lat       float not null,
  lon       float not null,
  created_at timestamptz default now()
);
create index if not exists idx_summits_latlon on summits(lat, lon);

-- Activity ↔ Summit mapping
create table if not exists activity_summits (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  summit_id   uuid not null references summits(id) on delete cascade,
  visited_at  timestamptz,
  unique(activity_id, summit_id)
);
create index if not exists idx_act_summits_activity on activity_summits(activity_id);
create index if not exists idx_act_summits_summit   on activity_summits(summit_id);

-- Row Level Security (RLS) — users can only see their own data
alter table users             enable row level security;
alter table activities        enable row level security;
alter table summits           enable row level security;
alter table activity_summits  enable row level security;

-- Service role bypasses RLS (our API uses service role, so this is fine)
-- No additional policies needed for server-side access
