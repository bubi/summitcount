# Feature Spec: Alpine Wire-Frame Background

## Ziel

Ersetze das generische Grid-Background durch eine erkennbare **Alpen-Berglandschaft im Wire-Frame-Stil** — Gipfel, Grate und Täler, in Alpenglühen-Farben. Ganzer Bildschirm, sehr subtile Animation. Kein Umbau der Pages nötig, nur `lib/mountainBackground.js` wird ausgetauscht.

---

## Visuelles Konzept

### Topographie

Statt zufälligem Noise: **definierte alpine Gipfelformen** mit:
- 5–7 markante Peaks mit realistischen Verhältnissen (Gipfel schmal, Flanken lang)
- Grate die Peaks verbinden (Ridge-Lines)
- Taleinschnitte zwischen Massiven
- Peaks positioniert im hinteren Bildschirmbereich (oben), Täler unten

**Mathematisches Modell** (Verbesserung gegenüber aktuell):
```js
// Statt flachem Gauss: kombinierter Peak mit schmaler Spitze und langen Flanken
function peakShape(d) {
  return 1 / (1 + (d * d * 0.6))        // breite Basis
       + 0.4 / (1 + (d * d * 4))        // scharfe Spitze
}
// Mehrere Peaks überlagert ergeben Grat-Effekt
```

### Grid

- **Gleiche Struktur wie aktuell**: COLS × ROWS Gitterpunkte, horizontal + vertikal verbundene Linien
- Grid dichter im oberen Bereich (Berge) — COLS: 40, ROWS: 22
- **Schnee-Highlight**: Punkte über Schwellwert bekommen extra helle Linie (`rgba(255,255,255,…)`)
- Gitternetz-Zellen mit hoher Elevation leicht gefüllt (sehr transparent)

---

## Farb-Schema: Alpenglühen

```
Tal / tief:    rgba(20, 15, 35, 0)        — dunkelblau-violett, transparent
Mittelhang:    rgba(100, 60, 120, 0.03)   — lila
Grat-Linien:   rgba(200, 80, 40, 0.10–0.25)  — orange-rot je nach Höhe
Gipfel-Linien: rgba(255, 140, 60, 0.30)  — orange, hell
Schnee:        rgba(255, 220, 180, 0.15) — warm-weißer Schimmer an Spitzen
Zell-Füllung:  rgba(180, 60, 30, 0.02–0.05) — sehr transparentes Orange
```

**Kein #e8ff47 im Hintergrund** — das Dashboard-Accent bleibt nur für UI-Elemente reserviert.

---

## Animation: sehr subtil

```js
// Nur minimalste Wellenbewegung — kaum wahrnehmbar
const wave = Math.sin(t * speed + phase + d * 0.3) * 0.06  // war 0.15
// speed nochmals reduziert: 0.0000008 statt 0.000002
```

- Wirkung: Berge „atmen" kaum merklich — wie Hitzefimmern in der Ferne
- `requestAnimationFrame` bleibt (für Resize-Kompatibilität), aber Änderungen pro Frame minimal

---

## Technische Umsetzung

### Änderungen ausschließlich in `lib/mountainBackground.js`

**Schritt 1 — Peak-Definition**

Statt `Math.random()` für alle Peaks: **semi-feste Alpine-Topographie** die bei jedem Load gleich aussieht, aber mit leichtem Seed-Jitter:

```js
const PEAK_TEMPLATES = [
  { rx: 0.15, ry: 0.25, h: 7.5 },  // Westmassiv
  { rx: 0.32, ry: 0.18, h: 9.0 },  // Hauptgipfel (höchster)
  { rx: 0.48, ry: 0.22, h: 6.5 },  // Mittlerer Grat
  { rx: 0.60, ry: 0.15, h: 8.0 },  // Ostgipfel
  { rx: 0.75, ry: 0.28, h: 5.5 },  // Schulter rechts
  { rx: 0.88, ry: 0.20, h: 7.0 },  // Ostmassiv
]
// rx/ry als relative Koordinaten (0–1), skaliert auf COLS/ROWS
```

**Schritt 2 — Elevation Function**

```js
function elevation(gx, gy, t) {
  let h = 0
  for (const p of peaks) {
    const dx = gx - p.x
    const dy = (gy - p.y) * 1.8    // vertikal stärker komprimiert → spitzer
    const d  = Math.sqrt(dx*dx + dy*dy) + 0.001
    const tip  = p.h * 0.8 / (1 + d*d*4)    // scharfe Spitze
    const base = p.h * 0.5 / (1 + d*d*0.3)  // breite Basis/Flanke
    const wave = Math.sin(t * p.speed * 800 + p.phase + d * 0.3) * 0.06
    h += tip + base + wave
  }
  return h
}
```

**Schritt 3 — Farb-Mapping**

```js
function lineColor(norm) {
  // norm: 0 (Tal) → 1 (Gipfel)
  if (norm < 0.3) return `rgba(80, 40, 100, ${0.03 + norm * 0.05})`  // violett, fast unsichtbar
  if (norm < 0.6) return `rgba(160, 60, 40, ${0.06 + norm * 0.10})`  // orange-rot
  if (norm < 0.85) return `rgba(210, 90, 40, ${0.12 + norm * 0.15})` // helles Orange
  return `rgba(255, 200, 140, ${0.20 + norm * 0.15})`                 // Schnee/Gipfel warm-weiß
}

function fillColor(avgNorm) {
  if (avgNorm < 0.4) return null  // kein Fill unter 40%
  return `rgba(160, 50, 20, ${avgNorm * 0.035})`  // sehr transparentes Orange
}
```

**Schritt 4 — Schnee-Highlights**

Für Punkte mit `norm > 0.88`: zusätzlicher kleiner Punkt / hellere Überlagerungslinie:
```js
if (norm > 0.88) {
  ctx.strokeStyle = `rgba(255, 230, 200, ${(norm - 0.88) * 1.2})`
  ctx.lineWidth = 0.3
  // nochmals über die Linie zeichnen
}
```

---

## Nicht in Scope

- Keine neuen Pages oder Komponenten
- Kein Schatten-/Fog-Effekt (zu aufwändig für Canvas)
- Keine Sterne / Himmel-Elemente
- Keine Änderungen an Dashboard-Layout oder CSS

---

## Erwartetes Ergebnis

Ein Wire-Frame-Grid das aussieht wie eine **topografische Karte der Alpen bei Alpenglühen** — erkennbare Gipfel und Grate in Orange-Rot, fast schwarze Täler, kaum wahrnehmbare Atembewegung. Der Inhalt des Dashboards bleibt vollständig lesbar.
