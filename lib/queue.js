import { supabaseAdmin } from './supabase'

/**
 * Enqueue a full sync (first-time user, no last_synced_at).
 * Creates a job + initial fetch_list task.
 */
export async function enqueueFullSync(db, userId, priority = 10) {
  if (!db) db = supabaseAdmin()

  // Check for existing pending/running sync job
  const existing = await getActiveJob(db, userId, 'sync')
  if (existing) return existing

  const { data: job, error } = await db
    .from('sync_jobs')
    .insert({
      user_id: userId,
      job_type: 'full_sync',
      status: 'pending',
      priority,
      progress: { phase: 'fetch_list', page: 1, fetched: 0, detailed: 0 },
    })
    .select()
    .single()
  if (error) throw error

  // Create initial task: fetch activity list page 1
  await db.from('sync_tasks').insert({
    job_id: job.id,
    user_id: userId,
    task_type: 'fetch_activity_list',
    payload: { page: 1, after_ts: null },
  })

  // Mark job as running
  await db.from('sync_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)

  return job
}

/**
 * Enqueue an incremental sync (user has last_synced_at).
 */
export async function enqueueIncrementalSync(db, userId, afterTs, priority = 10) {
  if (!db) db = supabaseAdmin()

  const existing = await getActiveJob(db, userId, 'sync')
  if (existing) return existing

  const { data: job, error } = await db
    .from('sync_jobs')
    .insert({
      user_id: userId,
      job_type: 'incremental_sync',
      status: 'pending',
      priority,
      progress: { phase: 'fetch_list', page: 1, fetched: 0, detailed: 0 },
    })
    .select()
    .single()
  if (error) throw error

  await db.from('sync_tasks').insert({
    job_id: job.id,
    user_id: userId,
    task_type: 'fetch_activity_list',
    payload: { page: 1, after_ts: afterTs },
  })

  await db.from('sync_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)

  return job
}

/**
 * Enqueue a title-sync job (triggers webhooks by toggling activity names).
 */
export async function enqueueTitleSync(db, userId, year, priority = 20) {
  if (!db) db = supabaseAdmin()

  const existing = await getActiveJob(db, userId, 'title_sync')
  if (existing) return existing

  // Get only activities that haven't been title-synced yet
  const { data: acts, error: actsErr } = await db
    .from('activities')
    .select('id, strava_activity_id, name')
    .eq('user_id', userId)
    .eq('year', parseInt(year))
    .not('strava_activity_id', 'is', null)
    .or('title_synced.is.null,title_synced.eq.false')

  if (actsErr) throw actsErr
  if (!acts?.length) return null

  const { data: job, error } = await db
    .from('sync_jobs')
    .insert({
      user_id: userId,
      job_type: 'title_sync',
      status: 'pending',
      priority,
      progress: { total: acts.length, completed: 0, failed: 0 },
    })
    .select()
    .single()
  if (error) throw error

  // Create one task per activity
  const tasks = acts.map(a => ({
    job_id: job.id,
    user_id: userId,
    task_type: 'title_sync_activity',
    payload: { strava_activity_id: a.strava_activity_id, name: a.name, activity_db_id: a.id },
    api_calls: 2, // add ⛰ + remove ⛰
  }))

  // Insert in batches of 50
  for (let i = 0; i < tasks.length; i += 50) {
    await db.from('sync_tasks').insert(tasks.slice(i, i + 50))
  }

  await db.from('sync_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)

  return job
}

/**
 * Get the active (pending/running) sync or title_sync job for a user.
 */
async function getActiveJob(db, userId, type) {
  const jobTypes = type === 'sync'
    ? ['full_sync', 'incremental_sync']
    : ['title_sync']

  const { data } = await db
    .from('sync_jobs')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'running'])
    .in('job_type', jobTypes)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}

/**
 * Get the latest job status for a user (for dashboard polling).
 */
export async function getJobStatus(db, userId) {
  if (!db) db = supabaseAdmin()

  const { data: job } = await db
    .from('sync_jobs')
    .select('id, job_type, status, progress, result, error, created_at, completed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) return null

  // Count tasks for progress
  if (job.status === 'running' || job.status === 'pending') {
    const { count: total } = await db
      .from('sync_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id)

    const { count: done } = await db
      .from('sync_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .eq('status', 'completed')

    job.tasks_total = total || 0
    job.tasks_done = done || 0
  }

  return job
}

/**
 * Ensure a user's access token is fresh. Returns the valid access token.
 */
export async function ensureTokenFresh(db, userId) {
  const { refreshAccessToken } = await import('./strava')

  const { data: user, error } = await db
    .from('users')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', userId)
    .single()
  if (error) throw error

  if (Date.now() / 1000 > user.token_expires_at - 300) {
    const refreshed = await refreshAccessToken(
      process.env.STRAVA_CLIENT_ID,
      process.env.STRAVA_CLIENT_SECRET,
      user.refresh_token
    )
    await db.from('users').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: refreshed.expires_at,
    }).eq('id', userId)
    return refreshed.access_token
  }

  return user.access_token
}
