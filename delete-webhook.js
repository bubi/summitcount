#!/usr/bin/env node
// node delete-webhook.js <subscription_id>

require('dotenv').config({ path: '.env.local' })

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const id = process.argv[2]

if (!id) { console.error('Usage: node delete-webhook.js <subscription_id>'); process.exit(1) }

fetch(`https://www.strava.com/api/v3/push_subscriptions/${id}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`, {
  method: 'DELETE'
}).then(r => {
  if (r.status === 204) console.log('✓ Webhook deleted')
  else r.json().then(d => console.error('✗ Failed:', d))
})
