import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { fetchActivitiesSince, refreshAccessToken } from '../../lib/strava'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  const db = supabaseAdmin()

  try {
    // 1. Load user tokens from DB
    const { data: user, error: userErr } = await db
      .from('users')
      .select('access_token, refresh_token, token_expires_at, last_synced_at')
      .eq('id', session.userId)
      .single()
    if (userErr) throw userErr

    // 2. Refresh token if expired
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

    // 3. Delta: only fetch activities since last sync
    const afterTs = user.last_synced_at
      ? Math.floor(new Date(user.last_synced_at).getTime() / 1000)
      : null  // null = full initial sync

    const syncStarted = new Date().toISOString()
    const newActivities = await fetchActivitiesSince(accessToken, afterTs)

    // 4. Upsert new activities into DB
    let inserted = 0
    if (newActivities.length > 0) {
      const rows = newActivities.map(a => ({
        user_id:              session.userId,
        strava_activity_id:   String(a.id),
        name:                 a.name,
        sport_type:           a.sport_type || a.type,
        start_date:           a.start_date,
        distance_m:           a.distance || 0,
        elevation_gain_m:     a.total_elevation_gain || 0,
        moving_time_s:        a.moving_time || 0,
        year:                 new Date(a.start_date).getFullYear(),
        month:                new Date(a.start_date).getMonth() + 1,
      }))

      const { error: insertErr, count } = await db
        .from('activities')
        .upsert(rows, { onConflict: 'strava_activity_id', ignoreDuplicates: false })
        .select('id')
      if (insertErr) throw insertErr
      inserted = newActivities.length
    }

    // 5. Update last_synced_at
    await db.from('users').update({ last_synced_at: syncStarted }).eq('id', session.userId)

    res.json({
      synced: inserted,
      isFullSync: !afterTs,
      lastSyncedAt: syncStarted,
    })
  } catch (e) {
    console.error('Sync error:', e)
    res.status(500).json({ error: e.message })
  }
}
