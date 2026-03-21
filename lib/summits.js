// Summit detection: decode polyline → Overpass query → proximity check

// Decode Google Encoded Polyline Algorithm
function decodePolyline(encoded) {
  const pts = []
  let idx = 0, lat = 0, lon = 0
  while (idx < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lon += (result & 1) ? ~(result >> 1) : result >> 1
    pts.push([lat / 1e5, lon / 1e5])
  }
  return pts
}

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Query Overpass for peaks, passes, saddles in bounding box
async function queryOverpass(minLat, minLon, maxLat, maxLon) {
  const bbox = `${minLat},${minLon},${maxLat},${maxLon}`
  const query = `[out:json][timeout:10];(node["natural"="peak"](${bbox});node["mountain_pass"="yes"](${bbox});node["natural"="saddle"](${bbox}););out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error('Overpass error: ' + res.status)
  return res.json()
}

// Subsample points for performance (max ~500 points)
function subsample(points, maxPts = 500) {
  if (points.length <= maxPts) return points
  const step = Math.ceil(points.length / maxPts)
  return points.filter((_, i) => i % step === 0)
}

export async function detectSummits(activityId, polyline, startDate, elevHigh, db) {
  const points = decodePolyline(polyline)
  if (points.length < 2) return 0

  // Bounding box + 0.01° (~1km) buffer
  const lats = points.map(p => p[0])
  const lons = points.map(p => p[1])
  const minLat = Math.min(...lats) - 0.01
  const maxLat = Math.max(...lats) + 0.01
  const minLon = Math.min(...lons) - 0.01
  const maxLon = Math.max(...lons) + 0.01

  let osmData
  try {
    osmData = await queryOverpass(minLat, minLon, maxLat, maxLon)
  } catch (e) {
    console.warn('Overpass unavailable for activity', activityId, e.message)
    return 0
  }

  const elements = osmData?.elements || []
  if (!elements.length) return 0

  // Upsert all found OSM nodes into summits table
  const summitRows = elements.map(el => ({
    osm_id:   el.id,
    name:     el.tags?.name || el.tags?.['name:de'] || el.tags?.['name:en'] || null,
    ele:      el.tags?.ele ? parseInt(el.tags.ele) : null,
    osm_type: el.tags?.natural === 'peak' ? 'peak'
              : el.tags?.natural === 'saddle' ? 'saddle'
              : 'mountain_pass',
    lat:      el.lat,
    lon:      el.lon,
  }))

  await db.from('summits').upsert(summitRows, { onConflict: 'osm_id', ignoreDuplicates: false })

  // Fetch back IDs by osm_id
  const osmIds = elements.map(el => el.id)
  const { data: stored } = await db.from('summits').select('id, lat, lon, ele').in('osm_id', osmIds)
  if (!stored?.length) return 0

  // Check which summits are within 150m of any route point
  // AND the rider reached within 50m of the summit's elevation (avoids false positives
  // where the route passes near a peak in a valley far below)
  const sampled = subsample(points)
  const RADIUS = 300
  const hits = []
  for (const summit of stored) {
    const near = sampled.some(([lat, lon]) => haversine(lat, lon, summit.lat, summit.lon) <= RADIUS)
    if (!near) continue
    // Elevation gate: if we know both the summit's ele and the activity's highest point,
    // the rider must have reached at least summit.ele - 50m
    const elevOk = !summit.ele || !elevHigh || elevHigh >= summit.ele - 50
    if (elevOk) hits.push(summit.id)
  }

  if (!hits.length) return 0

  await db.from('activity_summits').upsert(
    hits.map(summitId => ({ activity_id: activityId, summit_id: summitId, visited_at: startDate })),
    { onConflict: 'activity_id,summit_id', ignoreDuplicates: true }
  )

  return hits.length
}
