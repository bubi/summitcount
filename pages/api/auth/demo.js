import { getSession } from '../../../lib/session'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  session.userId = 'demo'
  session.demo   = true
  await session.save()
  res.redirect('/dashboard')
}
