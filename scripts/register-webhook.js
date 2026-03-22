#!/usr/bin/env node
// Webhook bei Strava registrieren:
// node register-webhook.js

const CLIENT_ID    = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const CALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`
  : null
const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

if (!CLIENT_ID || !CLIENT_SECRET || !CALLBACK_URL || !VERIFY_TOKEN) {
  console.error('Fehlende Umgebungsvariablen. Bitte so ausführen:')
  console.error('')
  console.error('STRAVA_CLIENT_ID=xxx \\')
  console.error('STRAVA_CLIENT_SECRET=xxx \\')
  console.error('NEXT_PUBLIC_APP_URL=https://summitcount.vercel.app \\')
  console.error('STRAVA_WEBHOOK_VERIFY_TOKEN=summitcount_webhook_2026 \\')
  console.error('node register-webhook.js')
  process.exit(1)
}

async function main() {
  console.log('Callback URL:', CALLBACK_URL)

  // Check existing
  const checkRes = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  )
  const existing = await checkRes.json()

  if (Array.isArray(existing) && existing.length > 0) {
    console.log('⚠ Webhook bereits registriert! ID:', existing[0].id)
    console.log('Zum Löschen:')
    console.log(`STRAVA_CLIENT_ID=${CLIENT_ID} STRAVA_CLIENT_SECRET=${CLIENT_SECRET} node delete-webhook.js ${existing[0].id}`)
    return
  }

  const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:    CLIENT_ID,
      client_secret: CLIENT_SECRET,
      callback_url: CALLBACK_URL,
      verify_token: VERIFY_TOKEN,
    }),
  })

  const data = await res.json()
  if (data.id) {
    console.log('✓ Webhook registriert! Subscription ID:', data.id)
  } else {
    console.error('✗ Fehler:', JSON.stringify(data, null, 2))
  }
}

main().catch(console.error)
