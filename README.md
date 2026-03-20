# Cycling Odometer — Karoo / AXS / Strava

Yearly cycling stats dashboard — distance, elevation, ride time — powered by Strava API.
Works with Hammerhead Karoo and SRAM AXS via Strava sync.

## Deploy to Vercel (5 Minuten)

### 1. Auf GitHub pushen

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/DEIN-USER/strava-odometer.git
git push -u origin main
```

### 2. Auf Vercel deployen

1. Geh zu [vercel.com](https://vercel.com) → New Project
2. GitHub Repo importieren
3. Deploy klicken — fertig!

Deine URL: `https://strava-odometer-xxx.vercel.app`

### 3. Strava API App konfigurieren

1. Geh zu [strava.com/settings/api](https://www.strava.com/settings/api)
2. **Authorization Callback Domain:** `strava-odometer-xxx.vercel.app` (deine Vercel URL, ohne https://)
3. Client ID + Secret in der App eingeben → Mit Strava verbinden

## Lokal entwickeln

```bash
npm install
npm run dev
# → http://localhost:3000
# Callback Domain in Strava: localhost
```
