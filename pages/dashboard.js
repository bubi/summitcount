import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmtDist  = (m,u) => u==='metric' ? (m/1000).toFixed(1)+' km' : (m/1609.34).toFixed(1)+' mi'
const fmtElev  = (m,u) => u==='metric' ? Math.round(m)+' m' : Math.round(m*3.28084)+' ft'
const fmtTime  = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return `${h}h ${m}m` }
const fmtVal   = (m,u) => u==='metric' ? (m/1000).toFixed(1) : (m/1609.34).toFixed(1)
const fmtElevV = (m,u) => u==='metric' ? Math.round(m) : Math.round(m*3.28084)

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [syncInfo, setSyncInfo]   = useState(null)
  const [year, setYear]           = useState(new Date().getFullYear())
  const [unit, setUnit]           = useState('metric')
  const [chartMode, setChartMode] = useState('dist')
  const [error, setError]         = useState('')

  useEffect(() => {
    init()
  }, [])

  async function init() {
    // Check auth
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) { router.push('/'); return }
    const me = await meRes.json()
    setUser(me)

    // Load stored activities
    const actRes = await fetch('/api/activities')
    if (actRes.ok) {
      const { activities: acts, count } = await actRes.json()
      setActivities(acts)
      if (acts.length > 0) {
        const years = [...new Set(acts.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)
        setYear(years[0])
      }
    }
    setLoading(false)

    // Auto-sync on load
    doSync()
  }

  async function doSync() {
    setSyncing(true)
    setError('')
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncInfo(data)
      // Reload activities after sync
      const actRes = await fetch('/api/activities')
      if (actRes.ok) {
        const { activities: acts } = await actRes.json()
        setActivities(acts)
        if (acts.length > 0) {
          const years = [...new Set(acts.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)
          setYear(prev => years.includes(prev) ? prev : years[0])
        }
      }
    } catch(e) {
      setError(e.message)
    }
    setSyncing(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const yearRides = activities.filter(a => new Date(a.start_date).getFullYear() === year)
  const years = [...new Set(activities.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)

  const totalDist = yearRides.reduce((s,a)=>s+(a.distance_m||0),0)
  const totalElev = yearRides.reduce((s,a)=>s+(a.elevation_gain_m||0),0)
  const totalTime = yearRides.reduce((s,a)=>s+(a.moving_time_s||0),0)
  const avgSpeed  = totalTime>0 ? totalDist/totalTime*3.6 : 0

  const monthly = MONTHS.map((_,i) => {
    const rides = yearRides.filter(a => new Date(a.start_date).getMonth()===i)
    return {
      dist:  rides.reduce((s,a)=>s+(a.distance_m||0),0),
      elev:  rides.reduce((s,a)=>s+(a.elevation_gain_m||0),0),
      count: rides.length,
    }
  })
  const chartVals = monthly.map(m => chartMode==='dist'?m.dist/1000 : chartMode==='elev'?m.elev : m.count)
  const chartMax  = Math.max(...chartVals, 1)

  const sortedRides = [...yearRides].sort((a,b)=>new Date(b.start_date)-new Date(a.start_date))

  if (loading) return (
    <div className="loading-page">
      <div className="spinner" /><p>Laden…</p>
    </div>
  )

  return (
    <>
      <Head>
        <title>Cycling Odometer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="wrap">
        {/* Header */}
        <div className="header">
          <div className="logo-area">
            <h1>ODO<br/>METER</h1>
            <p>Karoo · AXS · Strava</p>
          </div>
          <div className="chips">
            <span className="chip">Hammerhead</span>
            <span className="chip">SRAM AXS</span>
            <span className={`chip ${syncing?'syncing':'active'}`}>
              {syncing ? '⟳ Syncing…' : 'via Strava'}
            </span>
          </div>
        </div>

        {/* User bar */}
        <div className="user-bar">
          <div className="user-info">
            {user?.profileImg
              ? <img src={user.profileImg} className="avatar" alt="avatar" />
              : <div className="avatar-ph">🚴</div>}
            <div>
              <div className="user-name">{user?.firstname} {user?.lastname}</div>
              <div className="user-sub">{[user?.city, user?.country].filter(Boolean).join(', ')}</div>
            </div>
          </div>
          <div className="bar-right">
            {syncInfo && !syncing && (
              <span className="sync-badge">
                {syncInfo.isFullSync
                  ? `✓ ${syncInfo.synced} rides geladen`
                  : syncInfo.synced > 0
                  ? `✓ +${syncInfo.synced} neue rides`
                  : '✓ Aktuell'}
              </span>
            )}
            <button className="btn-sync" onClick={doSync} disabled={syncing}>
              {syncing ? '⟳' : '↻'} Sync
            </button>
            <div className="unit-toggle">
              <button className={unit==='metric'?'ut active':'ut'} onClick={()=>setUnit('metric')}>KM</button>
              <button className={unit==='imperial'?'ut active':'ut'} onClick={()=>setUnit('imperial')}>MI</button>
            </div>
            <a href="/api/auth/logout" className="btn-danger">Logout</a>
          </div>
        </div>

        {error && <div className="err-box">⚠ {error}</div>}

        {activities.length === 0 && !syncing ? (
          <div className="empty">
            <p>Keine Rides gefunden. Sync läuft beim ersten Laden automatisch.</p>
            <button className="btn" onClick={doSync}>Jetzt synchronisieren →</button>
          </div>
        ) : (
          <>
            {/* Year nav */}
            <div className="year-nav">
              {years.map(y=>(
                <button key={y} className={y===year?'yr-btn active':'yr-btn'} onClick={()=>setYear(y)}>{y}</button>
              ))}
            </div>

            {/* Stats grid */}
            <div className="stats-grid">
              {[
                { label:'Total Distance',   value: fmtVal(totalDist,unit),               unit: unit==='metric'?'KM':'MILES' },
                { label:'Elevation Gained', value: fmtElevV(totalElev,unit).toLocaleString(), unit: unit==='metric'?'METERS':'FEET' },
                { label:'Total Ride Time',  value: fmtTime(totalTime),                   unit: 'HRS / MIN' },
                { label:'Rides Completed',  value: yearRides.length,                     unit: 'ACTIVITIES' },
                { label:'Avg Speed',        value:(unit==='metric'?avgSpeed:avgSpeed*.621).toFixed(1), unit: unit==='metric'?'KM/H':'MPH' },
                { label:'Avg Distance',     value: yearRides.length>0?fmtVal(totalDist/yearRides.length,unit):'0', unit: unit==='metric'?'KM / RIDE':'MI / RIDE' },
              ].map(c=>(
                <div key={c.label} className="stat-card">
                  <div className="stat-label">{c.label}</div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-unit">{c.unit}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="chart-box">
              <div className="section-title">Monthly Breakdown</div>
              <div className="chart-tabs">
                {[['dist','Distance'],['elev','Elevation'],['rides','Rides']].map(([m,l])=>(
                  <button key={m} className={chartMode===m?'ct active':'ct'} onClick={()=>setChartMode(m)}>{l}</button>
                ))}
              </div>
              <div className="bar-chart">
                {monthly.map((m,i)=>{
                  const val=chartVals[i], pct=(val/chartMax)*100
                  const tip = chartMode==='dist'
                    ? (unit==='metric'?val.toFixed(0)+'km':(val*.621).toFixed(0)+'mi')
                    : chartMode==='elev'
                    ? (unit==='metric'?Math.round(m.elev)+'m':Math.round(m.elev*3.28)+'ft')
                    : val+' rides'
                  return (
                    <div key={i} className="bar-wrap">
                      <div className="bar-tip">{tip}</div>
                      <div className={`bar ${chartMode==='elev'?'elev':'dist'}`} style={{height:`${pct}%`}}/>
                      <div className="bar-label">{MONTHS[i]}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rides list */}
            <div className="section-title">All Rides — {sortedRides.length} activities</div>
            <div className="rides-list">
              <div className="rides-header">
                <span>Activity</span><span>Dist</span><span>Elev</span><span>Time</span><span>Type</span>
              </div>
              {sortedRides.map(a=>(
                <div key={a.id} className="ride-row">
                  <div>
                    <div className="ride-name">{a.name}</div>
                    <div className="ride-date">{new Date(a.start_date).toLocaleDateString('de-AT',{day:'2-digit',month:'short',year:'numeric'})}</div>
                  </div>
                  <div className="ride-val">{fmtDist(a.distance_m,unit)}</div>
                  <div className="ride-val">{fmtElev(a.elevation_gain_m,unit)}</div>
                  <div className="ride-val">{fmtTime(a.moving_time_s)}</div>
                  <div><span className="ride-type">{(a.sport_type||'Ride').replace('EBikeRide','E-Bike').replace('VirtualRide','Virtual').slice(0,8)}</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--bg:#0a0a0a;--panel:#111;--border:#222;--accent:#e8ff47;--accent2:#ff6b35;--text:#f0f0f0;--muted:#555;--dim:#2a2a2a}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
        body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(232,255,71,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(232,255,71,.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
        .loading-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);gap:16px;font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted)}
        .spinner{width:36px;height:36px;border:2px solid var(--dim);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .wrap{max-width:960px;margin:0 auto;padding:40px 24px;position:relative;z-index:1}
        .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px}
        .logo-area h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.4rem,6vw,4rem);letter-spacing:.04em;line-height:.9;color:var(--accent)}
        .logo-area p{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--muted);letter-spacing:.15em;text-transform:uppercase;margin-top:6px}
        .chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .chip{font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.1em;padding:4px 10px;border-radius:3px;text-transform:uppercase;border:1px solid var(--border);color:var(--muted)}
        .chip.active{border-color:var(--accent);color:var(--accent)}
        .chip.syncing{border-color:var(--accent2);color:var(--accent2);animation:pulse 1s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .user-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px}
        .user-info{display:flex;align-items:center;gap:12px}
        .avatar{width:42px;height:42px;border-radius:50%;border:2px solid var(--accent);object-fit:cover}
        .avatar-ph{width:42px;height:42px;border-radius:50%;border:2px solid var(--accent);background:var(--dim);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
        .user-name{font-family:'DM Mono',monospace;font-size:.8rem;color:var(--accent)}
        .user-sub{font-size:.72rem;color:var(--muted);margin-top:2px}
        .bar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .sync-badge{font-family:'DM Mono',monospace;font-size:.65rem;color:#4caf50;padding:4px 8px;border:1px solid #4caf5044;border-radius:3px}
        .btn-sync{font-family:'DM Mono',monospace;font-size:.72rem;padding:6px 12px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .btn-sync:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
        .btn-sync:disabled{opacity:.4;cursor:default}
        .unit-toggle{display:flex;background:var(--dim);border-radius:4px;padding:2px;gap:2px}
        .ut{font-family:'DM Mono',monospace;font-size:.68rem;padding:4px 10px;border:none;border-radius:3px;background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .ut.active{background:var(--panel);color:var(--accent)}
        .btn-danger{background:transparent;color:#ff4444;border:1px solid #ff444444;border-radius:4px;padding:6px 12px;font-family:'DM Sans',sans-serif;font-size:.75rem;cursor:pointer;text-decoration:none;transition:all .15s}
        .btn-danger:hover{background:#ff4444;color:#fff;border-color:#ff4444}
        .err-box{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:4px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:.75rem;color:#ff6666;margin-bottom:20px}
        .empty{text-align:center;padding:60px 20px;color:var(--muted)}
        .empty p{margin-bottom:20px;font-size:.9rem}
        .btn{background:var(--accent);color:#000;border:none;border-radius:4px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-weight:500;font-size:.85rem;cursor:pointer;transition:all .15s}
        .btn:hover{background:#f0ff60}
        .year-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
        .yr-btn{font-family:'DM Mono',monospace;font-size:.75rem;padding:6px 14px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .yr-btn:hover{border-color:var(--accent);color:var(--accent)}
        .yr-btn.active{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
        .stat-card{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:24px 20px;transition:border-color .2s;position:relative;overflow:hidden}
        .stat-card:hover{border-color:var(--accent)}
        .stat-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--accent);transform:scaleX(0);transition:transform .3s;transform-origin:left}
        .stat-card:hover::after{transform:scaleX(1)}
        .stat-label{font-family:'DM Mono',monospace;font-size:.65rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:10px}
        .stat-value{font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:.02em;line-height:1;color:var(--accent)}
        .stat-unit{font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted);margin-top:4px;letter-spacing:.1em}
        .chart-box{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:24px 20px 16px;margin-bottom:28px}
        .section-title{font-family:'DM Mono',monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:14px}
        .chart-tabs{display:flex;gap:8px;margin-bottom:20px}
        .ct{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .ct.active{border-color:var(--accent2);color:var(--accent2)}
        .bar-chart{display:flex;align-items:flex-end;gap:6px;height:140px;padding-bottom:28px;position:relative}
        .bar-chart::before{content:'';position:absolute;bottom:28px;left:0;right:0;height:1px;background:var(--dim)}
        .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;position:relative}
        .bar-wrap:hover .bar-tip{opacity:1}
        .bar-tip{position:absolute;bottom:calc(100% - 20px);left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:'DM Mono',monospace;font-size:.62rem;white-space:nowrap;color:var(--text);opacity:0;transition:opacity .15s;pointer-events:none;z-index:10}
        .bar{width:100%;border-radius:3px 3px 0 0;min-height:2px;transition:height .5s cubic-bezier(.34,1.56,.64,1)}
        .bar.dist{background:var(--accent)}
        .bar.elev{background:var(--accent2)}
        .bar-label{font-family:'DM Mono',monospace;font-size:.6rem;color:var(--muted);position:absolute;bottom:4px}
        .rides-list{background:var(--panel);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:40px}
        .rides-header{display:grid;grid-template-columns:1fr 90px 80px 80px 70px;gap:8px;padding:10px 18px;border-bottom:1px solid var(--dim);font-family:'DM Mono',monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:right}
        .rides-header span:first-child{text-align:left}
        .ride-row{display:grid;grid-template-columns:1fr 90px 80px 80px 70px;gap:8px;padding:12px 18px;border-bottom:1px solid var(--dim);align-items:center;transition:background .15s;text-align:right}
        .ride-row:last-child{border-bottom:none}
        .ride-row:hover{background:var(--dim)}
        .ride-name{font-size:.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
        .ride-date{font-family:'DM Mono',monospace;font-size:.68rem;color:var(--muted);margin-top:2px;text-align:left}
        .ride-val{font-family:'DM Mono',monospace;font-size:.78rem}
        .ride-type{font-family:'DM Mono',monospace;font-size:.62rem;padding:2px 7px;border-radius:2px;background:var(--dim);color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
        @media(max-width:600px){
          .rides-header,.ride-row{grid-template-columns:1fr 80px 70px}
          .rides-header>*:nth-child(4),.ride-row>*:nth-child(4),
          .rides-header>*:nth-child(5),.ride-row>*:nth-child(5){display:none}
          .bar-chart{height:100px}
        }
      `}</style>
    </>
  )
}
