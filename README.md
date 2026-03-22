# SummitCount

Personal cycling statistics dashboard powered by Strava. Track your annual distance, elevation, time, and mountain passes — all in a clean, dark-themed interface.

## Features

- **Annual Stats** — Distance, elevation, ride time, averages at a glance
- **Year-over-Year Comparison** — Delta badges show how you compare to last year
- **Monthly Breakdown** — Bar charts for distance, elevation, and ride count
- **Mountain Passes** — Automatic extraction of climbs from activity descriptions (quäldich format)
- **Real-time Sync** — Strava webhooks keep your data up to date automatically
- **Mobile Responsive** — Works on desktop and phone
- **Bilingual** — German and English UI
- **Demo Mode** — Try without connecting Strava

## Tech Stack

- [Next.js 14](https://nextjs.org/) (Pages Router)
- [React 18](https://react.dev/)
- [Supabase](https://supabase.com/) (PostgreSQL)
- [iron-session](https://github.com/vvo/iron-session) for encrypted cookies
- Strava OAuth 2.0 + Webhooks
- Deployed on [Vercel](https://vercel.com/)

## Project Structure

```
pages/
  index.js              Login page
  dashboard.js          Main dashboard (stats, charts, rides, climbs)
  privacy.js            Privacy policy
  api/
    auth/               login, callback, logout, me, demo
    activities.js       Fetch stored activities
    climbs.js           Query quäldich climbs
    sync.js             Full/delta sync from Strava
    webhook.js          Strava webhook handler
    title-sync.js       Bulk title-tag sync for Strava activities

lib/
  strava.js             Strava API client (fetch, update, token refresh)
  supabase.js           Supabase admin client (server-side only)
  session.js            iron-session config
  i18n.js               i18n context provider
  qualdich.js           Parse quäldich climb notes from descriptions
  demoData.js           Demo activities for preview mode
  mountainBackground.js Canvas mountain animation (Alpenglühen)

locales/
  de.json               German translations
  en.json               English translations

scripts/
  supabase-schema.sql   Database schema (run once)
  register-webhook.js   Register Strava webhook subscription
  delete-webhook.js     Delete Strava webhook subscription
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/bubi/summitcount.git
cd summitcount
npm install
cp .env.example .env.local
```

### 2. Create a Strava API app

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new app
3. Set **Authorization Callback Domain** to your deploy URL (e.g. `summitcount.vercel.app`) or `localhost` for local dev
4. Copy **Client ID** and **Client Secret** into `.env.local`

### 3. Set up Supabase

1. Create a project on [supabase.com](https://supabase.com)
2. Open SQL Editor and run `scripts/supabase-schema.sql`
3. Go to Project Settings → API and copy the URL + keys into `.env.local`

### 4. Generate a session secret

```bash
openssl rand -base64 32
```

Paste the output as `SESSION_SECRET` in `.env.local`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local` to Vercel (Settings → Environment Variables)
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL (e.g. `https://summitcount.vercel.app`)

### 7. Register Strava webhook (one-time)

After deploying, register the webhook so Strava pushes activity updates in real-time:

```bash
STRAVA_CLIENT_ID=xxx \
STRAVA_CLIENT_SECRET=xxx \
NEXT_PUBLIC_APP_URL=https://summitcount.vercel.app \
STRAVA_WEBHOOK_VERIFY_TOKEN=your_token \
node scripts/register-webhook.js
```

## Environment Variables

| Variable | Description |
|---|---|
| `STRAVA_CLIENT_ID` | Strava API app Client ID |
| `STRAVA_CLIENT_SECRET` | Strava API app Client Secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL |
| `SESSION_SECRET` | Encryption key for session cookies |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random token for webhook verification |

## How Sync Works

- **First login** — All cycling activities are fetched from Strava and stored in Supabase
- **Subsequent syncs** — Only activities since `last_synced_at` are fetched (delta sync)
- **Webhooks** — When you create, update, or delete an activity on Strava, the webhook handler processes it automatically
- **Deauthorization** — If you revoke access via Strava, all your data is deleted automatically

## Mountain Passes (quäldich)

SummitCount extracts climb data from Strava activity descriptions. Add notes in this format:

```
Großglockner (2504 m) | Passjagd
Stelvio (2757 m) | Bergwertung
```

The format is: `Name (elevation m) | quäldich-Type`

Supported types: Passjagd, Bergwertung, Gipfeljagd, and others from [quäldich.de](https://www.quaeldich.de).

## License

[MIT](LICENSE)
