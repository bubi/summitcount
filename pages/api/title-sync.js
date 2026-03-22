import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { enqueueTitleSync } from '../../lib/queue'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo) return res.json({ status: 'completed', job: null })

  const { year } = req.body
  if (!year) return res.status(400).json({ error: 'year required' })

  const db = supabaseAdmin()

  try {
    const job = await enqueueTitleSync(db, session.userId, year)
    if (!job) return res.json({ status: 'completed', job: null, message: 'No activities for this year' })

    res.json({ status: job.status, jobId: job.id })
  } catch (e) {
    console.error('Title sync enqueue error:', e)
    res.status(500).json({ error: e.message })
  }
}
