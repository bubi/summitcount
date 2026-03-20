import { getSession } from '../../../lib/session'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.userId) return res.status(401).json({ error: 'Not logged in' })
  res.json({
    userId:    session.userId,
    stravaId:  session.stravaId,
    firstname: session.firstname,
    lastname:  session.lastname,
    profileImg: session.profileImg,
    city:      session.city,
    country:   session.country,
  })
}
