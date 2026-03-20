# Cycling Odometer v2

Multi-user cycling stats dashboard mit Login, Datenspeicherung und Delta-Sync.

## Stack
- **Next.js** auf Vercel
- **Supabase** (Postgres) für User + Aktivitäten
- **Strava OAuth** als Login
- **iron-session** für sichere Sessions

## Setup

### 1. Supabase einrichten
1. Account auf [supabase.com](https://supabase.com) → New Project
2. SQL Editor öffnen → Inhalt von `supabase-schema.sql` einfügen → Run
3. Project Settings → API → URLs + Keys notieren

### 2. Strava API App
1. [strava.com/settings/api](https://www.strava.com/settings/api) → App erstellen
2. Authorization Callback Domain: `deine-app.vercel.app`
3. Client ID + Secret notieren

### 3. Lokal entwickeln
```bash
cp .env.local.example .env.local
# .env.local mit echten Werten befüllen
npm install
npm run dev
```

### 4. Auf Vercel deployen
```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/USER/strava-odometer.git
git push -u origin main
```
→ vercel.com → New Project → Import → Deploy

### 5. Environment Variables in Vercel setzen
Vercel Dashboard → Project → Settings → Environment Variables:
```
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
SUPABASE_URL
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL        → https://deine-app.vercel.app
SESSION_SECRET             → openssl rand -base64 32
```

## Delta-Sync Logik
- **Erster Login**: Alle Rides werden von Strava geholt und in Supabase gespeichert
- **Folgende Logins**: Nur Rides seit `last_synced_at` werden nachgeladen
- Token-Refresh läuft automatisch wenn der Access Token abläuft
