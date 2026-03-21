import { useEffect } from 'react'
import Head from 'next/head'
import { initMountainBackground } from '../lib/mountainBackground'

export default function Privacy() {
  useEffect(() => {
    const cleanup = initMountainBackground('mountain-bg')
    return cleanup
  }, [])

  return (
    <>
      <Head>
        <title>Privacy Policy — SummitCount</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="page">
        <canvas id="mountain-bg" className="mountain-canvas" />
        <div className="wrap">
          <div className="header">
            <a href="/" className="logo">SUMMIT<br/>COUNT</a>
          </div>

          <div className="content">
            <h1>Privacy Policy</h1>
            <p className="updated">Last updated: March 2026</p>

            <section>
              <h2>1. Overview</h2>
              <p>SummitCount ("we", "our", "the app") is a personal cycling statistics dashboard that connects to Strava to display your ride data. We take your privacy seriously and only collect what is strictly necessary to provide the service.</p>
            </section>

            <section>
              <h2>2. Data We Collect</h2>
              <p>When you connect your Strava account, we store the following data in our database:</p>
              <ul>
                <li><strong>Account information:</strong> Your Strava athlete ID, first name, last name, profile picture URL, city and country.</li>
                <li><strong>Authentication tokens:</strong> Your Strava OAuth access token and refresh token, required to fetch your activity data. These are stored securely and never shared.</li>
                <li><strong>Activity data:</strong> For each cycling activity: name, sport type, date, distance, elevation gain, and moving time. We do not store GPS routes, heart rate, power data, or any other detailed streams.</li>
              </ul>
            </section>

            <section>
              <h2>3. How We Use Your Data</h2>
              <p>Your data is used exclusively to display your personal cycling statistics within SummitCount. We do not:</p>
              <ul>
                <li>Share your data with third parties</li>
                <li>Use your data for advertising or marketing</li>
                <li>Sell your data under any circumstances</li>
                <li>Use your data for any purpose other than displaying your own statistics to you</li>
              </ul>
            </section>

            <section>
              <h2>4. Strava Data</h2>
              <p>SummitCount accesses your Strava data via the official Strava API with read-only permissions (<code>activity:read_all</code>). We cannot modify, delete, or post anything to your Strava account. Your Strava credentials (username and password) are never seen or stored by us — authentication is handled entirely by Strava.</p>
              <p>Activity data sourced from Garmin devices via Strava may require attribution to Garmin per their brand guidelines.</p>
            </section>

            <section>
              <h2>5. Data Storage</h2>
              <p>Your data is stored in a secured PostgreSQL database hosted by Supabase (EU region). Access is restricted to the application only via server-side API routes. No data is stored in your browser beyond a session cookie.</p>
            </section>

            <section>
              <h2>6. Session Cookie</h2>
              <p>We use a single encrypted session cookie (<code>summitcount_session</code>) to keep you logged in. This cookie contains only your internal user ID and basic profile info. It expires after 60 days. No tracking or advertising cookies are used.</p>
            </section>

            <section>
              <h2>7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access your data:</strong> All your stored data is visible in the app dashboard.</li>
                <li><strong>Delete your data:</strong> You can revoke access at any time by removing SummitCount from your <a href="https://www.strava.com/settings/apps" target="_blank" rel="noreferrer">Strava connected apps</a>. This will automatically trigger deletion of all your data from our database within minutes via Strava's webhook system.</li>
                <li><strong>Request deletion:</strong> You can also contact us directly to request immediate deletion of all your data.</li>
              </ul>
            </section>

            <section>
              <h2>8. Data Retention</h2>
              <p>Your data is retained for as long as you have an active account. If you revoke access via Strava, all your data is deleted automatically. Inactive accounts (no login for 12 months) may be deleted.</p>
            </section>

            <section>
              <h2>9. Contact</h2>
              <p>For any privacy-related questions or data deletion requests, please contact us at: <a href="mailto:privacy@summitcount.app">privacy@summitcount.app</a></p>
            </section>

            <section>
              <h2>10. Changes to This Policy</h2>
              <p>We may update this policy from time to time. The date at the top of this page reflects the last update. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
            </section>

            <div className="footer-links">
              <a href="https://www.strava.com" target="_blank" rel="noreferrer" className="powered-link">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#FC4C02">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
                Powered by Strava
              </a>
              <a href="/" className="back-link">← Zurück</a>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#0a0a0a;color:#f0f0f0;font-family:'DM Sans',sans-serif}
      `}</style>
      <style jsx>{`
        .page{min-height:100vh;padding:40px 24px;position:relative;}
        .mountain-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;}
        .wrap{max-width:680px;margin:0 auto;position:relative;z-index:1;}
        .header{margin-bottom:48px}
        .logo{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.04em;line-height:.9;color:#e8ff47;text-decoration:none;display:inline-block}
        .logo:hover{opacity:.8}
        .content h1{font-family:'Bebas Neue',sans-serif;font-size:2.4rem;letter-spacing:.04em;color:#e8ff47;margin-bottom:8px}
        .updated{font-family:'DM Mono',monospace;font-size:.7rem;color:#555;letter-spacing:.1em;margin-bottom:40px}
        section{margin-bottom:32px}
        section h2{font-family:'DM Mono',monospace;font-size:.75rem;text-transform:uppercase;letter-spacing:.15em;color:#888;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1a1a1a}
        section p{font-size:.9rem;color:#aaa;line-height:1.8;margin-bottom:10px}
        section ul{padding-left:20px;margin-top:8px}
        section ul li{font-size:.9rem;color:#aaa;line-height:1.8;margin-bottom:6px}
        section strong{color:#ddd;font-weight:500}
        section a{color:#FC4C02;text-decoration:none}
        section a:hover{text-decoration:underline}
        section code{background:#1a1a1a;padding:2px 6px;border-radius:3px;font-family:'DM Mono',monospace;font-size:.8em;color:#e8ff47}
        .footer-links{margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;display:flex;align-items:center;justify-content:space-between;}
        .powered-link{display:inline-flex;align-items:center;gap:6px;font-family:'DM Mono',monospace;font-size:.65rem;color:#444;text-decoration:none;transition:color .15s;letter-spacing:.08em;text-transform:uppercase}
        .powered-link:hover{color:#FC4C02}
        .back-link{font-family:'DM Mono',monospace;font-size:.65rem;color:#444;text-decoration:none;transition:color .15s;letter-spacing:.08em;text-transform:uppercase}
        .back-link:hover{color:#888}
      `}</style>
    </>
  )
}
