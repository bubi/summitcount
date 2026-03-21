// Alpine wire-frame background — Alpenglühen style
// Call initMountainBackground(canvasId) after mount

const COLS = 40, ROWS = 22
const MAX_H = 14   // realistic max with peak overlap

// Semi-fixed alpine topography — peaks positioned so displacement stays on-screen
// ry 0.4–0.6 = middle of canvas; upward displacement pulls them to upper third
const PEAK_TEMPLATES = [
  { rx: 0.12, ry: 0.52, h: 7.5, phase: 0.0,  speed: 0.00000085 }, // Westmassiv
  { rx: 0.30, ry: 0.42, h: 9.0, phase: 1.2,  speed: 0.00000070 }, // Hauptgipfel
  { rx: 0.46, ry: 0.48, h: 6.5, phase: 2.5,  speed: 0.00000090 }, // Mittlerer Grat
  { rx: 0.58, ry: 0.40, h: 8.2, phase: 0.7,  speed: 0.00000075 }, // Ostgipfel
  { rx: 0.72, ry: 0.55, h: 5.8, phase: 3.1,  speed: 0.00000080 }, // Schulter rechts
  { rx: 0.86, ry: 0.45, h: 7.2, phase: 1.8,  speed: 0.00000065 }, // Ostmassiv
]

function lineColor(norm) {
  if (norm < 0.25) return `rgba(80,40,100,${(0.04 + norm * 0.08).toFixed(3)})`
  if (norm < 0.55) return `rgba(170,65,35,${(0.10 + norm * 0.14).toFixed(3)})`
  if (norm < 0.80) return `rgba(215,95,40,${(0.18 + norm * 0.18).toFixed(3)})`
  return `rgba(255,205,145,${(0.28 + norm * 0.18).toFixed(3)})`
}

function fillColor(avgNorm) {
  if (avgNorm < 0.35) return null
  return `rgba(160,50,20,${(avgNorm * 0.05).toFixed(3)})`
}

export function initMountainBackground(canvasId) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  function resize() {
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const peaks = PEAK_TEMPLATES.map(p => ({
    x:     p.rx * COLS,
    y:     p.ry * ROWS,
    h:     p.h,
    phase: p.phase,
    speed: p.speed,
  }))

  function elevation(gx, gy, t) {
    let h = 0
    for (const p of peaks) {
      const dx = gx - p.x
      const dy = (gy - p.y) * 1.8
      const d  = Math.sqrt(dx*dx + dy*dy) + 0.001
      const tip  = p.h * 0.8 / (1 + d*d*4)
      const base = p.h * 0.5 / (1 + d*d*0.3)
      const wave = Math.sin(t * p.speed * 800 + p.phase + d * 0.3) * 0.06
      h += tip + base + wave
    }
    return h
  }

  let raf
  function draw(t) {
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const cellW = W / COLS, cellH = H / ROWS

    const pts = []
    for (let row = 0; row <= ROWS; row++) {
      pts[row] = []
      for (let col = 0; col <= COLS; col++) {
        const elev = elevation(col, row, t)
        const norm = Math.min(elev / MAX_H, 1)
        pts[row][col] = {
          sx: col * cellW,
          sy: row * cellH - elev * cellH * 0.55,  // reduced displacement
          norm,
        }
      }
    }

    // Filled cells (behind lines)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const p   = pts[row][col]
        const p01 = pts[row][col+1]
        const p10 = pts[row+1][col]
        const p11 = pts[row+1][col+1]
        const avgNorm = (p.norm + p01.norm + p10.norm + p11.norm) / 4
        const fill = fillColor(avgNorm)
        if (fill) {
          ctx.fillStyle = fill
          ctx.beginPath()
          ctx.moveTo(p.sx,   p.sy)
          ctx.lineTo(p01.sx, p01.sy)
          ctx.lineTo(p11.sx, p11.sy)
          ctx.lineTo(p10.sx, p10.sy)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    // Grid lines
    for (let row = 0; row <= ROWS; row++) {
      for (let col = 0; col <= COLS; col++) {
        const p = pts[row][col]

        if (col < COLS) {
          const p2   = pts[row][col+1]
          const avgN = (p.norm + p2.norm) / 2
          ctx.strokeStyle = lineColor(avgN)
          ctx.lineWidth   = 0.4 + avgN * 0.8
          ctx.beginPath()
          ctx.moveTo(p.sx, p.sy)
          ctx.lineTo(p2.sx, p2.sy)
          ctx.stroke()
          // Snow highlight
          if (avgN > 0.80) {
            ctx.strokeStyle = `rgba(255,230,200,${((avgN - 0.80) * 1.2).toFixed(3)})`
            ctx.lineWidth = 0.35
            ctx.beginPath()
            ctx.moveTo(p.sx, p.sy)
            ctx.lineTo(p2.sx, p2.sy)
            ctx.stroke()
          }
        }

        if (row < ROWS) {
          const p2   = pts[row+1][col]
          const avgN = (p.norm + p2.norm) / 2
          ctx.strokeStyle = lineColor(avgN)
          ctx.lineWidth   = 0.4 + avgN * 0.8
          ctx.beginPath()
          ctx.moveTo(p.sx, p.sy)
          ctx.lineTo(p2.sx, p2.sy)
          ctx.stroke()
          if (avgN > 0.80) {
            ctx.strokeStyle = `rgba(255,230,200,${((avgN - 0.80) * 1.2).toFixed(3)})`
            ctx.lineWidth = 0.35
            ctx.beginPath()
            ctx.moveTo(p.sx, p.sy)
            ctx.lineTo(p2.sx, p2.sy)
            ctx.stroke()
          }
        }
      }
    }

    raf = requestAnimationFrame(draw)
  }

  raf = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
}
