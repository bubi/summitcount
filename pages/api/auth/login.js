export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&approval_prompt=force&scope=activity:read_all,activity:write`
  res.redirect(url)
}
