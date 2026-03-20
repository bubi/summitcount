import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('activities')
    .select('*')
    .eq('user_id', session.userId)
    .order('start_date', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ activities: data, count: data.length })
}
