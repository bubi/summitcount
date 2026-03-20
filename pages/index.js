import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function LoginPage() {
  const router = useRouter()
  const { error } = router.query

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.push('/dashboard')
    })
  }, [])

  return (
    <>
      <Head>
        <title>SummitCount — Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <div className="page">
        <div className="card">
          <div className="logo">SUMMIT<br/>COUNT</div>
          <p className="sub">Karoo · AXS · Strava</p>

          <div className="divider" />

          <p className="desc">
            Deine jährlichen Ride-Stats — Distanz, Höhenmeter, Zeit.<br/>
            Verbinde einmal, Daten bleiben gespeichert.
          </p>

          {error && (
            <div className="err">⚠ {decodeURIComponent(error)}</div>
          )}

          <a href="/api/auth/login" className="strava-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
            </svg>
            Connect with Strava
          </a>

          <p className="fine">
            Nur Lesezugriff auf deine Aktivitäten.<br/>
            Keine Daten werden an Dritte weitergegeben.
          </p>

          <div className="powered">
            <a href="https://www.strava.com" target="_blank" rel="noreferrer" className="powered-link">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Powered by Strava
            </a>
          </div>
        </div>
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#0a0a0a}
        #__next{min-height:100vh}
      `}</style>
      <style jsx>{`
        .page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;padding:24px;box-sizing:border-box}
        .page::before{content:'';position:fixed;inset:0;
          background-image:linear-gradient(rgba(232,255,71,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(232,255,71,.03) 1px,transparent 1px);
          background-size:40px 40px;pointer-events:none}
        .card{background:#111;border:1px solid #222;border-radius:12px;padding:48px 40px;text-align:center;max-width:400px;width:100%;position:relative;z-index:1}
        .logo{font-family:'Bebas Neue',sans-serif;font-size:3.5rem;letter-spacing:.04em;line-height:.9;color:#e8ff47;margin-bottom:8px}
        .sub{font-family:'DM Mono',monospace;font-size:.7rem;color:#555;letter-spacing:.15em;text-transform:uppercase}
        .divider{height:1px;background:#222;margin:28px 0}
        .desc{font-size:.88rem;color:#888;line-height:1.7;margin-bottom:28px}
        .err{background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.3);border-radius:4px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:.75rem;color:#ff6666;margin-bottom:20px}
        .strava-btn{display:inline-flex;align-items:center;gap:10px;background:#FC4C02;color:#fff;border:none;border-radius:6px;padding:14px 28px;font-family:'DM Sans',sans-serif;font-weight:600;font-size:.95rem;cursor:pointer;text-decoration:none;transition:all .15s;width:100%;justify-content:center}
        .strava-btn:hover{background:#e04400;transform:translateY(-1px)}
        .fine{font-family:'DM Mono',monospace;font-size:.65rem;color:#444;margin-top:20px;line-height:1.6}
        .powered{margin-top:24px;padding-top:20px;border-top:1px solid #1a1a1a}
        .powered-link{display:inline-flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:.65rem;color:#444;text-decoration:none;transition:color .15s}
        .powered-link:hover{color:#FC4C02}
      `}</style>
    </>
  )
}
