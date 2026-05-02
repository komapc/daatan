import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const alt = 'DAATAN — Prediction Market & Forecast Tracking'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#2563eb',
              borderRadius: '12px',
              marginRight: '20px',
            }}
          />
          <span
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            DAATAN
          </span>
        </div>

        <div
          style={{
            fontSize: '72px',
            fontWeight: 'bold',
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '32px',
            display: 'flex',
            maxWidth: '900px',
          }}
        >
          Prediction Market & Forecast Tracking
        </div>

        <div
          style={{
            fontSize: '32px',
            color: '#cbd5e1',
            lineHeight: 1.3,
            display: 'flex',
            maxWidth: '900px',
          }}
        >
          Stake reputation. Prove accuracy. Climb the leaderboard.
        </div>
      </div>
    ),
    { ...size }
  )
}
