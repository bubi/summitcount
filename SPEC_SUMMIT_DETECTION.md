# Feature Spec: Gipfelerkennung (Summit Detection)

## Ziel

Pro Aktivität erkennen welche Gipfel, Pässe und Sättel besucht wurden — basierend auf GPS-Route und OpenStreetMap-Daten. Ergebnis: Stat-Karte im Dashboard + dedizierter "Gipfel"-Tab mit Detailübersicht.

---

## Anforderungen (aus User-Interview)

| Parameter | Entscheidung |
|---|---|
| Hochpunkt-Typen | `natural=peak` + `mountain_pass` + `natural=saddle` |
| Erkennungsradius | 150 m |
| Anzeige | Stat-Karte (Zahl) + eigener Tab "Gipfel" |
| Sync | Bei jedem Strava-Sync, direkt nach Activity-Speicherung |

---

## Technische Architektur

### 1. Datenbank-Erweiterungen

**Tabelle `activities`** — neue Spalte:
```sql
ALTER TABLE activities ADD COLUMN IF NOT EXISTS summary_polyline text;
```

**Neue Tabelle `summits`** — OSM-Gipfelcache:
```sql
CREATE TABLE IF NOT EXISTS summits (
  id          uuid primary key default gen_random_uuid(),
  osm_id      bigint unique not null,
  name        text,
  ele         integer,           -- Höhe in Metern (aus OSM elevation-Tag)
  osm_type    text,              -- 'peak' | 'mountain_pass' | 'saddle'
  lat         float not null,
  lon         float not null,
  created_at  timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_summits_latlon ON summits(lat, lon);
```

**Neue Tabelle `activity_summits`** — Zuordnung Activity → Gipfel:
```sql
CREATE TABLE IF NOT EXISTS activity_summits (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  summit_id   uuid not null references summits(id) on delete cascade,
  visited_at  timestamptz,       -- = start_date der Activity
  UNIQUE(activity_id, summit_id)
);
CREATE INDEX IF NOT EXISTS idx_act_summits_activity ON activity_summits(activity_id);
CREATE INDEX IF NOT EXISTS idx_act_summits_summit   ON activity_summits(summit_id);
```

---

### 2. Polyline speichern (Sync)

In `pages/api/sync.js` beim Speichern jeder Activity:
- `summary_polyline` aus dem Strava-Response in DB speichern
- Strava liefert dieses Feld bereits im List-Endpoint (`/athlete/activities`)

---

### 3. Gipfelerkennung (nach Sync)

Nach dem Speichern der Activities, neue Funktion `detectSummits(activityId, polyline, userId)`:

```
1. Polyline dekodieren → Array von [lat, lon] Punkten
   (eigener Decoder, kein npm-Paket nötig — Googles Algorithmus, ~15 Zeilen)

2. Bounding Box der Route berechnen (min/max lat/lon) + 0.01° Puffer

3. Overpass API anfragen:
   GET https://overpass-api.de/api/interpreter
   Query: alle Nodes mit natural=peak OR mountain_pass OR natural=saddle
          innerhalb der Bounding Box

4. Gefundene OSM-Nodes in `summits` tabelle upserten (by osm_id)

5. Für jeden OSM-Node: prüfen ob min. 1 Route-Punkt innerhalb 150m liegt
   (Haversine-Distanz, kein externen Package)

6. Treffer → Eintrag in `activity_summits`
```

**Rate-Limit Schutz:**
- Overpass-Request nur wenn `summary_polyline` vorhanden
- Max 1 Request/Sekunde (kurze Pause zwischen Activities beim Bulk-Sync)
- Timeout: 10 Sekunden per Request

---

### 4. API-Endpoints

**`GET /api/summits?year=2026`**
- Gibt alle besuchten Gipfel des Users für das Jahr zurück
- Response: `{ total, summits: [{name, ele, osm_type, count, last_visited}] }`

---

### 5. Dashboard-Anzeige

**Stat-Karte:**
- Neue Karte in der bestehenden Stats-Grid neben Distanz/HM/Zeit/Rides
- Zeigt: Anzahl unique Gipfel im gewählten Jahr
- Mit YoY-Delta (gleiche DeltaBadge-Komponente wie andere Karten)

**Gipfel-Tab:**
- Neuer Tab neben den bestehenden Sport-Filter-Buttons: `ALLE | GRAVEL | RIDE | VIRTUAL | GIPFEL`
- Wenn aktiv: zeigt statt Rides-Liste eine Gipfel-Tabelle
- Spalten: Name | Höhe | Typ | Besuche | Zuletzt

---

## Nicht in Scope

- Keine Kartenansicht / Mapbox-Integration
- Keine Offline-Gipfeldatenbank (reines OSM-Live-Lookup)
- Kein Caching der Overpass-Responses über Sessions hinaus (DB ist der Cache)
- Keine Gipfelerkennung für Virtual Rides (kein GPS)

---

## Erwartetes Ergebnis

User sieht auf einen Blick: "23 Gipfel in 2026" mit YoY-Vergleich, und kann im Gipfel-Tab nachschauen welche das waren — mit Name, Höhe und wie oft besucht.
