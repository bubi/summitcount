// Shared mountain grid background — used on all pages
// Call initMountainBackground(canvasId) after mount

export function initMountainBackground(canvasId) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  function resize() {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const COLS = 30, ROWS = 16
  const peaks = []
  for (let i = 0; i < 6; i++) {
    peaks.push({
      x: (Math.random() * 0.8 + 0.1) * COLS,
      y: (Math.random() * 0.6 + 0.1) * ROWS,
      h: Math.random() * 4 + 3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.000002 + Math.random() * 0.000001,
    })
  }

  function elevation(gx, gy, t) {
    let h = 0
    for (const p of peaks) {
      const dx = gx - p.x, dy = gy - p.y
      const d = Math.sqrt(dx * dx + dy * dy * 1.5) + 0.001
      const wave = Math.sin(t * p.speed * 1000 + p.phase + d * 0.4) * 0.15
      h += p.h / (1 + d * d * 0.18) + wave
    }
    return h
  }

  let raf
  function draw(t) {
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const cellW = W / COLS, cellH = H / ROWS, maxH = 5
    const pts = []
    for (let row = 0; row <= ROWS; row++) {
      pts[row] = []
      for (let col = 0; col <= COLS; col++) {
        const elev = elevation(col, row, t)
        pts[row][col] = { sx: col * cellW, sy: row * cellH - elev * cellH * 0.8, elev }
      }
    }
    for (let row = 0; row <= ROWS; row++) {
      for (let col = 0; col <= COLS; col++) {
        const p = pts[row][col]
        const norm = Math.min(p.elev / maxH, 1)
        if (col < COLS && row < ROWS) {
          const p01 = pts[row][col + 1], p10 = pts[row + 1][col], p11 = pts[row + 1][col + 1]
          const avgN = (norm + Math.min(p01.elev / maxH, 1) + Math.min(p10.elev / maxH, 1) + Math.min(p11.elev / maxH, 1)) / 4
          if (avgN > 0.3) {
            ctx.fillStyle = `rgba(232,255,71,${avgN * 0.04})`
            ctx.beginPath()
            ctx.moveTo(p.sx, p.sy); ctx.lineTo(p01.sx, p01.sy)
            ctx.lineTo(p11.sx, p11.sy); ctx.lineTo(p10.sx, p10.sy)
            ctx.closePath(); ctx.fill()
          }
        }
        if (col < COLS) {
          const p2 = pts[row][col + 1]
          const lineN = (norm + Math.min(p2.elev / maxH, 1)) / 2
          ctx.strokeStyle = `rgba(232,255,71,${0.04 + lineN * 0.14})`
          ctx.lineWidth = 0.5 + lineN * 0.5
          ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke()
        }
        if (row < ROWS) {
          const p2 = pts[row + 1][col]
          const lineN = (norm + Math.min(p2.elev / maxH, 1)) / 2
          ctx.strokeStyle = `rgba(232,255,71,${0.04 + lineN * 0.14})`
          ctx.lineWidth = 0.5 + lineN * 0.5
          ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke()
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
