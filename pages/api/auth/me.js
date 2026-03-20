import { getSession } from '../../../lib/session'
import { supabaseAdmin } from '../../../lib/supabase'
import { refreshAccessToken } from '../../../lib/strava'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  try {
    const db = supabaseAdmin()
    const { data: user } = await db
      .from('users')
      .select('access_token, refresh_token, token_expires_at')
      .eq('id', session.userId)
      .single()

    if (user && Date.now() / 1000 > user.token_expires_at - 300) {
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

    await session.save()
  } catch(e) {
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
