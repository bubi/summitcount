import { getRateLimitBudget, trackApiCalls } from './rate-limit'
import { ensureTokenFresh } from './queue'
import { parseQualdichClimbs } from './qualdich'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const RIDE_TYPES  = ['Ride','VirtualRide','EBikeRide','GravelRide','MountainBikeRide']
const TRIGGER_CHAR = ' ⛰'

/**
 * Process up to `maxTasks` pending tasks from the sync queue.
 * Called either from the cron endpoint or piggybacked on sync-status polls.
 * Returns { processed, apiCalls }.
 */
export async function processQueue(db, maxTasks = 5) {
  const budget = await getRateLimitBudget(db)
  if (budget.available < 2) return { processed: 0, apiCalls: 0, reason: 'rate_limited' }

  const batchSize = Math.min(budget.available, maxTasks)

  const { data: tasks, error: claimErr } = await db
    .rpc('claim_sync_tasks', { batch_size: batchSize })

  if (claimErr) throw claimErr
  if (!tasks?.length) return { processed: 0, apiCalls: 0, reason: 'no_tasks' }

  let apiCallsMade = 0
  const tokenCache = {}

  for (const task of tasks) {
    try {
      if (!tokenCache[task.user_id]) {
        tokenCache[task.user_id] = await ensureTokenFresh(db, task.user_id)
      }
      const token = tokenCache[task.user_id]

      const calls = await executeTask(db, task, token)
      apiCallsMade += calls
      await trackApiCalls(db, calls)

      if (apiCallsMade >= batchSize) break
    } catch (e) {
      console.error(`Task ${task.id} failed:`, e.message)
      await db.from('sync_tasks').update({
        status: 'failed',
        error: e.message,
        completed_at: new Date().toISOString(),
      }).eq('id', task.id)
    }
  }

  await finalizeJobs(db)

  return { processed: tasks.length, apiCalls: apiCallsMade }
}

/**
 * Execute a single task. Returns the number of API calls made.
 */
