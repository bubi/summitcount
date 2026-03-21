import { supabaseAdmin } from '../../lib/supabase'
import { getSession }    from '../../lib/session'
import { stravaUpdate, refreshAccessToken } from '../../lib/strava'

const TRIGGER_CHAR = ' ⛰'

async function getToken(db, userId) {
  const { data: userRow, error } = await db
    .from('users')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)

  if (Date.now() / 1000 > userRow.token_expires_at - 300) {
    const r = await refreshAccessToken(
      process.env.STRAVA_CLIENT_ID,
      process.env.STRAVA_CLIENT_SECRET,
      userRow.refresh_token,
    )
    await db.from('users').update({
      access_token:     r.access_token,
      refresh_token:    r.refresh_token,
      token_expires_at: r.expires_at,
    }).eq('id', userId)
    return r.access_token
  }
  return userRow.access_token
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo)    return res.json({ synced: 0, failed: 0, total: 0 })

  const { year } = req.body
  if (!year) return res.status(400).json({ error: 'year required' })

  const db = supabaseAdmin()

  let token
  try { token = await getToken(db, session.userId) }
  catch (e) { return res.status(500).json({ error: e.message }) }

  // All real outdoor activities for this year (with a Strava ID)
  const { data: acts, error: actsErr } = await db
    .from('activities')
    .select('id, strava_activity_id, name')
    .eq('user_id', session.userId)
    .eq('year', parseInt(year))
    .not('strava_activity_id', 'is', null)
  if (actsErr) return res.status(500).json({ error: actsErr.message })
  if (!acts?.length) return res.json({ synced: 0, failed: 0, total: 0 })

  let synced = 0, failed = 0

  for (const act of acts) {
    const original = (act.name || '').replace(/\s*⛰\s*$/, '').trimEnd()
    const withTag  = original + TRIGGER_CHAR

    try {
      // 1. Add ⛰
      await stravaUpdate(act.strava_activity_id, { name: withTag }, token)
      // tiny pause so Strava registers the change
      await new Promise(r => setTimeout(r, 300))
      // 2. Remove ⛰ immediately
      await stravaUpdate(act.strava_activity_id, { name: original }, token)
      // Restore clean name in local DB (in case it drifted)
      await db.from('activities').update({ name: original }).eq('id', act.id)
      synced++
    } catch (e) {
      console.error(`title-sync failed for ${act.strava_activity_id}:`, e.message)
      failed++
    }

    // Strava rate limit: ~100 req/15min → 2 calls per activity → ~200ms gap
    await new Promise(r => setTimeout(r, 200))
  }

  res.json({ synced, failed, total: acts.length })
}
