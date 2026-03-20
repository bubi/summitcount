import { getIronSession } from 'iron-session'

export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'summitcount_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 60, // 60 days
    path: '/',
  },
}

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions)
}