async function executeTask(db, task, accessToken) {
  const { task_type, payload } = task
  let apiCalls = 0

  switch (task_type) {
    case 'fetch_activity_list': {
      const { page, after_ts } = payload
      const params = new URLSearchParams({
        per_page: '200',
        page: String(page),
        ...(after_ts ? { after: String(after_ts) } : {}),
      })
      const batch = await stravaGet(`/athlete/activities?${params}`, accessToken)
      apiCalls = 1

      const rides = (batch || []).filter(a => RIDE_TYPES.includes(a.sport_type || a.type))

      if (rides.length > 0) {
        const rows = rides.map(a => ({
          user_id: task.user_id,
          strava_activity_id: String(a.id),
          name: a.name,
          sport_type: a.sport_type || a.type,
          start_date: a.start_date,
          distance_m: a.distance || 0,
          elevation_gain_m: a.total_elevation_gain || 0,
          elev_high: a.elev_high ?? null,
          moving_time_s: a.moving_time || 0,
          year: new Date(a.start_date).getFullYear(),
          month: new Date(a.start_date).getMonth() + 1,
          summary_polyline: a.map?.summary_polyline || null,
        }))
        await db.from('activities').upsert(rows, { onConflict: 'strava_activity_id', ignoreDuplicates: false })

        // Create detail tasks for each activity
        const detailTasks = rides.map(a => ({
          job_id: task.job_id,
          user_id: task.user_id,
          task_type: 'fetch_activity_detail',
          payload: { strava_activity_id: String(a.id) },
          api_calls: 1,
        }))
        for (let i = 0; i < detailTasks.length; i += 50) {
          await db.from('sync_tasks').insert(detailTasks.slice(i, i + 50))
        }
      }

      // More pages?
      if (batch?.length >= 200) {
        await db.from('sync_tasks').insert({
          job_id: task.job_id,
          user_id: task.user_id,
          task_type: 'fetch_activity_list',
          payload: { page: page + 1, after_ts },
        })
      } else {
        // Last page — create deletion check task
        await db.from('sync_tasks').insert({
          job_id: task.job_id,
          user_id: task.user_id,
          task_type: 'check_deletions',
          payload: { page: 1 },
        })
      }

      await db.from('sync_jobs').update({
        progress: { phase: 'fetch_list', page, fetched: rides.length },
        updated_at: new Date().toISOString(),
      }).eq('id', task.job_id)

      break
    }

    case 'fetch_activity_detail': {
      const { strava_activity_id } = payload
      const detail = await stravaGet(`/activities/${strava_activity_id}`, accessToken)
      apiCalls = 1

      const description = detail.description || null
      await db.from('activities')
        .update({ description })
        .eq('strava_activity_id', strava_activity_id)
        .eq('user_id', task.user_id)

      const climbs = parseQualdichClimbs(description)
      if (climbs.length > 0) {
        const { data: dbAct } = await db
          .from('activities')
          .select('id, start_date')
          .eq('strava_activity_id', strava_activity_id)
          .single()
        if (dbAct) {
          const climbRows = climbs.map(c => ({
            activity_id: dbAct.id,
            name: c.name,
            ele: c.ele,
            climb_type: c.climb_type,
            visited_at: dbAct.start_date,
          }))
          await db.from('qualdich_climbs')
            .upsert(climbRows, { onConflict: 'activity_id,name', ignoreDuplicates: false })
        }
      }
      break
    }

    case 'check_deletions': {
      const { page } = payload
      const params = new URLSearchParams({ per_page: '200', page: String(page) })
      const batch = await stravaGet(`/athlete/activities?${params}`, accessToken)
      apiCalls = 1

      const stravaIds = (batch || [])
        .filter(a => RIDE_TYPES.includes(a.sport_type || a.type))
        .map(a => String(a.id))

      const { data: job } = await db.from('sync_jobs').select('progress').eq('id', task.job_id).single()
      const existingIds = job?.progress?.strava_ids || []
      const allIds = [...existingIds, ...stravaIds]

      if (batch?.length >= 200) {
        await db.from('sync_jobs').update({
          progress: { ...job?.progress, phase: 'check_deletions', strava_ids: allIds },
          updated_at: new Date().toISOString(),
        }).eq('id', task.job_id)

        await db.from('sync_tasks').insert({
          job_id: task.job_id,
          user_id: task.user_id,
          task_type: 'check_deletions',
          payload: { page: page + 1 },
        })
      } else {
        const stravaIdSet = new Set(allIds)
        const { data: stored } = await db
          .from('activities')
          .select('id, strava_activity_id')
          .eq('user_id', task.user_id)

        const toDelete = (stored || [])
          .filter(r => !stravaIdSet.has(r.strava_activity_id))
          .map(r => r.id)

        if (toDelete.length > 0) {
          await db.from('activities').delete().in('id', toDelete)
        }

        await db.from('sync_jobs').update({
          progress: { phase: 'done', deleted: toDelete.length },
          updated_at: new Date().toISOString(),
        }).eq('id', task.job_id)
      }
      break
    }

    case 'title_sync_activity': {
      const { strava_activity_id, name, activity_db_id } = payload
      const original = (name || '').replace(/\s*⛰\s*$/, '').trimEnd()
      const withTag = original + TRIGGER_CHAR

      await stravaUpdate(strava_activity_id, { name: withTag }, accessToken)
      await stravaUpdate(strava_activity_id, { name: original }, accessToken)
      apiCalls = 2

      if (activity_db_id) {
        await db.from('activities').update({ name: original }).eq('id', activity_db_id)
      }
      break
    }

    default:
      throw new Error(`Unknown task type: ${task_type}`)
  }

  await db.from('sync_tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', task.id)

  return apiCalls
}

/**
 * Finalize jobs where all tasks are done, and clean up stale jobs.
 */
async function finalizeJobs(db) {
  const { data: jobs } = await db
    .from('sync_jobs')
    .select('id, user_id, job_type, progress')
    .eq('status', 'running')

  for (const job of (jobs || [])) {
    const { count: pending } = await db
      .from('sync_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .in('status', ['pending', 'running'])

    if (pending === 0) {
      const { count: total } = await db
        .from('sync_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)

      const { count: failed } = await db
        .from('sync_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .eq('status', 'failed')

      if (job.job_type !== 'title_sync') {
        await db.from('users').update({
          last_synced_at: new Date().toISOString()
        }).eq('id', job.user_id)
      }

      await db.from('sync_jobs').update({
        status: 'completed',
        result: { total_tasks: total || 0, failed_tasks: failed || 0, deleted: job.progress?.deleted || 0 },
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }
  }

  // Stale job cleanup (30+ min without progress)
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  await db
    .from('sync_jobs')
    .update({ status: 'failed', error: 'Timeout' })
    .eq('status', 'running')
    .lt('updated_at', staleThreshold)
}

// --- Strava API helpers ---

async function stravaGet(path, accessToken) {
  const res = await fetch(STRAVA_BASE + path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function stravaUpdate(activityId, body, accessToken) {
  const res = await fetch(`${STRAVA_BASE}/activities/${activityId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Strava PUT ${res.status}: ${await res.text()}`)
  return res.json()
}
