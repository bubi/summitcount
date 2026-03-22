import { supabaseAdmin } from '../../lib/supabase'
import { refreshAccessToken, stravaGet, fetchActivity } from '../../lib/strava'
import { parseQualdichClimbs } from '../../lib/qualdich'

// Strava sends a GET to verify the webhook endpoint
// and a POST for each event (activity created/updated/deleted, athlete deauthorized)

export default async function handler(req, res) {
  if (req.method === 'GET') return handleVerification(req, res)
  if (req.method === 'POST') return handleEvent(req, res)
  res.status(405).end()
}

// ── Verification handshake (one-time setup) ───────────────────────────────────
function handleVerification(req, res) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified')
    return res.json({ 'hub.challenge': challenge })
  }
  res.status(403).json({ error: 'Forbidden' })
}

// ── Event handler ─────────────────────────────────────────────────────────────
async function handleEvent(req, res) {
  // Always respond 200 immediately — Strava retries if we don't
  res.status(200).end()

  const { object_type, aspect_type, object_id, owner_id } = req.body

  // Only handle activity events
  if (object_type !== 'activity') {
    // Athlete deauthorized → delete all their data
    if (object_type === 'athlete' && aspect_type === 'update' && req.body.updates?.authorized === 'false') {
      await handleDeauth(owner_id)
    }
    return
  }

  const db = supabaseAdmin()

  // Find user by strava_id
  const { data: user } = await db
    .from('users')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('strava_id', owner_id)
    .single()

  if (!user) return // user not in our DB

  // Refresh token if needed
  let accessToken = user.access_token
  if (Date.now() / 1000 > user.token_expires_at - 300) {
    try {
      const refreshed = await refreshAccessToken(
        process.env.STRAVA_CLIENT_ID,
        process.env.STRAVA_CLIENT_SECRET,
        user.refresh_token
      )
      accessToken = refreshed.access_token
      await db.from('users').update({
        access_token:     refreshed.access_token,
        refresh_token:    refreshed.refresh_token,
        token_expires_at: refreshed.expires_at,
      }).eq('id', user.id)
    } catch(e) {
      console.error('Token refresh failed:', e.message)
      return
    }
  }

  if (aspect_type === 'create' || aspect_type === 'update') {
    await handleActivityUpsert(db, user.id, object_id, accessToken)
  } else if (aspect_type === 'delete') {
    await handleActivityDelete(db, user.id, object_id)
  }
}

// ── Upsert a single activity ──────────────────────────────────────────────────
async function handleActivityUpsert(db, userId, activityId, accessToken) {
  try {
    const a = await stravaGet(`/activities/${activityId}`, accessToken)

    const RIDE_TYPES = ['Ride','VirtualRide','EBikeRide','GravelRide','MountainBikeRide']
    if (!RIDE_TYPES.includes(a.sport_type || a.type)) return // not a ride

    await db.from('activities').upsert({
      user_id:            userId,
      strava_activity_id: String(a.id),
      name:               a.name,
      sport_type:         a.sport_type || a.type,
      start_date:         a.start_date,
      distance_m:         a.distance || 0,
      elevation_gain_m:   a.total_elevation_gain || 0,
      elev_high:          a.elev_high ?? null,
      moving_time_s:      a.moving_time || 0,
      year:               new Date(a.start_date).getFullYear(),
      month:              new Date(a.start_date).getMonth() + 1,
      summary_polyline:   a.map?.summary_polyline || null,
      description:        a.description || null,
    }, { onConflict: 'strava_activity_id' })

    console.log(`Activity ${activityId} upserted for user ${userId}`)

    // Parse quäldich climbs from description
    const climbs = parseQualdichClimbs(a.description || '')
    if (climbs.length > 0) {
      const { data: dbAct } = await db
        .from('activities')
        .select('id, start_date')
        .eq('strava_activity_id', String(a.id))
        .single()
      if (dbAct) {
        const climbRows = climbs.map(c => ({
          activity_id: dbAct.id,
          name:        c.name,
          ele:         c.ele,
          climb_type:  c.climb_type,
          visited_at:  dbAct.start_date,
        }))
        await db.from('qualdich_climbs')
          .upsert(climbRows, { onConflict: 'activity_id,name', ignoreDuplicates: false })
      }
    }
  } catch(e) {
    console.error(`Failed to upsert activity ${activityId}:`, e.message)
  }
}

// ── Delete a single activity ──────────────────────────────────────────────────
async function handleActivityDelete(db, userId, activityId) {
  await db
    .from('activities')
    .delete()
    .eq('user_id', userId)
    .eq('strava_activity_id', String(activityId))
  console.log(`Activity ${activityId} deleted for user ${userId}`)
}

// ── Athlete deauthorized → delete all their data ──────────────────────────────
async function handleDeauth(stravaId) {
  const db = supabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('strava_id', stravaId)
    .single()
  if (!user) return
  await db.from('activities').delete().eq('user_id', user.id)
  await db.from('users').delete().eq('id', user.id)
  console.log(`Deauthorized and deleted user ${stravaId}`)
}
