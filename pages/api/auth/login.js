import crypto from 'crypto'
import { getSession } from '../../../lib/session'

export default async function handler(req, res) {
  // Generate CSRF state token and store in session
  const state = crypto.randomBytes(16).toString('hex')
  const session = await getSession(req, res)
  session.oauthState = state
  await session.save()

  const clientId = process.env.STRAVA_CLIENT_ID
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&approval_prompt=force&scope=activity:read_all,activity:write&state=${state}`
  res.redirect(url)
}
