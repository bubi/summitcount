import { supabaseAdmin } from '../../lib/supabase'
import { getSession }    from '../../lib/session'
import { stravaUpdate, refreshAccessToken } from '../../lib/strava'

const SUMMIT_CHAR = '⛰'

function addSummitSymbols(title, count) {
  // Strip any existing symbols first to avoid duplicates
  const clean = title.replace(/\s*⛰+$/, '').trimEnd()
  const symbols = SUMMIT_CHAR.repeat(Math.min(count, 5)) // max 5 symbols
  return `${clean} ${symbols}`
}

function removeSummitSymbols(title) {
  return title.replace(/\s*⛰+$/, '').trimEnd()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo)    return res.json({ updated: 0, failed: 0, total: 0 })

  const { year, action } = req.body
  if (!year || !['add', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'year and action (add|remove) required' })
  }

  const db = supabaseAdmin()

  // Get user tokens
  const { data: userRow, error: uErr } = await db
    .from('users')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', session.userId)
    .single()
  if (uErr) return res.status(500).json({ error: uErr.message })

  // Refresh token if needed
  let token = userRow.access_token
  if (Date.now() / 1000 > userRow.token_expires_at - 300) {
    const r = await refreshAccessToken(
      process.env.STRAVA_CLIENT_ID,
      process.env.STRAVA_CLIENT_SECRET,
      userRow.refresh_token,
    )
    token = r.access_token
    await db.from('users').update({
      access_token:     r.access_token,
      refresh_token:    r.refresh_token,
      token_expires_at: r.expires_at,
    }).eq('id', session.userId)
  }

  // Fetch all activities for this year that have summits
  const { data: acts, error: actsErr } = await db
    .from('activities')
    .select('id, strava_activity_id, name')
    .eq('user_id', session.userId)
    .eq('year', parseInt(year))
    .not('strava_activity_id', 'is', null)
  if (actsErr) return res.status(500).json({ error: actsErr.message })

  if (!acts?.length) return res.json({ updated: 0, failed: 0, total: 0 })

  // Get summit counts per activity
  const actIds = acts.map(a => a.id)
  const { data: visits } = await db
    .from('activity_summits')
    .select('activity_id')
    .in('activity_id', actIds)

  // Count per activity
  const countMap = {}
  for (const v of visits || []) {
    countMap[v.activity_id] = (countMap[v.activity_id] || 0) + 1
  }

  // Only process activities with summits (or all for remove)
  const toProcess = action === 'add'
    ? acts.filter(a => countMap[a.id] > 0)
    : acts.filter(a => a.name?.includes(SUMMIT_CHAR))

  let updated = 0, failed = 0

  for (const act of toProcess) {
    const newName = action === 'add'
      ? addSummitSymbols(act.name || '', countMap[act.id] || 1)
      : removeSummitSymbols(act.name || '')

    if (newName === act.name) continue // nothing to change

    try {
      const updated_activity = await stravaUpdate(act.strava_activity_id, { name: newName }, token)
      // Update local DB name too
      await db.from('activities')
        .update({ name: newName })
        .eq('id', act.id)
      updated++
    } catch (e) {
      console.error(`title-sync failed for ${act.strava_activity_id}:`, e.message)
      failed++
    }

    // Strava rate limit: ~100 req/15min → ~8 req/s → be safe with 200ms
    await new Promise(r => setTimeout(r, 200))
  }

  res.json({ updated, failed, total: toProcess.length })
}
