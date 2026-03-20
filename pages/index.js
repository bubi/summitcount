import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Strava API ───────────────────────────────────────────────────────────────
async function stravaGet(path, token) {
  const res = await fetch('https://www.strava.com/api/v3' + path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

async function fetchAllActivities(token) {
  let page = 1, all = [];
  while (true) {
    const batch = await stravaGet(`/athlete/activities?per_page=200&page=${page}`, token);
    if (!batch?.length) break;
    all = all.concat(batch);
    if (batch.length < 200) break;
    page++;
  }
  return all.filter(a =>
    ['Ride','VirtualRide','EBikeRide','GravelRide','MountainBikeRide'].includes(a.sport_type || a.type)
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDist = (m, unit) => unit === 'metric' ? (m/1000).toFixed(1)+' km' : (m/1609.34).toFixed(1)+' mi';
const fmtElev = (m, unit) => unit === 'metric' ? Math.round(m)+' m' : Math.round(m*3.28084)+' ft';
const fmtTime = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return `${h}h ${m}m`; };
const fmtNum  = (m, unit) => unit === 'metric' ? (m/1000).toFixed(1) : (m/1609.34).toFixed(1);
const fmtElevNum = (m, unit) => unit === 'metric' ? Math.round(m) : Math.round(m*3.28084);

// ─── Demo data ────────────────────────────────────────────────────────────────
function generateDemo() {
  const names = ['Morning Spin','Gravel Shred','Col du Tourmalet','Coffee Run','Epic Sunday','MTB Madness','Recovery Roll','Sunday Fondö'];
  const acts = [];
  [2023,2024,2025].forEach(yr => {
    for (let i=0;i<80+Math.floor(Math.random()*40);i++) {
      const mo=Math.floor(Math.random()*12), dy=Math.floor(Math.random()*27)+1;
      acts.push({
        id: Math.random(), name: names[Math.floor(Math.random()*names.length)],
        start_date: new Date(yr,mo,dy).toISOString(),
        distance: 15000+Math.random()*125000, total_elevation_gain: 100+Math.random()*2700,
        moving_time: 2400+Math.random()*16000, sport_type: Math.random()>.85?'GravelRide':'Ride'
      });
    }
  });
  return acts;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [screen, setScreen]       = useState('connect'); // connect | loading | dashboard
  const [token, setToken]         = useState(null);
  const [athlete, setAthlete]     = useState(null);
  const [activities, setActivities] = useState([]);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [unit, setUnit]           = useState('metric');
  const [chartMode, setChartMode] = useState('dist');
  const [error, setError]         = useState('');
  const [loadStatus, setLoadStatus] = useState('');

  // ── OAuth callback handling ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const savedToken = localStorage.getItem('strava_token');
    const savedExpiry = localStorage.getItem('strava_token_expiry');

    if (code) {
      window.history.replaceState({}, '', '/');
      handleCodeExchange(code);
    } else if (savedToken && savedExpiry && Date.now() < Number(savedExpiry)) {
      loadDashboard(savedToken);
    }
  }, []);

  const handleCodeExchange = async (code) => {
    setScreen('loading');
    setLoadStatus('Token wird geholt…');
    const clientId     = localStorage.getItem('strava_client_id');
    const clientSecret = localStorage.getItem('strava_client_secret');
    try {
      const res  = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
      });
      const data = await res.json();
      if (!data.access_token) throw new Error(data.message || 'Token fehlgeschlagen');
      localStorage.setItem('strava_token', data.access_token);
      localStorage.setItem('strava_token_expiry', String(data.expires_at * 1000));
      if (data.athlete) setAthlete(data.athlete);
      loadDashboard(data.access_token, data.athlete);
    } catch(e) { setError(e.message); setScreen('connect'); }
  };

  const loadDashboard = async (tok, ath = null) => {
    setToken(tok);
    setScreen('loading');
    try {
      setLoadStatus('Profil laden…');
      const a = ath || await stravaGet('/athlete', tok);
      setAthlete(a);
      setLoadStatus('Rides werden geladen… (kann kurz dauern)');
      const acts = await fetchAllActivities(tok);
      setActivities(acts);
      const years = [...new Set(acts.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a);
      if (years.length) setYear(years[0]);
      setScreen('dashboard');
    } catch(e) {
      setError(e.message);
      setScreen('connect');
    }
  };

  const disconnect = () => {
    localStorage.clear();
    setToken(null); setAthlete(null); setActivities([]);
    setError(''); setScreen('connect');
  };

  const loadDemo = () => {
    setAthlete({ firstname:'Demo', lastname:'Rider', city:'Alps', country:'AT', profile_medium:null });
    const acts = generateDemo();
    setActivities(acts);
    const years = [...new Set(acts.map(a=>new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a);
    setYear(years[0]);
    setScreen('dashboard');
  };

  // ── Derived data ────────────────────────────────────────────────────────
  const yearRides = activities.filter(a => new Date(a.start_date).getFullYear() === year);
  const years     = [...new Set(activities.map(a=>new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a);

  const totalDist = yearRides.reduce((s,a)=>s+(a.distance||0),0);
  const totalElev = yearRides.reduce((s,a)=>s+(a.total_elevation_gain||0),0);
  const totalTime = yearRides.reduce((s,a)=>s+(a.moving_time||0),0);
  const avgSpeed  = totalTime>0 ? (totalDist/totalTime*3.6) : 0;

  const monthly = MONTHS.map((_,i) => ({
    dist: yearRides.filter(a=>new Date(a.start_date).getMonth()===i).reduce((s,a)=>s+(a.distance||0),0),
    elev: yearRides.filter(a=>new Date(a.start_date).getMonth()===i).reduce((s,a)=>s+(a.total_elevation_gain||0),0),
    count: yearRides.filter(a=>new Date(a.start_date).getMonth()===i).length,
  }));

  const chartVals = monthly.map(m => chartMode==='dist' ? m.dist/1000 : chartMode==='elev' ? m.elev : m.count);
  const chartMax  = Math.max(...chartVals, 1);

  const sortedRides = [...yearRides].sort((a,b)=>new Date(b.start_date)-new Date(a.start_date));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Cycling Odometer — Karoo / AXS</title>
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
            <span className="chip active">via Strava</span>
          </div>
        </div>

        {/* ── CONNECT ── */}
        {screen === 'connect' && <ConnectPanel onDemo={loadDemo} onLoad={loadDashboard} error={error} setError={setError} />}

        {/* ── LOADING ── */}
        {screen === 'loading' && (
          <div className="loading-full">
            <div className="spinner" />
            <p>{loadStatus || 'Laden…'}</p>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {screen === 'dashboard' && (
          <div className="dashboard">
            {/* User bar */}
            <div className="user-bar">
              <div className="user-info">
                {athlete?.profile_medium
                  ? <img src={athlete.profile_medium} className="avatar" alt="avatar" />
                  : <div className="avatar-ph">🚴</div>}
                <div>
                  <div className="user-name">{athlete?.firstname} {athlete?.lastname}</div>
                  <div className="user-sub">{[athlete?.city, athlete?.country].filter(Boolean).join(', ')}</div>
                </div>
              </div>
              <div className="bar-right">
                <div className="unit-toggle">
                  <button className={unit==='metric'?'ut active':'ut'} onClick={()=>setUnit('metric')}>KM</button>
                  <button className={unit==='imperial'?'ut active':'ut'} onClick={()=>setUnit('imperial')}>MI</button>
                </div>
                <button className="btn-danger" onClick={disconnect}>Disconnect</button>
              </div>
            </div>

            {/* Year nav */}
            <div className="year-nav">
              {years.map(y=>(
                <button key={y} className={y===year?'yr-btn active':'yr-btn'} onClick={()=>setYear(y)}>{y}</button>
              ))}
            </div>

            {/* Stats */}
            <div className="stats-grid">
              {[
                { label:'Total Distance',   value: fmtNum(totalDist,unit),      unit: unit==='metric'?'KM':'MILES' },
                { label:'Elevation Gained', value: fmtElevNum(totalElev,unit).toLocaleString(), unit: unit==='metric'?'METERS':'FEET' },
                { label:'Total Ride Time',  value: fmtTime(totalTime),          unit: 'HRS / MIN' },
                { label:'Rides Completed',  value: yearRides.length,            unit: 'ACTIVITIES' },
                { label:'Avg Speed',        value: (unit==='metric'?avgSpeed:avgSpeed*0.621).toFixed(1), unit: unit==='metric'?'KM/H':'MPH' },
                { label:'Avg Distance',     value: yearRides.length>0 ? fmtNum(totalDist/yearRides.length,unit) : '0', unit: unit==='metric'?'KM / RIDE':'MI / RIDE' },
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
                {['dist','elev','rides'].map(m=>(
                  <button key={m} className={chartMode===m?'ct active':'ct'} onClick={()=>setChartMode(m)}>
                    {m==='dist'?'Distance':m==='elev'?'Elevation':'Rides'}
                  </button>
                ))}
              </div>
              <div className="bar-chart">
                {monthly.map((m,i)=>{
                  const val = chartVals[i];
                  const pct = (val/chartMax)*100;
                  const tip = chartMode==='dist'
                    ? (unit==='metric'?val.toFixed(0)+'km':(val*0.621).toFixed(0)+'mi')
                    : chartMode==='elev'
                    ? (unit==='metric'?Math.round(m.elev)+'m':Math.round(m.elev*3.28)+'ft')
                    : val+' rides';
                  return (
                    <div key={i} className="bar-wrap">
                      <div className="bar-tip">{tip}</div>
                      <div className={`bar ${chartMode==='elev'?'elev':'dist'}`} style={{height:`${pct}%`}} />
                      <div className="bar-label">{MONTHS[i]}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rides list */}
            <div className="section-title">All Rides — {sortedRides.length} activities</div>
            <div className="rides-list">
              <div className="rides-header">
                <span>Activity</span>
                <span>Dist</span>
                <span>Elev</span>
                <span>Time</span>
                <span>Type</span>
              </div>
              {sortedRides.map(a=>(
                <div key={a.id} className="ride-row">
                  <div>
                    <div className="ride-name">{a.name}</div>
                    <div className="ride-date">{new Date(a.start_date).toLocaleDateString('de-AT',{day:'2-digit',month:'short'})}</div>
                  </div>
                  <div className="ride-val">{fmtDist(a.distance,unit)}</div>
                  <div className="ride-val">{fmtElev(a.total_elevation_gain,unit)}</div>
                  <div className="ride-val">{fmtTime(a.moving_time)}</div>
                  <div><span className="ride-type">{(a.sport_type||a.type||'Ride').replace('EBikeRide','E-Bike').replace('VirtualRide','Virtual').slice(0,8)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        :root{
          --bg:#0a0a0a;--panel:#111;--border:#222;--accent:#e8ff47;
          --accent2:#ff6b35;--text:#f0f0f0;--muted:#555;--dim:#2a2a2a;
        }
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
        body::before{content:'';position:fixed;inset:0;
          background-image:linear-gradient(rgba(232,255,71,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(232,255,71,.03) 1px,transparent 1px);
          background-size:40px 40px;pointer-events:none;z-index:0}
        .wrap{max-width:960px;margin:0 auto;padding:40px 24px;position:relative;z-index:1}
        .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:48px;flex-wrap:wrap;gap:16px}
        .logo-area h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(2.4rem,6vw,4rem);letter-spacing:.04em;line-height:.9;color:var(--accent)}
        .logo-area p{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--muted);letter-spacing:.15em;text-transform:uppercase;margin-top:6px}
        .chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .chip{font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.1em;padding:4px 10px;border-radius:3px;text-transform:uppercase;border:1px solid var(--border);color:var(--muted)}
        .chip.active{border-color:var(--accent);color:var(--accent)}

        /* Connect */
        .connect-panel{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center}
        .strava-title{font-family:'Bebas Neue',sans-serif;font-size:2.4rem;color:#FC4C02;letter-spacing:.05em;margin-bottom:8px}
        .connect-panel h2{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.05em;margin-bottom:8px}
        .connect-panel>p{color:var(--muted);font-size:.9rem;line-height:1.6;max-width:420px;margin:0 auto 24px}
        .setup-steps{background:var(--dim);border-radius:6px;padding:20px 24px;text-align:left;max-width:480px;margin:0 auto 24px}
        .setup-steps h3{font-family:'DM Mono',monospace;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
        .setup-steps ol{padding-left:18px}
        .setup-steps li{font-size:.82rem;color:#aaa;margin-bottom:8px;line-height:1.5}
        .setup-steps a{color:var(--accent2)}
        .setup-steps code{background:#0a0a0a;padding:2px 6px;border-radius:3px;font-family:'DM Mono',monospace;font-size:.8em;color:var(--accent)}
        .input-row{display:flex;gap:10px;max-width:480px;margin:0 auto 10px;flex-wrap:wrap}
        .input-row input{flex:1;background:var(--dim);border:1px solid var(--border);border-radius:4px;padding:10px 14px;color:var(--text);font-family:'DM Mono',monospace;font-size:.82rem;outline:none;transition:border-color .2s;min-width:140px}
        .input-row input:focus{border-color:var(--accent)}
        .input-row input::placeholder{color:var(--muted)}
        .btn{background:var(--accent);color:#000;border:none;border-radius:4px;padding:10px 20px;font-family:'DM Sans',sans-serif;font-weight:500;font-size:.85rem;cursor:pointer;transition:all .15s;white-space:nowrap}
        .btn:hover{background:#f0ff60;transform:translateY(-1px)}
        .btn-full{width:100%;max-width:480px;padding:13px;font-size:.95rem;margin:0 auto;display:block}
        .btn-outline{background:transparent;color:var(--accent);border:1px solid var(--accent)}
        .btn-outline:hover{background:var(--accent);color:#000}
        .btn-danger{background:transparent;color:#ff4444;border:1px solid #ff4444;border-radius:4px;padding:6px 12px;font-family:'DM Sans',sans-serif;font-size:.75rem;cursor:pointer;transition:all .15s}
        .btn-danger:hover{background:#ff4444;color:#fff}
        .divider{display:flex;align-items:center;gap:12px;margin:20px auto;color:var(--muted);font-family:'DM Mono',monospace;font-size:.65rem;letter-spacing:.1em;max-width:480px}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border)}
        .error-box{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:4px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:.75rem;color:#ff6666;margin:10px auto;max-width:480px;text-align:left}
        .demo-note{font-family:'DM Mono',monospace;font-size:.7rem;color:var(--muted);margin-top:12px}
        .demo-note span{color:var(--accent2);cursor:pointer;text-decoration:underline}

        /* Loading */
        .loading-full{text-align:center;padding:80px 20px}
        .spinner{width:40px;height:40px;border:2px solid var(--dim);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
        .loading-full p{font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted);letter-spacing:.1em}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Dashboard */
        .user-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px}
        .user-info{display:flex;align-items:center;gap:12px}
        .avatar{width:42px;height:42px;border-radius:50%;border:2px solid var(--accent);object-fit:cover}
        .avatar-ph{width:42px;height:42px;border-radius:50%;border:2px solid var(--accent);background:var(--dim);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
        .user-name{font-family:'DM Mono',monospace;font-size:.8rem;color:var(--accent)}
        .user-sub{font-size:.72rem;color:var(--muted);margin-top:2px}
        .bar-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .unit-toggle{display:flex;background:var(--dim);border-radius:4px;padding:2px;gap:2px}
        .ut{font-family:'DM Mono',monospace;font-size:.68rem;padding:4px 10px;border:none;border-radius:3px;background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .ut.active{background:var(--panel);color:var(--accent)}
        .year-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
        .yr-btn{font-family:'DM Mono',monospace;font-size:.75rem;padding:6px 14px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .yr-btn:hover{border-color:var(--accent);color:var(--accent)}
        .yr-btn.active{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}

        /* Stats */
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
        .stat-card{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:24px 20px;transition:border-color .2s;position:relative;overflow:hidden}
        .stat-card:hover{border-color:var(--accent)}
        .stat-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--accent);transform:scaleX(0);transition:transform .3s ease;transform-origin:left}
        .stat-card:hover::after{transform:scaleX(1)}
        .stat-label{font-family:'DM Mono',monospace;font-size:.65rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:10px}
        .stat-value{font-family:'Bebas Neue',sans-serif;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:.02em;line-height:1;color:var(--accent)}
        .stat-unit{font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted);margin-top:4px;letter-spacing:.1em}

        /* Chart */
        .chart-box{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:24px 20px 16px;margin-bottom:28px}
        .section-title{font-family:'DM Mono',monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:14px}
        .chart-tabs{display:flex;gap:8px;margin-bottom:20px}
        .ct{font-family:'DM Mono',monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
        .ct.active{border-color:var(--accent2);color:var(--accent2)}
        .bar-chart{display:flex;align-items:flex-end;gap:6px;height:140px;padding-bottom:28px;position:relative}
        .bar-chart::before{content:'';position:absolute;bottom:28px;left:0;right:0;height:1px;background:var(--dim)}
        .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;position:relative;gap:0}
        .bar-wrap:hover .bar-tip{opacity:1}
        .bar-tip{position:absolute;bottom:calc(100% - 20px);left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:'DM Mono',monospace;font-size:.62rem;white-space:nowrap;color:var(--text);opacity:0;transition:opacity .15s;pointer-events:none;z-index:10}
        .bar{width:100%;border-radius:3px 3px 0 0;min-height:2px;transition:height .6s cubic-bezier(.34,1.56,.64,1)}
        .bar.dist{background:var(--accent)}
        .bar.elev{background:var(--accent2)}
        .bar-label{font-family:'DM Mono',monospace;font-size:.6rem;color:var(--muted);position:absolute;bottom:4px}

        /* Rides */
        .rides-list{background:var(--panel);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:28px}
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
  );
}

// ─── Connect Panel Component ──────────────────────────────────────────────────
function ConnectPanel({ onDemo, onLoad, error, setError }) {
  const [clientId, setClientId]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tokenDirect, setTokenDirect]   = useState('');

  useEffect(() => {
    setClientId(localStorage.getItem('strava_client_id') || '');
    setClientSecret(localStorage.getItem('strava_client_secret') || '');
  }, []);

  const startOAuth = () => {
    if (!clientId) { setError('Bitte Client ID eingeben'); return; }
    if (!clientSecret) { setError('Bitte Client Secret eingeben'); return; }
    localStorage.setItem('strava_client_id', clientId);
    localStorage.setItem('strava_client_secret', clientSecret);
    const redirect = window.location.origin;
    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&approval_prompt=force&scope=activity:read_all`;
    window.location.href = url;
  };

  const connectDirect = () => {
    if (!tokenDirect.trim()) { setError('Bitte Token einfügen'); return; }
    localStorage.setItem('strava_token', tokenDirect.trim());
    onLoad(tokenDirect.trim());
  };

  return (
    <div className="connect-panel">
      <div className="strava-title">STRAVA</div>
      <h2>Connect Your Rides</h2>
      <p>Hammerhead Karoo und SRAM AXS sync zu Strava. Einmalig verbinden — danach lädt alles automatisch.</p>

      <div className="setup-steps">
        <h3>Setup (einmalig ~2 Min)</h3>
        <ol>
          <li>Geh zu <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a> → App erstellen</li>
          <li><strong>Authorization Callback Domain:</strong> <code>{typeof window !== 'undefined' ? window.location.hostname : 'deine-domain.vercel.app'}</code></li>
          <li>Client ID + Secret unten einfügen → Verbinden</li>
        </ol>
      </div>

      <div className="input-row">
        <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Client ID" autoComplete="off" />
        <input type="password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} placeholder="Client Secret" autoComplete="off" />
      </div>
      <button className="btn btn-full" onClick={startOAuth}>Mit Strava verbinden →</button>

      <div className="divider">oder Token direkt einfügen</div>

      <div className="input-row">
        <input type="password" value={tokenDirect} onChange={e=>setTokenDirect(e.target.value)} placeholder="Access Token (activity:read_all)" autoComplete="off" />
        <button className="btn btn-outline" onClick={connectDirect}>Laden</button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}
      <p className="demo-note">Kein Account? <span onClick={onDemo}>Demo-Daten laden →</span></p>
    </div>
  );
}
