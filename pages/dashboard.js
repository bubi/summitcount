import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { initMountainBackground } from '../lib/mountainBackground'
import { useTranslation } from '../lib/i18n'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmtDist  = (m,u) => u==='metric' ? (m/1000).toFixed(1)+' km' : (m/1609.34).toFixed(1)+' mi'
const fmtElev  = (m,u) => u==='metric' ? Math.round(m)+' m' : Math.round(m*3.28084)+' ft'
const fmtTime  = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return `${h}h ${m}m` }
const fmtVal   = (m,u) => u==='metric' ? (m/1000).toFixed(1) : (m/1609.34).toFixed(1)
const fmtElevV = (m,u) => u==='metric' ? Math.round(m) : Math.round(m*3.28084)

function calcDelta(current, prev) {
  if (prev === 0) return null
  const abs = current - prev
  const pct = (abs / prev) * 100
  return { abs, pct, positive: abs >= 0 }
}

function DeltaBadge({ delta, formatAbs }) {
  if (!delta) return null
  const sign  = delta.positive ? '+' : '−'
  const arrow = delta.positive ? '▲' : '▼'
  const color = delta.positive ? '#4caf50' : '#f44336'
  const pct   = Math.abs(delta.pct).toFixed(1)
  return (
    <div className="delta" style={{ color }}>
      {arrow} {sign}{pct}%<span className="delta-abs"> {sign}{formatAbs(Math.abs(delta.abs))}</span>
    </div>
  )
}

const SPORT_LABELS = {
  Ride:              'Ride',
  VirtualRide:       'Virtual',
  EBikeRide:         'E-Bike',
  GravelRide:        'Gravel',
  MountainBikeRide:  'MTB',
  EMountainBikeRide: 'E-MTB',
  Velomobile:        'Velo',
}
const sportLabel = t => SPORT_LABELS[t] || t || 'Ride'

