import { getSession } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabase'
import { refreshAccessToken } from '../../../lib/strava'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  try {
    const db = supabaseAdmin()

    // Check if token needs refresh
    const { data: user } = await db
      .from('users')
      .select('access_token, refresh_token, token_expires_at')
      .eq('id', session.userId)
      .single()

    if (user && Date.now() / 1000 > user.token_expires_at - 300) {
      // Refresh silently in the background
      const refreshed = await refreshAccessToken(
        process.env.STRAVA_CLIENT_ID,
        process.env.STRAVA_CLIENT_SECRET,
        user.refresh_token
      )
      await db.from('users').update({
        access_token:     refreshed.access_token,
        refresh_token:    refreshed.refresh_token,
        token_expires_at: refreshed.expires_at,
      }).eq('id', session.userId)
    }

    // Extend session cookie lifetime on every request
    await session.save()

  } catch(e) {
    // Non-fatal — user is still logged in even if refresh fails
    console.error('Token refresh error:', e.message)
  }

  res.json({
    userId:     session.userId,
    stravaId:   session.stravaId,
    firstname:  session.firstname,
    lastname:   session.lastname,
    profileImg: session.profileImg,
    city:       session.city,
    country:    session.country,
  })
}
