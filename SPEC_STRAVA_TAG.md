# Feature Spec: Strava Gipfel-Tag pro Aktivität

## Ziel

Aktivitäten bei denen ein Gipfel erkannt wurde, können manuell mit dem Tag `⛰` auf Strava versehen werden. Ein Button pro Ride in der Aktivitätsliste macht das möglich. quäldich und andere Dienste, die Strava-Tags lesen, erkennen diese Aktivitäten dann automatisch.

---

## User Flow

1. User sieht Aktivitätsliste im Dashboard
2. Rides mit erkanntem Gipfel zeigen einen **`⛰ Tag setzen`** Button
3. User klickt → API-Call an Strava → Tag `⛰` wird zur Aktivität hinzugefügt
4. Button zeigt danach **`⛰ Getaggt`** (disabled) — kein erneutes Setzen

---

## Tag-Format

```
⛰
```

- Nur das Symbol, kein Text, keine Zahl
- Wird als Strava-"Gear"-Tag oder Description-Append ergänzt

> **Hinweis:** Strava hat keine dedizierte Tag-API. Tags werden über das Feld `description` der Aktivität geschrieben — das `⛰`-Symbol wird am **Ende der bestehenden Description** angehängt (mit Leerzeichen getrennt). Wenn `⛰` bereits enthalten ist → nichts tun (idempotent).

---

## Scope

- Nur Aktivitäten **mit ≥1 erkanntem Gipfel** zeigen den Button
- Button erscheint in der Ride-Zeile in der Aktivitätsliste
- Erste Iteration: **manuell, kein Auto-Tag beim Sync**
- Tag wird nur einmal gesetzt — kein Überschreiben

---

## Technische Umsetzung

### Neue API-Route: `POST /api/tag-activity`

**Request:**
```json
{ "activityId": "<strava_activity_id>" }
```

**Logik:**
1. Session prüfen (auth)
2. Activity aus DB holen → prüfen ob User Eigentümer
3. Prüfen ob Activity ≥1 Gipfel hat (`activity_summits` JOIN)
4. Strava API: `GET /activities/{id}` → aktuelle Description lesen
5. Wenn `⛰` bereits in Description → `{ already: true }` zurückgeben
6. Strava API: `PUT /activities/{id}` → Description mit ` ⛰` anhängen
7. In DB: `tagged_at` Timestamp speichern (neues Feld in `activities`)

### DB-Migration

```sql
ALTER TABLE activities ADD COLUMN IF NOT EXISTS strava_tagged_at timestamptz;
```

### Strava API

```
PUT https://www.strava.com/api/v3/activities/{id}
Authorization: Bearer {access_token}
Body: { "description": "<bestehende description> ⛰" }
```

Strava erlaubt nur dem Eigentümer seine eigenen Aktivitäten zu bearbeiten — kein Problem da wir OAuth mit dem User-Token machen.

### Frontend: Aktivitätsliste

In `pages/dashboard.js` — Ride-Zeile bekommt einen Tag-Button:

```
AKTIVITÄT            DIST    HM    ZEIT   TYP     TAG
Frühjahrs-Ausfahrt   62km   480m  2h15m  RIDE    [⛰]
Wienerwald Gravel    78km   920m  3h30m  GRAVEL  [⛰ ✓]  ← bereits getaggt
Indoor Training      40km     0m  1h05m  VIRTUAL  —
```

- `[⛰]` → Button, klickbar, zeigt Tooltip "⛰-Tag auf Strava setzen"
- `[⛰ ✓]` → disabled, bereits getaggt (`strava_tagged_at` gesetzt)
- `—` → kein Gipfel erkannt, kein Button

### State-Management

- `taggedIds`: Set im lokalen State (für optimistisches UI-Update)
- Nach erfolgreichem API-Call: Button sofort auf disabled setzen, kein Page-Reload nötig

---

## Nicht in Scope (V1)

- Kein automatisches Taggen beim Sync
- Kein Entfernen des Tags
- Kein Batch-Tagging ("alle Gipfel-Rides taggen")
- Keine Jahres-Aggregation (folgt in V2)

---

## Erwartetes Ergebnis

Der User sieht in der Ride-Liste welche Touren Gipfel enthalten und kann diese mit einem Klick auf Strava markieren — für quäldich, Garmin Connect-Sync oder eigene Archivierung.
