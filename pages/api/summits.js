import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'

async function getSummitsForYear(db, userId, year) {
  // Get activity IDs for this user + year
  const { data: acts, error: actsErr } = await db
    .from('activities')
    .select('id, start_date')
    .eq('user_id', userId)
    .eq('year', year)
  if (actsErr) throw actsErr
  if (!acts?.length) return []

  const activityIds = acts.map(a => a.id)
  const actDateMap  = Object.fromEntries(acts.map(a => [a.id, a.start_date]))

  // Get all summit visits for these activities
  const { data: visits, error: visitsErr } = await db
    .from('activity_summits')
    .select('summit_id, activity_id, visited_at, summits(name, ele, osm_type, lat, lon)')
    .in('activity_id', activityIds)
  if (visitsErr) throw visitsErr
  if (!visits?.length) return []

  // Group by summit
  const grouped = {}
  for (const v of visits) {
    const s = v.summits
    if (!grouped[v.summit_id]) {
      grouped[v.summit_id] = {
        summit_id:    v.summit_id,
        name:         s?.name || 'Unbenannter Gipfel',
        ele:          s?.ele  || null,
        osm_type:     s?.osm_type || 'peak',
        visit_count:  0,
        last_visited: null,
      }
    }
    grouped[v.summit_id].visit_count++
    const date = v.visited_at || actDateMap[v.activity_id]
    if (!grouped[v.summit_id].last_visited || date > grouped[v.summit_id].last_visited) {
      grouped[v.summit_id].last_visited = date
    }
  }

  return Object.values(grouped).sort((a, b) => b.visit_count - a.visit_count || (b.ele || 0) - (a.ele || 0))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  if (session.demo) {
    return res.json({ current: { total: 0, summits: [] }, previous: { total: 0 } })
  }

  const year = parseInt(req.query.year)
  const db   = supabaseAdmin()

  try {
    const [current, previous] = await Promise.all([
      getSummitsForYear(db, session.userId, year),
      getSummitsForYear(db, session.userId, year - 1),
    ])
    res.json({
      current:  { total: current.length,  summits: current },
      previous: { total: previous.length },
    })
  } catch (e) {
    console.error('Summits API error:', e)
    res.status(500).json({ error: e.message })
  }
}
