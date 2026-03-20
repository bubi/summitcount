#!/usr/bin/env node
// Einmalig ausführen um den Webhook bei Strava zu registrieren:
// node register-webhook.js

require('dotenv').config({ path: '.env.local' })

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const CALLBACK_URL  = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`
const VERIFY_TOKEN  = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN

async function main() {
  console.log('Registering webhook...')
  console.log('Callback URL:', CALLBACK_URL)

  // Check existing subscriptions first
  const checkRes = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  )
  const existing = await checkRes.json()

  if (existing.length > 0) {
    console.log('⚠ Webhook already registered! ID:', existing[0].id)
    console.log('Delete first with: node delete-webhook.js', existing[0].id)
    return
  }

  // Register new webhook
  const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      callback_url:  CALLBACK_URL,
      verify_token:  VERIFY_TOKEN,
    }),
  })

  const data = await res.json()
  if (data.id) {
    console.log('✓ Webhook registered! Subscription ID:', data.id)
  } else {
    console.error('✗ Failed:', JSON.stringify(data, null, 2))
  }
}

main().catch(console.error)
