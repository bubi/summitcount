/**
 * Parser for quäldich notes in Strava activity descriptions.
 *
 * quäldich appends notes in this format (one per line, multiple possible):
 *   Edelweißspitze (2571 m) | quäldich-Passjagd +1
 *   Großglockner Hochalpenstraße (2504 m) | quäldich-Passjagd +1
 *
 * Supported climb types: Passjagd, Bergwertung, Gipfeljagd, Stravajagd, etc.
 */

// Matches: "Name (NNN m) | quäldich-Type +N"
// Name can include spaces, umlauts, dashes, slashes
const PATTERN = /^(.+?)\s*\((\d+)\s*m\)\s*\|\s*qu[äa]ldich-(\w+)\s*\+\d+/m

export function parseQualdichClimbs(description) {
  if (!description || typeof description !== 'string') return []

  const results = []
  const lines = description.split(/\r?\n/)

  for (const line of lines) {
    const m = line.match(PATTERN)
    if (!m) continue
    const name = m[1].trim()
    const ele  = parseInt(m[2], 10)
    const type = m[3]  // Passjagd | Bergwertung | Gipfeljagd | …
    if (name) results.push({ name, ele, climb_type: type })
  }

  return results
}
