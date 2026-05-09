import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export const alt = 'DAATAN Forecast'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const truncate = (text: string, max = 110) =>
  text.length > max ? text.slice(0, max).trimEnd() + '…' : text

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const statusColor = (status: string) => {
  if (status === 'ACTIVE') return { bg: '#1a3a1a', text: '#4ade80', label: 'Active' }
  if (status === 'RESOLVED') return { bg: '#1a2a3a', text: '#60a5fa', label: 'Resolved' }
  return { bg: '#2a2a1a', text: '#fbbf24', label: status.replace('_', ' ') }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params

  const prediction = await prisma.prediction.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: {
      claimText: true,
      status: true,
      resolveByDatetime: true,
      confidence: true,
      outcomeType: true,
      author: { select: { name: true, username: true, image: true } },
      _count: { select: { commitments: true } },
    },
  })

  if (!prediction) return new Response('Not Found', { status: 404 })

  const status = statusColor(prediction.status)
  const resolveDate = formatDate(prediction.resolveByDatetime.toISOString())
  const probability = prediction.confidence != null ? `${prediction.confidence}%` : null
  const authorInitial = (prediction.author.name ?? '?').charAt(0).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0B1F33',
          backgroundImage: 'linear-gradient(135deg, #0B1F33 0%, #0E2D4A 100%)',
          padding: '60px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', backgroundColor: '#2F6BFF', borderRadius: '8px', marginRight: '12px' }} />
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '-0.02em' }}>
              DAATAN
            </span>
          </div>
          <div style={{
            display: 'flex',
            padding: '6px 18px',
            backgroundColor: status.bg,
            borderRadius: '100px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: status.text,
            letterSpacing: '0.05em',
          }}>
            {status.label.toUpperCase()}
          </div>
        </div>

        {/* Claim */}
        <div style={{
          fontSize: '52px',
          fontWeight: 'bold',
          color: '#ffffff',
          lineHeight: 1.15,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}>
          {truncate(prediction.claimText)}
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '28px',
          marginTop: '28px',
        }}>
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {prediction.author.image ? (
              <img src={prediction.author.image} style={{ width: '52px', height: '52px', borderRadius: '50%', marginRight: '14px' }} alt="" />
            ) : (
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                backgroundColor: '#1C3A5A', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '22px', fontWeight: 'bold',
                color: '#2F6BFF', marginRight: '14px',
              }}>{authorInitial}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffffff' }}>{prediction.author.name}</span>
              <span style={{ fontSize: '16px', color: '#7A9CC0' }}>@{prediction.author.username ?? 'anonymous'}</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#7A9CC0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resolves</span>
              <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#B2BED0' }}>{resolveDate}</span>
            </div>
            {probability && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#7A9CC0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Probability</span>
                <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#2F6BFF' }}>{probability}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#7A9CC0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Commitments</span>
              <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#ffffff' }}>{prediction._count.commitments}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
