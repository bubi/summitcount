#!/usr/bin/env node
// Reparse quäldich climbs from already-stored descriptions (no Strava API needed)
// Run: node scripts/reparse-qualdich.mjs

const SUPABASE_URL = 'https://cegpdbauixrnwihuhkbg.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZ3BkYmF1aXhybndpaHVoa2JnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk5NTAyNiwiZXhwIjoyMDg5NTcxMDI2fQ.Jzfy0xnOw1J9Y3qtuGn3YUjiTyQwd7Ne1CtpKBho-Vg'

const hdrs = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: hdrs })
  return res.json()
}
async function sbUpsert(table, rows, conflict) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: { ...hdrs, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  })
}

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

async function main() {
  console.log('=== Reparse quäldich climbs from stored descriptions ===\n')

  // Fetch all activities that have a description with quäldich marker
  const acts = await sb(`activities?description=like.*qu%C3%A4ldich*&select=id,start_date,description,name`)
  console.log(`Found ${acts.length} activities with quäldich notes\n`)

  let total = 0
  for (const act of acts) {
    const climbs = parseQualdichClimbs(act.description)
    if (!climbs.length) continue

    console.log(`${act.name} (${act.start_date?.slice(0,10)}):`)
    for (const c of climbs) console.log(`  ⛰  ${c.name} (${c.ele} m) — ${c.climb_type}`)

    await sbUpsert('qualdich_climbs',
      climbs.map(c => ({
        activity_id: act.id,
        name:        c.name,
        ele:         c.ele,
        climb_type:  c.climb_type,
        visited_at:  act.start_date,
      })),
      'activity_id,name'
    )
    total += climbs.length
  }

  console.log(`\nDone: ${total} quäldich climbs stored`)
}

main().catch(console.error)
