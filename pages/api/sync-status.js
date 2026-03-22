import { supabaseAdmin } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { getJobStatus } from '../../lib/queue'
import { processQueue } from '../../lib/queue-worker'

/**
 * GET /api/sync-status
 * Returns the latest sync job status for the logged-in user.
 * Also processes a small batch of queue tasks on each call (piggyback processing).
 * This way no Vercel Pro plan or external cron service is needed.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  if (session.demo) return res.json({ job: null })

  const db = supabaseAdmin()

  try {
    // Piggyback: process a few queue tasks while we're here
    await processQueue(db, 5)

    const job = await getJobStatus(db, session.userId)
    res.json({ job })
  } catch (e) {
    console.error('Sync status error:', e)
    res.status(500).json({ error: e.message })
  }
}
