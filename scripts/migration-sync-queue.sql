-- ============================================================
-- Migration: Add sync queue tables
-- Run this in Supabase SQL Editor for existing installations
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

-- Sync jobs
create table if not exists sync_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  job_type        text not null,
  status          text not null default 'pending',
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

-- Sync tasks
create table if not exists sync_tasks (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references sync_jobs(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  task_type       text not null,
  status          text not null default 'pending',
  payload         jsonb default '{}',
  result          jsonb,
  error           text,
  api_calls       integer default 1,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);
create index if not exists idx_sync_tasks_status on sync_tasks(status, created_at);
create index if not exists idx_sync_tasks_job    on sync_tasks(job_id, status);

-- RPC: atomically claim tasks for processing
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

-- RLS
alter table rate_limit_state enable row level security;
alter table sync_jobs        enable row level security;
alter table sync_tasks       enable row level security;
