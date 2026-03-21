# i18n Spec — SummitCount (DE / EN)

## Ziel

Zweisprachige UI (Deutsch / Englisch) ohne externe i18n-Library. Deutsch ist die Standardsprache.

---

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Sprachen | Deutsch (default), Englisch |
| Toggle | Flag-Button (🇩🇪 / 🇬🇧) im Dashboard-Header, oben rechts |
| Sichtbarkeit | Nur auf `dashboard.js` (nicht auf Login- oder Privacy-Seite) |
| Persistenz | `localStorage` unter dem Key `summitcount_lang` |
| Technik | Custom: JSON-Locale-Dateien + React Context + `useTranslation`-Hook |
| Nicht übersetzt | Sport-Labels (Ride, Virtual, E-Bike, Gravel, MTB, E-MTB, Velo), „Summit Count" (App-Name), Privacy Policy |

---

## Dateistruktur

```
locales/
  de.json        ← Deutsch (Fallback/Default)
  en.json        ← Englisch
lib/
  i18n.js        ← Context, Provider, useTranslation Hook
pages/
  dashboard.js   ← Toggle-Button + useTranslation
```

---

## lib/i18n.js — Aufbau

```js
// React Context + Provider
// useTranslation() → { t, lang, setLang }
// t('key') → string aus aktiver Locale, Fallback auf 'de'
// Initialisierung: localStorage.getItem('summitcount_lang') ?? 'de'
// Speichern: localStorage.setItem('summitcount_lang', lang) bei Wechsel
```

---

## Toggle-UI im Header

- Position: In `.header-right`, zwischen User-Info und Actions-Row
- Darstellung: Zwei Emoji-Flags als Buttons — `🇩🇪` und `🇬🇧`
- Aktive Sprache: leicht hervorgehoben (opacity 1.0), inaktive gedimmt (opacity 0.35)
- Kein Text-Label neben den Flags

```
[🇩🇪] [🇬🇧]     ← aktive Sprache ist hell, inaktive gedimmt
```

---

## Locale-Keys & Texte

### `locales/de.json`

```json
{
  "login.desc": "Deine jährlichen Ride-Stats — Distanz, Höhenmeter, Zeit.\nVerbinde einmal, Daten bleiben gespeichert.",
  "login.fine": "Nur Lesezugriff auf deine Aktivitäten.\nKeine Daten werden an Dritte weitergegeben.",
  "login.privacyLink": "Datenschutz",

  "loading.auth": "AUTHENTIFIZIERE…",
  "loading.activities": "LADE AKTIVITÄTEN…",
  "loading.init": "INITIALISIERE…",

  "sync.badge.full": "✓ {count} Rides geladen",
  "sync.badge.new": "+{count} neu",
  "sync.badge.deleted": "{count} gelöscht",
  "sync.badge.upToDate": "✓ Aktuell",
  "sync.button": "Sync",
  "logout": "Logout",

  "sport.all": "Alle",

  "stat.totalDistance": "Gesamtstrecke",
  "stat.elevationGained": "Höhenmeter",
  "stat.totalTime": "Gesamtzeit",
  "stat.rides": "Rides",
  "stat.avgSpeed": "Ø Geschwindigkeit",
  "stat.avgDistance": "Ø Distanz",
  "stat.unit.km": "KM",
  "stat.unit.miles": "MILES",
  "stat.unit.meters": "METER",
  "stat.unit.feet": "FUSS",
  "stat.unit.hrsMin": "STD / MIN",
  "stat.unit.activities": "AKTIVITÄTEN",
  "stat.unit.kmh": "KM/H",
  "stat.unit.mph": "MPH",
  "stat.unit.kmRide": "KM / RIDE",
  "stat.unit.miRide": "MI / RIDE",

  "chart.title": "Monatsübersicht",
  "chart.tab.distance": "Distanz",
  "chart.tab.elevation": "Höhenmeter",
  "chart.tab.rides": "Rides",
  "chart.tooltip.rides": "{count} Rides",

  "rides.title.all": "Alle Rides — {count} Aktivitäten",
  "rides.title.filtered": "{sports} — {count} Aktivitäten",
  "rides.col.activity": "Aktivität",
  "rides.col.dist": "Dist",
  "rides.col.elev": "Hm",
  "rides.col.time": "Zeit",
  "rides.col.type": "Typ",

  "empty.message": "Keine Rides gefunden. Sync läuft beim ersten Laden automatisch.",
  "empty.syncButton": "Jetzt synchronisieren →",

  "footer.privacy": "Datenschutz",

  "date.locale": "de-AT"
}
```

### `locales/en.json`

