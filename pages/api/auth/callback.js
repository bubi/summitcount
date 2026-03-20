import { supabaseAdmin } from '../../../lib/supabase'
import { getSession } from '../../../lib/session'

export default async function handler(req, res) {
  const { code, error } = req.query
  if (error || !code) return res.redirect('/?error=access_denied')

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error(tokenData.message || 'Token exchange failed')

    const { access_token, refresh_token, expires_at, athlete } = tokenData

    const db = supabaseAdmin()
    const { data: user, error: upsertErr } = await db
      .from('users')
      .upsert({
        strava_id:        athlete.id,
        username:         athlete.username,
        firstname:        athlete.firstname,
        lastname:         athlete.lastname,
        profile_img:      athlete.profile_medium,
        city:             athlete.city,
        country:          athlete.country,
        access_token,
        refresh_token,
        token_expires_at: expires_at,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'strava_id' })
      .select()
      .single()

    if (upsertErr) throw upsertErr

    const session = await getSession(req, res)
    session.userId     = user.id
    session.stravaId   = athlete.id
    session.firstname  = athlete.firstname
    session.lastname   = athlete.lastname
    session.profileImg = athlete.profile_medium
    session.city       = athlete.city
    session.country    = athlete.country
    await session.save()

    res.redirect('/dashboard')
  } catch (e) {
    console.error('Auth callback error:', e)
    res.redirect(`/?error=${encodeURIComponent(e.message)}`)
  }
}
