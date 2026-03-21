import { supabaseAdmin } from '../../lib/supabase'
import { getSession }    from '../../lib/session'

async function getClimbsForYear(db, userId, year) {
  const { data: acts, error: actsErr } = await db
    .from('activities')
    .select('id, start_date')
    .eq('user_id', userId)
    .eq('year', year)
  if (actsErr) throw actsErr
  if (!acts?.length) return []

  const actIds = acts.map(a => a.id)

  const { data: climbs, error: climbsErr } = await db
    .from('qualdich_climbs')
    .select('name, ele, climb_type, visited_at, activity_id')
    .in('activity_id', actIds)
  if (climbsErr) throw climbsErr
  if (!climbs?.length) return []

  // Group by name — same pass can be ridden multiple times
  const grouped = {}
  for (const c of climbs) {
    if (!grouped[c.name]) {
      grouped[c.name] = {
        name:         c.name,
        ele:          c.ele,
        climb_type:   c.climb_type,
        visit_count:  0,
        last_visited: null,
      }
    }
    grouped[c.name].visit_count++
    if (!grouped[c.name].last_visited || c.visited_at > grouped[c.name].last_visited) {
      grouped[c.name].last_visited = c.visited_at
    }
  }

  return Object.values(grouped)
    .sort((a, b) => b.visit_count - a.visit_count || (b.ele || 0) - (a.ele || 0))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  if (session.demo) return res.json({ current: { total: 0, climbs: [] }, previous: { total: 0 } })

  const year = parseInt(req.query.year)
  const db   = supabaseAdmin()

  try {
    const [current, previous] = await Promise.all([
      getClimbsForYear(db, session.userId, year),
      getClimbsForYear(db, session.userId, year - 1),
    ])
    res.json({
      current:  { total: current.length, climbs: current },
      previous: { total: previous.length },
    })
  } catch (e) {
    console.error('Climbs API error:', e)
    res.status(500).json({ error: e.message })
  }
}