```json
{
  "login.desc": "Your annual ride stats — distance, elevation, time.\nConnect once, data stays saved.",
  "login.fine": "Read-only access to your activities.\nNo data is shared with third parties.",
  "login.privacyLink": "Privacy Policy",

  "loading.auth": "AUTHENTICATING…",
  "loading.activities": "LOADING ACTIVITIES…",
  "loading.init": "INITIALIZING…",

  "sync.badge.full": "✓ {count} rides loaded",
  "sync.badge.new": "+{count} new",
  "sync.badge.deleted": "{count} deleted",
  "sync.badge.upToDate": "✓ Up to date",
  "sync.button": "Sync",
  "logout": "Logout",

  "sport.all": "All",

  "stat.totalDistance": "Total Distance",
  "stat.elevationGained": "Elevation Gained",
  "stat.totalTime": "Total Ride Time",
  "stat.rides": "Rides Completed",
  "stat.avgSpeed": "Avg Speed",
  "stat.avgDistance": "Avg Distance",
  "stat.unit.km": "KM",
  "stat.unit.miles": "MILES",
  "stat.unit.meters": "METERS",
  "stat.unit.feet": "FEET",
  "stat.unit.hrsMin": "HRS / MIN",
  "stat.unit.activities": "ACTIVITIES",
  "stat.unit.kmh": "KM/H",
  "stat.unit.mph": "MPH",
  "stat.unit.kmRide": "KM / RIDE",
  "stat.unit.miRide": "MI / RIDE",

  "chart.title": "Monthly Breakdown",
  "chart.tab.distance": "Distance",
  "chart.tab.elevation": "Elevation",
  "chart.tab.rides": "Rides",
  "chart.tooltip.rides": "{count} rides",

  "rides.title.all": "All Rides — {count} activities",
  "rides.title.filtered": "{sports} — {count} activities",
  "rides.col.activity": "Activity",
  "rides.col.dist": "Dist",
  "rides.col.elev": "Elev",
  "rides.col.time": "Time",
  "rides.col.type": "Type",

  "empty.message": "No rides found. Sync runs automatically on first load.",
  "empty.syncButton": "Sync now →",

  "footer.privacy": "Privacy Policy",

  "date.locale": "en-GB"
}
```

---

## Interpolation

Einfache `{placeholder}`-Syntax in `t()`:

```js
t('sync.badge.full', { count: 42 })
// → "✓ 42 rides loaded"
```

---

## Datumsformat

- `date.locale`-Key steuert das Locale für `toLocaleDateString()`
- DE: `de-AT` → `15. Mär. 2025`
- EN: `en-GB` → `15 Mar 2025`

---

## Zahlenformate

Keine separaten Formatter nötig — die bestehenden `fmtDist`, `fmtElev`, `fmtVal` etc. bleiben unverändert. Die Units werden über die Locale-Keys übersetzt.

---

## Nicht übersetzt (explizit ausgeschlossen)

- Sport-Labels: `Ride`, `Virtual`, `E-Bike`, `Gravel`, `MTB`, `E-MTB`, `Velo`
- App-Name: `SUMMIT COUNT` / `SummitCount`
- Privacy Policy Seite (`privacy.js`) — bleibt ausschließlich auf Englisch
- Login-Seite (`index.js`) — kein Toggle dort, aber `login.desc` und `login.fine` werden trotzdem übersetzt (für zukünftige Erweiterung vorbereitet, aktuell kein Toggle sichtbar)
- Strava-Button-Text: `Connect with Strava` (Strava-Branding)
- `Powered by Strava` (Strava-Branding)

> **Hinweis:** Da der Toggle nur im Dashboard sichtbar ist, zeigt die Login-Seite immer Deutsch. Die Locale-Keys für Login werden trotzdem definiert, da sie bei einem späteren Ausbau gebraucht werden könnten.

---

## Implementierungsschritte

1. **`locales/de.json`** und **`locales/en.json`** anlegen
2. **`lib/i18n.js`** schreiben: Context, Provider, `useTranslation`-Hook mit localStorage-Persistenz
3. **`pages/_app.js`** (anlegen falls nicht vorhanden) mit `I18nProvider` wrappen
4. **`pages/dashboard.js`** umbauen:
   - `useTranslation` importieren
   - Alle hardcodierten Strings durch `t('key')` ersetzen
   - Flag-Toggle in `.header-right` einbauen
   - Datumsformat via `t('date.locale')` steuern
5. Optionales Cleanup: Login-Seite-Strings vorbereiten (ohne sichtbaren Toggle)

---

## Out of Scope (diese Iteration)

- URL-basiertes Routing (`/de/`, `/en/`)
- Server-Side Rendering mit korrekter Locale (SSR bleibt immer Deutsch)
- Weitere Sprachen
- Übersetzung der Privacy Policy
