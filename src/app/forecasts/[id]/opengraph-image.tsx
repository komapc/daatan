import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Image metadata
export const alt = 'DAATAN Forecast'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params

  // Fetch prediction data
  const prediction = await prisma.prediction.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    include: {
      author: {
        select: {
          name: true,
          username: true,
          image: true,
        },
      },
      _count: {
        select: { commitments: true },
      },
    },
  })

  if (!prediction) {
    return new Response('Not Found', { status: 404 })
  }

  // Calculate probability for binary
  let probabilityText = ''
  if (prediction.outcomeType === 'BINARY') {
    const commitments = await prisma.commitment.findMany({
      where: { predictionId: prediction.id },
      select: { binaryChoice: true },
    })
    const yesCount = commitments.filter(c => c.binaryChoice === true).length
    const totalCount = commitments.length
    const prob = totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : 50
    probabilityText = `${prob}% YES`
  }

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
          backgroundColor: '#fff',
          backgroundImage: 'linear-gradient(to bottom right, #f8fafc, #eff6ff)',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo/Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#2563eb',
              borderRadius: '8px',
              marginRight: '12px',
            }}
          />
          <span
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1e40af',
              letterSpacing: '-0.02em',
            }}
          >
            DAATAN
          </span>
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: 'flex',
            padding: '6px 16px',
            backgroundColor: prediction.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
            color: prediction.status === 'ACTIVE' ? '#166534' : '#475569',
            borderRadius: '100px',
            fontSize: '20px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          {prediction.status.replace('_', ' ')}
        </div>

        {/* Claim Text */}
        <div
          style={{
            fontSize: '60px',
            fontWeight: 'bold',
            color: '#0f172a',
            lineHeight: 1.1,
            marginBottom: '40px',
            display: 'flex',
          }}
        >
          {prediction.claimText}
        </div>

        {/* Footer info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {prediction.author.image ? (
              <img
                src={prediction.author.image}
                alt=""
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  marginRight: '16px',
                }}
              />
            ) : (
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#2563eb',
                  marginRight: '16px',
                }}
              >
                {prediction.author.name?.charAt(0) || '?'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '24px', fontWeight: 'semibold', color: '#1e293b' }}>
                {prediction.author.name}
              </span>
              <span style={{ fontSize: '18px', color: '#64748b' }}>
                @{prediction.author.username || 'anonymous'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {probabilityText && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Community Forecast
                </span>
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#166534' }}>
                  {probabilityText}
                </span>
              </div>
            )}
            
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                marginLeft: '40px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>
                Commitments
              </span>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b' }}>
                {prediction._count.commitments}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
