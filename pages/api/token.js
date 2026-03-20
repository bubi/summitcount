export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, client_id, client_secret, refresh_token, grant_type } = req.body;

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, client_secret, code, refresh_token, grant_type }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
