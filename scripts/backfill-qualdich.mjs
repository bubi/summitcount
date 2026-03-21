#!/usr/bin/env node
// Backfill quäldich climbs from Strava activity descriptions
// Run: node scripts/backfill-qualdich.mjs

const SUPABASE_URL = 'https://cegpdbauixrnwihuhkbg.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZ3BkYmF1aXhybndpaHVoa2JnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NTAyNiwiZXhwIjoyMDg5NTcxMDI2fQ.Jzfy0xnOw1J9Y3qtuGn3YUjiTyQwd7Ne1CtpKBho-Vg'
const STRAVA_CLIENT_ID     = '192407'
const STRAVA_CLIENT_SECRET = '8094ebf04ebf512424640ae4fa0eec729b3017f8'

const hdrs = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: hdrs })
  return res.json()
}
async function sbPatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: hdrs, body: JSON.stringify(body)
  })
}
async function sbUpsert(table, rows, conflict) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { ...hdrs, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  })
}

// quäldich note parser — mirrors lib/qualdich.js
const TYPE_PATTERN  = /\|\s*qu[äa]ldich-(\w+)/
const ENTRY_PATTERN = /([^,(|]+?)\s*\((\d+)\s*m\)/g
function parseQualdichClimbs(description) {
  if (!description) return []
  const results = []
  for (const line of description.split(/\r?\n/)) {
    const typeMatch = line.match(TYPE_PATTERN)
    if (!typeMatch) continue
    const climbType = typeMatch[1]
    const leftPart  = line.split('|')[0]
    let m
    ENTRY_PATTERN.lastIndex = 0
    while ((m = ENTRY_PATTERN.exec(leftPart)) !== null) {
      const name = m[1].trim()
      const ele  = parseInt(m[2], 10)
      if (name) results.push({ name, ele, climb_type: climbType })
    }
  }
  return results
}

async function refreshToken(rt) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token' }),
  })
  return res.json()
}

async function main() {
  console.log('=== quäldich Backfill Script ===\n')

  const users = await sb('users?select=id,strava_id,access_token,refresh_token,token_expires_at')
  if (!Array.isArray(users) || !users.length) { console.error('No users'); return }

  for (const user of users) {
    console.log(`User ${user.strava_id}`)

    let token = user.access_token
    if (Date.now() / 1000 > user.token_expires_at - 300) {
      console.log('  Refreshing token...')
      const r = await refreshToken(user.refresh_token)
      token = r.access_token
      await sbPatch(`users?id=eq.${user.id}`, { access_token: r.access_token, refresh_token: r.refresh_token, token_expires_at: r.expires_at })
    }

    // Get all activities without description yet
    const acts = await sb(`activities?user_id=eq.${user.id}&description=is.null&select=id,strava_activity_id,start_date&order=start_date.desc`)
    console.log(`  ${acts.length} activities without description\n`)

    let found = 0
    for (const act of acts) {
      try {
        const res = await fetch(`https://www.strava.com/api/v3/activities/${act.strava_activity_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) { process.stdout.write('x'); continue }
        const detail = await res.json()
        const description = detail.description || null

        await sbPatch(`activities?id=eq.${act.id}`, { description })

        const climbs = parseQualdichClimbs(description)
        if (climbs.length > 0) {
          const rows = climbs.map(c => ({
            activity_id: act.id,
            name:        c.name,
            ele:         c.ele,
            climb_type:  c.climb_type,
            visited_at:  act.start_date,
          }))
          await sbUpsert('qualdich_climbs', rows, 'activity_id,name')
          process.stdout.write(`\n  ⛰  ${climbs.map(c=>c.name).join(', ')}\n`)
          found += climbs.length
        } else {
          process.stdout.write('.')
        }
      } catch (e) {
        process.stdout.write('!')
      }
      // Strava rate limit: 100 req/15min
      await new Promise(r => setTimeout(r, 700))
    }

    console.log(`\n\n  Done: ${found} quäldich climbs found\n`)
  }
  console.log('=== Backfill complete ===')
}

main().catch(console.error)
