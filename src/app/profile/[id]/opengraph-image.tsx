import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'

export const runtime = 'edge'

// Image metadata
export const alt = 'DAATAN User Profile'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({ params }: { params: { id: string } }) {
  const { id } = params

  // Try to find by ID or Username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: id },
        { username: id }
      ]
    },
    select: {
      name: true,
      username: true,
      image: true,
      rs: true,
      _count: {
        select: {
          predictions: true,
          commitments: true,
        }
      }
    }
  })

  if (!user) {
    return new Response('Not Found', { status: 404 })
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
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
            position: 'absolute',
            top: '60px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#2563eb',
              borderRadius: '6px',
              marginRight: '10px',
            }}
          />
          <span
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#1e40af',
              letterSpacing: '-0.02em',
            }}
          >
            DAATAN
          </span>
        </div>

        {/* Profile Info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {user.image ? (
            <img
              src={user.image}
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                marginBottom: '24px',
                border: '8px solid #fff',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
          ) : (
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                backgroundColor: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '72px',
                fontWeight: 'bold',
                color: '#2563eb',
                marginBottom: '24px',
                border: '8px solid #fff',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            >
              {user.name?.charAt(0) || '?'}
            </div>
          )}
          
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#0f172a',
              marginBottom: '8px',
              lineHeight: 1,
            }}
          >
            {user.name}
          </h1>
          <span style={{ fontSize: '32px', color: '#64748b', marginBottom: '48px' }}>
            @{user.username || 'anonymous'}
          </span>

          <div style={{ display: 'flex', gap: '60px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Reputation Score
              </span>
              <span style={{ fontSize: '56px', fontWeight: 'bold', color: '#2563eb' }}>
                {Math.round(user.rs)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Commitments
              </span>
              <span style={{ fontSize: '56px', fontWeight: 'bold', color: '#0f172a' }}>
                {user._count.commitments}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Forecasts
              </span>
              <span style={{ fontSize: '56px', fontWeight: 'bold', color: '#0f172a' }}>
                {user._count.predictions}
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