export default function Dashboard() {
  const router = useRouter()
  const { t, lang, setLang } = useTranslation()
  const [user, setUser]               = useState(null)
  const [activities, setActivities]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncInfo, setSyncInfo]       = useState(null)
  const [year, setYear]               = useState(new Date().getFullYear())
  const [selectedSports, setSelectedSports] = useState([])
  const [unit, setUnit]               = useState('metric')
  const [chartMode, setChartMode]     = useState('dist')
  const [error, setError]             = useState('')
  const [loadStatus, setLoadStatus]   = useState('loading.init')
  const mountainCleanup               = useRef(null)

  useEffect(() => {
    init()
    const timer = setTimeout(() => {
      mountainCleanup.current = initMountainBackground('mountain-bg')
    }, 50)
    return () => {
      clearTimeout(timer)
      if (mountainCleanup.current) mountainCleanup.current()
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountainCleanup.current) mountainCleanup.current()
      mountainCleanup.current = initMountainBackground('mountain-bg')
    }, 50)
    return () => clearTimeout(timer)
  }, [loading])

  async function init() {
    setLoadStatus('loading.auth')
    const meRes = await fetch('/api/auth/me')
    if (!meRes.ok) { router.push('/'); return }
    setUser(await meRes.json())

    setLoadStatus('loading.activities')
    const actRes = await fetch('/api/activities')
    if (actRes.ok) {
      const { activities: acts } = await actRes.json()
      setActivities(acts)
      if (acts.length > 0) {
        const years = [...new Set(acts.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)
        setYear(years[0])
      }
    }
    setLoading(false)
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
      const actRes = await fetch('/api/activities')
      if (actRes.ok) {
        const { activities: acts } = await actRes.json()
        setActivities(acts)
        if (acts.length > 0) {
          const years = [...new Set(acts.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)
          setYear(prev => years.includes(prev) ? prev : years[0])
        }
      }
    } catch(e) { setError(e.message) }
    setSyncing(false)
  }

  function toggleSport(sport) {
    setSelectedSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    )
  }

  const yearRides = activities.filter(a => new Date(a.start_date).getFullYear() === year)
  const years = [...new Set(activities.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a)
  const availableSports = [...new Set(yearRides.map(a => a.sport_type).filter(Boolean))].sort()
  const filteredRides = selectedSports.length === 0
    ? yearRides
    : yearRides.filter(a => selectedSports.includes(a.sport_type))

  const totalDist = filteredRides.reduce((s,a)=>s+(a.distance_m||0),0)
  const totalElev = filteredRides.reduce((s,a)=>s+(a.elevation_gain_m||0),0)
  const totalTime = filteredRides.reduce((s,a)=>s+(a.moving_time_s||0),0)
  const avgSpeed  = totalTime>0 ? totalDist/totalTime*3.6 : 0

  // Vorjahr
  const prevYear      = year - 1
  const prevYearRides = activities.filter(a => new Date(a.start_date).getFullYear() === prevYear)
  const prevFiltered  = selectedSports.length === 0
    ? prevYearRides
    : prevYearRides.filter(a => selectedSports.includes(a.sport_type))
  const hasPrevYear   = prevFiltered.length > 0
  const prevTotalDist = prevFiltered.reduce((s,a)=>s+(a.distance_m||0),0)
  const prevTotalElev = prevFiltered.reduce((s,a)=>s+(a.elevation_gain_m||0),0)
  const prevTotalTime = prevFiltered.reduce((s,a)=>s+(a.moving_time_s||0),0)
  const prevAvgSpeed  = prevTotalTime>0 ? prevTotalDist/prevTotalTime*3.6 : 0
  const currAvgDist   = filteredRides.length>0 ? totalDist/filteredRides.length : 0
  const prevAvgDist   = prevFiltered.length>0 ? prevTotalDist/prevFiltered.length : 0
  const isMetric      = unit==='metric'

  const stats = [
    { label: t('stat.totalDistance'),   value: fmtVal(totalDist,unit),                              unit: isMetric?t('stat.unit.km'):t('stat.unit.miles'),
      delta: hasPrevYear ? calcDelta(totalDist,prevTotalDist) : null,
      formatAbs: v => fmtVal(v,unit)+(isMetric?' km':' mi') },
    { label: t('stat.elevationGained'), value: fmtElevV(totalElev,unit).toLocaleString(),           unit: isMetric?t('stat.unit.meters'):t('stat.unit.feet'),
      delta: hasPrevYear ? calcDelta(totalElev,prevTotalElev) : null,
      formatAbs: v => fmtElevV(v,unit).toLocaleString()+(isMetric?' m':' ft') },
    { label: t('stat.totalTime'),       value: fmtTime(totalTime),                                  unit: t('stat.unit.hrsMin'),
      delta: hasPrevYear ? calcDelta(totalTime,prevTotalTime) : null,
      formatAbs: v => fmtTime(v) },
    { label: t('stat.rides'),           value: filteredRides.length,                                unit: t('stat.unit.activities'),
      delta: hasPrevYear ? calcDelta(filteredRides.length,prevFiltered.length) : null,
      formatAbs: v => Math.round(v) },
    { label: t('stat.avgSpeed'),        value: (isMetric?avgSpeed:avgSpeed*.621).toFixed(1),        unit: isMetric?t('stat.unit.kmh'):t('stat.unit.mph'),
      delta: hasPrevYear ? calcDelta(isMetric?avgSpeed:avgSpeed*.621, isMetric?prevAvgSpeed:prevAvgSpeed*.621) : null,
      formatAbs: v => v.toFixed(1)+(isMetric?' km/h':' mph') },
    { label: t('stat.avgDistance'),     value: filteredRides.length>0?fmtVal(currAvgDist,unit):'0', unit: isMetric?t('stat.unit.kmRide'):t('stat.unit.miRide'),
      delta: hasPrevYear&&prevAvgDist>0 ? calcDelta(currAvgDist,prevAvgDist) : null,
      formatAbs: v => fmtVal(v,unit)+(isMetric?' km':' mi') },
  ]

  const monthly = MONTHS.map((_,i) => {
    const rides = filteredRides.filter(a => new Date(a.start_date).getMonth()===i)
    return {
      dist:  rides.reduce((s,a)=>s+(a.distance_m||0),0),
      elev:  rides.reduce((s,a)=>s+(a.elevation_gain_m||0),0),
      count: rides.length,
    }
  })
  const prevMonthly = MONTHS.map((_,i) => {
    const rides = prevFiltered.filter(a => new Date(a.start_date).getMonth()===i)
    return {
      dist:  rides.reduce((s,a)=>s+(a.distance_m||0),0),
      elev:  rides.reduce((s,a)=>s+(a.elevation_gain_m||0),0),
      count: rides.length,
    }
  })
  const chartVals     = monthly.map(m => chartMode==='dist'?m.dist/1000 : chartMode==='elev'?m.elev : m.count)
  const prevChartVals = prevMonthly.map(m => chartMode==='dist'?m.dist/1000 : chartMode==='elev'?m.elev : m.count)
  const chartMax      = Math.max(...chartVals, ...(hasPrevYear ? prevChartVals : []), 1)
  const sortedRides   = [...filteredRides].sort((a,b)=>new Date(b.start_date)-new Date(a.start_date))

  if (loading) return (
    <>
      <Head>
        <title>SummitCount</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <div className="loading-page">
        <canvas id="mountain-bg" className="mountain-canvas" />
        <div className="loading-inner">
          <div className="loading-logo">SUMMIT<br/>COUNT</div>
          <div className="loading-ring">
            <svg viewBox="0 0 60 60" width="60" height="60">
              <circle cx="30" cy="30" r="26" fill="none" stroke="#222" strokeWidth="3"/>
              <circle cx="30" cy="30" r="26" fill="none" stroke="#e8ff47" strokeWidth="3"
                strokeLinecap="round" strokeDasharray="40 124" className="spin-circle"/>
            </svg>
          </div>
          <div className="loading-status">{t(loadStatus)}</div>
        </div>
      </div>
      <style jsx global>{`*{margin:0;padding:0;box-sizing:border-box}html,body,#__next{height:100%;background:#0a0a0a}`}</style>
      <style jsx>{`
        .loading-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;position:relative;}
        .mountain-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;}
        .loading-inner{display:flex;flex-direction:column;align-items:center;gap:28px;position:relative;z-index:1;}
        .loading-logo{font-family:'Bebas Neue',sans-serif;font-size:2.8rem;letter-spacing:.04em;line-height:.9;color:#e8ff47;text-align:center}
        .loading-ring{display:flex;align-items:center;justify-content:center}
        .spin-circle{transform-origin:30px 30px;animation:spin 1.2s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .loading-status{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;color:#555}
      `}</style>
    </>
  )

  return (
    <>
      <Head>
        <title>SummitCount</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <canvas id="mountain-bg" className="mountain-canvas" />

      <div className="wrap">
        <div className="header">
          <div className="logo-area">
            <h1>SUMMIT<br/>COUNT</h1>
          </div>
          <div className="header-right">
            <div className="user-info">
              {user?.profileImg
                ? <img src={user.profileImg} className="avatar" alt="avatar" />
                : <div className="avatar-ph">🚴</div>}
              <div>
                <div className="user-name">{user?.firstname} {user?.lastname}</div>
                <div className="user-sub">{[user?.city, user?.country].filter(Boolean).join(', ')}</div>
              </div>
            </div>
            <div className="actions">
              <div className="lang-toggle">
                <button className={lang==='de'?'flag active':'flag'} onClick={()=>setLang('de')}>🇩🇪</button>
                <button className={lang==='en'?'flag active':'flag'} onClick={()=>setLang('en')}>🇬🇧</button>
              </div>
              {syncInfo && !syncing && (
                <span className="sync-badge">
                  {syncInfo.isFullSync
                    ? t('sync.badge.full', { count: syncInfo.synced })
                    : [
                        syncInfo.synced > 0 && t('sync.badge.new', { count: syncInfo.synced }),
                        syncInfo.deleted > 0 && t('sync.badge.deleted', { count: syncInfo.deleted }),
                      ].filter(Boolean).join(' · ') || t('sync.badge.upToDate')}
                </span>
              )}
              <button className="btn-sync" onClick={doSync} disabled={syncing}>
                {syncing ? '⟳' : '↻'} {t('sync.button')}
              </button>
              <a href="/api/auth/logout" className="btn-danger">{t('logout')}</a>
            </div>
          </div>
        </div>

        {error && <div className="err-box">⚠ {error}</div>}

        {activities.length === 0 && !syncing ? (
          <div className="empty">
            <p>{t('empty.message')}</p>
            <button className="btn" onClick={doSync}>{t('empty.syncButton')}</button>
          </div>
        ) : (
          <>
            <div className="year-nav">
              {years.map(y=>(
                <button key={y}
                  className={y===year?'yr-btn active':'yr-btn'}
                  onClick={()=>{ setYear(y); setSelectedSports([]) }}>
                  {y}
                </button>
              ))}
            </div>

            {availableSports.length > 1 && (
              <div className="sport-nav">
                <button className={selectedSports.length===0?'sp-btn active':'sp-btn'} onClick={()=>setSelectedSports([])}>{t('sport.all')}</button>
                {availableSports.map(s=>(
                  <button key={s} className={selectedSports.includes(s)?'sp-btn active':'sp-btn'} onClick={()=>toggleSport(s)}>
                    {sportLabel(s)}
                  </button>
                ))}
              </div>
            )}

            <div className="stats-grid">
              {stats.map(c=>(
                <div key={c.label} className="stat-card">
                  <div className="stat-label">{c.label}</div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-unit">{c.unit}</div>
                  <DeltaBadge delta={c.delta} formatAbs={c.formatAbs} />
                </div>
              ))}
            </div>

            <div className="chart-box">
              <div className="section-title">{t('chart.title')}</div>
              <div className="chart-tabs">
                {[['dist',t('chart.tab.distance')],['elev',t('chart.tab.elevation')],['rides',t('chart.tab.rides')]].map(([m,l])=>(
                  <button key={m} className={chartMode===m?'ct active':'ct'} onClick={()=>setChartMode(m)}>{l}</button>
                ))}
              </div>
              <div className="bar-chart">
                {monthly.map((m,i)=>{
                  const val=chartVals[i], pct=(val/chartMax)*100
                  const prevVal=prevChartVals[i], prevPct=(prevVal/chartMax)*100
                  const tip = chartMode==='dist'
                    ? (unit==='metric'?val.toFixed(0)+'km':(val*.621).toFixed(0)+'mi')
                    : chartMode==='elev'
                    ? (unit==='metric'?Math.round(m.elev)+'m':Math.round(m.elev*3.28)+'ft')
                    : t('chart.tooltip.rides', { count: val })
                  const prevTip = chartMode==='dist'
                    ? (unit==='metric'?prevVal.toFixed(0)+'km':(prevVal*.621).toFixed(0)+'mi')
                    : chartMode==='elev'
                    ? (unit==='metric'?Math.round(prevMonthly[i].elev)+'m':Math.round(prevMonthly[i].elev*3.28)+'ft')
                    : t('chart.tooltip.rides', { count: prevVal })
                  return (
                    <div key={i} className="bar-wrap">
                      <div className="bar-tip">{tip}{hasPrevYear ? ` / VJ: ${prevTip}` : ''}</div>
                      <div className="bar-pair">
                        <div className={`bar ${chartMode==='elev'?'elev':'dist'}`} style={{height:`${pct}%`}}/>
                        {hasPrevYear && <div className="bar prev" style={{height:`${prevPct}%`}}/>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="bar-months">
                {MONTHS.map((m,i) => <div key={i} className="bar-month">{m}</div>)}
              </div>
            </div>

            <div className="section-title">
              {selectedSports.length > 0
                ? t('rides.title.filtered', { sports: selectedSports.map(sportLabel).join(', '), count: sortedRides.length })
                : t('rides.title.all', { count: sortedRides.length })}
            </div>
            <div className="rides-list">
              <div className="rides-header">
                <span>{t('rides.col.activity')}</span>
                <span>{t('rides.col.dist')}</span>
                <span>{t('rides.col.elev')}</span>
                <span>{t('rides.col.time')}</span>
                <span>{t('rides.col.type')}</span>
              </div>
              {sortedRides.map(a=>(
                <div key={a.id} className="ride-row">
                  <div>
                    <a href={`https://www.strava.com/activities/${a.strava_activity_id}`}
                      target="_blank" rel="noreferrer" className="ride-name">{a.name}</a>
                    <div className="ride-date">{new Date(a.start_date).toLocaleDateString(t('date.locale'),{day:'2-digit',month:'short',year:'numeric'})}</div>
                  </div>
                  <div className="ride-val">{fmtDist(a.distance_m,unit)}</div>
                  <div className="ride-val">{fmtElev(a.elevation_gain_m,unit)}</div>
                  <div className="ride-val">{fmtTime(a.moving_time_s)}</div>
                  <div><span className="ride-type">{sportLabel(a.sport_type)}</span></div>
                </div>
              ))}
            </div>

            <div className="app-footer">
              <a href="https://www.strava.com" target="_blank" rel="noreferrer" className="strava-footer-link">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#FC4C02">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
                Powered by Strava
              </a>
              <a href="/privacy" className="privacy-footer-link">{t('footer.privacy')}</a>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--bg:#0a0a0a;--panel:#111;--border:#222;--accent:#e8ff47;--accent2:#ff6b35;--text:#f0f0f0;--muted:#555;--dim:#2a2a2a}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <style jsx>{`
        .mountain-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;}
        .wrap{max-width:960px;margin:0 auto;padding:40px 24px;position:relative;z-index:1;}
        .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;gap:16px;flex-wrap:wrap}
        .logo-area h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.4rem,6vw,4rem);letter-spacing:.04em;line-height:.9;color:var(--accent)}
        .header-right{display:flex;flex-direction:column;align-items:flex-end;gap:12px;padding-top:4px}
        .user-info{display:flex;align-items:center;gap:10px}
        .avatar{width:36px;height:36px;border-radius:50%;border:2px solid var(--accent);object-fit:cover}
        .avatar-ph{width:36px;height:36px;border-radius:50%;border:2px solid var(--accent);background:var(--dim);display:flex;align-items:center;justify-content:center;font-size:1rem}
        .user-name{font-family:'DM Mono',monospace;font-size:.78rem;color:var(--accent);text-align:right}
        .user-sub{font-size:.68rem;color:var(--muted);margin-top:2px;text-align:right}
        .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .lang-toggle{display:flex;gap:2px;align-items:center}
        .flag{background:transparent;border:none;cursor:pointer;font-size:1.2rem;opacity:0.3;padding:2px 4px;transition:opacity .15s;line-height:1}
        .flag.active{opacity:1}
        .flag:hover{opacity:0.65}
        .sync-badge{font-family:'DM Mono',monospace;font-size:.75rem;color:#4caf50;padding:5px 10px;border:1px solid #4caf5044;border-radius:4px}
        .btn-sync{font-family:'DM Mono',monospace;font-size:.72rem;padding:5px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .btn-sync:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
        .btn-sync:disabled{opacity:.4;cursor:default}
        .btn-danger{background:transparent;color:#ff4444;border:1px solid #ff444444;border-radius:4px;padding:5px 10px;font-family:'DM Sans',sans-serif;font-size:.75rem;cursor:pointer;text-decoration:none;transition:all .15s}
        .btn-danger:hover{background:#ff4444;color:#fff;border-color:#ff4444}
        .err-box{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:4px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:.75rem;color:#ff6666;margin-bottom:20px}
        .empty{text-align:center;padding:60px 20px;color:var(--muted)}
        .empty p{margin-bottom:20px;font-size:.9rem}
        .btn{background:var(--accent);color:#000;border:none;border-radius:4px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-weight:500;font-size:.85rem;cursor:pointer}
        .year-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
        .yr-btn{font-family:'DM Mono',monospace;font-size:.75rem;padding:6px 14px;border-radius:3px;border:1px solid var(--border);background:rgba(10,10,10,0.7);color:var(--muted);cursor:pointer;transition:all .15s}
        .yr-btn:hover{border-color:var(--accent);color:var(--accent)}
        .yr-btn.active{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}
        .sport-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:28px;padding-top:4px}
        .sp-btn{font-family:'DM Mono',monospace;font-size:.68rem;padding:4px 12px;border-radius:3px;border:1px solid var(--border);background:rgba(10,10,10,0.7);color:var(--muted);cursor:pointer;transition:all .15s;letter-spacing:.05em;text-transform:uppercase}
        .sp-btn:hover{border-color:var(--accent2);color:var(--accent2)}
        .sp-btn.active{background:var(--accent2);color:#000;border-color:var(--accent2);font-weight:600}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
        .stat-card{background:rgba(17,17,17,0.85);border:1px solid var(--border);border-radius:6px;padding:24px 20px;transition:border-color .2s;position:relative;overflow:hidden;backdrop-filter:blur(2px);}
        .stat-card:hover{border-color:var(--accent)}
        .stat-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--accent);transform:scaleX(0);transition:transform .3s;transform-origin:left}
        .stat-card:hover::after{transform:scaleX(1)}
        .stat-label{font-family:'DM Mono',monospace;font-size:.65rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:10px}
        .stat-value{font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:.02em;line-height:1;color:var(--accent)}
        .stat-unit{font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted);margin-top:4px;letter-spacing:.1em}
        .chart-box{background:rgba(17,17,17,0.85);border:1px solid var(--border);border-radius:6px;padding:24px 20px 16px;margin-bottom:28px;backdrop-filter:blur(2px);}
        .section-title{font-family:'DM Mono',monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:14px}
        .chart-tabs{display:flex;gap:8px;margin-bottom:20px}
        .ct{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .ct.active{border-color:var(--accent2);color:var(--accent2)}
        .bar-chart{display:flex;align-items:flex-end;gap:4px;height:140px;position:relative}
        .bar-chart::before{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:var(--dim)}
        .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;position:relative}
        .bar-wrap:hover .bar-tip{opacity:1}
        .bar-tip{position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:'DM Mono',monospace;font-size:.62rem;white-space:nowrap;color:var(--text);opacity:0;transition:opacity .15s;pointer-events:none;z-index:10}
        .bar-pair{display:flex;align-items:flex-end;gap:2px;width:100%;height:100%;justify-content:center}
        .bar{flex:1;border-radius:3px 3px 0 0;min-height:2px;transition:height .5s cubic-bezier(.34,1.56,.64,1)}
        .bar.dist{background:var(--accent)}
        .bar.elev{background:var(--accent2)}
        .bar.prev{background:rgba(255,255,255,0.07)}
        .bar-months{display:flex;gap:4px;margin-top:6px}
        .bar-month{flex:1;text-align:center;font-family:'DM Mono',monospace;font-size:.6rem;color:var(--muted)}
        .delta{font-family:'DM Mono',monospace;font-size:.48rem;margin-top:8px;opacity:.65}
        .delta-abs{opacity:.45;font-size:.46rem}
        .rides-list{background:rgba(17,17,17,0.85);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:28px;backdrop-filter:blur(2px);}
        .rides-header{display:grid;grid-template-columns:1fr 90px 80px 80px 70px;gap:8px;padding:10px 18px;border-bottom:1px solid var(--dim);font-family:'DM Mono',monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:right}
        .rides-header span:first-child{text-align:left}
        .ride-row{display:grid;grid-template-columns:1fr 90px 80px 80px 70px;gap:8px;padding:12px 18px;border-bottom:1px solid var(--dim);align-items:center;transition:background .15s;text-align:right}
        .ride-row:last-child{border-bottom:none}
        .ride-row:hover{background:rgba(42,42,42,0.8)}
        .ride-name{font-size:.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;color:var(--text);text-decoration:none;display:block}
        .ride-name:hover{color:var(--accent)}
        .ride-date{font-family:'DM Mono',monospace;font-size:.68rem;color:var(--muted);margin-top:2px;text-align:left}
        .ride-val{font-family:'DM Mono',monospace;font-size:.78rem}
        .ride-type{font-family:'DM Mono',monospace;font-size:.62rem;padding:2px 7px;border-radius:2px;background:var(--dim);color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
        .app-footer{display:flex;align-items:center;justify-content:space-between;padding:32px 0 8px;border-top:1px solid #1a1a1a;margin-top:8px}
        .strava-footer-link{display:inline-flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:.65rem;color:#444;text-decoration:none;letter-spacing:.08em;text-transform:uppercase;transition:color .15s}
        .strava-footer-link:hover{color:#FC4C02}
        .privacy-footer-link{font-family:'DM Mono',monospace;font-size:.72rem;color:#555;text-decoration:none;letter-spacing:.08em;text-transform:uppercase;transition:color .15s}
        .privacy-footer-link:hover{color:#888}
        @media(max-width:600px){
          .rides-header,.ride-row{grid-template-columns:1fr 80px 70px}
          .rides-header>*:nth-child(4),.ride-row>*:nth-child(4),
          .rides-header>*:nth-child(5),.ride-row>*:nth-child(5){display:none}
          .bar-chart{height:100px}
          .header-right{align-items:flex-start}
          .user-name,.user-sub{text-align:left}
        }
      `}</style>
    </>
  )
}
