import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { fetchActivitiesSince, fetchAllActivityIds, refreshAccessToken } from '../../lib/strava'
import { detectSummits } from '../../lib/summits'

const REAL_SPORT_TYPES = ['Ride','EBikeRide','GravelRide','MountainBikeRide','EMountainBikeRide']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo) return res.json({ synced: 0, deleted: 0, isFullSync: false, lastSyncedAt: new Date().toISOString() })

  const db = supabaseAdmin()

  try {
    const { data: user, error: userErr } = await db
      .from('users')
      .select('access_token, refresh_token, token_expires_at, last_synced_at')
      .eq('id', session.userId)
      .single()
    if (userErr) throw userErr

    let accessToken = user.access_token
    if (Date.now() / 1000 > user.token_expires_at - 300) {
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
      }).eq('id', session.userId)
    }

    const afterTs = user.last_synced_at
      ? Math.floor(new Date(user.last_synced_at).getTime() / 1000)
      : null
    const isFullSync  = !afterTs
    const syncStarted = new Date().toISOString()

    const newActivities = await fetchActivitiesSince(accessToken, afterTs)

    let inserted = 0
    if (newActivities.length > 0) {
      const rows = newActivities.map(a => ({
        user_id:             session.userId,
        strava_activity_id:  String(a.id),
        name:                a.name,
        sport_type:          a.sport_type || a.type,
        start_date:          a.start_date,
        distance_m:          a.distance || 0,
        elevation_gain_m:    a.total_elevation_gain || 0,
        elev_high:           a.elev_high ?? null,
        moving_time_s:       a.moving_time || 0,
        year:                new Date(a.start_date).getFullYear(),
        month:               new Date(a.start_date).getMonth() + 1,
        summary_polyline:    a.map?.summary_polyline || null,
      }))
      const { error: insertErr } = await db
        .from('activities')
        .upsert(rows, { onConflict: 'strava_activity_id', ignoreDuplicates: false })
      if (insertErr) throw insertErr
      inserted = newActivities.length

      // Summit detection for real outdoor rides with GPS
      const withPolyline = newActivities.filter(a =>
        a.map?.summary_polyline && REAL_SPORT_TYPES.includes(a.sport_type || a.type)
      )
      if (withPolyline.length > 0) {
        // Fetch activity IDs from DB (we need the UUID, not the Strava ID)
        const stravaIds = withPolyline.map(a => String(a.id))
        const { data: dbRows } = await db
          .from('activities')
          .select('id, strava_activity_id, start_date, summary_polyline, elev_high')
          .in('strava_activity_id', stravaIds)

        for (const dbRow of dbRows || []) {
          if (!dbRow.summary_polyline) continue
          try {
            await detectSummits(dbRow.id, dbRow.summary_polyline, dbRow.start_date, dbRow.elev_high, db)
          } catch (e) {
            console.warn('Summit detection failed for', dbRow.id, e.message)
          }
          // Small pause to be kind to Overpass API
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }

    let deleted = 0
    const stravaIds = await fetchAllActivityIds(accessToken)
    const stravaIdSet = new Set(stravaIds)

    const { data: storedRows, error: storedErr } = await db
      .from('activities')
      .select('id, strava_activity_id')
      .eq('user_id', session.userId)
    if (storedErr) throw storedErr

    const toDelete = storedRows
      .filter(r => !stravaIdSet.has(r.strava_activity_id))
      .map(r => r.id)

    if (toDelete.length > 0) {
      const { error: delErr } = await db
        .from('activities')
        .delete()
        .in('id', toDelete)
      if (delErr) throw delErr
      deleted = toDelete.length
    }

    await db.from('users').update({ last_synced_at: syncStarted }).eq('id', session.userId)

    res.json({ synced: inserted, deleted, isFullSync, lastSyncedAt: syncStarted })
  } catch (e) {
    console.error('Sync error:', e)
    res.status(500).json({ error: e.message })
  }
}
