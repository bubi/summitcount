import { supabaseAdmin } from '../../../lib/supabase'
import { processQueue } from '../../../lib/queue-worker'

/**
 * Cron endpoint for processing the sync queue.
 * Can be called by Vercel Cron (Pro plan) or an external cron service.
 * On the Hobby plan, queue processing is done via piggyback on /api/sync-status.
 */
export default async function handler(req, res) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const db = supabaseAdmin()

  try {
    const result = await processQueue(db, 20)
    return res.json(result)
  } catch (e) {
    console.error('Queue processing error:', e)
    return res.status(500).json({ error: e.message })
  }
}
