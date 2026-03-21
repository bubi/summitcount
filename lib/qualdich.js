/**
 * Parser for quäldich notes in Strava activity descriptions.
 *
 * Two supported formats:
 *
 * A) Multiple passes on one line, single type at end:
 *   Grödnerjoch (2121 m), Sellajoch (2240 m), Passo Pordoi (2239 m) | quäldich-Passjagd
 *
 * B) One pass per line with optional count:
 *   Edelweißspitze (2571 m) | quäldich-Passjagd +1
 */

// Extracts climb type from "| quäldich-Type [+N]"
const TYPE_PATTERN = /\|\s*qu[äa]ldich-(\w+)/

// Extracts individual "Name (NNN m)" entries (handles commas between multiple)
const ENTRY_PATTERN = /([^,(|]+?)\s*\((\d+)\s*m\)/g

export function parseQualdichClimbs(description) {
  if (!description || typeof description !== 'string') return []

  const results = []

  for (const line of description.split(/\r?\n/)) {
    // Line must contain a quäldich marker
    const typeMatch = line.match(TYPE_PATTERN)
    if (!typeMatch) continue

    const climbType = typeMatch[1]  // Passjagd | Bergwertung | Gipfeljagd | …

    // Extract all "Name (ele m)" entries from the part before the "|"
    const leftPart = line.split('|')[0]
    let m
    ENTRY_PATTERN.lastIndex = 0
    while ((m = ENTRY_PATTERN.exec(leftPart)) !== null) {
      const name = m[1].trim()
      const ele  = parseInt(m[2], 10)
      if (name) results.push({ name, ele, climb_type: climbType })
    }
  }

  return results
}
