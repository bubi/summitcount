# Feature Spec: Year-over-Year Comparison

## Ziel

Auf dem Dashboard werden überall relevante Werte mit dem Vorjahr verglichen.
Mehr als Vorjahr → **grün** mit `▲ +X (Y%)`
Weniger als Vorjahr → **rot** mit `▼ −X (Y%)`
Kein Vorjahr vorhanden → Delta wird ausgeblendet.

Der Vergleich berücksichtigt den aktiven Sportarten-Filter (z.B. "nur Gravel" → Vergleich nur mit Gravel-Daten des Vorjahres).

---

## Datengrundlage

Alle Aktivitäten sind bereits client-seitig in `activities` State geladen.
**Kein neuer API-Endpunkt nötig.**

```js
// Bereits vorhanden:
const yearRides    = activities.filter(a => year === ...)
const filteredRides = selectedSports.length === 0 ? yearRides : yearRides.filter(...)

// Neu — analog für Vorjahr:
const prevYear       = year - 1
const prevYearRides  = activities.filter(a => new Date(a.start_date).getFullYear() === prevYear)
const prevFiltered   = selectedSports.length === 0
  ? prevYearRides
  : prevYearRides.filter(a => selectedSports.includes(a.sport_type))
const hasPrevYear    = prevFiltered.length > 0
```

---

## Delta-Berechnung

```js
function calcDelta(current, prev) {
  if (prev === 0 || !hasPrevYear) return null
  const abs  = current - prev
  const pct  = (abs / prev) * 100
  return { abs, pct, positive: abs >= 0 }
}
```

Rückgabe `null` → kein Delta rendern.

---

## UI-Komponente: `<Delta>`

Eine kleine Inline-Komponente (oder Helper-Funktion), die unterhalb des `stat-value` erscheint:

```
▲ +312 km (+6,9 %)   ← grün
▼ −2.100 m (−2,3 %)  ← rot
```

**Aufbau:**

```jsx
function DeltaBadge({ delta, formatAbs }) {
  if (!delta) return null
  const sign  = delta.positive ? '+' : '−'
  const arrow = delta.positive ? '▲' : '▼'
  const color = delta.positive ? '#4caf50' : '#f44336'
  const pct   = Math.abs(delta.pct).toFixed(1)
  return (
    <div className="delta" style={{ color }}>
      {arrow} {sign}{formatAbs(Math.abs(delta.abs))} ({sign}{pct}%)
    </div>
  )
}
```

**CSS:**
```css
.delta {
  font-family: 'DM Mono', monospace;
  font-size: .68rem;
  margin-top: 6px;
  letter-spacing: .04em;
}
```

---

## 1. Stats-Kacheln (stats-grid)

Jede `stat-card` bekommt unterhalb von `.stat-unit` ein `<DeltaBadge>`.

| Kachel           | `current`           | `prev`              | `formatAbs`            |
|------------------|---------------------|---------------------|------------------------|
| Total Distance   | `totalDist` (m)     | `prevTotalDist` (m) | `fmtVal(x, unit)` + Einheit |
| Elevation Gained | `totalElev` (m)     | `prevTotalElev` (m) | `fmtElevV(x, unit)` + Einheit |
| Total Ride Time  | `totalTime` (s)     | `prevTotalTime` (s) | `fmtTime(x)`           |
| Rides Completed  | `filteredRides.length` | `prevFiltered.length` | `x` (Ganzzahl)      |
| Avg Speed        | `avgSpeed` (km/h)   | `prevAvgSpeed`      | `x.toFixed(1)` + Einheit |
| Avg Distance     | `totalDist/count`   | `prevDist/prevCount`| `fmtVal(x, unit)` + Einheit |

---

## 2. Monats-Balkendiagramm (bar-chart)

Pro Monat wird ein **zweiter, transparenter Ghost-Balken** für das Vorjahr gerendert.

**Layout:** Zwei schmale Balken nebeneinander pro Monat.

```
[2025 ████] [2024 ░░░]   ← grün wenn 2025 > 2024, rot wenn kleiner
```

**Umsetzung:**
- `prevMonthly` = analog zu `monthly` aber für `prevFiltered`
- Im `bar-wrap` zwei `<div class="bar">`: einer für aktuelles Jahr, einer (Ghost) für Vorjahr
- Ghost-Balken: gedämpfte Farbe (`rgba(255,255,255,0.15)`), kein Hover-Tooltip nötig (optional: "Vorjahr: X")
- Tooltip des aktuellen Balkens bleibt wie jetzt, optional ergänzt um `"\nVorjahr: X"`
- Nur rendern wenn `hasPrevYear`

```jsx
<div className="bar-wrap" key={i}>
  <div className="bar-tip">{tip}{hasPrevYear ? `\nVJ: ${prevTip}` : ''}</div>
  <div className="bar-pair">
    <div className="bar dist" style={{ height: `${pct}%` }} />
    {hasPrevYear && (
      <div className="bar prev" style={{ height: `${prevPct}%` }} />
    )}
  </div>
  <div className="bar-label">{MONTHS[i]}</div>
</div>
```

**Zusätzliches CSS:**
```css
.bar-pair {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  height: 100%;
  justify-content: center;
}
.bar { flex: 1; border-radius: 3px 3px 0 0; min-height: 2px; }
.bar.prev { background: rgba(255,255,255,0.18); }
```

---

## 3. Nicht betroffen

- **Aktivitätenliste** (ride-by-ride) — kein Vorjahresvergleich, macht semantisch keinen Sinn
- **Loading-Screen** — keine Änderungen
- **API-Endpunkte** — keine Änderungen

---

## Verhalten bei Randfällen

| Situation | Verhalten |
|-----------|-----------|
| Kein Vorjahresdaten vorhanden | `hasPrevYear = false` → alle Deltas ausgeblendet |
| Vorjahr hat 0 km für einen Monat | Vorjahresbalken auf 0px Höhe (kein Ghost-Balken) |
| Vorjahr-Wert = 0, aktuell > 0 | Delta ausblenden (Division durch 0) |
| Aktuell = 0, Vorjahr > 0 | −100% → anzeigen (rot) |
| Sportfilter aktiv | `prevFiltered` nutzt denselben Sport-Filter |

---

## Implementierungsschritte

1. `prevYear`, `prevYearRides`, `prevFiltered`, `hasPrevYear` berechnen (direkt nach `filteredRides`)
2. Vorjahres-Aggregatwerte berechnen (`prevTotalDist`, `prevTotalElev`, `prevTotalTime`, `prevAvgSpeed`)
3. `calcDelta()` Hilfsfunktion hinzufügen
4. `DeltaBadge` Komponente (oder Inline-JSX) implementieren
5. Stats-Kacheln: Delta unterhalb `.stat-unit` einfügen
6. `prevMonthly` berechnen
7. Bar-Chart: Ghost-Balken & `.bar-pair` Layout
8. CSS für `.delta`, `.bar-pair`, `.bar.prev`

---

## Nicht in Scope

- Vergleich mit beliebigem Jahr (nur immer Vorjahr)
- Zeitraum-Vergleich innerhalb eines Jahres (z.B. Q1 vs Q1)
- Server-seitige Änderungen
