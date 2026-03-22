import { supabaseAdmin } from './supabase'

// Strava limits: 100 req/15min, 1000 req/day
// Reserve headroom for webhooks and interactive requests
const FIFTEEN_MIN_LIMIT = 80   // 20 reserved for webhooks
const DAILY_LIMIT       = 900  // 100 reserved

/**
 * Get the current rate limit budget (how many calls are available).
 * Automatically resets windows when they expire.
 */
export async function getRateLimitBudget(db) {
  if (!db) db = supabaseAdmin()

  const { data, error } = await db
    .from('rate_limit_state')
    .select('*')
    .eq('id', 'global')
    .single()

  if (error || !data) {
    // No row yet — initialize
    await db.from('rate_limit_state').upsert({
      id: 'global',
      fifteen_min_count: 0,
      fifteen_min_reset: new Date().toISOString(),
      daily_count: 0,
      daily_reset: new Date().toISOString(),
    })
    return { available: FIFTEEN_MIN_LIMIT, fifteenMin: 0, daily: 0 }
  }

  const now = Date.now()
  let { fifteen_min_count, fifteen_min_reset, daily_count, daily_reset } = data
  let needsUpdate = false

  // Reset 15-minute window if expired
  if (now - new Date(fifteen_min_reset).getTime() > 15 * 60 * 1000) {
    fifteen_min_count = 0
    fifteen_min_reset = new Date().toISOString()
    needsUpdate = true
  }

  // Reset daily window if expired
  if (now - new Date(daily_reset).getTime() > 24 * 60 * 60 * 1000) {
    daily_count = 0
    daily_reset = new Date().toISOString()
    needsUpdate = true
  }

  if (needsUpdate) {
    await db.from('rate_limit_state').update({
      fifteen_min_count,
      fifteen_min_reset,
      daily_count,
      daily_reset,
    }).eq('id', 'global')
  }

  const available = Math.min(
    FIFTEEN_MIN_LIMIT - fifteen_min_count,
    DAILY_LIMIT - daily_count
  )

  return { available: Math.max(available, 0), fifteenMin: fifteen_min_count, daily: daily_count }
}

/**
 * Increment the rate limit counters by the given number of API calls.
 */
export async function trackApiCalls(db, count = 1) {
  if (!db) db = supabaseAdmin()

  // Use raw SQL via rpc for atomic increment
  await db.rpc('increment_rate_limit', { call_count: count })
}
