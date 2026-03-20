const STRAVA_BASE = 'https://www.strava.com/api/v3'

export async function stravaGet(path, accessToken) {
  const res = await fetch(STRAVA_BASE + path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API ${res.status}: ${await res.text()}`)
  return res.json()
}

// Fetch only activities AFTER a given Unix timestamp (for delta updates)
export async function fetchActivitiesSince(accessToken, afterTimestamp) {
  let page = 1
  const all = []
  while (true) {
    const params = new URLSearchParams({
      per_page: '200',
      page: String(page),
      ...(afterTimestamp ? { after: String(afterTimestamp) } : {}),
    })
    const batch = await stravaGet(`/athlete/activities?${params}`, accessToken)
    if (!batch?.length) break
    all.push(...batch)
    if (batch.length < 200) break
    page++
  }
  return all.filter(a =>
    ['Ride','VirtualRide','EBikeRide','GravelRide','MountainBikeRide'].includes(a.sport_type || a.type)
  )
}

// Refresh an expired access token using the refresh token
export async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}
