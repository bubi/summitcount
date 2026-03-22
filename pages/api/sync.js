import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { enqueueFullSync, enqueueIncrementalSync, getJobStatus } from '../../lib/queue'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo) return res.json({ status: 'completed', job: null })

  const db = supabaseAdmin()

  try {
    const { data: user, error: userErr } = await db
      .from('users')
      .select('last_synced_at')
      .eq('id', session.userId)
      .single()
    if (userErr) throw userErr

    let job
    if (user.last_synced_at) {
      const afterTs = Math.floor(new Date(user.last_synced_at).getTime() / 1000)
      job = await enqueueIncrementalSync(db, session.userId, afterTs)
    } else {
      job = await enqueueFullSync(db, session.userId)
    }

    res.json({ status: job?.status || 'queued', jobId: job?.id })
  } catch (e) {
    console.error('Sync enqueue error:', e)
    res.status(500).json({ error: e.message })
  }
}
