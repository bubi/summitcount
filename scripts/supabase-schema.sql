-- ============================================================
-- SummitCount — Supabase Schema
-- Run once in the Supabase SQL Editor
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
  description         text,
  title_synced        boolean default false,
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

-- ============================================================
-- Sync Queue — rate-limit-aware background processing
-- ============================================================

-- Global rate limit state (single row)
create table if not exists rate_limit_state (
  id                  text primary key default 'global',
  fifteen_min_count   integer default 0,
  fifteen_min_reset   timestamptz default now(),
  daily_count         integer default 0,
  daily_reset         timestamptz default now()
);
insert into rate_limit_state (id) values ('global') on conflict do nothing;

-- Sync jobs: one row per user sync request
create table if not exists sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  job_type        text not null,    -- 'full_sync' | 'incremental_sync' | 'title_sync'
  status          text not null default 'pending',
                                    -- 'pending' | 'running' | 'completed' | 'failed'
  priority        integer not null default 10,
  progress        jsonb default '{}',
  result          jsonb default '{}',
  error           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);
create index if not exists idx_sync_jobs_status on sync_jobs(status, priority, created_at);
create index if not exists idx_sync_jobs_user   on sync_jobs(user_id, created_at desc);

-- Sync tasks: individual API calls within a job
create table if not exists sync_tasks (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references sync_jobs(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  task_type       text not null,
                  -- 'fetch_activity_list' | 'fetch_activity_detail'
                  -- 'check_deletions' | 'title_sync_activity'
  status          text not null default 'pending',
                                    -- 'pending' | 'running' | 'completed' | 'failed'
  payload         jsonb default '{}',
  result          jsonb,
  error           text,
  api_calls       integer default 1,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);
create index if not exists idx_sync_tasks_status on sync_tasks(status, created_at);
create index if not exists idx_sync_tasks_job    on sync_tasks(job_id, status);

-- RPC: atomically claim tasks for processing (prevents double-processing)
create or replace function claim_sync_tasks(batch_size integer)
returns setof sync_tasks
language plpgsql
as $$
begin
  return query
  update sync_tasks t
  set status = 'running'
  from (
    select t2.id
    from sync_tasks t2
    join sync_jobs j on j.id = t2.job_id
    where t2.status = 'pending'
      and j.status in ('pending', 'running')
    order by j.priority asc, t2.created_at asc
    limit batch_size
    for update of t2 skip locked
  ) sub
  where t.id = sub.id
  returning t.*;
end;
$$;

-- RPC: atomically increment rate limit counters
create or replace function increment_rate_limit(call_count integer)
returns void
language plpgsql
as $$
begin
  update rate_limit_state
  set fifteen_min_count = fifteen_min_count + call_count,
      daily_count = daily_count + call_count
  where id = 'global';
end;
$$;

-- Row Level Security (RLS) — users can only see their own data
alter table users              enable row level security;
alter table activities         enable row level security;
alter table qualdich_climbs    enable row level security;
alter table rate_limit_state   enable row level security;
alter table sync_jobs          enable row level security;
alter table sync_tasks         enable row level security;

-- Service role bypasses RLS (our API uses service role, so this is fine)
-- No additional policies needed for server-side access
